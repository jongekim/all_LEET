begin;
set local lock_timeout='5s';
-- Serialize registration/withdrawal while seeding identities and replacing FKs.
lock table auth.users in share row exclusive mode;
-- Local migration only. Keep the latest service-use timestamp after Auth deletion,
-- as explicitly requested. No Auth FK or event history.
create table private.user_last_activity (
 user_id uuid primary key,
 last_seen_at timestamptz not null
);
alter table private.user_last_activity enable row level security;
revoke all on private.user_last_activity from public,anon,authenticated;
grant select,insert,update on private.user_last_activity to service_role;
create index user_last_activity_recent_idx on private.user_last_activity(last_seen_at desc,user_id);
grant select(deleted_at) on auth.users to service_role;

-- A durable service identity prevents Auth deletion from cascading into histories.
-- Active accounts register their UUID and account dates. Withdrawal captures profile data,
-- never passwords, tokens, sessions or application authorization metadata.
create table private.user_data_member_archive (
 user_id uuid primary key,
 name text,
 email text,
 user_metadata jsonb,
 created_at timestamptz,
 confirmed_at timestamptz,
 is_deleted boolean not null default false
);
alter table private.user_data_member_archive enable row level security;
revoke all on private.user_data_member_archive from public,anon,authenticated,service_role;
grant select,update(name,user_metadata) on private.user_data_member_archive to service_role;
insert into private.user_data_member_archive(user_id,is_deleted,created_at,confirmed_at)
select id,deleted_at is not null,created_at,confirmed_at from auth.users;
-- Historical deletion can leave data without an Auth row. Register only known
-- UUIDs from existing personal stores, without inventing a name or last visit.
insert into private.user_data_member_archive(user_id,is_deleted)
select owner,true from (
 select user_id as owner from private.admission_history
 union select user_id from private.admission_save_diagnostics
 union select user_id from private.product_analytics_test_accounts
 union select user_id from private.product_usage_events
 union select user_id from private.product_member_activity_days
 union select user_id from private.product_member_first_usage
 union select user_id from private.product_usage_fact_days
 union select actor from private.user_data_audit
 union select target from private.user_data_audit
 union select actor from private.user_data_operations
 union select target from private.user_data_operations
 union select target from private.user_data_storage_cleanup
 union select admin_user_id from private.product_admin_access_logs
 union select target_user_id from private.product_admin_access_logs
 union select split_part(key,':',2)::uuid from public.kv_store_cd835c22
  where key ~ '^(history|mock_history):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 union select split_part(name,'/',1)::uuid from storage.objects
  where bucket_id='community-post-images' and split_part(name,'/',1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
) retained where owner is not null
on conflict(user_id) do nothing;

create function private.user_data_register_member()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into private.user_data_member_archive(user_id,is_deleted,created_at,confirmed_at)
 values(new.id,new.deleted_at is not null,new.created_at,new.confirmed_at);
 return new;
end $$;
revoke all on function private.user_data_register_member() from public,anon,authenticated,service_role;
create trigger user_data_register_member after insert on auth.users
for each row execute function private.user_data_register_member();

create function private.user_data_archive_deleted_member()
returns trigger language plpgsql security definer set search_path='' as $$
declare op private.user_data_operations; outcome text; outcome_code text;
begin
 if tg_op='UPDATE' and (old.deleted_at is not null or new.deleted_at is null) then return new; end if;
 -- Match commit's operation-row -> account-lock order for pending external jobs.
 perform 1 from private.user_data_operations where target=old.id and domain='account'
  and state in ('executing','unknown') order by id for update;
 perform pg_advisory_xact_lock(hashtextextended('account:'||old.id::text,0));
 if old.deleted_at is null then
  insert into private.user_data_member_archive(user_id,name,email,user_metadata,created_at,confirmed_at,is_deleted)
  values(old.id,old.raw_user_meta_data->>'name',old.email,old.raw_user_meta_data,old.created_at,old.confirmed_at,true)
  on conflict(user_id) do update set name=excluded.name,email=excluded.email,
   user_metadata=excluded.user_metadata,created_at=excluded.created_at,confirmed_at=excluded.confirmed_at,is_deleted=true
  where not private.user_data_member_archive.is_deleted;
 end if;
 -- An Auth name update can have succeeded before its response was lost. Close
 -- pending intents against the actual pre-withdrawal name; never replay them.
 for op in select * from private.user_data_operations where target=old.id and domain='account'
  and state in ('executing','unknown') order by id for update loop
  outcome=case when op.payload->>'name' is not distinct from old.raw_user_meta_data->>'name' then 'succeeded' else 'failed' end;
  outcome_code=case when outcome='succeeded' then 'WITHDRAWN_NAME_CONFIRMED' else 'ACCOUNT_WITHDRAWN' end;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status)
  values(op.actor,op.target,'account',op.action,op.id,array['name'],op.impact,outcome);
  update private.user_data_operations set state=outcome,code=outcome_code,payload='{}',finished_at=now() where id=op.id;
 end loop;
 -- Soft deletion must revoke privileges too; hard deletion retains its Auth FK.
 delete from private.admin_roles where user_id=old.id;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.user_data_archive_deleted_member() from public,anon,authenticated,service_role;
