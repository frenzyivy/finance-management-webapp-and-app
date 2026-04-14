-- Migration: Recurring Entry Automation
-- Date: 2026-04-14
-- Adds tracking columns and RPC to auto-generate entries from recurring templates.

-- ============================================================
-- 1. Add recurrence tracking columns to income_entries
-- ============================================================
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_recurring_id UUID REFERENCES income_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_recurrence_date DATE;

CREATE INDEX IF NOT EXISTS idx_income_entries_recurring
  ON income_entries(user_id, is_recurring)
  WHERE is_recurring = TRUE;

-- ============================================================
-- 2. Add recurrence tracking columns to expense_entries
-- ============================================================
ALTER TABLE expense_entries
  ADD COLUMN IF NOT EXISTS source_recurring_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_recurrence_date DATE;

CREATE INDEX IF NOT EXISTS idx_expense_entries_recurring
  ON expense_entries(user_id, is_recurring)
  WHERE is_recurring = TRUE;

-- ============================================================
-- 3. Create recurrence_log table (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS recurrence_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_at TIMESTAMPTZ DEFAULT NOW(),
    entries_created INTEGER DEFAULT 0,
    details JSONB DEFAULT '[]'::JSONB
);

-- ============================================================
-- 4. RPC: generate_recurring_entries
--    Scans all recurring income/expense templates and creates
--    new entries for any periods that are due.
--    Idempotent — safe to call multiple times per day.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_recurring_entries(
    p_target_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    v_next_date DATE;
    v_new_id UUID;
    v_created INTEGER := 0;
    v_details JSONB := '[]'::JSONB;
BEGIN
    -- ── INCOME ENTRIES ────────────────────────────────────────
    FOR rec IN
        SELECT *
        FROM income_entries
        WHERE is_recurring = TRUE
          AND recurrence_frequency IS NOT NULL
          AND is_auto_generated = FALSE  -- only originals, not copies
    LOOP
        -- Calculate the next date this entry is due
        v_next_date := _calc_next_recurrence_date(
            COALESCE(rec.last_recurrence_date, rec.date),
            rec.recurrence_frequency::TEXT
        );

        -- Generate entries for all missed periods up to target_date
        WHILE v_next_date <= p_target_date LOOP
            -- Check if an entry already exists for this exact date (idempotency)
            IF NOT EXISTS (
                SELECT 1 FROM income_entries
                WHERE source_recurring_id = rec.id
                  AND date = v_next_date
                  AND user_id = rec.user_id
            ) THEN
                INSERT INTO income_entries (
                    user_id, amount, category, source_name, date,
                    payment_method, is_recurring, recurrence_frequency,
                    linked_debt_id, notes,
                    is_auto_generated, source_recurring_id
                ) VALUES (
                    rec.user_id, rec.amount, rec.category, rec.source_name,
                    v_next_date,
                    rec.payment_method, FALSE, NULL,
                    rec.linked_debt_id,
                    COALESCE(rec.notes, '') || ' [auto-generated]',
                    TRUE, rec.id
                )
                RETURNING id INTO v_new_id;

                v_created := v_created + 1;
                v_details := v_details || jsonb_build_object(
                    'type', 'income',
                    'source_id', rec.id,
                    'new_id', v_new_id,
                    'date', v_next_date,
                    'amount', rec.amount,
                    'user_id', rec.user_id
                );
            END IF;

            -- Update tracking on the original
            UPDATE income_entries
            SET last_recurrence_date = v_next_date
            WHERE id = rec.id;

            -- Move to the next period
            v_next_date := _calc_next_recurrence_date(
                v_next_date,
                rec.recurrence_frequency::TEXT
            );
        END LOOP;
    END LOOP;

    -- ── EXPENSE ENTRIES ───────────────────────────────────────
    FOR rec IN
        SELECT *
        FROM expense_entries
        WHERE is_recurring = TRUE
          AND recurrence_frequency IS NOT NULL
          AND is_auto_generated = FALSE  -- only originals
    LOOP
        v_next_date := _calc_next_recurrence_date(
            COALESCE(rec.last_recurrence_date, rec.date),
            rec.recurrence_frequency::TEXT
        );

        WHILE v_next_date <= p_target_date LOOP
            IF NOT EXISTS (
                SELECT 1 FROM expense_entries
                WHERE source_recurring_id = rec.id
                  AND date = v_next_date
                  AND user_id = rec.user_id
            ) THEN
                INSERT INTO expense_entries (
                    user_id, amount, category, sub_category, payee_name,
                    date, payment_method, credit_card_id, is_emi,
                    linked_debt_id, is_recurring, recurrence_frequency,
                    notes, funding_source,
                    is_auto_generated, source_recurring_id
                ) VALUES (
                    rec.user_id, rec.amount, rec.category, rec.sub_category,
                    rec.payee_name,
                    v_next_date,
                    rec.payment_method, rec.credit_card_id, rec.is_emi,
                    rec.linked_debt_id, FALSE, NULL,
                    COALESCE(rec.notes, '') || ' [auto-generated]',
                    rec.funding_source,
                    TRUE, rec.id
                )
                RETURNING id INTO v_new_id;

                v_created := v_created + 1;
                v_details := v_details || jsonb_build_object(
                    'type', 'expense',
                    'source_id', rec.id,
                    'new_id', v_new_id,
                    'date', v_next_date,
                    'amount', rec.amount,
                    'user_id', rec.user_id
                );
            END IF;

            UPDATE expense_entries
            SET last_recurrence_date = v_next_date
            WHERE id = rec.id;

            v_next_date := _calc_next_recurrence_date(
                v_next_date,
                rec.recurrence_frequency::TEXT
            );
        END LOOP;
    END LOOP;

    -- ── LOG THE RUN ───────────────────────────────────────────
    INSERT INTO recurrence_log (entries_created, details)
    VALUES (v_created, v_details);

    RETURN jsonb_build_object(
        'entries_created', v_created,
        'target_date', p_target_date,
        'details', v_details
    );
END;
$$;

-- ============================================================
-- 5. Helper: calculate next recurrence date
-- ============================================================
CREATE OR REPLACE FUNCTION _calc_next_recurrence_date(
    p_from_date DATE,
    p_frequency TEXT
)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    CASE p_frequency
        WHEN 'weekly' THEN
            RETURN p_from_date + INTERVAL '7 days';
        WHEN 'monthly' THEN
            RETURN p_from_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            RETURN p_from_date + INTERVAL '3 months';
        WHEN 'yearly' THEN
            RETURN p_from_date + INTERVAL '1 year';
        ELSE
            RETURN p_from_date + INTERVAL '1 month'; -- fallback
    END CASE;
END;
$$;
