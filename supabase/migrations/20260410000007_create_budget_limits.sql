-- Migration: Create budget_limits table
-- Date: 2026-04-10

CREATE TABLE IF NOT EXISTS budget_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    monthly_limit NUMERIC(12,2) NOT NULL CHECK (monthly_limit > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

-- Enable RLS
ALTER TABLE budget_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own budget_limits"
ON budget_limits
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_budget_limits_updated_at
    BEFORE UPDATE ON budget_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
