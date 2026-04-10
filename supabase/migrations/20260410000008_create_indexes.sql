-- Migration: Create performance indexes
-- Date: 2026-04-10

-- Income entries indexes
CREATE INDEX IF NOT EXISTS idx_income_entries_user_id ON income_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_date ON income_entries(date);
CREATE INDEX IF NOT EXISTS idx_income_entries_category ON income_entries(category);
CREATE INDEX IF NOT EXISTS idx_income_entries_user_date ON income_entries(user_id, date);

-- Expense entries indexes
CREATE INDEX IF NOT EXISTS idx_expense_entries_user_id ON expense_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_date ON expense_entries(date);
CREATE INDEX IF NOT EXISTS idx_expense_entries_category ON expense_entries(category);
CREATE INDEX IF NOT EXISTS idx_expense_entries_user_date ON expense_entries(user_id, date);

-- Savings goals indexes
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal_id ON savings_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_savings_contributions_user_id ON savings_contributions(user_id);

-- Debts indexes
CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt_id ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_user_id ON debt_payments(user_id);

-- Credit cards indexes
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);

-- Budget limits indexes
CREATE INDEX IF NOT EXISTS idx_budget_limits_user_id ON budget_limits(user_id);
