-- Prepared locally; no collection, cleanup, or production deployment is enabled by this file.
begin;
create table private.product_analytics_settings (
  key boolean primary key default true check(key), collection_enabled boolean not null default false,
  started_at timestamptz, metric_version text not null default '1'
);
insert into private.product_analytics_settings(key) values(true);
create table private.product_analytics_collection_gaps (
  id bigint generated always as identity primary key, started_at timestamptz not null,
  ended_at timestamptz, check(ended_at is null or ended_at>=started_at)
);
create table private.product_analytics_test_accounts(user_id uuid primary key);
create table private.product_usage_events (
  event_id uuid primary key, actor_scope text not null, semantic_key text not null,
  user_id uuid, received_at timestamptz not null default now(), occurred_at timestamptz not null,
  session_id uuid not null, page_instance_id uuid not null, page_entry_id uuid not null,
  event_sequence integer not null check(event_sequence>0), metric_version text not null check(metric_version='1'),
  event_name text not null, feature text not null, route text not null,
  execution_channel text not null check(execution_channel in ('pwa','browser','other','unknown')),
  display_mode text not null, detection_method text not null, detection_version integer not null,
  os_family text not null, device_class text not null, attributes jsonb not null check(jsonb_typeof(attributes)='object'),
  source text not null default 'client' check(source='client'), clock_status text not null,
  is_active boolean not null, is_core boolean not null,
  unique(actor_scope,semantic_key)
);
create index product_usage_time_idx on private.product_usage_events(received_at,event_id);
create index product_usage_member_idx on private.product_usage_events(user_id,received_at desc,event_id desc);
create index product_usage_session_idx on private.product_usage_events(session_id,received_at);
create index product_usage_run_idx on private.product_usage_events((attributes->>'grading_run_id')) where attributes ? 'grading_run_id';
create table private.product_usage_session_state (
  session_id uuid not null, page_instance_id uuid not null, last_activity_received_at timestamptz not null,
  activity_sequence integer not null default 0, uncertain_reason text, pending_event_ids uuid[] not null default '{}',
  primary key(session_id,page_instance_id)
);
create table private.product_member_activity_days (
  user_id uuid not null, day date not null, feature text not null, execution_channel text not null,
  os_family text not null, device_class text not null, core boolean not null default false,
  primary key(user_id,day,feature,execution_channel,os_family,device_class)
);
create index product_member_days_date_idx on private.product_member_activity_days(day,user_id);
create table private.product_member_first_usage (
  user_id uuid not null, metric_version text not null default '1', first_core_received_at timestamptz,
  first_grading_received_at timestamptz, first_grading_after_confirmation_received_at timestamptz,
  first_pwa_received_at timestamptz, first_pwa_core_received_at timestamptz, first_browser_core_received_at timestamptz,
  first_usage_known boolean not null default true, primary key(user_id,metric_version)
);
-- Register existing accounts before collection starts. Retention does not erase this anchor.
insert into private.product_member_first_usage(user_id) select id from auth.users;
create table private.product_usage_ingestion_quality (
  minute timestamptz primary key, submitted bigint not null default 0, accepted bigint not null default 0,
  duplicate bigint not null default 0, rejected bigint not null default 0, processing_failed bigint not null default 0,
  state_submitted bigint not null default 0, state_accepted bigint not null default 0
);
create table private.product_usage_rate_limits (
  actor_key text not null, minute timestamptz not null, submitted integer not null,
  primary key(actor_key,minute)
);
create table private.product_admin_access_logs (
  id bigint generated always as identity primary key, admin_user_id uuid not null,
  target_user_id uuid, target_session_id uuid, kind text not null,
  received_at timestamptz not null default now(), filters jsonb not null default '{}',
  returned_count integer not null check(returned_count>=0), status text not null
);
create index product_admin_access_time_idx on private.product_admin_access_logs(received_at desc,id desc);
create index product_admin_access_member_idx on private.product_admin_access_logs(target_user_id,received_at desc);

do $$ declare t text; begin
  foreach t in array array['product_analytics_settings','product_analytics_collection_gaps','product_analytics_test_accounts','product_usage_events','product_usage_session_state','product_member_activity_days','product_member_first_usage','product_usage_ingestion_quality','product_usage_rate_limits','product_admin_access_logs'] loop
    execute format('alter table private.%I enable row level security',t);
    execute format('revoke all on private.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update on private.%I to service_role',t);
  end loop;
