import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UNSAFE_LocationContext } from 'react-router-dom';
import { ResultTelemetryContext as ResultContext, type TelemetryTool } from '../contexts/ResultTelemetryContext';
import { analyticsId } from '../utils/analyticsId';
import { usageAnalytics } from '../utils/usageAnalytics';
import type { Attributes } from '../types/analytics';

export function useToolTracking(tool:TelemetryTool,eligible:boolean,attributes:Attributes={}) {
  const provided=useContext(ResultContext),location=useContext(UNSAFE_LocationContext);
  const fallback=useMemo(()=>({id:analyticsId(),entry:location?.location.key}),[location?.location.key]);
  const id=provided?(attributes.subjects==='verbal'?provided.verbal:attributes.subjects==='reasoning'?provided.reasoning:provided.id):fallback.id,surface=provided?.surface||'past',enabled=provided?.enabled||false;
  const [node,setNode]=useState<HTMLElement|null>(null);
  const serialized=JSON.stringify(attributes);
  const attrs=useMemo(()=>JSON.parse(serialized) as Attributes,[serialized]);
  const observe=useCallback((element:HTMLElement|null)=>{setNode(element);},[]);
  useEffect(()=>{
    if(!enabled||!eligible)return;
    const client=usageAnalytics(),generation=client.identity(),common={...attrs,result_context_id:id,tool,surface};
    client.trackForIdentity(generation,'tool_available',surface==='past'?'past_exams':'grading',common,`${id}:${tool}:available`);
    if(!node||typeof IntersectionObserver==='undefined')return;
    let exposed=false;
    const expose=(intersecting:boolean)=>{if(!exposed&&intersecting&&document.visibilityState==='visible'){exposed=true;client.trackForIdentity(generation,'tool_exposed',surface==='past'?'past_exams':'grading',common,`${id}:${tool}:exposed`);}};
    let intersecting=false;
    const observer=new IntersectionObserver(entries=>{intersecting=entries.some(e=>e.isIntersecting);expose(intersecting);},{threshold:.2});
    const visible=()=>expose(intersecting);observer.observe(node);document.addEventListener('visibilitychange',visible);
    return ()=>{observer.disconnect();document.removeEventListener('visibilitychange',visible);};
  },[enabled,eligible,id,surface,tool,node,attrs]);
  const begin=()=>{
    const client=usageAnalytics(),generation=client.identity(),entry=client.entry(),operation_id=analyticsId();
    const common={...attrs,result_context_id:id,tool,surface,operation_id};
    if(enabled&&eligible)client.trackForIdentity(generation,'tool_used',surface==='past'?'past_exams':'grading',common);
    return (outcome:'success'|'failed'|'unknown')=>{if(enabled&&eligible&&client.entry()===entry)client.trackForIdentity(generation,'tool_result',surface==='past'?'past_exams':'grading',{...common,outcome});};
  };
  return {observe,begin};
}
