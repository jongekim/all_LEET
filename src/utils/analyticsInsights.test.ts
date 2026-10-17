import { describe,expect,it } from 'vitest';
import { buildInsights,type InsightsSource,type InsightEvent } from '../../supabase/functions/_shared/analytics-insights';
import { validateEvent } from '../../supabase/functions/_shared/analytics-contract';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const filters={start:'2026-10-01',end:'2026-10-01'};
function event(name:string,attributes:InsightEvent['attributes']={},other:Partial<InsightEvent>={}):InsightEvent {return {actor_scope:id(1),user_id:id(1),session_id:id(2),page_entry_id:id(3),received_at:'2026-10-01T03:00:00Z',event_name:name,feature:'grading',route:'/',execution_channel:'browser',os_family:'android',device_class:'mobile',is_core:name==='grading_completed',attributes:{input_flow_id:id(4),grading_run_id:id(5),subjects:'both',...attributes},...other};}
function source(events:InsightEvent[]=[]):InsightsSource {return {snapshot_at:'2026-10-16T00:00:00Z',available_from:'2026-09-01T00:00:00Z',started_at:'2026-09-01T00:00:00Z',collection_enabled:true,last_accepted_at:null,events,sessions:[{session_id:id(2),last_activity_received_at:'2026-10-01T03:01:00Z',uncertain:false}],first_usage:[],gaps:[],quality:{submitted:0,accepted:0},publications:{days:0,first_day:null,last_day:null,published_at:null}};}
const completed=()=>[event('grading_input_started'),event('grading_requested'),event('grading_completed'),event('grading_result_viewed',{entry_source:'new_grading'})];
describe('real analytics insights definitions',()=>{
 it('two subjects are one execution, two storage targets; unknown is not failed',()=>{
  const r=buildInsights(source([...completed(),event('history_save_outcome',{subjects:'verbal',outcome:'success'}),event('history_save_outcome',{subjects:'reasoning',outcome:'unknown'})]),filters);
  expect(r.decomposition).toMatchObject({members:1,runs:1,per_member:1,anonymous_runs:0});expect(r.saves).toEqual({targets:2,success:1,failed:0,unknown:1,unobserved:0});expect(r.funnels.flow.stages).toEqual([1,1,1,1]);expect(r.funnels.run.stages).toEqual([1,1,1]);expect(JSON.stringify(r)).not.toContain(id(1));
 });
 it('results after the selected end still link, other actors with the same run do not',()=>{
  const es=completed();es[3].received_at='2026-10-02T03:00:00Z';
  expect(buildInsights(source(es),filters).funnels.flow.stages[3]).toBe(1);
  es[3].actor_scope=id(99);es[3].user_id=id(99);
  expect(buildInsights(source(es),filters).funnels.flow.stages[3]).toBe(0);
 });
 it('missing request is orphaned, not an inferred completed funnel',()=>{
  const r=buildInsights(source([event('grading_completed'),event('grading_result_viewed',{entry_source:'new_grading'})]),filters);
  expect(r.funnels.run.stages).toEqual([0,0,0]);expect(r.funnels.run.orphaned).toBe(1);
 });
 it('open, grace and uncertain are excluded from closed denominators',()=>{
  for(const [date,uncertain,key] of [['2026-10-15T23:50:00Z',false,'open'],['2026-10-15T23:25:00Z',false,'grace'],['2026-10-01T00:00:00Z',true,'uncertain']] as const){const s=source(completed());s.sessions[0]={...s.sessions[0],last_activity_received_at:date,uncertain};const r=buildInsights(s,filters);expect(r.funnels.flow[key]).toBe(1);expect(r.funnels.flow.stages[0]).toBe(0);}
 });
 it('subject filters cannot select a final subject at input time',()=>{
  const r=buildInsights(source(completed()),{...filters,subjects:'both'});expect(r.funnels.flow.status).toBe('unsupported');expect(r.funnels.run.stages).toEqual([1,1,1]);
 });
 it('the return-date collection gap outside the anchor selection is excluded',()=>{
  const s=source([event('grading_completed')]);s.first_usage=[{user_id:id(1),first_usage_known:true,first_core_received_at:'2026-10-01T03:00:00Z',first_grading_received_at:'2026-10-01T03:00:00Z',first_pwa_core_received_at:null}];s.gaps=[{started_at:'2026-10-07T15:00:00Z',ended_at:'2026-10-08T15:00:00Z'}];
  const r=buildInsights(s,filters);expect(r.cohorts[0].d7).toMatchObject({status:'unavailable',denominator:0,excluded:1});expect(r.cohorts[0].w1.excluded).toBe(1);expect(r.cohorts[0].d30.status).toBe('immature');
 });
 it('the quality calendar distinguishes collection boundaries and confirmed gaps',()=>{
  const s=source([]);s.available_from='2026-10-01T03:00:00Z';s.gaps=[{started_at:'2026-10-02T00:00:00+09:00',ended_at:'2026-10-03T00:00:00+09:00'}];
  expect(buildInsights(s,{start:'2026-09-30',end:'2026-10-03'}).coverage_days).toEqual([{day:'2026-09-30',status:'unavailable',gap:false},{day:'2026-10-01',status:'partial',gap:false},{day:'2026-10-02',status:'partial',gap:true},{day:'2026-10-03',status:'complete',gap:false}]);
 });
 it('D7 differs from W1 and the immature window is not zero retention',()=>{
  const s=source([event('grading_completed',{}, {received_at:'2026-10-10T03:00:00Z'})]);s.first_usage=[{user_id:id(1),first_usage_known:true,first_core_received_at:'2026-10-01T03:00:00Z',first_grading_received_at:null,first_pwa_core_received_at:null}];
  const r=buildInsights(s,filters);expect(r.cohorts[0].d7).toMatchObject({numerator:0,denominator:1});expect(r.cohorts[0].w1).toMatchObject({numerator:1,denominator:1});
  s.snapshot_at='2026-10-10T00:00:00Z';expect(buildInsights(s,filters).cohorts[0].w1.status).toBe('immature');
 });
 it('first grading review uses exactly seven 24-hour periods and excludes unknown firsts',()=>{
  const s=source([event('past_result_viewed',{entry_source:'history'},{received_at:'2026-10-08T02:59:59Z'})]);s.first_usage=[{user_id:id(1),first_usage_known:true,first_core_received_at:null,first_pwa_core_received_at:null,first_grading_received_at:'2026-10-01T03:00:00Z'}];
  expect(buildInsights(s,filters).review.first_grading_7d).toMatchObject({numerator:1,denominator:1});s.events[0].received_at='2026-10-08T03:00:00Z';expect(buildInsights(s,filters).review.first_grading_7d.numerator).toBe(0);s.first_usage[0].first_usage_known=false;expect(buildInsights(s,filters).review.first_grading_7d.excluded).toBe(1);
 });
 it('exposure requires availability and unobserved uses cannot produce over-100% rates',()=>{
  const attrs={tool:'field',surface:'new',result_context_id:id(20)};const es=[event('tool_available',attrs),event('tool_exposed',attrs),event('tool_used',{...attrs,operation_id:id(30)}),event('tool_result',{...attrs,operation_id:id(30),outcome:'success'}),event('tool_used',{...attrs,result_context_id:id(21),operation_id:id(31)})];
  const r=buildInsights(source(es),filters);expect(r.tools[0]).toMatchObject({eligible:1,exposed:1,used:1,completed:1,unobserved:1});
  expect(buildInsights(source([]),filters).tools).toEqual([]);
 });
 it('review intervals exclude examples, empty histories and one-observation members',()=>{
  const es=[event('past_result_viewed',{entry_source:'history'}),event('past_result_viewed',{entry_source:'history'},{received_at:'2026-10-05T03:00:00Z'}),event('past_result_viewed',{entry_source:'history'},{user_id:id(99),actor_scope:id(99)}),event('past_result_viewed',{entry_source:'example'},{user_id:id(98),actor_scope:id(98)}),event('history_viewed',{has_records:false},{user_id:id(97),actor_scope:id(97)})];
  const r=buildInsights(source(es),{start:'2026-10-01',end:'2026-10-10'});expect(r.review).toMatchObject({members:2,repeated:1,once:1,median_days:4});
 });
 it('a tool result must match the operation and result context of its use',()=>{
  const attrs={tool:'edit',surface:'history',result_context_id:id(20)};
  const es=[event('tool_available',attrs),event('tool_exposed',attrs),event('tool_used',{...attrs,operation_id:id(30)}),event('tool_result',{...attrs,operation_id:id(31),outcome:'success'})];
  expect(buildInsights(source(es),filters).tools[0]).toMatchObject({used:1,completed:0});
  es.push(event('tool_result',{...attrs,operation_id:id(30),outcome:'success'}));
  expect(buildInsights(source(es),filters).tools[0].completed).toBe(1);
 });
 it('period/member distinct is not the sum of daily or channel counts',()=>{
  const es=[event('grading_completed'),event('grading_completed',{}, {execution_channel:'pwa'}),event('grading_completed',{grading_run_id:id(6)},{received_at:'2026-10-02T03:00:00Z'}),event('grading_completed',{grading_run_id:id(7)},{user_id:null,actor_scope:'anonymous:'+id(2)})];
  const r=buildInsights(source(es),{start:'2026-10-01',end:'2026-10-02'});expect(r.decomposition).toMatchObject({members:1,runs:2,per_member:2,anonymous_runs:1});
 });
 it('timing quantiles are computed from measured durations with missing runs separate',()=>{
  const es=[event('grading_completed'),event('grading_completed',{grading_run_id:id(6)}),event('client_timing',{timing_phase:'result',elapsed_ms:100,visible_ms:80}),event('client_timing',{timing_phase:'result',elapsed_ms:900,visible_ms:700,grading_run_id:id(6)})];
  const r=buildInsights(source(es),filters);expect(r.timings[0]).toMatchObject({count:2,p50:500,p95:860,visible_p50:390});expect(r.timing_missing_runs).toBe(0);
 });
 it('new event contracts reject invalid metadata, excess duration and missing correlation',()=>{
  const raw={...event('client_timing',{timing_phase:'result',elapsed_ms:100,visible_ms:101}),event_id:id(50),page_instance_id:id(51),event_sequence:1,occurred_at:'2026-10-01T00:00:00Z',metric_version:'1',display_mode:'browser',detection_method:'media_query',detection_version:1};
  const {actor_scope,user_id,received_at,is_core,...safe}=raw;void actor_scope;void user_id;void received_at;void is_core;
  expect(validateEvent(safe)).toBeNull();expect(validateEvent({...safe,attributes:{...safe.attributes,visible_ms:80,app_version:'1.12.3'}})).not.toBeNull();expect(validateEvent({...safe,attributes:{...safe.attributes,visible_ms:80,app_version:'email@example.test'}})).toBeNull();
 });
});
