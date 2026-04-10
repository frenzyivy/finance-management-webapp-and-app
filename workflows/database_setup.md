# Workflow: Database Setup & Migrations

## Objective
Create, manage, and run Supabase database migrations for KomalFin.

## Migration File Convention
- Location: `supabase/migrations/`
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Each file is idempotent when possible (use `IF NOT EXISTS`)

## Writing a Migration

### Template
```sql
-- Migration: [description]
-- Date: [YYYY-MM-DD]

-- Create table
CREATE TABLE IF NOT EXISTS [table_name] (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- ... columns ...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE [table_name] ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own data
CREATE POLICY "Users can only access own [table_name]"
ON [table_name]
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_[table_name]_updated_at
    BEFORE UPDATE ON [table_name]
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Currency Fields
Always use `NUMERIC(12,2)` for monetary amounts. Never use `FLOAT` or `REAL`.

### Enums
Create enum types for categories:
```sql
CREATE TYPE income_category AS ENUM ('salary', 'freelance', 'borrowed', 'side_income', 'other');
```

## Running Migrations

### Option A: Python Tool
```bash
python tools/run_migration.py supabase/migrations/20260410000001_create_profiles.sql
```

### Option B: Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL
3. Click "Run"

### Option C: Supabase CLI
```bash
supabase db push
```

## Verification
- Check table exists in Supabase Dashboard → Table Editor
- Verify RLS is enabled (lock icon on table)
- Test inserting a row to confirm policies work

## Troubleshooting
- **"permission denied"**: RLS policy might be blocking. Check `auth.uid()` matches.
- **"relation already exists"**: Use `IF NOT EXISTS` in CREATE statements.
- **"type already exists"**: Use `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;`
