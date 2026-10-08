import { expect, test, type Page } from '@playwright/test';
import type { GradingResult, Subject } from '../src/App';
import { gradeAnswers, getQuestionCount } from '../src/utils/grading';
import { getCorrectAnswers } from '../src/utils/answerData';
import { editedResult } from '../supabase/functions/_shared/user-data-rules/answerEdit';
import statistics from './fixtures/question-statistics-2026.json';

async function isolate(page: Page) {
  const records: GradingResult[] = (['verbal', 'reasoning'] as Subject[]).map((subject, index) => {
    const answers = { ...getCorrectAnswers('2026', subject, 'odd') };
    const wrong = subject === 'verbal' ? [3, 7, 12, 18, 23, 28] : [2, 5, 9, 13, 18, 23, 27, 31, 35, 39];
    for (const q of wrong) answers[q] = q === 28 ? 0 : answers[q] % 5 + 1;
    return { ...gradeAnswers('2026', subject, answers, getQuestionCount('2026', subject), 'odd'), timestamp: 123 + index, groupTimestamp: 100, round: 3 };
  });
  const writes: string[] = [], errors: string[] = [], unexpected: string[] = [];
  let statisticsReads = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token', JSON.stringify({
    access_token: 'field-analysis-test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'field-analysis-user', email: 'field@example.test', user_metadata: {}, app_metadata: {}, aud: 'authenticated' },
  })));
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    if (url.origin === 'http://127.0.0.1:3000') return route.continue();
    if (req.method() === 'GET' &&
      ((url.hostname === 'pagead2.googlesyndication.com' && path === '/pagead/js/adsbygoogle.js') ||
        (url.hostname === 'va.vercel-scripts.com' && path === '/v1/script.debug.js'))) {
      return route.fulfill({ contentType: 'application/javascript', body: '' });
    }
    if (!url.hostname.endsWith('.supabase.co')) { unexpected.push(req.url()); return route.abort(); }
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS' && !path.includes('/rpc/')) writes.push(`${req.method()} ${path}`);
    if (path.includes('/functions/v1/make-server-cd835c22/')) {
      expect(req.headers().authorization).toBe('Bearer field-analysis-test-token');
      if (req.method() === 'PUT') {
        expect(path).toMatch(/\/history\/field-analysis-user\/123$/);
        const body = req.postDataJSON();
        expect(body.expected).toEqual(records[0]);
        records[0] = editedResult(records[0], body.userAnswers);
        return route.fulfill({ json: { success: true, data: records[0] } });
      }
      return route.fulfill({ json: { success: true, data: path.includes('/mock-history/') ? [] : records } });
    }
    if (path.includes('/rpc/current_user_is_admin')) return route.fulfill({ json: false });
    if (path.includes('/question_statistics_snapshots')) {
      statisticsReads++;
      return route.fulfill({ json: statistics.filter(row => row.exam_type === 'odd') });
    }
    if (path.includes('/grading_notes')) return route.fulfill({ json: [{ subject: 'verbal', question_no: 4, content: '유지할 메모' }] });
    return route.fulfill({ json: [] });
  });
  return { records, writes, errors, unexpected, statisticsReads: () => statisticsReads };
}

