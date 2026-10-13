-- A single MVCC read. No IDs or individual answers leave the database.
with input as (select $1::jsonb as catalog), catalog as (
  select x.* from input,jsonb_to_recordset(catalog->'cohorts') x(year text,subject text,question_count int,answer_key_version text,questions jsonb)
), allowed as (
  select year,subject,question_count,true as in_scope from catalog
  union all select x.year,x.subject,x.question_count,false from input,jsonb_to_recordset(catalog->'excluded_cohorts') x(year text,subject text,question_count int)
), histories as (select value from public.kv_store_cd835c22 where key like 'history:%'), records as (
  select x.record from histories h cross join lateral jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) x(record)
), checked as (
  select r.record,c.*,
    jsonb_typeof(r.record)='object' and c.year is not null and r.record->'year'=to_jsonb(c.year) and r.record->'subject'=to_jsonb(c.subject) and jsonb_typeof(r.record->'examType')='string'
    and r.record->>'examType' in ('odd','even') and r.record->'total'=to_jsonb(c.question_count)
    and (r.record->'userAnswers' is null or r.record->'userAnswers'='null'::jsonb or jsonb_typeof(r.record->'userAnswers')='object')
    and not exists (select 1 from jsonb_each(case when jsonb_typeof(r.record->'userAnswers')='object' then r.record->'userAnswers' else '{}'::jsonb end) u
      where not(u.key=any(array(select generate_series(1,c.question_count)::text))) or u.value not in ('null'::jsonb,'0'::jsonb,'1'::jsonb,'2'::jsonb,'3'::jsonb,'4'::jsonb,'5'::jsonb)) as valid
  from records r left join allowed c on c.year=r.record->>'year' and c.subject=r.record->>'subject'
), classified as (
  select *,case when valid is not true then 'invalid' when not in_scope then 'out_of_scope'
    when record->'userAnswers' is null or record->'userAnswers'='null'::jsonb then 'missing_answers' else 'included' end as category from checked
), questions as (
  select c.*,q.value as question,q.ordinality::int as question_no from catalog c cross join lateral jsonb_array_elements(c.questions) with ordinality q
), normalized as (
  select q.year,q.subject,q.question_count,q.answer_key_version,q.question,q.question_no,r.record,
    case when r.record->>'examType'='odd' then r.record->'userAnswers'->(q.question->>'odd_question_no')
      else r.record->'userAnswers'->q.question_no::text end as local_choice
  from questions q left join classified r on r.year=q.year and r.subject=q.subject and r.category='included'
), choices as (
  select *,case when local_choice is null or local_choice in ('null'::jsonb,'0'::jsonb) then 0
    when record->>'examType'='odd' then (question->'odd_choice_to_even'->>((local_choice::text)::numeric::int-1))::int
    else (local_choice::text)::numeric::int end as choice from normalized
), counts as (
  select year,subject,question_count,answer_key_version,question_no,question->>'question_id' as question_id,(question->>'correct_answer')::int as correct_answer,
    count(record)::text as sample_count,jsonb_build_array(count(record) filter(where choice=1),count(record) filter(where choice=2),count(record) filter(where choice=3),count(record) filter(where choice=4),count(record) filter(where choice=5)) as choice_counts,
    count(record) filter(where choice=0) as unanswered_count
  from choices group by year,subject,question_count,answer_key_version,question_no,question
), cohorts as (
  select year,subject,question_count,answer_key_version,sample_count,jsonb_agg(jsonb_build_object('question_id',question_id,'correct_answer',correct_answer,'choice_counts',choice_counts,'unanswered_count',unanswered_count) order by question_no) as items
  from counts group by year,subject,question_count,answer_key_version,sample_count
)
select current_timestamp as source_snapshot_at,(select count(*)::text from records) as source_count,
  (select count(*)::text from classified where category='included') as included_count,
  (select count(*)::text from classified where category='out_of_scope') as excluded_out_of_scope_count,
  (select count(*)::text from classified where category='missing_answers') as excluded_missing_answers_count,
  (select count(*)::text from classified where category='invalid') as invalid_count,
  (select count(*)::text from histories where jsonb_typeof(value) is distinct from 'array') as malformed_histories,
  (select jsonb_agg(to_jsonb(c) order by year,subject) from cohorts c) as cohorts;
