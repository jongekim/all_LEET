import { expect, test, type Page } from '@playwright/test';
import { getCorrectAnswers } from '../src/utils/answerData';
import { getQuestionCount, gradeAnswers } from '../src/utils/grading';
import { SCORE_DATA } from '../src/utils/scoreData';
import { PAST_EXAM_DOCUMENTS } from '../src/utils/pastExamData';

test.beforeEach(async ({ page }) => {
  // 기존 인증 초기화와 홈 배너를 포함한 모든 Supabase 요청을 모의 처리한다.
  await page.route('https://*.supabase.co/**', route => route.fulfill({ json: [] }));
  // 다운로드 UI는 PDF 모의 응답으로 처리하고 운영 Storage 파일 검증을 분리한다.
  await page.route('**/storage/v1/object/public/past-exams/watermarked/v1/**', route => {
    const url = new URL(route.request().url());
    const fileName = url.pathname.split('/').at(-1)!;
    return route.fulfill({
      contentType: 'application/pdf',
      headers: url.searchParams.has('download') ? { 'Content-Disposition': `attachment; filename="${fileName}"` } : {},
      body: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
    });
  });
});

function downloadUrl(fileName: string) {
  return `https://jkxxtyaanyhmjbdtybkp.supabase.co/storage/v1/object/public/past-exams/watermarked/v1/${fileName}?download=${fileName}`;
}