create trigger user_data_archive_deleted_member
before delete or update of deleted_at on auth.users
for each row execute function private.user_data_archive_deleted_member();

-- Only the 12 verified service-owner FKs change. Auth's own tables and the
-- admin role FK keep their normal deletion behaviour. Content graph cascades
-- still apply to an administrator's explicitly approved individual deletion.
do $$declare t text; c text; owners integer;begin
 foreach t in array array['grading_notes','chat_profiles','chat_messages','chat_rate_limits',
  'community_posts','community_comments','community_post_likes','community_comment_likes',
  'community_post_reports','community_comment_reports','home_announcement_comments','home_announcement_likes'] loop
  select count(*),min(con.conname) into owners,c from pg_constraint con
  where con.conrelid=to_regclass('public.'||t) and con.contype='f' and con.confrelid='auth.users'::regclass
   and con.conkey=array[(select attnum from pg_attribute where attrelid=con.conrelid and attname='user_id')]
   and con.confkey=array[(select attnum from pg_attribute where attrelid=con.confrelid and attname='id')];
  if owners<>1 then raise exception 'Unexpected Auth ownership constraint on %',t;end if;
  execute format('alter table public.%I drop constraint %I',t,c);
  execute format('alter table public.%I add constraint %I foreign key(user_id) references private.user_data_member_archive(user_id)',t,c);
 end loop;
end $$;

-- A deleted user's access JWT can outlive Auth deletion. Check the current
-- account, using only this request's identity, in addition to existing RLS.
create function private.user_data_active_actor()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=(select auth.uid()) and deleted_at is null)
$$;
revoke all on function private.user_data_active_actor() from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.user_data_active_actor() to authenticated;
do $$declare t text;begin
 foreach t in array array['grading_notes','chat_profiles','chat_messages','chat_rate_limits',
  'community_posts','community_comments','community_post_likes','community_comment_likes',
  'community_post_reports','community_comment_reports','home_announcement_comments','home_announcement_likes'] loop
  execute format('create policy user_data_active_account on public.%I as restrictive for all to authenticated using ((select private.user_data_active_actor())) with check ((select private.user_data_active_actor()))',t);
 end loop;
end $$;
create policy user_data_active_image_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'community-post-images' or (select private.user_data_active_actor()));
create policy user_data_active_image_update on storage.objects as restrictive for update to authenticated
using (bucket_id<>'community-post-images' or (select private.user_data_active_actor()))
with check (bucket_id<>'community-post-images' or (select private.user_data_active_actor()));
create policy user_data_active_image_delete on storage.objects as restrictive for delete to authenticated
using (bucket_id<>'community-post-images' or (select private.user_data_active_actor()));

create or replace function private.user_data_require_admin(p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from private.admin_roles r join auth.users u on u.id=r.user_id
  where r.user_id=p_actor and r.role='admin' and u.deleted_at is null) then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
end $$;

create function private.user_data_grading_count(p_records jsonb)
returns integer language plpgsql immutable security invoker set search_path='' as $$
declare record jsonb; moment numeric; anchors numeric[]='{}';
begin
 if p_records is null then return null; end if;
 if jsonb_typeof(p_records)<>'array' then return null; end if;
 for record in select value from jsonb_array_elements(p_records) loop
  if jsonb_typeof(record)<>'object' then return null; end if;
  begin
   moment:=coalesce(nullif(record->>'groupTimestamp',''),record->>'timestamp')::numeric;
  exception when invalid_text_representation or numeric_value_out_of_range then return null;
  end;
  if moment is null or moment::text in ('NaN','Infinity','-Infinity') then return null; end if;
  -- Match HistoryPage: the first ungrouped record anchors the 1-second group.
  if not exists(select 1 from unnest(anchors) anchor where abs(moment-anchor)<1000) then
   anchors:=array_append(anchors,moment);
  end if;
 end loop;
 return cardinality(anchors);
end $$;

