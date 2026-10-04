import { beforeEach, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ supabase: { auth } }));
import { adminAnalyticsApi } from './adminAnalyticsApi';
const session = (id: string) => ({ data: { session: { user: { id }, access_token: 'private-token' } }, error: null });
beforeEach(() => { vi.restoreAllMocks(); auth.getSession.mockReset(); });
it('회원 활동에는 선택한 대상만 전송하고 빈 optional 값·비밀 토큰을 URL에 넣지 않는다', async () => {
  auth.getSession.mockResolvedValue(session('admin'));
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ items: [], next_cursor: null }));
  await adminAnalyticsApi.activity({ start: '2026-10-01', end: '2026-10-02' }, 'admin', { user_id: 'member', session_id: undefined });
  const [url, options] = fetchMock.mock.calls[0]; expect(String(url)).not.toContain('undefined'); expect(String(url)).not.toContain('private-token'); expect(String(url)).not.toContain('session_id');
  expect(options?.cache).toBe('no-store');
});
it('계정이 바뀌면 요청 전 차단하며 응답 중 바뀌어도 이전 개인정보를 반환하지 않는다', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ items: [{ email: 'private@example.test' }] }));
  auth.getSession.mockResolvedValue(session('other'));
  await expect(adminAnalyticsApi.members({ start: '2026-10-01', end: '2026-10-02' }, 'admin')).rejects.toThrow('계정이 변경'); expect(fetchMock).not.toHaveBeenCalled();
  auth.getSession.mockResolvedValueOnce(session('admin')).mockResolvedValueOnce(session('other'));
  await expect(adminAnalyticsApi.members({ start: '2026-10-01', end: '2026-10-02' }, 'admin')).rejects.toThrow('계정이 변경');
});
it('서버 오류의 응답 본문을 로그에 복사하지 않는다', async () => {
  auth.getSession.mockResolvedValue(session('admin'));
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ code: 'ANALYTICS_UNAVAILABLE', email: 'private@example.test' }, { status: 503 }));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await expect(adminAnalyticsApi.members({ start: '2026-10-01', end: '2026-10-02' }, 'admin')).rejects.toThrow('통계를 불러오지 못했습니다'); expect(JSON.stringify(log.mock.calls)).not.toContain('private@example.test');
});
it('HTML 403도 권한 거절로 인식하고 동시에 진행하던 늦은 성공은 제공하지 않는다',async()=>{
  const {createAdminAnalyticsApi}=await import('./adminAnalyticsApi');const {AnalyticsAuthorizationScope}=await import('./adminAnalyticsErrors');const scope=new AnalyticsAuthorizationScope('admin'),api=createAdminAnalyticsApi(scope);
  auth.getSession.mockResolvedValue(session('admin'));let finish:((r:Response)=>void)|undefined;
  vi.spyOn(globalThis,'fetch').mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce(new Response('<html>denied</html>',{status:403}));
  const late=api.members({start:'2026-10-01',end:'2026-10-02'},'admin');const outcome=late.then(()=>null,e=>e);await vi.waitFor(()=>expect(finish).toBeDefined());
  await expect(api.options('admin','member_activity')).rejects.toMatchObject({status:403,retryable:false});finish!(Response.json({items:[{email:'private@example.test'}]}));
  expect(await outcome).toMatchObject({status:403});await expect(api.members({start:'2026-10-01',end:'2026-10-02'},'admin')).rejects.toMatchObject({status:403});
});
it('목록 API는 기간·보고서 필터 없이 목적·검색·커서만 보내며 일시 503은 구분한다',async()=>{
  auth.getSession.mockResolvedValue(session('admin'));const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({items:[],next_cursor:null}));
  await adminAnalyticsApi.options('admin','audit_target',' 이름 ','cursor');const url=new URL(String(fetchMock.mock.calls[0][0]));expect([...url.searchParams.keys()].sort()).toEqual(['cursor','purpose','query']);
  fetchMock.mockResolvedValue(Response.json({code:'ANALYTICS_UNAVAILABLE'},{status:503}));vi.spyOn(console,'error').mockImplementation(()=>{});
  await expect(adminAnalyticsApi.options('admin','audit_actor')).rejects.toMatchObject({status:503,retryable:true});
});
