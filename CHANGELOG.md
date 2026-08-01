# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Initial scaffold of **TaskFlow**, a Trello-like Kanban task manager.
- **Tech stack**: Next.js 14 (App Router), React 18, TypeScript, Prisma + SQLite,
  Tailwind CSS, `@hello-pangea/dnd`, Vitest.
- **Data model** (`prisma/schema.prisma`): `Board` → `List` → `Card`, ordered by
  integer `position`.
- **Pages**: home board list (`/`) with board creation; board view
  (`/boards/[boardId]`) with lists, cards, and drag-and-drop.
- **API routes** for boards, lists, cards, and card moves under `src/app/api/*`.
- **Pure ordering helpers** (`src/lib/board.ts`) with Vitest coverage
  (`src/lib/board.test.ts`).
- New-board creation auto-seeds the classic **To Do / In Progress / Done** lists.
- `prisma/seed.ts` demo board seed (idempotent).
- Project tooling: ESLint (`next lint`), TypeScript config, Tailwind/PostCSS
  config, Vitest config.
- Documentation: `README.md` (setup + scripts) and `AGENTS.md` (cloud dev notes).
- Supabase SQL schema at `supabase/schema.sql` with `boards`, `lists`, `cards`,
  indexes, `updated_at` triggers, and a due-date constraint.
- Card detail fields end-to-end: `assignee`, `startDate`, `dueDate` on API + UI.
- In-card edit panel (Vietnamese UI) to update task details directly from board view.

### Changed

- Migrated persistence from Prisma + SQLite to Supabase Postgres via
  `src/lib/supabase.ts` and rewritten API routes under `src/app/api/*`.
- Localized user-facing web application text to Vietnamese (`lang="vi"`,
  page labels, buttons, placeholders, empty/loading/error states).
- Updated README and AGENTS instructions for Supabase setup and Vercel deployment.
- Updated `.env` keys from `DATABASE_URL` to
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`.
- Added fail-fast Supabase placeholder validation to avoid long pending requests
  when credentials are not configured.
- Improved homepage API error handling (`try/catch` + timeout wrapper) so
  missing configuration shows explicit Vietnamese errors.

### Removed

- Removed Prisma runtime/schema/seed usage (`prisma/*`, `src/lib/prisma.ts`,
  Prisma scripts in `package.json`, and Prisma dependencies).
