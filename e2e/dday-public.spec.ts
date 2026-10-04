import { expect, test, type Page } from '@playwright/test';
import type { ExamSchedule } from '../src/types/examSchedule';

const initial: ExamSchedule = { key: 'leet', exam_date: '2027-07-18', display_template: '{date} 시험일 {dday}', revision: 1, updated_at: '2026-10-04T00:00:00Z' };
const cacheKey = 'all-leet:jkxxtyaanyhmjbdtybkp:exam-schedule:v1';

async function mockPublic(page: Page) {
  const state = { row: { ...initial }, failed: false, reads: 0, writes: 0, wait: Promise.resolve() };
  await page.route('https://*.supabase.co/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('/exam_schedule')) {
      if (route.request().method() !== 'GET') state.writes++;
      state.reads++;
      await state.wait;
      return state.failed ? route.fulfill({ status: 503, json: { message: 'offline' } }) : route.fulfill({ json: [state.row] });
    }
    return route.fulfill({ json: [] });
  });
  return state;
}

test('세 공개 화면은 같은 설정을 치환하고 템플릿을 HTML로 실행하지 않는다', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-07-17T12:00:00+09:00') });
  const state = await mockPublic(page);
  state.row.display_template = '<img src=x onerror=alert(1)> {date}까지 {dday} / {dday}';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['/', '/login', '/signup']) {
    await page.goto(path);
    await expect(page.locator('[data-dday-display]')).toHaveText('<img src=x onerror=alert(1)> 2027.07.18까지 D-1 / D-1');
    await expect(page.locator('[data-dday-display] img')).toHaveCount(0);
  }
  expect(state.writes).toBe(0);
  expect(errors).toEqual([]);
});

test('조회 중·최초 실패를 표시해도 로그인 폼을 사용할 수 있고 포커스 복귀에 재조회한다', async ({ page }) => {
  const state = await mockPublic(page);
  let release!: () => void;
  state.wait = new Promise<void>(resolve => { release = resolve; });
  await page.goto('/login');
  await expect(page.locator('[data-dday-display]')).toHaveText('불러오는 중…');
  await page.getByPlaceholder('your').fill('readonly-e2e');
  await expect(page.getByPlaceholder('your')).toHaveValue('readonly-e2e');
  state.failed = true;
  release();
  await expect(page.locator('[data-dday-display]')).toHaveText('디데이 설정을 불러오지 못했습니다.');
  state.failed = false;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-dday-display]')).toContainText('2027.07.18 시험일');
  expect(state.writes).toBe(0);
});

test('저장된 캐시는 조회 실패에도 날짜를 다시 계산하고 마지막 설정임을 알린다', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-07-19T12:00:00+09:00') });
  const state = await mockPublic(page);
  state.failed = true;
  await page.addInitScript(({ key, row }) => localStorage.setItem(key, JSON.stringify({ version: 1, schedule: row, fetched_at: 1 })), { key: cacheKey, row: initial });
  await page.goto('/');
  await expect(page.locator('[data-dday-display]')).toHaveText('2027.07.18 시험일 D+1 · 마지막 확인한 설정 기준');
  expect(state.writes).toBe(0);
});

test('깨진 캐시를 무시하고 60초 재조회·다른 탭 알림으로 최신 문구를 반영한다', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-07-17T12:00:00+09:00') });
  const state = await mockPublic(page);
  await page.addInitScript(key => localStorage.setItem(key, 'broken'), cacheKey);
  await page.goto('/');
  await expect(page.locator('[data-dday-display]')).toHaveText('2027.07.18 시험일 D-1');
  state.row = { ...state.row, display_template: '첫 변경 {dday}', revision: 2 };
  await page.clock.runFor(60_000);
  await expect(page.locator('[data-dday-display]')).toHaveText('첫 변경 D-1');
  state.row = { ...state.row, display_template: '다른 탭 {date}', revision: 3 };
  await page.evaluate(key => window.dispatchEvent(new StorageEvent('storage', { key })), cacheKey);
  await expect(page.locator('[data-dday-display]')).toHaveText('다른 탭 2027.07.18');
  expect(state.reads).toBeGreaterThanOrEqual(3);
  expect(state.writes).toBe(0);
});

test('열린 화면의 디데이는 한국 시간 자정과 다음날 복귀에 갱신된다', async ({ page }) => {
  await page.clock.install({ time: new Date('2027-07-17T23:59:59+09:00') });
  await page.clock.pauseAt(new Date('2027-07-17T23:59:59+09:00'));
  await mockPublic(page);
  await page.goto('/');
  await expect(page.locator('[data-dday-display]')).toContainText('D-1');
  await page.clock.runFor(1000);
  await expect(page.locator('[data-dday-display]')).toContainText('D-Day');
  await page.clock.setSystemTime(new Date('2027-07-19T10:00:00+09:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-dday-display]')).toContainText('D+1');
});

for (const width of [320, 1280]) test(`긴 공통 문구가 세 화면에서 넘치지 않는다 ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const state = await mockPublic(page);
  state.row.display_template = 'x'.repeat(100);
  for (const [name, path] of [['home', '/'], ['login', '/login'], ['signup', '/signup']]) {
    await page.goto(path);
    await expect(page.locator('[data-dday-display]')).toHaveText(state.row.display_template);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${name}-dday.png`), fullPage: true });
  }
});
