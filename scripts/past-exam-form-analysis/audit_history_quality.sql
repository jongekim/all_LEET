-- Read-only aggregate audit. No user identifiers or individual answers leave DB.
with catalog as (
  select * from jsonb_to_recordset($1::jsonb)
    as c(year text, subject text, exam_type text, question_count int)
), histories as (
  select value from public.kv_store_cd835c22 where key like 'history:%'
), records as (
  select x.record from histories h cross join lateral
    jsonb_array_elements(case when jsonb_typeof(h.value)='array' then h.value else '[]'::jsonb end) x(record)
), checked as (
  select r.record,c.question_count,c.year,c.subject,c.exam_type,
    c.year is not null as known,
    coalesce(jsonb_typeof(r.record->'userAnswers')='object',false) as has_answers,
    r.record->'userAnswers' is null or r.record->'userAnswers'='null'::jsonb as missing_answers,
    coalesce(jsonb_typeof(r.record->'correctAnswers')='object',false) as has_key,
    coalesce(r.record->'total'=to_jsonb(c.question_count),false) as total_valid,
    coalesce(jsonb_typeof(r.record->'userAnswers')='object',false) and not exists (
      select 1 from jsonb_each(case when jsonb_typeof(r.record->'userAnswers')='object' then r.record->'userAnswers' else '{}'::jsonb end) u
      where not (u.key=any(array(select generate_series(1,c.question_count)::text)))
        or u.value not in ('null'::jsonb,'0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb)
    ) as answers_valid,
    coalesce(jsonb_typeof(r.record->'correctAnswers')='object',false)
    and (select count(*) from jsonb_object_keys(case when jsonb_typeof(r.record->'correctAnswers')='object' then r.record->'correctAnswers' else '{}'::jsonb end))=c.question_count
    and not exists (
      select 1 from jsonb_each(case when jsonb_typeof(r.record->'correctAnswers')='object' then r.record->'correctAnswers' else '{}'::jsonb end) k
      where not (k.key=any(array(select generate_series(1,c.question_count)::text)))
        or k.value not in ('1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb)
    ) as key_valid,
    case when jsonb_typeof(r.record->'correct')='number'
      then (r.record->>'correct')::numeric else null end as saved_correct,
    (select count(*) from generate_series(1,c.question_count) q
      where r.record->'userAnswers'->q::text=r.record->'correctAnswers'->q::text) as computed_correct
  from records r left join catalog c
    on c.year=r.record->>'year' and c.subject=r.record->>'subject' and c.exam_type=r.record->>'examType'
), classified as (
  select *,coalesce(saved_correct between 0 and question_count and saved_correct=trunc(saved_correct),false) as saved_correct_valid,
    year in ('2025','2026') and subject='reasoning' and exam_type='odd' as affected
  from checked
), status as (
  select *,coalesce(known and total_valid and answers_valid and key_valid and saved_correct_valid and saved_correct=computed_correct,false) as field_recalculation_available
  from classified
)
select current_timestamp as audited_at,
  (select count(*) from histories where jsonb_typeof(value) is distinct from 'array')::text as malformed_history_containers,
  count(*)::text as total_records,
  count(*) filter (where known)::text as supported_records,
  count(*) filter (where not known)::text as unsupported_records,
  count(*) filter (where known and missing_answers)::text as missing_answer_objects,
  count(*) filter (where known and not has_key)::text as missing_correct_answer_objects,
  count(*) filter (where known and not missing_answers and not answers_valid)::text as invalid_answer_objects,
  count(*) filter (where known and has_key and not key_valid)::text as incomplete_or_invalid_correct_answer_keys,
  count(*) filter (where known and not total_valid)::text as wrong_question_counts,
  count(*) filter (where known and not saved_correct_valid)::text as invalid_saved_correct_counts,
  count(*) filter (where known and total_valid and answers_valid and key_valid and saved_correct_valid and saved_correct<>computed_correct)::text as score_answer_mismatches,
  count(*) filter (where known and has_answers and answers_valid and record->'userAnswers'='{}'::jsonb)::text as empty_answer_objects,
  count(*) filter (where field_recalculation_available)::text as field_recalculation_available_records,
  count(*) filter (where affected)::text as affected_odd_records,
  count(*) filter (where affected and not field_recalculation_available)::text as affected_odd_recalculation_unavailable,
  count(*) filter (where affected and missing_answers)::text as affected_odd_missing_answers,
  count(*) filter (where affected and not key_valid)::text as affected_odd_missing_or_invalid_keys,
  count(*) filter (where affected and total_valid and answers_valid and key_valid and saved_correct_valid and saved_correct<>computed_correct)::text as affected_odd_score_mismatches,
  count(*) filter (where year='2027')::text as single_form_2027_records
from status;
