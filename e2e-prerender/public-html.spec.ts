import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { getPrerenderPages } from '../scripts/prerenderRoutes';
import { getPageSeo } from '../src/utils/pageSeo';
import { answerKeyVersion } from '../src/utils/questionStatisticsModel';

test('첫 기출 HTML은 접힌 정답표·문항별 정답률을 실제 본문에 포함한다', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  const content = page.locator('.past-exam-review-content');
  await expect(content).toHaveAttribute('hidden', '');
  await expect(content).toBeHidden();
  await expect(page.getByRole('button', { name: '정답표·점수 환산표 보기' })).toHaveAttribute('aria-expanded', 'false');
  await expect(content.locator('.answer-key-cell')).toHaveCount(30);
  await expect(content.locator('.question-rate--answer-key')).toHaveCount(30);
  const rates = await content.locator('.question-rate').allTextContents();
  expect(rates.every(rate => /^(?:\d+\.\d%|—)›$/.test(rate))).toBe(true);
  await expect(content.locator('.question-statistics-notice')).not.toContainText('불러오는 중');
  expect(await content.innerHTML()).not.toMatch(/sample_count|choice_counts|source_snapshot_at|published_at/);
  await context.close();
});

test('앱 시작 후에는 HTML의 과거 정답률 대신 기존 DB 최신 조회·모달을 유지한다', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://*.supabase.co/**', route => {
    requests.push(route.request().method());
    const url = route.request().url();
    if (!url.includes('/rest/v1/question_statistics_snapshots')) return route.fulfill({ json: [] });
    return route.fulfill({ json: [{
      year: '2026', subject: 'verbal', exam_type: 'odd', snapshot_id: '999',
      answer_key_version: answerKeyVersion({ year: '2026', subject: 'verbal', examType: 'odd' }), aggregation_version: 'all_saved_records_v1',
      question_count: 30, sample_count: '40', source_snapshot_at: '2026-10-05T00:00:00Z', published_at: '2026-10-05T01:00:00Z',
      items: Array.from({ length: 30 }, (_, i) => ({ question_no: i + 1, choice_counts: [0, 0, 0, 40, 0], unanswered_count: 0 })),
    }] });
  });
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#prerender-shell')).toHaveCount(0);
  await expect(page.locator('.past-exam-review-content')).toBeHidden();
  await page.getByRole('button', { name: '정답표·점수 환산표 보기' }).click();
  const rate = page.getByRole('button', { name: '1번 정답률 100.0%, 응답 분포 보기', exact: true });
  await expect(rate).toBeVisible();
  await rate.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('listitem')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(rate).toBeFocused();
  await page.getByRole('button', { name: '정답·점수표 숨기기' }).click();
  await expect(page.locator('.past-exam-review-content')).toBeHidden();
  expect(requests.every(method => ['GET', 'HEAD', 'OPTIONS'].includes(method))).toBe(true);
});

test('모든 공개 URL은 첫 응답에 본문·고유 메타데이터를 포함한다', async ({ request }) => {
  for (const page of getPrerenderPages()) {
    const response = await request.get(page.url);
    expect(response.ok(), page.url).toBe(true);
    const html = await response.text();
    const url = new URL(page.url, 'http://127.0.0.1:4173');
    const seo = getPageSeo(url.pathname, url.search);
    expect(html, page.url).toContain(`<title>${seo.title}</title>`);
    expect(html).toContain(seo.canonical.replace(/&/g, '&amp;'));
    expect(html).toContain('<h1');
    expect(html).not.toContain('<div id="root"></div>');
    expect(html.match(/type="application\/ld\+json"/g)).toHaveLength(1);
  }
});

