# TaskFlow

A Trello-like task management app: **Kanban boards** with **lists** and drag-and-drop **cards**.

> Repository was originally named `ecom-sale-planner`; the product scope is a task/Kanban board manager.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Supabase](https://supabase.com/) Postgres database
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) for drag-and-drop
- [Vitest](https://vitest.dev/) for unit tests, ESLint (`next lint`) for linting

## Getting started

```bash
npm install            # install dependencies
npm run dev            # start the dev server on http://localhost:3000
```

### 1) Configure Supabase

Create `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Apply DB schema in Supabase SQL Editor:

- Open `supabase/schema.sql`
- Run the full script once

### 2) Start the app

```bash
npm run dev
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

## Data model

- **Board** → has many **Lists** → each has many **Cards**.
- Cards and lists are ordered by an integer `position`; drag-and-drop recomputes
  dense sequential positions on the server (see `src/lib/board.ts`).
- Card details include `assignee`, `start_date`, and `due_date`.

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

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Set environment variables in Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Ensure `supabase/schema.sql` has been applied in your Supabase project.
5. Deploy.

The project is a standard Next.js 14 app, so no custom Vercel runtime config is required.
