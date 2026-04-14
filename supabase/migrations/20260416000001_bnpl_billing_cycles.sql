-- Migration: BNPL Billing Cycles
-- Date: 2026-04-16
-- Adds monthly billing cycle support to BNPL platforms.
-- Platforms with billing_day set will auto-group EMIs into monthly bills.

-- ============================================================
-- 1. ALTER bnpl_platforms — add billing_day
-- ============================================================
ALTER TABLE bnpl_platforms
  ADD COLUMN IF NOT EXISTS billing_day INTEGER
  CHECK (billing_day IS NULL OR (billing_day >= 1 AND billing_day <= 31));

-- ============================================================
-- 2. CREATE bnpl_bills — monthly billing cycle entity
-- ============================================================
CREATE TABLE IF NOT EXISTS bnpl_bills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES bnpl_platforms(id) ON DELETE CASCADE,
    bill_month INTEGER NOT NULL CHECK (bill_month >= 1 AND bill_month <= 12),
    bill_year INTEGER NOT NULL CHECK (bill_year >= 2020),
    due_date DATE NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN (
        'upcoming', 'due', 'partially_paid', 'paid', 'overdue'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform_id, bill_year, bill_month)
);

ALTER TABLE bnpl_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own bnpl_bills"
ON bnpl_bills
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bnpl_bills_user_id ON bnpl_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_bills_platform_id ON bnpl_bills(platform_id);
CREATE INDEX IF NOT EXISTS idx_bnpl_bills_status ON bnpl_bills(status);
CREATE INDEX IF NOT EXISTS idx_bnpl_bills_due_date ON bnpl_bills(due_date);

CREATE TRIGGER update_bnpl_bills_updated_at
    BEFORE UPDATE ON bnpl_bills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE bnpl_bills;

-- ============================================================
-- 3. ALTER bnpl_payments — add bill_id FK
-- ============================================================
ALTER TABLE bnpl_payments
  ADD COLUMN IF NOT EXISTS bill_id UUID REFERENCES bnpl_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bnpl_payments_bill_id
  ON bnpl_payments(bill_id)
  WHERE bill_id IS NOT NULL;

-- ============================================================
-- 4. UPDATE create_bnpl_purchase_with_schedule
--    After generating payments, link them to billing cycles
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
    v_billing_day INTEGER;
    v_bill_id UUID;
    v_bill_due_date DATE;
    v_payment_rec RECORD;
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

    -- ── Billing cycle linking ──
    SELECT billing_day INTO v_billing_day FROM bnpl_platforms WHERE id = p_platform_id;

    IF v_billing_day IS NOT NULL THEN
        FOR v_payment_rec IN
            SELECT id, due_date FROM bnpl_payments WHERE purchase_id = v_purchase_id
        LOOP
            v_year := EXTRACT(YEAR FROM v_payment_rec.due_date)::INTEGER;
            v_month := EXTRACT(MONTH FROM v_payment_rec.due_date)::INTEGER;
            v_max_day := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_year, v_month, 1)) + INTERVAL '1 month' - INTERVAL '1 day'))::INTEGER;
            v_bill_due_date := MAKE_DATE(v_year, v_month, LEAST(v_billing_day, v_max_day));

            -- Find or create bill for this month
            INSERT INTO bnpl_bills (user_id, platform_id, bill_month, bill_year, due_date, total_amount)
            VALUES (p_user_id, p_platform_id, v_month, v_year, v_bill_due_date, 0)
            ON CONFLICT (platform_id, bill_year, bill_month) DO NOTHING
            RETURNING id INTO v_bill_id;

            IF v_bill_id IS NULL THEN
                SELECT id INTO v_bill_id FROM bnpl_bills
                WHERE platform_id = p_platform_id AND bill_year = v_year AND bill_month = v_month;
            END IF;

            -- Link payment to bill
            UPDATE bnpl_payments SET bill_id = v_bill_id WHERE id = v_payment_rec.id;
        END LOOP;

        -- Recalculate totals for all affected bills
        UPDATE bnpl_bills b SET
            total_amount = (SELECT COALESCE(SUM(amount), 0) FROM bnpl_payments WHERE bill_id = b.id)
        WHERE b.platform_id = p_platform_id
          AND b.id IN (SELECT DISTINCT bill_id FROM bnpl_payments WHERE purchase_id = v_purchase_id AND bill_id IS NOT NULL);
    END IF;

    RETURN jsonb_build_object(
        'purchase_id', v_purchase_id,
        'expense_id', v_expense_id,
        'last_emi_date', v_last_emi_date,
        'total_emis_generated', p_total_emis
    );
