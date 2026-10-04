-- Local preparation only. No production application, scheduler, deletion policy or collection activation.
begin;
create table private.product_usage_fact_days (
  day date not null, metric_version text not null check(metric_version='1'),
  actor_scope text not null, user_id uuid, session_id uuid not null,
  execution_channel text not null check(execution_channel in ('pwa','browser','other','unknown')),
  feature text not null, event_name text not null, grading_run_id text not null default '',
  actions bigint not null check(actions>=0),
  primary key(day,metric_version,actor_scope,session_id,execution_channel,feature,event_name,grading_run_id)
);
create index product_fact_member_idx on private.product_usage_fact_days(user_id,day);
create table private.product_usage_day_publications (
  day date primary key, metric_version text not null check(metric_version='1'),
  status text not null check(status in ('complete','partial')),
  generation integer not null default 1, published_at timestamptz not null default now()
);
alter table private.product_usage_fact_days enable row level security;
alter table private.product_usage_day_publications enable row level security;
revoke all on private.product_usage_fact_days,private.product_usage_day_publications from public,anon,authenticated;
grant select,insert,update,delete on private.product_usage_fact_days to service_role;
grant select,insert,update on private.product_usage_day_publications to service_role;
create index product_admin_access_actor_idx on private.product_admin_access_logs(admin_user_id,received_at desc);
-- Existing report is read-only; a stable function shares the outer dashboard statement snapshot.
alter function public.product_analytics_report(uuid,jsonb,text) stable;

