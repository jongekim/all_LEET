import { expect, test, type Page } from '@playwright/test';
import type { ExamSchedule } from '../src/types/examSchedule';

const initial:ExamSchedule={key:'leet',exam_date:'2026-07-19',display_template:'{date} 시험일 {dday}',revision:1,updated_at:'2026-10-04T00:00:00Z'};
async function mock(page:Page,admin=true,signedIn=true) {
  if(signedIn) await page.addInitScript(()=>{
    localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token',JSON.stringify({access_token:'mock-token',refresh_token:'mock-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'mock-admin',email:'admin@example.test',user_metadata:{},app_metadata:{},aud:'authenticated'}}));
  });
  const state={row:{...initial},allowed:admin,readFailure:false,mode:'success' as 'success'|'conflict'|'lost'|'failed'|'denied',patches:[] as {payload:object;revision:string|null}[]};
  await page.route('https://*.supabase.co/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.includes('/rpc/current_user_is_admin'))return route.fulfill({json:state.allowed});
    if(url.pathname.endsWith('/exam_schedule')) {
      if(route.request().method()==='GET')return state.readFailure?route.fulfill({status:503,json:{message:'offline'}}):route.fulfill({json:[state.row]});
      if(route.request().method()==='PATCH') {
        const payload=route.request().postDataJSON();
        state.patches.push({payload,revision:url.searchParams.get('revision')});
        if(state.mode==='denied'){state.allowed=false;return route.fulfill({status:403,json:{code:'42501',message:'denied'}});}
        if(state.mode==='conflict') {
          state.row={...state.row,display_template:'다른 관리자 {dday}',revision:state.row.revision+1};
          return route.fulfill({status:406,json:{code:'PGRST116',details:'The result contains 0 rows',message:'no rows'}});
        }
        if(state.mode==='failed')return route.fulfill({status:503,json:{message:'offline'}});
        state.row={...state.row,...payload,revision:state.row.revision+1,updated_at:new Date().toISOString()};
        if(state.mode==='lost')return route.fulfill({status:503,json:{message:'response lost'}});
        return route.fulfill({json:state.row});
      }
    }
    return route.fulfill({json:[]});
  });
  return state;
}

