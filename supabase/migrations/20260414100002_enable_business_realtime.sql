-- Enable Supabase Realtime on business finance tables
-- This allows web and mobile apps to subscribe to changes via Postgres Changes

ALTER PUBLICATION supabase_realtime ADD TABLE
  business_clients,
  business_subscriptions,
  business_income,
  business_expenses,
  personal_business_transfers;
