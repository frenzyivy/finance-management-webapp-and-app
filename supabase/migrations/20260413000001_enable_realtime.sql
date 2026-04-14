-- Enable Supabase Realtime on all user-facing tables
-- This allows web and mobile apps to subscribe to changes via Postgres Changes

ALTER PUBLICATION supabase_realtime ADD TABLE
  income_entries,
  expense_entries,
  savings_goals,
  savings_contributions,
  debts,
  debt_payments,
  budget_limits,
  credit_cards,
  profiles;