create function public.service_activity_touch(p_owner uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare touched integer; stamp timestamptz=clock_timestamp();
begin
 if not exists(select 1 from auth.users where id=p_owner and deleted_at is null) then raise exception 'OWNER_MISMATCH'; end if;
 insert into private.user_last_activity(user_id,last_seen_at) values(p_owner,stamp)
 on conflict(user_id) do update set last_seen_at=greatest(excluded.last_seen_at,private.user_last_activity.last_seen_at)
 where private.user_last_activity.last_seen_at <= stamp-interval '30 seconds';
 get diagnostics touched=row_count;
 return jsonb_build_object('updated',touched=1);
end $$;

create function public.user_data_members_recent(p_actor uuid,p_query text default '',p_after jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; after_id uuid; after_time timestamptz;
begin
 perform private.user_data_require_admin(p_actor);
 if p_query is null or length(p_query)>120 then raise exception 'INVALID_INPUT'; end if;
 if p_after is not null then
  if jsonb_typeof(p_after)<>'object' or not(p_after ? 'id' and p_after ? 'last_seen_at') then raise exception 'INVALID_CURSOR'; end if;
  after_id:=(p_after->>'id')::uuid; after_time:=(p_after->>'last_seen_at')::timestamptz;
  if after_id is null then raise exception 'INVALID_CURSOR'; end if;
 end if;
 with users as (
  select u.id,case when u.deleted_at is null then u.email else a.email end as email,
   case when u.deleted_at is null then u.raw_user_meta_data->>'name' else a.name end as name,u.created_at,(u.deleted_at is not null) as is_deleted
  from auth.users u left join private.user_data_member_archive a on a.user_id=u.id
  union all select a.user_id,a.email,a.name,a.created_at,true
  from private.user_data_member_archive a where not exists(select 1 from auth.users u where u.id=a.user_id)
  union all select distinct h.user_id,null::text,null::text,null::timestamptz,true
  from private.admission_history h where not exists(select 1 from auth.users u where u.id=h.user_id)
   and not exists(select 1 from private.user_data_member_archive a where a.user_id=h.user_id)
 ), selected as materialized (
  select u.*,a.last_seen_at from users u left join private.user_last_activity a on a.user_id=u.id
  where (p_query='' or position(lower(p_query) in lower(coalesce(u.email,'')||' '||coalesce(u.name,'')||' '||u.id::text))>0)
   and (p_after is null
    or (after_time is null and a.last_seen_at is null and u.id>after_id)
    or (after_time is not null and (a.last_seen_at<after_time or a.last_seen_at is null or (a.last_seen_at=after_time and u.id>after_id))))
  order by a.last_seen_at desc nulls last,u.id limit 51
 ), page as materialized (
  select * from selected order by last_seen_at desc nulls last,id limit 50
 ), summary as (
  select p.*,case when h.key is null then 0 else private.user_data_grading_count(h.value) end as grading_count,
   case when m.key is null then 0 when jsonb_typeof(m.value)='array' then jsonb_array_length(m.value) else null end as mock_count
  from page p left join public.kv_store_cd835c22 h on h.key='history:'||p.id::text
  left join public.kv_store_cd835c22 m on m.key='mock_history:'||p.id::text
 )
 select jsonb_build_object(
  'items',(select coalesce(jsonb_agg(jsonb_build_object('user_id',id,'email',email,'name',name,'created_at',created_at,
   'last_seen_at',last_seen_at,'grading_count',grading_count,'mock_count',mock_count,'is_deleted',is_deleted) order by last_seen_at desc nulls last,id),'[]'::jsonb) from summary),
  'next_cursor',case when (select count(*) from selected)>50 then
   (select jsonb_build_object('id',id,'last_seen_at',last_seen_at) from page order by last_seen_at desc nulls last,id offset 49 limit 1) end
 ) into result;
 insert into private.user_data_audit(actor,domain,action,status,impact)
 values(p_actor,'members','read','succeeded',jsonb_build_object('count',jsonb_array_length(result->'items')));
 return result;
end $$;

revoke all on function private.user_data_grading_count(jsonb),public.service_activity_touch(uuid),public.user_data_members_recent(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.user_data_grading_count(jsonb),public.service_activity_touch(uuid),public.user_data_members_recent(uuid,text,jsonb) to service_role;

-- Retained account details use the same fields and typed-approval protocol.
create or replace function public.user_data_read(p_actor uuid,p_target uuid,p_domain text,p_offset integer default 0,p_selector jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cat jsonb; items jsonb; total integer; arr jsonb; k text; result jsonb; context_rows jsonb='[]'; context_posts jsonb='[]'; context_total integer=0; context_offset integer=0;
begin
 perform private.user_data_require_admin(p_actor);
 if p_offset<0 or p_offset>1000000 then raise exception 'INVALID_INPUT';end if;
 if p_domain='account' then
  select jsonb_build_object('user_id',id,'email',email,'name',metadata->>'name','birth_date',metadata->>'birth_date','university',metadata->>'university','created_at',created_at,'confirmed_at',confirmed_at,
   '_snapshot',private.user_data_hash(jsonb_build_object('name',metadata->>'name','is_deleted',is_deleted))) into result from (
   select id,email,raw_user_meta_data as metadata,created_at,confirmed_at,false as is_deleted from auth.users where id=p_target and deleted_at is null
   union all select user_id,email,coalesce(user_metadata,'{}')||jsonb_build_object('name',name),created_at,confirmed_at,true
    from private.user_data_member_archive where user_id=p_target and is_deleted
  ) profile;
  result=jsonb_build_object('items',case when result is null then '[]'::jsonb else jsonb_build_array(result) end,'total',case when result is null then 0 else 1 end);
 elsif p_domain in ('history','mock_history','history_summary','mock_summary') then
  k=case when p_domain in ('history','history_summary') then 'history' else 'mock_history' end||':'||p_target::text;
  select value into arr from public.kv_store_cd835c22 where key=k;arr=coalesce(arr,'[]');
  if jsonb_typeof(arr)<>'array' then raise exception 'INVALID_HISTORY';end if;
  if p_domain in ('history_summary','mock_summary') then
   select coalesce(jsonb_agg(jsonb_build_object('index',ord-1,'record',x-'userAnswers'-'correctAnswers'-'fieldAnalysis')),'[]') into items from jsonb_array_elements(arr) with ordinality e(x,ord);
  elsif p_selector is not null then
   if p_selector->>'snapshot'<>private.user_data_hash(arr) then raise exception 'CONFLICT';end if;
   select coalesce(jsonb_agg(jsonb_build_object('index',ord-1,'record',x)),'[]') into items from jsonb_array_elements(arr) with ordinality e(x,ord) where (ord-1) in (select value::int from jsonb_array_elements_text(p_selector->'indices'));
  else
   select coalesce(jsonb_agg(jsonb_build_object('index',ord-1,'record',x-'userAnswers'-'correctAnswers'-'fieldAnalysis')),'[]') into items from jsonb_array_elements(arr) with ordinality e(x,ord) where ord>p_offset and ord<=p_offset+50;
  end if;
  result=jsonb_build_object('items',items,'total',jsonb_array_length(arr),'snapshot',private.user_data_hash(arr),'next_offset',case when p_selector is null and p_domain not like '%summary' and jsonb_array_length(arr)>p_offset+50 then p_offset+50 end);
 elsif p_domain='audit' then
  with records as (
   select to_jsonb(t) as record,t.created_at as at from private.user_data_audit t where target=p_target or actor=p_target
   union all select jsonb_build_object('id',id,'actor',admin_user_id,'target',target_user_id,'domain','analytics','action',kind,'created_at',received_at,'status',status,'impact',jsonb_build_object('count',returned_count),'filters',filters),received_at from private.product_admin_access_logs where target_user_id=p_target or admin_user_id=p_target or filters->'target_user_ids' ? p_target::text)
  select coalesce(jsonb_agg(record),'[]') into items from (select record from records order by at desc offset p_offset limit 50) q;
  select (select count(*) from private.user_data_audit where target=p_target or actor=p_target)+(select count(*) from private.product_admin_access_logs where target_user_id=p_target or admin_user_id=p_target or filters->'target_user_ids' ? p_target::text) into total;
  result=jsonb_build_object('items',items,'total',total,'next_offset',case when total>p_offset+50 then p_offset+50 end);
 elsif p_domain='storage_images' then
  select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('_snapshot',private.user_data_hash(to_jsonb(t)))),'[]') into items from (select id,bucket_id,name,created_at,updated_at,version,jsonb_build_object('size',metadata->'size','mimetype',metadata->'mimetype') as metadata from storage.objects where bucket_id='community-post-images' and split_part(name,'/',1)=p_target::text and (p_selector is null or id::text=p_selector->>'id') order by created_at desc,id offset p_offset limit 50) t;
  select count(*) into total from storage.objects where bucket_id='community-post-images' and split_part(name,'/',1)=p_target::text;
  result=jsonb_build_object('items',items,'total',total,'readonly',p_domain<>'storage_images','next_offset',case when total>p_offset+50 then p_offset+50 end);
 elsif p_domain='usage_sessions' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]') into items from (select s.session_id,s.page_instance_id,s.last_activity_received_at,s.activity_sequence,s.uncertain_reason from private.product_usage_session_state s where exists(select 1 from private.product_usage_events e where e.user_id=p_target and e.session_id=s.session_id and e.page_instance_id=s.page_instance_id) order by s.last_activity_received_at desc offset p_offset limit 50) t;
  select count(*) into total from private.product_usage_session_state s where exists(select 1 from private.product_usage_events e where e.user_id=p_target and e.session_id=s.session_id and e.page_instance_id=s.page_instance_id);
  result=jsonb_build_object('items',items,'total',total,'readonly',p_domain<>'storage_images','next_offset',case when total>p_offset+50 then p_offset+50 end);
 else
  cat=private.user_data_catalog(p_domain);if cat is null then raise exception 'INVALID_DOMAIN';end if;
  execute format('select count(*) from %s where user_id=$1',cat->>'table') into total using p_target;
  execute format('select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object(''_snapshot'',private.user_data_hash(to_jsonb(s)))),''[]'') from (select * from %s where user_id=$1 order by %I desc offset $2 limit 50) s',cat->>'table',cat->>'key') into items using p_target,p_offset;
  if p_selector is not null then
   execute format('select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object(''_snapshot'',private.user_data_hash(to_jsonb(s)))),''[]'') from (select * from %s where user_id=$1 and %I::text=$2) s',cat->>'table',cat->>'key') into items using p_target,p_selector->>'id';
  end if;
  if p_selector is not null and p_domain in ('posts','comments','post_likes','post_reports','comment_likes','comment_reports') then
   context_offset=coalesce((p_selector->>'context_offset')::int,0);
   if context_offset<0 or context_offset>1000000 then raise exception 'INVALID_INPUT';end if;
   select coalesce(jsonb_agg(to_jsonb(p)),'[]') into context_posts from public.community_posts p where p.id in (
    select (v->>'id')::uuid from jsonb_array_elements(items) v where p_domain='posts'
    union select (v->>'post_id')::uuid from jsonb_array_elements(items) v where p_domain in ('comments','post_likes','post_reports')
    union select co.post_id from public.community_comments co join jsonb_array_elements(items) v on co.id::text=v->>'comment_id' where p_domain in ('comment_likes','comment_reports'));
   select count(*) into context_total from public.community_comments c where c.post_id in (select (p->>'id')::uuid from jsonb_array_elements(context_posts) p);
   select coalesce(jsonb_agg(to_jsonb(c)),'[]') into context_rows from (select * from public.community_comments where post_id in (select (p->>'id')::uuid from jsonb_array_elements(context_posts) p) order by created_at,id offset context_offset limit 50) c;
  elsif p_domain='chat' and p_selector is not null then
   select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]') into context_rows from (select * from public.chat_messages where room_id=(items->0->>'room_id') and created_at between (items->0->>'created_at')::timestamptz-interval '5 minutes' and (items->0->>'created_at')::timestamptz+interval '5 minutes' order by abs(extract(epoch from created_at-(items->0->>'created_at')::timestamptz)) limit 100) c;
  end if;
  result=jsonb_build_object('items',items,'total',total,'edit',cat->'edit','readonly',coalesce(cat->'readonly','false'),'context',context_rows,'context_posts',context_posts,'context_total',context_total,'context_offset',context_offset,'context_next_offset',case when context_total>context_offset+50 then context_offset+50 end,'next_offset',case when total>p_offset+50 then p_offset+50 end);
 end if;
 insert into private.user_data_audit(actor,target,domain,action,status,impact) values(p_actor,p_target,p_domain,'read','succeeded',jsonb_build_object('count',jsonb_array_length(result->'items')));
 return result;
