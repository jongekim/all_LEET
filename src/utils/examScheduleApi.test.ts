import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
vi.mock('../contexts/AuthContext', () => ({ supabase: {} }));
import { createExamScheduleApi } from './examScheduleApi';
import type { ExamSchedule } from '../types/examSchedule';

const row: ExamSchedule = { key:'leet',exam_date:'2026-07-19',display_template:'{dday}',revision:1,updated_at:'2026-10-04T00:00:00Z' };
let fixtureId=0;
function fixture() {
  const fetcher=vi.fn<typeof fetch>();
  const client=createClient('https://example.test','public-key',{auth:{storageKey:`schedule-test-${++fixtureId}`,persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher}});
  const session=(id:string) => ({data:{session:{user:{id,app_metadata:{},user_metadata:{},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'},access_token:'mock',refresh_token:'mock',token_type:'bearer' as const,expires_in:3600}},error:null});
  const auth=vi.spyOn(client.auth,'getSession').mockResolvedValue(session('admin'));
  return {api:createExamScheduleApi(client),fetcher,auth,session};
}
beforeEach(()=>vi.restoreAllMocks());
afterEach(()=>vi.useRealTimers());
describe('디데이 설정 API',()=>{
  it('공개 단일 행 조회와 잘못된 응답을 구분한다',async()=>{
    const {api,fetcher}=fixture();
    fetcher.mockResolvedValueOnce(Response.json([row])).mockResolvedValueOnce(Response.json([])).mockResolvedValueOnce(Response.json([{...row,display_template:'{year}'}]));
    expect(await api.read()).toEqual(row);
    await expect(api.read()).rejects.toMatchObject({kind:'missing'});
    await expect(api.read()).rejects.toMatchObject({kind:'invalid'});
    const url=new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get('key')).toBe('eq.leet');
  });
  it('날짜·문구만 보내며 원래 revision을 조건으로 사용한다',async()=>{
    const {api,fetcher}=fixture();
    fetcher.mockResolvedValueOnce(Response.json({...row,display_template:'시험까지 {dday}',revision:2}));
    const saved=await api.save({...row,display_template:' 시험까지 {dday} '},row,'admin');
    expect(saved.revision).toBe(2);
    const [url,options]=fetcher.mock.calls[0];
    expect(new URL(String(url)).searchParams.get('revision')).toBe('eq.1');
    expect(JSON.parse(String(options?.body))).toEqual({exam_date:row.exam_date,display_template:'시험까지 {dday}'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('계정 변경을 쓰기 전·응답 후 모두 검사한다',async()=>{
    const {api,fetcher,auth,session}=fixture();
    auth.mockResolvedValue(session('other'));
    await expect(api.save(row,row,'admin')).rejects.toMatchObject({kind:'authorization'});
    expect(fetcher).not.toHaveBeenCalled();
    auth.mockResolvedValueOnce(session('admin')).mockResolvedValueOnce(session('other'));
    fetcher.mockResolvedValue(Response.json({...row,revision:2,display_template:'새 문구'}));
    await expect(api.save({...row,display_template:'새 문구'},row,'admin')).rejects.toMatchObject({kind:'authorization'});
  });
  it('0행 업데이트 후 실제 역할과 최신 값을 조회하여 충돌을 확인한다',async()=>{
    const {api,fetcher}=fixture();
    const server={...row,revision:2,display_template:'다른 변경'};
    fetcher.mockImplementation(async (url,options)=>{
      if(options?.method==='PATCH')return Response.json({code:'PGRST116',details:'The result contains 0 rows',message:'no row'},{status:406});
      if(String(url).includes('/rpc/'))return Response.json(true);
      return Response.json([server]);
    });
    await expect(api.save({...row,display_template:'내 변경'},row,'admin')).rejects.toMatchObject({kind:'conflict',current:server});
    expect(fetcher.mock.calls.filter(([,options])=>options?.method==='PATCH')).toHaveLength(1);
  });
  it('저장 결과 미확인은 자동 재시도하지 않는다',async()=>{
    const {api,fetcher}=fixture();
    fetcher.mockResolvedValue(Response.json({message:'unavailable'},{status:503}));
    await expect(api.save({...row,display_template:'새 문구'},row,'admin')).rejects.toMatchObject({kind:'unknown'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('응답 없는 조회도 15초 제한을 적용한다',async()=>{
    vi.useFakeTimers();
    const {api,fetcher}=fixture();fetcher.mockImplementation(()=>new Promise(()=>{}));
    const outcome=api.read().then(()=>null,cause=>cause);
    await vi.advanceTimersByTimeAsync(15000);
    expect(await outcome).toMatchObject({name:'AbortError'});
  });
});
