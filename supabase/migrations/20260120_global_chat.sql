-- Global chat tables for all_LEET
-- Apply in Supabase SQL editor or via supabase CLI migrations.

-- Required for gen_random_uuid() on some projects
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Chat profiles (unique nickname per user)
-- -----------------------------------------------------------------------------
create table if not exists public.chat_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null unique,
  created_at timestamptz not null default now()
);

alter table public.chat_profiles enable row level security;

-- Anyone can read nicknames (needed for public chat display)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_profiles'
      and policyname = 'chat_profiles_select_all'
  ) then
    create policy "chat_profiles_select_all"
    on public.chat_profiles
    for select
    using (true);
  end if;
end $$;

-- Only the owner can create their profile
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_profiles'
      and policyname = 'chat_profiles_insert_own'
  ) then
    create policy "chat_profiles_insert_own"
    on public.chat_profiles
    for insert
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Only the owner can update their own profile
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_profiles'
      and policyname = 'chat_profiles_update_own'
  ) then
    create policy "chat_profiles_update_own"
    on public.chat_profiles
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Chat messages
-- -----------------------------------------------------------------------------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null default 'global',
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_at_idx
on public.chat_messages (room_id, created_at desc);

alter table public.chat_messages enable row level security;

-- Public read (so 홈에서도 최신 채팅을 보여줄 수 있음)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_select_all'
  ) then
    create policy "chat_messages_select_all"
    on public.chat_messages
    for select
    using (true);
  end if;
end $$;

-- Only authenticated users can insert
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_messages'
      and policyname = 'chat_messages_insert_auth'
  ) then
    create policy "chat_messages_insert_auth"
    on public.chat_messages
    for insert
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Optional: prevent updates/deletes from clients (keep immutable)
-- (No update/delete policies)
