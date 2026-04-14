-- Migration: BNPL / EMI Purchase Tracker
-- Date: 2026-04-15
-- Creates bnpl_platforms, bnpl_purchases, bnpl_payments tables,
-- a stats view, and RPC functions for atomic operations.

-- ============================================================
-- 1. Tables
-- ============================================================

-- 1a. bnpl_platforms — platform-level container
CREATE TABLE IF NOT EXISTS bnpl_platforms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    platform_type TEXT NOT NULL CHECK (platform_type IN (
        'bnpl_app', 'credit_card_emi', 'store_emi', 'finance_company'
    )),
    credit_limit NUMERIC(12,2),
    color TEXT DEFAULT '#6b7280',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bnpl_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own bnpl_platforms"
ON bnpl_platforms
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bnpl_platforms_user_id
    ON bnpl_platforms(user_id);

CREATE TRIGGER update_bnpl_platforms_updated_at
    BEFORE UPDATE ON bnpl_platforms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 1b. bnpl_purchases — individual purchases under a platform
CREATE TABLE IF NOT EXISTS bnpl_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES bnpl_platforms(id) ON DELETE CASCADE,

    -- What was bought
    item_name TEXT NOT NULL,
    item_category TEXT NOT NULL,
    order_id TEXT,
    merchant_name TEXT,

    -- Financials
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    down_payment NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
    financed_amount NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - down_payment) STORED,
    interest_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    processing_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_payable NUMERIC(12,2) NOT NULL,
    emi_amount NUMERIC(12,2) NOT NULL CHECK (emi_amount > 0),
    total_emis INTEGER NOT NULL CHECK (total_emis > 0),
    paid_emis INTEGER NOT NULL DEFAULT 0 CHECK (paid_emis >= 0),
    remaining_emis INTEGER GENERATED ALWAYS AS (total_emis - paid_emis) STORED,
    outstanding_balance NUMERIC(12,2) NOT NULL CHECK (outstanding_balance >= 0),

    -- Dates
    purchase_date DATE NOT NULL,
    first_emi_date DATE NOT NULL,
    last_emi_date DATE,
    emi_day_of_month INTEGER NOT NULL CHECK (emi_day_of_month >= 1 AND emi_day_of_month <= 31),

    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paid_off', 'overdue', 'foreclosed'
    )),

    -- Expense integration
    linked_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
    is_business_purchase BOOLEAN DEFAULT FALSE,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bnpl_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own bnpl_purchases"
ON bnpl_purchases
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bnpl_purchases_user_id
    ON bnpl_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_purchases_platform_id
    ON bnpl_purchases(platform_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_purchases_status
    ON bnpl_purchases(status);
CREATE INDEX IF NOT EXISTS idx_bnpl_purchases_user_status
    ON bnpl_purchases(user_id, status);

CREATE TRIGGER update_bnpl_purchases_updated_at
    BEFORE UPDATE ON bnpl_purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 1c. bnpl_payments — individual EMI payment records
CREATE TABLE IF NOT EXISTS bnpl_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES bnpl_purchases(id) ON DELETE CASCADE,

    emi_number INTEGER NOT NULL CHECK (emi_number > 0),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    principal_portion NUMERIC(12,2),
    interest_portion NUMERIC(12,2),

    due_date DATE NOT NULL,
    paid_date DATE,
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN (
        'upcoming', 'due', 'paid', 'late_paid', 'overdue', 'skipped'
    )),

    payment_method TEXT,
    linked_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(purchase_id, emi_number)
);

ALTER TABLE bnpl_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own bnpl_payments"
ON bnpl_payments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bnpl_payments_purchase_id
    ON bnpl_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_payments_user_id
    ON bnpl_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_payments_due_date
    ON bnpl_payments(due_date)
    WHERE status IN ('upcoming', 'due', 'overdue');
CREATE INDEX IF NOT EXISTS idx_bnpl_payments_status
    ON bnpl_payments(status);

CREATE TRIGGER update_bnpl_payments_updated_at
    BEFORE UPDATE ON bnpl_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. View: bnpl_platforms_with_stats