for(const width of [390,1280])test(`디데이 관리자 폼과 미리보기·저장 ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:900});const state=await mock(page);
  await page.goto('/admin');await page.getByRole('link',{name:/디데이 관리/}).click();
  await expect(page.getByRole('heading',{name:'디데이 관리',exact:true})).toBeVisible();
  const save=page.getByRole('button',{name:'저장',exact:true});
  await expect(page.getByLabel('LEET 시험일')).toHaveValue('2026-07-19');await expect(save).toBeDisabled();
  await page.getByLabel('LEET 시험일').fill('2027-07-18');
  await page.getByLabel('표시 문구',{exact:true}).fill('LEET 시험까지 {dday}');
  await expect(page.getByRole('region',{name:'저장 후 표시 미리보기'}).locator('.admin-preview')).toHaveCount(3);
  await expect(page.locator('.admin-preview').first()).toContainText(/LEET 시험까지 D-/);
  await save.click();await expect(page.getByRole('status')).toContainText('저장했습니다.');
  expect(state.patches).toEqual([{payload:{exam_date:'2027-07-18',display_template:'LEET 시험까지 {dday}'},revision:'eq.1'}]);
  await expect(save).toBeDisabled();
  await page.getByLabel('표시 문구',{exact:true}).fill('{year} 시험');await expect(page.getByRole('alert')).toContainText('치환자');await expect(save).toBeDisabled();
  await page.getByRole('button',{name:'변경 취소'}).click();
  await page.getByLabel('표시 문구',{exact:true}).fill('x'.repeat(100));await expect(save).toBeEnabled();
  await expect(page.getByText('이 문구에는 자동 디데이가 표시되지 않습니다.')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('admin-dday.png'),fullPage:true});
  page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'돌아가기',exact:true}).click();await expect(page).toHaveURL(/\/admin\/dday$/);
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'돌아가기',exact:true}).click();await expect(page).toHaveURL(/\/admin$/);
});

test('일반 사용자의 메뉴·직접 접근은 차단된다',async({page})=>{
  const state=await mock(page,false);await page.goto('/admin/dday');await expect(page).toHaveURL('/');expect(state.patches).toHaveLength(0);
});
test('브라우저 뒤로가기 취소는 미저장 입력을 유지한다',async({page})=>{
  const state=await mock(page);await page.goto('/admin');await page.getByRole('link',{name:/디데이 관리/}).click();
  const template=page.getByLabel('표시 문구',{exact:true});
  await page.getByLabel('LEET 시험일').fill('2027-07-18');
  await template.fill('유지할 문구 {dday}');
  await template.evaluate(input=>input.setAttribute('data-draft-instance','original'));
  for(let attempt=0;attempt<3;attempt++){
    page.once('dialog',dialog=>dialog.dismiss());await page.goBack();
    await expect(page).toHaveURL(/\/admin\/dday$/);
    await expect(template).toHaveValue('유지할 문구 {dday}');
    await expect(template).toHaveAttribute('data-draft-instance','original');
    await expect(page.getByLabel('LEET 시험일')).toHaveValue('2027-07-18');
    await expect(page.getByRole('button',{name:'저장',exact:true})).toBeEnabled();
  }
  expect(state.patches).toHaveLength(0);
  page.once('dialog',dialog=>dialog.accept());await page.goBack();await expect(page).toHaveURL(/\/admin$/);
});
test('브라우저 앞으로가기 취소도 같은 폼을 유지하고 승인하면 이동한다',async({page})=>{
  const state=await mock(page);await page.goto('/admin');await page.getByRole('link',{name:/디데이 관리/}).click();
  await expect(page.getByLabel('표시 문구',{exact:true})).toHaveValue(initial.display_template);
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();
  await expect(page).toHaveURL(/\/admin$/);await page.goBack();
  const template=page.getByLabel('표시 문구',{exact:true});
  await template.fill('앞으로가기 유지 {dday}');
  await template.evaluate(input=>input.setAttribute('data-draft-instance','original'));
  page.once('dialog',dialog=>dialog.dismiss());await page.goForward();
  await expect(page).toHaveURL(/\/admin\/dday$/);
  await expect(template).toHaveValue('앞으로가기 유지 {dday}');
  await expect(template).toHaveAttribute('data-draft-instance','original');
  expect(state.patches).toHaveLength(0);
  page.once('dialog',dialog=>dialog.accept());await page.goForward();await expect(page).toHaveURL(/\/admin$/);
});
test('충돌 시 입력을 보존하고 최신 설정 확인 전 재저장을 차단한다',async({page})=>{
  const state=await mock(page);state.mode='conflict';await page.goto('/admin/dday');
  await page.getByLabel('표시 문구',{exact:true}).fill('내 변경 {dday}');await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('다른 관리자');await expect(page.getByLabel('표시 문구',{exact:true})).toHaveValue('내 변경 {dday}');
  await expect(page.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
  await expect(page.getByRole('region',{name:'최신 서버 설정'})).toContainText('다른 관리자');
  state.mode='success';await page.getByRole('button',{name:'최신 설정 확인'}).click();await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다.');expect(state.patches[1].revision).toBe('eq.2');
});
test('응답을 잃어도 쓰기를 반복하지 않고 현재 설정으로 확인한다',async({page})=>{
  const state=await mock(page);state.mode='lost';await page.goto('/admin/dday');
  await page.getByLabel('표시 문구',{exact:true}).fill('새 문구 {dday}');await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('현재 서버에는');expect(state.patches).toHaveLength(1);
});
test('저장·확인 조회 실패에는 입력을 보존한다',async({page})=>{
  const state=await mock(page);await page.goto('/admin/dday');
  await page.getByLabel('표시 문구',{exact:true}).fill('유지할 입력');state.mode='failed';state.readFailure=true;
  await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('저장 상태');
  await expect(page.getByLabel('표시 문구',{exact:true})).toHaveValue('유지할 입력');await expect(page.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
  state.readFailure=false;await page.getByRole('button',{name:'저장 상태 확인'}).click();await page.getByRole('button',{name:'최신 설정 확인'}).click();
  await expect(page.getByRole('button',{name:'저장',exact:true})).toBeEnabled();expect(state.patches).toHaveLength(1);
});
test('권한을 잃으면 편집 상태를 제거한다',async({page})=>{
  const state=await mock(page);await page.goto('/admin/dday');await page.getByLabel('표시 문구',{exact:true}).fill('이전 계정 입력');state.mode='denied';
  await page.getByRole('button',{name:'저장',exact:true}).click();await expect(page.getByRole('alert')).toContainText('권한');
  await expect(page.getByLabel('표시 문구',{exact:true})).toHaveCount(0);
});
test('최초 조회 실패는 저장 없이 재조회할 수 있다',async({page})=>{
  const state=await mock(page);state.readFailure=true;await page.goto('/admin/dday');await expect(page.getByRole('alert')).toContainText('불러오지 못했습니다');
  await expect(page.getByRole('button',{name:'저장',exact:true})).toHaveCount(0);state.readFailure=false;await page.getByRole('button',{name:'다시 불러오기'}).click();
  await expect(page.getByLabel('표시 문구',{exact:true})).toHaveValue(initial.display_template);
});

test('관리자 저장 후 홈과 비로그인 로그인·가입 화면에 같은 설정이 반영된다',async({page,browser})=>{
  const state=await mock(page);await page.goto('/admin/dday');
  await page.getByLabel('LEET 시험일').fill('2027-07-18');
  await page.getByLabel('표시 문구',{exact:true}).fill('설정한 시험 {date} {dday}');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('저장했습니다.');
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();
  await page.getByRole('button',{name:'돌아가기',exact:true}).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-dday-display]')).toContainText('설정한 시험 2027.07.18 D-');
  const context=await browser.newContext();const anonymous=await context.newPage();
  const publicState=await mock(anonymous,false,false);publicState.row={...state.row};
  for(const path of ['/login','/signup']){
    await anonymous.goto(new URL(path,page.url()).href);await expect(anonymous.locator('[data-dday-display]')).toContainText('설정한 시험 2027.07.18 D-');
  }
  expect(publicState.patches).toHaveLength(0);expect(state.patches).toHaveLength(1);await context.close();
});

test('분리된 일반 화면 미리보기는 운영 요청 없이 실제 치환 컴포넌트를 사용한다',async({page},info)=>{
  const external:string[]=[];
  await page.route('https://**',route=>{external.push(route.request().url());return route.abort();});
  await page.setViewportSize({width:375,height:812});
  await page.goto('/docs/previews/dday-public.html');
  await page.getByLabel('공통 문구').fill('LEET 시험까지 {dday}');await page.getByRole('button',{name:'미리보기에 적용'}).click();
  await expect(page.locator('[data-dday-display]')).toHaveCount(3);
  await expect(page.locator('[data-dday-display]').first()).toContainText('LEET 시험까지 D+');
  await page.getByLabel('공통 문구').fill('x'.repeat(100));await page.getByRole('button',{name:'미리보기에 적용'}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(external).toHaveLength(0);await page.screenshot({path:info.outputPath('dday-public-preview.png'),fullPage:true});
});
