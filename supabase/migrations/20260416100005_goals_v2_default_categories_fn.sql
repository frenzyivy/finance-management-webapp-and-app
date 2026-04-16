-- Goals v2: idempotent per-user seeding of 5 default categories
-- Called on-demand from the app (NOT as a data migration) to keep it non-breaking.
-- Date: 2026-04-16

CREATE OR REPLACE FUNCTION seed_default_goal_categories(p_user_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO goal_categories (user_id, name, icon, color, is_default, sort_order)
    VALUES
        (p_user_id, 'Family',   'lucide:Users',     'pink',   true, 0),
        (p_user_id, 'Myself',   'lucide:User',      'purple', true, 1),
        (p_user_id, 'Business', 'lucide:Briefcase', 'teal',   true, 2),
        (p_user_id, 'Future',   'lucide:Shield',    'blue',   true, 3),
        (p_user_id, 'Home',     'lucide:Home',      'amber',  true, 4)
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION seed_default_goal_categories(UUID) TO authenticated;
