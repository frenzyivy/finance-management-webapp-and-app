# KomalFin — Agent Instructions

You're working on **KomalFin**, a personal finance management application. This project uses the **WAT framework** (Workflows, Agents, Tools).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (Web) | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, Zustand |
| Frontend (Mobile) | React Native / Expo, TypeScript, Victory charts |
| Backend | FastAPI (Python 3.12), Pydantic |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Hosting | Vercel (web) + VPS (API) |

## Directory Layout

```
.tmp/              # Disposable intermediates
tools/             # Python scripts for deterministic execution
workflows/         # Markdown SOPs
web/               # Next.js web application
backend/           # FastAPI backend
mobile/            # Expo React Native mobile app
supabase/          # Migrations and seed data
.env               # All secrets — NEVER store elsewhere
CLAUDE.md          # This file
FINANCE_APP_PROJECT.md  # Living project spec
```

## Coding Conventions

- **Currency:** Store as `NUMERIC(12,2)` in PostgreSQL. TypeScript type is `number`. Always display with ₹ symbol and proper formatting.
- **Dates:** Store as ISO 8601 in DB. Display in IST timezone.
- **Validation:** Use Zod schemas for all form validation on web. Pydantic models on backend.
- **Components:** Server Components by default. Client Components only for interactivity (hooks, event handlers).
- **Supabase:** All Supabase calls go through `lib/supabase/` helpers. Never call Supabase directly from components.
- **TypeScript:** Strict mode, no `any`. All entities have proper type definitions in `types/database.ts`.
- **File naming:** kebab-case for files, PascalCase for React components, snake_case for Python.
- **State management:** Zustand for client-side state. Supabase Realtime for cross-device sync.

## WAT Framework

**Workflows** (`workflows/`): Markdown SOPs defining step-by-step procedures.
**Tools** (`tools/`): Python scripts for deterministic execution (migrations, data seeding, type generation).
**Agent**: You. Read workflows, call tools, make decisions, recover from errors.

Always check `tools/` for existing scripts before building new ones. Always follow `workflows/` SOPs when they exist for a task.

## Skill Router

| Task | Skill |
|------|-------|
| New feature | `/fullstack-engineer` or `/frontend-engineer` or `/backend-engineer` |
| Bug/error | `/systematic-debugging` then `/debug-mode` |
| Code review | `/code-reviewer` |
| UI/design | `/ui-design-system` |
| Database/Supabase | Use `workflows/database_setup.md` |
| Testing | `/test-driven-development` |

## Key Rules

1. Never store secrets outside `.env`
2. Every DB table must have RLS: `auth.uid() = user_id`
3. Always reference `FINANCE_APP_PROJECT.md` for module specs and data fields
4. Update both `web/src/types/database.ts` and `mobile/src/types/database.ts` when schema changes
5. Follow the 5-phase development plan in the project spec
