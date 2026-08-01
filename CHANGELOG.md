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
