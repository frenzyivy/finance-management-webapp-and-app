-- Migration: Debt-Expense Bidirectional Sync
-- Date: 2026-04-14
-- Adds debt_allocations bridge table, funding source tracking,
-- and RPC functions for transactional sync operations.

-- ============================================================
-- 1. Add 'debt_repayment' to expense_category enum
-- ============================================================
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'debt_repayment';

-- ============================================================
-- 2. Alter expense_entries — add sync columns
-- ============================================================
ALTER TABLE expense_entries
  ADD COLUMN IF NOT EXISTS funding_source TEXT NOT NULL DEFAULT 'own_funds'
    CHECK (funding_source IN ('own_funds', 'debt_funded', 'debt_repayment', 'mixed')),
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_debt_payment_id UUID REFERENCES debt_payments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_entries_funding_source
  ON expense_entries(funding_source);
CREATE INDEX IF NOT EXISTS idx_expense_entries_source_debt_payment
  ON expense_entries(source_debt_payment_id)
  WHERE source_debt_payment_id IS NOT NULL;

-- ============================================================
-- 3. Alter debt_payments — add sync columns
-- ============================================================
ALTER TABLE debt_payments
  ADD COLUMN IF NOT EXISTS linked_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_debt_payments_linked_expense
  ON debt_payments(linked_expense_id)
  WHERE linked_expense_id IS NOT NULL;

-- ============================================================
-- 4. Alter debts — add allocation tracking
-- ============================================================
ALTER TABLE debts
  ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(12,2) DEFAULT 0
    CHECK (allocated_amount >= 0);

-- ============================================================
-- 5. Create debt_allocations bridge table
-- ============================================================
CREATE TABLE IF NOT EXISTS debt_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    expense_id UUID NOT NULL REFERENCES expense_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(debt_id, expense_id)
);

