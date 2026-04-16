-- Migration: Personal <-> Business Mirror RPCs
-- Date: 2026-04-19
-- Adds RPCs to mirror a personal expense/income into the business books
-- (and reverse the mirror) via personal_business_transfers bridge rows.
-- Also adds a helper to auto-match a payee name against business_subscriptions.

-- ============================================================
-- 1. Helper: match_business_subscription_by_name
--    Returns a subscription UUID only when exactly ONE active
--    subscription for the user matches the given payee name
--    (case-insensitive, after stripping non-alphanumerics).
-- ============================================================
CREATE OR REPLACE FUNCTION match_business_subscription_by_name(
    p_user_id UUID,
    p_payee_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_id UUID;
    v_norm_payee TEXT;
    v_match_count INT;
BEGIN
    IF p_payee_name IS NULL OR length(trim(p_payee_name)) = 0 THEN
        RETURN NULL;
    END IF;

    v_norm_payee := lower(regexp_replace(p_payee_name, '[^a-zA-Z0-9]', '', 'g'));
    IF length(v_norm_payee) < 3 THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*), MIN(id::text)::uuid
    INTO v_match_count, v_match_id
    FROM business_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trial')
      AND (
        lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = v_norm_payee
        OR lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) LIKE v_norm_payee || '%'
        OR v_norm_payee LIKE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '%'
      );

    IF v_match_count = 1 THEN
        RETURN v_match_id;
    END IF;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION match_business_subscription_by_name(UUID, TEXT) TO authenticated;

