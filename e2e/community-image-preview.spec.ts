import { expect, test } from '@playwright/test';

test('첨부 이미지 설명은 해당 미리보기에만 적용되고 다른 이미지를 삭제해도 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = { id: 'preview-user', email: 'preview@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated' };
  await page.addInitScript((account) => {
    localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token', JSON.stringify({
      access_token: 'preview-token',
      refresh_token: 'preview-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: account,
    }));
  }, user);
  const postWrites: string[] = [];
  await page.route('https://*.supabase.co/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (!['GET', 'OPTIONS'].includes(request.method()) &&
      (path.startsWith('/rest/v1/community_posts') || path.startsWith('/storage/v1/object/'))) {
      postWrites.push(request.method());
      return route.abort();
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/community');
  await page.getByRole('button', { name: '새 글 작성' }).click();
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKMcAAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type="file"]').setInputFiles(
    ['first.png', 'second.png'].map(name => ({ name, mimeType: 'image/png', buffer: pixel }))
  );
  const descriptions = page.getByRole('textbox', { name: '이미지 설명 (선택)', exact: true });
  await expect(descriptions).toHaveCount(2);
  await expect(descriptions.last()).toHaveAccessibleDescription('글쓰기 미리보기에서만 사용됩니다.');
  await descriptions.last().fill('문항별 오답을 정리한 복습 노트');
  await expect(page.getByRole('img', { name: '문항별 오답을 정리한 복습 노트' })).toBeVisible();

  await page.getByRole('button', { name: '첨부 이미지 1 삭제' }).click();
  await expect(descriptions).toHaveValue('문항별 오답을 정리한 복습 노트');
  await descriptions.clear();
  await expect(page.getByRole('img', { name: '첨부 이미지 1' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(postWrites).toEqual([]);
});
