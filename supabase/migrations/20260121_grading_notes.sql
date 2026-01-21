-- Grading notes (per question) for all_LEET

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Per-question notes, stored separately from grading history
-- -----------------------------------------------------------------------------
create table if not exists public.grading_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_timestamp bigint not null,
  year text not null,
  exam_type text not null check (exam_type in ('odd', 'even')),
  subject text not null check (subject in ('verbal', 'reasoning')),
  question_no integer not null check (question_no >= 1),
  content text not null default '' check (char_length(content) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grading_notes_unique_attempt_question
on public.grading_notes (user_id, group_timestamp, subject, question_no);

create index if not exists grading_notes_attempt_lookup
on public.grading_notes (user_id, group_timestamp);

alter table public.grading_notes enable row level security;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'grading_notes_set_updated_at'
      and tgrelid = 'public.grading_notes'::regclass
  ) then
    create trigger grading_notes_set_updated_at
    before update on public.grading_notes
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

-- RLS policies: only the owner can read/write

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grading_notes'
      and policyname = 'grading_notes_select_own'
  ) then
    create policy "grading_notes_select_own"
    on public.grading_notes
    for select
    using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grading_notes'
      and policyname = 'grading_notes_insert_own'
  ) then
    create policy "grading_notes_insert_own"
    on public.grading_notes
    for insert
    with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grading_notes'
      and policyname = 'grading_notes_update_own'
  ) then
    create policy "grading_notes_update_own"
    on public.grading_notes
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'grading_notes'
      and policyname = 'grading_notes_delete_own'
  ) then
    create policy "grading_notes_delete_own"
    on public.grading_notes
    for delete
    using (auth.uid() = user_id);
  end if;
end $$;