END;
$$;

-- ============================================================
-- 5. UPDATE log_bnpl_payment_with_expense
--    After marking payment paid, update parent bill
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

    -- ── Update parent bill if linked ──
    IF v_payment.bill_id IS NOT NULL THEN
        UPDATE bnpl_bills SET
            paid_amount = (
                SELECT COALESCE(SUM(amount), 0) FROM bnpl_payments
                WHERE bill_id = v_payment.bill_id AND status IN ('paid', 'late_paid')
            ),
            status = CASE
                WHEN (SELECT COUNT(*) FROM bnpl_payments
                      WHERE bill_id = v_payment.bill_id
                        AND status NOT IN ('paid', 'late_paid', 'skipped')) = 0
                THEN 'paid'
                WHEN (SELECT COUNT(*) FROM bnpl_payments
                      WHERE bill_id = v_payment.bill_id
                        AND status IN ('paid', 'late_paid')) > 0
                THEN 'partially_paid'
                ELSE status
            END
        WHERE id = v_payment.bill_id;
    END IF;

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
-- 6. NEW RPC: pay_bnpl_bill
--    Pay all unpaid EMIs in a bill at once
-- ============================================================
CREATE OR REPLACE FUNCTION pay_bnpl_bill(
    p_bill_id UUID,
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
    v_bill bnpl_bills%ROWTYPE;
    v_platform bnpl_platforms%ROWTYPE;
    v_expense_id UUID;
    v_total_paying NUMERIC := 0;
    v_payment_rec RECORD;
    v_purchase bnpl_purchases%ROWTYPE;
    v_pay_status TEXT;
    v_payments_paid INTEGER := 0;
    v_month_name TEXT;
BEGIN
    -- Verify bill
    SELECT * INTO v_bill FROM bnpl_bills
    WHERE id = p_bill_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bill not found or access denied';
    END IF;

    IF v_bill.status = 'paid' THEN
        RAISE EXCEPTION 'Bill is already fully paid';
    END IF;

    SELECT * INTO v_platform FROM bnpl_platforms WHERE id = v_bill.platform_id;

    -- Calculate total of unpaid payments in this bill
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paying
    FROM bnpl_payments
    WHERE bill_id = p_bill_id AND status IN ('upcoming', 'due', 'overdue');

    IF v_total_paying <= 0 THEN
        RAISE EXCEPTION 'No unpaid EMIs in this bill';
    END IF;

    -- Create ONE consolidated expense for the full bill
    v_month_name := TO_CHAR(MAKE_DATE(v_bill.bill_year, v_bill.bill_month, 1), 'Mon YYYY');

    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        notes
    ) VALUES (
        p_user_id,
        v_total_paying,
        'debt_repayment',
        v_platform.name || ' - ' || v_month_name || ' Bill',
        v_platform.name,
        p_paid_date,
        p_payment_method,
        'debt_repayment',
        TRUE,
        COALESCE(p_notes, v_platform.name || ' bill payment for ' || v_month_name)
    )
    RETURNING id INTO v_expense_id;

    -- Mark each unpaid payment as paid and update its parent purchase
    FOR v_payment_rec IN
        SELECT id, purchase_id, amount, due_date
        FROM bnpl_payments
        WHERE bill_id = p_bill_id AND status IN ('upcoming', 'due', 'overdue')
        ORDER BY emi_number
    LOOP
        v_pay_status := CASE
            WHEN p_paid_date > v_payment_rec.due_date THEN 'late_paid'
            ELSE 'paid'
        END;

        UPDATE bnpl_payments SET
            status = v_pay_status,
            paid_date = p_paid_date,
            payment_method = p_payment_method,
            linked_expense_id = v_expense_id
        WHERE id = v_payment_rec.id;

        -- Update parent purchase
        SELECT * INTO v_purchase FROM bnpl_purchases WHERE id = v_payment_rec.purchase_id;
        UPDATE bnpl_purchases SET
            paid_emis = paid_emis + 1,
            outstanding_balance = GREATEST(0, outstanding_balance - v_payment_rec.amount),
            status = CASE
                WHEN (paid_emis + 1) >= total_emis THEN 'paid_off'
                ELSE status
            END
        WHERE id = v_payment_rec.purchase_id;

        v_payments_paid := v_payments_paid + 1;
    END LOOP;

    -- Update bill
    UPDATE bnpl_bills SET
        paid_amount = (
            SELECT COALESCE(SUM(amount), 0) FROM bnpl_payments
            WHERE bill_id = p_bill_id AND status IN ('paid', 'late_paid')
        ),
        status = CASE
            WHEN (SELECT COUNT(*) FROM bnpl_payments
                  WHERE bill_id = p_bill_id
                    AND status NOT IN ('paid', 'late_paid', 'skipped')) = 0
            THEN 'paid'
            ELSE 'partially_paid'
        END
    WHERE id = p_bill_id;

    RETURN jsonb_build_object(
        'bill_id', p_bill_id,
        'expense_id', v_expense_id,
        'total_paid', v_total_paying,
        'payments_marked_paid', v_payments_paid,
        'bill_status', 'paid'
    );
