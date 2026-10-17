import type { GradingContext } from './analyticsClient';
import { usageAnalytics } from './usageAnalytics';

export function visibleTimer() {
  const start=performance.now();let last=start,visible=0,active=document.visibilityState==='visible';
  const sample=()=>{const now=performance.now();if(active)visible+=Math.max(0,now-last);last=now;active=document.visibilityState==='visible';return {elapsed:Math.max(0,now-start),visible};};
  document.addEventListener('visibilitychange',sample);
  return ()=>{const result=sample();document.removeEventListener('visibilitychange',sample);return result;};
}
const executions=new Map<string,{context:GradingContext;finish:ReturnType<typeof visibleTimer>;render?:ReturnType<typeof visibleTimer>}>();
export function startGradingTiming(context:GradingContext) {
  if(executions.size>=20){const first=executions.keys().next().value;if(first){executions.get(first)?.finish();executions.get(first)?.render?.();executions.delete(first);}}
  executions.set(context.grading_run_id,{context,finish:visibleTimer()});
}
export function startResultRenderTiming(context:GradingContext) {
  const timer=executions.get(context.grading_run_id);if(timer&&!timer.render)timer.render=visibleTimer();
}
export function finishResultTiming(context:GradingContext) {
  const timer=executions.get(context.grading_run_id);if(!timer)return;
  executions.delete(context.grading_run_id);const value=timer.finish();
  usageAnalytics().trackTiming(timer.context,'result',value.elapsed,value.visible);
  if(timer.render){const rendered=timer.render();usageAnalytics().trackTiming(timer.context,'render',rendered.elapsed,rendered.visible);}
}
