import { buildInsights,type InsightEvent,type InsightsSource } from '../../supabase/functions/_shared/analytics-insights';
import type { AnalyticsFilters,ReportKind } from '../../src/types/analytics';
import { addDays } from '../../supabase/functions/_shared/dashboard';
import { parseFilters } from '../../supabase/functions/_shared/analytics-contract';
const member='00000000-0000-4000-8000-000000000002';
export function insightsFixture(url:URL) {
 const filters=parseFilters(url.searchParams)! as AnalyticsFilters;
 const base:InsightEvent={actor_scope:member,user_id:member,session_id:member,page_entry_id:member,received_at:`${filters.end}T12:00:00+09:00`,event_name:'grading_requested',feature:'grading',route:'/',execution_channel:'pwa',os_family:'android',device_class:'mobile',is_core:false,attributes:{grading_run_id:member,input_flow_id:member,subjects:'both',app_version:'1.12.3'}};
 const events:InsightEvent[]=['grading_input_started','grading_requested','grading_completed','grading_result_viewed'].map(event_name=>({...base,event_name,is_core:event_name==='grading_completed',attributes:{...base.attributes,...(event_name==='grading_result_viewed'?{entry_source:'new_grading'}:{})}}));
 for(const tool of ['distribution','field','edit','note'])for(const event_name of ['tool_available','tool_exposed','tool_used','tool_result'])events.push({...base,event_name,attributes:{...base.attributes,tool,surface:'new',result_context_id:member,operation_id:member,outcome:'success'}});
 events.push({...base,event_name:'client_timing',attributes:{...base.attributes,timing_phase:'result',elapsed_ms:800,visible_ms:750}});
 const source:InsightsSource={snapshot_at:new Date().toISOString(),available_from:'2023-01-01T00:00:00Z',started_at:'2023-01-01T00:00:00Z',last_accepted_at:base.received_at,collection_enabled:true,events,sessions:[{session_id:member,last_activity_received_at:base.received_at,uncertain:false}],first_usage:[{user_id:member,first_usage_known:true,first_core_received_at:`${addDays(filters.end,-15)}T12:00:00+09:00`,first_pwa_core_received_at:`${addDays(filters.end,-15)}T12:00:00+09:00`,first_grading_received_at:base.received_at}],gaps:[],quality:{submitted:21,accepted:21,duplicate:0,rejected:0,processing_failed:0},publications:{days:0,first_day:null,last_day:null,published_at:null}};
 return buildInsights(source,filters,(url.searchParams.get('report')||'overview') as ReportKind);
}