end $$;

create or replace function private.user_data_state(p_target uuid,p_domain text,p_selector jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare k text; arr jsonb; selected jsonb; cat jsonb; row_data jsonb; children jsonb='{}';
begin
 if p_domain in ('history','mock_history') then
  k=p_domain||':'||p_target::text;perform pg_advisory_xact_lock(hashtextextended(k,0));
  if p_domain='history' then perform pg_advisory_xact_lock(hashtextextended('user_data_graph:notes',0));end if;
  select value into arr from public.kv_store_cd835c22 where key=k;arr=coalesce(arr,'[]');
  if p_selector->>'all'='true' then p_selector=p_selector||jsonb_build_object('indices',(select coalesce(jsonb_agg(i),'[]') from generate_series(0,jsonb_array_length(arr)-1) i));end if;
  if jsonb_typeof(arr)<>'array' or jsonb_typeof(p_selector->'indices')<>'array' or jsonb_array_length(p_selector->'indices')=0 then raise exception 'INVALID_SELECTOR';end if;
  select coalesce(jsonb_agg(jsonb_build_object('index',ord-1,'record',x) order by ord),'[]') into selected from jsonb_array_elements(arr) with ordinality e(x,ord) where (ord-1) in (select value::int from jsonb_array_elements_text(p_selector->'indices'));
  if jsonb_array_length(selected)<>jsonb_array_length(p_selector->'indices') then raise exception 'CONFLICT';end if;
  if p_domain='history' then
   select jsonb_build_object('notes',coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]')) into children from public.grading_notes n where n.user_id=p_target and exists(select 1 from jsonb_array_elements(selected) s where n.group_timestamp=coalesce((s->'record'->>'groupTimestamp')::bigint,(s->'record'->>'timestamp')::bigint) and n.subject=s->'record'->>'subject');
  end if;
  return jsonb_build_object('array',arr,'selected',selected,'children',children);
 elsif p_domain='storage_images' then
  perform pg_advisory_xact_lock(hashtextextended('user_data_graph:community',0));
  select jsonb_build_object('id',id,'bucket_id',bucket_id,'name',name,'created_at',created_at,'updated_at',updated_at,'version',version,'metadata',jsonb_build_object('size',metadata->'size','mimetype',metadata->'mimetype')) into row_data from storage.objects where id=(p_selector->>'id')::uuid and bucket_id='community-post-images' and split_part(name,'/',1)=p_target::text;
  if row_data is null then raise exception 'NOT_FOUND';end if;
  if exists(select 1 from public.community_posts where image_urls @> array[p_selector->>'url']) then raise exception 'FILE_IN_USE';end if;
  return jsonb_build_object('row',row_data,'children',children);
 elsif p_domain='account' then
  perform pg_advisory_xact_lock(hashtextextended('account:'||p_target::text,0));
  select jsonb_build_object('name',raw_user_meta_data->>'name','is_deleted',false) into row_data from auth.users where id=p_target and deleted_at is null;
  if row_data is null then
   select jsonb_build_object('name',name,'is_deleted',true) into row_data from private.user_data_member_archive where user_id=p_target and is_deleted;
  end if;
  if row_data is null then raise exception 'NOT_FOUND';end if;
  return jsonb_build_object('row',row_data,'children',children);
 end if;
 cat=private.user_data_catalog(p_domain);
 if cat is null or coalesce((cat->>'readonly')::boolean,false) then raise exception 'INVALID_DOMAIN';end if;
 if p_domain in ('posts','comments','post_likes','post_reports','comment_likes','comment_reports') then
  perform pg_advisory_xact_lock(hashtextextended('user_data_graph:community',0));
 elsif p_domain='profile' then
  perform pg_advisory_xact_lock(hashtextextended('user_data_graph:chat',0));
 elsif p_domain='admission' then
  perform pg_advisory_xact_lock(hashtextextended('admission:'||(p_selector->>'id'),0));

 elsif p_domain='usage' then
  perform pg_advisory_xact_lock(hashtextextended('user_data_analytics',0));
 elsif p_domain='notes' then perform pg_advisory_xact_lock(hashtextextended('user_data_graph:notes',0));
 elsif p_domain in ('announcement_comments','announcement_likes') then perform pg_advisory_xact_lock(hashtextextended('user_data_graph:announcements',0));end if;
 execute format('select to_jsonb(t) from %s t where user_id=$1 and %I::text=$2',cat->>'table',cat->>'key') into row_data using p_target,p_selector->>'id';
 if row_data is null then raise exception 'NOT_FOUND';end if;
 if p_domain='posts' then
  children=jsonb_build_object(
   'comments',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.community_comments t where post_id=(row_data->>'id')::uuid),
   'post_likes',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from public.community_post_likes t where post_id=(row_data->>'id')::uuid),
   'post_reports',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from public.community_post_reports t where post_id=(row_data->>'id')::uuid),
   'comment_likes',(select coalesce(jsonb_agg(to_jsonb(t) order by comment_id,user_id),'[]') from public.community_comment_likes t where comment_id in (select id from public.community_comments where post_id=(row_data->>'id')::uuid)),
   'comment_reports',(select coalesce(jsonb_agg(to_jsonb(t) order by comment_id,user_id),'[]') from public.community_comment_reports t where comment_id in (select id from public.community_comments where post_id=(row_data->>'id')::uuid)),
   'images',to_jsonb(coalesce((select image_urls from public.community_posts where id=(row_data->>'id')::uuid),'{}')));
 elsif p_domain='comments' then
  children=jsonb_build_object(
   'comment_likes',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from public.community_comment_likes t where comment_id=(row_data->>'id')::uuid),
   'comment_reports',(select coalesce(jsonb_agg(to_jsonb(t) order by user_id),'[]') from public.community_comment_reports t where comment_id=(row_data->>'id')::uuid));
 elsif p_domain='usage' then
  children=jsonb_build_object(
   'activity_days',(select coalesce(jsonb_agg(to_jsonb(t) order by feature,execution_channel,os_family,device_class),'[]') from private.product_member_activity_days t where user_id=p_target and day=((row_data->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date),
   'usage_facts',(select coalesce(jsonb_agg(to_jsonb(t) order by actor_scope,session_id,execution_channel,feature,event_name,grading_run_id),'[]') from private.product_usage_fact_days t where user_id=p_target and day=((row_data->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date),
   'first_usage',(select coalesce(jsonb_agg(to_jsonb(t) order by metric_version),'[]') from private.product_member_first_usage t where user_id=p_target),
   'publications',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from private.product_usage_day_publications t where day=((row_data->>'received_at')::timestamptz at time zone 'Asia/Seoul')::date));
 elsif p_domain='profile' then
  children=jsonb_build_object('chat',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname) order by id),'[]') from public.chat_messages where user_id=p_target));
 end if;
 return jsonb_build_object('row',row_data,'children',children);
