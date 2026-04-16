-- Goals v2: keep savings_goals.current_balance in sync with savings_contributions
-- Recomputes from source of truth on every contribution mutation.
-- Date: 2026-04-16

CREATE OR REPLACE FUNCTION sync_goal_current_balance()
RETURNS TRIGGER AS $$
DECLARE
    affected_goal_ids UUID[];
    gid UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        affected_goal_ids := ARRAY[NEW.goal_id];
    ELSIF TG_OP = 'DELETE' THEN
        affected_goal_ids := ARRAY[OLD.goal_id];
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.goal_id IS DISTINCT FROM OLD.goal_id THEN
            affected_goal_ids := ARRAY[OLD.goal_id, NEW.goal_id];
        ELSE
            affected_goal_ids := ARRAY[NEW.goal_id];
        END IF;
    END IF;

    FOREACH gid IN ARRAY affected_goal_ids LOOP
        UPDATE savings_goals
        SET current_balance = COALESCE(
                (SELECT SUM(amount) FROM savings_contributions WHERE goal_id = gid),
                0
            ),
            updated_at = NOW()
        WHERE id = gid;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_goal_current_balance ON savings_contributions;

CREATE TRIGGER trg_sync_goal_current_balance
    AFTER INSERT OR UPDATE OR DELETE ON savings_contributions
    FOR EACH ROW
    EXECUTE FUNCTION sync_goal_current_balance();
