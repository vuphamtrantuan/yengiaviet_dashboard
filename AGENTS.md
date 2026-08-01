# AGENTS.md

## Project overview

**TaskFlow** is a Trello-like task management app (Kanban boards → lists → drag-and-drop cards).

- Full-stack **Next.js 14** (App Router) + React 18 + TypeScript
- **Prisma** ORM over a local **SQLite** database (`prisma/dev.db`)
- **Tailwind CSS** for styling, **@hello-pangea/dnd** for drag-and-drop
- **Vitest** unit tests; ESLint via `next lint`

Standard commands live in `package.json` scripts and are documented in `README.md`.

## Cursor Cloud specific instructions

- Single service: the Next.js app (dev server on port `3000`, `npm run dev`). There is no separate backend — API route handlers live under `src/app/api/*`.
- The SQLite DB file `prisma/dev.db` is gitignored, so it is NOT recreated by pulling the repo. It persists in the VM snapshot. On a fresh/empty database, create the schema with `npm run db:push` (and optionally `npm run db:seed` for a demo board) before running the app. `db:push` and the seed are idempotent.
- The update script only runs `npm install` and `npx prisma generate`. After changing `prisma/schema.prisma`, run `npm run db:push` yourself — the update script intentionally does not touch the database.
- The Prisma client is generated into `node_modules/@prisma/client`. If you see a "did not initialize yet" error, run `npm run db:generate`.
- `DATABASE_URL` is set in a committed `.env` (`file:./dev.db`) for local dev; no secrets are required to run the app.
- Prisma dev logging reuses a global client across hot reloads (`src/lib/prisma.ts`); this is expected and avoids connection-pool exhaustion in dev.