-- ============================================================
CREATE OR REPLACE VIEW bnpl_platforms_with_stats AS
SELECT
    p.*,
    COALESCE(SUM(CASE WHEN pu.status = 'active' THEN pu.outstanding_balance ELSE 0 END), 0)
        AS current_outstanding,
    COALESCE(COUNT(CASE WHEN pu.status = 'active' THEN 1 END), 0)::INTEGER
        AS active_purchases_count,
    COALESCE(SUM(CASE WHEN pu.status = 'active' THEN pu.emi_amount ELSE 0 END), 0)
        AS monthly_emi_total
FROM bnpl_platforms p
LEFT JOIN bnpl_purchases pu ON pu.platform_id = p.id
GROUP BY p.id;

-- ============================================================
-- 3. Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE bnpl_platforms;
ALTER PUBLICATION supabase_realtime ADD TABLE bnpl_purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE bnpl_payments;

-- ============================================================
-- 4. RPC: create_bnpl_purchase_with_schedule
--    Insert purchase + pre-generate EMI payments + create purchase expense
-- ============================================================
CREATE OR REPLACE FUNCTION create_bnpl_purchase_with_schedule(
    p_user_id UUID,
    p_platform_id UUID,
    p_item_name TEXT,
    p_item_category TEXT,
    p_order_id TEXT DEFAULT NULL,
    p_merchant_name TEXT DEFAULT NULL,
    p_total_amount NUMERIC DEFAULT 0,
    p_down_payment NUMERIC DEFAULT 0,
    p_interest_rate NUMERIC DEFAULT 0,
    p_processing_fee NUMERIC DEFAULT 0,
    p_total_payable NUMERIC DEFAULT 0,
    p_emi_amount NUMERIC DEFAULT 0,
    p_total_emis INTEGER DEFAULT 1,
    p_purchase_date DATE DEFAULT CURRENT_DATE,
    p_first_emi_date DATE DEFAULT CURRENT_DATE,
    p_emi_day_of_month INTEGER DEFAULT 1,
    p_is_business_purchase BOOLEAN DEFAULT FALSE,
    p_notes TEXT DEFAULT NULL,
    p_expense_category TEXT DEFAULT 'shopping',
    p_expense_sub_category TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase_id UUID;
    v_expense_id UUID;
    v_last_emi_date DATE;
    v_emi_due_date DATE;
    v_month_offset INTEGER;
    v_year INTEGER;
    v_month INTEGER;
    v_max_day INTEGER;
BEGIN
    -- Verify platform belongs to user
    IF NOT EXISTS (SELECT 1 FROM bnpl_platforms WHERE id = p_platform_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Platform not found or access denied';
    END IF;

    -- Calculate last EMI date
    v_month_offset := p_total_emis - 1;
    v_year := EXTRACT(YEAR FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
    v_month := EXTRACT(MONTH FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
    v_max_day := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_year::INTEGER, v_month::INTEGER, 1)) + INTERVAL '1 month' - INTERVAL '1 day'));
    v_last_emi_date := MAKE_DATE(v_year::INTEGER, v_month::INTEGER, LEAST(p_emi_day_of_month, v_max_day::INTEGER));

    -- Create purchase expense entry
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        notes
    ) VALUES (
        p_user_id,
        p_total_amount,
        p_expense_category::expense_category,
        COALESCE(p_expense_sub_category, p_item_name),
        COALESCE(p_merchant_name, 'BNPL Purchase'),
        p_purchase_date,
        'wallet',
        'debt_funded',
        TRUE,
        p_item_name || ' - ' || p_total_emis || ' EMIs of ' || p_emi_amount
    )
    RETURNING id INTO v_expense_id;

    -- Insert purchase
    INSERT INTO bnpl_purchases (
        user_id, platform_id, item_name, item_category, order_id, merchant_name,
        total_amount, down_payment, interest_rate, processing_fee,
        total_payable, emi_amount, total_emis,
        outstanding_balance,
        purchase_date, first_emi_date, last_emi_date, emi_day_of_month,
        is_business_purchase, linked_expense_id, notes
    ) VALUES (
        p_user_id, p_platform_id, p_item_name, p_item_category, p_order_id, p_merchant_name,
        p_total_amount, p_down_payment, p_interest_rate, p_processing_fee,
        p_total_payable, p_emi_amount, p_total_emis,
        p_total_payable,
        p_purchase_date, p_first_emi_date, v_last_emi_date, p_emi_day_of_month,
        p_is_business_purchase, v_expense_id, p_notes
    )
    RETURNING id INTO v_purchase_id;

    -- Pre-generate EMI payment schedule
    FOR i IN 1..p_total_emis LOOP
        v_month_offset := i - 1;
        v_year := EXTRACT(YEAR FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
        v_month := EXTRACT(MONTH FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
        v_max_day := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_year::INTEGER, v_month::INTEGER, 1)) + INTERVAL '1 month' - INTERVAL '1 day'));
        v_emi_due_date := MAKE_DATE(v_year::INTEGER, v_month::INTEGER, LEAST(p_emi_day_of_month, v_max_day::INTEGER));

        INSERT INTO bnpl_payments (
            user_id, purchase_id, emi_number, amount,
            due_date, status
        ) VALUES (
            p_user_id, v_purchase_id, i, p_emi_amount,
            v_emi_due_date, 'upcoming'
        );
    END LOOP;

    RETURN jsonb_build_object(
        'purchase_id', v_purchase_id,
        'expense_id', v_expense_id,
        'last_emi_date', v_last_emi_date,
        'total_emis_generated', p_total_emis
    );