for (const width of [1280, 390, 320]) {
  test(`분야별 분석과 정답률 설정·답안 수정이 함께 작동한다 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const state = await isolate(page);
    const otherSubject = structuredClone(state.records[1]);
    await page.goto('/history');
    await page.getByRole('button', { name: '자세히 보기', exact: true }).first().click();
    const verbal = page.getByRole('region', { name: '언어이해 분야별 분석', exact: true });
    const reasoning = page.getByRole('region', { name: '추리논증 분야별 분석', exact: true });
    await expect(verbal.locator('.field-analysis-row')).toHaveCount(5);
    await expect(reasoning.locator('.field-analysis-row')).toHaveCount(5);
    await expect(verbal.getByRole('region')).toHaveCount(0);
    await page.setViewportSize({ width, height: 1500 });
    await page.mouse.move(0, 0);
    await verbal.locator('..').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await verbal.locator('..').screenshot({ path: `output/previews/field-analysis-implemented-${width}.png` });
    await page.setViewportSize({ width, height: 1000 });

    const rate = page.getByRole('switch', { name: '언어이해 문항별 정답률 표시', exact: true });
    await expect(rate).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.question-rate')).toHaveCount(0);
    expect(state.statisticsReads()).toBe(0);
    await verbal.locator('.field-analysis-row').first().focus(); await page.keyboard.press('Enter');
    await expect(verbal.getByRole('region')).toHaveCount(1);
    const socialRow = verbal.getByRole('button', { name: /언어이해 사회 .*문항/ });
    await socialRow.click();
    await expect(verbal.getByRole('region')).toHaveCount(1);
    const detail = verbal.getByRole('region', { name: '언어이해 사회 문항별 결과' });
    await expect(detail).toContainText('정답 8 · 오답 3 · 미응답 1');
    await expect(detail.getByRole('button', { name: '언어이해 28번 미응답, 답안표로 이동' })).toBeVisible();
    await verbal.evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.mouse.move(0, 0);
    await verbal.screenshot({ path: `output/previews/field-analysis-implemented-expanded-${width}.png` });
    await detail.getByRole('button', { name: '언어이해 7번 오답, 답안표로 이동' }).click();
    const answer = page.locator('[data-result-answers="verbal"] [data-question-number="7"]');
    await expect(answer).toBeFocused();
    await expect(answer).toHaveClass(/answer-sheet-question-target/);
    await expect(page.locator('.field-analysis-live')).toHaveText('언어이해 7번 답안표로 이동했습니다.');
    expect(state.writes).toEqual([]);

    await page.getByRole('button', { name: '언어이해 분야별 분석 접기' }).click();
    await expect(socialRow).toBeHidden();
    await expect(reasoning.locator('.field-analysis-row').first()).toBeVisible();
    await page.getByRole('button', { name: '언어이해 분야별 분석 펼치기' }).click();
    await expect(verbal.getByRole('region')).toHaveCount(0);

    await page.getByRole('button', { name: '답안 수정', exact: true }).first().click();
    const oldAnswer = state.records[0].userAnswers![7], correct = state.records[0].correctAnswers![7];
    await page.getByRole('button', { name: `7번 입력 답안 ${oldAnswer}, 답안 수정`, exact: true }).click();
    const choice = page.getByRole('button', { name: `7번 ${correct}번 선지 선택`, exact: true });
    await choice.click();
    await socialRow.click();
    await detail.getByRole('button', { name: '언어이해 7번 오답, 답안표로 이동' }).click();
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await reasoning.locator('.field-analysis-row').first().click();
    const reasoningChip = reasoning.locator('.field-analysis-detail:visible .field-analysis-question').first();
    const reasoningQuestion = (await reasoningChip.getAttribute('aria-label'))?.match(/(\d+)번/)?.[1];
    expect(reasoningQuestion).toBeTruthy();
    await reasoningChip.click();
    await expect(page.locator(`[data-result-answers="reasoning"] [data-question-number="${reasoningQuestion}"]`)).toBeFocused();
    await expect(answer).not.toHaveClass(/answer-sheet-question-target/);
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await rate.click();
    await expect(page.getByRole('switch', { name: '추리논증 문항별 정답률 표시', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.question-rate')).toHaveCount(70);
    expect(state.statisticsReads()).toBe(1);
    await expect(choice).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('1문항 변경 · 예상 정답 24 → 25개', { exact: true })).toBeVisible();
    await expect(socialRow).toHaveAttribute('aria-label', /8\/12 정답/);
    await page.getByRole('button', { name: '수정 반영', exact: true }).click();
    await expect(socialRow).toHaveAttribute('aria-label', /9\/12 정답/);
    await expect(detail.getByRole('button', { name: '언어이해 7번 정답, 답안표로 이동' })).toBeVisible();
    expect(state.records[0]).toMatchObject({ timestamp: 123, groupTimestamp: 100, round: 3, correct: 25 });
    expect(state.records[1]).toEqual(otherSubject);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatch(/^PUT /);

    await page.locator('.question-rate').first().click();
    await expect(page.getByRole('dialog')).toContainText('1번 응답 분포');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '4번 문항 메모', exact: true }).first().click();
    await expect(page.getByRole('textbox')).toHaveValue('유지할 메모');
    await page.getByRole('button', { name: '닫기', exact: true }).click();
    await page.reload();
    await expect(rate).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.question-rate')).toHaveCount(70);
    await rate.click();
    await expect(page.locator('.question-rate')).toHaveCount(0);
    await page.reload();
    await expect(rate).toHaveAttribute('aria-checked', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
    await page.getByRole('button', { name: '정답표·점수 환산표 보기', exact: true }).click();
    await expect(page.locator('.question-rate')).toHaveCount(30);
    await expect(page.getByRole('switch')).toHaveCount(0);
    expect(state.errors).toEqual([]); expect(state.unexpected).toEqual([]);
  });
}
