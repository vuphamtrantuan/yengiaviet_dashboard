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
- Email-only authentication endpoints (`/api/auth/login`, `/api/auth/session`,
  `/api/auth/logout`) with HTTP-only session cookie.
- Board member management API (`/api/boards/:boardId/members`) to invite members by email.
- Member-aware data model in `supabase/schema.sql`: `members`, `board_members`,
  and `cards.assignee_member_id`.
- Added idempotent migration SQL to backfill the new auth/member schema on
  already-deployed Supabase projects.
- Fixed migration order in `supabase/schema.sql` so `assignee_member_id` column
  is created before index creation, preventing `column does not exist` errors.
- Popup/modal task-detail editor for create/update task flows.

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
- Board/list/card API routes now require email login and enforce board membership permissions.
- Card assignment changed from free text (`assignee`) to member-based assignment
  (`assignee_member_id` + displayed member email).
- Home page now gates board access behind email login.

### Removed

- Removed Prisma runtime/schema/seed usage (`prisma/*`, `src/lib/prisma.ts`,
  Prisma scripts in `package.json`, and Prisma dependencies).
- Removed inline in-card task detail editor in favor of popup-based details.
