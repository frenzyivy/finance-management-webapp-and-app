-- Migration: Create income_entries table
-- Date: 2026-04-10

-- Income category enum
DO $$ BEGIN
    CREATE TYPE income_category AS ENUM ('salary', 'freelance', 'borrowed', 'side_income', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recurrence frequency enum (shared across tables)
DO $$ BEGIN
    CREATE TYPE recurrence_frequency AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS income_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category income_category NOT NULL,
    source_name TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency recurrence_frequency,
    linked_debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own income_entries"
ON income_entries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_income_entries_updated_at
    BEFORE UPDATE ON income_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
