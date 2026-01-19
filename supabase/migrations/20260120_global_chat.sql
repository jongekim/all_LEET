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

-- -----------------------------------------------------------------------------
-- Rate limiting (DB-enforced): max 2 messages per 1 second per user
-- -----------------------------------------------------------------------------
create table if not exists public.chat_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  window_count integer not null
);

-- Block direct client access (trigger-owned table)
alter table public.chat_rate_limits enable row level security;

create or replace function public.enforce_chat_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  loop
    select window_start, window_count
      into v_window_start, v_count
    from public.chat_rate_limits
    where user_id = new.user_id
    for update;

    if found then
      if v_now - v_window_start < interval '1 second' then
        if v_count >= 2 then
          raise exception 'rate_limited'
            using errcode = 'P0001',
                  detail = 'max 2 messages per second';
        end if;

        update public.chat_rate_limits
          set window_count = v_count + 1
        where user_id = new.user_id;
      else
        update public.chat_rate_limits
          set window_start = v_now,
              window_count = 1
        where user_id = new.user_id;
      end if;

      exit;
    else
      begin
        insert into public.chat_rate_limits (user_id, window_start, window_count)
        values (new.user_id, v_now, 1);
        exit;
      exception
        when unique_violation then
          -- concurrent first insert; retry
      end;
    end if;
  end loop;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'chat_messages_rate_limit'
      and tgrelid = 'public.chat_messages'::regclass
  ) then
    create trigger chat_messages_rate_limit
    before insert on public.chat_messages
    for each row
    execute function public.enforce_chat_rate_limit();
  end if;
end $$;