end $$;
grant usage on schema private to service_role;
grant select on private.admin_roles to service_role;
grant select (id,email,raw_user_meta_data,created_at,confirmed_at) on auth.users to service_role;
grant select on public.kv_store_cd835c22 to service_role;
grant usage,select on sequence private.product_admin_access_logs_id_seq,private.product_analytics_collection_gaps_id_seq to service_role;

-- Remember known kill-switch intervals so re-enabling never turns missing periods into zeros.
create function private.product_analytics_setting_changed() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.collection_enabled and not new.collection_enabled then
    insert into private.product_analytics_collection_gaps(started_at) values(now());
    -- Conservative shared known flag: retain all anchor timestamps, never invent first use across a gap.
    update private.product_member_first_usage set first_usage_known=false where first_core_received_at is null or first_grading_received_at is null or first_pwa_core_received_at is null or first_browser_core_received_at is null;
  elsif not old.collection_enabled and new.collection_enabled then
    update private.product_analytics_collection_gaps set ended_at=now() where ended_at is null;
  end if;
  return new;
end $$;
revoke all on function private.product_analytics_setting_changed() from public,anon,authenticated;
grant execute on function private.product_analytics_setting_changed() to service_role;
create trigger product_analytics_setting_changed after update on private.product_analytics_settings for each row execute function private.product_analytics_setting_changed();

