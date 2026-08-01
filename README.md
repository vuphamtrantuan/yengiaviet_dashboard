# TaskFlow

A Trello-like task management app: **Kanban boards** with **lists** and drag-and-drop **cards**.

> Repository was originally named `ecom-sale-planner`; the product scope is a task/Kanban board manager.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Prisma](https://www.prisma.io/) ORM with a local **SQLite** database
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) for drag-and-drop
- [Vitest](https://vitest.dev/) for unit tests, ESLint (`next lint`) for linting

## Getting started

```bash
npm install            # install dependencies
npm run db:generate    # generate the Prisma client
npm run db:push        # create the SQLite schema (prisma/dev.db)
npm run db:seed        # (optional) add a demo board
npm run dev            # start the dev server on http://localhost:3000
```

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint with ESLint (`next lint`) |
| `npm run typecheck` | TypeScript type-check (no emit) |
| `npm run test` | Run Vitest unit tests |
| `npm run db:push` | Sync the Prisma schema to SQLite |
| `npm run db:seed` | Seed a demo board |
| `npm run db:reset` | Drop and recreate the database |

## Data model

- **Board** → has many **Lists** → each has many **Cards**.
- Cards and lists are ordered by an integer `position`; drag-and-drop recomputes
  dense sequential positions on the server (see `src/lib/board.ts`).

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/boards` | List / create boards |
| `GET/DELETE` | `/api/boards/:id` | Fetch full board / delete board |
| `POST` | `/api/lists` | Create a list |
| `DELETE` | `/api/lists/:id` | Delete a list |
| `POST` | `/api/cards` | Create a card |
| `PATCH/DELETE` | `/api/cards/:id` | Edit / delete a card |
| `PATCH` | `/api/cards/:id/move` | Move a card between/within lists |
