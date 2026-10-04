begin;

-- Validation is shared by the CHECK constraint and isolated regression tests.
create function private.exam_schedule_valid_template(value text)
returns boolean
language sql immutable security invoker
set search_path = ''
as $$
  select value is not null
    and char_length(value) between 1 and 100
    -- ECMAScript trim whitespace, excluding control characters rejected below.
    and value = btrim(value, ' ' || chr(160) || chr(5760) || chr(8192) || chr(8193)
      || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199)
      || chr(8200) || chr(8201) || chr(8202) || chr(8239) || chr(8287) || chr(12288) || chr(65279))
    and not exists (select 1 from generate_series(1,char_length(value)) as positions(i)
      where ascii(substr(value,i,1)) between 1 and 31
        or ascii(substr(value,i,1)) between 127 and 159
        or ascii(substr(value,i,1)) in (8232,8233))
    and replace(replace(value,'{date}',''),'{dday}','') !~ '[{}]';
$$;
revoke all on function private.exam_schedule_valid_template(text) from public, anon;
grant execute on function private.exam_schedule_valid_template(text) to authenticated;

create table public.exam_schedule (
  key text primary key check (key = 'leet'),
  exam_date date not null check (exam_date between date '2000-01-01' and date '2099-12-31'),
  display_template text not null check (private.exam_schedule_valid_template(display_template)),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.exam_schedule enable row level security;
revoke all on table public.exam_schedule from public, anon, authenticated;
grant select on table public.exam_schedule to anon, authenticated;
grant update (exam_date,display_template) on table public.exam_schedule to authenticated;

create policy exam_schedule_public_read on public.exam_schedule
for select to anon, authenticated using (true);
create policy exam_schedule_admin_update on public.exam_schedule
for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create function private.exam_schedule_update_revision()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if new.exam_date is distinct from old.exam_date or new.display_template is distinct from old.display_template then
    new.revision := old.revision + 1;
    new.updated_at := now();
  else
    new.revision := old.revision;
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;
revoke all on function private.exam_schedule_update_revision() from public, anon, authenticated;
create trigger exam_schedule_update_revision before update on public.exam_schedule
for each row execute function private.exam_schedule_update_revision();

insert into public.exam_schedule (key,exam_date,display_template)
values ('leet','2026-07-19','{date} 시험일 {dday}');

commit;