create function public.product_analytics_ingest(p_user_id uuid,p_events jsonb,p_actor_key text,p_rejected integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare e jsonb; a jsonb; n text; sem text; scope text; saved uuid; active boolean; core boolean;
  results jsonb='[]'; state_count integer=0; submitted_count integer=p_rejected; accepted_count integer=0;
  duplicate_count integer=0; failed_count integer=0; state_accepted integer=0; minute_at timestamptz=date_trunc('minute',now());
  rate_count integer; started timestamptz; confirmed timestamptz; created timestamptz;
begin
  select started_at into started from private.product_analytics_settings where key and collection_enabled;
  if not found or started is null then raise exception 'COLLECTION_DISABLED' using errcode='P0001'; end if;
  if jsonb_typeof(p_events)<>'array' or jsonb_array_length(p_events)+p_rejected>50 or p_rejected<0 then raise exception 'INVALID_BATCH'; end if;
  if p_user_id is not null then
    select confirmed_at,created_at into confirmed,created from auth.users where id=p_user_id;
    if not found then raise exception 'ACCOUNT_UNAVAILABLE'; end if;
    if exists(select 1 from private.admin_roles where user_id=p_user_id and role='admin') or exists(select 1 from private.product_analytics_test_accounts where user_id=p_user_id) then
      return (select coalesce(jsonb_agg(jsonb_build_object('event_id',x->>'event_id','status','rejected','reason','EXCLUDED')), '[]') from jsonb_array_elements(p_events) x);
    end if;
  end if;
  insert into private.product_usage_rate_limits values(p_actor_key,minute_at,jsonb_array_length(p_events)+p_rejected)
  on conflict(actor_key,minute) do update set submitted=private.product_usage_rate_limits.submitted+excluded.submitted returning submitted into rate_count;
  if rate_count>240 then return (select coalesce(jsonb_agg(jsonb_build_object('event_id',x->>'event_id','status','rejected','reason','RATE_LIMITED')), '[]') from jsonb_array_elements(p_events) x); end if;
  for e in select value from jsonb_array_elements(p_events) loop
    n=e->>'event_name'; a=e->'attributes'; saved=null;
    if n='session_activity' then state_count=state_count+1; else submitted_count=submitted_count+1; end if;
    begin
      active=n not in ('session_activity','execution_channel_changed') and n not like 'install_%';
      core=n in ('grading_completed','past_exam_file_clicked','reference_opened','history_viewed','mock_saved','admission_completed');
      scope=coalesce(p_user_id::text,'anonymous:'||(e->>'session_id'));
      sem=n||':'||case
        when n in ('grading_input_started','grading_input_resumed') then a->>'input_flow_id'
        when n in ('grading_requested','grading_completed','grading_result_viewed') then a->>'grading_run_id'
        when n='history_save_outcome' then (a->>'save_attempt_id')||':'||(a->>'subjects')
        when n='mock_saved' then a->>'save_attempt_id'
        when n in ('page_view','past_result_viewed','history_viewed','history_trend_viewed','community_post_viewed','chat_loaded','admission_result_viewed') then (e->>'page_entry_id')||':'||coalesce(a->>'history_kind','')
        else e->>'event_id' end;
      insert into private.product_usage_events(event_id,actor_scope,semantic_key,user_id,occurred_at,session_id,page_instance_id,page_entry_id,event_sequence,metric_version,event_name,feature,route,execution_channel,display_mode,detection_method,detection_version,os_family,device_class,attributes,clock_status,is_active,is_core)
      values((e->>'event_id')::uuid,scope,sem,p_user_id,(e->>'occurred_at')::timestamptz,(e->>'session_id')::uuid,(e->>'page_instance_id')::uuid,(e->>'page_entry_id')::uuid,(e->>'event_sequence')::integer,e->>'metric_version',n,e->>'feature',e->>'route',e->>'execution_channel',e->>'display_mode',e->>'detection_method',(e->>'detection_version')::integer,e->>'os_family',e->>'device_class',a,
        case when abs(extract(epoch from now()-(e->>'occurred_at')::timestamptz))>86400 then 'out_of_range' when now()-(e->>'occurred_at')::timestamptz>interval '1 minute' then 'delayed' else 'reported' end,active,core)
      on conflict do nothing returning event_id into saved;
      if saved is null then
        if n<>'session_activity' then duplicate_count=duplicate_count+1; end if;
        results=results||jsonb_build_array(jsonb_build_object('event_id',e->>'event_id','status','duplicate')); continue;
      end if;
      if active or n='session_activity' then
        insert into private.product_usage_session_state(session_id,page_instance_id,last_activity_received_at,activity_sequence)
        values((e->>'session_id')::uuid,(e->>'page_instance_id')::uuid,now(),coalesce((a->>'activity_sequence')::integer,0))
        on conflict(session_id,page_instance_id) do update set last_activity_received_at=greatest(private.product_usage_session_state.last_activity_received_at,excluded.last_activity_received_at), activity_sequence=greatest(private.product_usage_session_state.activity_sequence,excluded.activity_sequence),
          pending_event_ids=array_remove(private.product_usage_session_state.pending_event_ids,saved),
          uncertain_reason=case when cardinality(array_remove(private.product_usage_session_state.pending_event_ids,saved))=0 then null else private.product_usage_session_state.uncertain_reason end;
      end if;
      if p_user_id is not null and active then
        insert into private.product_member_activity_days values(p_user_id,(now() at time zone 'Asia/Seoul')::date,e->>'feature',e->>'execution_channel',e->>'os_family',e->>'device_class',core)
        on conflict(user_id,day,feature,execution_channel,os_family,device_class) do update set core=private.product_member_activity_days.core or excluded.core;
        insert into private.product_member_first_usage(user_id,first_usage_known) values(p_user_id,(started>=now()-interval '180 days' or created>=now()-interval '180 days') and not exists(select 1 from private.product_analytics_collection_gaps g where coalesce(g.ended_at,now())>created)) on conflict do nothing;
        update private.product_member_first_usage set
          first_core_received_at=case when core then least(first_core_received_at,now()) else first_core_received_at end,
          first_grading_received_at=case when n='grading_completed' then least(first_grading_received_at,now()) else first_grading_received_at end,
          first_grading_after_confirmation_received_at=case when n='grading_completed' and confirmed is not null and now()>=confirmed then least(first_grading_after_confirmation_received_at,now()) else first_grading_after_confirmation_received_at end,
          first_pwa_received_at=case when e->>'execution_channel'='pwa' then least(first_pwa_received_at,now()) else first_pwa_received_at end,
          first_pwa_core_received_at=case when core and e->>'execution_channel'='pwa' then least(first_pwa_core_received_at,now()) else first_pwa_core_received_at end,
          first_browser_core_received_at=case when core and e->>'execution_channel'='browser' then least(first_browser_core_received_at,now()) else first_browser_core_received_at end
        where user_id=p_user_id and metric_version='1';
      end if;
      if n='session_activity' then state_accepted=state_accepted+1; else accepted_count=accepted_count+1; end if;
      results=results||jsonb_build_array(jsonb_build_object('event_id',e->>'event_id','status','accepted'));
    exception when others then
      if n<>'session_activity' then failed_count=failed_count+1; end if;
      results=results||jsonb_build_array(jsonb_build_object('event_id',e->>'event_id','status','processing_failed','reason','STORAGE_FAILED'));
      -- The failed item's subtransaction rolls back its insert and derived state.
      insert into private.product_usage_session_state(session_id,page_instance_id,last_activity_received_at,uncertain_reason,pending_event_ids)
      values((e->>'session_id')::uuid,(e->>'page_instance_id')::uuid,now(),'STORAGE_FAILED',array[(e->>'event_id')::uuid])
      on conflict(session_id,page_instance_id) do update set uncertain_reason='STORAGE_FAILED',pending_event_ids=array_append(array_remove(private.product_usage_session_state.pending_event_ids,(e->>'event_id')::uuid),(e->>'event_id')::uuid);
    end;
  end loop;
  insert into private.product_usage_ingestion_quality values(minute_at,submitted_count,accepted_count,duplicate_count,p_rejected,failed_count,state_count,state_accepted)
  on conflict(minute) do update set submitted=private.product_usage_ingestion_quality.submitted+excluded.submitted,
    accepted=private.product_usage_ingestion_quality.accepted+excluded.accepted,duplicate=private.product_usage_ingestion_quality.duplicate+excluded.duplicate,
    rejected=private.product_usage_ingestion_quality.rejected+excluded.rejected,processing_failed=private.product_usage_ingestion_quality.processing_failed+excluded.processing_failed,
    state_submitted=private.product_usage_ingestion_quality.state_submitted+excluded.state_submitted,state_accepted=private.product_usage_ingestion_quality.state_accepted+excluded.state_accepted;
  return results;
end $$;

-- Reuse precisely the same event predicates for reports, directories and timelines.
create function private.product_analytics_matches(e private.product_usage_events,f jsonb)
returns boolean language sql immutable security invoker set search_path='' as $$
select (not(f ? 'channel') or e.execution_channel=f->>'channel')
 and (not(f ? 'os') or e.os_family=f->>'os') and (not(f ? 'device') or e.device_class=f->>'device')
 and (not(f ? 'login') or (e.user_id is not null)=(f->>'login'='member'))
 and (not(f ? 'year') or e.attributes->>'year'=f->>'year')
 and (not(f ? 'subjects') or e.attributes->>'subjects'=f->>'subjects')
 and (not(f ? 'exam_type') or e.attributes->>'exam_type'=f->>'exam_type')
 and (not(f ? 'feature') or e.feature=f->>'feature') and (not(f ? 'outcome') or e.attributes->>'outcome'=f->>'outcome');
$$;
revoke all on function private.product_analytics_matches(private.product_usage_events,jsonb) from public,anon,authenticated;
grant execute on function private.product_analytics_matches(private.product_usage_events,jsonb) to service_role;

create function public.product_analytics_report(p_actor uuid,p_filters jsonb,p_report text default 'overview')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul';
  end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
  available timestamptz; result jsonb; status text;
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if end_at<=start_at or end_at-start_at>interval '90 days' then raise exception 'INVALID_PERIOD'; end if;
  select greatest(started_at,now()-interval '90 days') into available from private.product_analytics_settings where started_at is not null;
  status=case when available is null or end_at<=available then 'unavailable' when start_at<available or end_at>now() or exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<end_at and coalesce(g.ended_at,now())>start_at) then 'partial' else 'complete' end;
  with selected as (
    select e.* from private.product_usage_events e where e.received_at>=greatest(start_at,available) and e.received_at<end_at and e.is_active and available is not null
    and private.product_analytics_matches(e,p_filters)
  ), reported as (select * from selected where p_report<>'pwa' or execution_channel='pwa'),
  signals as (select e.* from private.product_usage_events e where e.received_at>=greatest(start_at,available) and e.received_at<end_at and available is not null and e.event_name like 'install_%' and private.product_analytics_matches(e,p_filters)),
  daily as (select (received_at at time zone 'Asia/Seoul')::date as day,count(distinct user_id) as members,count(distinct session_id) as sessions,count(distinct attributes->>'grading_run_id') filter(where event_name='grading_completed') as grading from reported group by 1),
  features as (select feature,count(distinct user_id) as members,count(distinct session_id) as sessions,count(*) filter(where event_name<>'page_view') as actions from reported group by feature),
  inputs as (select distinct s.session_id from selected s where s.event_name in ('grading_input_started','grading_input_resumed') and not exists(select 1 from private.product_usage_events prev where prev.session_id=s.session_id and prev.event_name in ('grading_input_started','grading_input_resumed') and prev.received_at<start_at and private.product_analytics_matches(prev,p_filters))),
  states as (select i.session_id,case when bool_or(st.uncertain_reason is not null) then 'uncertain' when max(st.last_activity_received_at)>now()-interval '30 minutes' then 'open' when max(st.last_activity_received_at)>now()-interval '45 minutes' then 'grace' else 'observation_closed' end as state
    from inputs i join private.product_usage_session_state st on st.session_id=i.session_id group by i.session_id),
  converted as (select distinct i.session_id from selected i join private.product_usage_events r on r.session_id=i.session_id and r.actor_scope=i.actor_scope and r.attributes->>'input_flow_id'=i.attributes->>'input_flow_id' and r.event_name='grading_result_viewed'
    join private.product_usage_events requested on requested.session_id=r.session_id and requested.actor_scope=r.actor_scope and requested.event_name='grading_requested' and requested.attributes->>'grading_run_id'=r.attributes->>'grading_run_id' and requested.attributes->>'input_flow_id'=r.attributes->>'input_flow_id'
    where i.event_name in ('grading_input_started','grading_input_resumed') and r.received_at>=available and r.received_at<=now()),
  channel_members as (select user_id,bool_or(execution_channel='pwa') as p,bool_or(execution_channel='browser') as b from selected where user_id is not null group by user_id),
  anchor as (select f.user_id,(case when p_report='pwa' then f.first_pwa_core_received_at else f.first_core_received_at end at time zone 'Asia/Seoul')::date as day from private.product_member_first_usage f where f.first_usage_known and f.metric_version='1'),
  cohort as (select a.day,count(*) as members,
    case when a.day+1<=(now() at time zone 'Asia/Seoul')::date-1 then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+1 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d1,
    case when a.day+7<=(now() at time zone 'Asia/Seoul')::date-1 then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+7 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d7,
    case when a.day+30<=(now() at time zone 'Asia/Seoul')::date-1 then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+30 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d30
    from anchor a where a.day>=(start_at at time zone 'Asia/Seoul')::date and a.day<(end_at at time zone 'Asia/Seoul')::date and a.day>=(now() at time zone 'Asia/Seoul')::date-180 group by a.day),
  totals as (select count(distinct user_id) as members,count(distinct session_id) as sessions,count(distinct attributes->>'grading_run_id') filter(where event_name='grading_completed') as grading,count(distinct session_id) filter(where event_name='grading_result_viewed') as results from reported)
  select jsonb_build_object('metric_version','1','source','supabase_usage','generated_at',now(),'data_through',now(),'status',status,'filters',p_filters,
    'coverage',jsonb_build_object('available_from',available,'available_through',now(),'coverage_status',status),
    'metrics',jsonb_build_array(jsonb_build_object('key','members','label','활성 회원','value',case when status='unavailable' then null else t.members end,'unit','명','status',status),jsonb_build_object('key','sessions','label','이용 세션','value',case when status='unavailable' then null else t.sessions end,'unit','개','status',status),jsonb_build_object('key','grading','label','채점 완료','value',case when status='unavailable' then null else t.grading end,'unit','회','status',status),jsonb_build_object('key','results','label','결과 조회 세션','value',case when status='unavailable' then null else t.results end,'unit','개','status',status)),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'members',members,'sessions',sessions,'grading',grading) order by day) from daily),'[]'),
    'features',coalesce((select jsonb_agg(jsonb_build_object('feature',feature,'members',members,'sessions',sessions,'actions',actions) order by actions desc) from features),'[]'),
    'conversion',jsonb_build_object('status',case when p_filters ?| array['subjects','outcome'] then 'filters_unavailable' else 'available' end,'closed',(select count(*) from states where state='observation_closed'),'converted',(select count(*) from states where state='observation_closed' and session_id in (select session_id from converted)),'open',(select count(*) from states where state='open'),'grace',(select count(*) from states where state='grace'),'uncertain',(select count(*) from states where state='uncertain'),'resumed',(select count(distinct session_id) from selected where event_name='grading_input_resumed')),
    'pwa',jsonb_build_object('pwa_only',(select count(*) from channel_members where p and not b),'browser_only',(select count(*) from channel_members where b and not p),'both',(select count(*) from channel_members where p and b),'other_only',(select count(*) from channel_members where not p and not b)),
    'cohorts',case when p_filters ?| array['os','device','year','subjects','exam_type','login','channel','feature','outcome'] then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('date',day,'members',members,'d1',d1,'d7',d7,'d30',d30) order by day) from cohort),'[]') end,
    'cohort_status',case when p_filters ?| array['os','device','year','subjects','exam_type','login','channel','feature','outcome'] then 'filters_unavailable' when available is null or status='partial' then 'unavailable' else 'available' end,
    'grading',jsonb_build_object('grading_requested',(select count(distinct attributes->>'grading_run_id') from reported where event_name='grading_requested'),'grading_completed',t.grading,'grading_result_viewed',(select count(distinct attributes->>'grading_run_id') from reported where event_name='grading_result_viewed'),'past_result_viewed',(select count(*) from reported where event_name='past_result_viewed'),'verbal_completed',(select count(distinct attributes->>'grading_run_id') from reported where event_name='grading_completed' and attributes->>'subjects' in ('verbal','both')),'reasoning_completed',(select count(distinct attributes->>'grading_run_id') from reported where event_name='grading_completed' and attributes->>'subjects' in ('reasoning','both')),'save_success',(select count(*) from reported where event_name='history_save_outcome' and attributes->>'outcome'='success'),'save_failed',(select count(*) from reported where event_name='history_save_outcome' and attributes->>'outcome'='failed'),'save_unknown',(select count(*) from reported where event_name='history_save_outcome' and attributes->>'outcome'='unknown')),
    'membership',(select jsonb_build_object('status',case when available is null or status='partial' then 'unavailable' when p_filters ?| array['os','device','year','subjects','exam_type','login','channel','feature','outcome'] then 'filters_unavailable' else 'available' end,'signups',count(*) filter(where u.created_at>=start_at and u.created_at<end_at),'confirmations',count(*) filter(where u.confirmed_at>=start_at and u.confirmed_at<end_at),'mature_confirmations',count(*) filter(where u.confirmed_at>=greatest(start_at,available) and u.confirmed_at<end_at and u.confirmed_at+interval '7 days'<=now()),'first_grading_in_7d',count(*) filter(where u.confirmed_at>=greatest(start_at,available) and u.confirmed_at<end_at and u.confirmed_at+interval '7 days'<=now() and f.first_usage_known and f.first_grading_after_confirmation_received_at>=u.confirmed_at and f.first_grading_after_confirmation_received_at<u.confirmed_at+interval '7 days'),'first_usage_unknown',count(*) filter(where u.confirmed_at>=greatest(start_at,available) and u.confirmed_at<end_at and u.confirmed_at+interval '7 days'<=now() and not coalesce(f.first_usage_known,true))) from auth.users u left join private.product_member_first_usage f on f.user_id=u.id and f.metric_version='1' where not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts a where a.user_id=u.id)),
    'installation',coalesce((select jsonb_object_agg(event_name,n) from (select event_name,count(*) as n from signals group by event_name) x),'{}'),
    'quality',jsonb_build_object('submitted',coalesce((select sum(submitted) from private.product_usage_ingestion_quality where minute>=start_at and minute<end_at),0),'accepted',coalesce((select sum(accepted) from private.product_usage_ingestion_quality where minute>=start_at and minute<end_at),0),'duplicate',coalesce((select sum(duplicate) from private.product_usage_ingestion_quality where minute>=start_at and minute<end_at),0),'rejected',coalesce((select sum(rejected) from private.product_usage_ingestion_quality where minute>=start_at and minute<end_at),0),'processing_failed',coalesce((select sum(processing_failed) from private.product_usage_ingestion_quality where minute>=start_at and minute<end_at),0),'unknown_first_usage',(select count(*) from private.product_member_first_usage where not first_usage_known)),
    'comparison',jsonb_build_object('status','unavailable')) into result from totals t;
  if p_report in ('overview','members') then
    -- Aggregate current KV inventory once, return only counts, never individual scores/answers.
    with holders as (select k.key,k.value,case when k.key like 'history:%' then 'official' else 'mock' end as kind from public.kv_store_cd835c22 k
      join auth.users u on k.key='history:'||u.id::text or k.key='mock_history:'||u.id::text
      where not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts a where a.user_id=u.id)),
    records as (select h.key,h.kind,r from holders h cross join lateral jsonb_array_elements(case when jsonb_typeof(h.value)='array' then h.value else '[]'::jsonb end) r),
    valid as (select *,case when kind='official' then jsonb_typeof(r)='object' and r->>'subject' in ('verbal','reasoning') and coalesce(r->>'year','')~'^(09예비|20[0-9]{2})$' and jsonb_typeof(r->'timestamp')='number' else jsonb_typeof(r)='object' and coalesce(r->>'id','')<>'' and coalesce(r->>'provider','')<>'' and jsonb_typeof(r->'createdAt')='number' end as ok from records)
    select result||jsonb_build_object('inventory',jsonb_build_object('accounts',(select count(*) from auth.users u where not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts a where a.user_id=u.id)),
      'confirmed',(select count(*) from auth.users u where confirmed_at is not null and not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts a where a.user_id=u.id)),
      'official_records',count(*) filter(where kind='official' and ok),'official_groups',count(distinct (key,coalesce(r->>'groupTimestamp',r->>'timestamp'))) filter(where kind='official' and ok),'mock_records',count(*) filter(where kind='mock' and ok),'invalid_records',count(*) filter(where not coalesce(ok,false))+(select count(*) from holders where jsonb_typeof(value)<>'array'))) into result from valid;
  end if;
  return result;
