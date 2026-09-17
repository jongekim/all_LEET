-- Additive only: no grading history, auth, Edge Function, cron or trigger changes.
create table private.exam_answer_key_versions (
  id bigint generated always as identity primary key,
  year text not null,
  subject text not null check (subject in ('verbal','reasoning')),
  exam_type text not null check (exam_type in ('odd','even')),
  version text not null,
  question_count smallint not null check (question_count between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default current_timestamp,
  unique (year,subject,exam_type,version)
);
create unique index exam_answer_key_versions_active on private.exam_answer_key_versions(year,subject,exam_type) where is_active;
create table private.exam_question_answer_keys (
  answer_key_id bigint not null references private.exam_answer_key_versions(id),
  question_no smallint not null check (question_no between 1 and 40),
  correct_answer smallint not null check (correct_answer between 1 and 5),
  primary key (answer_key_id,question_no)
);
create table private.question_statistics_runs (
  id bigint generated always as identity primary key,
  aggregation_version text not null check (aggregation_version='all_saved_records_v1'),
  source_snapshot_at timestamptz not null,
  published_at timestamptz not null default current_timestamp,
  source_count bigint not null check (source_count between 0 and 9007199254740991),
  included_count bigint not null check (included_count=source_count),
  quarantined_count bigint not null check (quarantined_count=0),
  artifact_checksum text not null unique check (artifact_checksum ~ '^[0-9a-f]{64}$'),
  artifact jsonb not null check (jsonb_typeof(artifact)='object'),
  code_revision text not null,
  operator text not null check (length(trim(operator))>0),
  reason text not null check (length(trim(reason))>0),
  publication_events jsonb not null default '[]'::jsonb check (jsonb_typeof(publication_events)='array')
);

create function private.question_statistics_items_valid(items jsonb,n bigint,q smallint)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb; value jsonb; i int:=0; total numeric;
begin
  if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)<>q then return false; end if;
  for item in select x.value from jsonb_array_elements(items) x loop
    i:=i+1;
    if jsonb_typeof(item)<>'object' or item->'question_no' is distinct from to_jsonb(i)
      or jsonb_typeof(item->'choice_counts') is distinct from 'array'
      or jsonb_array_length(item->'choice_counts')<>5 then return false; end if;
    total:=0;
    for value in select x.value from jsonb_array_elements(item->'choice_counts') x
      union all select item->'unanswered_count' loop
      if jsonb_typeof(value) is distinct from 'number' or value::text !~ '^[0-9]+$'
        or (value::text)::numeric>9007199254740991 then return false; end if;
      total:=total+(value::text)::numeric;
    end loop;
    if total<>n then return false; end if;
  end loop;
  return true;
end;
$$;

create table public.question_statistics_snapshots (
  snapshot_id bigint not null references private.question_statistics_runs(id),
  year text not null,
  subject text not null check (subject in ('verbal','reasoning')),
  exam_type text not null check (exam_type in ('odd','even')),
  answer_key_id bigint not null references private.exam_answer_key_versions(id),
  answer_key_version text not null,
  aggregation_version text not null check (aggregation_version='all_saved_records_v1'),
  question_count smallint not null check (question_count between 1 and 40),
  sample_count bigint not null check (sample_count between 0 and 9007199254740991),
  items jsonb not null,
  source_snapshot_at timestamptz not null,
  published_at timestamptz not null default current_timestamp,
  primary key (snapshot_id,year,subject,exam_type),
  check (private.question_statistics_items_valid(items,sample_count,question_count))
);
create index question_statistics_snapshots_answer_key on public.question_statistics_snapshots(answer_key_id);
create table public.question_statistics_publication (
  key text primary key check (key='current'),
  snapshot_id bigint not null references private.question_statistics_runs(id),
  released_at timestamptz not null default current_timestamp
);
create index question_statistics_publication_snapshot on public.question_statistics_publication(snapshot_id);

alter table private.exam_answer_key_versions enable row level security;
alter table private.exam_question_answer_keys enable row level security;
alter table private.question_statistics_runs enable row level security;
alter table public.question_statistics_snapshots enable row level security;
alter table public.question_statistics_publication enable row level security;
revoke all on private.exam_answer_key_versions,private.exam_question_answer_keys,private.question_statistics_runs from public,anon,authenticated,service_role;
revoke all on public.question_statistics_snapshots,public.question_statistics_publication from public,anon,authenticated,service_role;
revoke all on sequence private.exam_answer_key_versions_id_seq,private.question_statistics_runs_id_seq from public,anon,authenticated,service_role;
grant select on public.question_statistics_snapshots,public.question_statistics_publication to anon,authenticated;
create policy question_statistics_current_pointer on public.question_statistics_publication for select to anon,authenticated using (true);
create policy question_statistics_current_snapshot on public.question_statistics_snapshots for select to anon,authenticated
  using (snapshot_id=(select p.snapshot_id from public.question_statistics_publication p where p.key='current'));

