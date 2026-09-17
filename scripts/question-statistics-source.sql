-- Only aggregated data leaves PostgreSQL. One statement = one MVCC source snapshot.
with catalog as (
  select * from jsonb_to_recordset($1::jsonb) as c(year text, subject text, exam_type text, question_count int, answer_key_version text)
), histories as (
  select value from public.kv_store_cd835c22 where key like 'history:%'
), records as (
  select x.record from histories h
  cross join lateral jsonb_array_elements(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end) x(record)
), checked as (
  select r.record, c.*,
    c.year is not null and jsonb_typeof(r.record) = 'object'
    and (r.record->'userAnswers' is null or r.record->'userAnswers' = 'null'::jsonb or jsonb_typeof(r.record->'userAnswers') = 'object')
    and not exists (
      select 1 from jsonb_each(case when jsonb_typeof(r.record->'userAnswers') = 'object' then r.record->'userAnswers' else '{}'::jsonb end) u
      where not (u.key = any(array(select generate_series(1,c.question_count)::text)))
        or (u.value not in ('null'::jsonb,'0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb))
    ) as valid
  from records r left join catalog c on c.year = r.record->>'year' and c.subject = r.record->>'subject' and c.exam_type = r.record->>'examType'
), valid_records as (
  select * from checked where valid
), question_counts as (
  select c.year,c.subject,c.exam_type,c.question_count,c.answer_key_version,q.question_no,
    count(r.record)::text as sample_count,
    jsonb_build_array(
      count(r.record) filter (where r.record->'userAnswers'->q.question_no::text = '1'::jsonb),
      count(r.record) filter (where r.record->'userAnswers'->q.question_no::text = '2'::jsonb),
      count(r.record) filter (where r.record->'userAnswers'->q.question_no::text = '3'::jsonb),
      count(r.record) filter (where r.record->'userAnswers'->q.question_no::text = '4'::jsonb),
      count(r.record) filter (where r.record->'userAnswers'->q.question_no::text = '5'::jsonb)
    ) as choice_counts,
    count(r.record) filter (where r.record->'userAnswers'->q.question_no::text is null or r.record->'userAnswers'->q.question_no::text in ('null'::jsonb,'0'::jsonb)) as unanswered_count
  from catalog c cross join lateral generate_series(1,c.question_count) q(question_no)
  left join valid_records r on r.year = c.year and r.subject = c.subject and r.exam_type = c.exam_type
  group by c.year,c.subject,c.exam_type,c.question_count,c.answer_key_version,q.question_no
), cohorts as (
  select year,subject,exam_type,question_count,answer_key_version,sample_count,
    jsonb_agg(jsonb_build_object('question_no',question_no,'choice_counts',choice_counts,'unanswered_count',unanswered_count) order by question_no) as items
  from question_counts group by year,subject,exam_type,question_count,answer_key_version,sample_count
)
select current_timestamp as source_snapshot_at,
  (select count(*)::text from records) as source_count,
  (select count(*)::text from valid_records) as included_count,
  (select count(*)::text from checked where valid is not true) as quarantined_count,
  (select count(*)::text from histories where jsonb_typeof(value) is distinct from 'array') as malformed_histories,
  (select jsonb_agg(to_jsonb(c) order by year,subject,exam_type) from cohorts c) as cohorts;