test('자바스크립트 없이 홈과 선택한 기출문제·PDF 링크를 읽을 수 있다', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.getByRole('heading', { name: /리트 채점은 all LEET/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '기능 바로가기' })).toBeVisible();
  await expect(page.locator('[data-dday-display]')).toHaveText('불러오는 중…');
  const homeHtml = await (await page.request.get('http://127.0.0.1:4173/')).text();
  expect(homeHtml).not.toContain('2026.07.19');
  expect(homeHtml).not.toMatch(/D-[0-9]+|D\+[0-9]+|D-Day/);
  await expect(page.locator('.service-highlights')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('home-desktop.png') });
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('home-mobile.png') });
  await page.getByRole('region', { name: '기능 바로가기' }).getByRole('link', { name: /^기출문제/ }).click();
  await expect(page.getByRole('region', { name: '기출문제 활용 안내' })).toHaveCount(0);
  await expect(page.getByText('2027학년도 · 언어이해 · 단일 문형', { exact: true })).toBeVisible();
  await page.goto('http://127.0.0.1:4173/past-exams?type=even&year=2018&subject=reasoning&campaign=test');
  await expect(page).toHaveTitle(/2018학년도 추리논증 짝수형/);
  await expect(page.getByText('2018학년도 · 추리논증 · 짝수형', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /PDF 열기/ })).toHaveAttribute('href', /\/past-exams\/watermarked\/v1\//);
  await page.setViewportSize({ width: 320, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test('기출 선택·답안 입력과 검색 메타데이터는 앱 시작 후에도 동작한다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#prerender-shell')).toHaveCount(0);
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await expect(page).toHaveTitle(/2026학년도 추리논증 홀수형/);
  await page.getByRole('button', { name: '정답표·점수 환산표 보기' }).click();
  await expect(page.getByRole('heading', { name: '2026학년도 추리논증 홀수형 정답표' })).toBeVisible();
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#prerender-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /리트 채점은 all LEET/ })).toBeVisible();
  await expect(page.locator('.service-highlights')).toHaveCount(0);
  await page.locator('#exam-year').selectOption('2026');
  await expect(page.getByText('시험 유형', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('개인·동적 화면 fallback에는 공개 화면과 개인정보가 저장되지 않는다', async ({ request }) => {
  const fallback = readFileSync('build/app.html', 'utf8');
  expect(fallback).toContain('<div id="root"></div>');
  for (const path of ['/login', '/admission', '/community/example']) expect(await (await request.get(path)).text()).toBe(fallback);
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 375, height: 812 }]) {
  test(`사전 HTML 이후 화면은 기존 앱 시작 방식과 동일하다 (${viewport.width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
    const fallback = readFileSync('build/app.html', 'utf8');

    for (const [name, path] of [
      ['home', '/'],
      ['past-exams', '/past-exams?year=2026&subject=reasoning&type=even'],
      ['login', '/login'],
    ]) {
      // 동일한 코드·화면에서 초기 HTML 유무만 바꾸어 비교한다.
      await page.route('http://127.0.0.1:4173/**', async route => {
        if (route.request().isNavigationRequest()) {
          await route.fulfill({ contentType: 'text/html', body: fallback });
        } else await route.continue();
      });
      await page.goto(path);
      await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
      if (path === '/' || path === '/login') await expect(page.locator('[data-dday-display]')).toHaveText('디데이 설정을 불러오지 못했습니다.');
      const original = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      await page.unroute('http://127.0.0.1:4173/**');

      await page.goto(path);
      await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
      await expect(page.locator('#prerender-shell')).toHaveCount(0);
      if (path === '/' || path === '/login') await expect(page.locator('[data-dday-display]')).toHaveText('디데이 설정을 불러오지 못했습니다.');
      const prerendered = await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' });
      await testInfo.attach(`${name}-original`, { body: original, contentType: 'image/png' });
      await testInfo.attach(`${name}-prerendered`, { body: prerendered, contentType: 'image/png' });
      expect(prerendered.equals(original), `${path}: 초기 HTML 교체 후 화면이 달라졌습니다.`).toBe(true);
    }
  });
}

test('초기 HTML을 앱으로 교체할 때 빈 화면이나 중복 제목이 나타나지 않는다', async ({ page }) => {
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  let releaseScript!: () => void;
  const scriptReady = new Promise<void>(resolve => { releaseScript = resolve; });
  await page.route('**/assets/*.js', async route => {
    await scriptReady;
    await route.continue();
  });
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd', { waitUntil: 'commit' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('#root')).not.toHaveAttribute('data-app-ready', 'true');
  const counts: number[] = [];
  await page.exposeFunction('recordHeadingCount', (count: number) => counts.push(count));
  await page.evaluate(() => {
    const sample = () => {
      const count = [...document.querySelectorAll('h1')].filter(heading => heading.getClientRects().length > 0).length;
      const record = (window as unknown as { recordHeadingCount: (count: number) => Promise<void> }).recordHeadingCount;
      void record(count);
      if (!document.querySelector('#root[data-app-ready="true"]')) requestAnimationFrame(sample);
    };
    sample();
  });
  releaseScript();
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await expect(page.locator('#prerender-shell')).toHaveCount(0);
  expect(counts.length).toBeGreaterThan(0);
  expect(counts.every(count => count === 1)).toBe(true);
});

test('사전 렌더링된 홈에서도 비로그인 채점과 로그인 진입이 유지된다', async ({ page }) => {
  const writes: string[] = [];
  await page.route('https://*.supabase.co/**', route => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) writes.push(route.request().url());
    return route.fulfill({ json: [] });
  });
  await page.goto('/');
  await expect(page.locator('#root')).toHaveAttribute('data-app-ready', 'true');
  await page.getByPlaceholder('1-5').first().fill('1');
  await page.getByRole('main').getByRole('button', { name: '채점하기', exact: true }).click();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByRole('heading', { name: /채점 결과/ }).first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.goto('/admission');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
  await page.getByPlaceholder('your').fill('readonly-e2e');
  await expect(page.getByPlaceholder('your')).toHaveValue('readonly-e2e');
  expect(writes).toEqual([]);
});