end $$;

create function public.product_analytics_member_directory(p_actor uuid,p_filters jsonb,p_query text default '',p_after uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; rows_json jsonb; next_id uuid; start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul'; end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if length(p_query)>120 then raise exception 'INVALID_SEARCH'; end if;
  with activity as (select e.* from private.product_usage_events e where e.received_at>=greatest(start_at,now()-interval '90 days') and e.received_at<end_at and e.is_active and private.product_analytics_matches(e,p_filters)),
  candidates as (select u.id,u.email,u.raw_user_meta_data->>'name' as name,u.created_at,u.confirmed_at from auth.users u where (p_after is null or u.id>p_after) and (p_query='' or strpos(lower(coalesce(u.email,'')),lower(p_query))>0 or strpos(lower(coalesce(u.raw_user_meta_data->>'name','')),lower(p_query))>0 or u.id::text=p_query)
    and not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts a where a.user_id=u.id)
    and (not(p_filters ?| array['channel','os','device','login','year','subjects','exam_type','feature','outcome']) or exists(select 1 from activity a where a.user_id=u.id)) order by u.id limit 51),
  page as (select c.*,row_number() over(order by c.id) as rn,max(a.received_at) as last_seen,count(distinct a.session_id) as sessions,count(distinct a.attributes->>'grading_run_id') filter(where a.event_name='grading_completed') as grading,count(*) filter(where a.feature='past_exams' and a.event_name<>'page_view') as past_exams,count(*) filter(where a.event_name='history_viewed') as history_views,coalesce(array_agg(distinct a.execution_channel) filter(where a.event_id is not null),'{}') as channels from candidates c left join activity a on a.user_id=c.id group by c.id,c.email,c.name,c.created_at,c.confirmed_at)
  select coalesce(jsonb_agg(jsonb_build_object('user_id',id,'name',name,'email',email,'created_at',created_at,'confirmed_at',confirmed_at,'last_seen',last_seen,'sessions',sessions,'grading',grading,'past_exams',past_exams,'history_views',history_views,'channels',channels) order by id) filter(where rn<=50),'[]'), case when count(*)>50 then (array_agg(id order by id) filter(where rn=50))[1] end into rows_json,next_id from page;
  if jsonb_array_length(rows_json)<50 then next_id=null; end if;
  result=jsonb_build_object('items',rows_json,'next_cursor',next_id,'coverage',(select jsonb_build_object('available_from',case when started_at is null then null else greatest(started_at,now()-interval '90 days') end,'available_through',now(),'coverage_status',case when started_at is null or end_at<=greatest(started_at,now()-interval '90 days') then 'unavailable' when start_at<greatest(started_at,now()-interval '90 days') or end_at>now() or exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<end_at and coalesce(g.ended_at,now())>start_at) then 'partial' else 'complete' end) from private.product_analytics_settings where key));
  insert into private.product_admin_access_logs(admin_user_id,kind,filters,returned_count,status) values(p_actor,'member_directory',p_filters||jsonb_build_object('search_kind',case when p_query='' then 'none' else 'name_email_uuid' end,'search_performed',p_query<>''),jsonb_array_length(rows_json),'provided');
  return result;
