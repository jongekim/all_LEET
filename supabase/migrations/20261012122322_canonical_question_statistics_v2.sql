-- Additive V2. V1 and private grading histories remain unchanged.
create function private.statistics_json_v2(v jsonb) returns text language plpgsql immutable security invoker set search_path='' as $$
declare result text;
begin
  if jsonb_typeof(v)='object' then
    select '{'||coalesce(string_agg(to_jsonb(x.key)::text||':'||private.statistics_json_v2(x.value),',' order by x.key collate "C"),'')||'}' into result from jsonb_each(v) x;
  elsif jsonb_typeof(v)='array' then
    select '['||coalesce(string_agg(private.statistics_json_v2(x.value),',' order by x.ordinality),'')||']' into result from jsonb_array_elements(v) with ordinality x;
  else result:=v::text; end if;
  return result;
end; $$;
create function private.statistics_hash_v2(v jsonb) returns text language sql immutable security invoker set search_path='' as $$
  select encode(sha256(convert_to(private.statistics_json_v2(v),'UTF8')),'hex')
$$;
create function private.statistics_count_v2(v jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
  select coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$' and (v::text)::numeric between 0 and 9007199254740991,false)
$$;
create function private.statistics_catalog_valid_v2(c jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare row_data jsonb; q jsonb; i int; expected int; combination_count int; mapping jsonb; key_version text;
begin
  if jsonb_typeof(c) is distinct from 'object' or c->>'aggregation_version' is distinct from 'pooled_saved_answers_v2'
    or jsonb_typeof(c->'mapping_version') is distinct from 'string' or nullif(c->>'mapping_version','') is null or c->>'mapping_sha256' is null or c->>'mapping_sha256' !~ '^[0-9a-f]{64}$'
    or c->>'catalog_sha256' is distinct from private.statistics_hash_v2(c-'catalog_id'-'catalog_sha256')
    or c->>'catalog_id' is distinct from 'leet-'||(c->>'catalog_sha256')
    or jsonb_typeof(c->'cohorts') is distinct from 'array' or jsonb_array_length(c->'cohorts')<>38
    or c->'excluded_cohorts' is distinct from '[{"year":"2027","subject":"verbal","question_count":30},{"year":"2027","subject":"reasoning","question_count":40}]'::jsonb then return false; end if;
  select count(distinct(x->>'year',x->>'subject')) into combination_count from jsonb_array_elements(c->'cohorts') x;
  if combination_count<>38 then return false; end if;
  mapping:='[]'::jsonb;
  for row_data in select x.value from jsonb_array_elements(c->'cohorts') x loop
    if jsonb_typeof(row_data->'year') is distinct from 'string' or row_data->>'year' is null or not(row_data->>'year'='09예비' or row_data->>'year'=any(array(select generate_series(2009,2026)::text)))
      or row_data->>'subject' is null or row_data->>'subject' not in ('verbal','reasoning') then return false; end if;
    expected:=case when row_data->>'year' in ('09예비','2009') then 40 when (row_data->>'year')::int<=2018 then 35 when row_data->>'subject'='verbal' then 30 else 40 end;
    if not private.statistics_count_v2(row_data->'question_count') or row_data->'question_count' is distinct from to_jsonb(expected) or jsonb_typeof(row_data->'questions') is distinct from 'array' or jsonb_array_length(row_data->'questions')<>expected then return false; end if;
    select count(distinct x->>'odd_question_no') into combination_count from jsonb_array_elements(row_data->'questions') x;
    if combination_count<>expected then return false; end if;
    i:=0;key_version:='v1:';
    for q in select x.value from jsonb_array_elements(row_data->'questions') x loop
      i:=i+1;
      if q->>'question_id' is distinct from (case when row_data->>'year'='09예비' then '2009-preliminary' else row_data->>'year' end)||':'||(row_data->>'subject')||':E'||lpad(i::text,2,'0')
        or not private.statistics_count_v2(q->'odd_question_no') or (q->>'odd_question_no')::int not between 1 and expected
        or q->'correct_answer' is null or (q->'correct_answer')::text !~ '^[1-5]$' or q->'correct_answer' not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb)
        or jsonb_typeof(q->'odd_choice_to_even') is distinct from 'array' or jsonb_array_length(q->'odd_choice_to_even')<>5 then return false; end if;
      if exists(select 1 from jsonb_array_elements(q->'odd_choice_to_even') x where x.value::text !~ '^[1-5]$') then return false; end if;
      if (select jsonb_agg(x.value order by x.value) from jsonb_array_elements(q->'odd_choice_to_even') x) is distinct from '[1,2,3,4,5]'::jsonb then return false; end if;
      key_version:=key_version||(q->>'correct_answer');
    end loop;
    if row_data->>'answer_key_version' is distinct from key_version then return false; end if;
    mapping:=mapping||jsonb_build_array(jsonb_build_object('year',row_data->>'year','subject',row_data->>'subject','questions',(select jsonb_agg(x.value-'correct_answer' order by x.ordinality) from jsonb_array_elements(row_data->'questions') with ordinality x)));
  end loop;
  return coalesce(c->>'mapping_sha256'=private.statistics_hash_v2(mapping),false);
exception when others then return false;
end; $$;
create table private.question_statistics_catalogs_v2 (
  catalog_id text primary key, catalog_sha256 text not null unique check(catalog_sha256 ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check(private.statistics_catalog_valid_v2(payload)),
  approved_at timestamptz not null default current_timestamp, operator text not null check(length(trim(operator))>0), reason text not null check(length(trim(reason))>0),
  revoked_at timestamptz, check(catalog_id=payload->>'catalog_id' and catalog_sha256=payload->>'catalog_sha256')
);
create function private.statistics_catalog_immutable_v2() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_op='DELETE' or (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then raise exception 'Approved catalog is immutable; register a new catalog'; end if;
  return new;
end; $$;
create trigger statistics_catalog_immutable_v2 before update or delete on private.question_statistics_catalogs_v2 for each row execute function private.statistics_catalog_immutable_v2();
create table private.question_statistics_runs_v2 (
  id bigint generated always as identity primary key,catalog_id text not null references private.question_statistics_catalogs_v2(catalog_id),
  source_snapshot_at timestamptz not null,published_at timestamptz not null default current_timestamp,
  source_count bigint not null check(source_count between 0 and 9007199254740991),included_count bigint not null check(included_count between 0 and 9007199254740991),
  excluded_out_of_scope_count bigint not null check(excluded_out_of_scope_count between 0 and 9007199254740991),excluded_missing_answers_count bigint not null check(excluded_missing_answers_count between 0 and 9007199254740991),
  artifact_checksum text not null unique check(artifact_checksum ~ '^[0-9a-f]{64}$'),artifact jsonb not null,operator text not null check(length(trim(operator))>0),reason text not null check(length(trim(reason))>0),
  publication_events jsonb not null default '[]'::jsonb,
  check(source_count=included_count+excluded_out_of_scope_count+excluded_missing_answers_count)
);
create function private.statistics_items_valid_v2(items jsonb,n bigint,questions jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare item jsonb;q jsonb;v jsonb;i int:=0;total numeric;
begin
  if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items)<>jsonb_array_length(questions) then return false; end if;
  for item in select x.value from jsonb_array_elements(items) x loop
    q:=questions->i;i:=i+1;
    if jsonb_typeof(item) is distinct from 'object' or (item-array['question_id','correct_answer','choice_counts','unanswered_count']) is distinct from '{}'::jsonb
      or item->'question_id' is distinct from q->'question_id' or item->'correct_answer' is distinct from q->'correct_answer'
      or jsonb_typeof(item->'choice_counts') is distinct from 'array' or jsonb_array_length(item->'choice_counts')<>5 then return false; end if;
    total:=0;
    for v in select x.value from jsonb_array_elements(item->'choice_counts') x union all select item->'unanswered_count' loop
      if not private.statistics_count_v2(v) then return false; end if;total:=total+(v::text)::numeric;
    end loop;
    if total<>n then return false; end if;
  end loop;return true;
exception when others then return false;
end; $$;
create table public.question_statistics_snapshots_v2 (
  snapshot_id bigint not null references private.question_statistics_runs_v2(id),year text not null,subject text not null check(subject in ('verbal','reasoning')),
  question_count smallint not null check(question_count between 30 and 40),sample_count bigint not null check(sample_count between 0 and 9007199254740991),items jsonb not null check(jsonb_typeof(items)='array'),
  catalog_id text not null references private.question_statistics_catalogs_v2(catalog_id),catalog_sha256 text not null,mapping_version text not null,mapping_sha256 text not null,answer_key_version text not null,
  aggregation_version text not null check(aggregation_version='pooled_saved_answers_v2'),source_snapshot_at timestamptz not null,published_at timestamptz not null default current_timestamp,
  primary key(snapshot_id,year,subject)
);
create index question_statistics_snapshots_v2_catalog on public.question_statistics_snapshots_v2(catalog_id);
create table public.question_statistics_publication_v2 (
  key text primary key check(key='current'),snapshot_id bigint not null references private.question_statistics_runs_v2(id),released_at timestamptz not null default current_timestamp
);
create index question_statistics_publication_v2_snapshot on public.question_statistics_publication_v2(snapshot_id);
alter table private.question_statistics_catalogs_v2 enable row level security;
alter table private.question_statistics_runs_v2 enable row level security;
alter table public.question_statistics_snapshots_v2 enable row level security;
alter table public.question_statistics_publication_v2 enable row level security;
revoke all on private.question_statistics_catalogs_v2,private.question_statistics_runs_v2,public.question_statistics_snapshots_v2,public.question_statistics_publication_v2 from public,anon,authenticated,service_role;
revoke all on sequence private.question_statistics_runs_v2_id_seq from public,anon,authenticated,service_role;
grant select on public.question_statistics_snapshots_v2,public.question_statistics_publication_v2 to anon,authenticated;
create policy statistics_pointer_v2 on public.question_statistics_publication_v2 for select to anon,authenticated using(true);
create policy statistics_current_v2 on public.question_statistics_snapshots_v2 for select to anon,authenticated using(snapshot_id=(select p.snapshot_id from public.question_statistics_publication_v2 p where p.key='current'));

create function private.register_question_statistics_catalog_v2(c jsonb,performed_by text,change_reason text) returns text language plpgsql security invoker set search_path='' as $$
declare existing jsonb;revoked timestamptz;
begin
  if not pg_try_advisory_xact_lock(170926,2) then raise exception 'Another V2 operation is running'; end if;
  if nullif(trim(performed_by),'') is null or nullif(trim(change_reason),'') is null or not private.statistics_catalog_valid_v2(c) then raise exception 'Invalid catalog/approval metadata'; end if;
  select payload,revoked_at into existing,revoked from private.question_statistics_catalogs_v2 where catalog_id=c->>'catalog_id';
  if revoked is not null then raise exception 'Revoked catalog cannot be reapproved'; end if;
  if existing is not null and existing is distinct from c then raise exception 'Immutable catalog already exists'; end if;
  insert into private.question_statistics_catalogs_v2(catalog_id,catalog_sha256,payload,operator,reason) values(c->>'catalog_id',c->>'catalog_sha256',c,performed_by,change_reason) on conflict do nothing;
  return c->>'catalog_id';
end; $$;
create function private.statistics_artifact_valid_v2(a jsonb,c jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare row_data jsonb;expected jsonb;key text;n bigint;total numeric:=0;combinations int;
begin
  if a->'catalog' is distinct from c or a->>'project_ref' is distinct from 'jkxxtyaanyhmjbdtybkp' or a->>'aggregation_version' is distinct from 'pooled_saved_answers_v2'
    or a->>'artifact_checksum' is distinct from private.statistics_hash_v2(a-'artifact_checksum') or nullif(a->>'code_revision','') is null
    or a->'invalid_count' is distinct from '0'::jsonb or a->'malformed_histories' is distinct from '0'::jsonb
    or jsonb_typeof(a->'cohorts') is distinct from 'array' or jsonb_array_length(a->'cohorts')<>38 then return false; end if;
  foreach key in array array['source_count','included_count','excluded_out_of_scope_count','excluded_missing_answers_count'] loop if not private.statistics_count_v2(a->key) then return false; end if; end loop;
  if (a->>'source_count')::numeric<>(a->>'included_count')::numeric+(a->>'excluded_out_of_scope_count')::numeric+(a->>'excluded_missing_answers_count')::numeric then return false; end if;
  select count(distinct(x->>'year',x->>'subject')) into combinations from jsonb_array_elements(a->'cohorts') x;
  if combinations<>38 then return false; end if;
  for expected in select x.value from jsonb_array_elements(c->'cohorts') x loop
    select x.value into row_data from jsonb_array_elements(a->'cohorts') x where x.value->>'year'=expected->>'year' and x.value->>'subject'=expected->>'subject';
    if row_data is null or row_data->'question_count' is distinct from expected->'question_count' or row_data->'answer_key_version' is distinct from expected->'answer_key_version' or not private.statistics_count_v2(row_data->'sample_count') then return false; end if;
    n:=(row_data->>'sample_count')::bigint;
    if not private.statistics_items_valid_v2(row_data->'items',n,expected->'questions') then return false; end if;total:=total+n;
  end loop;return total=(a->>'included_count')::numeric;
exception when others then return false;
end; $$;
create function private.publish_question_statistics_v2(a jsonb,expected_current text,performed_by text,change_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb;current_id bigint;new_id bigint;existing jsonb;row_data jsonb;source_at timestamptz;
begin
  if not pg_try_advisory_xact_lock(170926,2) then raise exception 'Another V2 operation is running'; end if;
  if nullif(trim(performed_by),'') is null or nullif(trim(change_reason),'') is null then raise exception 'Operator and reason required'; end if;
  select payload into c from private.question_statistics_catalogs_v2 where catalog_id=a->'catalog'->>'catalog_id' and revoked_at is null;
  if c is null or not private.statistics_artifact_valid_v2(a,c) then raise exception 'Unapproved catalog or invalid artifact'; end if;
  source_at:=(a->>'source_snapshot_at')::timestamptz;
  if source_at is null or not isfinite(source_at) or source_at>current_timestamp+interval '5 minutes' then raise exception 'Invalid source timestamp'; end if;
  select snapshot_id into current_id from public.question_statistics_publication_v2 where key='current';
  select id,artifact into new_id,existing from private.question_statistics_runs_v2 where artifact_checksum=a->>'artifact_checksum';
  if new_id is not null then
    if existing is distinct from a then raise exception 'Checksum reused'; end if;
    if new_id=current_id then return jsonb_build_object('snapshot_id',new_id::text,'already_published',true); end if;
    raise exception 'Use explicit rollback for an existing generation';
  end if;
  if coalesce(current_id::text,'none') is distinct from expected_current then raise exception 'Current generation changed'; end if;
  insert into private.question_statistics_runs_v2(catalog_id,source_snapshot_at,source_count,included_count,excluded_out_of_scope_count,excluded_missing_answers_count,artifact_checksum,artifact,operator,reason,publication_events)
  values(c->>'catalog_id',source_at,(a->>'source_count')::bigint,(a->>'included_count')::bigint,(a->>'excluded_out_of_scope_count')::bigint,(a->>'excluded_missing_answers_count')::bigint,a->>'artifact_checksum',a,performed_by,change_reason,jsonb_build_array(jsonb_build_object('action','publish','at',current_timestamp,'operator',performed_by,'reason',change_reason,'previous_id',current_id::text))) returning id into new_id;
  for row_data in select x.value from jsonb_array_elements(a->'cohorts') x loop
    insert into public.question_statistics_snapshots_v2(snapshot_id,year,subject,question_count,sample_count,items,catalog_id,catalog_sha256,mapping_version,mapping_sha256,answer_key_version,aggregation_version,source_snapshot_at)
    values(new_id,row_data->>'year',row_data->>'subject',(row_data->>'question_count')::smallint,(row_data->>'sample_count')::bigint,row_data->'items',c->>'catalog_id',c->>'catalog_sha256',c->>'mapping_version',c->>'mapping_sha256',row_data->>'answer_key_version','pooled_saved_answers_v2',source_at);
  end loop;
  insert into public.question_statistics_publication_v2(key,snapshot_id) values('current',new_id) on conflict(key) do update set snapshot_id=excluded.snapshot_id,released_at=current_timestamp;
  return jsonb_build_object('snapshot_id',new_id::text,'previous_id',current_id::text,'already_published',false);
end; $$;
create function private.rollback_question_statistics_v2(target_id bigint,expected_current text,performed_by text,change_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_id bigint;a jsonb;c jsonb;
begin
  if not pg_try_advisory_xact_lock(170926,2) then raise exception 'Another V2 operation is running'; end if;
  if nullif(trim(performed_by),'') is null or nullif(trim(change_reason),'') is null then raise exception 'Operator and reason required'; end if;
  select r.artifact,k.payload into a,c from private.question_statistics_runs_v2 r join private.question_statistics_catalogs_v2 k using(catalog_id) where r.id=target_id and k.revoked_at is null;
  if a is null or not private.statistics_artifact_valid_v2(a,c) or (select count(*) from public.question_statistics_snapshots_v2 where snapshot_id=target_id)<>38 then raise exception 'Unsupported or incomplete target'; end if;
  if exists(select 1 from public.question_statistics_snapshots_v2 s left join lateral (select x.value from jsonb_array_elements(a->'cohorts') x where x.value->>'year'=s.year and x.value->>'subject'=s.subject) x on true where s.snapshot_id=target_id and (x.value is null or s.items is distinct from x.value->'items' or s.sample_count is distinct from (x.value->>'sample_count')::bigint or s.catalog_id is distinct from c->>'catalog_id' or s.catalog_sha256 is distinct from c->>'catalog_sha256' or s.mapping_sha256 is distinct from c->>'mapping_sha256' or s.answer_key_version is distinct from x.value->>'answer_key_version')) then raise exception 'Damaged target'; end if;
  if exists(select 1 from public.question_statistics_snapshots_v2 s join private.question_statistics_runs_v2 r on r.id=s.snapshot_id where s.snapshot_id=target_id and
    (s.aggregation_version is distinct from 'pooled_saved_answers_v2' or s.mapping_version is distinct from c->>'mapping_version' or s.source_snapshot_at is distinct from r.source_snapshot_at or s.published_at is distinct from r.published_at
     or s.question_count is distinct from jsonb_array_length(s.items))) then raise exception 'Damaged target metadata'; end if;
  select snapshot_id into current_id from public.question_statistics_publication_v2 where key='current';
  if coalesce(current_id::text,'none') is distinct from expected_current then raise exception 'Current generation changed'; end if;
  if current_id=target_id then return jsonb_build_object('snapshot_id',target_id::text,'already_current',true); end if;
  update public.question_statistics_publication_v2 set snapshot_id=target_id,released_at=current_timestamp where key='current';
  if not found then raise exception 'No current publication'; end if;
  update private.question_statistics_runs_v2 set publication_events=publication_events||jsonb_build_array(jsonb_build_object('action','rollback','at',current_timestamp,'operator',performed_by,'reason',change_reason,'previous_id',current_id::text)) where id=target_id;
  return jsonb_build_object('snapshot_id',target_id::text,'previous_id',current_id::text,'already_current',false);
end; $$;
revoke all on function private.statistics_json_v2(jsonb),private.statistics_hash_v2(jsonb),private.statistics_count_v2(jsonb),private.statistics_catalog_valid_v2(jsonb),private.statistics_catalog_immutable_v2(),private.statistics_items_valid_v2(jsonb,bigint,jsonb),private.statistics_artifact_valid_v2(jsonb,jsonb),private.register_question_statistics_catalog_v2(jsonb,text,text),private.publish_question_statistics_v2(jsonb,text,text,text),private.rollback_question_statistics_v2(bigint,text,text,text) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
