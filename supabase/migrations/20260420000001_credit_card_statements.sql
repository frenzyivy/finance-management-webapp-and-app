-- Migration: Credit Card Statement Tracking
-- Date: 2026-04-20
-- Creates cc_statements, cc_statement_transactions tables,
-- RPC functions for atomic operations, and links to credit_cards.

-- ============================================================
-- 1. Alter credit_cards — add due_date_day
-- ============================================================
ALTER TABLE credit_cards
  ADD COLUMN IF NOT EXISTS due_date_day INTEGER
    CHECK (due_date_day >= 1 AND due_date_day <= 31);

-- ============================================================
-- 2. Tables
-- ============================================================

-- 2a. cc_statements — monthly credit card statements
CREATE TABLE IF NOT EXISTS cc_statements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_card_id UUID NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,

    -- Statement dates
    statement_date DATE NOT NULL,
    due_date DATE NOT NULL,
    billing_period_start DATE,
    billing_period_end DATE,

    -- Financial summary
    total_amount_due NUMERIC(12,2) NOT NULL CHECK (total_amount_due >= 0),
    minimum_amount_due NUMERIC(12,2) DEFAULT 0 CHECK (minimum_amount_due >= 0),
    previous_balance NUMERIC(12,2) DEFAULT 0,
    payments_received NUMERIC(12,2) DEFAULT 0,
    new_charges NUMERIC(12,2) DEFAULT 0,
    interest_charged NUMERIC(12,2) DEFAULT 0 CHECK (interest_charged >= 0),
    fees_charged NUMERIC(12,2) DEFAULT 0 CHECK (fees_charged >= 0),

    -- Credit limit snapshot
    credit_limit NUMERIC(12,2),
    available_credit NUMERIC(12,2),

    -- Payment tracking
    amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    paid_date DATE,
    payment_type TEXT CHECK (payment_type IN ('full', 'minimum', 'partial', 'unpaid')),

    -- Status
    status TEXT NOT NULL DEFAULT 'due' CHECK (status IN (
        'upcoming', 'due', 'paid', 'partially_paid', 'overdue'
    )),

    -- Metadata
    statement_file_path TEXT,  -- Supabase Storage path if user wants to keep the PDF
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent duplicate statements for same card + month
    UNIQUE(credit_card_id, statement_date)
);

ALTER TABLE cc_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own cc_statements"
ON cc_statements
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cc_statements_user_id
    ON cc_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_statements_credit_card_id
    ON cc_statements(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_cc_statements_status
    ON cc_statements(status)
    WHERE status IN ('due', 'partially_paid', 'overdue');

CREATE TRIGGER update_cc_statements_updated_at
    BEFORE UPDATE ON cc_statements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2b. cc_statement_transactions — individual transactions in a statement
CREATE TABLE IF NOT EXISTS cc_statement_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL REFERENCES cc_statements(id) ON DELETE CASCADE,

    -- Transaction details
    transaction_date DATE NOT NULL,
    posting_date DATE,
    description TEXT NOT NULL,
    reference TEXT,
    merchant_name TEXT,

    -- Amount (positive = debit/charge, negative = credit/refund)
    amount NUMERIC(12,2) NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'purchase', 'refund', 'fee', 'interest', 'payment', 'cashback', 'emi_charge'
    )),

    -- Expense linking
    category TEXT,  -- user-assigned expense category
    linked_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cc_statement_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own cc_statement_transactions"
ON cc_statement_transactions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cc_stmt_txns_statement_id
    ON cc_statement_transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_cc_stmt_txns_user_id
    ON cc_statement_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_stmt_txns_not_approved
    ON cc_statement_transactions(statement_id)
    WHERE is_approved = FALSE;

CREATE TRIGGER update_cc_statement_transactions_updated_at
    BEFORE UPDATE ON cc_statement_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE cc_statements;
ALTER PUBLICATION supabase_realtime ADD TABLE cc_statement_transactions;

