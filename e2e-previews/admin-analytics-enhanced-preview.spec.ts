import { expect, test, type Page } from '@playwright/test';

// Separate suite: the production application's E2E gate does not discover it.

const url = '/admin-analytics-enhanced.html';
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const period = (page: Page, name: string) => page.getByRole('group', { name: '분석 기간' }).getByRole('button', { name, exact: true });

for (const width of [320, 390, 1280]) {
  test(`7개 탭 · 반응형 · 서버 요청 차단 ${width}`, async ({ page }, info) => {
    const errors: string[] = [], external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      if (!route.request().url().startsWith('http://127.0.0.1:4187/')) {
        external.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(url);
    await expect(page.getByRole('heading', { name: '서비스 이용통계', exact: true })).toBeVisible();
    await expect(page.locator('.kpi')).toHaveCount(6);
    await page.screenshot({ path: info.outputPath(`overview-${width}.png`), fullPage: true });
    for (const name of ['기능', '채점', '회원/재방문', '회원 활동', 'PWA', '관리자 조회 이력', '개요']) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: '지표 정의', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('기간 · 추이 · 관측 범위 · 품질과 상세 이동', async ({ page }) => {
  await page.goto(url);
  await period(page, '30일').click();
  await page.getByText('구간별 정확한 값', { exact: true }).click();
  await expect(page.locator('#chart-table tbody tr')).toHaveCount(30);
  await page.getByLabel('표시 지표').selectOption('members');
  await expect(page.locator('#chart-metric')).toHaveValue('members');
  await period(page, '1년').click();
  await page.getByText('구간별 정확한 값', { exact: true }).click();
  await expect(page.locator('#chart-table tbody tr')).toHaveCount(12);
  await page.getByLabel('미리보기 상태', { exact: true }).selectOption('early');
  await expect(page.getByText('장기 발행 0일 · 발행 필요', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /수집 품질 확인/ }).click();
  await expect(page.locator('#quality-details')).toHaveAttribute('open', '');
  await page.getByRole('button', { name: /입력 흐름 · 실행 · 저장 진단/ }).click();
  await expect(tab(page, '채점')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/최근 90일과의 교집합입니다/)).toBeVisible();
});

test('채점 집계 단위 · 미지원 과목 · 과목별 저장 · 대기시간', async ({ page }, info) => {
  await page.goto(url);
  await tab(page, '채점').click();
  await page.getByLabel('과목 조합').selectOption('both');
  await expect(page.getByText(/입력 시점에는 최종 과목 조합이/)).toBeVisible();
  await page.getByRole('button', { name: '채점 실행', exact: true }).click();
  await expect(page.locator('.funnel-step')).toHaveCount(3);
  await page.getByLabel('과목 조합').selectOption('all');
  await expect(page.getByRole('table', { name: '과목별 저장 응답' }).getByText('680', { exact: true })).toBeVisible();
  await expect(page.getByText('대기시간 계측', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('grading.png'), fullPage: true });
});

test('기능 노출 분모 · 기능과 이용 화면 전환', async ({ page }) => {
  await page.goto(url);
  await tab(page, '기능').click();
  await expect(page.getByRole('heading', { name: '문항 분포 · 사용 기회부터 결과까지' })).toBeVisible();
  await page.getByRole('button', { name: '분야별 분석', exact: true }).click();
  await expect(page.getByRole('heading', { name: '분야별 분석 · 사용 기회부터 결과까지' })).toBeVisible();
  await page.getByLabel('이용 화면').selectOption('history');
  await expect(page.getByLabel('이용 화면')).toHaveValue('history');
  await expect(page.getByRole('table', { name: '기능 사용 기회 대비 사용률' })).toContainText('50.0%');
  await page.getByLabel('이용 화면').selectOption('past');
  await expect(page.getByRole('button', { name: '답안 수정', exact: true })).toHaveCount(0);
  await expect(page.getByRole('table', { name: '기능 사용 기회 대비 사용률' })).toContainText('이 화면에서는 미제공');
});

test('재방문 공백과 미성숙 · 실제 0건을 구분', async ({ page }) => {
  await page.goto(url);
  await tab(page, '회원/재방문').click();
  await expect(page.getByRole('table', { name: '재방문 코호트' })).toContainText('관찰 중');
  await period(page, '30일').click();
  await page.getByLabel('미리보기 상태', { exact: true }).selectOption('gap');
  const row = page.getByRole('table', { name: '재방문 코호트' }).getByRole('row').filter({ hasText: '10.05' });
  await expect(row).toContainText('관측 공백');
  await expect(row).not.toContainText('0.0%');
  await page.getByLabel('미리보기 상태', { exact: true }).selectOption('zero');
  await tab(page, '개요').click();
  await expect(page.locator('.kpi-value').first()).toHaveText('0명');
  await expect(page.getByText('변화 없음', { exact: true })).toBeVisible();
});

test('회원 검색 · 선택 해제 · 권한 만료와 조회 실패의 자료 제거', async ({ page }) => {
  await page.goto(url);
  await tab(page, '회원 활동').click();
  await page.getByRole('searchbox', { name: '회원 검색' }).fill('member03@');
  await expect(page.locator('.member-row')).toHaveCount(1);
  await page.locator('.member-row').click();
  await expect(page.locator('.identity')).toContainText('member03@example.test');
  expect(await page.evaluate(() => location.search)).toBe('');
  await page.getByRole('button', { name: '선택 해제', exact: true }).click();
  await expect(page.locator('.identity')).toHaveCount(0);
  await page.locator('.member-row').click();
  await page.getByLabel('미리보기 상태', { exact: true }).selectOption('denied');
  await expect(page.locator('#panel')).not.toContainText('member03');
  await expect(page.getByRole('heading', { name: '관리자 권한을 다시 확인해주세요' })).toBeVisible();
  await page.getByRole('button', { name: '정상 권한 예시로 돌아가기' }).click();
  await expect(page.locator('.identity')).toHaveCount(0);
  await page.getByLabel('미리보기 상태', { exact: true }).selectOption('error');
  await expect(page.getByRole('alert')).toContainText('통계를 불러오지 못했습니다');
  await page.getByRole('button', { name: '예시 재시도', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: '회원 검색' })).toBeVisible();
});

test('PWA 교집합 · 감사 이력 필터 · 키보드 탭 이동', async ({ page }) => {
  await page.goto(url);
  await tab(page, '개요').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, '기능')).toBeFocused();
  await tab(page, 'PWA').click();
  await expect(page.getByText('전체 고유 회원', { exact: true })).toBeVisible();
  await page.getByLabel('실행 채널', { exact: true }).selectOption('pwa');
  await expect(page.getByText(/채널별 교집합은 전체 채널에서만/)).toBeVisible();
  await tab(page, '개요').click();
  await expect(page.locator('.kpi[data-metric="members"] .kpi-value')).toHaveText('80명');
  await expect(page.locator('.kpi[data-metric="pwa"] .kpi-value')).toHaveText('80명');
  await tab(page, 'PWA').click();
  await page.getByLabel('실행 채널', { exact: true }).selectOption('browser');
  await expect(page.getByText('필터 미지원', { exact: true })).toBeVisible();
  await tab(page, '관리자 조회 이력').click();
  await page.getByLabel('조회 종류').selectOption('activity');
  await expect(page.locator('#audit-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: '초기화', exact: true }).click();
  await expect(page.getByLabel('실행 채널', { exact: true })).toHaveValue('all');
});
