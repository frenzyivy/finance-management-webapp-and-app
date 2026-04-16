-- Migration: Use BNPL item_name as the expense payee_name (instead of literal "BNPL Purchase")
-- Date: 2026-04-19
-- Replaces create_bnpl_purchase_with_schedule so the Expenses page shows the
-- actual item the user bought (e.g. "Samsung Galaxy Buds") rather than a generic label.

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
    p_interest_rate_type TEXT DEFAULT 'flat',
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
    v_payee TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM bnpl_platforms WHERE id = p_platform_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'Platform not found or access denied';
    END IF;

    v_month_offset := p_total_emis - 1;
    v_year := EXTRACT(YEAR FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
    v_month := EXTRACT(MONTH FROM p_first_emi_date + (v_month_offset || ' months')::INTERVAL);
    v_max_day := EXTRACT(DAY FROM (DATE_TRUNC('month', MAKE_DATE(v_year::INTEGER, v_month::INTEGER, 1)) + INTERVAL '1 month' - INTERVAL '1 day'));
    v_last_emi_date := MAKE_DATE(v_year::INTEGER, v_month::INTEGER, LEAST(p_emi_day_of_month, v_max_day::INTEGER));

    -- Prefer item_name; append merchant in parens when both are present.
    v_payee := CASE
        WHEN p_merchant_name IS NOT NULL AND p_merchant_name <> ''
            THEN p_item_name || ' (' || p_merchant_name || ')'
        ELSE p_item_name
    END;

    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name,
        date, payment_method, funding_source, is_auto_generated,
        notes
    ) VALUES (
        p_user_id,
        p_total_amount,
        p_expense_category::expense_category,
        COALESCE(p_expense_sub_category, p_item_name),
        v_payee,
        p_purchase_date,
        'wallet',
        'debt_funded',
        TRUE,
        p_item_name || ' - ' || p_total_emis || ' EMIs of ' || p_emi_amount
    )
    RETURNING id INTO v_expense_id;

    INSERT INTO bnpl_purchases (
        user_id, platform_id, item_name, item_category, order_id, merchant_name,
        total_amount, down_payment, interest_rate, interest_rate_type, processing_fee,
        total_payable, emi_amount, total_emis,
        outstanding_balance,
        purchase_date, first_emi_date, last_emi_date, emi_day_of_month,
        is_business_purchase, linked_expense_id, notes
    ) VALUES (
        p_user_id, p_platform_id, p_item_name, p_item_category, p_order_id, p_merchant_name,
        p_total_amount, p_down_payment, p_interest_rate, p_interest_rate_type, p_processing_fee,
        p_total_payable, p_emi_amount, p_total_emis,
        p_total_payable,
        p_purchase_date, p_first_emi_date, v_last_emi_date, p_emi_day_of_month,
        p_is_business_purchase, v_expense_id, p_notes
    )
    RETURNING id INTO v_purchase_id;

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

-- Backfill: re-label existing BNPL purchase expenses using their linked purchase's item_name.
-- Only touches rows whose payee_name is the legacy literal — safe to re-run.
UPDATE expense_entries e
SET payee_name = CASE
        WHEN p.merchant_name IS NOT NULL AND p.merchant_name <> ''
            THEN p.item_name || ' (' || p.merchant_name || ')'
        ELSE p.item_name
    END
FROM bnpl_purchases p
WHERE p.linked_expense_id = e.id
  AND e.payee_name = 'BNPL Purchase';
