-- Goals v2: extend savings_goals with category, achievement, archive, debt link
-- Date: 2026-04-16

ALTER TABLE savings_goals
    ADD COLUMN IF NOT EXISTS category_id UUID NULL REFERENCES goal_categories(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS achieved_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS linked_debt_id UUID NULL REFERENCES debts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_savings_goals_category_id
    ON savings_goals(category_id);

CREATE INDEX IF NOT EXISTS idx_savings_goals_archived_at
    ON savings_goals(user_id, archived_at);