create function public.product_analytics_publish_days(p_actor uuid,p_start date,p_end date)
returns integer language plpgsql security invoker set search_path='' as $$
declare d date; first_at timestamptz; state text; n integer=0;
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  select started_at into first_at from private.product_analytics_settings where key;
  if first_at is null or p_start is null or p_end is null or p_end<p_start or p_end-p_start>89 or p_end>=(now() at time zone 'Asia/Seoul')::date
    or p_start::timestamp at time zone 'Asia/Seoul'<greatest(first_at,now()-interval '90 days') then raise exception 'ARCHIVE_SOURCE_UNAVAILABLE'; end if;
  for d in select generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')::date loop
    perform pg_advisory_xact_lock(hashtextextended('product_fact_day:'||d::text,0));
    state=case when exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<(d+1)::timestamp at time zone 'Asia/Seoul' and coalesce(g.ended_at,now())>d::timestamp at time zone 'Asia/Seoul') then 'partial' else 'complete' end;
    delete from private.product_usage_fact_days where day=d;
    insert into private.product_usage_fact_days(day,metric_version,actor_scope,user_id,session_id,execution_channel,feature,event_name,grading_run_id,actions)
      select d,'1',e.actor_scope,e.user_id,e.session_id,e.execution_channel,e.feature,case when e.event_name='mock_saved' and coalesce(e.attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(e.attributes->>'outcome','unknown') else e.event_name end,coalesce(e.attributes->>'grading_run_id',''),count(*)
      from private.product_usage_events e where e.received_at>=d::timestamp at time zone 'Asia/Seoul' and e.received_at<(d+1)::timestamp at time zone 'Asia/Seoul' and e.is_active and e.metric_version='1'
      group by e.actor_scope,e.user_id,e.session_id,e.execution_channel,e.feature,case when e.event_name='mock_saved' and coalesce(e.attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(e.attributes->>'outcome','unknown') else e.event_name end,coalesce(e.attributes->>'grading_run_id','');
    insert into private.product_usage_day_publications(day,metric_version,status) values(d,'1',state)
      on conflict(day) do update set status=excluded.status,metric_version=excluded.metric_version,generation=private.product_usage_day_publications.generation+1,published_at=now();
    n=n+1;
  end loop;
  return n;
end $$;

create function public.product_analytics_dashboard_source(p_actor uuid,p_start date,p_end date,p_current_start date,p_previous_end date,p_channel text default null,p_compare boolean default true)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare first_at timestamptz; available timestamptz; today date=(now() at time zone 'Asia/Seoul')::date; result jsonb; current_conversion jsonb; previous_conversion jsonb; f jsonb;
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_current_start is null or p_end<p_start or p_end-p_start>731 or p_end>today or p_current_start<p_start or p_current_start>p_end or (p_channel is not null and p_channel not in ('pwa','browser','other','unknown')) then raise exception 'INVALID_PERIOD'; end if;
  select started_at into first_at from private.product_analytics_settings where key;
  available=case when first_at is not null then greatest(first_at,now()-interval '90 days') end;
  with dates as (select generate_series(p_start::timestamp,p_end::timestamp,interval '1 day')::date as day union select today),
  coverage as (
    select d.day,
      case when available is not null and d.day::timestamp at time zone 'Asia/Seoul'>=available then 'raw'
           when pub.day is not null then 'archive' else 'raw_partial' end as source,
      case when available is not null and d.day::timestamp at time zone 'Asia/Seoul'>=available then
        case when d.day>=today or exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<(d.day+1)::timestamp at time zone 'Asia/Seoul' and coalesce(g.ended_at,now())>d.day::timestamp at time zone 'Asia/Seoul') then 'partial' else 'complete' end
        when pub.day is not null then pub.status
        when available is not null and (d.day+1)::timestamp at time zone 'Asia/Seoul'>available then 'partial' else 'unavailable' end as status
    from dates d left join private.product_usage_day_publications pub on pub.day=d.day and pub.metric_version='1' and pub.day>=(today-interval '25 months')::date
  ), raw as (
    select (e.received_at at time zone 'Asia/Seoul')::date as day,e.actor_scope,e.user_id,e.session_id,e.execution_channel,e.feature,case when e.event_name='mock_saved' and coalesce(e.attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(e.attributes->>'outcome','unknown') else e.event_name end as event_name,coalesce(e.attributes->>'grading_run_id','') as grading_run_id,count(*) as actions
    from private.product_usage_events e where available is not null and e.received_at>=available and e.is_active and e.metric_version='1'
      and ((e.received_at>=p_start::timestamp at time zone 'Asia/Seoul' and e.received_at<(p_end+1)::timestamp at time zone 'Asia/Seoul') or e.received_at>=today::timestamp at time zone 'Asia/Seoul')
    group by 1,e.actor_scope,e.user_id,e.session_id,e.execution_channel,e.feature,case when e.event_name='mock_saved' and coalesce(e.attributes->>'outcome','unknown')<>'success' then 'mock_save_'||coalesce(e.attributes->>'outcome','unknown') else e.event_name end,coalesce(e.attributes->>'grading_run_id','')
  ), facts as (
    select r.* from raw r join coverage c on c.day=r.day and c.source in ('raw','raw_partial') and c.status<>'unavailable'
    union all select a.day,a.actor_scope,a.user_id,a.session_id,a.execution_channel,a.feature,a.event_name,a.grading_run_id,a.actions
      from private.product_usage_fact_days a join coverage c on c.day=a.day and c.source='archive' where a.metric_version='1'
  ), eligible as (select f.* from facts f where f.user_id is null or (not exists(select 1 from private.admin_roles a where a.user_id=f.user_id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=f.user_id))),
  confirmed as (select (u.confirmed_at at time zone 'Asia/Seoul')::date as day,count(*) as count from auth.users u where u.confirmed_at>=p_start::timestamp at time zone 'Asia/Seoul' and u.confirmed_at<(p_end+1)::timestamp at time zone 'Asia/Seoul'
    and not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=u.id) group by 1)
  select jsonb_build_object('snapshot_at',now(),'facts',coalesce((select jsonb_agg(to_jsonb(e)) from eligible e),'[]'),'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'status',status) order by day) from coverage),'[]'),
    'confirmations',coalesce((select jsonb_agg(to_jsonb(c)) from confirmed c),'[]'),'started_at',first_at,'collection_enabled',(select collection_enabled from private.product_analytics_settings where key),
    'last_accepted_at',(select max(received_at) from private.product_usage_events)) into result;
  f=jsonb_build_object('start',p_current_start,'end',p_end)||case when p_channel is null then '{}'::jsonb else jsonb_build_object('channel',p_channel) end;
  if p_end-p_current_start<90 and available is not null and p_current_start::timestamp at time zone 'Asia/Seoul'>=available then current_conversion=public.product_analytics_report(p_actor,f,'grading')->'conversion'; end if;
  if p_compare and p_previous_end-p_start<90 and available is not null and p_start::timestamp at time zone 'Asia/Seoul'>=available then
    previous_conversion=public.product_analytics_report(p_actor,f||jsonb_build_object('start',p_start,'end',p_previous_end),'grading')->'conversion';
  end if;
  return result||jsonb_build_object('conversion',current_conversion,'previous_conversion',previous_conversion);
end $$;

create function public.product_analytics_member_options(p_actor uuid,p_purpose text,p_query text default '',p_after jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot timestamptz=now(); rows_json jsonb; next_value jsonb; after_id uuid; after_created timestamptz;
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if p_purpose is null or p_purpose not in ('member_activity','audit_target','audit_actor') then raise exception 'INVALID_PURPOSE'; end if;
  if p_query is null or length(p_query)>120 then raise exception 'INVALID_SEARCH'; end if;
  if p_after is not null then
    snapshot=(p_after->>'snapshot_at')::timestamptz; after_id=(p_after->>'user_id')::uuid; after_created=(p_after->>'created_at')::timestamptz;
    if snapshot is null or snapshot>now() or after_id is null or (p_purpose='member_activity' and after_created is null) then raise exception 'INVALID_CURSOR'; end if;
  end if;
  with targets as (
    select u.id from auth.users u where u.created_at<=snapshot and p_purpose in ('member_activity','audit_target')
      and not exists(select 1 from private.admin_roles a where a.user_id=u.id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=u.id)
    union select a.user_id from private.admin_roles a where p_purpose='audit_actor' and a.role='admin'
    union select case when p_purpose='audit_actor' then l.admin_user_id else l.target_user_id end from private.product_admin_access_logs l
      where p_purpose in ('audit_actor','audit_target') and l.received_at<=snapshot and l.received_at>=snapshot-interval '13 months'
    union select jsonb_array_elements_text(l.filters->'target_user_ids')::uuid from private.product_admin_access_logs l
      where p_purpose='audit_target' and l.received_at<=snapshot and l.received_at>=snapshot-interval '13 months' and jsonb_typeof(l.filters->'target_user_ids')='array'
  ), matched as (
    select t.id as user_id,u.raw_user_meta_data->>'name' as name,u.email,u.created_at,
      case when u.id is null then 'missing' else 'available' end as account_info_status,
      exists(select 1 from private.admin_roles a where a.user_id=t.id and a.role='admin') as is_current_admin
    from targets t left join auth.users u on u.id=t.id where t.id is not null
      and (p_query='' or strpos(lower(coalesce(u.email,'')),lower(p_query))>0 or strpos(lower(coalesce(u.raw_user_meta_data->>'name','')),lower(p_query))>0 or t.id::text=lower(p_query))
      and (after_id is null or (p_purpose='member_activity' and (u.created_at,t.id)<(after_created,after_id)) or (p_purpose<>'member_activity' and t.id>after_id))
  ), page as (
    select *,row_number() over(order by case when p_purpose='member_activity' then created_at end desc,case when p_purpose='member_activity' then user_id end desc,case when p_purpose<>'member_activity' then user_id end asc) as rn
    from matched order by case when p_purpose='member_activity' then created_at end desc,case when p_purpose='member_activity' then user_id end desc,case when p_purpose<>'member_activity' then user_id end asc limit 51
  )
  select coalesce(jsonb_agg(to_jsonb(page)-'rn' order by rn) filter(where rn<=50),'[]'),
    case when count(*)>50 then (jsonb_agg(jsonb_build_object('user_id',user_id,'created_at',created_at,'snapshot_at',snapshot)) filter(where rn=50))->0 end into rows_json,next_value from page;
  insert into private.product_admin_access_logs(admin_user_id,kind,filters,returned_count,status) values(p_actor,'member_options',jsonb_build_object('purpose',p_purpose,'search_performed',p_query<>'','search_kind',case when p_query='' then 'none' else 'name_email_uuid' end,'sort_version','1','snapshot_at',snapshot),jsonb_array_length(rows_json),'provided');
  return jsonb_build_object('items',rows_json,'next_cursor',next_value,'purpose',p_purpose,'sort_version','1','snapshot_at',snapshot,'audit_available_from',case when p_purpose<>'member_activity' then now()-interval '13 months' end);
end $$;

create function public.product_analytics_activity_feed(p_actor uuid,p_filters jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul'; end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul'; available timestamptz; actual_start timestamptz; actual_end timestamptz; state text; rows_json jsonb; targets jsonb;
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  if start_at is null or end_at is null or end_at<=start_at or end_at-start_at>interval '366 days' then raise exception 'INVALID_PERIOD'; end if;
  select greatest(started_at,now()-interval '90 days') into available from private.product_analytics_settings where key and started_at is not null;
  actual_start=greatest(start_at,available); actual_end=least(end_at,now());
  state=case when available is null or actual_end<=actual_start then 'unavailable' when start_at<available or end_at>now() or exists(select 1 from private.product_analytics_collection_gaps g where g.started_at<end_at and coalesce(g.ended_at,now())>start_at) then 'partial' else 'complete' end;
  with page as (
    select to_jsonb(e)-'actor_scope'-'semantic_key'-'is_active'-'is_core' || jsonb_build_object('name',u.raw_user_meta_data->>'name','email',u.email) as row,e.received_at,e.event_id,e.user_id
    from private.product_usage_events e left join auth.users u on u.id=e.user_id
    where state<>'unavailable' and e.user_id is not null and e.received_at>=actual_start and e.received_at<actual_end and e.is_active and private.product_analytics_matches(e,p_filters)
      and e.event_name in ('grading_completed','grading_result_viewed','history_save_outcome','past_exam_file_clicked','reference_opened','question_distribution_opened','history_viewed','history_trend_viewed','mock_saved','admission_completed','admission_result_viewed')
      and not exists(select 1 from private.admin_roles a where a.user_id=e.user_id and a.role='admin') and not exists(select 1 from private.product_analytics_test_accounts t where t.user_id=e.user_id)
    order by e.received_at desc,e.event_id desc limit 20
  ) select coalesce(jsonb_agg(row order by received_at desc,event_id desc),'[]'),coalesce(jsonb_agg(distinct user_id),'[]') into rows_json,targets from page;
  insert into private.product_admin_access_logs(admin_user_id,kind,filters,returned_count,status) values(p_actor,'activity_feed',p_filters||jsonb_build_object('target_user_ids',targets),jsonb_array_length(rows_json),'provided');
  return jsonb_build_object('items',rows_json,'snapshot_at',now(),'start',case when state<>'unavailable' then actual_start end,'end',case when state<>'unavailable' then actual_end end,'status',state,'coverage',jsonb_build_object('available_from',available,'available_through',now(),'coverage_status',state));
end $$;

create or replace function public.product_analytics_access_history(p_actor uuid,p_filters jsonb,p_target uuid default null,p_admin uuid default null,p_before bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare rows_json jsonb; next_id bigint; start_at timestamptz=(p_filters->>'start')::date::timestamp at time zone 'Asia/Seoul'; end_at timestamptz=((p_filters->>'end')::date+1)::timestamp at time zone 'Asia/Seoul';
begin
  if not exists(select 1 from private.admin_roles where user_id=p_actor and role='admin') then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
  with page as (select l.*,row_number() over(order by id desc) as rn from private.product_admin_access_logs l where received_at>=start_at and received_at<end_at and (p_target is null or target_user_id=p_target or l.filters->'target_user_ids' @> jsonb_build_array(p_target::text)) and (p_admin is null or admin_user_id=p_admin) and (p_before is null or id<p_before) and (not(p_filters ? 'kind') or l.kind=p_filters->>'kind') order by id desc limit 101)
  select coalesce(jsonb_agg(to_jsonb(page)-'rn' order by id desc) filter(where rn<=100),'[]'), case when count(*)>100 then max(id) filter(where rn=100) end into rows_json,next_id from page;
  if jsonb_array_length(rows_json)<100 then next_id=null; end if;
  insert into private.product_admin_access_logs(admin_user_id,kind,filters,returned_count,status) values(p_actor,'admin_access_history',p_filters||jsonb_strip_nulls(jsonb_build_object('target_user_id',p_target,'admin_user_id',p_admin)),jsonb_array_length(rows_json),'provided');
  return jsonb_build_object('items',rows_json,'next_cursor',next_id::text);
end $$;

revoke all on function public.product_analytics_publish_days(uuid,date,date),public.product_analytics_dashboard_source(uuid,date,date,date,date,text,boolean),public.product_analytics_member_options(uuid,text,text,jsonb),public.product_analytics_activity_feed(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.product_analytics_publish_days(uuid,date,date),public.product_analytics_dashboard_source(uuid,date,date,date,date,text,boolean),public.product_analytics_member_options(uuid,text,text,jsonb),public.product_analytics_activity_feed(uuid,jsonb) to service_role;
commit;