END;
$$;

-- ============================================================
-- 7. UPDATE delete_bnpl_purchase_with_cascade
--    Recalculate affected bills after deleting
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
    v_affected_bills UUID[];
BEGIN
    -- Verify purchase
    SELECT * INTO v_purchase FROM bnpl_purchases
    WHERE id = p_purchase_id AND user_id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Purchase not found or access denied';
    END IF;

    -- Collect affected bill IDs before deleting payments
    SELECT ARRAY_AGG(DISTINCT bill_id) INTO v_affected_bills
    FROM bnpl_payments
    WHERE purchase_id = p_purchase_id AND bill_id IS NOT NULL;

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

    -- Recalculate affected bills
    IF v_affected_bills IS NOT NULL THEN
        UPDATE bnpl_bills b SET
            total_amount = COALESCE((SELECT SUM(amount) FROM bnpl_payments WHERE bill_id = b.id), 0),
            paid_amount = COALESCE((SELECT SUM(amount) FROM bnpl_payments WHERE bill_id = b.id AND status IN ('paid', 'late_paid')), 0)
        WHERE b.id = ANY(v_affected_bills);

        -- Delete empty bills (no remaining payments)
        DELETE FROM bnpl_bills
        WHERE id = ANY(v_affected_bills)
          AND NOT EXISTS (SELECT 1 FROM bnpl_payments WHERE bill_id = bnpl_bills.id);
    END IF;

    RETURN jsonb_build_object(
        'deleted', TRUE,
        'deleted_expenses', v_deleted_expenses
    );
END;
$$;

-- ============================================================
-- 8. UPDATE foreclose_bnpl_purchase
--    After skipping payments, recalculate affected bills
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
    v_affected_bills UUID[];
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

    v_actual_amount := COALESCE(p_foreclosure_amount, v_purchase.outstanding_balance);

    -- Collect affected bills before modifying payments
    SELECT ARRAY_AGG(DISTINCT bill_id) INTO v_affected_bills
    FROM bnpl_payments
    WHERE purchase_id = p_purchase_id
      AND bill_id IS NOT NULL
      AND status IN ('upcoming', 'due', 'overdue');

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

    -- Mark remaining payments as skipped
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

    -- Recalculate affected bills
    IF v_affected_bills IS NOT NULL THEN
        UPDATE bnpl_bills b SET
            total_amount = COALESCE((SELECT SUM(amount) FROM bnpl_payments WHERE bill_id = b.id AND status != 'skipped'), 0),
            paid_amount = COALESCE((SELECT SUM(amount) FROM bnpl_payments WHERE bill_id = b.id AND status IN ('paid', 'late_paid')), 0),
            status = CASE
                WHEN (SELECT COUNT(*) FROM bnpl_payments WHERE bill_id = b.id AND status NOT IN ('paid', 'late_paid', 'skipped')) = 0
                THEN 'paid'
                ELSE status
            END
        WHERE b.id = ANY(v_affected_bills);
    END IF;

    RETURN jsonb_build_object(
        'purchase_id', p_purchase_id,
        'expense_id', v_expense_id,
        'foreclosure_amount', v_actual_amount,
        'skipped_emis', v_skipped_count
    );
END;
$$;
