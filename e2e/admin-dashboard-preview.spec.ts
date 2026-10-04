import { expect, test } from '@playwright/test';
for(const width of [390,1280])test(`분리된 대시보드 · 곡선/기간/50명 목록/감사 대상 ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:900});const errors:string[]=[],external:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://**/*',route=>{external.push(route.request().url());return route.abort();});
  await page.goto('/docs/previews/admin-dashboard-development.html');
  await expect(page.getByRole('heading',{name:'서비스 변화 대시보드'})).toBeVisible();await expect(page.locator('.admin-dash-cards .admin-dash-card')).toHaveCount(6);
  for(const range of ['7일','30일','6개월','1년']){
    await page.getByRole('button',{name:range,exact:true}).click();await expect(page.getByRole('button',{name:range,exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.getByText('선택 기간의 자료 가용',{exact:true})).toBeVisible();
  }
  await page.getByText('구간별 정확한 값 보기',{exact:true}).click();await expect(page.locator('details tbody tr')).toHaveCount(12);
  await expect(page.getByText('장기 기간 미지원 · 최근 90일 상세에서 확인',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const picker=page.locator('.admin-dash-feed .admin-picker');await picker.getByRole('button',{name:'회원 선택 목록 열기'}).click();
  await expect(picker.getByRole('option')).toHaveCount(50);await expect(picker.getByText('1~50번째',{exact:true})).toBeVisible();
  await picker.getByRole('button',{name:'다음 50명'}).click();await expect(picker.getByText('51~100번째',{exact:true})).toBeVisible();
  await picker.getByRole('button',{name:'다음 50명'}).click();await expect(picker.getByRole('option')).toHaveCount(21);
  await picker.getByRole('combobox').fill('member121@example.test');await expect(picker.getByRole('option')).toHaveCount(1);
  await picker.getByRole('combobox').press('ArrowDown');await picker.getByRole('combobox').press('Enter');await expect(picker.locator('.admin-picker-selected')).toContainText('member121@example.test');
  await expect(page.getByText(/회원 활동 이동:/)).toBeVisible();await picker.getByRole('button',{name:'선택 해제'}).click();await expect(picker.locator('.admin-picker-selected')).toHaveCount(0);
  const audit=page.getByRole('button',{name:'조회 관리자 목록 열기'});await audit.click();await expect(page.getByRole('option',{name:/계정 정보 없음/})).toBeVisible();
  await page.screenshot({path:info.outputPath('dashboard-preview.png'),fullPage:true});expect(errors).toEqual([]);expect(external).toEqual([]);
});
