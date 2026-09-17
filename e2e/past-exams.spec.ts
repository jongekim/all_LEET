import { expect, test } from '@playwright/test';
import { getCorrectAnswers } from '../src/utils/answerData';
import { SCORE_DATA } from '../src/utils/scoreData';

test.beforeEach(async ({ page }) => {
  // 기존 인증 초기화와 홈 배너를 포함한 모든 Supabase 요청을 모의 처리한다.
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
});

test('홈 바로가기, 시험 선택, 새로고침과 뒤로가기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: '기능 바로가기' }).getByRole('button', { name: /기출문제/ }).click();
  await expect(page.getByRole('heading', { name: '기출문제·정답표', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/year=2026/);
  await expect(page).toHaveTitle('LEET 기출문제·정답표 | all LEET');
  const answers = page.getByRole('list', { name: '문항별 정답' });
  await expect(answers.getByRole('listitem')).toHaveCount(30);
  const oddAnswer = getCorrectAnswers('2026', 'verbal', 'odd')[5];
  await expect(answers.getByRole('listitem', { name: `5번 정답 ${oddAnswer}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  const evenAnswer = getCorrectAnswers('2026', 'verbal', 'even')[5];
  await expect(answers.getByRole('listitem', { name: `5번 정답 ${evenAnswer}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await expect(answers.getByRole('listitem')).toHaveCount(40);
  await page.getByLabel('시험 학년도').selectOption('2018');
  await expect(answers.getByRole('listitem')).toHaveCount(35);
  await page.reload();
  await expect(page.getByLabel('시험 학년도')).toHaveValue('2018');
  await expect(page.getByRole('button', { name: '추리논증', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '짝수형', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('시험 학년도').selectOption('09예비');
  await expect(answers.getByRole('listitem')).toHaveCount(40);
  await expect(page.getByRole('heading', { name: '09학년도 예비시험 추리논증 짝수형 정답표' })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('시험 학년도')).toHaveValue('2018');
  await expect(page.getByText(/문제지 PDF 준비 중/)).toBeVisible();
  await expect(page.getByRole('link', { name: /PDF 열기|다운로드/ })).toHaveCount(0);
});

test('잘못된 URL은 정상 선택으로 보정하고 합격예측은 기존 로그인 화면으로 연결한다', async ({ page }) => {
  await page.goto('/past-exams?year=2099&subject=invalid&type=invalid');
  await expect(page).toHaveURL('/past-exams?year=2026&subject=verbal&type=odd');
  await expect(page.getByRole('heading', { name: '2026학년도 언어이해 홀수형 정답표' })).toBeVisible();
  await page.getByRole('navigation', { name: '주요 페이지 이동' }).getByRole('button', { name: '합격예측', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
});

test('맞은 개수별 환산표는 학년도·과목과 함께 바뀌고 누락 자료를 구분한다', async ({ page }) => {
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  const table = page.getByRole('table', { name: '맞은 개수별 표준점수와 백분위' });
  await expect(table.getByRole('row')).toHaveCount(32);
  await expect(table.getByRole('row', { name: '30개 73.1 100.0', exact: true })).toBeVisible();
  await expect(page.getByText('일부 표준점수·백분위는 추정값으로 실제 성적과 차이가 있을 수 있습니다. 참고용으로 확인해주세요.')).toBeVisible();
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await expect(table.getByRole('row', { name: '30개 73.1 100.0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(42);
  const reasoning = SCORE_DATA['2026'].reasoning[40];
  await expect(table.getByRole('row', { name: `40개 ${reasoning.standardScore.toFixed(1)} ${reasoning.percentile.toFixed(1)}`, exact: true })).toBeVisible();
  await page.getByLabel('시험 학년도').selectOption('2018');
  await expect(table.getByRole('row')).toHaveCount(37);
  const older = SCORE_DATA['2018'].reasoning[35];
  await expect(table.getByRole('row', { name: `35개 ${older.standardScore.toFixed(1)} ${older.percentile.toFixed(1)}`, exact: true })).toBeVisible();
  await page.getByLabel('시험 학년도').selectOption('09예비');
  await expect(table.getByRole('row')).toHaveCount(42);
  await expect(table.getByRole('row', { name: '0개 — —', exact: true })).toBeVisible();
  await expect(page.getByText('—는 등록된 환산 자료가 없는 구간입니다.')).toBeVisible();
});

for (const width of [320, 390, 1280]) {
  test(`하단 메뉴 순서와 화면 배치 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/past-exams');
    const navigation = page.getByRole('navigation', { name: '주요 페이지 이동' });
    const buttons = navigation.getByRole('button');
    await expect(buttons).toHaveText(['성적분석', '기출문제', '사설입력', '채점하기', '합격예측', '커뮤니티', '채팅']);
    await expect(navigation.getByRole('button', { name: '기출문제', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const boxes = await buttons.evaluateAll(elements => elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom, width: rect.width, height: rect.height };
    }));
    for (let index = 0; index < boxes.length; index++) {
      const box = boxes[index];
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      if (index) expect(box.x).toBeGreaterThanOrEqual(boxes[index - 1].right - 0.1);
    }
    await page.screenshot({ path: testInfo.outputPath('past-exams.png'), fullPage: true });
    await page.getByRole('heading', { name: '2026학년도 언어이해 점수 환산표' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('score-conversion.png') });
    await navigation.getByRole('button', { name: '채점하기', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('region', { name: '기능 바로가기' }).getByRole('button', { name: /기출문제/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    await navigation.getByRole('button', { name: '기출문제', exact: true }).click();
    await expect(page).toHaveURL(/\/past-exams/);
  });
}
