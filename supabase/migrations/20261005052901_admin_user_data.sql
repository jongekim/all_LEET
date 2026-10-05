-- Prepared locally. Apply only together with the three Edge Function releases.
begin;
create table private.user_data_operations (
 id uuid primary key default gen_random_uuid(), actor uuid not null, target uuid not null,
 domain text not null, action text not null check(action in ('update','delete')),
 rules_version text not null default 'service-2026-10-05', selector jsonb not null, payload jsonb not null, uploads jsonb not null default '[]', snapshot text not null, impact jsonb not null,
 state text not null default 'prepared' check(state in ('prepared','executing','succeeded','failed','unknown','conflict','partial')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '10 minutes',
 finished_at timestamptz, code text
);
create index user_data_operations_actor_idx on private.user_data_operations(actor,created_at desc);
create index user_data_active_account_idx on private.user_data_operations(target) where domain='account' and state in ('executing','unknown');
create table private.user_data_audit (
 id bigint generated always as identity primary key, actor uuid not null, target uuid,
 domain text not null, action text not null, operation_id uuid, fields text[] not null default '{}',
 impact jsonb not null default '{}', status text not null, created_at timestamptz not null default now()
);
create index user_data_audit_target_idx on private.user_data_audit(target,id desc);
create index user_data_audit_actor_idx on private.user_data_audit(actor,id desc);
-- No Auth FK: explicitly requested permanent retention, including after account removal.
create table private.admission_history (
 execution_id uuid primary key, user_id uuid not null, input jsonb not null, analyses jsonb not null,
 rules_version text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index admission_history_owner_idx on private.admission_history(user_id,created_at desc,execution_id);
create table private.admission_save_diagnostics (
 execution_id uuid primary key, user_id uuid not null, code text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index admission_diagnostics_owner_idx on private.admission_save_diagnostics(user_id,created_at desc);
create table private.user_data_tombstones (
 domain text not null, key_hash text not null, created_at timestamptz not null default now(),
 primary key(domain,key_hash)
);
create table private.user_data_storage_cleanup (
 operation_id uuid not null references private.user_data_operations(id), url text not null, target uuid not null,
 state text not null default 'pending' check(state in ('pending','succeeded','failed','blocked')),
 code text, updated_at timestamptz not null default now(), primary key(operation_id,url)
);
create index user_data_cleanup_url_idx on private.user_data_storage_cleanup(url);
do $$declare t text;begin
 foreach t in array array['user_data_operations','user_data_audit','admission_history','admission_save_diagnostics','user_data_tombstones','user_data_storage_cleanup'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on private.%I to service_role',t);
 end loop;
end $$;
-- Audit has no UPDATE or DELETE capability even for the Edge service.
revoke update,delete on private.user_data_audit from service_role;
grant usage,select on sequence private.user_data_audit_id_seq to service_role;
grant usage on schema storage to service_role;
grant select(id,bucket_id,name,created_at,updated_at,metadata,version,owner_id) on storage.objects to service_role;
grant select,insert,update,delete on public.kv_store_cd835c22 to service_role;
grant delete on private.product_usage_events,private.product_member_activity_days to service_role;

create function private.user_data_hash(p jsonb) returns text language sql immutable security invoker set search_path='' as $$select encode(sha256(convert_to(p::text,'UTF8')),'hex')$$;
create function private.user_data_require_admin(p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$begin
 if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
end $$;

-- One lock path for all owner and administrator history writes, including absent keys.
create function public.user_history_mutate(p_owner uuid,p_kind text,p_action text,p_input jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare k text; arr jsonb; result jsonb; max_round integer;
begin
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

-- Central whitelist; neither relation names nor update columns come from a client.
create function private.user_data_catalog(p_domain text) returns jsonb language plpgsql immutable security invoker set search_path='' as $$begin
 return case p_domain
 when 'notes' then '{"table":"public.grading_notes","key":"id","edit":["content"]}'::jsonb
 when 'posts' then '{"table":"public.community_posts","key":"id","edit":["title","content","tag","image_urls"]}'::jsonb
 when 'comments' then '{"table":"public.community_comments","key":"id","edit":["content"]}'::jsonb
 when 'post_likes' then '{"table":"public.community_post_likes","key":"post_id","edit":[]}'::jsonb
 when 'post_reports' then '{"table":"public.community_post_reports","key":"post_id","edit":[]}'::jsonb
 when 'comment_likes' then '{"table":"public.community_comment_likes","key":"comment_id","edit":[]}'::jsonb
 when 'comment_reports' then '{"table":"public.community_comment_reports","key":"comment_id","edit":[]}'::jsonb
 when 'announcement_comments' then '{"table":"public.home_announcement_comments","key":"id","edit":["content"]}'::jsonb
 when 'announcement_likes' then '{"table":"public.home_announcement_likes","key":"announcement_id","edit":[]}'::jsonb
 when 'chat' then '{"table":"public.chat_messages","key":"id","edit":["content"]}'::jsonb
 when 'profile' then '{"table":"public.chat_profiles","key":"user_id","edit":["nickname"]}'::jsonb
 when 'usage' then '{"table":"private.product_usage_events","key":"event_id","edit":[]}'::jsonb
 when 'admission' then '{"table":"private.admission_history","key":"execution_id","edit":["input","analyses","rules_version"]}'::jsonb
 when 'admission_errors' then '{"table":"private.admission_save_diagnostics","key":"execution_id","edit":[],"readonly":true}'::jsonb
 when 'chat_limits' then '{"table":"public.chat_rate_limits","key":"user_id","edit":[],"readonly":true}'::jsonb
 when 'activity_days' then '{"table":"private.product_member_activity_days","key":"day","edit":[],"readonly":true}'::jsonb
 when 'first_usage' then '{"table":"private.product_member_first_usage","key":"metric_version","edit":[],"readonly":true}'::jsonb
 when 'usage_facts' then '{"table":"private.product_usage_fact_days","key":"day","edit":[],"readonly":true}'::jsonb
 else null end;
end $$;

create function public.user_data_members(p_actor uuid,p_query text default '',p_after uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb;begin
 perform private.user_data_require_admin(p_actor);
 if length(p_query)>120 then raise exception 'INVALID_INPUT';end if;
 with users as (select id,email,raw_user_meta_data->>'name' as name,created_at from auth.users
 union all select distinct h.user_id,null::text,null::text,null::timestamptz from private.admission_history h where not exists(select 1 from auth.users u where u.id=h.user_id)),
 selected as (select * from users u where (p_after is null or u.id>p_after) and (p_query='' or position(lower(p_query) in lower(coalesce(u.email,'')||' '||coalesce(u.name,'')||' '||u.id::text))>0) order by u.id limit 51)
 select jsonb_build_object('items',(select coalesce(jsonb_agg(jsonb_build_object('user_id',id,'email',email,'name',name,'created_at',created_at)),'[]') from (select * from selected limit 50) s),'next_cursor',case when (select count(*) from selected)>50 then (select id::text from selected offset 49 limit 1) end) into result;
 insert into private.user_data_audit(actor,domain,action,status,impact) values(p_actor,'members','read','succeeded',jsonb_build_object('count',jsonb_array_length(result->'items')));
 return result;
end $$;

create function public.user_data_read(p_actor uuid,p_target uuid,p_domain text,p_offset integer default 0,p_selector jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cat jsonb; items jsonb; total integer; arr jsonb; k text; result jsonb; context_rows jsonb='[]'; context_posts jsonb='[]'; context_total integer=0; context_offset integer=0;
begin
 perform private.user_data_require_admin(p_actor);
 if p_offset<0 or p_offset>1000000 then raise exception 'INVALID_INPUT';end if;
 if p_domain='account' then
  select jsonb_build_object('user_id',id,'email',email,'name',raw_user_meta_data->>'name','birth_date',raw_user_meta_data->>'birth_date','university',raw_user_meta_data->>'university','created_at',created_at,'confirmed_at',confirmed_at,'_snapshot',private.user_data_hash(jsonb_build_object('name',raw_user_meta_data->>'name'))) into result from auth.users where id=p_target;
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

-- Statement triggers acquire the SAME advisory lock before row locks. This
-- serializes ordinary owner writes too, without incompatible table locks or
-- parent/child counter-trigger deadlocks. No user interface behaviour changes.
create function private.user_data_graph_lock() returns trigger language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('user_data_graph:'||tg_argv[0],0));return null;
end $$;
do $$declare t text;graph text;begin
 foreach t in array array['community_posts','community_comments','community_post_likes','community_post_reports','community_comment_likes','community_comment_reports','chat_profiles','chat_messages','grading_notes','home_announcement_comments','home_announcement_likes'] loop
 graph=case when t like 'community_%' then 'community' when t like 'chat_%' then 'chat' when t='grading_notes' then 'notes' else 'announcements' end;
 execute format('create trigger user_data_graph_lock before insert or update or delete on public.%I for each statement execute function private.user_data_graph_lock(%L)',t,graph);
 end loop;
end $$;

-- A queued physical deletion cannot become referenced again between the SQL
-- transaction and the Storage API call. This trigger exposes no private rows.
create function private.user_data_image_reference_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private.user_data_storage_cleanup c where c.url=any(new.image_urls)) then raise exception 'FILE_IN_USE';end if;
 return new;
end $$;
create trigger user_data_image_reference_guard before insert or update of image_urls on public.community_posts for each row execute function private.user_data_image_reference_guard();

-- Lock before reading an approval snapshot. Relational cascades serialize all child
-- writes as well: a changed comment with the same count is still a conflict.
create function private.user_data_state(p_target uuid,p_domain text,p_selector jsonb)
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
  select jsonb_build_object('name',raw_user_meta_data->>'name') into row_data from auth.users where id=p_target;
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

create function private.user_data_impact(s jsonb,p_action text,p_domain text) returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb; c record;
begin
 result=jsonb_build_object(p_domain,case when s ? 'selected' then jsonb_array_length(s->'selected') else 1 end);
 if p_action='delete' or p_domain='profile' then
  for c in select * from jsonb_each(s->'children') loop result=result||jsonb_build_object(c.key,jsonb_array_length(c.value));end loop;
 end if;
 return result;
end $$;

-- Approval descriptors are returned transiently, never stored as before-values.
create function private.user_data_selection(s jsonb) returns jsonb language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.record) where key=any(array['id','execution_id','event_id','post_id','comment_id','announcement_id','year','examType','subject','round','timestamp','groupTimestamp','group_timestamp','question_no','examDate','provider','created_at','received_at','occurred_at','event_name','name','title','nickname']))),'[]') from
 (select value as record from jsonb_array_elements(case when s ? 'selected' then (select coalesce(jsonb_agg(v->'record'),'[]') from jsonb_array_elements(s->'selected') v) else jsonb_build_array(s->'row') end) limit 20) r
$$;

create function public.user_data_prepare(p_actor uuid,p_target uuid,p_domain text,p_action text,p_selector jsonb,p_payload jsonb,p_expected text,p_uploads jsonb default '[]',p_rules_version text default 'service-2026-10-05')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare s jsonb; cat jsonb; allowed text[]; field text; op private.user_data_operations; impact jsonb;
begin
 perform private.user_data_require_admin(p_actor);
 if p_action not in ('update','delete') or jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_uploads)<>'array' or jsonb_array_length(p_uploads)>5 or (jsonb_array_length(p_uploads)>0 and (p_domain<>'posts' or p_action<>'update')) then raise exception 'INVALID_INPUT';end if;
 if p_domain='account' and p_action<>'update' or p_domain='profile' and p_action<>'update' then raise exception 'INVALID_INPUT';end if;
 if p_domain='account' and exists(select 1 from private.user_data_operations where target=p_target and domain='account' and state in ('executing','unknown')) then raise exception 'INVALID_STATE';end if;
 s=private.user_data_state(p_target,p_domain,p_selector);
 if p_domain in ('history','mock_history') then
  if p_selector->>'snapshot'<>private.user_data_hash(s->'array') then raise exception 'CONFLICT';end if;
 else
  if p_expected is null or p_expected<>private.user_data_hash(s->'row') then raise exception 'CONFLICT';end if;
 end if;
 if p_action='update' then
  if p_domain='history' then allowed=array['userAnswers','correct','standardScore','percentile','adjustedScore','fieldAnalysis','correctAnswers'];
  elsif p_domain='mock_history' then allowed=array['examDate','provider','round','verbal','reasoning'];
  elsif p_domain='account' then allowed=array['name'];
  else cat=private.user_data_catalog(p_domain);select array_agg(value) into allowed from jsonb_array_elements_text(cat->'edit');end if;
  if p_payload='{}'::jsonb then raise exception 'INVALID_INPUT';end if;
  for field in select jsonb_object_keys(p_payload) loop if not field=any(coalesce(allowed,'{}')) then raise exception 'INVALID_FIELD';end if;end loop;
  if p_domain in ('history','mock_history') and jsonb_array_length(s->'selected')<>1 then raise exception 'INVALID_INPUT';end if;
 end if;
 impact=private.user_data_impact(s,p_action,p_domain);
 if p_domain='posts' and p_action='update' and p_payload ? 'image_urls' then impact=impact||jsonb_build_object('images_added',jsonb_array_length(p_uploads),'images_removed',(select count(*) from jsonb_array_elements_text(s->'row'->'image_urls') u where not p_payload->'image_urls' ? u));end if;
 -- Old approvals contain no copies of original data; expire proposed values too.
 update private.user_data_operations set payload='{}',state='failed',code='EXPIRED',finished_at=now() where state='prepared' and expires_at<now();
 insert into private.user_data_operations(actor,target,domain,action,selector,payload,uploads,snapshot,impact,rules_version)
 values(p_actor,p_target,p_domain,p_action,p_selector,p_payload,p_uploads,private.user_data_hash(s),impact,p_rules_version) returning * into op;
 insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status) values(p_actor,p_target,p_domain,'prepare',op.id,array(select jsonb_object_keys(p_payload)),impact,'prepared');
 return jsonb_build_object('operation_id',op.id,'state',op.state,'impact',impact,'selection',private.user_data_selection(s),'payload',p_payload,'uploads',p_uploads,'domain',p_domain,'target',p_target,'expires_at',op.expires_at,'rules_version',op.rules_version);
