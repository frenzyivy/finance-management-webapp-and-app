-- Goals v2: goal_categories table
-- Date: 2026-04-16

CREATE TABLE IF NOT EXISTS goal_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL CHECK (color IN ('pink','purple','teal','blue','amber','green','coral','gray','red')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_goal_categories_user_sort
    ON goal_categories(user_id, sort_order);

ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access own goal_categories" ON goal_categories;
CREATE POLICY "Users can only access own goal_categories"
ON goal_categories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_goal_categories_updated_at ON goal_categories;
CREATE TRIGGER update_goal_categories_updated_at
    BEFORE UPDATE ON goal_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
