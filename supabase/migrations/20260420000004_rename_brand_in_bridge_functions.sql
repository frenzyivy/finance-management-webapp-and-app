-- Migration: Rename "Alainza Bizz" → "Allianza Biz" in bridge function bodies
-- Date: 2026-04-20
-- The bridge trigger functions and log_personal_business_transfer RPC embed
-- the brand name in auto-generated personal expense/income rows. The original
-- migration (20260415100001) was already applied with the old name, so we
-- CREATE OR REPLACE the same function bodies here with the corrected literal.
-- Triggers do not need to be redropped/re-added; replacing the function
-- definition is enough.

-- ============================================================
-- 1. business_expenses INSERT → personal mirror
-- ============================================================
CREATE OR REPLACE FUNCTION create_personal_mirror_on_business_expense()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_id UUID;
    v_personal_amount NUMERIC(12,2);
    v_personal_expense_id UUID;
BEGIN
    IF NEW.funded_from NOT IN ('personal_pocket', 'mixed') THEN
        RETURN NEW;
    END IF;

    IF NEW.funded_from = 'mixed' THEN
        v_personal_amount := COALESCE(NEW.personal_portion, 0);
        IF v_personal_amount <= 0 THEN
            RETURN NEW;
        END IF;
    ELSE
        v_personal_amount := NEW.amount;
    END IF;

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

    UPDATE personal_business_transfers
    SET personal_expense_id = v_personal_expense_id
    WHERE id = v_transfer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. business_income INSERT → personal mirror
-- ============================================================
CREATE OR REPLACE FUNCTION create_personal_mirror_on_business_income()
RETURNS TRIGGER AS $$
DECLARE
    v_transfer_id UUID;
    v_personal_income_id UUID;
BEGIN
    IF NEW.landed_in <> 'personal_account' THEN
        RETURN NEW;
    END IF;

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

    UPDATE personal_business_transfers
    SET personal_income_id = v_personal_income_id
    WHERE id = v_transfer_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 3. log_personal_business_transfer RPC
-- ============================================================
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

    INSERT INTO personal_business_transfers (
        user_id, direction, amount, date, reason,
        business_expense_id, business_income_id, notes
    ) VALUES (
        p_user_id, p_direction, p_amount, p_date, p_reason,
        p_business_expense_id, p_business_income_id, p_notes
    ) RETURNING id INTO v_transfer_id;

    IF p_direction = 'personal_to_business' THEN
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
-- 4. Backfill: rename existing auto-generated rows
-- ============================================================
-- Rows already created under the old name still display "Alainza Bizz".
-- These updates touch only the auto-generated mirror rows (is_auto_generated
-- = TRUE, or matching the business-withdrawal pattern), not anything the
-- user typed manually.

UPDATE expense_entries
SET sub_category = 'Allianza Biz'
WHERE is_auto_generated = TRUE
  AND sub_category = 'Alainza Bizz';

UPDATE expense_entries
SET notes = REPLACE(notes, 'Alainza Bizz', 'Allianza Biz')
WHERE is_auto_generated = TRUE
  AND notes LIKE '%Alainza Bizz%';

UPDATE income_entries
SET source_name = REPLACE(source_name, 'Alainza Bizz', 'Allianza Biz')
WHERE is_business_withdrawal = TRUE
  AND source_name LIKE '%Alainza Bizz%';

UPDATE income_entries
SET notes = REPLACE(notes, 'Alainza Bizz', 'Allianza Biz')
WHERE is_business_withdrawal = TRUE
  AND notes LIKE '%Alainza Bizz%';
