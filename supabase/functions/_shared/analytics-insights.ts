import type { AnalyticsFilters, Attributes, Channel, ReportKind } from './analytics-contract.ts';
import { addDays, kstDay } from './dashboard.ts';

export interface InsightEvent {
  actor_scope: string; user_id: string | null; session_id: string; page_entry_id: string;
  received_at: string; event_name: string; feature: string; route: string;
  execution_channel: Channel; os_family: string; device_class: string; is_core: boolean;
  attributes: Attributes;
}
export interface InsightsSource {
  snapshot_at: string; available_from: string | null; collection_enabled: boolean;
  started_at: string | null; last_accepted_at: string | null;
  events: InsightEvent[];
  sessions: { session_id: string; last_activity_received_at: string; uncertain: boolean }[];
  first_usage: { user_id: string; first_usage_known: boolean; first_core_received_at: string | null; first_pwa_core_received_at: string | null; first_grading_received_at: string | null }[];
  gaps: { started_at: string; ended_at: string | null }[];
  quality: Record<string, number>;
  publications: { days: number; first_day: string | null; last_day: string | null; published_at: string | null };
}
export type InsightStatus = 'complete' | 'partial' | 'unavailable' | 'not_collected' | 'immature' | 'unsupported';
export interface ObservationRate { numerator: number; denominator: number; excluded: number; immature: number; status: InsightStatus }
export interface Funnel { unit: 'flow' | 'run'; stages: number[]; open: number; grace: number; uncertain: number; orphaned: number; status: InsightStatus }
export interface ToolUsage { tool: string; surface: string; eligible: number; exposed: number; used: number; completed: number; unobserved: number }
export interface AnalyticsInsights {
  insights_version: 1; generated_at: string; observation_as_of: string; available_from: string | null;
  filters: AnalyticsFilters; status: InsightStatus; collection_enabled: boolean; started_at: string | null; last_accepted_at: string | null;
  quality: Record<string, number>; publications: InsightsSource['publications'];
  coverage_days: {day:string;status:'complete'|'partial'|'unavailable';gap:boolean}[];
  decomposition: { members: number; runs: number; per_member: number | null; anonymous_runs: number; previous: { members: number; runs: number; per_member: number | null } | null };
  funnels: { flow: Funnel; run: Funnel };
  saves: { targets: number; success: number; failed: number; unknown: number; unobserved: number };
  devices: { device: string; requested: number; results: number }[];
  tools: ToolUsage[]; tools_started_at: string | null;
  timings: { phase: string; count: number; p50: number | null; p95: number | null; visible_p50: number | null }[];
  timing_runs: number; timing_missing_runs: number;
  cohorts: { date: string; members: number; d1: ObservationRate; d7: ObservationRate; w1: ObservationRate; d30: ObservationRate }[];
  cohort_status: InsightStatus; unknown_first_usage: number;
  review: { members: number; repeated: number; once: number; median_days: number | null; first_grading_7d: ObservationRate };
  usage_days: { window_days: number; counts: number[]; status: InsightStatus };
  overlap: { features: string[]; counts: number[][] };
  journeys: { route: string; sessions: number; converted: number }[];
  versions: { version: string; runs: number; results: number }[];
}
const DAY = 86400000;
const at = (d: string) => Date.parse(`${d}T00:00:00+09:00`);
const stamp = (e: InsightEvent) => Date.parse(e.received_at);
const unique = <T>(items: T[]) => new Set(items).size;
const runKey = (e: InsightEvent) => `${e.actor_scope}:${e.attributes.grading_run_id}`;
const flowKey = (e: InsightEvent) => `${e.actor_scope}:${e.session_id}:${e.attributes.input_flow_id}`;
const contextKey = (e: InsightEvent) => `${e.actor_scope}:${e.page_entry_id}:${e.attributes.result_context_id}:${e.attributes.tool}`;
const reviewEvent = (e: InsightEvent) => (e.event_name === 'past_result_viewed' && e.attributes.entry_source === 'history') || (['history_viewed', 'history_trend_viewed'].includes(e.event_name) && e.attributes.has_records === true);
const gradingEvent = (e: InsightEvent) => e.event_name === 'grading_completed' || (e.event_name === 'mock_saved' && e.attributes.outcome === 'success');
function median(values: number[]) { return quantile(values, .5); }
function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), index = (sorted.length-1)*q, lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)]-sorted[lower])*(index-lower);
}
function group<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) { const k = key(item), list = result.get(k) || []; list.push(item); result.set(k,list); }
  return result;
}
export function buildInsights(source: InsightsSource, filters: AnalyticsFilters, report: ReportKind = 'overview'): AnalyticsInsights {
  const now = Date.parse(source.snapshot_at), from = at(filters.start), through = at(addDays(filters.end,1));
  const available = source.available_from ? Date.parse(source.available_from) : Infinity;
  const observed = (start: number, finish: number) => start >= available && finish <= now && !source.gaps.some(g => Date.parse(g.started_at) < finish && (g.ended_at ? Date.parse(g.ended_at) : now) > start);
  const status: InsightStatus = available >= through ? 'unavailable' : observed(from,through) ? 'complete' : 'partial';
  const coverageDays:AnalyticsInsights['coverage_days']=[];
  for(let day=filters.start;day<=filters.end;day=addDays(day,1)) {
    const start=at(day),finish=at(addDays(day,1));
    const gap=source.gaps.some(g=>Date.parse(g.started_at)<finish&&(g.ended_at?Date.parse(g.ended_at):now)>start);
    coverageDays.push({day,gap,status:finish<=available||start>=now?'unavailable':observed(start,finish)?'complete':'partial'});
  }
  const base = source.events.filter(e => (!filters.channel || e.execution_channel === filters.channel) && (report !== 'pwa' || e.execution_channel === 'pwa') && (!filters.os || e.os_family === filters.os) && (!filters.device || e.device_class === filters.device) && (!filters.login || (filters.login === 'member') === !!e.user_id) && (!filters.year || e.attributes.year === filters.year) && (!filters.exam_type || e.attributes.exam_type === filters.exam_type) && (!filters.feature || e.feature === filters.feature));
  const userEvents=group(base.filter(e=>e.user_id),e=>e.user_id!);
  const selected = base.filter(e => stamp(e) >= from && stamp(e) < through);
  const scoped = selected.filter(e => (!filters.subjects || e.attributes.subjects === filters.subjects) && (!filters.outcome || e.attributes.outcome === filters.outcome));
  const runEvents = scoped.filter(e => e.event_name === 'grading_completed' && e.attributes.grading_run_id);
  const memberRuns = runEvents.filter(e => e.user_id), graders = unique(memberRuns.map(e => e.user_id));
  const length = through-from, previousFrom = from-length;
  const prior = base.filter(e => stamp(e) >= previousFrom && stamp(e) < from && e.user_id && e.event_name === 'grading_completed' && e.attributes.grading_run_id && (!filters.subjects || e.attributes.subjects === filters.subjects) && !filters.outcome);
  const priorMembers = unique(prior.map(e => e.user_id)), priorRuns = unique(prior.map(runKey));
  const sessionStates = new Map(source.sessions.map(s => [s.session_id,s]));
  const requests = group(base.filter(e => e.event_name === 'grading_requested' && e.attributes.grading_run_id), runKey);
  const completedKeys = new Set(base.filter(e=>e.event_name==='grading_completed').map(runKey));
  const runs = group(base.filter(e => e.attributes.grading_run_id), runKey);
  const flows = group(base.filter(e => e.attributes.input_flow_id), flowKey);
  const emptyFunnel = (unit: Funnel['unit'], stages: number): Funnel => ({ unit, stages: Array(stages).fill(0), open:0, grace:0, uncertain:0, orphaned:0, status });
  const flow = emptyFunnel('flow',4), run = emptyFunnel('run',3);
  if (filters.subjects || filters.outcome) flow.status = 'unsupported';
  const phase = (e: InsightEvent): 'open' | 'grace' | 'uncertain' | 'closed' => {
    const s=sessionStates.get(e.session_id);
    if (!s || s.uncertain) return 'uncertain';
    const age=now-Date.parse(s.last_activity_received_at);
    return age<30*60000?'open':age<45*60000?'grace':'closed';
  };
  const within = (e: InsightEvent) => stamp(e)>=from && stamp(e)<through;
  const linkedResult = (events: InsightEvent[]) => events.some(e => e.event_name==='grading_result_viewed' && e.attributes.entry_source==='new_grading' && requests.has(runKey(e)) && completedKeys.has(runKey(e)));
  for (const events of flows.values()) {
    const input=events.filter(e => ['grading_input_started','grading_input_resumed'].includes(e.event_name)).sort((a,b)=>stamp(a)-stamp(b))[0];
    if (!input || !within(input)) continue;
    const state=phase(input);
    if (state!=='closed') { flow[state]++; continue; }
    flow.stages[0]++;
    const requested=events.filter(e => e.event_name==='grading_requested');
    if (requested.length) flow.stages[1]++;
    if (events.some(e => e.event_name==='grading_completed' && requested.some(r => runKey(r)===runKey(e)))) flow.stages[2]++;
    if (linkedResult(events)) flow.stages[3]++;
  }
  for (const events of runs.values()) {
    const request=events.find(e=>e.event_name==='grading_requested');
    if (!request || !within(request) || (filters.subjects && request.attributes.subjects!==filters.subjects) || filters.outcome) continue;
    const state=phase(request);
    if (state!=='closed') { run[state]++; continue; }
    run.stages[0]++;
    if (events.some(e=>e.event_name==='grading_completed')) run.stages[1]++;
    if (linkedResult(events)) run.stages[2]++;
  }
  if (filters.outcome) run.status='unsupported';
  run.orphaned=unique(selected.filter(e=>['grading_completed','grading_result_viewed'].includes(e.event_name) && !requests.has(runKey(e))).map(runKey));
  flow.orphaned=run.orphaned;
  const saves={targets:0,success:0,failed:0,unknown:0,unobserved:0};
  for (const events of runs.values()) {
    const completed=events.find(e=>e.event_name==='grading_completed' && e.user_id && within(e));
    if (!completed || (filters.subjects && completed.attributes.subjects!==filters.subjects) || filters.outcome) continue;
    for (const subject of completed.attributes.subjects==='both'?['verbal','reasoning']:[String(completed.attributes.subjects)]) {
      if (!['verbal','reasoning'].includes(subject)) continue;
      saves.targets++;
      const outcome=events.filter(e=>e.event_name==='history_save_outcome' && e.attributes.subjects===subject).sort((a,b)=>stamp(b)-stamp(a))[0]?.attributes.outcome;
      if (outcome==='success'||outcome==='failed'||outcome==='unknown') saves[outcome]++; else saves.unobserved++;
    }
  }
  const devices=[...group([...requests.values()].map(es=>es[0]).filter(e=>within(e)&&(!filters.subjects||e.attributes.subjects===filters.subjects)),e=>e.device_class)].map(([device,es])=>({device,requested:es.length,results:es.filter(e=>linkedResult(runs.get(runKey(e)) || [])).length}));
  const toolEvents=scoped.filter(e=>['tool_available','tool_exposed','tool_used','tool_result'].includes(e.event_name));
  const tools: ToolUsage[]=[];
  for (const events of group(toolEvents,e=>`${e.attributes.tool}:${e.attributes.surface}`).values()) {
    const sets=(name:string)=>new Set(events.filter(e=>e.event_name===name && (name!=='tool_result'||e.attributes.outcome==='success')).map(contextKey));
    const eligible=sets('tool_available'),exposed=sets('tool_exposed'),used=sets('tool_used');
    const operations=new Set(events.filter(e=>e.event_name==='tool_used').map(e=>`${contextKey(e)}:${e.attributes.operation_id}`));
    const completed=new Set(events.filter(e=>e.event_name==='tool_result'&&e.attributes.outcome==='success'&&operations.has(`${contextKey(e)}:${e.attributes.operation_id}`)).map(contextKey));
    const exposedEligible=new Set([...exposed].filter(k=>eligible.has(k)));
    tools.push({tool:String(events[0].attributes.tool),surface:String(events[0].attributes.surface),eligible:eligible.size,exposed:exposedEligible.size,used:[...used].filter(k=>exposedEligible.has(k)).length,completed:[...completed].filter(k=>exposedEligible.has(k)&&used.has(k)).length,unobserved:[...used].filter(k=>!exposedEligible.has(k)).length});
  }
  const timingEvents=scoped.filter(e=>e.event_name==='client_timing');
  const timings=[...group(timingEvents,e=>String(e.attributes.timing_phase))].map(([phase,es])=>{
    const uniqueEvents=[...group(es,e=>`${runKey(e)}:${e.attributes.subjects || ''}`).values()].map(v=>v[0]);
    return {phase,count:uniqueEvents.length,p50:median(uniqueEvents.map(e=>Number(e.attributes.elapsed_ms))),p95:quantile(uniqueEvents.map(e=>Number(e.attributes.elapsed_ms)),.95),visible_p50:median(uniqueEvents.map(e=>Number(e.attributes.visible_ms)))};
  });
  const periodOnly=!['channel','os','device','login','year','subjects','exam_type','feature','outcome'].some(k=>filters[k as keyof AnalyticsFilters]);
  const cohortSupported=periodOnly || (report==='pwa' && !['os','device','login','year','subjects','exam_type','feature','outcome'].some(k=>filters[k as keyof AnalyticsFilters]) && (!filters.channel||filters.channel==='pwa'));
  const anchors=source.first_usage.filter(f=>f.first_usage_known).map(f=>({id:f.user_id,date:report==='pwa'?f.first_pwa_core_received_at:f.first_core_received_at})).filter(f=>f.date && Date.parse(f.date)>=from && Date.parse(f.date)<through);
  const rateFor = (members: {id:string;date:string|null}[], offset:number, window:boolean):ObservationRate => {
    const r: ObservationRate={numerator:0,denominator:0,excluded:0,immature:0,status:'complete'};
    for (const member of members) {
      const anchor=kstDay(new Date(member.date!)), start=at(addDays(anchor,offset)), finish=at(addDays(anchor,window?14:offset+1));
      if (finish>now) {r.immature++;continue;}
      if (!observed(start,finish)||!observed(at(anchor),at(addDays(anchor,1)))) {r.excluded++;continue;}
      r.denominator++;
      if ((userEvents.get(member.id)||[]).some(e=>e.is_core && stamp(e)>=start && stamp(e)<finish)) r.numerator++;
    }
    r.status=r.denominator?'complete':r.excluded?'unavailable':r.immature?'immature':'unavailable';
    return r;
  };
  const cohorts=cohortSupported?[...group(anchors,f=>kstDay(new Date(f.date!)))].sort(([a],[b])=>a.localeCompare(b)).map(([date,ms])=>({date,members:ms.length,d1:rateFor(ms,1,false),d7:rateFor(ms,7,false),w1:rateFor(ms,7,true),d30:rateFor(ms,30,false)})):[];
  const reviewEvents=scoped.filter(e=>e.user_id && reviewEvent(e)),reviews=group(reviewEvents,e=>e.user_id!);
  const perMemberIntervals:number[]=[];let repeated=0,once=0;
  for (const es of reviews.values()) {
    const days=[...new Set(es.map(e=>kstDay(new Date(e.received_at))))].sort();
    if(days.length<2){once++;continue;}repeated++;
    perMemberIntervals.push(median(days.slice(1).map((d,i)=>(at(d)-at(days[i]))/DAY))!);
  }
  const firstGrading:ObservationRate={numerator:0,denominator:0,excluded:0,immature:0,status:periodOnly?'unavailable':'unsupported'};
  if(periodOnly) for(const first of source.first_usage) {
    if(!first.first_grading_received_at)continue;const start=Date.parse(first.first_grading_received_at),finish=start+7*DAY;
    if(start<from||start>=through)continue;
    if(!first.first_usage_known){firstGrading.excluded++;continue;}
    if(finish>now){firstGrading.immature++;continue;}
    if(!observed(start,finish)){firstGrading.excluded++;continue;}
    firstGrading.denominator++;
    if((userEvents.get(first.user_id)||[]).some(e=>reviewEvent(e)&&stamp(e)>=start&&stamp(e)<finish))firstGrading.numerator++;
  }
  if(periodOnly)firstGrading.status=firstGrading.denominator?'complete':firstGrading.excluded?'unavailable':firstGrading.immature?'immature':'unavailable';
  const windowDays=Math.min(28,Math.round(length/DAY)),windowStart=Math.max(from,through-windowDays*DAY),counts=[0,0,0,0];
  for(const es of group(scoped.filter(e=>e.user_id&&stamp(e)>=windowStart&&(reviewEvent(e)||gradingEvent(e))),e=>e.user_id!).values()) {
    const count=unique(es.map(e=>kstDay(new Date(e.received_at))));counts[Math.min(count,4)-1]++;
  }
  const overlapNames=['grading','history','past_exams'];
  const featureMembers=overlapNames.map(name=>new Set(scoped.filter(e=>e.user_id&&(name==='grading'?gradingEvent(e):name==='history'?reviewEvent(e):['past_exam_file_clicked','reference_opened'].includes(e.event_name))).map(e=>e.user_id!)));
  const journeys=[...group(scoped,e=>`${e.actor_scope}:${e.session_id}`)].map(([,es])=>{const entry=es.filter(e=>e.event_name==='page_view').sort((a,b)=>stamp(a)-stamp(b))[0];if(!entry)return null;const route=entry.route;return {route,converted:es.some(e=>route==='/'?e.event_name==='grading_result_viewed':route==='/past-exams'?['past_exam_file_clicked','reference_opened'].includes(e.event_name):['/history','/mock-history'].includes(route)?reviewEvent(e):false)};}).filter((j):j is {route:string;converted:boolean}=>j!==null&&['/','/past-exams','/history','/mock-history'].includes(j.route));
  const versions=[...group(scoped.filter(e=>e.attributes.grading_run_id),e=>String(e.attributes.app_version || 'unknown'))].map(([version,es])=>({version,runs:unique(es.filter(e=>e.event_name==='grading_completed').map(runKey)),results:unique(es.filter(e=>e.event_name==='grading_result_viewed'&&requests.has(runKey(e))&&completedKeys.has(runKey(e))).map(runKey))}));
  const timingRuns=unique(timingEvents.filter(e=>e.attributes.timing_phase==='result').map(runKey));
  return {insights_version:1,generated_at:source.snapshot_at,observation_as_of:source.snapshot_at,available_from:source.available_from,filters,status,collection_enabled:source.collection_enabled,started_at:source.started_at,last_accepted_at:source.last_accepted_at,quality:source.quality,publications:source.publications,coverage_days:coverageDays,
    decomposition:{members:graders,runs:unique(memberRuns.map(runKey)),per_member:graders?unique(memberRuns.map(runKey))/graders:null,anonymous_runs:unique(runEvents.filter(e=>!e.user_id).map(runKey)),previous:observed(previousFrom,from)&&!filters.outcome?{members:priorMembers,runs:priorRuns,per_member:priorMembers?priorRuns/priorMembers:null}:null},
    funnels:{flow,run},saves,devices,tools,tools_started_at:toolEvents.length?toolEvents.map(e=>e.received_at).sort()[0]:null,timings,timing_runs:timingRuns,timing_missing_runs:Math.max(0,unique(runEvents.map(runKey))-timingRuns),
    cohorts,cohort_status:cohortSupported?(available>=through?'unavailable':'complete'):'unsupported',unknown_first_usage:source.first_usage.filter(f=>!f.first_usage_known).length,
    review:{members:reviews.size,repeated,once,median_days:median(perMemberIntervals),first_grading_7d:firstGrading},usage_days:{window_days:windowDays,counts,status:observed(windowStart,through)?'complete':'partial'},
    overlap:{features:overlapNames,counts:featureMembers.map(a=>featureMembers.map(b=>[...a].filter(id=>b.has(id)).length))},journeys:[...group(journeys,j=>j.route)].map(([route,js])=>({route,sessions:js.length,converted:js.filter(j=>j.converted).length})),versions};
}
