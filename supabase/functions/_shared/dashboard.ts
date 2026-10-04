import type { AnalyticsReport, Channel } from './analytics-contract.ts';

export type DashboardRange = '7d' | '30d' | '6m' | '1y';
export type DataStatus = 'complete' | 'partial' | 'unavailable';
export interface Period { start: string; end: string; days: number; boundaries: string[]; bucket_unit: 'day' | 'week' | 'month' }
export interface Fact { day: string; user_id: string | null; actor_scope: string; session_id: string; execution_channel: Channel; feature: string; event_name: string; grading_run_id: string; actions: number }
export interface DashboardSource {
  snapshot_at: string; facts: Fact[]; days: { day: string; status: DataStatus }[];
  confirmations: { day: string; count: number }[];
  conversion: AnalyticsReport['conversion'] | null; previous_conversion: AnalyticsReport['conversion'] | null;
  collection_enabled: boolean; started_at: string | null; last_accepted_at: string | null;
}
export interface SeriesPoint {
  start: string; end: string; calendar_days: number; available_complete_days: number; coverage_status: DataStatus;
  members: number | null; sessions: number | null; grading: number | null; results: number | null; pwa_members: number | null; confirmations: number | null;
  bucket_totals: Record<string, number | null>; daily_count_sum: Record<string, number | null>; observed_totals: Record<string, number>;
}
export interface DashboardCard { key: string; label: string; unit: string; value: number | null; previous: number | null; delta: number | null; percent: number | null; status: DataStatus | 'unsupported' }
export interface FeatureChange { feature: string; view_sessions: number; action_sessions: number; action_members: number; actions: number; previous: { view_sessions: number; action_sessions: number; action_members: number; actions: number } }
export interface Change {
  metric_key: string; category: 'usage' | 'feature' | 'pwa' | 'grading'; label: string;
  current: number; previous: number; delta: number; percent: number | null; unit: string;
  selection_priority: number; rank_score: number; selected: boolean; target: 'members' | 'features' | 'pwa' | 'grading';
  numerator?: number; denominator?: number; previous_numerator?: number; previous_denominator?: number;
}
export interface Dashboard {
  metric_version: string; dashboard_policy_version: number; snapshot_at: string; generated_at: string;
  period: Period; previous_period: Period | null; channel: Channel | null; status: DataStatus; previous_status: DataStatus | null;
  cards: DashboardCard[]; series: SeriesPoint[]; previous_series: SeriesPoint[]; features: FeatureChange[]; changes: Change[];
  conversion: DashboardSource['conversion']; previous_conversion: DashboardSource['conversion'];
  pwa: { pwa_only: number; browser_only: number; both: number; other_only: number; sessions: number; total_sessions: number; other_sessions: number; unknown_sessions: number } | null;
  today: { date: string; sessions: number | null; grading: number | null; status: 'provisional' | 'unavailable'; last_accepted_at: string | null };
  collection: { enabled: boolean; started_at: string | null };
}
const DAY = 86400_000;
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const kstDay = (now: Date) => new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
export function shiftMonths(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`), date = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(date, last)); return d.toISOString().slice(0, 10);
}
export function makePeriod(range: DashboardRange, end = kstDay(new Date())): Period {
  const start = range === '7d' ? addDays(end, -7) : range === '30d' ? addDays(end, -30) : shiftMonths(end, range === '6m' ? -6 : -12);
  return customPeriod(start, addDays(end, -1), range);
}
export function customPeriod(start: string, last: string, range?: DashboardRange): Period {
  const end = addDays(last, 1), days = (Date.parse(end) - Date.parse(start)) / DAY;
  const bucket_unit = range === '1y' || (!range && days > 184) ? 'month' : range === '6m' || days > 30 ? 'week' : 'day';
  const boundaries = [start];
  if (range === '1y') { for (let i = 1; i < 12; i++) boundaries.push(shiftMonths(start, i)); }
  else if (bucket_unit === 'month') { for (let i = 1; shiftMonths(start, i) < end; i++) boundaries.push(shiftMonths(start, i)); }
  else { for (let n = bucket_unit === 'week' ? 7 : 1; n < days; n += bucket_unit === 'week' ? 7 : 1) boundaries.push(addDays(start, n)); }
  boundaries.push(end); return { start, end: last, days, boundaries, bucket_unit };
}
export function previousPeriod(p: Period): Period {
  return { ...p, start: addDays(p.start, -p.days), end: addDays(p.start, -1), boundaries: p.boundaries.map(d => addDays(d, -p.days)) };
}
const actionNames = new Set(['grading_completed','past_exam_file_clicked','reference_opened','question_distribution_opened','history_viewed','history_trend_viewed','mock_saved','admission_completed','admission_result_viewed']);
const labels: Record<string,string> = { members: '활성 회원', sessions: '이용 세션', grading: '채점 완료', results: '결과 조회 세션', pwa_members: 'PWA 활성 회원', confirmations: '신규 확인 회원' };
export const featureLabels: Record<string,string> = { navigation:'화면 탐색',grading:'채점',past_exams:'기출문제',history:'성적 이력',mock:'사설 모의고사',admission:'지원 분석',community:'커뮤니티',chat:'채팅' };
function totals(rows: Fact[]) {
  const count = (key: 'user_id' | 'session_id', predicate: (f: Fact) => boolean = () => true) => new Set(rows.filter(predicate).map(f => f[key]).filter((v): v is string => v !== null)).size;
  return { members: count('user_id'), sessions: count('session_id'), grading: new Set(rows.filter(f=>f.event_name==='grading_completed').map(f=>`${f.actor_scope}:${f.grading_run_id}`)).size, results:count('session_id', f=>f.event_name==='grading_result_viewed'), pwa_members:count('user_id', f=>f.execution_channel==='pwa') };
}
function state(statuses: DataStatus[]): DataStatus { return statuses.every(s=>s==='complete') ? 'complete' : statuses.some(s=>s!=='unavailable') ? 'partial' : 'unavailable'; }
function dates(start: string, end: string): string[] { const result=[]; for(let d=start;d<end;d=addDays(d,1)) result.push(d); return result; }

/** Candidate eligibility and ordering use integer cross products, never display rounding. */
export function countChange(key: string, category: Change['category'], label: string, current: number, previous: number, target: Change['target'], unit: string): Change | null {
  const delta=current-previous;
  if(Math.max(current,previous)<20 || Math.abs(delta)<10 || (previous>0 && BigInt(Math.abs(delta))*100n<BigInt(previous)*20n)) return null;
  return { metric_key:key,category,label,current,previous,delta,percent:previous>0?delta/previous*100:null,unit,selection_priority:delta<0?2:4,rank_score:Math.abs(delta)/Math.max(previous,20),selected:false,target };
}
export function conversionChange(c: NonNullable<DashboardSource['conversion']>, p: NonNullable<DashboardSource['conversion']>): Change | null {
  if(c.closed<50 || p.closed<50) return null;
  const cross=BigInt(c.converted)*BigInt(p.closed)-BigInt(p.converted)*BigInt(c.closed);
  if((cross<0n?-cross:cross)*100n<3n*BigInt(c.closed)*BigInt(p.closed)) return null;
  const current=c.converted/c.closed*100, previous=p.converted/p.closed*100;
  return { metric_key:'grading_conversion', category:'grading',label:'입력→결과 관측률',current,previous,delta:current-previous,percent:null,unit:'%p',selection_priority:cross<0n?1:3,rank_score:Math.abs(current-previous),selected:false,target:'grading',numerator:c.converted,denominator:c.closed,previous_numerator:p.converted,previous_denominator:p.closed };
}
export function selectChanges(changes: Change[]): Change[] {
  const sorted=changes.slice().sort((a,b)=> {
    if(a.selection_priority!==b.selection_priority) return a.selection_priority-b.selection_priority;
    // Compare exact rational scores; avoid rounded percentages and floating-point ties.
    const ratio=(c:Change):[bigint,bigint] => c.category==='grading' ? [(BigInt(c.numerator!)*BigInt(c.previous_denominator!)-BigInt(c.previous_numerator!)*BigInt(c.denominator!)),BigInt(c.denominator!)*BigInt(c.previous_denominator!)] : [BigInt(Math.abs(c.current-c.previous)),BigInt(Math.max(c.previous,20))];
    const [an,ad]=ratio(a),[bn,bd]=ratio(b); const cross=(an<0n?-an:an)*bd-(bn<0n?-bn:bn)*ad;
    if(cross!==0n) return cross>0n?-1:1;
    const magnitude=a.category==='grading'?0:Math.abs(a.delta), other=b.category==='grading'?0:Math.abs(b.delta);
    return other-magnitude || (a.metric_key<b.metric_key?-1:a.metric_key>b.metric_key?1:0);
  });
  const seen=new Set<string>(); let selected=0;
  return sorted.map(c=>{ const pick=selected<3&&!seen.has(c.category); if(pick){seen.add(c.category);selected++;} return {...c,selected:pick}; });
}
export function buildDashboard(source: DashboardSource, period: Period, channel: Channel | null, compare: boolean): Dashboard {
  const prior=previousPeriod(period), all=source.facts, filtered=channel?all.filter(f=>f.execution_channel===channel):all;
  const dayStatuses=new Map(source.days.map(d=>[d.day,d.status])), confirmed=new Map(source.confirmations.map(d=>[d.day,d.count]));
  const periodRows=(p:Period, rows=filtered)=>rows.filter(f=>f.day>=p.start&&f.day<=p.end);
  const status=(p:Period)=>state(dates(p.start,addDays(p.end,1)).map(d=>dayStatuses.get(d)||'unavailable'));
  const currentStatus=status(period), priorStatus=status(prior), current=totals(periodRows(period)), previous=totals(periodRows(prior));
  const confirmations=(p:Period)=>source.confirmations.filter(d=>d.day>=p.start&&d.day<=p.end).reduce((n,d)=>n+d.count,0);
  const values={...current,confirmations:confirmations(period)}, priorValues={...previous,confirmations:confirmations(prior)};
  const cards=Object.keys(labels).map(key=> {
    const unsupported=(key==='confirmations'&&channel!==null)||(key==='pwa_members'&&channel!==null&&channel!=='pwa');
    const k=key as keyof typeof values, value=unsupported||currentStatus==='unavailable'&&key!=='confirmations'?null:values[k];
    const p=unsupported||!compare||priorStatus!=='complete'&&key!=='confirmations'?null:priorValues[k];
    const comparable=(key==='confirmations'||currentStatus==='complete')&&p!==null&&value!==null;
    return { key,label:labels[key],unit:key==='sessions'||key==='results'?'개':key==='grading'?'회':'명',value,previous:p,delta:comparable?value-p:null,percent:comparable&&p>0?(value-p)/p*100:null,status:unsupported?'unsupported' as const:key==='confirmations'?'complete' as const:currentStatus };
  });
  const factsByDay=new Map<string,Fact[]>();
  for(const f of filtered) {const rows=factsByDay.get(f.day)||[];rows.push(f);factsByDay.set(f.day,rows);}
  const dailyTotals=new Map([...factsByDay].map(([day,rows])=>[day,totals(rows)]));
  const series=(p:Period):SeriesPoint[]=>p.boundaries.slice(0,-1).map((start,i)=> {
    const end=p.boundaries[i+1], ds=dates(start,end), rows=ds.flatMap(day=>factsByDay.get(day)||[]);
    const coverage=state(ds.map(d=>dayStatuses.get(d)||'unavailable')), sums={members:0,sessions:0,grading:0,results:0,pwa_members:0,confirmations:0};
    for(const day of ds) { const t=dailyTotals.get(day)||totals([]); for(const k of Object.keys(t) as (keyof typeof t)[]) sums[k]+=t[k]; sums.confirmations+=confirmed.get(day)||0; }
    const t=totals(rows), avg=(key:keyof typeof sums)=>coverage==='complete'?sums[key]/ds.length:null;
    return {start,end,calendar_days:ds.length,available_complete_days:ds.filter(d=>dayStatuses.get(d)==='complete').length,coverage_status:coverage,members:avg('members'),sessions:avg('sessions'),grading:avg('grading'),results:avg('results'),pwa_members:channel!==null&&channel!=='pwa'?null:avg('pwa_members'),confirmations:channel?null:sums.confirmations/ds.length,bucket_totals:{...Object.fromEntries(Object.entries(t).map(([key,value])=>[key,coverage==='complete'?value:null])),confirmations:channel?null:sums.confirmations},daily_count_sum:Object.fromEntries(Object.entries(sums).map(([key,value])=>[key,key==='confirmations'?channel?null:value:coverage==='complete'?value:null])),observed_totals:{...t,confirmations:sums.confirmations}};
  });
  const fTotals=(rows:Fact[])=>({view_sessions:new Set(rows.filter(f=>f.event_name==='page_view').map(f=>f.session_id)).size,action_sessions:new Set(rows.filter(f=>actionNames.has(f.event_name)).map(f=>f.session_id)).size,action_members:new Set(rows.filter(f=>actionNames.has(f.event_name)&&f.user_id).map(f=>f.user_id)).size,actions:rows.filter(f=>actionNames.has(f.event_name)).reduce((n,f)=>n+f.actions,0)});
  const cRows=periodRows(period), pRows=periodRows(prior);
  const features=[...new Set([...cRows,...pRows].map(f=>f.feature))].sort().map(feature=>({feature,...fTotals(cRows.filter(f=>f.feature===feature)),previous:fTotals(pRows.filter(f=>f.feature===feature))})).sort((a,b)=>Math.abs(b.action_sessions-b.previous.action_sessions)-Math.abs(a.action_sessions-a.previous.action_sessions)||a.feature.localeCompare(b.feature));
  const conversion=currentStatus==='complete'&&source.conversion?.status==='available'?source.conversion:null;
  const previous_conversion=compare&&priorStatus==='complete'&&source.previous_conversion?.status==='available'?source.previous_conversion:null;
  const candidates:Change[]=[];
  if(compare&&currentStatus==='complete'&&priorStatus==='complete') {
    for(const key of ['members','sessions'] as const) {const c=countChange(key,'usage',labels[key],current[key],previous[key],'members',key==='members'?'명':'개');if(c)candidates.push(c);}
    for(const f of features) {const c=countChange(`feature_${f.feature}`,'feature',`${featureLabels[f.feature]||f.feature} 행동 세션`,f.action_sessions,f.previous.action_sessions,'features','개');if(c)candidates.push(c);}
    if(channel===null) {const c=countChange('pwa_members','pwa',labels.pwa_members,current.pwa_members,previous.pwa_members,'pwa','명');if(c)candidates.push(c);}
    if(conversion&&previous_conversion) {const c=conversionChange(conversion,previous_conversion);if(c)candidates.push(c);}
  }
  const today=kstDay(new Date(source.snapshot_at)), todayTotals=totals(all.filter(f=>f.day===today));
  const memberChannels=new Map<string,Set<string>>();
  for(const f of periodRows(period,all)) if(f.user_id){const channels=memberChannels.get(f.user_id)||new Set<string>();channels.add(f.execution_channel);memberChannels.set(f.user_id,channels);}
  const allCurrent=periodRows(period,all), channelSessions=(c:string)=>new Set(allCurrent.filter(f=>f.execution_channel===c).map(f=>f.session_id)).size;
  const pwa=channel?null:{pwa_only:0,browser_only:0,both:0,other_only:0,sessions:channelSessions('pwa'),total_sessions:totals(allCurrent).sessions,other_sessions:channelSessions('other'),unknown_sessions:channelSessions('unknown')};
  if(pwa) for(const cs of memberChannels.values()) { if(cs.has('pwa')&&cs.has('browser'))pwa.both++;else if(cs.has('pwa'))pwa.pwa_only++;else if(cs.has('browser'))pwa.browser_only++;else pwa.other_only++; }
  return {metric_version:'1',dashboard_policy_version:2,snapshot_at:source.snapshot_at,generated_at:source.snapshot_at,period,previous_period:compare?prior:null,channel,status:currentStatus,previous_status:compare?priorStatus:null,cards,series:series(period),previous_series:compare?series(prior):[],features,changes:selectChanges(candidates),conversion,previous_conversion,pwa,today:{date:today,sessions:source.started_at?todayTotals.sessions:null,grading:source.started_at?todayTotals.grading:null,status:source.started_at?'provisional':'unavailable',last_accepted_at:source.last_accepted_at},collection:{enabled:source.collection_enabled,started_at:source.started_at}};
}

export type MemberPurpose = 'member_activity' | 'audit_target' | 'audit_actor';
export interface MemberReference { user_id: string; name: string | null; email: string | null; created_at: string | null; account_info_status: 'available' | 'missing'; is_current_admin?: boolean }
export interface MemberOptions { items: MemberReference[]; next_cursor: string | null; purpose: MemberPurpose; sort_version: string; snapshot_at: string; audit_available_from?: string | null }
export interface ActivityFeed { items: (import('./analytics-contract.ts').ActivityRow & { name: string | null; email: string | null })[]; snapshot_at: string; start: string | null; end: string | null; status: DataStatus; coverage: import('./analytics-contract.ts').Coverage }
