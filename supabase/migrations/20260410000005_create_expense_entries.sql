-- Migration: Create expense_entries table
-- Date: 2026-04-10

-- Expense category enum
DO $$ BEGIN
    CREATE TYPE expense_category AS ENUM (
        'credit_card_payments', 'emis', 'rent', 'food_groceries',
        'utilities', 'transport', 'shopping', 'health',
        'education', 'entertainment', 'subscriptions',
        'family_personal', 'miscellaneous'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS expense_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category expense_category NOT NULL,
    sub_category TEXT,
    payee_name TEXT NOT NULL,
    date DATE NOT NULL,
    payment_method TEXT NOT NULL,
    credit_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL,
    is_emi BOOLEAN DEFAULT FALSE,
    linked_debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency recurrence_frequency,
    receipt_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expense_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own expense_entries"
ON expense_entries
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_expense_entries_updated_at
    BEFORE UPDATE ON expense_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