end $$;

create function public.product_analytics_member_activity(p_actor uuid,p_filters jsonb,p_user_id uuid default null,p_session_id uuid default null,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows_json jsonb; next_cursor jsonb; start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul'; end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if (p_user_id is null)=(p_session_id is null) then raise exception 'TARGET_REQUIRED'; end if;
  with page as (select e.*,row_number() over(order by e.received_at desc,e.event_id desc) as rn from private.product_usage_events e where e.received_at>=greatest(start_at,now()-interval '90 days') and e.received_at<end_at and e.event_name<>'session_activity' and ((p_user_id is not null and e.user_id=p_user_id) or (p_session_id is not null and e.session_id=p_session_id and e.user_id is null))
    and (p_before_time is null or (e.received_at,e.event_id)<(p_before_time,p_before_id))
    and private.product_analytics_matches(e,p_filters) order by e.received_at desc,e.event_id desc limit 101)
  select coalesce(jsonb_agg(to_jsonb(page)-'actor_scope'-'semantic_key'-'is_active'-'is_core'-'rn' order by received_at desc,event_id desc) filter(where rn<=100),'[]'), case when count(*)>100 then (jsonb_agg(jsonb_build_object('time',received_at,'id',event_id)) filter(where rn=100))->0 end into rows_json,next_cursor from page;
  if jsonb_array_length(rows_json)<100 then next_cursor=null; end if;
  insert into private.product_admin_access_logs(admin_user_id,target_user_id,target_session_id,kind,filters,returned_count,status) values(p_actor,p_user_id,p_session_id,'member_activity',p_filters,jsonb_array_length(rows_json),'provided');
  return jsonb_build_object('items',rows_json,'next_cursor',next_cursor,'coverage',(select jsonb_build_object('available_from',case when started_at is null then null else greatest(started_at,now()-interval '90 days') end,'available_through',now(),'coverage_status',case when started_at is null or end_at<=greatest(started_at,now()-interval '90 days') then 'unavailable' when start_at<greatest(started_at,now()-interval '90 days') or end_at>now() or exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<end_at and coalesce(g.ended_at,now())>start_at) then 'partial' else 'complete' end) from private.product_analytics_settings where key));
