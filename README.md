# Nhà Yến Vui Vẻ

A Trello-like task management app: **shared Kanban boards** with **lists**,
drag-and-drop **cards**, workspace **users**, filters, and soft **archive**.

> Repository was originally named `ecom-sale-planner` / TaskFlow; the product is
> now branded **Nhà Yến Vui Vẻ**.

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- [Supabase](https://supabase.com/) Postgres database
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) (Radix primitives)
- [TanStack Query](https://tanstack.com/query) for client data caching
- [@hello-pangea/dnd](https://github.com/hello-pangea/dnd) for drag-and-drop
- [Vitest](https://vitest.dev/) for unit tests, ESLint (`next lint`) for linting

## Getting started

```bash
npm install
npm run dev
```

### 1) Configure Supabase

Create `.env`:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Apply DB schema in Supabase SQL Editor:

- Open `supabase/schema.sql`
- Run the full script (idempotent). It adds `members.name`, `cards.archived_at`,
  `boards.archived_at`, and related indexes.

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
- Boards are **shared** across the whole workspace: any logged-in user can open
  every board.
- Boards and cards support soft archive via `archived_at` (excluded from default fetches).
- **Members** are workspace users (managed at `/users`, self-edit at `/profile`)
  and can be assigned to tasks (UI shows display name).
- Cards and lists are ordered by an integer `position`; drag-and-drop recomputes
  dense sequential positions on the server (see `src/lib/board.ts`).

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET/POST` | `/api/boards` | List active / create shared boards (`?archived=1` for archived) |
| `GET/PATCH/DELETE` | `/api/boards/:id` | Fetch / rename-archive / permanently delete |
| `GET` | `/api/boards/:id/archived` | Fetch archived cards for archive panel |
| `POST` | `/api/lists` | Create a list |
| `DELETE` | `/api/lists/:id` | Delete a list |
| `POST` | `/api/cards` | Create a card |
| `PATCH/DELETE` | `/api/cards/:id` | Edit / permanently delete a card |
| `PATCH` | `/api/cards/:id/move` | Move a card between/within lists |
| `PATCH` | `/api/cards/:id/archive` | Archive or restore a card |
| `GET/POST` | `/api/members` | List / create workspace users |
| `PATCH/DELETE` | `/api/members/:id` | Update / remove a workspace user |
| `GET/PATCH` | `/api/profile` | Read / update current user display name |
| `POST` | `/api/auth/login` | Email-only login (no password) |
| `GET` | `/api/auth/session` | Current login session |
| `POST` | `/api/auth/logout` | Logout current session |

## Authentication and users

- Every user logs in with email only (no password).
- All boards are shared; login identifies the current user (My tasks, assignees).
- Update your display name at `/profile` — assignees show **name** (email only as fallback).
- Manage workspace users at `/users` (add, rename, remove).

## Board UX

- **Rename board** from the board header pencil control.
- **Archive board** (with confirm) hides it from the home list; restore from “Bảng đã lưu trữ”.
- **Việc của tôi**: show only cards assigned to the current user.
- **Sort by due date**: ascending or descending (drag-and-drop pauses while sorted/filtered).
- **Thẻ lưu trữ**: loads archived cards in a side panel without bloating the main board query.
- Scrollbars are hidden; pages use smooth scrolling vertically and horizontally.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Set environment variables in Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Ensure `supabase/schema.sql` has been applied in your Supabase project.
5. Deploy.

The project is a standard Next.js 14 app, so no custom Vercel runtime config is required.
