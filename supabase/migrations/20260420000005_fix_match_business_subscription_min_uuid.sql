-- Migration: Fix match_business_subscription_by_name — MIN(uuid) is not a
-- valid Postgres aggregate. Cast to text for the aggregate and back to uuid.
-- Date: 2026-04-20
--
-- Original definition lives in 20260419000001_personal_business_mirror.sql.
-- This CREATE OR REPLACE keeps the same signature/contract; only the SELECT
-- inside the body changes.

CREATE OR REPLACE FUNCTION match_business_subscription_by_name(
    p_user_id UUID,
    p_payee_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_id UUID;
    v_norm_payee TEXT;
    v_match_count INT;
BEGIN
    IF p_payee_name IS NULL OR length(trim(p_payee_name)) = 0 THEN
        RETURN NULL;
    END IF;

    v_norm_payee := lower(regexp_replace(p_payee_name, '[^a-zA-Z0-9]', '', 'g'));
    IF length(v_norm_payee) < 3 THEN
        RETURN NULL;
    END IF;

    SELECT COUNT(*), MIN(id::text)::uuid
    INTO v_match_count, v_match_id
    FROM business_subscriptions
    WHERE user_id = p_user_id
      AND status IN ('active', 'trial')
      AND (
        lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = v_norm_payee
        OR lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) LIKE v_norm_payee || '%'
        OR v_norm_payee LIKE lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '%'
      );

    IF v_match_count = 1 THEN
        RETURN v_match_id;
    END IF;
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION match_business_subscription_by_name(UUID, TEXT) TO authenticated;
