import { useEffect, useState } from 'react';
import type { AnalyticsFilters, ReportKind } from '../types/analytics';
import type { AnalyticsInsights } from '../../supabase/functions/_shared/analytics-insights';
import type { AdminAnalyticsApi } from '../utils/adminAnalyticsApi';
import { canKeepPreviousAnalytics } from '../utils/adminAnalyticsErrors';

export function useAnalyticsInsights(api:AdminAnalyticsApi,owner:string,filters:AnalyticsFilters,report:ReportKind,revision=0) {
  const key=JSON.stringify([owner,filters,report]);
  const [result,setResult]=useState<{key:string;data:AnalyticsInsights}|null>(null),[error,setError]=useState<{key:string;message:string}|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    api.insights(filters,owner,report,controller.signal).then(data=>{if(!controller.signal.aborted){setResult({key,data});setError(null);}}).catch(failure=>{if(!controller.signal.aborted){setError({key,message:failure instanceof Error?failure.message:'통계를 불러오지 못했습니다.'});if(!canKeepPreviousAnalytics(failure))setResult(null);}});
    return ()=>controller.abort();
  },[api,owner,filters,report,revision,key]);
  return {data:result?.key===key?result.data:null,error:error?.key===key?error.message:null};
}
