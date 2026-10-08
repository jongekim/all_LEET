import { expect, test, type Page } from '@playwright/test';
import { gradeAnswers } from '../src/utils/grading';
import { editedResult } from '../supabase/functions/_shared/user-data-rules/answerEdit';
import type { GradingResult } from '../src/App';
import statistics from './fixtures/question-statistics-2026.json';

const initial = () => JSON.parse(JSON.stringify([
  {...gradeAnswers('2026','verbal',{1:3},30,'odd'),timestamp:123,groupTimestamp:100,round:3},
  {...gradeAnswers('2026','reasoning',{1:2},40,'odd'),timestamp:124,groupTimestamp:100,round:3},
])) as GradingResult[];

async function isolate(page: Page, failure?: 'conflict' | 'unknown' | 'pending', guest = false) {
  const records = initial();
  const writes: string[] = [];
  let releaseWrite!: () => void;
  const pendingWrite = new Promise<void>(resolve => { releaseWrite = resolve; });
  if (!guest) await page.addInitScript(() => localStorage.setItem('sb-jkxxtyaanyhmjbdtybkp-auth-token',JSON.stringify({
    access_token:'answer-edit-test-token',refresh_token:'test-refresh',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+3600,
    user:{id:'answer-edit-user',email:'answer@example.test',user_metadata:{},app_metadata:{},aud:'authenticated'},
  })));
  await page.route('https://*.supabase.co/**',async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path.includes('/functions/v1/make-server-cd835c22/')) {
      expect(req.headers().authorization).toBe('Bearer answer-edit-test-token');
      if (req.method() !== 'GET') writes.push(req.method());
      if (req.method() === 'PUT') {
        expect(path).toMatch(/\/history\/answer-edit-user\/123$/);
        const body = req.postDataJSON();
        expect(Object.keys(body).sort()).toEqual(['expected','userAnswers']);
        expect(body.expected).toEqual(records[0]);
        if (failure === 'conflict') {
          records[0] = editedResult(records[0],{1:0});
          return route.fulfill({status:409,json:{success:false,code:'HISTORY_CONFLICT'}});
        }
        if (failure === 'pending') await pendingWrite;
        records[0] = editedResult(records[0],body.userAnswers);
        if (failure === 'unknown') return route.abort();
        return route.fulfill({json:{success:true,data:records[0]}});
      }
      if (req.method() === 'POST') {
        const saved = {...req.postDataJSON(),timestamp:123,round:3};
        records[0] = saved;
        return route.fulfill({json:{success:true,data:saved}});
      }
      return route.fulfill({json:{success:true,data:path.includes('/mock-history/') ? [] : records}});
    }
    if (path.includes('/rpc/current_user_is_admin')) return route.fulfill({json:false});
    if (path.includes('/question_statistics_snapshots')) return route.fulfill({json:statistics.filter(row=>row.exam_type === 'odd')});
    if (path.includes('/grading_notes')) return route.fulfill({json:[{subject:'verbal',question_no:1,content:'유지할 메모'}]});
    return route.fulfill({json:[]});
  });
  return {records,writes,releaseWrite};
}
async function editFirst(page: Page) {
  await page.goto('/history');
  await page.getByRole('button',{name:'자세히 보기',exact:true}).first().click();
  await page.getByRole('button',{name:'답안 수정',exact:true}).first().click();
  await page.getByRole('button',{name:'1번 입력 답안 3, 답안 수정',exact:true}).click();
  await page.getByRole('button',{name:'1번 4번 선지 선택',exact:true}).click();
}
for (const width of [1280,390]) {
  test(`답안 수정 후 같은 회독과 메모를 유지하고 점수·이력을 갱신한다 (${width}px)`,async({page})=>{
    await page.setViewportSize({width,height:900});
    const {records,writes} = await isolate(page);
    const other = structuredClone(records[1]);
    await editFirst(page);
    await expect(page.getByText('1문항 변경 · 예상 정답 0 → 1개',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'답안 수정',exact:true})).toBeDisabled();
    await page.screenshot({path:`output/previews/answer-edit-implemented-${width}.png`,fullPage:true});
    await page.locator('.answer-edit-heading').first().locator('..').screenshot({path:`output/previews/answer-edit-detail-${width}.png`});
    await page.getByRole('button',{name:'수정 반영',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'1문항 수정이 반영되었습니다'})).toBeVisible();
    expect(writes).toEqual(['PUT']);
    expect(records[0]).toMatchObject({timestamp:123,groupTimestamp:100,round:3,correct:1});
    expect(records[1]).toEqual(other);
    await expect(page.getByRole('button',{name:'1번 입력 답안 4',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'1번 문항 메모',exact:true}).first().click();
    await expect(page.getByRole('textbox')).toHaveValue('유지할 메모');
    await page.getByRole('button',{name:'닫기',exact:true}).click();
    await page.reload();
    await expect(page.getByRole('button',{name:'1번 입력 답안 4',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'성적 분석',exact:true}).click();
    await expect(page.getByText('(3회독)',{exact:false})).toBeVisible();
    await page.getByRole('button',{name:'자세히 보기',exact:true}).first().click();
    await expect(page.getByText('맞은 개수: 1 / 30',{exact:true})).toBeVisible();
  });
}
test('충돌 시 입력을 유지하고 재전송·취소 덮어쓰기를 막는다',async({page})=>{
  const {writes}=await isolate(page,'conflict');await editFirst(page);
  await page.getByRole('button',{name:'수정 반영',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('다른 곳에서 이 기록이 변경');
  await expect(page.getByRole('button',{name:'1번 4번 선지 선택'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'수정 반영',exact:true})).toBeDisabled();
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await expect(page.getByText('답안 수정 중',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'취소',exact:true}).click();
  await expect(page.getByRole('button',{name:'1번 입력 답안 3, 정답 보기'}).first()).toBeVisible();
  expect(writes).toEqual(['PUT']);
  await page.getByRole('button',{name:'성적 분석',exact:true}).click();
  await page.getByRole('button',{name:'자세히 보기',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'1번 입력 답안 미응답, 정답 보기'}).first()).toBeVisible();
});
test('저장 응답 유실은 조회로 대조하고 PUT을 반복하지 않는다',async({page})=>{
  const {writes}=await isolate(page,'unknown');await editFirst(page);
  await page.getByRole('button',{name:'수정 반영',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'1문항 수정이 반영되었습니다'})).toBeVisible();
  expect(writes).toEqual(['PUT']);
});
test('저장 중 중복 반영과 페이지 버튼 이동을 막고 떠난 화면으로 돌아가지 않는다',async({page})=>{
  const {writes,releaseWrite}=await isolate(page,'pending');await editFirst(page);
  await page.getByRole('button',{name:'수정 반영',exact:true}).click();
  await expect(page.getByRole('button',{name:'반영 중...',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'취소',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'1번 3번 선지 선택'})).toBeDisabled();
  await page.getByRole('button',{name:'성적 분석',exact:true}).click();
  await expect(page).toHaveURL(/\/result$/);
  page.once('dialog',dialog=>dialog.dismiss());
  await page.goBack();
  await expect(page.getByText('답안 수정 중',{exact:true})).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.goBack();
  await expect(page).toHaveURL(/\/history$/);
  const response = page.waitForResponse(response=>response.request().method() === 'PUT' && response.url().endsWith('/123'));
  releaseWrite();
  await response;
  await expect(page.getByText(String(editedResult(initial()[0],{1:4}).standardScore),{exact:true}).first()).toBeVisible();
  await expect(page).toHaveURL(/\/history$/);
  expect(writes).toEqual(['PUT']);
});
test('새 채점 직후 서버가 부여한 시각과 회독으로 수정한다',async({page})=>{
  const {writes}=await isolate(page);await page.goto('/');
  await page.getByLabel('시험 학년도').selectOption('2026');
  await page.getByPlaceholder('1-5').first().fill('3');
  await page.getByRole('main').getByRole('button',{name:'채점하기',exact:true}).click();
  await page.getByRole('button',{name:'답안 수정',exact:true}).click();
  await page.getByRole('button',{name:'1번 입력 답안 3, 답안 수정',exact:true}).click();
  await page.getByRole('button',{name:'1번 4번 선지 선택'}).click();
  await page.getByRole('button',{name:'수정 반영',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'1문항 수정이 반영되었습니다'})).toBeVisible();
  expect(writes).toEqual(['POST','PUT']);
});
test('비로그인 수정은 서버 쓰기 없이 현재 결과만 갱신한다',async({page})=>{
  const {writes}=await isolate(page,undefined,true);await page.goto('/');
  await page.getByLabel('시험 학년도').selectOption('2026');
  await page.getByPlaceholder('1-5').first().fill('3');
  await page.getByRole('main').getByRole('button',{name:'채점하기',exact:true}).click();
  await page.getByRole('button',{name:'답안 수정',exact:true}).click();
  await page.getByRole('button',{name:'1번 입력 답안 3, 답안 수정',exact:true}).click();
  await page.getByRole('button',{name:'1번 미응답 선택'}).click();
  await page.getByRole('button',{name:'수정 반영',exact:true}).click();
  await expect(page.getByRole('button',{name:'1번 입력 답안 미응답, 정답 보기',exact:true})).toBeVisible();
  expect(writes).toEqual([]);
});
