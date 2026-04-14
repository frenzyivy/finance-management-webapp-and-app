-- Migration: Create imported_transactions table (staging queue for SMS and statement imports)
-- Date: 2026-04-13

-- Import source enum
DO $$ BEGIN
    CREATE TYPE import_source AS ENUM ('sms', 'bank_statement_csv', 'bank_statement_pdf');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Transaction type enum
DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('debit', 'credit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Import status enum
DO $$ BEGIN
    CREATE TYPE import_status AS ENUM ('pending', 'imported', 'rejected', 'duplicate');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS imported_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Source info
    import_source import_source NOT NULL,
    raw_text TEXT,
    import_batch_id UUID,

    -- Parsed fields
    parsed_amount NUMERIC(12,2) NOT NULL CHECK (parsed_amount > 0),
    parsed_type transaction_type NOT NULL,
    parsed_date DATE NOT NULL,
    parsed_reference TEXT,
    parsed_account_hint TEXT,
    parsed_description TEXT,

    -- User assignment (filled during review)
    assigned_category TEXT,
    assigned_payee_name TEXT,
    assigned_payment_method TEXT,

    -- Status & linking
    status import_status DEFAULT 'pending',
    linked_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
    linked_income_id UUID REFERENCES income_entries(id) ON DELETE SET NULL,

    -- Deduplication
    dedup_hash TEXT,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE imported_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own imported_transactions"
ON imported_transactions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_imported_transactions_updated_at
    BEFORE UPDATE ON imported_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_imported_transactions_dedup ON imported_transactions(user_id, dedup_hash);
CREATE INDEX idx_imported_transactions_status ON imported_transactions(user_id, status);
CREATE INDEX idx_imported_transactions_batch ON imported_transactions(user_id, import_batch_id);