-- ============================================================
-- 4. RPC: create_cc_statement_with_transactions
--    Atomic insert of statement + all parsed transactions
-- ============================================================
CREATE OR REPLACE FUNCTION create_cc_statement_with_transactions(
    p_user_id UUID,
    p_credit_card_id UUID,
    p_statement_date DATE,
    p_due_date DATE,
    p_billing_period_start DATE DEFAULT NULL,
    p_billing_period_end DATE DEFAULT NULL,
    p_total_amount_due NUMERIC DEFAULT 0,
    p_minimum_amount_due NUMERIC DEFAULT 0,
    p_previous_balance NUMERIC DEFAULT 0,
    p_payments_received NUMERIC DEFAULT 0,
    p_new_charges NUMERIC DEFAULT 0,
    p_interest_charged NUMERIC DEFAULT 0,
    p_fees_charged NUMERIC DEFAULT 0,
    p_credit_limit NUMERIC DEFAULT NULL,
    p_available_credit NUMERIC DEFAULT NULL,
    p_transactions JSONB DEFAULT '[]'::JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_statement_id UUID;
    v_txn JSONB;
    v_txn_count INTEGER := 0;
BEGIN
    -- Verify credit card belongs to user
    IF NOT EXISTS (SELECT 1 FROM credit_cards WHERE id = p_credit_card_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Credit card not found or access denied';
    END IF;

    -- Insert statement
    INSERT INTO cc_statements (
        user_id, credit_card_id,
        statement_date, due_date, billing_period_start, billing_period_end,
        total_amount_due, minimum_amount_due, previous_balance, payments_received,
        new_charges, interest_charged, fees_charged,
        credit_limit, available_credit,
        status, notes
    ) VALUES (
        p_user_id, p_credit_card_id,
        p_statement_date, p_due_date, p_billing_period_start, p_billing_period_end,
        p_total_amount_due, p_minimum_amount_due, p_previous_balance, p_payments_received,
        p_new_charges, p_interest_charged, p_fees_charged,
        p_credit_limit, p_available_credit,
        CASE WHEN p_due_date < CURRENT_DATE THEN 'overdue' ELSE 'due' END,
        p_notes
    )
    RETURNING id INTO v_statement_id;

    -- Insert transactions
    FOR v_txn IN SELECT * FROM jsonb_array_elements(p_transactions)
    LOOP
        INSERT INTO cc_statement_transactions (
            user_id, statement_id,
            transaction_date, posting_date, description, reference, merchant_name,
            amount, transaction_type, category
        ) VALUES (
            p_user_id, v_statement_id,
            (v_txn->>'transaction_date')::DATE,
            (v_txn->>'posting_date')::DATE,
            v_txn->>'description',
            v_txn->>'reference',
            v_txn->>'merchant_name',
            (v_txn->>'amount')::NUMERIC,
            v_txn->>'transaction_type',
            v_txn->>'category'
        );
        v_txn_count := v_txn_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'statement_id', v_statement_id,
        'transactions_count', v_txn_count
    );
END;
$$;

-- ============================================================
-- 5. RPC: approve_cc_transactions_as_expenses
--    Batch-create expense entries from selected CC transactions
-- ============================================================
CREATE OR REPLACE FUNCTION approve_cc_transactions_as_expenses(
    p_user_id UUID,
    p_transaction_ids UUID[],
    p_categories JSONB DEFAULT '{}'::JSONB  -- {"txn_id": "category_name"}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_txn cc_statement_transactions%ROWTYPE;
    v_stmt cc_statements%ROWTYPE;
    v_card credit_cards%ROWTYPE;
    v_expense_id UUID;
    v_category TEXT;
    v_approved_count INTEGER := 0;
    v_expense_ids UUID[] := '{}';
BEGIN
    FOR v_txn IN
        SELECT * FROM cc_statement_transactions
        WHERE id = ANY(p_transaction_ids)
          AND user_id = p_user_id
          AND is_approved = FALSE
          AND transaction_type IN ('purchase', 'emi_charge')  -- Only debits become expenses
    LOOP
        -- Get statement and card info
        SELECT * INTO v_stmt FROM cc_statements WHERE id = v_txn.statement_id;
        SELECT * INTO v_card FROM credit_cards WHERE id = v_stmt.credit_card_id;

        -- Determine category (user-assigned > auto-detected > default)
        v_category := COALESCE(
            p_categories->>v_txn.id::TEXT,
            v_txn.category,
            'credit_card_payments'
        );

        -- Create expense entry
        INSERT INTO expense_entries (
            user_id, amount, category, sub_category, payee_name,
            date, payment_method, credit_card_id,
            funding_source, is_auto_generated, notes
        ) VALUES (
            p_user_id,
            ABS(v_txn.amount),
            v_category::expense_category,
            v_txn.merchant_name,
            COALESCE(v_txn.merchant_name, v_txn.description),
            v_txn.transaction_date,
            'credit_card',
            v_stmt.credit_card_id,
            'debt_funded',
            TRUE,
            'From ' || v_card.card_name || ' statement ' || v_stmt.statement_date
        )
        RETURNING id INTO v_expense_id;

        -- Link transaction to expense
        UPDATE cc_statement_transactions SET
            is_approved = TRUE,
            linked_expense_id = v_expense_id,
            category = v_category
        WHERE id = v_txn.id;

        v_approved_count := v_approved_count + 1;
        v_expense_ids := v_expense_ids || v_expense_id;
    END LOOP;

    RETURN jsonb_build_object(
        'approved_count', v_approved_count,
        'expense_ids', to_jsonb(v_expense_ids)
    );
END;
$$;

-- ============================================================
-- 6. RPC: pay_cc_statement
--    Record payment against a statement, update status
-- ============================================================
CREATE OR REPLACE FUNCTION pay_cc_statement(
    p_statement_id UUID,
    p_user_id UUID,
    p_amount NUMERIC,
    p_paid_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stmt cc_statements%ROWTYPE;
    v_card credit_cards%ROWTYPE;
    v_expense_id UUID;
    v_new_paid NUMERIC;
    v_payment_type TEXT;
    v_new_status TEXT;
BEGIN
    -- Verify statement belongs to user
    SELECT * INTO v_stmt FROM cc_statements
    WHERE id = p_statement_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Statement not found or access denied';
    END IF;

    SELECT * INTO v_card FROM credit_cards WHERE id = v_stmt.credit_card_id;

    -- Calculate new paid amount
    v_new_paid := v_stmt.amount_paid + p_amount;

    -- Determine payment type
    v_payment_type := CASE
        WHEN v_new_paid >= v_stmt.total_amount_due THEN 'full'
        WHEN v_new_paid >= v_stmt.minimum_amount_due THEN 'partial'
        ELSE 'minimum'
    END;

    -- Determine new status
    v_new_status := CASE
        WHEN v_new_paid >= v_stmt.total_amount_due THEN 'paid'
        WHEN v_new_paid > 0 THEN 'partially_paid'
        ELSE v_stmt.status
    END;

    -- Create credit_card_payments expense
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, credit_card_id,
        funding_source, is_auto_generated, notes
    ) VALUES (
        p_user_id,
        p_amount,
        'credit_card_payments',
        v_card.card_name || ' - ' || v_stmt.statement_date,
        v_card.card_name,
        p_paid_date,
        p_payment_method,
        v_stmt.credit_card_id,
        'debt_repayment',
        TRUE,
        COALESCE(p_notes, v_payment_type || ' payment for ' || v_card.card_name || ' statement ' || v_stmt.statement_date)
    )
    RETURNING id INTO v_expense_id;

    -- Update statement
    UPDATE cc_statements SET
        amount_paid = v_new_paid,
        paid_date = p_paid_date,
        payment_type = v_payment_type,
        status = v_new_status
    WHERE id = p_statement_id;

    RETURN jsonb_build_object(
        'statement_id', p_statement_id,
        'expense_id', v_expense_id,
        'amount_paid', v_new_paid,
        'payment_type', v_payment_type,
        'new_status', v_new_status,
        'remaining', GREATEST(0, v_stmt.total_amount_due - v_new_paid)
    );
END;
$$;
