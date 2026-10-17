-- Local candidate only. Requires the existing admin-user-data ingest wrapper.
-- No production application, collection activation, backfill, publication, or cleanup.
begin;
do $$begin
 if to_regprocedure('public.product_analytics_ingest_v1(uuid,jsonb,text,integer)') is null then
  raise exception 'ADMIN_USER_DATA_PREREQUISITE_REQUIRED';
 end if;
end $$;
create or replace function public.product_analytics_ingest_v1(p_user_id uuid,p_events jsonb,p_actor_key text,p_rejected integer default 0)
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
      active=n not in ('session_activity','execution_channel_changed','tool_available','tool_exposed','client_timing') and n not like 'install_%';
      core=n in ('grading_completed','past_exam_file_clicked','reference_opened','history_viewed','mock_saved','admission_completed');
      scope=coalesce(p_user_id::text,'anonymous:'||(e->>'session_id'));
      sem=n||':'||case
        when n in ('grading_input_started','grading_input_resumed') then a->>'input_flow_id'
        when n in ('grading_requested','grading_completed','grading_result_viewed') then a->>'grading_run_id'
        when n='history_save_outcome' then (a->>'save_attempt_id')||':'||(a->>'subjects')
        when n='mock_saved' then a->>'save_attempt_id'
        when n in ('tool_available','tool_exposed') then (e->>'page_entry_id')||':'||(a->>'result_context_id')||':'||(a->>'tool')
        when n in ('tool_used','tool_result') then a->>'operation_id'
        when n='client_timing' then (a->>'grading_run_id')||':'||(a->>'timing_phase')||':'||coalesce(a->>'subjects','')
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
      if active or n='session_activity' then
      insert into private.product_usage_session_state(session_id,page_instance_id,last_activity_received_at,uncertain_reason,pending_event_ids)
      values((e->>'session_id')::uuid,(e->>'page_instance_id')::uuid,now(),'STORAGE_FAILED',array[(e->>'event_id')::uuid])
      on conflict(session_id,page_instance_id) do update set uncertain_reason='STORAGE_FAILED',pending_event_ids=array_append(array_remove(private.product_usage_session_state.pending_event_ids,(e->>'event_id')::uuid),(e->>'event_id')::uuid);
      end if;
    end;
  end loop;
  insert into private.product_usage_ingestion_quality values(minute_at,submitted_count,accepted_count,duplicate_count,p_rejected,failed_count,state_count,state_accepted)
  on conflict(minute) do update set submitted=private.product_usage_ingestion_quality.submitted+excluded.submitted,
    accepted=private.product_usage_ingestion_quality.accepted+excluded.accepted,duplicate=private.product_usage_ingestion_quality.duplicate+excluded.duplicate,
    rejected=private.product_usage_ingestion_quality.rejected+excluded.rejected,processing_failed=private.product_usage_ingestion_quality.processing_failed+excluded.processing_failed,
    state_submitted=private.product_usage_ingestion_quality.state_submitted+excluded.state_submitted,state_accepted=private.product_usage_ingestion_quality.state_accepted+excluded.state_accepted;
  return results;
end $$;

create or replace function public.product_analytics_report(p_actor uuid,p_filters jsonb,p_report text default 'overview')
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
    case when a.day+1<=(now() at time zone 'Asia/Seoul')::date-1 and (a.day+1)::timestamp at time zone 'Asia/Seoul'>=available and not exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<((a.day+1+1)::timestamp at time zone 'Asia/Seoul') and coalesce(g.ended_at,now())>((a.day+1)::timestamp at time zone 'Asia/Seoul')) then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+1 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d1,
    case when a.day+7<=(now() at time zone 'Asia/Seoul')::date-1 and (a.day+7)::timestamp at time zone 'Asia/Seoul'>=available and not exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<((a.day+7+1)::timestamp at time zone 'Asia/Seoul') and coalesce(g.ended_at,now())>((a.day+7)::timestamp at time zone 'Asia/Seoul')) then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+7 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d7,
    case when a.day+30<=(now() at time zone 'Asia/Seoul')::date-1 and (a.day+30)::timestamp at time zone 'Asia/Seoul'>=available and not exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<((a.day+30+1)::timestamp at time zone 'Asia/Seoul') and coalesce(g.ended_at,now())>((a.day+30)::timestamp at time zone 'Asia/Seoul')) then count(*) filter(where exists(select 1 from private.product_member_activity_days d where d.user_id=a.user_id and d.day=a.day+30 and d.core and (p_report<>'pwa' or d.execution_channel='pwa'))) end as d30
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

