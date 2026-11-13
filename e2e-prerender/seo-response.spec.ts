import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import rows from '../e2e/fixtures/community-public.json';
import { APP_STATIC_PATHS } from '../src/utils/appRoutes';
import communityApi from '../api/community';

test('없는 화면과 없는 파일은 기존 앱을 유지하며 실제 404로 응답한다', async ({ request }) => {
  for (const path of ['/seo-no-such-page', '/llms.txt', '/og-image.png', '/admin/no-such-page', '/community/a/b']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text()).toContain('<div id="root"></div>');
  }
});

test('등록된 앱 경로의 직접 진입과 인증 경로별 첫 HTML 지시를 보존한다', async ({ request }) => {
  for (const path of APP_STATIC_PATHS) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  for (const path of ['/login', '/signup', '/forgot-password', '/reset-password', '/admin', '/admin/analytics', '/admission', '/result']) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain(`href="https://all-leet.vercel.app${path}"`);
  }
  const login = await (await request.get('/login')).text();
  expect(login).toContain('<title>로그인 | all LEET</title>');
  for (const path of ['/', '/community', '/past-exams?year=2026&subject=verbal&type=odd']) expect(await (await request.get(path)).text()).not.toContain('noindex');
});

test('커뮤니티 목록·게시글의 초기 HTML에 기존 공개 본문과 메타데이터를 제공한다', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/community');
  await expect(page.getByRole('link', { name: rows[0].title })).toBeVisible();
  await page.getByRole('link', { name: rows[0].title }).click();
  await expect(page.getByRole('heading', { name: rows[0].title })).toBeVisible();
  await expect(page.getByText(rows[0].community_comments[0].content)).toBeVisible();
  await expect(page).toHaveTitle(`${rows[0].title} | all LEET 커뮤니티`);
  const response = await request.get(`/community/${rows[0].id}`);
  expect(response.headers()['cache-control']).toContain('no-store');
  const missing = await request.get('/community/00000000-0000-0000-0000-000000000099');
  expect(missing.status()).toBe(404);
  expect(await missing.text()).not.toContain(rows[0].title);
  await context.close();
});

test('실제 Vercel 진입점이 비공개 빌드 번들을 읽어 공개 HTML을 반환한다', async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? 'GET');
    return Response.json(rows);
  };
  try {
    const response = await communityApi.fetch(new Request(`https://all-leet.vercel.app/api/community?postId=${rows[0].id}`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`<h1 class="text-lg sm:text-xl font-bold text-gray-900 mt-3">${rows[0].title}</h1>`);
    expect(methods).toEqual(['GET']);
  } finally { globalThis.fetch = original; }
});

test('로그인에서 공개 화면으로 이동하면 색인 제외 지시를 제거한다', async ({ page }) => {
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/login');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await page.locator('a[href="/"]').first().click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('meta[name=robots]')).toHaveCount(0);
  await expect(page.locator('#ldjson-webpage')).toHaveCount(1);
});

test('기출 데이터 기준과 환산 수치를 첫 HTML에서 제공한다', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/past-exams?year=2027&subject=reasoning&type=odd');
    const cells = page.locator('.score-conversion-table tr').filter({ hasText: '21개' }).locator('td');
    await expect(cells).toHaveText(['54.3', '29.3']);
    await expect(page.locator('.score-conversion-table td[title]')).toHaveCount(0);
    await page.getByRole('link', { name: '기출 데이터 기준', exact: true }).click();
    await expect(page.getByRole('heading', { name: '기출 정답·정답률·점수 환산 기준' })).toBeVisible();
    await expect(page.locator('#score-conversion')).toContainText('정규분포');
    const url = 'https://all-leet.vercel.app/past-exams/data-guide';
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
    const schema = JSON.parse((await page.locator('#ldjson-webpage').textContent())!);
    expect(schema).toMatchObject({ '@type': 'WebPage', url, isPartOf: { '@id': 'https://all-leet.vercel.app/#website' } });
    expect(await (await request.get('/sitemap.xml')).text()).toContain(url);
    expect(await (await request.get('/')).text()).toContain('"@type":"WebApplication"');
  } finally {
    await context.close();
  }
});

test('커뮤니티 최신 조회를 기다리는 동안 기존 공개 본문이 깜박이거나 중복되지 않는다', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://*.supabase.co/**', async route => {
    if (route.request().url().includes('/rest/v1/community_posts')) {
      await pending;
      return route.fulfill({ json: rows[0] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`/community/${rows[0].id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#root')).toHaveAttribute('hidden', '');
  await expect(page.locator('#prerender-shell').getByRole('heading', { name: rows[0].title })).toBeVisible();
  await expect(page.getByRole('heading', { name: rows[0].title })).toHaveCount(1);
  release();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#root')).not.toHaveAttribute('hidden');
  await expect(page.locator('#prerender-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: rows[0].title })).toHaveCount(1);
});

for (const width of [1280, 375]) {
  test(`기존 빌드와 최종 화면·입력·커뮤니티 동작을 비교한다 (${width}px)`, async ({ page }, testInfo) => {
    const baseline = process.env.SEO_BASELINE_ORIGIN;
    test.skip(!baseline, '작업 시 별도로 빌드한 변경 전 UI가 있을 때 픽셀 비교한다.');
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-11-10T03:00:00Z') });
    await page.route('https://*.supabase.co/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/rest/v1/community_posts')) return route.fulfill({ json: url.searchParams.has('id') ? rows[0] : rows });
      if (url.pathname.includes('increment_community_post_view')) return route.fulfill({ json: null });
      return route.fulfill({ json: [] });
    });
    await page.route(/https:\/\/.*(?:googlesyndication|doubleclick|adtrafficquality).*\/.*/, route => route.abort());
    for (const path of ['/', '/login', '/community', `/community/${rows[0].id}`]) {
      const capture = async (origin: string) => {
        await page.goto(`${origin}${path}`);
        await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
        if (path === '/' || path === '/login') await expect(page.locator('[data-dday-display]')).toHaveText('디데이 설정을 불러오지 못했습니다.');
        if (path.startsWith('/community')) await expect(page.getByText(rows[0].title, { exact: true })).toBeVisible();
        if (path.includes(rows[0].id)) await expect(page.getByText(rows[0].community_comments[0].content)).toBeVisible();
        await page.waitForTimeout(300);
        return page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      };
      const before = await capture(baseline!);
      const after = await capture('http://127.0.0.1:4173');
      await testInfo.attach(`${encodeURIComponent(path)}-before`, { body: before, contentType: 'image/png' });
      await testInfo.attach(`${encodeURIComponent(path)}-after`, { body: after, contentType: 'image/png' });
      expect(after.equals(before), path).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    // 테스트 합성 API만 사용하며 운영 서버 상태는 바꾸지 않는다.
    await page.goto('/');
    await page.getByPlaceholder('1-5').first().fill('2');
    await expect(page.getByPlaceholder('1-5').first()).toHaveValue('2');
    const files = readFileSync('build/index.html', 'utf8');
    expect(files).toContain('rel="modulepreload"');
  });
}
