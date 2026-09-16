-- Admin-only announcement management. Roles remain in a non-exposed schema;
-- browser clients never receive a privileged API key.
create schema if not exists private;

create table if not exists private.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'moderator')),
  created_at timestamptz not null default now()
);

alter table private.admin_roles enable row level security;

revoke all on schema private from public;
revoke all on table private.admin_roles from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- This RPC exposes only the caller's own boolean permission. The enforcement
-- remains in RLS policies below, so hiding the route cannot grant access.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.current_user_is_admin() from public, anon;
grant execute on function public.current_user_is_admin() to authenticated;

alter table public.home_announcements
  add column if not exists banner_text text not null default '' check (char_length(banner_text) <= 300),
  add column if not exists show_in_banner boolean not null default true,
  add column if not exists display_order integer not null default 0 check (display_order >= 0);

create index if not exists home_announcements_visible_banner_order_idx
  on public.home_announcements (display_order asc, created_at desc)
  where is_published = true and show_in_banner = true;

drop policy if exists home_announcements_select_admin on public.home_announcements;
create policy home_announcements_select_admin
on public.home_announcements
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists home_announcements_insert_admin on public.home_announcements;
create policy home_announcements_insert_admin
on public.home_announcements
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists home_announcements_update_admin on public.home_announcements;
create policy home_announcements_update_admin
on public.home_announcements
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists home_announcements_delete_admin on public.home_announcements;
create policy home_announcements_delete_admin
on public.home_announcements
for delete
to authenticated
using ((select private.is_admin()));