-- Service-only minimal facts. Raw identifiers never leave the Edge aggregate.
create function public.product_analytics_insights_source(p_actor uuid,p_filters jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='10s' as $$
declare
 start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul';
 end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
 floor_at timestamptz; available timestamptz; started timestamptz; enabled boolean; row_count integer;
begin
 if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 if start_at is null or end_at is null or end_at<=start_at or end_at-start_at>interval '90 days' or end_at>((date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')+interval '1 day') then raise exception 'INVALID_PERIOD';end if;
 select s.started_at,s.collection_enabled into started,enabled from private.product_analytics_settings s where key;
 available=greatest(started,now()-interval '90 days');
 if started is null then available=null;end if;
 floor_at=greatest(start_at-(end_at-start_at),available);
 select count(*) into row_count from (select 1 from private.product_usage_events e where available is not null and e.received_at>=floor_at and e.received_at<=now() limit 20001) bounded;
 if row_count>20000 then raise exception 'REPORT_TOO_LARGE';end if;
 if (select count(*) from (select 1 from private.product_member_first_usage limit 20001) bounded)>20000 then raise exception 'REPORT_TOO_LARGE';end if;
 return jsonb_build_object(
  'snapshot_at',now(),'available_from',available,'started_at',started,'collection_enabled',coalesce(enabled,false),
  'last_accepted_at',(select max(received_at) from private.product_usage_events),
  'events',(select coalesce(jsonb_agg(jsonb_build_object('actor_scope',e.actor_scope,'user_id',e.user_id,'session_id',e.session_id,'page_entry_id',e.page_entry_id,'received_at',e.received_at,'event_name',e.event_name,'feature',e.feature,'route',e.route,'execution_channel',e.execution_channel,'os_family',e.os_family,'device_class',e.device_class,'is_core',e.is_core,'attributes',e.attributes) order by e.received_at,e.event_id),'[]')
   from private.product_usage_events e where available is not null and e.received_at>=floor_at and e.received_at<=now()
    and (e.user_id is null or (exists(select 1 from auth.users u where u.id=e.user_id) and not exists(select 1 from private.admin_roles a where a.user_id=e.user_id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=e.user_id)))),
  'sessions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select s.session_id,max(s.last_activity_received_at) as last_activity_received_at,bool_or(s.uncertain_reason is not null) as uncertain from private.product_usage_session_state s where exists(select 1 from private.product_usage_events e where e.session_id=s.session_id and e.received_at>=floor_at) group by s.session_id) t),
  'first_usage',(select coalesce(jsonb_agg(jsonb_build_object('user_id',f.user_id,'first_usage_known',f.first_usage_known,'first_core_received_at',f.first_core_received_at,'first_pwa_core_received_at',f.first_pwa_core_received_at,'first_grading_received_at',f.first_grading_received_at)),'[]') from private.product_member_first_usage f join auth.users u on u.id=f.user_id where f.metric_version='1' and not exists(select 1 from private.admin_roles a where a.user_id=f.user_id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=f.user_id)),
  'gaps',(select coalesce(jsonb_agg(jsonb_build_object('started_at',g.started_at,'ended_at',g.ended_at)),'[]') from private.product_analytics_collection_gaps g where coalesce(g.ended_at,now())>=floor_at),
  'quality',(select jsonb_build_object('submitted',coalesce(sum(q.submitted),0),'accepted',coalesce(sum(q.accepted),0),'duplicate',coalesce(sum(q.duplicate),0),'rejected',coalesce(sum(q.rejected),0),'processing_failed',coalesce(sum(q.processing_failed),0)) from private.product_usage_ingestion_quality q where q.minute>=start_at and q.minute<end_at),
  'publications',(select jsonb_build_object('days',count(*),'first_day',min(p.day),'last_day',max(p.day),'published_at',max(p.published_at)) from private.product_usage_day_publications p where p.day>=(now() at time zone 'Asia/Seoul')::date-interval '25 months')
 );
end $$;
revoke all on function public.product_analytics_insights_source(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.product_analytics_insights_source(uuid,jsonb) to service_role;
revoke all on function public.product_analytics_ingest_v1(uuid,jsonb,text,integer),public.product_analytics_report(uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.product_analytics_ingest_v1(uuid,jsonb,text,integer),public.product_analytics_report(uuid,jsonb,text) to service_role;
commit;
