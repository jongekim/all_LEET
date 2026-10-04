import { expect, it } from 'vitest';
import { addDays, buildDashboard, conversionChange, countChange, makePeriod, previousPeriod, selectChanges, shiftMonths, type DashboardSource, type Fact } from '../../supabase/functions/_shared/dashboard';
const row=(day:string,user='u',session='s'):Fact=>({day,user_id:user,actor_scope:user,session_id:session,execution_channel:'pwa',feature:'grading',event_name:'grading_completed',grading_run_id:session,actions:1});
function source(start:string,days:number,facts:Fact[]):DashboardSource {return {snapshot_at:'2026-10-04T04:00:00Z',facts,days:Array.from({length:days},(_,n)=>({day:addDays(start,n),status:'complete'})),confirmations:[],conversion:null,previous_conversion:null,collection_enabled:true,started_at:'2024-01-01T00:00:00Z',last_accepted_at:null};}
it('윤년·월말의 1년은 원래 시작일 기준 정확히 12구간, 이전도 같은 일수/경계 간격',()=>{
  for(const end of ['2025-02-28','2025-03-01','2024-02-29','2026-10-04','2025-01-31']){
    const p=makePeriod('1y',end),prior=previousPeriod(p);expect(p.boundaries).toHaveLength(13);expect(prior.days).toBe(p.days);
    for(let i=1;i<12;i++)expect(p.boundaries[i]).toBe(shiftMonths(p.start,i));
    for(let i=0;i<12;i++)expect(Date.parse(p.boundaries[i+1])-Date.parse(p.boundaries[i])).toBe(Date.parse(prior.boundaries[i+1])-Date.parse(prior.boundaries[i]));
  }
  const p=makePeriod('1y','2025-02-28');expect(p.start).toBe('2024-02-28');expect(p.days).toBe(366);
  const leap=makePeriod('1y','2025-03-01');expect(leap.days).toBe(365);
});
it('주 마지막 짧은 구간도 총수가 아닌 일평균, 카드는 기간 DISTINCT, 0건 날짜 포함',()=>{
  const p=makePeriod('6m','2026-10-04'),facts:Fact[]=[];
  for(let day=p.start;day<=p.end;day=addDays(day,1))for(let n=0;n<10;n++)facts.push(row(day,'same',`s${day}-${n}`));
  const d=buildDashboard(source(p.start,p.days,facts),p,null,false);expect(d.series.every(b=>b.grading===10)).toBe(true);expect(d.series[d.series.length-1].calendar_days).toBeLessThan(7);
  expect(d.cards.find(c=>c.key==='members')?.value).toBe(1);expect(d.series[0].members).toBe(1);expect(d.series[0].daily_count_sum.members).toBe(7);
  const zero=buildDashboard(source(p.start,p.days,[]),p,null,false);expect(zero.series[0].grading).toBe(0);
});
it('하루라도 누락되면 평균을 보정하지 않고 선을 끊고 부분 카드는 관측분으로 표시',()=>{
  const p=makePeriod('6m','2026-10-04'),s=source(p.start,p.days,[row(p.start)]);s.days[1].status='unavailable';
  const d=buildDashboard(s,p,null,false);expect(d.series[0].grading).toBeNull();expect(d.series[0].coverage_status).toBe('partial');expect(d.cards[0].status).toBe('partial');expect(d.cards[0].delta).toBeNull();expect(d.changes).toHaveLength(0);
});
it('PWA/브라우저 중복 회원과 기간 전체 실행을 정확히 중복 제거하고 채널 미지원은 null',()=>{
  const p=makePeriod('7d','2026-10-04'),s=source(p.start,p.days,[row(p.start),{...row(p.start),execution_channel:'browser'}]);
  const d=buildDashboard(s,p,null,false);expect(d.cards[0].value).toBe(1);expect(d.cards.find(c=>c.key==='grading')?.value).toBe(1);expect(d.pwa?.both).toBe(1);
  const browser=buildDashboard(s,p,'browser',false);expect(browser.cards.find(c=>c.key==='pwa_members')?.value).toBeNull();expect(browser.cards.find(c=>c.key==='confirmations')?.status).toBe('unsupported');
});
it('관측률 감소는 다른 세 범주의 증가보다 우선하며 표본/정확한 3pp/건수 기준을 적용',()=>{
  const conversion=(closed:number,converted:number)=>({status:'available' as const,closed,converted,open:0,grace:0,uncertain:0,resumed:0});
  expect(conversionChange(conversion(49,0),conversion(100,100))).toBeNull();expect(conversionChange(conversion(100,72),conversion(100,75))).not.toBeNull();expect(conversionChange(conversion(1000,721),conversion(1000,750))).toBeNull();
  expect(countChange('small','usage','x',19,0,'members','명')).toBeNull();expect(countChange('floor','usage','x',59,50,'members','명')).toBeNull();expect(countChange('exact','usage','x',60,50,'members','명')).not.toBeNull();
  const candidates=[countChange('m','usage','회원',100,20,'members','명')!,countChange('f','feature','기능',100,20,'features','개')!,countChange('p','pwa','PWA',100,20,'pwa','명')!,conversionChange(conversion(100,40),conversion(100,72))!];
  const selected=selectChanges(candidates).filter(c=>c.selected);expect(selected).toHaveLength(3);expect(selected[0].metric_key).toBe('grading_conversion');expect(new Set(selected.map(c=>c.category)).size).toBe(3);
});
it('동률은 절대 변화와 지표 키로 일관되게 정렬하고 범주당 한 후보만 선택',()=>{
  const a=countChange('z','usage','x',40,20,'members','명')!,b=countChange('a','usage','x',40,20,'members','명')!;
  const selected=selectChanges([a,b]);expect(selected[0].metric_key).toBe('a');expect(selected.filter(c=>c.selected)).toHaveLength(1);
});