create function private.publish_question_statistics(a jsonb,expected_current text,performed_by text,change_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_id bigint; new_id bigint; key_id bigint; c jsonb; row_data jsonb; q int; n bigint; count_sum bigint:=0;
  expected_q int; v text; existing_artifact jsonb; combinations int; source_at timestamptz;
begin
  if not pg_try_advisory_xact_lock(170926,1) then raise exception 'Another statistics publication is running'; end if;
  if nullif(trim(performed_by),'') is null or nullif(trim(change_reason),'') is null then raise exception 'Operator and reason required'; end if;
  if a->>'project_ref' is distinct from 'jkxxtyaanyhmjbdtybkp' or a->>'aggregation_version' is distinct from 'all_saved_records_v1'
    or a->>'artifact_checksum' is null or a->>'artifact_checksum' !~ '^[0-9a-f]{64}$'
    or nullif(a->>'code_revision','') is null or jsonb_typeof(a->'catalog') is distinct from 'array'
    or jsonb_typeof(a->'cohorts') is distinct from 'array' then raise exception 'Invalid artifact metadata'; end if;
  source_at:=(a->>'source_snapshot_at')::timestamptz;
  if source_at is null or source_at>current_timestamp+interval '5 minutes' then raise exception 'Invalid source timestamp'; end if;
  if (a->>'quarantined_count')::bigint is distinct from 0 or (a->>'malformed_histories')::bigint is distinct from 0
    or (a->>'source_count')::bigint is distinct from (a->>'included_count')::bigint then raise exception 'Unexpected source data must be reviewed'; end if;
  if jsonb_array_length(a->'catalog')<>76 or jsonb_array_length(a->'cohorts')<>76 then raise exception 'All 76 exam combinations required'; end if;
  select count(distinct (x->>'year',x->>'subject',x->>'exam_type')) into combinations from jsonb_array_elements(a->'catalog') x;
  if combinations<>76 then raise exception 'Duplicate answer key combination'; end if;
  select count(distinct (x->>'year',x->>'subject',x->>'exam_type')) into combinations from jsonb_array_elements(a->'cohorts') x;
  if combinations<>76 then raise exception 'Duplicate cohort'; end if;
  select p.snapshot_id into current_id from public.question_statistics_publication p where p.key='current';
  select r.id,r.artifact into new_id,existing_artifact from private.question_statistics_runs r where r.artifact_checksum=a->>'artifact_checksum';
  if new_id is not null then
    if existing_artifact<>a then raise exception 'Checksum reused for different content'; end if;
    if current_id=new_id then return jsonb_build_object('snapshot_id',new_id::text,'already_published',true); end if;
    raise exception 'Existing generation is not current; use rollback explicitly';
  end if;
  if coalesce(current_id::text,'none') is distinct from expected_current then raise exception 'Current generation changed; check status first'; end if;
  for c in select x.value from jsonb_array_elements(a->'catalog') x loop
    if c->>'year' is null or not(c->>'year'='09예비' or c->>'year'=any(array(select generate_series(2009,2026)::text)))
      or c->>'subject' is null or c->>'subject' not in ('verbal','reasoning')
      or c->>'exam_type' is null or c->>'exam_type' not in ('odd','even') then raise exception 'Unsupported exam combination'; end if;
    expected_q:=case when c->>'year' in ('09예비','2009') then 40
      when (c->>'year')::int<=2018 then 35 when c->>'subject'='verbal' then 30 else 40 end;
    q:=(c->>'question_count')::int;
    if q is distinct from expected_q or jsonb_typeof(c->'correct_answers') is distinct from 'array'
      or jsonb_array_length(c->'correct_answers')<>q then raise exception 'Invalid question count'; end if;
    if exists(select 1 from jsonb_array_elements(c->'correct_answers') x where jsonb_typeof(x) is distinct from 'number' or x::text !~ '^[1-5]$') then raise exception 'Invalid correct answer'; end if;
    select 'v1:'||string_agg(x.value::text,'' order by x.ordinality) into v from jsonb_array_elements(c->'correct_answers') with ordinality x;
    if c->>'answer_key_version' is distinct from v then raise exception 'Answer key fingerprint mismatch'; end if;
    select x.value into row_data from jsonb_array_elements(a->'cohorts') x where x.value->>'year'=c->>'year' and x.value->>'subject'=c->>'subject' and x.value->>'exam_type'=c->>'exam_type';
    n:=(row_data->>'sample_count')::bigint;
    if row_data is null or row_data->>'answer_key_version' is distinct from v or (row_data->>'question_count')::int is distinct from q
      or n is null or n<0 or n>9007199254740991 or not private.question_statistics_items_valid(row_data->'items',n,q::smallint)
      then raise exception 'Invalid question distribution'; end if;
    count_sum:=count_sum+n;
  end loop;
  if count_sum is distinct from (a->>'included_count')::bigint then raise exception 'Cohort sum differs from source count'; end if;
  insert into private.question_statistics_runs(aggregation_version,source_snapshot_at,source_count,included_count,quarantined_count,artifact_checksum,artifact,code_revision,operator,reason,publication_events)
    values(a->>'aggregation_version',source_at,(a->>'source_count')::bigint,(a->>'included_count')::bigint,0,a->>'artifact_checksum',a,a->>'code_revision',performed_by,change_reason,
      jsonb_build_array(jsonb_build_object('action','publish','at',current_timestamp,'operator',performed_by,'reason',change_reason,'previous_id',current_id::text))) returning id into new_id;
  for c in select x.value from jsonb_array_elements(a->'catalog') x loop
    update private.exam_answer_key_versions k set is_active=false where k.year=c->>'year' and k.subject=c->>'subject' and k.exam_type=c->>'exam_type' and k.is_active;
    insert into private.exam_answer_key_versions(year,subject,exam_type,version,question_count)
      values(c->>'year',c->>'subject',c->>'exam_type',c->>'answer_key_version',(c->>'question_count')::smallint)
      on conflict(year,subject,exam_type,version) do update set is_active=true returning id into key_id;
    insert into private.exam_question_answer_keys(answer_key_id,question_no,correct_answer)
      select key_id,x.ordinality::smallint,(x.value::text)::smallint from jsonb_array_elements(c->'correct_answers') with ordinality x
      on conflict(answer_key_id,question_no) do nothing;
    select x.value into row_data from jsonb_array_elements(a->'cohorts') x where x.value->>'year'=c->>'year' and x.value->>'subject'=c->>'subject' and x.value->>'exam_type'=c->>'exam_type';
    insert into public.question_statistics_snapshots(snapshot_id,year,subject,exam_type,answer_key_id,answer_key_version,aggregation_version,question_count,sample_count,items,source_snapshot_at)
      values(new_id,c->>'year',c->>'subject',c->>'exam_type',key_id,c->>'answer_key_version',a->>'aggregation_version',(c->>'question_count')::smallint,(row_data->>'sample_count')::bigint,row_data->'items',source_at);
  end loop;
  insert into public.question_statistics_publication(key,snapshot_id) values('current',new_id)
    on conflict(key) do update set snapshot_id=excluded.snapshot_id,released_at=current_timestamp;
  return jsonb_build_object('snapshot_id',new_id::text,'previous_id',current_id::text,'already_published',false);
end;
$$;

create function private.rollback_question_statistics(target_id bigint,expected_current text,performed_by text,change_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_id bigint;
begin
  if not pg_try_advisory_xact_lock(170926,1) then raise exception 'Another statistics publication is running'; end if;
  if nullif(trim(performed_by),'') is null or nullif(trim(change_reason),'') is null then raise exception 'Operator and reason required'; end if;
  select p.snapshot_id into current_id from public.question_statistics_publication p where p.key='current';
  if current_id=target_id then return jsonb_build_object('snapshot_id',target_id::text,'already_current',true); end if;
  if coalesce(current_id::text,'none') is distinct from expected_current then raise exception 'Current generation changed'; end if;
  if not exists(select 1 from private.question_statistics_runs r where r.id=target_id)
    or (select count(*) from public.question_statistics_snapshots s where s.snapshot_id=target_id)<>76 then raise exception 'Incomplete or missing target generation'; end if;
  update public.question_statistics_publication set snapshot_id=target_id,released_at=current_timestamp where key='current';
  if not found then raise exception 'No current publication'; end if;
  update private.question_statistics_runs set publication_events=publication_events||jsonb_build_array(jsonb_build_object('action','rollback','at',current_timestamp,'operator',performed_by,'reason',change_reason,'previous_id',current_id::text)) where id=target_id;
  return jsonb_build_object('snapshot_id',target_id::text,'previous_id',current_id::text,'already_current',false);
end;
$$;
revoke all on function private.question_statistics_items_valid(jsonb,bigint,smallint) from public,anon,authenticated,service_role;
revoke all on function private.publish_question_statistics(jsonb,text,text,text) from public,anon,authenticated,service_role;
revoke all on function private.rollback_question_statistics(bigint,text,text,text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
