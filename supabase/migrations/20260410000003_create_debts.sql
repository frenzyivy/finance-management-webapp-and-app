-- Migration: Create debts and debt_payments tables
-- Date: 2026-04-10
-- NOTE: This migration must run BEFORE income_entries and expense_entries
-- since they reference the debts table via FK.

-- Debt type enum
DO $$ BEGIN
    CREATE TYPE debt_type AS ENUM ('credit_card', 'personal_loan', 'bnpl', 'borrowed_from_person', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Debt status enum
DO $$ BEGIN
    CREATE TYPE debt_status AS ENUM ('active', 'paid_off');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS debts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type debt_type NOT NULL,
    creditor_name TEXT NOT NULL,
    original_amount NUMERIC(12,2) NOT NULL CHECK (original_amount > 0),
    outstanding_balance NUMERIC(12,2) NOT NULL CHECK (outstanding_balance >= 0),
    interest_rate NUMERIC(5,2),
    emi_amount NUMERIC(12,2),
    emi_day_of_month INTEGER CHECK (emi_day_of_month >= 1 AND emi_day_of_month <= 31),
    total_emis INTEGER,
    remaining_emis INTEGER,
    start_date DATE NOT NULL,
    expected_payoff_date DATE,
    status debt_status DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own debts"
ON debts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Debt payments
CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    debt_id UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own debt_payments"
ON debt_payments
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_debt_payments_updated_at
    BEFORE UPDATE ON debt_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