end $$;

create function public.product_analytics_access_history(p_actor uuid,p_filters jsonb,p_target uuid default null,p_admin uuid default null,p_before bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows_json jsonb; next_id bigint; start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul'; end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  with page as (select l.*,row_number() over(order by id desc) as rn from private.product_admin_access_logs l where received_at>=start_at and received_at<end_at and (p_target is null or target_user_id=p_target) and (p_admin is null or admin_user_id=p_admin) and (p_before is null or id<p_before) and (not(p_filters ? 'kind') or l.kind=p_filters->>'kind') order by id desc limit 101)
  select coalesce(jsonb_agg(to_jsonb(page)-'rn' order by id desc) filter(where rn<=100),'[]'), case when count(*)>100 then max(id) filter(where rn=100) end into rows_json,next_id from page;
  if jsonb_array_length(rows_json)<100 then next_id=null; end if;
  insert into private.product_admin_access_logs(admin_user_id,kind,filters,returned_count,status) values(p_actor,'admin_access_history',p_filters||jsonb_strip_nulls(jsonb_build_object('target_user_id',p_target,'admin_user_id',p_admin)),jsonb_array_length(rows_json),'provided');
  return jsonb_build_object('items',rows_json,'next_cursor',next_id::text);
end $$;

revoke all on function public.product_analytics_ingest(uuid,jsonb,text,integer),public.product_analytics_report(uuid,jsonb,text),public.product_analytics_member_directory(uuid,jsonb,text,uuid),public.product_analytics_member_activity(uuid,jsonb,uuid,uuid,timestamptz,uuid),public.product_analytics_access_history(uuid,jsonb,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.product_analytics_ingest(uuid,jsonb,text,integer),public.product_analytics_report(uuid,jsonb,text),public.product_analytics_member_directory(uuid,jsonb,text,uuid),public.product_analytics_member_activity(uuid,jsonb,uuid,uuid,timestamptz,uuid),public.product_analytics_access_history(uuid,jsonb,uuid,uuid,bigint) to service_role;
commit;