end $$;

create or replace function public.user_data_commit(p_actor uuid,p_operation uuid,p_approval text,p_finalize_images boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare op private.user_data_operations;s jsonb;cat jsonb;arr jsonb;assignments text;fields text[];u text;upload_intent jsonb;
begin
 perform private.user_data_require_admin(p_actor);
 select * into op from private.user_data_operations where id=p_operation and actor=p_actor for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if op.state<>'prepared' and not (jsonb_array_length(op.uploads)>0 and op.state in ('executing','unknown')) then return jsonb_build_object('operation_id',op.id,'state',op.state,'code',op.code);end if;
 if p_approval is distinct from '승인' then raise exception 'APPROVAL_REQUIRED';end if;
 if op.state='prepared' and op.expires_at<now() then update private.user_data_operations set state='failed',code='EXPIRED',payload='{}',finished_at=now() where id=op.id;return jsonb_build_object('operation_id',op.id,'state','failed','code','EXPIRED');end if;
 begin s=private.user_data_state(op.target,op.domain,op.selector);exception when others then
  if jsonb_array_length(op.uploads)=0 or op.state='prepared' then raise;end if;
  s=null;
 end;
 if s is null or private.user_data_hash(s)<>op.snapshot then
  update private.user_data_operations set state='conflict',code='CONFLICT',payload='{}',finished_at=now() where id=op.id;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,op.impact,'conflict');
  if jsonb_array_length(op.uploads)>0 and op.state<>'prepared' then for upload_intent in select value from jsonb_array_elements(op.uploads) loop insert into private.user_data_storage_cleanup(operation_id,url,target) values(op.id,upload_intent->>'url',op.target) on conflict do nothing;end loop;end if;
  return jsonb_build_object('operation_id',op.id,'state','conflict','code','CONFLICT','cleanup',jsonb_array_length(op.uploads)>0 and op.state<>'prepared');
 end if;
 fields=array(select jsonb_object_keys(op.payload));
 if jsonb_array_length(op.uploads)>0 and not p_finalize_images then
  if op.state='prepared' then
   update private.user_data_operations set state='executing' where id=op.id;
   insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,fields,op.impact,'executing');
  end if;
  return jsonb_build_object('operation_id',op.id,'state','executing','domain','posts','external','post_images','target',op.target,'uploads',op.uploads);
 end if;
 if op.domain='account' then
  if exists(select 1 from private.user_data_operations where target=op.target and domain='account' and state in ('executing','unknown') and id<>op.id) then raise exception 'INVALID_STATE';end if;
  if (s->'row'->>'is_deleted')::boolean then
   -- A retained profile name is an internal, atomic approval operation.
   update private.user_data_member_archive set name=op.payload->>'name',
    user_metadata=coalesce(user_metadata,'{}')||op.payload where user_id=op.target and is_deleted;
  else
  -- Durable intent before calling Auth. A replay never re-executes this operation.
  update private.user_data_operations set state='executing' where id=op.id;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,fields,op.impact,'executing');
  return jsonb_build_object('operation_id',op.id,'state','executing','external',true,'target',op.target,'payload',op.payload);
  end if;
 elsif op.domain in ('history','mock_history') then
  if op.action='delete' then
   if op.domain='history' then delete from public.grading_notes where user_id=op.target and id in(select (n->>'id')::uuid from jsonb_array_elements(s->'children'->'notes') n);end if;
   select coalesce(jsonb_agg(x order by ord),'[]') into arr from jsonb_array_elements(s->'array') with ordinality e(x,ord) where (ord-1) not in(select (v->>'index')::int from jsonb_array_elements(s->'selected') v);
  else
   select jsonb_agg(case when ord-1=(op.selector->'indices'->>0)::int then x||op.payload else x end order by ord) into arr from jsonb_array_elements(s->'array') with ordinality e(x,ord);
  end if;
  update public.kv_store_cd835c22 set value=arr where key=op.domain||':'||op.target::text;
 elsif op.domain='storage_images' then
  insert into private.user_data_storage_cleanup(operation_id,url,target) values(op.id,op.selector->>'url',op.target) on conflict do nothing;
 elsif op.domain='usage' then perform private.user_data_delete_usage(op.target,(op.selector->>'id')::uuid);
 else
  cat=private.user_data_catalog(op.domain);
  if op.domain='admission' then insert into private.user_data_tombstones values('admission',private.user_data_hash(to_jsonb(op.selector->>'id')),now()) on conflict do nothing;end if;
  if op.action='delete' then
   if op.domain='posts' then
    for u in select jsonb_array_elements_text(s->'children'->'images') loop if not exists(select 1 from public.community_posts where id<>(op.selector->>'id')::uuid and image_urls @> array[u]) then insert into private.user_data_storage_cleanup(operation_id,url,target) values(op.id,u,op.target) on conflict do nothing;end if;end loop;
   end if;
   execute format('delete from %s where user_id=$1 and %I::text=$2',cat->>'table',cat->>'key') using op.target,op.selector->>'id';
  else
   select string_agg(format('%I=(jsonb_populate_record(null::%s,$3)).%I',field,cat->>'table',field),',') into assignments from unnest(fields) field;
   if op.domain='admission' then assignments=assignments||',updated_at=now()';end if;
   execute format('update %s set %s where user_id=$1 and %I::text=$2',cat->>'table',assignments,cat->>'key') using op.target,op.selector->>'id',op.payload;
   if op.domain='posts' and op.payload ? 'image_urls' then
    for u in select jsonb_array_elements_text(s->'row'->'image_urls') loop
     if not op.payload->'image_urls' ? u and not exists(select 1 from public.community_posts where image_urls @> array[u]) then insert into private.user_data_storage_cleanup(operation_id,url,target) values(op.id,u,op.target) on conflict do nothing;end if;
    end loop;
   end if;
   if op.domain='profile' then update public.chat_messages set nickname=op.payload->>'nickname' where user_id=op.target;end if;
  end if;
 end if;
 insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,fields,op.impact,'succeeded');
 update private.user_data_operations set state=case when exists(select 1 from private.user_data_storage_cleanup where operation_id=op.id) then 'partial' else 'succeeded' end,payload='{}',finished_at=now() where id=op.id;
 return jsonb_build_object('operation_id',op.id,'state',(select state from private.user_data_operations where id=op.id));
