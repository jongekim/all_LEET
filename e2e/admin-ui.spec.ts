import { expect, test, type Page } from '@playwright/test';

// Every Supabase request is intercepted: these tests never log in or write to production.
async function mockAdmin(page: Page, allowed = true) {
  await page.addInitScript(() => {
    localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token', JSON.stringify({
      access_token: 'mock-token', refresh_token: 'mock-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'mock-user', email: 'admin@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated' },
    }));
  });
  await page.route('https://*.supabase.co/**', async route => {
    const url = route.request().url();
    if (url.includes('/rpc/current_user_is_admin')) {
      await route.fulfill({ json: allowed }); return;
    }
    if (url.includes('/rest/v1/home_announcements') && route.request().method() === 'GET') {
      await route.fulfill({ json: [{
        id: 'notice-1', slug: 'sample', title: '테스트 공지', content: '기존 본문',
        banner_text: '홈 배너 안내', is_published: true, show_in_banner: true,
        display_order: 0, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
      }] }); return;
    }
    await route.fulfill({ json: [] });
  });
}

for (const width of [390, 1280]) {
  test('관리자 진입과 공지 편집 레이아웃 ' + width, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAdmin(page);
    await page.goto('/');
    await page.getByRole('button', { name: '관리자 페이지', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole('link', { name: /공지 관리/ }).click();
    await page.getByRole('button', { name: '테스트 공지 수정' }).click();
    await expect(page.getByRole('heading', { name: '공지 수정', exact: true })).toBeVisible();
    await expect(page.getByLabel('제목', { exact: true })).toHaveValue('테스트 공지');
    const memo = page.getByRole('textbox', { name: /메모/ });
    await memo.fill('');
    expect(await memo.evaluate((element: HTMLTextAreaElement) => element.required)).toBe(false);
    expect(await page.locator('form').evaluate((element: HTMLFormElement) => element.checkValidity())).toBe(true);
    await page.getByLabel('홈 배너 문구').fill('바뀐 배너 미리보기');
    await expect(page.locator('.admin-preview')).toHaveText('바뀐 배너 미리보기');
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await page.getByLabel('홈에 공지 표시').uncheck();
    await expect(page.getByText('현재 설정으로 저장하면 홈 배너에 노출되지 않습니다.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const content = await page.getByRole('region', { name: '공지 내용' }).boundingBox();
    const settings = await page.getByRole('complementary', { name: '공개 설정' }).boundingBox();
    if (!content || !settings) throw new Error('편집 패널이 없습니다.');
    if (width > 720) expect(settings.x).toBeGreaterThan(content.x + content.width);
    else expect(settings.y).toBeGreaterThan(content.y + content.height);
    await page.screenshot({ path: testInfo.outputPath('admin-editor.png'), fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '목록으로', exact: true }).click();
    await page.locator('header').getByRole('button', { name: '돌아가기', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
}

test('일반 사용자는 관리자 버튼과 직접 접근을 사용할 수 없다', async ({ page }) => {
  await mockAdmin(page, false);
  await page.goto('/');
  await expect(page.getByRole('button', { name: '관리자 페이지', exact: true })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL('/');
  await page.goto('/admin/announcements');
  await expect(page).toHaveURL('/');
});
