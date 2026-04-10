# Workflow: Feature Implementation

## Objective
Standard operating procedure for adding any new feature to KomalFin.

## Prerequisites
- Development environment running (see `workflows/setup_project.md`)
- Feature requirements documented in `FINANCE_APP_PROJECT.md`

## Steps

### 1. Understand Requirements
- Read the relevant module section in `FINANCE_APP_PROJECT.md`
- Note all data fields, categories, and key features
- Identify any cross-module links (e.g., borrowed money → debt tracker)

### 2. Database Changes (if needed)
- Write a new migration SQL file in `supabase/migrations/`
- Follow naming: `YYYYMMDDHHMMSS_description.sql`
- Include RLS policy: `auth.uid() = user_id`
- Run migration: `python tools/run_migration.py <migration_file>`
- See `workflows/database_setup.md` for details

### 3. Update TypeScript Types
- Update `web/src/types/database.ts` with new/changed table types
- Copy changes to `mobile/src/types/database.ts`

### 4. Backend API (if complex logic needed)
- Create/update router in `backend/routers/`
- Create/update Pydantic models in `backend/models/`
- Create/update service logic in `backend/services/`
- Add router to `backend/main.py`
- Test endpoint with curl or API client

### 5. Web UI
- Create page in `web/src/app/(dashboard)/<module>/page.tsx`
- Create form components in `web/src/components/forms/`
- Create any chart components in `web/src/components/charts/`
- Add custom hooks in `web/src/hooks/` for data fetching
- Use Supabase client from `lib/supabase/` — never direct calls

### 6. Mobile Screen
- Create screen in `mobile/src/screens/`
- Reuse same Supabase queries (adapted for React Native)
- Test on Expo Go

### 7. Test End-to-End
- Create a new entry (CRUD operations)
- Verify data appears in Supabase dashboard
- Check real-time sync between web and mobile
- Test edge cases (empty states, validation errors)

### 8. Code Review
- Run `/code-reviewer` skill
- Fix any issues found

## Edge Cases
- **Recurring entries**: Set up Supabase Edge Function or cron job
- **Cross-module links**: Ensure FK references are valid before insert
- **Offline mobile**: Queue operations for sync when back online (future enhancement)