end $$;

-- Authenticated owner writes may not revive a withdrawn account. Anonymous
-- analytics ingestion retains its existing behaviour. Admin edits use their
-- separate, typed-approval commit path.
create or replace function public.user_history_mutate(p_owner uuid,p_kind text,p_action text,p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare k text; arr jsonb; result jsonb; max_round integer;
begin
 if not exists(select 1 from auth.users where id=p_owner and deleted_at is null) then raise exception 'OWNER_MISMATCH';end if;
 if p_kind not in ('history','mock_history') or p_action not in ('append','clear','delete') then raise exception 'INVALID_INPUT';end if;
 k=p_kind||':'||p_owner::text;
 perform pg_advisory_xact_lock(hashtextextended(k,0));
 select value into arr from public.kv_store_cd835c22 where key=k;
 arr=coalesce(arr,'[]');if jsonb_typeof(arr)<>'array' then raise exception 'INVALID_HISTORY';end if;
 if p_action='append' then
  if jsonb_typeof(p_input)<>'object' then raise exception 'INVALID_INPUT';end if;
  if p_kind='history' then
   select coalesce(max(coalesce((x->>'round')::int,1)),0) into max_round from jsonb_array_elements(arr) x where x->>'year'=p_input->>'year' and x->>'subject'=p_input->>'subject';
   result=p_input||jsonb_build_object('round',max_round+1,'timestamp',floor(extract(epoch from clock_timestamp())*1000),'groupTimestamp',case when jsonb_typeof(p_input->'groupTimestamp')='number' then p_input->'groupTimestamp' else p_input->'timestamp' end);
  else
   result=p_input||jsonb_build_object('id',case when jsonb_typeof(p_input->'id')='string' then p_input->>'id' else gen_random_uuid()::text end,'createdAt',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  arr=arr||jsonb_build_array(result);
 elsif p_action='clear' then arr='[]';
 elsif p_kind='history' then
  select coalesce(jsonb_agg(x order by ord),'[]') into arr from jsonb_array_elements(arr) with ordinality as e(x,ord) where x->>'timestamp' is distinct from p_input->>'timestamp';
 else
  select coalesce(jsonb_agg(x order by ord),'[]') into arr from jsonb_array_elements(arr) with ordinality as e(x,ord) where x->>'id' is distinct from p_input->>'id';
 end if;
 insert into public.kv_store_cd835c22 values(k,arr) on conflict(key) do update set value=excluded.value;
 return coalesce(result,'{}');
end $$;

create or replace function public.admission_execution_save(p_owner uuid,p_execution uuid,p_input jsonb,p_analyses jsonb,p_version text,p_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from auth.users where id=p_owner and deleted_at is null) then raise exception 'OWNER_MISMATCH';end if;
 perform pg_advisory_xact_lock(hashtextextended('admission:'||p_execution::text,0));
 if p_code is not null then
  insert into private.admission_save_diagnostics(execution_id,user_id,code) values(p_execution,p_owner,p_code) on conflict(execution_id) do update set code=excluded.code,updated_at=now() where private.admission_save_diagnostics.user_id=p_owner;
  return jsonb_build_object('state','observed_failure');
 end if;
 if exists(select 1 from private.user_data_tombstones where domain='admission' and key_hash=private.user_data_hash(to_jsonb(p_execution::text))) then return jsonb_build_object('state','administratively_changed');end if;
 if exists(select 1 from private.admission_history where execution_id=p_execution and user_id<>p_owner) then raise exception 'OWNER_MISMATCH';end if;
 insert into private.admission_history(execution_id,user_id,input,analyses,rules_version) values(p_execution,p_owner,p_input,p_analyses,p_version) on conflict do nothing;
 delete from private.admission_save_diagnostics where execution_id=p_execution and user_id=p_owner;
 return jsonb_build_object('state','saved');
end $$;

create or replace function public.product_analytics_ingest(p_user_id uuid,p_events jsonb,p_actor_key text,p_rejected integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 if p_user_id is not null and not exists(select 1 from auth.users where id=p_user_id and deleted_at is null) then raise exception 'OWNER_MISMATCH';end if;
 perform pg_advisory_xact_lock(hashtextextended('user_data_analytics',0));
 return public.product_analytics_ingest_v1(p_user_id,p_events,p_actor_key,p_rejected);
end $$;

create or replace function public.user_data_operation(p_actor uuid,p_operation uuid,p_finalize text default null,p_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$declare op private.user_data_operations;begin
 perform private.user_data_require_admin(p_actor);
 select * into op from private.user_data_operations where id=p_operation and actor=p_actor for update;
 if not found then raise exception 'NOT_FOUND';end if;
 -- A late Auth response must not overwrite withdrawal's verified outcome.
 if op.domain='account' and op.state in ('succeeded','failed')
  and op.code in ('WITHDRAWN_NAME_CONFIRMED','ACCOUNT_WITHDRAWN') then p_finalize=null;end if;
 if p_finalize is not null then
  if (op.domain<>'account' and not (op.domain='posts' and jsonb_array_length(op.uploads)>0 and p_finalize='unknown')) or op.state not in ('executing','unknown') or p_finalize not in ('succeeded','failed','unknown') then raise exception 'INVALID_STATE';end if;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,op.impact,p_finalize);
  update private.user_data_operations set state=p_finalize,code=p_code,payload=case when p_finalize='unknown' then payload else '{}'::jsonb end,finished_at=now() where id=op.id returning * into op;
 end if;
 return jsonb_build_object('operation_id',op.id,'state',op.state,'domain',op.domain,'target',op.target,'payload',case when op.state in ('prepared','executing','unknown') then op.payload else '{}'::jsonb end,'code',op.code,'impact',op.impact,'uploads',op.uploads,'rules_version',op.rules_version);
end $$;

commit;
