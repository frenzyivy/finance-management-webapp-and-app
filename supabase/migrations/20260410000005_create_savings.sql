-- Migration: Create savings_goals and savings_contributions tables
-- Date: 2026-04-10

-- Priority enum
DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM ('high', 'medium', 'low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Goal status enum
DO $$ BEGIN
    CREATE TYPE goal_status AS ENUM ('active', 'completed', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
    current_balance NUMERIC(12,2) DEFAULT 0 CHECK (current_balance >= 0),
    priority priority_level DEFAULT 'medium',
    target_date DATE,
    color TEXT DEFAULT '#0d9488',
    icon TEXT DEFAULT 'piggy-bank',
    status goal_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own savings_goals"
ON savings_goals
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_savings_goals_updated_at
    BEFORE UPDATE ON savings_goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Savings contributions
CREATE TABLE IF NOT EXISTS savings_contributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    source_description TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE savings_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own savings_contributions"
ON savings_contributions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_savings_contributions_updated_at
    BEFORE UPDATE ON savings_contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