async function expectReviewHidden(page: Page) {
  await expect(page.getByRole('button', { name: '정답표·점수 환산표 보기', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('list', { name: '문항별 정답' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: '맞은 개수별 표준점수와 백분위' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '문제지', exact: true })).toBeVisible();
}

async function revealReview(page: Page) {
  await expectReviewHidden(page);
  await page.getByRole('button', { name: '정답표·점수 환산표 보기', exact: true }).click();
  await expect(page.getByRole('button', { name: '정답·점수표 숨기기', exact: true })).toHaveAttribute('aria-expanded', 'true');
}

test('홈 바로가기, 시험 선택, 새로고침과 뒤로가기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('region', { name: '기능 바로가기' }).getByRole('link', { name: /기출문제/ }).click();
  await expect(page.getByRole('heading', { name: '기출문제·정답표', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/year=2027/);
  await expect(page).toHaveTitle('2027학년도 언어이해 단일 문형 리트(LEET) 기출문제·정답표 | all LEET');
  await expect(page.getByText('문제를 푼 뒤 눌러서 확인하세요.')).toBeVisible();
  await page.getByLabel('시험 학년도').selectOption('2026');
  await revealReview(page);
  const answers = page.getByRole('list', { name: '문항별 정답' });
  await expect(answers.getByRole('listitem')).toHaveCount(30);
  const oddAnswer = getCorrectAnswers('2026', 'verbal', 'odd')[5];
  await expect(answers.getByRole('listitem', { name: `5번 정답 ${oddAnswer}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await revealReview(page);
  const evenAnswer = getCorrectAnswers('2026', 'verbal', 'even')[5];
  await expect(answers.getByRole('listitem', { name: `5번 정답 ${evenAnswer}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await revealReview(page);
  await expect(answers.getByRole('listitem')).toHaveCount(40);
  await page.getByLabel('시험 학년도').selectOption('2018');
  await revealReview(page);
  await expect(answers.getByRole('listitem')).toHaveCount(35);
  await page.reload();
  await expectReviewHidden(page);
  await expect(page.getByLabel('시험 학년도')).toHaveValue('2018');
  await expect(page.getByRole('button', { name: '추리논증', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '짝수형', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('시험 학년도').selectOption('09예비');
  await revealReview(page);
  await expect(answers.getByRole('listitem')).toHaveCount(40);
  await expect(page.getByRole('heading', { name: '09학년도 예비시험 추리논증 짝수형 정답표' })).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel('시험 학년도')).toHaveValue('2018');
  await expectReviewHidden(page);
  await page.goForward();
  await expect(page.getByLabel('시험 학년도')).toHaveValue('09예비');
  await expectReviewHidden(page);
  await expect(page.getByText('HWP 원본', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /PDF 열기/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: '다운로드', exact: true })).toHaveAttribute('href', downloadUrl('LEET-2009-preliminary-reasoning-even.pdf'));
});

test('잘못된 URL은 정상 선택으로 보정하고 합격예측은 기존 로그인 화면으로 연결한다', async ({ page }) => {
  await page.goto('/past-exams?year=2099&subject=invalid&type=invalid');
  await expect(page).toHaveURL('/past-exams?year=2027&subject=verbal&type=odd');
  await page.getByLabel('시험 학년도').selectOption('2026');
  await revealReview(page);
  await expect(page.getByRole('heading', { name: '2026학년도 언어이해 홀수형 정답표' })).toBeVisible();
  await page.getByRole('navigation', { name: '주요 페이지 이동' }).getByRole('link', { name: '합격예측', exact: true }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
});

test('맞은 개수별 환산표는 학년도·과목과 함께 바뀌고 누락 자료를 구분한다', async ({ page }) => {
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  await revealReview(page);
  const table = page.getByRole('table', { name: '맞은 개수별 표준점수와 백분위' });
  await expect(table.getByRole('row')).toHaveCount(32);
  await expect(table.getByRole('row', { name: '30개 73.1 100.0', exact: true })).toBeVisible();
  await expect(page.getByText('일부 표준점수·백분위는 추정값으로 실제 성적과 차이가 있을 수 있습니다. 참고용으로 확인해주세요.')).toBeVisible();
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await revealReview(page);
  await expect(table.getByRole('row', { name: '30개 73.1 100.0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await revealReview(page);
  await expect(table.getByRole('row')).toHaveCount(42);
  const reasoning = SCORE_DATA['2026'].reasoning[40];
  await expect(table.getByRole('row', { name: `40개 ${reasoning.standardScore.toFixed(1)} ${reasoning.percentile.toFixed(1)}`, exact: true })).toBeVisible();
  await page.getByLabel('시험 학년도').selectOption('2018');
  await revealReview(page);
  await expect(table.getByRole('row')).toHaveCount(37);
  const older = SCORE_DATA['2018'].reasoning[35];
  await expect(table.getByRole('row', { name: `35개 ${older.standardScore.toFixed(1)} ${older.percentile.toFixed(1)}`, exact: true })).toBeVisible();
  await page.getByLabel('시험 학년도').selectOption('09예비');
  await revealReview(page);
  await expect(table.getByRole('row')).toHaveCount(42);
  await expect(table.getByRole('row', { name: '0개 — —', exact: true })).toBeVisible();
  await expect(page.getByText('—는 등록된 환산 자료가 없는 구간입니다.')).toBeVisible();
});

test('키보드로 두 표를 함께 펼치고 접을 수 있으며 펼침 상태를 저장하지 않는다', async ({ page }) => {
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  const trigger = page.locator('.past-exam-review-trigger');
  await expectReviewHidden(page);
  await trigger.focus();
  await trigger.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('list', { name: '문항별 정답' })).toBeVisible();
  await expect(page.getByRole('table', { name: '맞은 개수별 표준점수와 백분위' })).toBeVisible();
  await trigger.press('Space');
  await expectReviewHidden(page);
  await revealReview(page);
  await page.reload();
  await expectReviewHidden(page);
});

for (const width of [320, 390, 1280]) {
  test(`하단 메뉴 순서와 화면 배치 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
    const navigation = page.getByRole('navigation', { name: '주요 페이지 이동' });
    const links = navigation.getByRole('link');
    await expect(links).toHaveText(['성적분석', '기출문제', '사설입력', '채점하기', '합격예측', '커뮤니티', '채팅']);
    await expect(navigation.getByRole('link', { name: '기출문제', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const boxes = await links.evaluateAll(elements => elements.map(element => {
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
    await revealReview(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('past-exams-expanded.png'), fullPage: true });
    await page.getByRole('heading', { name: '2026학년도 언어이해 점수 환산표' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('score-conversion.png') });
    await navigation.getByRole('link', { name: '채점하기', exact: true }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('region', { name: '기능 바로가기' }).getByRole('link', { name: /기출문제/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('home.png'), fullPage: true });
    await navigation.getByRole('link', { name: '기출문제', exact: true }).click();
    await expect(page).toHaveURL(/\/past-exams/);
  });
}

test('전개년·전과목·전문형 선택이 워터마크 PDF에 연결되고 출처가 없다', async ({ page }) => {
  // 78개 선택을 순회하므로 일반 단일 화면 테스트보다 여유를 둔다.
  test.setTimeout(60_000);
  await page.goto('/past-exams');
  await expect(page.getByText('전개년·전과목 문제지는 모두 PDF로 제공합니다.')).toBeVisible();
  await expect(page.getByText('법학적성시험 문제의 저작권은 법학전문대학원협의회에 있습니다.')).toBeVisible();
  await expect(page.getByRole('link', { name: /출처/ })).toHaveCount(0);
  for (const document of PAST_EXAM_DOCUMENTS) {
    await page.getByLabel('시험 학년도').selectOption(document.year);
    await page.getByRole('button', { name: document.subject === 'verbal' ? '언어이해' : '추리논증', exact: true }).click();
    if (document.examType !== 'single') await page.getByRole('button', { name: document.examType === 'odd' ? '홀수형' : '짝수형', exact: true }).click();
    await expect(page.getByRole('link', { name: /PDF 열기/ })).toHaveAttribute('href', document.url);
    await expect(page.getByRole('link', { name: '다운로드', exact: true })).toHaveAttribute('href', downloadUrl(document.fileName));
  }
});

test('2027학년도 단일 문형 PDF와 정답·환산표를 제공한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/past-exams?year=2027&subject=verbal&type=even');
  await expect(page).toHaveURL('/past-exams?year=2027&subject=verbal&type=odd');
  await expect(page.getByText('2027학년도 언어이해 단일 문형 문제지', { exact: true })).toBeVisible();
  await expect(page.getByText('단일 문형 (홀수형·짝수형 구분 없음)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(홀수형|짝수형)$/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('single-form.png'), fullPage: true });
  await expect(page.getByRole('link', { name: /PDF 열기/ })).toHaveAttribute('target', '_blank');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '다운로드', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('LEET-2027-verbal-single.pdf');
  expect(await download.failure()).toBeNull();
  await revealReview(page);
  await expect(page.getByRole('heading', { name: '2027학년도 언어이해 단일 문형 정답표' })).toBeVisible();
  await expect(page.getByRole('list', { name: '문항별 정답' }).getByRole('listitem')).toHaveCount(30);
  await expect(page.getByRole('listitem', { name: '1번 정답 5', exact: true })).toBeVisible();
  const table = page.getByRole('table', { name: '맞은 개수별 표준점수와 백분위' });
  await expect(table.getByRole('row')).toHaveCount(32);
  await expect(table.getByRole('row', { name: '29개 69.3 99.9', exact: true })).toBeVisible();
  await expect(table.getByRole('row', { name: '30개 71.5 100.0', exact: true })).toBeVisible();
  await expect(page.getByText('이 시험의 문항 통계가 아직 준비되지 않았습니다.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('single-form-expanded.png'), fullPage: true });
  await page.getByRole('button', { name: '추리논증', exact: true }).click();
  await expect(page.getByRole('link', { name: '다운로드', exact: true })).toHaveAttribute('href', downloadUrl('LEET-2027-reasoning-single.pdf'));
  await revealReview(page);
  await expect(page.getByRole('list', { name: '문항별 정답' }).getByRole('listitem')).toHaveCount(40);
  await expect(table.getByRole('row')).toHaveCount(42);
  await expect(table.getByRole('row', { name: '21개 54.3 29.3', exact: true })).toBeVisible();
  await expect(table.getByRole('row', { name: '22개 56.3 35.6', exact: true })).toBeVisible();
});

test('2025학년도 추리논증은 선택한 홀수형·짝수형 파일을 각각 연결한다', async ({ page }) => {
  await page.goto('/past-exams?year=2025&subject=reasoning&type=odd');
  await expect(page.getByText('2025학년도 추리논증 홀수형 문제지', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '다운로드', exact: true })).toHaveAttribute('href', downloadUrl('LEET-2025-reasoning-odd.pdf'));
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await expect(page.getByText('2025학년도 추리논증 짝수형 문제지', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '다운로드', exact: true })).toHaveAttribute('href', downloadUrl('LEET-2025-reasoning-even.pdf'));
  await revealReview(page);
  await expect(page.getByRole('heading', { name: '2025학년도 추리논증 짝수형 정답표' })).toBeVisible();
});


test('09예비 짝수형도 모바일에서 워터마크 PDF로 다운로드한다', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/past-exams?year=09예비&subject=verbal&type=even');
  await expect(page.getByText('09학년도 예비시험 언어이해 짝수형 문제지', { exact: true })).toBeVisible();
  await expect(page.getByText(/HWP/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: /PDF 열기/ })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pdf-download.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '다운로드', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('LEET-2009-preliminary-verbal-even.pdf');
  expect(await download.failure()).toBeNull();
});


test('홈에서 2027학년도 단일 문형 답안을 입력하고 과거 문형에서 전환한다', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByLabel('시험 학년도')).toHaveValue('2027');
  await expect(page.getByText('단일 문형 (홀수형·짝수형 구분 없음)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(홀수형|짝수형)$/ })).toHaveCount(0);
  await expect(page.getByRole('spinbutton')).toHaveCount(70);
  await page.getByRole('spinbutton').first().fill('5');
  await expect(page.getByRole('spinbutton').first()).toHaveValue('5');
  await expect(page.getByRole('main').getByRole('button', { name: '채점하기', exact: true })).toBeEnabled();
  await page.getByLabel('시험 학년도').selectOption('2026');
  await page.getByRole('button', { name: '짝수형', exact: true }).click();
  await page.getByRole('spinbutton').first().fill('4');
  await page.getByLabel('시험 학년도').selectOption('2027');
  await expect(page.getByRole('spinbutton').first()).toBeEmpty();
  await expect(page.getByRole('button', { name: /^(홀수형|짝수형)$/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('grading-2027.png'), fullPage: true });
  // 운영 이력 쓰기는 실행하지 않고 입력 및 제출 직전 상태까지만 검증한다.
});


for (const subject of ['verbal', 'reasoning'] as const) {
  test(`2027 ${subject} 분야별 결과를 운영 제출 없이 표시한다`, async ({ page }, testInfo) => {
    const total = getQuestionCount('2027', subject);
    const answers = getCorrectAnswers('2027', subject, 'odd');
    const userAnswers = Object.fromEntries([1,2,3,4].map(question => [question, answers[question]]));
    const result = gradeAnswers('2027', subject, userAnswers, total, 'odd');
    // 결과 라우트에 로컬 채점값만 주입한다. 홈 제출이나 운영 이력 쓰기는 실행하지 않는다.
    await page.addInitScript(result => {
      window.history.replaceState({ usr: { results: [result] }, key: 'readonly-2027', idx: 0 }, '');
    }, result);
    await page.goto('/result');
    await expect(page.getByText('2027학년도 - 단일 문형', { exact: true })).toBeVisible();
    const analysis = page.locator('div').filter({ has: page.getByRole('heading', { name: '분야별 분석', exact: true }) })
      .filter({ hasNot: page.getByRole('heading', { name: '채점 결과', exact: true }) }).last();
    const expected = subject === 'verbal'
      ? [['규범', '3 / 6'], ['사회', '1 / 6'], ['인문', '0 / 9'], ['과학기술', '0 / 6'], ['문예', '0 / 3']]
      : [['법규범', '4 / 12'], ['인문', '0 / 12'], ['사회', '0 / 6'], ['논리학수학', '0 / 4'], ['과학기술', '0 / 6']];
    const rows = analysis.locator('.border.rounded-lg');
    await expect(rows).toHaveCount(5);
    for (const [field, count] of expected) {
      const row = rows.filter({ has: page.getByText(field, { exact: true }) });
      await expect(row.getByText(count, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('분야별 분류 자료가 아직 준비되지 않았습니다.')).toHaveCount(0);
    await analysis.screenshot({ path: testInfo.outputPath('field-analysis-2027.png') });
  });
}
