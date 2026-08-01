# AGENTS.md

## Project overview

**TaskFlow** is a Trello-like task management app (Kanban boards → lists → drag-and-drop cards).

- Full-stack **Next.js 14** (App Router) + React 18 + TypeScript
- **Supabase Postgres** as the primary database (schema in `supabase/schema.sql`)
- **Tailwind CSS** for styling, **@hello-pangea/dnd** for drag-and-drop
- **Vitest** unit tests; ESLint via `next lint`

Standard commands live in `package.json` scripts and are documented in `README.md`.

## Cursor Cloud specific instructions

- Single service: the Next.js app (dev server on port `3000`, `npm run dev`). There is no separate backend — API route handlers live under `src/app/api/*`.
- The app requires two environment variables in `.env`: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Before running the app for the first time, apply `supabase/schema.sql` in Supabase SQL Editor so all tables/indexes/triggers exist.
- The API routes are server-side only and use service-role credentials via `src/lib/supabase.ts`.
