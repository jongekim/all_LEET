import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createUsageClient } from '../utils/analyticsClient';
import { ResultTelemetryContext } from '../contexts/ResultTelemetryContext';
import { useToolTracking } from './useToolTracking';

let client:ReturnType<typeof createUsageClient>;
vi.mock('../utils/usageAnalytics',()=>({usageAnalytics:()=>client}));
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let visibility='visible';
const observations:{callback:IntersectionObserverCallback;target?:Element}[]=[];
beforeEach(()=>{
  let next=100;
  client=createUsageClient({enabled:true,now:()=>Date.parse('2026-10-16T01:00:00Z'),uuid:()=>id(next++),visible:()=>visibility==='visible',environment:()=>({execution_channel:'browser',display_mode:'browser',detection_method:'media_query',detection_version:1,os_family:'android',device_class:'mobile'}),storage:{getItem:()=>null,setItem:()=>{}},send:async()=>[]});
  client.configure(id(1),false);client.page('/result','entry');visibility='visible';observations.length=0;
  vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility as DocumentVisibilityState);
  vi.stubGlobal('IntersectionObserver',class {record:{callback:IntersectionObserverCallback;target?:Element};constructor(callback:IntersectionObserverCallback){this.record={callback};observations.push(this.record);}observe(target:Element){this.record.target=target;}disconnect(){} });
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
function Button({subject='verbal'}:{subject?:string}) {
  const {observe:observeTool,begin:beginTool}=useToolTracking('distribution',true,{subjects:subject});
  return <button ref={observeTool} onClick={()=>beginTool()('success')}>{subject}</button>;
}
function Preview(){return <ResultTelemetryContext.Provider value={{id:id(2),verbal:id(3),reasoning:id(4),surface:'new',enabled:true,owner:id(1)}}><Button/><Button/><Button subject="reasoning"/></ResultTelemetryContext.Provider>;}
function intersect(){act(()=>{for(const row of observations)if(row.target)row.callback([{isIntersecting:true,target:row.target}] as IntersectionObserverEntry[],{} as IntersectionObserver);});}
it('사용 가능과 실제 노출을 구분하며 여러 문항을 과목별 문맥 하나로 중복 제거한다',()=>{
  render(<Preview/>);
  expect(client.pending().filter(e=>e.event_name==='tool_available')).toHaveLength(2);
  expect(client.pending().filter(e=>e.event_name==='tool_exposed')).toHaveLength(0);
  visibility='hidden';intersect();expect(client.pending().filter(e=>e.event_name==='tool_exposed')).toHaveLength(0);
  visibility='visible';act(()=>document.dispatchEvent(new Event('visibilitychange')));intersect();
  expect(client.pending().filter(e=>e.event_name==='tool_exposed')).toHaveLength(2);
  act(()=>screen.getAllByRole('button')[0].click());
  const use=client.pending().find(e=>e.event_name==='tool_used')!,result=client.pending().find(e=>e.event_name==='tool_result')!;
  expect(result.attributes.operation_id).toBe(use.attributes.operation_id);expect(result.attributes.result_context_id).toBe(id(3));
});
it('페이지나 계정이 바뀐 뒤 늦게 끝난 조작 결과는 새 화면·회원에게 재귀속하지 않는다',()=>{
  let finish:ReturnType<ReturnType<typeof useToolTracking>['begin']>|undefined;
  function Delayed(){const {observe:observeTool,begin:beginTool}=useToolTracking('note',true);return <button ref={observeTool} onClick={()=>{finish=beginTool();}}>save</button>;}
  render(<ResultTelemetryContext.Provider value={{id:id(2),verbal:id(3),reasoning:id(4),surface:'history',enabled:true,owner:id(1)}}><Delayed/></ResultTelemetryContext.Provider>);
  act(()=>screen.getByRole('button').click());client.page('/history','next');finish!('success');
  expect(client.pending().filter(e=>e.event_name==='tool_result')).toHaveLength(0);
  act(()=>screen.getByRole('button').click());client.configure(id(9),false);finish!('success');expect(client.pending()).toHaveLength(0);
});
