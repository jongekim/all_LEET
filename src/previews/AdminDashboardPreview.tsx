import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminDashboard, type DashboardServices } from '../components/admin/AdminDashboard';
import { AdminMemberPicker } from '../components/admin/AdminMemberPicker';
import { addDays, buildDashboard, kstDay, makePeriod, type DashboardSource, type Fact } from '../../supabase/functions/_shared/dashboard';
import type { ActivityRow, MemberReference } from '../types/analytics';
const owner='00000000-0000-4000-8000-000000000001';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const today=kstDay(new Date()),snapshot=new Date().toISOString();
const members:MemberReference[]=Array.from({length:121},(_,i)=>({user_id:id(i+2),name:`예시 회원 ${String(i+1).padStart(3,'0')}`,email:`member${i+1}@example.test`,created_at:new Date(Date.parse(`${today}T00:00:00Z`)-i*86400000).toISOString(),account_info_status:'available'}));
const facts:Fact[]=[],days:DashboardSource['days']=[],confirmations:DashboardSource['confirmations']=[];
for(let i=-735;i<=0;i++){
  const day=addDays(today,i);days.push({day,status:i===0?'partial':'complete'});confirmations.push({day,count:i%11===0?3:0});
  const amount=8+Math.floor(5*(1+Math.sin(i/13)))+(i>-30?9:0);
  for(let n=0;n<amount;n++){
    const user_id=id(2+((Math.abs(i)*3+n)%60)),session_id=id(100000+Math.abs(i)*100+n);
    facts.push({day,user_id,actor_scope:`user:${user_id}`,session_id,execution_channel:n%3===0?'pwa':'browser',feature:n%2===0?'grading':'past_exams',event_name:n%2===0?'grading_completed':'past_exam_file_clicked',grading_run_id:id(300000+Math.abs(i)*100+n),actions:1});
  }
}
const source:DashboardSource={snapshot_at:snapshot,facts,days,confirmations,conversion:{status:'available',closed:100,converted:63,open:4,grace:2,uncertain:1,resumed:2},previous_conversion:{status:'available',closed:100,converted:75,open:0,grace:0,uncertain:1,resumed:1},collection_enabled:true,started_at:new Date(Date.parse(snapshot)-800*86400000).toISOString(),last_accepted_at:snapshot};
async function pause(signal?:AbortSignal){await new Promise(resolve=>setTimeout(resolve,80));if(signal?.aborted)throw new DOMException('취소','AbortError');}
const services:DashboardServices={
  async dashboard(_owner,range,channel='',compare=true,signal){await pause(signal);const period=makePeriod(range,today);return buildDashboard({...source,conversion:period.days>90?null:source.conversion,previous_conversion:period.days>90?null:source.previous_conversion},period,channel as Fact['execution_channel']||null,compare);},
  async options(_owner,purpose,query='',cursor='',signal){await pause(signal);let items=purpose==='audit_actor'?[{...members[0],user_id:owner,name:'예시 관리자',is_current_admin:true},{user_id:id(999),name:null,email:null,created_at:null,account_info_status:'missing' as const,is_current_admin:false}]:members;
    items=items.filter(m=>!query||[m.name,m.email,m.user_id].some(v=>v?.toLowerCase().includes(query.toLowerCase())));const offset=Number(cursor)||0;
    return {items:items.slice(offset,offset+50),next_cursor:items.length>offset+50?String(offset+50):null,purpose,sort_version:'1',snapshot_at:snapshot};},
  async feed(f,_owner,signal){await pause(signal);const start=f.start>addDays(today,-90)?f.start:addDays(today,-90);const rows=facts.filter(r=>r.day>=start&&r.day<=f.end&&(!f.channel||r.execution_channel===f.channel)).reverse().slice(0,20);
    return {snapshot_at:snapshot,start:`${start}T00:00:00+09:00`,end:`${addDays(f.end,1)}T00:00:00+09:00`,status:start>f.start?'partial':'complete',coverage:{available_from:`${addDays(today,-90)}T00:00:00+09:00`,available_through:snapshot,coverage_status:start>f.start?'partial':'complete'},items:rows.map((r,i)=>({...r,event_name:r.event_name as ActivityRow['event_name'],feature:r.feature as ActivityRow['feature'],event_id:id(900000+i),page_instance_id:id(900),page_entry_id:id(901),event_sequence:1,occurred_at:`${r.day}T12:00:00+09:00`,received_at:`${r.day}T12:00:01+09:00`,metric_version:'1',route:'/',source:'client',clock_status:'reported',display_mode:r.execution_channel==='pwa'?'standalone':'browser',detection_method:'media_query',detection_version:1,os_family:'android',device_class:'mobile',attributes:{},name:members.find(m=>m.user_id===r.user_id)?.name||null,email:members.find(m=>m.user_id===r.user_id)?.email||null}))};},
};
export function Preview(){
  const [detail,setDetail]=useState(''),[target,setTarget]=useState<MemberReference|null>(null),[actor,setActor]=useState<MemberReference|null>(null);
  return <><div style={{background:'#fef3c7',padding:14,textAlign:'center'}}>분리된 개발 미리보기 · 모든 회원/기록은 예시 데이터 · 운영 서버 요청 없음</div><AdminDashboard owner={owner} services={services} onDetail={(tab,f)=>setDetail(`상세 이동: ${tab} · ${f.start} ~ ${f.end}`)} onMemberSelect={(user,f)=>setDetail(`회원 활동 이동: ${user} · ${f.start} ~ ${f.end} · 상세 자료는 최근 90일 범위`)}/><div className="admin-dash"><p role="status" className="admin-dash-member">{detail}</p><section className="admin-dash-panel"><h2>관리자 조회 이력의 공통 회원 선택기</h2><AdminMemberPicker owner={owner} purpose="audit_target" label="조회 대상 회원" value={target} onChange={setTarget} loadOptions={services.options}/><AdminMemberPicker owner={owner} purpose="audit_actor" label="조회 관리자" value={actor} onChange={setActor} loadOptions={services.options}/><p>선택 후 필터 적용으로 이력을 조회합니다. UUID 직접 입력은 함께 유지합니다.</p></section></div></>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
