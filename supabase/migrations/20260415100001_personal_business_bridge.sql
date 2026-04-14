-- Migration: Personal↔Business Bridge (Phase 3)
-- Date: 2026-04-15
-- Adds triggers that auto-create mirror personal entries when business entries are
-- funded from / landed in personal accounts, plus cascade-delete on removal.

-- ============================================================
-- HELPER: Map business_expenses.category → expense_category
-- ============================================================
-- When auto-creating a personal mirror, we want all business-funded expenses
-- to land in the 'subscriptions' personal category by default (they're paid
-- from personal money but are business-related). Users can edit after.
CREATE OR REPLACE FUNCTION map_business_to_personal_expense_category(biz_cat TEXT)
RETURNS expense_category AS $$
BEGIN
    -- All business expenses that come out of personal pocket are tagged
    -- as 'subscriptions' by default (most common case: SaaS tools).
    -- This is just a sensible default; the user can edit the personal row.
    RETURN 'subscriptions'::expense_category;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- TRIGGER: business_expenses INSERT → mirror in expense_entries
-- ============================================================
CREATE OR REPLACE FUNCTION create_personal_mirror_on_business_expense()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_id UUID;
    v_personal_amount NUMERIC(12,2);
    v_personal_expense_id UUID;
BEGIN
    -- Only mirror if funded from personal pocket (fully or partially)
    IF NEW.funded_from NOT IN ('personal_pocket', 'mixed') THEN
        RETURN NEW;
    END IF;

    -- For 'mixed', only the personal_portion flows through personal
    IF NEW.funded_from = 'mixed' THEN
        v_personal_amount := COALESCE(NEW.personal_portion, 0);
        IF v_personal_amount <= 0 THEN
            RETURN NEW;
        END IF;
    ELSE
        v_personal_amount := NEW.amount;
    END IF;

    -- Create the transfer record first (personal → business)
    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        business_expense_id, notes
    ) VALUES (
        NEW.user_id,
        'personal_to_business',
        v_personal_amount,
        NEW.date,
        'Business expense: ' || NEW.vendor_name,
        NEW.id,
        'Auto-generated from business expense'
    ) RETURNING id INTO v_transfer_id;

    -- Create mirror personal expense
    INSERT INTO expense_entries (
        user_id, amount, category, sub_category, payee_name, date,
        payment_method, is_emi, is_recurring, recurrence_frequency,
        notes, funding_source, is_auto_generated, is_business_investment,
        linked_transfer_id
    ) VALUES (
        NEW.user_id,
        v_personal_amount,
        map_business_to_personal_expense_category(NEW.category),
        'Allianza Biz',
        NEW.vendor_name,
        NEW.date,
        COALESCE(NEW.payment_method, 'upi'),
        FALSE,
        NEW.is_recurring,
        NEW.recurrence_frequency,
        'Auto-generated from Allianza Biz: ' || COALESCE(NEW.notes, NEW.vendor_name),
        'own_funds',
        TRUE,
        TRUE,
        v_transfer_id
    ) RETURNING id INTO v_personal_expense_id;

    -- Link the transfer back to the personal expense
    UPDATE personal_business_transfers
    SET personal_expense_id = v_personal_expense_id
    WHERE id = v_transfer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_business_expense_personal_mirror
    AFTER INSERT ON business_expenses
    FOR EACH ROW
    EXECUTE FUNCTION create_personal_mirror_on_business_expense();


-- ============================================================
-- TRIGGER: business_expenses DELETE → cascade to mirror + transfer
-- ============================================================
CREATE OR REPLACE FUNCTION cascade_delete_personal_mirror_on_business_expense()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_record RECORD;
BEGIN
    -- Find any transfer records linked to this business expense
    FOR v_transfer_record IN
        SELECT id, personal_expense_id
        FROM personal_business_transfers
        WHERE business_expense_id = OLD.id
    LOOP
        -- Delete the personal mirror expense (if it still exists)
        IF v_transfer_record.personal_expense_id IS NOT NULL THEN
            DELETE FROM expense_entries WHERE id = v_transfer_record.personal_expense_id;
        END IF;
        -- Delete the transfer record itself
        DELETE FROM personal_business_transfers WHERE id = v_transfer_record.id;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_business_expense_cascade_delete
    BEFORE DELETE ON business_expenses
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_personal_mirror_on_business_expense();


-- ============================================================
-- TRIGGER: business_income INSERT → mirror in income_entries
-- ============================================================
CREATE OR REPLACE FUNCTION create_personal_mirror_on_business_income()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_id UUID;
    v_personal_income_id UUID;