ALTER TABLE debt_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own debt_allocations"
ON debt_allocations
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_debt_allocations_debt_id
  ON debt_allocations(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_allocations_expense_id
  ON debt_allocations(expense_id);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE debt_allocations;

-- ============================================================
-- 6. RPC: create_debt_allocations (Flow A)
--    Bulk-allocate a debt to multiple expense entries atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION create_debt_allocations(
    p_debt_id UUID,
    p_user_id UUID,
    p_allocations JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_debt debts%ROWTYPE;
    alloc JSONB;
    new_expense_id UUID;
    total_new NUMERIC(12,2) := 0;
    results JSONB := '[]'::JSONB;
BEGIN
    -- Verify debt belongs to user
    SELECT * INTO v_debt FROM debts WHERE id = p_debt_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt not found or access denied';
    END IF;

    -- Calculate total of new allocations
    SELECT COALESCE(SUM((elem->>'amount')::NUMERIC), 0)
    INTO total_new
    FROM jsonb_array_elements(p_allocations) AS elem;

    -- Validate: cannot over-allocate
    IF (COALESCE(v_debt.allocated_amount, 0) + total_new) > v_debt.original_amount THEN
        RAISE EXCEPTION 'Total allocations (%) exceed debt amount (%)',
            COALESCE(v_debt.allocated_amount, 0) + total_new, v_debt.original_amount;
    END IF;

    FOR alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        -- Insert expense entry
        INSERT INTO expense_entries (
            user_id, amount, category, sub_category, payee_name,
            date, payment_method, funding_source, is_auto_generated,
            linked_debt_id, notes
        ) VALUES (
            p_user_id,
            (alloc->>'amount')::NUMERIC,
            (alloc->>'category')::expense_category,
            alloc->>'sub_category',
            COALESCE(alloc->>'payee_name', v_debt.creditor_name || ' (debt)'),
            (alloc->>'date')::DATE,
            COALESCE(alloc->>'payment_method', 'bank_transfer'),
            'debt_funded',
            TRUE,
            p_debt_id,
            alloc->>'description'
        )
        RETURNING id INTO new_expense_id;

        -- Insert allocation bridge row
        INSERT INTO debt_allocations (
            debt_id, expense_id, user_id, amount, description, date
        ) VALUES (
            p_debt_id, new_expense_id, p_user_id,
            (alloc->>'amount')::NUMERIC,
            alloc->>'description',
            (alloc->>'date')::DATE
        );

        results := results || jsonb_build_object(
            'expense_id', new_expense_id,
            'amount', (alloc->>'amount')::NUMERIC
        );
    END LOOP;

    -- Update debt allocated_amount
    UPDATE debts
    SET allocated_amount = COALESCE(allocated_amount, 0) + total_new
    WHERE id = p_debt_id;

    RETURN jsonb_build_object('allocations', results, 'total_allocated', total_new);
END;
$$;

-- ============================================================
-- 7. RPC: log_debt_payment_with_expense (Flow C)
--    Log a debt payment and auto-create matching expense entry.
-- ============================================================
CREATE OR REPLACE FUNCTION log_debt_payment_with_expense(
    p_debt_id UUID,
    p_user_id UUID,
    p_amount NUMERIC,
    p_date DATE,
    p_notes TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'bank_transfer'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_debt debts%ROWTYPE;
    v_payment_id UUID;
    v_expense_id UUID;
    v_new_balance NUMERIC;
    v_new_status debt_status;
    v_new_remaining INTEGER;
BEGIN
    -- Verify debt belongs to user
    SELECT * INTO v_debt FROM debts WHERE id = p_debt_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Debt not found or access denied';
    END IF;

    -- Create auto-generated expense entry
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        linked_debt_id, notes
    ) VALUES (
        p_user_id, p_amount, 'debt_repayment', v_debt.name,
        v_debt.creditor_name,
        p_date, p_payment_method, 'debt_repayment', TRUE,
        p_debt_id,
        COALESCE(p_notes, 'Payment towards ' || v_debt.name)
    )
    RETURNING id INTO v_expense_id;

    -- Create debt payment
    INSERT INTO debt_payments (
        user_id, debt_id, amount, date, notes,
        linked_expense_id, is_auto_generated
    ) VALUES (
        p_user_id, p_debt_id, p_amount, p_date, p_notes,
        v_expense_id, FALSE
    )
    RETURNING id INTO v_payment_id;

    -- Link expense back to payment
    UPDATE expense_entries
    SET source_debt_payment_id = v_payment_id
    WHERE id = v_expense_id;

    -- Update debt balance and status
    v_new_balance := GREATEST(0, v_debt.outstanding_balance - p_amount);
    v_new_status := CASE
        WHEN v_new_balance <= 0 THEN 'paid_off'::debt_status
        ELSE v_debt.status
    END;
    v_new_remaining := CASE
        WHEN v_debt.emi_amount IS NOT NULL AND v_debt.remaining_emis IS NOT NULL
        THEN GREATEST(0, v_debt.remaining_emis - 1)
        ELSE v_debt.remaining_emis
    END;

    UPDATE debts SET
        outstanding_balance = v_new_balance,
        status = v_new_status,
        remaining_emis = v_new_remaining
    WHERE id = p_debt_id;

    -- Create allocation record for the repayment
    INSERT INTO debt_allocations (
        debt_id, expense_id, user_id, amount, description, date
    ) VALUES (
        p_debt_id, v_expense_id, p_user_id, p_amount,
        'Debt repayment', p_date
    );

    RETURN jsonb_build_object(
        'payment_id', v_payment_id,
        'expense_id', v_expense_id,
        'new_balance', v_new_balance,
        'new_status', v_new_status::TEXT
    );
END;
$$;

-- ============================================================
-- 8. RPC: create_expense_with_debt_link (Flow B)
--    Create expense, auto-create debt_payment if repayment,
--    create allocation if debt_funded.
-- ============================================================
CREATE OR REPLACE FUNCTION create_expense_with_debt_link(
    p_user_id UUID,
    p_amount NUMERIC,
    p_category TEXT,
    p_sub_category TEXT DEFAULT NULL,
    p_payee_name TEXT DEFAULT '',
    p_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_funding_source TEXT DEFAULT 'own_funds',
    p_linked_debt_id UUID DEFAULT NULL,
    p_is_emi BOOLEAN DEFAULT FALSE,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_recurrence_frequency TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense_id UUID;
    v_payment_id UUID;
    v_debt debts%ROWTYPE;
    v_new_balance NUMERIC;
BEGIN
    -- Insert expense entry
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, linked_debt_id,
        is_emi, is_recurring, recurrence_frequency, notes
    ) VALUES (
        p_user_id, p_amount, p_category::expense_category, p_sub_category,
        p_payee_name, p_date, p_payment_method,
        p_funding_source, p_linked_debt_id,
        p_is_emi, p_is_recurring,
        CASE WHEN p_is_recurring AND p_recurrence_frequency IS NOT NULL
             THEN p_recurrence_frequency::recurrence_frequency
             ELSE NULL END,
        p_notes
    )
    RETURNING id INTO v_expense_id;

    -- If debt_repayment: auto-create debt payment + update balance
    IF p_funding_source = 'debt_repayment' AND p_linked_debt_id IS NOT NULL THEN
        SELECT * INTO v_debt FROM debts WHERE id = p_linked_debt_id AND user_id = p_user_id;
        IF FOUND THEN
            INSERT INTO debt_payments (
                user_id, debt_id, amount, date, notes,
                linked_expense_id, is_auto_generated, source_expense_id
            ) VALUES (
                p_user_id, p_linked_debt_id, p_amount, p_date,
                'Auto-created from expense',
                v_expense_id, TRUE, v_expense_id
            )
            RETURNING id INTO v_payment_id;

            -- Link expense to payment
            UPDATE expense_entries
            SET source_debt_payment_id = v_payment_id
            WHERE id = v_expense_id;

            -- Update debt balance
            v_new_balance := GREATEST(0, v_debt.outstanding_balance - p_amount);
            UPDATE debts SET
                outstanding_balance = v_new_balance,
                status = CASE WHEN v_new_balance <= 0 THEN 'paid_off'::debt_status ELSE status END,
                remaining_emis = CASE
                    WHEN emi_amount IS NOT NULL AND remaining_emis IS NOT NULL
                    THEN GREATEST(0, remaining_emis - 1)
                    ELSE remaining_emis
                END
            WHERE id = p_linked_debt_id;

            -- Create allocation
            INSERT INTO debt_allocations (debt_id, expense_id, user_id, amount, description, date)
            VALUES (p_linked_debt_id, v_expense_id, p_user_id, p_amount, 'Debt repayment', p_date);
        END IF;
    END IF;

    -- If debt_funded: create allocation + update allocated_amount
    IF p_funding_source = 'debt_funded' AND p_linked_debt_id IS NOT NULL THEN
        INSERT INTO debt_allocations (debt_id, expense_id, user_id, amount, description, date)
        VALUES (p_linked_debt_id, v_expense_id, p_user_id, p_amount, p_notes, p_date);

        UPDATE debts
        SET allocated_amount = COALESCE(allocated_amount, 0) + p_amount
        WHERE id = p_linked_debt_id AND user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'expense_id', v_expense_id,
        'payment_id', v_payment_id
    );
END;
$$;

-- ============================================================
-- 9. RPC: delete_expense_with_cascade (Flow D)
--    Delete expense and reverse any debt payment/allocation.
-- ============================================================
CREATE OR REPLACE FUNCTION delete_expense_with_cascade(
    p_expense_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense expense_entries%ROWTYPE;
    v_payment debt_payments%ROWTYPE;
    v_alloc_total NUMERIC(12,2);
BEGIN
    -- Fetch expense
    SELECT * INTO v_expense FROM expense_entries
    WHERE id = p_expense_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expense not found or access denied';
    END IF;

    -- If linked to a debt payment via source_debt_payment_id, reverse it
    IF v_expense.source_debt_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment FROM debt_payments WHERE id = v_expense.source_debt_payment_id;
        IF FOUND THEN
            -- Restore debt balance
            UPDATE debts SET
                outstanding_balance = outstanding_balance + v_payment.amount,
                status = 'active'::debt_status,
                remaining_emis = CASE
                    WHEN emi_amount IS NOT NULL AND remaining_emis IS NOT NULL
                    THEN remaining_emis + 1
                    ELSE remaining_emis
                END
            WHERE id = v_payment.debt_id;

            -- Delete the debt payment
            DELETE FROM debt_payments WHERE id = v_expense.source_debt_payment_id;
        END IF;
    END IF;

    -- If there's an auto-generated payment that references this expense
    SELECT * INTO v_payment FROM debt_payments
    WHERE source_expense_id = p_expense_id;
    IF FOUND THEN
        -- Restore debt balance
        UPDATE debts SET
            outstanding_balance = outstanding_balance + v_payment.amount,
            status = 'active'::debt_status,
            remaining_emis = CASE
                WHEN emi_amount IS NOT NULL AND remaining_emis IS NOT NULL
                THEN remaining_emis + 1
                ELSE remaining_emis
            END
        WHERE id = v_payment.debt_id;

        DELETE FROM debt_payments WHERE id = v_payment.id;
    END IF;

    -- Sum up allocations for this expense and reduce debt allocated_amount
    SELECT COALESCE(SUM(da.amount), 0) INTO v_alloc_total
    FROM debt_allocations da WHERE da.expense_id = p_expense_id;

    IF v_alloc_total > 0 AND v_expense.linked_debt_id IS NOT NULL THEN
        UPDATE debts
        SET allocated_amount = GREATEST(0, COALESCE(allocated_amount, 0) - v_alloc_total)
        WHERE id = v_expense.linked_debt_id;
    END IF;

    -- Delete allocations (CASCADE will handle but explicit for clarity)
    DELETE FROM debt_allocations WHERE expense_id = p_expense_id;

    -- Delete the expense
    DELETE FROM expense_entries WHERE id = p_expense_id;

    RETURN jsonb_build_object(
        'deleted', TRUE,
        'reversed_payment', v_payment.id IS NOT NULL,
        'reversed_allocation', v_alloc_total
    );
END;
$$;