end $$;

-- Removed analytics submissions cannot resurrect an administrator deletion.
create function private.user_data_event_guard() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if exists(select 1 from private.user_data_tombstones where domain='usage' and key_hash in (private.user_data_hash(to_jsonb(new.event_id::text)),private.user_data_hash(to_jsonb(new.actor_scope||':'||new.semantic_key)))) then return null;end if;
 return new;
end $$;
create trigger user_data_event_guard before insert on private.product_usage_events for each row execute function private.user_data_event_guard();
-- Share the lock with ingest and archive publication BEFORE either reads a source.
alter function public.product_analytics_ingest(uuid,jsonb,text,integer) rename to product_analytics_ingest_v1;
create function public.product_analytics_ingest(p_user_id uuid,p_events jsonb,p_actor_key text,p_rejected integer default 0) returns jsonb language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('user_data_analytics',0));
 return public.product_analytics_ingest_v1(p_user_id,p_events,p_actor_key,p_rejected);
end $$;
alter function public.product_analytics_publish_days(uuid,date,date) rename to product_analytics_publish_days_v1;
create function public.product_analytics_publish_days(p_actor uuid,p_start date,p_end date) returns integer language plpgsql security invoker set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('user_data_analytics',0));
 return public.product_analytics_publish_days_v1(p_actor,p_start,p_end);