BEGIN
    -- Only mirror if money landed in personal account
    IF NEW.landed_in <> 'personal_account' THEN
        RETURN NEW;
    END IF;

    -- Create the transfer record (business → personal)
    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        business_income_id, notes
    ) VALUES (
        NEW.user_id,
        'business_to_personal',
        NEW.amount,
        NEW.date,
        'Business income: ' || NEW.source_name,
        NEW.id,
        'Auto-generated from business income'
    ) RETURNING id INTO v_transfer_id;

    -- Create mirror personal income (category 'other' with business_withdrawal flag)
    INSERT INTO income_entries (
        user_id, amount, category, source_name, date, payment_method,
        is_recurring, recurrence_frequency, notes,
        is_business_withdrawal, linked_transfer_id
    ) VALUES (
        NEW.user_id,
        NEW.amount,
        'other',
        'Allianza Biz — ' || NEW.source_name,
        NEW.date,
        COALESCE(NEW.payment_method, 'bank_transfer'),
        NEW.is_recurring,
        NEW.recurrence_frequency,
        'Auto-generated from Allianza Biz: ' || COALESCE(NEW.notes, NEW.source_name),
        TRUE,
        v_transfer_id
    ) RETURNING id INTO v_personal_income_id;

    -- Link transfer back to personal income
    UPDATE personal_business_transfers
    SET personal_income_id = v_personal_income_id
    WHERE id = v_transfer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_business_income_personal_mirror
    AFTER INSERT ON business_income
    FOR EACH ROW
    EXECUTE FUNCTION create_personal_mirror_on_business_income();


-- ============================================================
-- TRIGGER: business_income DELETE → cascade to mirror + transfer
-- ============================================================
CREATE OR REPLACE FUNCTION cascade_delete_personal_mirror_on_business_income()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_record RECORD;
BEGIN
    FOR v_transfer_record IN
        SELECT id, personal_income_id
        FROM personal_business_transfers
        WHERE business_income_id = OLD.id
    LOOP
        IF v_transfer_record.personal_income_id IS NOT NULL THEN
            DELETE FROM income_entries WHERE id = v_transfer_record.personal_income_id;
        END IF;
        DELETE FROM personal_business_transfers WHERE id = v_transfer_record.id;
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_business_income_cascade_delete
    BEFORE DELETE ON business_income
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_personal_mirror_on_business_income();


-- ============================================================
-- RPC: log_personal_business_transfer
-- ============================================================
-- For the "Log Transfer" standalone form. Creates a transfer + the
-- corresponding personal mirror entry atomically.
--
-- direction = 'personal_to_business': creates a personal EXPENSE tagged
--   is_business_investment. Optionally links to an existing business_expense_id.
-- direction = 'business_to_personal': creates a personal INCOME tagged
--   is_business_withdrawal. Optionally links to an existing business_income_id.
CREATE OR REPLACE FUNCTION log_personal_business_transfer(
    p_user_id UUID,
    p_direction TEXT,
    p_amount NUMERIC,
    p_date DATE,
    p_reason TEXT,
    p_business_expense_id UUID DEFAULT NULL,
    p_business_income_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transfer_id UUID;
    v_personal_id UUID;
BEGIN
    IF p_direction NOT IN ('personal_to_business', 'business_to_personal') THEN
        RAISE EXCEPTION 'Invalid direction: %', p_direction;
    END IF;
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be > 0';
    END IF;

    -- Create the transfer record
    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        business_expense_id, business_income_id, notes
    ) VALUES (
        p_user_id, p_direction, p_amount, p_date, p_reason,
        p_business_expense_id, p_business_income_id, p_notes
    ) RETURNING id INTO v_transfer_id;

    IF p_direction = 'personal_to_business' THEN
        -- Create personal expense (business investment)
        INSERT INTO expense_entries (
            user_id, amount, category, sub_category, payee_name, date,
            payment_method, is_emi, is_recurring, notes,
            funding_source, is_auto_generated, is_business_investment,
            linked_transfer_id
        ) VALUES (
            p_user_id, p_amount, 'subscriptions'::expense_category,
            'Business Investment',
            'Allianza Biz',
            p_date, 'upi', FALSE, FALSE,
            COALESCE(p_notes, p_reason),
            'own_funds', TRUE, TRUE, v_transfer_id
        ) RETURNING id INTO v_personal_id;

        UPDATE personal_business_transfers
        SET personal_expense_id = v_personal_id
        WHERE id = v_transfer_id;
    ELSE
        -- business_to_personal: create personal income (business withdrawal)
        INSERT INTO income_entries (
            user_id, amount, category, source_name, date, payment_method,
            is_recurring, notes,
            is_business_withdrawal, linked_transfer_id
        ) VALUES (
            p_user_id, p_amount, 'other'::income_category,
            'Allianza Biz — ' || p_reason,
            p_date, 'bank_transfer', FALSE,
            COALESCE(p_notes, p_reason),
            TRUE, v_transfer_id
        ) RETURNING id INTO v_personal_id;

        UPDATE personal_business_transfers
        SET personal_income_id = v_personal_id
        WHERE id = v_transfer_id;
    END IF;

    RETURN v_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- TRIGGER: personal_business_transfers DELETE → cascade mirror
-- ============================================================
-- If user deletes a transfer directly, also remove the personal mirror.
CREATE OR REPLACE FUNCTION cascade_delete_mirrors_on_transfer()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.personal_expense_id IS NOT NULL THEN
        DELETE FROM expense_entries WHERE id = OLD.personal_expense_id;
    END IF;
    IF OLD.personal_income_id IS NOT NULL THEN
        DELETE FROM income_entries WHERE id = OLD.personal_income_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_transfer_cascade_delete
    BEFORE DELETE ON personal_business_transfers
    FOR EACH ROW
    EXECUTE FUNCTION cascade_delete_mirrors_on_transfer();
