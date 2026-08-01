-- TaskFlow schema for Supabase Postgres.
-- Run this script in Supabase SQL Editor before starting the app on Vercel.

create extension if not exists "pgcrypto";

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (board_id, member_id)
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position integer not null,
  board_id uuid not null references public.boards(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_member_id uuid references public.members(id) on delete set null,
  start_date date,
  due_date date,
  position integer not null,
  list_id uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_due_after_start check (
    start_date is null
    or due_date is null
    or due_date >= start_date
  )
);

create index if not exists lists_board_id_idx on public.lists(board_id);
create index if not exists cards_list_id_idx on public.cards(list_id);
create index if not exists board_members_member_id_idx on public.board_members(member_id);
create index if not exists cards_assignee_member_id_idx on public.cards(assignee_member_id);

alter table public.cards
add column if not exists assignee_member_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cards_assignee_member_id_fkey'
      and conrelid = 'public.cards'::regclass
  ) then
    alter table public.cards
    add constraint cards_assignee_member_id_fkey
    foreign key (assignee_member_id)
    references public.members(id)
    on delete set null;
  end if;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row
execute procedure public.set_updated_at();

drop trigger if exists lists_set_updated_at on public.lists;
create trigger lists_set_updated_at
before update on public.lists
for each row
execute procedure public.set_updated_at();

drop trigger if exists cards_set_updated_at on public.cards;
create trigger cards_set_updated_at
before update on public.cards
for each row
execute procedure public.set_updated_at();

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row
execute procedure public.set_updated_at();
