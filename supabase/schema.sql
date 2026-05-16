-- Habla — Supabase schema.
-- Paste this into the Supabase SQL editor and run once.
--
-- Notes:
--   - Both tables reference auth.users with ON DELETE CASCADE, so a user
--     deleting their account also removes their progress.
--   - Card content (es / en / note) is NOT stored server-side — only the
--     chunk id and SRS state. The front-end joins by id against bundled
--     content in src/content/. Smaller DB, no migrations when content changes.
--   - Row-level security restricts every row to its owning user.

create table if not exists public.profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  active_language      text not null default 'es',
  streak_count         int  not null default 0,
  last_activity_date   date,
  completed_lesson_ids text[] not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.cards (
  user_id          uuid not null references auth.users(id) on delete cascade,
  card_id          text not null,
  state            text not null,
  ease             numeric not null default 2.5,
  interval_days    int not null default 0,
  due_at           timestamptz not null,
  reps             int not null default 0,
  lapses           int not null default 0,
  last_reviewed_at timestamptz,
  added_at         timestamptz not null,
  primary key (user_id, card_id)
);

create index if not exists cards_user_due_idx on public.cards (user_id, due_at);

-- Keep updated_at fresh on profile writes.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Row-level security: users can only touch their own rows.
alter table public.profiles enable row level security;
alter table public.cards    enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_self_modify" on public.profiles;
drop policy if exists "cards_self_select"    on public.cards;
drop policy if exists "cards_self_modify"    on public.cards;

create policy "profiles_self_select"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_self_modify"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cards_self_select"
  on public.cards for select
  using (auth.uid() = user_id);

create policy "cards_self_modify"
  on public.cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