-- ============================================================
-- 2. RPC: mirror_expense_to_business
--    Given a personal expense_entries row, create a mirror
--    business_expenses row (funded_from='personal_pocket') and a
--    personal_business_transfers row, and mark the personal row.
-- ============================================================
CREATE OR REPLACE FUNCTION mirror_expense_to_business(
    p_personal_expense_id UUID,
    p_biz_category TEXT,
    p_biz_vendor_name TEXT,
    p_biz_sub_category TEXT DEFAULT NULL,
    p_biz_subscription_id UUID DEFAULT NULL,
    p_biz_client_id UUID DEFAULT NULL,
    p_reason TEXT DEFAULT 'Paid from personal for business',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exp expense_entries%ROWTYPE;
    v_biz_expense_id UUID;
    v_transfer_id UUID;
BEGIN
    SELECT * INTO v_exp FROM expense_entries WHERE id = p_personal_expense_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personal expense not found';
    END IF;
    IF v_exp.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Prevent double-mirror
    IF v_exp.is_business_investment = TRUE AND v_exp.linked_transfer_id IS NOT NULL THEN
        RAISE EXCEPTION 'Expense is already mirrored. Unmirror it first.';
    END IF;

    -- Insert business expense (no subscription/client link yet — added after transfer insert cascade)
    INSERT INTO business_expenses (
        user_id, amount, category, sub_category, vendor_name,
        subscription_id, client_id,
        date, payment_method,
        funded_from, personal_portion,
        is_tax_deductible, gst_applicable,
        notes, is_auto_generated
    ) VALUES (
        v_exp.user_id, v_exp.amount, p_biz_category, p_biz_sub_category, p_biz_vendor_name,
        p_biz_subscription_id, p_biz_client_id,
        v_exp.date, v_exp.payment_method,
        'personal_pocket', v_exp.amount,
        TRUE, FALSE,
        COALESCE(p_notes, v_exp.notes), TRUE
    )
    RETURNING id INTO v_biz_expense_id;

    -- Insert bridge transfer
    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        personal_expense_id, business_expense_id, notes
    ) VALUES (
        v_exp.user_id, 'personal_to_business', v_exp.amount, v_exp.date, p_reason,
        p_personal_expense_id, v_biz_expense_id, p_notes
    )
    RETURNING id INTO v_transfer_id;

    -- Mark personal expense
    UPDATE expense_entries
    SET is_business_investment = TRUE,
        linked_transfer_id = v_transfer_id
    WHERE id = p_personal_expense_id;

    RETURN jsonb_build_object(
        'business_expense_id', v_biz_expense_id,
        'transfer_id', v_transfer_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION mirror_expense_to_business(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 3. RPC: unmirror_expense_to_business
--    Reverses mirror_expense_to_business. Idempotent.
-- ============================================================
CREATE OR REPLACE FUNCTION unmirror_expense_to_business(
    p_personal_expense_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exp expense_entries%ROWTYPE;
    v_transfer personal_business_transfers%ROWTYPE;
    v_biz_expense_id UUID;
BEGIN
    SELECT * INTO v_exp FROM expense_entries WHERE id = p_personal_expense_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personal expense not found';
    END IF;
    IF v_exp.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_exp.linked_transfer_id IS NULL THEN
        -- Already un-mirrored; just clear flag and return
        UPDATE expense_entries
        SET is_business_investment = FALSE
        WHERE id = p_personal_expense_id;
        RETURN jsonb_build_object('status', 'noop');
    END IF;

    SELECT * INTO v_transfer FROM personal_business_transfers WHERE id = v_exp.linked_transfer_id;
    v_biz_expense_id := v_transfer.business_expense_id;

    -- Clear personal flags first (FK is ON DELETE SET NULL, but cleaner to clear explicitly)
    UPDATE expense_entries
    SET is_business_investment = FALSE,
        linked_transfer_id = NULL
    WHERE id = p_personal_expense_id;

    -- Delete transfer and business expense (mirror is auto-generated; safe to remove)
    DELETE FROM personal_business_transfers WHERE id = v_exp.linked_transfer_id;
    IF v_biz_expense_id IS NOT NULL THEN
        DELETE FROM business_expenses WHERE id = v_biz_expense_id AND is_auto_generated = TRUE;
    END IF;

    RETURN jsonb_build_object('status', 'unmirrored', 'removed_business_expense_id', v_biz_expense_id);
END;
$$;

GRANT EXECUTE ON FUNCTION unmirror_expense_to_business(UUID) TO authenticated;

-- ============================================================
-- 4. RPC: mirror_income_to_business
--    Given a personal income_entries row (client revenue that
--    landed in personal account), create a mirror business_income
--    row (landed_in='personal_account') and a bridge transfer row.
-- ============================================================
CREATE OR REPLACE FUNCTION mirror_income_to_business(
    p_personal_income_id UUID,
    p_biz_category TEXT,
    p_biz_source_name TEXT,
    p_project_name TEXT DEFAULT NULL,
    p_client_id UUID DEFAULT NULL,
    p_invoice_number TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT 'Client revenue landed in personal account',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inc income_entries%ROWTYPE;
    v_biz_income_id UUID;
    v_transfer_id UUID;
BEGIN
    SELECT * INTO v_inc FROM income_entries WHERE id = p_personal_income_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personal income not found';
    END IF;
    IF v_inc.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_inc.is_business_withdrawal = TRUE AND v_inc.linked_transfer_id IS NOT NULL THEN
        RAISE EXCEPTION 'Income is already mirrored. Unmirror it first.';
    END IF;

    INSERT INTO business_income (
        user_id, amount, category, source_name, project_name,
        client_id, invoice_number, date, payment_method,
        landed_in, notes
    ) VALUES (
        v_inc.user_id, v_inc.amount, p_biz_category, p_biz_source_name, p_project_name,
        p_client_id, p_invoice_number, v_inc.date, v_inc.payment_method,
        'personal_account', COALESCE(p_notes, v_inc.notes)
    )
    RETURNING id INTO v_biz_income_id;

    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        personal_income_id, business_income_id, notes
    ) VALUES (
        v_inc.user_id, 'business_to_personal', v_inc.amount, v_inc.date, p_reason,
        p_personal_income_id, v_biz_income_id, p_notes
    )
    RETURNING id INTO v_transfer_id;

    UPDATE income_entries
    SET is_business_withdrawal = TRUE,
        linked_transfer_id = v_transfer_id
    WHERE id = p_personal_income_id;

    RETURN jsonb_build_object(
        'business_income_id', v_biz_income_id,
        'transfer_id', v_transfer_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION mirror_income_to_business(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 5. RPC: unmirror_income_to_business
-- ============================================================
CREATE OR REPLACE FUNCTION unmirror_income_to_business(
    p_personal_income_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inc income_entries%ROWTYPE;
    v_transfer personal_business_transfers%ROWTYPE;
    v_biz_income_id UUID;
BEGIN
    SELECT * INTO v_inc FROM income_entries WHERE id = p_personal_income_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personal income not found';
    END IF;
    IF v_inc.user_id <> auth.uid() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF v_inc.linked_transfer_id IS NULL THEN
        UPDATE income_entries
        SET is_business_withdrawal = FALSE
        WHERE id = p_personal_income_id;
        RETURN jsonb_build_object('status', 'noop');
    END IF;

    SELECT * INTO v_transfer FROM personal_business_transfers WHERE id = v_inc.linked_transfer_id;
    v_biz_income_id := v_transfer.business_income_id;

    UPDATE income_entries
    SET is_business_withdrawal = FALSE,
        linked_transfer_id = NULL
    WHERE id = p_personal_income_id;

    DELETE FROM personal_business_transfers WHERE id = v_inc.linked_transfer_id;
    IF v_biz_income_id IS NOT NULL THEN
        DELETE FROM business_income WHERE id = v_biz_income_id;
    END IF;

    RETURN jsonb_build_object('status', 'unmirrored', 'removed_business_income_id', v_biz_income_id);
END;
$$;

GRANT EXECUTE ON FUNCTION unmirror_income_to_business(UUID) TO authenticated;