END;
$$;

-- ============================================================
-- 5. RPC: log_bnpl_payment_with_expense
--    Mark an EMI as paid + create debt_repayment expense + update purchase
-- ============================================================
CREATE OR REPLACE FUNCTION log_bnpl_payment_with_expense(
    p_payment_id UUID,
    p_user_id UUID,
    p_paid_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'upi',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment bnpl_payments%ROWTYPE;
    v_purchase bnpl_purchases%ROWTYPE;
    v_platform bnpl_platforms%ROWTYPE;
    v_expense_id UUID;
    v_new_outstanding NUMERIC;
    v_new_paid_emis INTEGER;
    v_new_status TEXT;
    v_pay_status TEXT;
BEGIN
    -- Fetch and verify payment
    SELECT * INTO v_payment FROM bnpl_payments
    WHERE id = p_payment_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found or access denied';
    END IF;

    IF v_payment.status IN ('paid', 'late_paid', 'skipped') THEN
        RAISE EXCEPTION 'Payment already processed (status: %)', v_payment.status;
    END IF;

    -- Fetch purchase and platform
    SELECT * INTO v_purchase FROM bnpl_purchases WHERE id = v_payment.purchase_id;
    SELECT * INTO v_platform FROM bnpl_platforms WHERE id = v_purchase.platform_id;

    -- Determine payment status
    v_pay_status := CASE
        WHEN p_paid_date > v_payment.due_date THEN 'late_paid'
        ELSE 'paid'
    END;

    -- Create debt_repayment expense
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        notes
    ) VALUES (
        p_user_id,
        v_payment.amount,
        'debt_repayment',
        v_platform.name || ' - ' || v_purchase.item_name,
        v_platform.name,
        p_paid_date,
        p_payment_method,
        'debt_repayment',
        TRUE,
        'EMI ' || v_payment.emi_number || '/' || v_purchase.total_emis || ' for ' || v_purchase.item_name
    )
    RETURNING id INTO v_expense_id;

    -- Update payment record
    UPDATE bnpl_payments SET
        status = v_pay_status,
        paid_date = p_paid_date,
        payment_method = p_payment_method,
        linked_expense_id = v_expense_id,
        notes = p_notes
    WHERE id = p_payment_id;

    -- Update purchase
    v_new_paid_emis := v_purchase.paid_emis + 1;
    v_new_outstanding := GREATEST(0, v_purchase.outstanding_balance - v_payment.amount);
    v_new_status := CASE
        WHEN v_new_paid_emis >= v_purchase.total_emis THEN 'paid_off'
        ELSE v_purchase.status
    END;

    UPDATE bnpl_purchases SET
        paid_emis = v_new_paid_emis,
        outstanding_balance = v_new_outstanding,
        status = v_new_status
    WHERE id = v_purchase.id;

    RETURN jsonb_build_object(
        'payment_id', p_payment_id,
        'expense_id', v_expense_id,
        'new_outstanding', v_new_outstanding,
        'new_paid_emis', v_new_paid_emis,
        'purchase_status', v_new_status,
        'is_fully_paid', v_new_status = 'paid_off'
    );