end $$;

create function private.user_data_delete_usage(p_target uuid,p_event uuid) returns void language plpgsql security invoker set search_path='' as $$
declare e private.product_usage_events;d date;
begin
 select * into e from private.product_usage_events where user_id=p_target and event_id=p_event;
 if not found then raise exception 'NOT_FOUND';end if;
 d=(e.received_at at time zone 'Asia/Seoul')::date;
 insert into private.user_data_tombstones(domain,key_hash) values('usage',private.user_data_hash(to_jsonb(e.event_id::text))),('usage',private.user_data_hash(to_jsonb(e.actor_scope||':'||e.semantic_key))) on conflict do nothing;
 update private.product_member_first_usage set first_usage_known=false where user_id=p_target and e.received_at in (first_core_received_at,first_grading_received_at,first_grading_after_confirmation_received_at,first_pwa_received_at,first_pwa_core_received_at,first_browser_core_received_at);
 delete from private.product_usage_events where event_id=p_event;
 delete from private.product_member_activity_days where user_id=p_target and day=d;
 insert into private.product_member_activity_days(user_id,day,feature,execution_channel,os_family,device_class,core)
 select user_id,d,feature,execution_channel,os_family,device_class,bool_or(is_core) from private.product_usage_events where user_id=p_target and (received_at at time zone 'Asia/Seoul')::date=d and is_active group by user_id,feature,execution_channel,os_family,device_class;
 update private.product_member_first_usage f set
 first_core_received_at=case when f.first_core_received_at=e.received_at then (select min(received_at) from private.product_usage_events where user_id=p_target and is_core) else f.first_core_received_at end,
 first_grading_received_at=case when f.first_grading_received_at=e.received_at then (select min(received_at) from private.product_usage_events where user_id=p_target and event_name='grading_completed') else f.first_grading_received_at end,
 first_grading_after_confirmation_received_at=case when f.first_grading_after_confirmation_received_at=e.received_at then (select min(source.received_at) from private.product_usage_events source join auth.users u on u.id=source.user_id where source.user_id=p_target and source.event_name='grading_completed' and source.received_at>=u.confirmed_at) else f.first_grading_after_confirmation_received_at end,
 first_pwa_received_at=case when f.first_pwa_received_at=e.received_at then (select min(received_at) from private.product_usage_events where user_id=p_target and execution_channel='pwa') else f.first_pwa_received_at end,
 first_pwa_core_received_at=case when f.first_pwa_core_received_at=e.received_at then (select min(received_at) from private.product_usage_events where user_id=p_target and execution_channel='pwa' and is_core) else f.first_pwa_core_received_at end,
 first_browser_core_received_at=case when f.first_browser_core_received_at=e.received_at then (select min(received_at) from private.product_usage_events where user_id=p_target and execution_channel='browser' and is_core) else f.first_browser_core_received_at end where f.user_id=p_target;
 delete from private.product_usage_fact_days where user_id=p_target and day=d;
 insert into private.product_usage_fact_days(day,metric_version,actor_scope,user_id,session_id,execution_channel,feature,event_name,grading_run_id,actions)
 select d,'1',actor_scope,user_id,session_id,execution_channel,feature,case when event_name='mock_saved' and coalesce(attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(attributes->>'outcome','unknown') else event_name end,coalesce(attributes->>'grading_run_id',''),count(*) from private.product_usage_events where user_id=p_target and (received_at at time zone 'Asia/Seoul')::date=d and is_active and metric_version='1' group by actor_scope,user_id,session_id,execution_channel,feature,case when event_name='mock_saved' and coalesce(attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(attributes->>'outcome','unknown') else event_name end,coalesce(attributes->>'grading_run_id','');
 update private.product_usage_day_publications set generation=generation+1,published_at=now(),status=case when d<(now() at time zone 'Asia/Seoul')::date-90 then 'partial' else status end where day=d;
 update private.product_usage_session_state set pending_event_ids=array_remove(pending_event_ids,p_event),uncertain_reason=case when cardinality(array_remove(pending_event_ids,p_event))=0 then null else uncertain_reason end where session_id=e.session_id and page_instance_id=e.page_instance_id;
end $$;

create function public.user_data_commit(p_actor uuid,p_operation uuid,p_approval text,p_finalize_images boolean default false)
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
  -- Durable intent before calling Auth. A replay never re-executes this operation.
  update private.user_data_operations set state='executing' where id=op.id;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,fields,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,fields,op.impact,'executing');
  return jsonb_build_object('operation_id',op.id,'state','executing','external',true,'target',op.target,'payload',op.payload);
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

create function public.user_data_operation(p_actor uuid,p_operation uuid,p_finalize text default null,p_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$declare op private.user_data_operations;begin
 perform private.user_data_require_admin(p_actor);
 select * into op from private.user_data_operations where id=p_operation and actor=p_actor for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_finalize is not null then
  if (op.domain<>'account' and not (op.domain='posts' and jsonb_array_length(op.uploads)>0 and p_finalize='unknown')) or op.state not in ('executing','unknown') or p_finalize not in ('succeeded','failed','unknown') then raise exception 'INVALID_STATE';end if;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,impact,status) values(op.actor,op.target,op.domain,op.action,op.id,op.impact,p_finalize);
  update private.user_data_operations set state=p_finalize,code=p_code,payload=case when p_finalize='unknown' then payload else '{}'::jsonb end,finished_at=now() where id=op.id returning * into op;
 end if;
 return jsonb_build_object('operation_id',op.id,'state',op.state,'domain',op.domain,'target',op.target,'payload',case when op.state in ('prepared','executing','unknown') then op.payload else '{}'::jsonb end,'code',op.code,'impact',op.impact,'uploads',op.uploads,'rules_version',op.rules_version);
end $$;

create function public.user_data_cleanup(p_actor uuid,p_operation uuid,p_url text default null,p_state text default null,p_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb;begin
 perform private.user_data_require_admin(p_actor);
 if not exists(select 1 from private.user_data_operations where id=p_operation and actor=p_actor) then raise exception 'NOT_FOUND';end if;
 if p_url is not null then
  if p_state not in ('succeeded','failed','blocked') then raise exception 'INVALID_STATE';end if;
  update private.user_data_storage_cleanup set state=p_state,code=p_code,updated_at=now() where operation_id=p_operation and url=p_url;
  insert into private.user_data_audit(actor,target,domain,action,operation_id,status,impact) select p_actor,target,'storage','cleanup',p_operation,p_state,jsonb_build_object('count',1) from private.user_data_operations where id=p_operation;
 end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from private.user_data_storage_cleanup t where operation_id=p_operation;
 if not exists(select 1 from private.user_data_storage_cleanup where operation_id=p_operation and state<>'succeeded') then update private.user_data_operations set state='succeeded' where id=p_operation and state='partial';end if;
 return jsonb_build_object('items',result);
end $$;

create function public.admission_execution_save(p_owner uuid,p_execution uuid,p_input jsonb,p_analyses jsonb,p_version text,p_code text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$begin
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

create function public.user_data_notes(p_actor uuid,p_target uuid,p_group bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$declare result jsonb;begin
 perform private.user_data_require_admin(p_actor);
 select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(n)||jsonb_build_object('_snapshot',private.user_data_hash(to_jsonb(n))) order by subject,question_no),'[]'),'total',count(*)) into result from public.grading_notes n where user_id=p_target and group_timestamp=p_group;
 insert into private.user_data_audit(actor,target,domain,action,status,impact) values(p_actor,p_target,'notes','read','succeeded',jsonb_build_object('count',result->'total'));
 return result;
end $$;

-- Explicit allow-list grants: no browser may call a service RPC with an actor ID.
do $$declare f record;begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='private' and p.proname like 'user_data_%') or (n.nspname='public' and p.proname in ('user_history_mutate','user_data_members','user_data_notes','user_data_read','user_data_prepare','user_data_commit','user_data_operation','user_data_cleanup','admission_execution_save','product_analytics_ingest','product_analytics_ingest_v1','product_analytics_publish_days','product_analytics_publish_days_v1')) loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',f.nspname,f.proname,f.args);
  execute format('grant execute on function %I.%I(%s) to service_role',f.nspname,f.proname,f.args);
 end loop;
end $$;
commit;
