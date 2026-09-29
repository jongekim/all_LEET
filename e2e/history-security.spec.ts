import { expect, test, type Page } from '@playwright/test';

// All Supabase traffic is mocked, including writes. No production auth or data
// request is allowed to leave the browser in these regression tests.
async function isolateHistory(page: Page, signedIn = true) {
  if (signedIn) await page.addInitScript(() => {
    localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token', JSON.stringify({
      access_token: 'history-test-token', refresh_token: 'history-test-refresh', token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'history-test-user', email: 'history@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated' },
    }));
  });
  const writes: string[] = [];
  await page.route('https://*.supabase.co/**', async route => {
    const request = route.request();
    if (request.url().includes('/functions/v1/make-server-cd835c22/')) {
      if (request.method() !== 'GET') writes.push(request.method());
      expect(request.headers().authorization).toBe('Bearer history-test-token');
      await route.fulfill({ status: 503, json: { success: false, code: 'AUTH_UNAVAILABLE' } });
    } else {
      await route.fulfill({ json: request.url().includes('/rpc/current_user_is_admin') ? false : [] });
    }
  });
  return writes;
}

test('조회 실패는 빈 이력이나 예시 이력으로 표시되지 않는다', async ({ page }) => {
  const writes = await isolateHistory(page);
  await page.goto('/history');
  await expect(page.getByRole('alert')).toContainText('인증 확인이 지연');
  await expect(page.getByRole('button', { name: '다시 불러오기' })).toBeVisible();
  await expect(page.getByRole('button', { name: /전체 삭제/ })).toBeDisabled();
  expect(writes).toEqual([]);
});

test('공식 이력 저장 실패에도 답안과 채점 결과를 제공하고 자동 재저장하지 않는다', async ({ page }) => {
  const writes = await isolateHistory(page);
  await page.goto('/');
  await page.getByPlaceholder('1-5').first().fill('1');
  await page.getByRole('main').getByRole('button', { name: '채점하기', exact: true }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole('alert')).toContainText('채점은 완료했지만');
  await expect(page.getByRole('heading', { name: /채점 결과/ }).first()).toBeVisible();
  expect(writes).toEqual(['POST']);
});

test('사설 저장 실패는 입력 화면과 값을 유지한다', async ({ page }) => {
  const writes = await isolateHistory(page);
  await page.goto('/mock-input');
  await page.locator('input[type="date"]').fill('2026-09-28');
  await page.getByPlaceholder('예: 70', { exact: true }).fill('70');
  await page.getByPlaceholder('예: 85', { exact: true }).fill('85');
  let warning = '';
  page.once('dialog', async dialog => { warning = dialog.message(); await dialog.accept(); });
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/\/mock-input$/);
  await expect(page.getByPlaceholder('예: 70', { exact: true })).toHaveValue('70');
  expect(warning).toContain('저장에 실패');
  expect(writes).toEqual(['POST']);
});

test('비로그인 채점은 이력 API를 호출하지 않고 결과를 제공한다', async ({ page }) => {
  const writes = await isolateHistory(page, false);
  await page.goto('/');
  await page.getByPlaceholder('1-5').first().fill('1');
  await page.getByRole('main').getByRole('button', { name: '채점하기', exact: true }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole('heading', { name: /채점 결과/ }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(writes).toEqual([]);
});
