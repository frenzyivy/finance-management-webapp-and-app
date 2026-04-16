-- ============================================================
-- 20260419000001_bnpl_expense_link.sql
-- Purpose: let an expense entry link directly to a BNPL purchase
-- (e.g. "Induction" under "Amazon Pay Later"). Linking an
-- EMI-repayment expense to a purchase increments paid_emis and
-- reduces outstanding_balance on that purchase. Deleting the
-- expense reverses those effects.
-- ============================================================

-- 1. Add the column + index
ALTER TABLE expense_entries
ADD COLUMN IF NOT EXISTS source_bnpl_purchase_id UUID
  REFERENCES bnpl_purchases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expense_entries_source_bnpl_purchase
  ON expense_entries(source_bnpl_purchase_id)
  WHERE source_bnpl_purchase_id IS NOT NULL;

-- 2. RPC: create_expense_with_bnpl_purchase_link
--    Parallel to create_expense_with_debt_link. For funding_source
--    'debt_repayment' it behaves as an EMI payment against the
--    purchase. For 'debt_funded' it just stores the link (no counter
--    change) so the expense is tagged as funded by that purchase.
CREATE OR REPLACE FUNCTION create_expense_with_bnpl_purchase_link(
    p_user_id UUID,
    p_amount NUMERIC,
    p_category TEXT,
    p_sub_category TEXT DEFAULT NULL,
    p_payee_name TEXT DEFAULT '',
    p_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_funding_source TEXT DEFAULT 'debt_repayment',
    p_bnpl_purchase_id UUID DEFAULT NULL,
    p_is_emi BOOLEAN DEFAULT TRUE,
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
    v_purchase bnpl_purchases%ROWTYPE;
    v_new_paid_emis INTEGER;
    v_new_outstanding NUMERIC;
    v_new_status bnpl_purchase_status;
BEGIN
    IF p_bnpl_purchase_id IS NULL THEN
        RAISE EXCEPTION 'BNPL purchase id is required';
    END IF;

    SELECT * INTO v_purchase
    FROM bnpl_purchases
    WHERE id = p_bnpl_purchase_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'BNPL purchase not found or access denied';
    END IF;

    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source,
        source_bnpl_purchase_id,
        is_emi, is_recurring, recurrence_frequency, notes
    ) VALUES (
        p_user_id, p_amount, p_category::expense_category, p_sub_category,
        p_payee_name, p_date, p_payment_method,
        p_funding_source,
        p_bnpl_purchase_id,
        p_is_emi, p_is_recurring,
        CASE WHEN p_is_recurring AND p_recurrence_frequency IS NOT NULL
             THEN p_recurrence_frequency::recurrence_frequency
             ELSE NULL END,
        p_notes
    )
    RETURNING id INTO v_expense_id;

    IF p_funding_source = 'debt_repayment' THEN
        v_new_paid_emis := LEAST(v_purchase.total_emis, v_purchase.paid_emis + 1);
        v_new_outstanding := GREATEST(0, v_purchase.outstanding_balance - p_amount);
        v_new_status := CASE
            WHEN v_new_paid_emis >= v_purchase.total_emis OR v_new_outstanding <= 0
                THEN 'paid_off'::bnpl_purchase_status
            ELSE v_purchase.status
        END;

        UPDATE bnpl_purchases SET
            paid_emis = v_new_paid_emis,
            outstanding_balance = v_new_outstanding,
            status = v_new_status
        WHERE id = v_purchase.id;
    END IF;

    RETURN jsonb_build_object(
        'expense_id', v_expense_id,
        'purchase_id', v_purchase.id,
        'new_paid_emis', CASE WHEN p_funding_source = 'debt_repayment'
                              THEN v_new_paid_emis ELSE v_purchase.paid_emis END,
        'new_outstanding', CASE WHEN p_funding_source = 'debt_repayment'
                                THEN v_new_outstanding ELSE v_purchase.outstanding_balance END
    );
END;
$$;

-- 3. Extend delete_expense_with_cascade to reverse BNPL purchase effects
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
    v_bnpl_purchase bnpl_purchases%ROWTYPE;
    v_reversed_bnpl BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_expense FROM expense_entries
    WHERE id = p_expense_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Expense not found or access denied';
    END IF;

    -- Reverse debt_payment-backed expenses (existing behavior)
    IF v_expense.source_debt_payment_id IS NOT NULL THEN
        SELECT * INTO v_payment FROM debt_payments WHERE id = v_expense.source_debt_payment_id;
        IF FOUND THEN
            UPDATE debts SET
                outstanding_balance = outstanding_balance + v_payment.amount,
                status = 'active'::debt_status,
                remaining_emis = CASE
                    WHEN emi_amount IS NOT NULL AND remaining_emis IS NOT NULL
                    THEN remaining_emis + 1
                    ELSE remaining_emis
                END
            WHERE id = v_payment.debt_id;
            DELETE FROM debt_payments WHERE id = v_expense.source_debt_payment_id;
        END IF;
    END IF;

    SELECT * INTO v_payment FROM debt_payments
    WHERE source_expense_id = p_expense_id;
    IF FOUND THEN
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

    -- Reverse BNPL purchase counters if this expense was an EMI repayment
    IF v_expense.source_bnpl_purchase_id IS NOT NULL
       AND v_expense.funding_source = 'debt_repayment' THEN
        SELECT * INTO v_bnpl_purchase FROM bnpl_purchases
        WHERE id = v_expense.source_bnpl_purchase_id;
        IF FOUND THEN
            UPDATE bnpl_purchases SET
                paid_emis = GREATEST(0, paid_emis - 1),
                outstanding_balance = outstanding_balance + v_expense.amount,
                status = CASE
                    WHEN status = 'paid_off'::bnpl_purchase_status
                        THEN 'active'::bnpl_purchase_status
                    ELSE status
                END
            WHERE id = v_bnpl_purchase.id;
            v_reversed_bnpl := TRUE;
        END IF;
    END IF;

    -- Allocations (existing behavior)
    SELECT COALESCE(SUM(da.amount), 0) INTO v_alloc_total
    FROM debt_allocations da WHERE da.expense_id = p_expense_id;

    IF v_alloc_total > 0 AND v_expense.linked_debt_id IS NOT NULL THEN
        UPDATE debts
        SET allocated_amount = GREATEST(0, COALESCE(allocated_amount, 0) - v_alloc_total)
        WHERE id = v_expense.linked_debt_id;
    END IF;

    DELETE FROM debt_allocations WHERE expense_id = p_expense_id;
    DELETE FROM expense_entries WHERE id = p_expense_id;

    RETURN jsonb_build_object(
        'deleted', TRUE,
        'reversed_payment', v_payment.id IS NOT NULL,
        'reversed_allocation', v_alloc_total,
        'reversed_bnpl_purchase', v_reversed_bnpl
    );
END;
$$;
