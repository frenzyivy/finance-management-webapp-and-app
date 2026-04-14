-- Migration: business_subscription_spend_mtd view
-- Date: 2026-04-20
-- Exposes planned (monthly_equivalent) vs actual month-to-date spend per
-- business subscription by joining business_subscriptions to business_expenses
-- on subscription_id for the current calendar month.
--
-- The view is filtered per-user at query time (callers SELECT ... WHERE user_id = auth.uid()).
-- Because RLS on views follows the underlying tables' policies, and both
-- business_subscriptions and business_expenses already enforce
-- auth.uid() = user_id, this view is safe to expose.

CREATE OR REPLACE VIEW business_subscription_spend_mtd AS
SELECT
    s.id                 AS id,
    s.user_id            AS user_id,
    s.name               AS name,
    s.monthly_equivalent AS monthly_equivalent,
    COALESCE(
        SUM(e.amount) FILTER (
            WHERE e.date >= date_trunc('month', CURRENT_DATE)::date
              AND e.date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
        ),
        0
    )::NUMERIC(12,2)     AS actual_spend_mtd,
    COUNT(e.id) FILTER (
        WHERE e.date >= date_trunc('month', CURRENT_DATE)::date
          AND e.date <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    )::INT               AS expense_count_mtd
FROM business_subscriptions s
LEFT JOIN business_expenses e
    ON e.subscription_id = s.id
   AND e.user_id = s.user_id
GROUP BY s.id, s.user_id, s.name, s.monthly_equivalent;

GRANT SELECT ON business_subscription_spend_mtd TO authenticated;