END;
$$;

-- ============================================================
-- 6. RPC: foreclose_bnpl_purchase
--    Pay off remaining balance, mark remaining EMIs as skipped
-- ============================================================
CREATE OR REPLACE FUNCTION foreclose_bnpl_purchase(
    p_purchase_id UUID,
    p_user_id UUID,
    p_foreclosure_amount NUMERIC DEFAULT NULL,
    p_paid_date DATE DEFAULT CURRENT_DATE,
    p_payment_method TEXT DEFAULT 'bank_transfer',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase bnpl_purchases%ROWTYPE;
    v_platform bnpl_platforms%ROWTYPE;
    v_expense_id UUID;
    v_actual_amount NUMERIC;
    v_skipped_count INTEGER;
BEGIN
    -- Verify purchase
    SELECT * INTO v_purchase FROM bnpl_purchases
    WHERE id = p_purchase_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found or access denied';
    END IF;

    IF v_purchase.status != 'active' AND v_purchase.status != 'overdue' THEN
        RAISE EXCEPTION 'Purchase is not active (status: %)', v_purchase.status;
    END IF;

    SELECT * INTO v_platform FROM bnpl_platforms WHERE id = v_purchase.platform_id;

    -- Use provided amount or outstanding balance
    v_actual_amount := COALESCE(p_foreclosure_amount, v_purchase.outstanding_balance);

    -- Create foreclosure expense
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        notes
    ) VALUES (
        p_user_id,
        v_actual_amount,
        'debt_repayment',
        v_platform.name || ' - ' || v_purchase.item_name || ' (Foreclosure)',
        v_platform.name,
        p_paid_date,
        p_payment_method,
        'debt_repayment',
        TRUE,
        'Foreclosure: ' || v_purchase.item_name || ' - Paid off remaining balance'
    )
    RETURNING id INTO v_expense_id;

    -- Mark remaining upcoming/due/overdue payments as skipped
    UPDATE bnpl_payments SET
        status = 'skipped',
        notes = 'Foreclosed on ' || p_paid_date
    WHERE purchase_id = p_purchase_id
      AND status IN ('upcoming', 'due', 'overdue');

    GET DIAGNOSTICS v_skipped_count = ROW_COUNT;

    -- Update purchase
    UPDATE bnpl_purchases SET
        status = 'foreclosed',
        outstanding_balance = 0,
        paid_emis = total_emis,
        notes = COALESCE(notes || E'\n', '') || 'Foreclosed on ' || p_paid_date
    WHERE id = p_purchase_id;

    RETURN jsonb_build_object(
        'purchase_id', p_purchase_id,
        'expense_id', v_expense_id,
        'foreclosure_amount', v_actual_amount,
        'skipped_emis', v_skipped_count
    );
END;
$$;

-- ============================================================
-- 7. RPC: delete_bnpl_purchase_with_cascade
--    Delete purchase + reverse linked expenses
-- ============================================================
CREATE OR REPLACE FUNCTION delete_bnpl_purchase_with_cascade(
    p_purchase_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase bnpl_purchases%ROWTYPE;
    v_deleted_expenses INTEGER := 0;
BEGIN
    -- Verify purchase
    SELECT * INTO v_purchase FROM bnpl_purchases
    WHERE id = p_purchase_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found or access denied';
    END IF;

    -- Delete linked payment expenses
    DELETE FROM expense_entries
    WHERE id IN (
        SELECT linked_expense_id FROM bnpl_payments
        WHERE purchase_id = p_purchase_id AND linked_expense_id IS NOT NULL
    );
    GET DIAGNOSTICS v_deleted_expenses = ROW_COUNT;

    -- Delete purchase expense
    IF v_purchase.linked_expense_id IS NOT NULL THEN
        DELETE FROM expense_entries WHERE id = v_purchase.linked_expense_id;
        v_deleted_expenses := v_deleted_expenses + 1;
    END IF;

    -- Delete purchase (CASCADE deletes bnpl_payments)
    DELETE FROM bnpl_purchases WHERE id = p_purchase_id;

    RETURN jsonb_build_object(
        'deleted', TRUE,
        'deleted_expenses', v_deleted_expenses
    );
END;
$$;
