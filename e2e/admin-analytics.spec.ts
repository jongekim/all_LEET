import { expect, test, type Page } from '@playwright/test';
import { addDays, buildDashboard, kstDay, makePeriod, previousPeriod, type DashboardRange, type Fact } from '../supabase/functions/_shared/dashboard';
const admin = '00000000-0000-4000-8000-000000000001', member = '00000000-0000-4000-8000-000000000002';
const time = '2026-10-01T01:00:00Z';
const filters = { start: '2026-10-01', end: '2026-10-02' };
const coverage = { available_from: '2026-09-01T00:00:00Z', available_through: time, coverage_status: 'complete' };
const report = {
  metric_version: '1', source: 'supabase_usage', generated_at: time, data_through: time, status: 'complete', filters, coverage,
  metrics: [{ key: 'members', label: '활성 회원', value: 2, unit: '명', status: 'complete' }, { key: 'sessions', label: '이용 세션', value: 3, unit: '개', status: 'complete' }, { key: 'grading', label: '채점 완료', value: 1, unit: '회', status: 'complete' }, { key: 'results', label: '결과 조회 세션', value: 1, unit: '개', status: 'complete' }],
  daily: [{ date: '2026-10-01', members: 2, sessions: 3, grading: 1 }], features: [{ feature: 'grading', members: 2, sessions: 3, actions: 5 }],
  conversion: { status: 'available' as const, closed: 2, converted: 1, open: 1, grace: 0, uncertain: 0, resumed: 1 }, pwa: { pwa_only: 1, browser_only: 0, both: 1, other_only: 0 },
  cohorts: [{ date: '2026-10-01', members: 2, d1: 1, d7: null, d30: null }], cohort_status: 'available', quality: { submitted: 8, accepted: 7, duplicate: 1, rejected: 0, processing_failed: 0, unknown_first_usage: 0 }, grading: { grading_completed: 1, save_success: 2 }, installation: { install_cta_clicked: 2 },
  inventory: { accounts: 2, confirmed: 2, official_records: 2, official_groups: 1, mock_records: 0, invalid_records: 0 }, membership: { status: 'available', signups: 2, confirmations: 2, mature_confirmations: 2, first_grading_in_7d: 1, first_usage_unknown: 0 }, comparison: { status: 'unavailable' },
};
const reference={user_id:member,name:'<script>테스트 회원</script>',email:'member@example.test',created_at:time,account_info_status:'available'};
const activity={event_id:member,user_id:member,session_id:member,page_instance_id:admin,page_entry_id:member,event_sequence:1,received_at:time,occurred_at:time,metric_version:'1',event_name:'grading_completed',feature:'grading',route:'/',source:'client',clock_status:'reported',execution_channel:'pwa',display_mode:'standalone',detection_method:'media_query',detection_version:1,os_family:'android',device_class:'mobile',attributes:{year:'2027',subjects:'both',grading_run_id:member,input_flow_id:admin}};
function dashboardFixture(url:URL){
  const p=makePeriod((url.searchParams.get('range')||'7d') as DashboardRange),prior=previousPeriod(p),days=[];
  for(let day=prior.start;day<=p.end;day=addDays(day,1))days.push({day,status:'complete' as const});
  const fact:Fact={day:p.end,user_id:member,actor_scope:member,session_id:member,execution_channel:'pwa',feature:'grading',event_name:'grading_completed',grading_run_id:member,actions:1};
  return buildDashboard({snapshot_at:new Date().toISOString(),facts:[fact],days,confirmations:[],conversion:p.days<=90?{...report.conversion,closed:100,converted:40}:null,previous_conversion:p.days<=90?{...report.conversion,closed:100,converted:72}:null,collection_enabled:true,started_at:'2023-01-01T00:00:00Z',last_accepted_at:time},p,url.searchParams.get('channel') as Fact['execution_channel']||null,url.searchParams.get('compare')!=='none');
}
async function mock(page: Page, allowed = true, fail = false) {
  const requests: string[] = [];
  await page.addInitScript(({ admin }) => localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token', JSON.stringify({ access_token: 'mock-token', refresh_token: 'mock-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: admin, email: 'admin@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated' } })), { admin });
  await page.route('https://*.supabase.co/**', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname.includes('/admin-analytics/')) {
      requests.push(req.url()); expect(req.url()).not.toContain('undefined'); expect(req.method()).toBe('GET'); expect(req.headers().authorization).toBe('Bearer mock-token');
      if (fail) { await route.fulfill({ status: 503, json: { code: 'ANALYTICS_UNAVAILABLE' } }); return; }
      if(url.pathname.endsWith('dashboard'))await route.fulfill({json:dashboardFixture(url)});
      else if(url.pathname.endsWith('activity-feed'))await route.fulfill({json:{items:[{...activity,...reference}],snapshot_at:new Date().toISOString(),start:`${url.searchParams.get('start')}T00:00:00+09:00`,end:`${addDays(url.searchParams.get('end')!,1)}T00:00:00+09:00`,status:'complete',coverage}});
      else if(url.pathname.endsWith('member-options'))await route.fulfill({json:{items:url.searchParams.get('purpose')==='audit_actor'?[{...reference,user_id:admin,name:'현재 관리자',is_current_admin:true},{user_id:'00000000-0000-4000-8000-000000000999',name:null,email:null,created_at:null,account_info_status:'missing',is_current_admin:false}]:[reference],next_cursor:null,purpose:url.searchParams.get('purpose'),sort_version:'1',snapshot_at:time}});
      else if (url.pathname.endsWith('member-directory')) await route.fulfill({ json: { items: [{ user_id: member, name: '<script>테스트 회원</script>', email: 'member@example.test', created_at: time, confirmed_at: time, last_seen: time, sessions: 2, grading: 1, past_exams: 1, history_views: 1, channels: ['pwa', 'browser'] }], next_cursor: null, coverage } });
      else if (url.pathname.endsWith('member-activity')) await route.fulfill({ json: { items: [{ event_id: member, user_id: member, session_id: member, page_instance_id: admin, page_entry_id: member, event_sequence: 1, received_at: time, occurred_at: time, metric_version: '1', event_name: 'grading_completed', feature: 'grading', route: '/', source: 'client', clock_status: 'reported', execution_channel: 'pwa', display_mode: 'standalone', detection_method: 'media_query', detection_version: 1, os_family: 'android', device_class: 'mobile', attributes: { year: '2027', subjects: 'both', grading_run_id: member, input_flow_id: admin } }], next_cursor: null, coverage } });
      else if (url.pathname.endsWith('admin-access-history')) await route.fulfill({ json: { items: [{ id: 1, admin_user_id: admin, target_user_id: member, target_session_id: null, kind: 'member_activity', received_at: time, returned_count: 1, status: 'provided', filters }], next_cursor: null } });
      else await route.fulfill({ json: report });
      return;
    }
    if (url.pathname.includes('/rpc/current_user_is_admin')) { await route.fulfill({ json: allowed }); return; }
    await route.fulfill({ json: [] });
  });
  return requests;
}
for (const width of [390, 1280]) test(`관리자 통계 7개 탭·필터·회원 활동 ${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 }); const requests = await mock(page);
  await page.goto('/admin'); await page.getByRole('link', { name: /이용 통계/ }).click();
  await expect(page.getByRole('heading', { name: '서비스 이용 통계' })).toBeVisible();
  await expect(page.getByRole('heading',{name:'서비스 변화 대시보드'})).toBeVisible();await expect(page.locator('.admin-dash-card')).toHaveCount(6);
  for (const name of ['기능', '채점', '회원/재방문', 'PWA']) {
    await page.getByRole('tab', { name, exact: true }).click(); await expect(page.getByRole('tabpanel')).not.toContainText('불러오고 있습니다');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole('heading', { name: '설치 신호' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pwa-analytics.png'), fullPage: true });
  await page.getByRole('tab', { name: '회원 활동', exact: true }).click();
  await expect(page.getByRole('cell', { name: /member@example.test/ })).toBeVisible();
  await page.getByLabel('회원 검색어', { exact: true }).fill('member@example.test'); await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('button', { name: '활동 보기', exact: true }).click();
  await expect(page.getByRole('cell', { name: /채점 계산 완료/ })).toBeVisible();
  await expect(page.locator('main script')).toHaveCount(0); expect(page.url()).not.toContain('member%40');
  expect(requests.some(url => url.includes(`user_id=${member}`))).toBe(true);
  const before = requests.filter(u => u.includes('member-activity')).length;
  await page.getByLabel('세션 UUID', { exact: true }).fill('bad'); await page.getByRole('button', { name: '세션 조회', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('유효한 세션 UUID'); expect(requests.filter(u => u.includes('member-activity')).length).toBe(before);
  await page.getByRole('tab', { name: '관리자 조회 이력', exact: true }).click();
  await expect(page.getByRole('cell', { name: '활동 조회', exact: true })).toBeVisible();
  await page.getByLabel('관리자 UUID', { exact: true }).fill(admin);
  // Typing a filter must not repeat audited API requests before explicit submission.
  expect(requests.filter(u => u.includes('admin-access-history')).every(u=>!new URL(u).searchParams.has('admin_user_id'))).toBe(true);
  await page.getByRole('tab', { name: '개요', exact: true }).click();
  await page.getByRole('combobox', { name: '실행 채널', exact: true }).selectOption('pwa');
  await expect(page.getByText('채널 필터 적용 중 · 전체 채널 비교 미지원',{exact:true})).toBeVisible();expect(requests.some(u=>u.includes('dashboard?')&&u.includes('channel=pwa'))).toBe(true);
});
test('통계 오류와 권한 없는 직접 접근', async ({ page }) => {
  await mock(page, true, true); await page.goto('/admin/analytics'); await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다');
});
test('일반 회원에게 통계 API 요청이 발생하지 않는다', async ({ page }) => {
  const requests = await mock(page, false); await page.goto('/admin/analytics'); await expect(page).toHaveURL('/',{timeout:15_000}); expect(requests).toHaveLength(0);
});
test('현재 계정의 HTML 403은 모든 개인 행을 지우고 다른 탭의 재조회를 중단한다',async({page})=>{
  const requests=await mock(page);await page.goto('/admin/analytics?tab=activity');await expect(page.getByRole('cell',{name:/member@example.test/})).toBeVisible();
  await page.route('https://*.supabase.co/functions/v1/admin-analytics/member-activity**',route=>route.fulfill({status:403,contentType:'text/html',body:'<html>Denied</html>'}));
  await page.getByRole('button',{name:'활동 보기',exact:true}).click();await expect(page.getByRole('alert')).toContainText('관리자 권한');
  await expect(page.getByRole('cell',{name:/member@example.test/})).toHaveCount(0);await expect(page.getByLabel('회원 검색어',{exact:true})).toHaveCount(0);
  const before=requests.length;await expect(page.getByRole('tab')).toHaveCount(0);await expect(page.getByRole('alert')).toContainText('관리자 권한');expect(requests.length).toBe(before);
});

for(const width of [390,1280])test(`실제 대시보드 기간·회원 상세 이동·선택 해제 ${width}`,async({page},info)=>{
  const requests=await mock(page);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width,height:900});await page.goto('/admin/analytics');
  for(const label of ['7일','30일','6개월','1년']){await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByText('선택 기간의 자료 가용',{exact:true})).toBeVisible();}
  await page.getByText('구간별 정확한 값 보기',{exact:true}).click();await expect(page.locator('details tbody tr')).toHaveCount(12);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath('actual-admin-dashboard.png'),fullPage:true});
  await page.getByRole('combobox',{name:'실행 채널',exact:true}).selectOption('pwa');await expect(page.getByText('채널 필터 적용 중 · 전체 채널 비교 미지원',{exact:true})).toBeVisible();
  await page.locator('.admin-dash-feed table').getByRole('button').first().click();await expect(page.getByRole('tab',{name:'회원 활동',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByText(/대시보드 분석 .* 상세 조회 .* 상세 원본 최대 90일/)).toBeVisible();await expect(page.getByRole('cell',{name:/채점 계산 완료/})).toBeVisible();
  const request=new URL(requests.filter(u=>u.includes('member-activity')).at(-1)!);expect(request.searchParams.get('channel')).toBe('pwa');expect(request.searchParams.get('start')).toBe(addDays(kstDay(new Date()),-90));expect(page.url()).not.toContain(member);expect(page.url()).not.toContain('member%40');
  await expect(page.locator('.admin-picker-selected')).toContainText('member@example.test');const before=requests.filter(u=>u.includes('member-activity')).length;
  await page.getByRole('button',{name:'선택 해제',exact:true}).click();await expect(page.getByRole('cell',{name:/채점 계산 완료/})).toHaveCount(0);expect(requests.filter(u=>u.includes('member-activity')).length).toBe(before);
  await page.getByRole('tab',{name:'개요',exact:true}).click();await expect(page.getByRole('button',{name:'1년',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('combobox',{name:'실행 채널',exact:true})).toHaveValue('pwa');expect(errors).toEqual([]);
});
test('PWA 개인 선택은 전체 코호트를 바꾸지 않고 PWA 채널로 회원 상세 이동',async({page})=>{
  const requests=await mock(page);await page.goto('/admin/analytics?tab=pwa&feature=grading&year=2027');await expect(page.getByRole('heading',{name:'최초 PWA 핵심 이용 기준 재방문'})).toBeVisible();
  await page.getByRole('button',{name:'회원 선택 목록 열기'}).click();await page.getByRole('listbox').getByRole('option').click();await expect(page.getByRole('cell',{name:/채점 계산 완료/})).toBeVisible();
  const url=new URL(requests.filter(u=>u.includes('member-activity')).at(-1)!);expect(url.searchParams.get('channel')).toBe('pwa');expect(url.searchParams.get('user_id')).toBe(member);expect(url.searchParams.get('feature')).toBe('grading');expect(url.searchParams.get('year')).toBe('2027');
});
test('감사 대상·과거 관리자 목록 선택은 조회 제출까지 요청을 보류하고 직접 UUID와 연동',async({page})=>{
  const requests=await mock(page);await page.goto('/admin/analytics?tab=access');await expect(page.getByRole('cell',{name:'활동 조회',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'조회 대상 회원 목록 열기'}).click();await page.getByRole('listbox').getByRole('option').click();await expect(page.getByLabel('대상 회원 UUID',{exact:true})).toHaveValue(member);
  await page.getByRole('button',{name:'조회 관리자 목록 열기'}).click();await page.getByRole('option',{name:/계정 정보 없음/}).click();await expect(page.getByLabel('관리자 UUID',{exact:true})).toHaveValue('00000000-0000-4000-8000-000000000999');
  // Initial Auth resolution can remount the route. Draft identities must never
  // enter history filters, regardless of the number of initial unfiltered reads.
  const reads=requests.filter(u=>u.includes('admin-access-history'));
  expect(reads.length).toBeGreaterThan(0);expect(reads.every(u=>{const q=new URL(u).searchParams;return !q.has('target_user_id')&&!q.has('admin_user_id');})).toBe(true);
  await page.getByRole('button',{name:'조회',exact:true}).click();await expect.poll(()=>requests.filter(u=>u.includes('admin-access-history')).some(u=>{const q=new URL(u).searchParams;return q.get('target_user_id')===member&&q.get('admin_user_id')==='00000000-0000-4000-8000-000000000999';})).toBe(true);
  const url=new URL(requests.filter(u=>u.includes('admin-access-history')).at(-1)!);expect(url.searchParams.get('target_user_id')).toBe(member);expect(url.searchParams.get('admin_user_id')).toBe('00000000-0000-4000-8000-000000000999');expect(page.url()).not.toContain(member);
});
test('목록에서 HTML 401을 받으면 대시보드·피드·선택 화면을 함께 제거',async({page})=>{
  await mock(page);await page.goto('/admin/analytics');await expect(page.locator('.admin-dash-feed table')).toContainText('member@example.test');
  await page.route('https://*.supabase.co/functions/v1/admin-analytics/member-options**',route=>route.fulfill({status:401,contentType:'text/html',body:'<html>Expired</html>'}));
  await page.getByRole('button',{name:'회원 선택 목록 열기'}).click();await expect(page.getByRole('alert')).toContainText('로그인 상태');await expect(page.locator('.admin-dash')).toHaveCount(0);await expect(page.getByRole('combobox')).toHaveCount(0);await expect(page.getByRole('cell',{name:/member@example.test/})).toHaveCount(0);
});
test('일시적 대시보드 갱신 실패는 같은 필터 자료만 유지하고 필터 변경에서는 이전 수치를 숨긴다',async({page})=>{
  await mock(page);await page.goto('/admin/analytics');await expect(page.locator('.admin-dash-card')).toHaveCount(6);
  await page.route('https://*.supabase.co/functions/v1/admin-analytics/dashboard**',route=>route.fulfill({status:503,json:{code:'ANALYTICS_UNAVAILABLE'}}));
  await page.getByRole('button',{name:'새로고침',exact:true}).click();await expect(page.getByRole('alert')).toContainText('이전 조회 / 갱신 실패');await expect(page.locator('.admin-dash-card')).toHaveCount(6);
  await page.getByRole('button',{name:'30일',exact:true}).click();await expect(page.getByRole('alert')).not.toContainText('이전 조회 / 갱신 실패');await expect(page.locator('.admin-dash-card')).toHaveCount(0);
});
