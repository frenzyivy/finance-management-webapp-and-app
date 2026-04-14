-- Migration: Create business finance tables (Allianza Biz module)
-- Date: 2026-04-14
-- Tables: business_clients, business_subscriptions, business_income, business_expenses, personal_business_transfers
-- Also modifies: expense_entries, income_entries (add bridge columns)

-- ============================================================
-- 1. business_clients (no FK dependencies, must be created first)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT,
    country TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    engagement_type TEXT CHECK (engagement_type IN (
        'project', 'retainer', 'hourly', 'pilot', 'one_off'
    )),
    monthly_value NUMERIC(12,2),
    start_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'prospect', 'churned', 'paused'
    )),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own business_clients"
ON business_clients FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_clients_updated_at
    BEFORE UPDATE ON business_clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_biz_clients_user ON business_clients(user_id);
CREATE INDEX idx_biz_clients_status ON business_clients(user_id, status);

-- ============================================================
-- 2. business_subscriptions (referenced by business_expenses)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'ai_tools', 'outreach', 'email_marketing', 'hosting', 'domain',
        'design', 'analytics', 'crm', 'communication', 'development',
        'storage', 'other'
    )),
    vendor_url TEXT,
    cost_amount NUMERIC(12,2) NOT NULL,
    cost_currency TEXT DEFAULT 'INR',
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN (
        'monthly', 'quarterly', 'yearly'
    )),
    monthly_equivalent NUMERIC(12,2) GENERATED ALWAYS AS (
        CASE billing_cycle
            WHEN 'monthly' THEN cost_amount
            WHEN 'quarterly' THEN ROUND(cost_amount / 3, 2)
            WHEN 'yearly' THEN ROUND(cost_amount / 12, 2)
        END
    ) STORED,
    renewal_day INT NOT NULL CHECK (renewal_day BETWEEN 1 AND 31),
    next_renewal_date DATE NOT NULL,
    start_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'cancelled', 'trial'
    )),
    trial_ends_date DATE,
    auto_renew BOOLEAN DEFAULT TRUE,
    funded_from TEXT NOT NULL DEFAULT 'personal_pocket' CHECK (funded_from IN (
        'personal_pocket', 'business_revenue', 'mixed'
    )),
    is_essential BOOLEAN DEFAULT TRUE,
    notes TEXT,
    reminder_days_before INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own business_subscriptions"
ON business_subscriptions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_subscriptions_updated_at
    BEFORE UPDATE ON business_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_biz_sub_user ON business_subscriptions(user_id);
CREATE INDEX idx_biz_sub_renewal ON business_subscriptions(next_renewal_date);
CREATE INDEX idx_biz_sub_status ON business_subscriptions(user_id, status);

-- ============================================================
-- 3. business_income (references business_clients)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_income (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL CHECK (category IN (
        'client_project', 'retainer', 'freelance_platform',
        'affiliate_commission', 'consultation', 'one_off_gig',
        'refund', 'other'
    )),
    source_name TEXT NOT NULL,
    project_name TEXT,
    client_id UUID REFERENCES business_clients(id) ON DELETE SET NULL,
    invoice_number TEXT,
    date DATE NOT NULL,
    payment_method TEXT,
    landed_in TEXT NOT NULL DEFAULT 'personal_account' CHECK (landed_in IN (
        'personal_account', 'business_direct', 'reinvested'
    )),
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT CHECK (recurrence_frequency IN (
        'weekly', 'monthly', 'quarterly', 'yearly'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own business_income"
ON business_income FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_income_updated_at
    BEFORE UPDATE ON business_income
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_biz_income_user ON business_income(user_id);
CREATE INDEX idx_biz_income_date ON business_income(user_id, date);
CREATE INDEX idx_biz_income_client ON business_income(client_id);

-- ============================================================
-- 4. business_expenses (references business_subscriptions + business_clients)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    category TEXT NOT NULL CHECK (category IN (
        'saas_tools', 'marketing_ads', 'contractor_freelancer',
        'hardware_equipment', 'learning_courses', 'travel_meetings',
        'communication', 'domain_hosting', 'office_supplies',
        'taxes_compliance', 'miscellaneous'
    )),
    sub_category TEXT,
    vendor_name TEXT NOT NULL,
    subscription_id UUID REFERENCES business_subscriptions(id) ON DELETE SET NULL,
    client_id UUID REFERENCES business_clients(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    payment_method TEXT,
    funded_from TEXT NOT NULL DEFAULT 'personal_pocket' CHECK (funded_from IN (
        'personal_pocket', 'business_revenue', 'mixed'
    )),
    personal_portion NUMERIC(12,2) DEFAULT 0,
    is_tax_deductible BOOLEAN DEFAULT TRUE,
    gst_applicable BOOLEAN DEFAULT FALSE,
    gst_amount NUMERIC(12,2) DEFAULT 0,
    receipt_url TEXT,
    notes TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_frequency TEXT CHECK (recurrence_frequency IN (
        'weekly', 'monthly', 'quarterly', 'yearly'
    )),
    is_auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own business_expenses"
ON business_expenses FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_business_expenses_updated_at
    BEFORE UPDATE ON business_expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_biz_exp_user ON business_expenses(user_id);
CREATE INDEX idx_biz_exp_date ON business_expenses(user_id, date);
CREATE INDEX idx_biz_exp_category ON business_expenses(category);
CREATE INDEX idx_biz_exp_client ON business_expenses(client_id);
CREATE INDEX idx_biz_exp_subscription ON business_expenses(subscription_id);

-- ============================================================
-- 5. personal_business_transfers (bridge table)
-- ============================================================

CREATE TABLE IF NOT EXISTS personal_business_transfers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN (
        'personal_to_business', 'business_to_personal'
    )),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL,
    reason TEXT NOT NULL,
    personal_expense_id UUID REFERENCES expense_entries(id) ON DELETE SET NULL,
    personal_income_id UUID REFERENCES income_entries(id) ON DELETE SET NULL,
    business_expense_id UUID REFERENCES business_expenses(id) ON DELETE SET NULL,
    business_income_id UUID REFERENCES business_income(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE personal_business_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own personal_business_transfers"
ON personal_business_transfers FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_personal_business_transfers_updated_at
    BEFORE UPDATE ON personal_business_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_pb_transfers_user ON personal_business_transfers(user_id);
CREATE INDEX idx_pb_transfers_date ON personal_business_transfers(user_id, date);
CREATE INDEX idx_pb_transfers_direction ON personal_business_transfers(direction);

-- ============================================================
-- 6. Modify existing personal tables (bridge columns for Phase 3)
-- ============================================================

ALTER TABLE expense_entries
    ADD COLUMN IF NOT EXISTS is_business_investment BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS linked_transfer_id UUID REFERENCES personal_business_transfers(id) ON DELETE SET NULL;

ALTER TABLE income_entries
    ADD COLUMN IF NOT EXISTS is_business_withdrawal BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS linked_transfer_id UUID REFERENCES personal_business_transfers(id) ON DELETE SET NULL;
