-- Migration: Backfill business_expenses.subscription_id from vendor_name
-- Date: 2026-04-20
-- Uses match_business_subscription_by_name() (defined in 20260419000001) so
-- the matching rules stay identical to the form-level auto-suggest.
-- Idempotent: only touches rows where subscription_id IS NULL.

UPDATE business_expenses e
SET subscription_id = match_business_subscription_by_name(e.user_id, e.vendor_name)
WHERE e.subscription_id IS NULL
  AND match_business_subscription_by_name(e.user_id, e.vendor_name) IS NOT NULL;
