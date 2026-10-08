-- Local only. Apply this migration before releasing make-server-cd835c22 and web.
begin;
create function public.user_history_update_answers(
  p_owner uuid, p_timestamp bigint, p_expected jsonb, p_patch jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  k text := 'history:' || p_owner::text;
  arr jsonb;
  original jsonb;
  saved jsonb;
  position bigint;
  matches bigint;
begin
  if not exists(select 1 from auth.users where id=p_owner and deleted_at is null) then
    raise exception 'OWNER_MISMATCH';
  end if;
  if p_timestamp is null or p_timestamp <= 0 or
    jsonb_typeof(p_expected) is distinct from 'object' or
    jsonb_typeof(p_patch) is distinct from 'object' or
    jsonb_typeof(p_patch->'userAnswers') is distinct from 'object' or
    p_patch - array['userAnswers','correctAnswers','correct','standardScore','percentile','fieldAnalysis','adjustedScore'] <> '{}'::jsonb then
    raise exception 'INVALID_INPUT';
  end if;
  -- Exactly the same lock as owner append/delete/clear and administrator changes.
  perform pg_advisory_xact_lock(hashtextextended(k,0));
  select value into arr from public.kv_store_cd835c22 where key=k;
  if arr is null then raise exception 'RECORD_NOT_FOUND';end if;
  if jsonb_typeof(arr) <> 'array' then raise exception 'INVALID_HISTORY';end if;
  select count(*), min(ord) into matches, position
    from jsonb_array_elements(arr) with ordinality as e(item,ord)
    where item->'timestamp'=to_jsonb(p_timestamp);
  if matches=0 then raise exception 'RECORD_NOT_FOUND';end if;
  if matches<>1 then raise exception 'AMBIGUOUS_RECORD';end if;
  original=arr->(position::integer-1);
  -- Compare the complete observed record, including administrator score changes.
  if original is distinct from p_expected then raise exception 'HISTORY_CONFLICT';end if;
  saved=(original-'adjustedScore')||p_patch;
  update public.kv_store_cd835c22
    set value=jsonb_set(arr,array[(position-1)::text],saved,false)
    where key=k;
  -- timestamp, groupTimestamp, round and the other subject never change.
  return saved;
end $$;
revoke all on function public.user_history_update_answers(uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.user_history_update_answers(uuid,bigint,jsonb,jsonb) to service_role;
comment on function public.user_history_update_answers(uuid,bigint,jsonb,jsonb) is
  'Service-only answer correction: shared history lock and per-record compare-and-swap. Edge verifies owner and recomputes the score.';
commit;
