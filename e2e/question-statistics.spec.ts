import { expect, test, type Page } from '@playwright/test';
import { answerKeyVersion } from '../src/utils/questionStatisticsModel';
import { getQuestionCount } from '../src/utils/grading';
import type { ExamStatisticsSelection } from '../src/types/questionStatistics';
// Aggregates read from production at 2026-09-17 16:56:30 KST; no individual answers/IDs.
import actual2026 from './fixtures/question-statistics-2026.json';

function snapshot(selection: ExamStatisticsSelection, n: number) {
  const q=getQuestionCount(selection.year,selection.subject);
  return {year:selection.year,subject:selection.subject,exam_type:selection.examType,question_count:q,sample_count:String(n),snapshot_id:'1',
    answer_key_version:answerKeyVersion(selection),aggregation_version:'all_saved_records_v1',source_snapshot_at:'2026-09-17T07:56:30Z',published_at:'2026-09-17T08:00:00Z',
    items:Array.from({length:q},(_,i)=>({question_no:i+1,choice_counts:[0,0,0,n,0],unanswered_count:0}))};
}
async function mock(page:Page,n=254) {
  await page.route('https://*.supabase.co/**', async route=>{
    if(!route.request().url().includes('/rest/v1/question_statistics_snapshots')) return route.fulfill({json:[]});
    const url=new URL(route.request().url());
    const year=url.searchParams.get('year')!.slice(3), examType=url.searchParams.get('exam_type')!.slice(3) as 'odd'|'even';
    const rows=n===254&&year==='2026' ? actual2026.filter(row=>row.exam_type===examType)
      : (['verbal','reasoning'] as const).map(subject=>snapshot({year,subject,examType},n));
    return route.fulfill({json:rows});
  });
}
async function open(page:Page) {
  await page.goto('/past-exams?year=2026&subject=verbal&type=odd');
  await expect(page.getByRole('button',{name:/^1번 정답률/})).toHaveCount(0);
  await page.getByRole('button',{name:'정답표·점수 환산표 보기',exact:true}).click();
}
test('실제 분포를 보여주고 키보드 닫기 뒤 트리거로 포커스를 복귀한다',async({page})=>{
  await mock(page);await open(page);
  await expect(page.getByRole('status')).not.toContainText(/집계|다회독/);
  const button=page.getByRole('button',{name:'1번 정답률 78.3%, 응답 분포 보기',exact:true});
  await button.focus();await button.press('Enter');
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText(/집계|다회독/);
  await expect(dialog.getByRole('listitem')).toHaveCount(6);
  await expect(dialog.getByText('5.5%',{exact:true})).toBeVisible();
  await expect(dialog).not.toContainText('254건');
  await expect(dialog.locator('.distribution-values')).not.toContainText([/건/]);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(button).toBeFocused();
  await page.getByRole('button',{name:'짝수형',exact:true}).click();
  await expect(page.getByRole('button',{name:/정답률/})).toHaveCount(0);
  await page.getByRole('button',{name:'정답표·점수 환산표 보기',exact:true}).click();
  await expect(page.getByRole('button',{name:'1번 정답률 86.8%, 응답 분포 보기',exact:true})).toBeVisible();
  await expect(page.getByRole('status')).toContainText('짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.');
  await expect(page.getByRole('status')).not.toContainText('집계');
  await page.getByRole('button',{name:/^1번 정답률/}).click();
  await expect(dialog).toContainText('짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.');
  await expect(dialog).not.toContainText('집계');
});
test('320px 짝수형에서 회독 안내와 소표본 경고를 함께 보여준다',async({page},testInfo)=>{
  await page.setViewportSize({width:320,height:800});await mock(page,30);
  await page.goto('/past-exams?year=2026&subject=verbal&type=even');
  await page.getByRole('button',{name:'정답표·점수 환산표 보기',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('다회독');
  await page.getByRole('button',{name:/^1번 정답률/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('다회독');await expect(dialog).toContainText('30건 이하');
  await expect(dialog.getByRole('listitem')).toHaveCount(6);
  const box=await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(320);expect(box!.y+box!.height).toBeLessThanOrEqual(800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('even-form-distribution.png')});
});
for(const n of [0,1,30,31]) test(`표본 ${n}건은 공개하며 30건 이하 경고를 적용한다`,async({page})=>{
  await mock(page,n);await open(page);
  await expect(page.getByRole('status')).toContainText('문항별 정답률');
  await expect(page.getByRole('status')).not.toContainText(`채점 기록 ${n}건`);
  await expect(page.getByText(/정답률의 정확도가/)).toHaveCount(n<=30?1:0);
  await expect(page.getByRole('button',{name:/^1번 정답률/})).toHaveCount(1);
});
test('통계 오류·재시도 중에도 정답표와 환산표는 사용할 수 있다',async({page})=>{
  await mock(page);
  await page.route('**/rest/v1/question_statistics_snapshots*',route=>route.fulfill({status:503,json:{message:'test outage'}}));
  await open(page);
  await expect(page.getByRole('button',{name:'다시 시도'})).toBeVisible();
  await expect(page.getByRole('list',{name:'문항별 정답'}).getByRole('listitem')).toHaveCount(30);
  await expect(page.getByRole('table',{name:'맞은 개수별 표준점수와 백분위'})).toBeVisible();
  await page.unroute('**/rest/v1/question_statistics_snapshots*');
  await page.getByRole('button',{name:'다시 시도'}).click();
  await expect(page.getByRole('button',{name:/1번 정답률 78.3%/})).toBeVisible();
});
test('채점 결과의 통계·2초 정답 보기·메모 버튼을 분리한다',async({page})=>{
  await mock(page);
  await page.goto('/');
  await page.getByRole('spinbutton').first().fill('1');
  await page.getByRole('main').getByRole('button',{name:'채점하기',exact:true}).click();
  await expect(page).toHaveURL('/result');
  expect(await page.locator('.answer-sheet-result-grid').evaluate(element=>getComputedStyle(element).rowGap)).toBe('16px');
  await page.getByRole('button',{name:/1번 정답률 78.3%/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'1번 입력 답안 1, 정답 보기',exact:true}).click();
  await expect(page.getByText('정답',{exact:true})).toBeVisible();
  await expect(page.getByText('정답',{exact:true})).toHaveCount(0,{timeout:4000});
  await page.getByRole('button',{name:'1번 문항 메모',exact:true}).click();
  await expect(page.getByText(/로그인/).first()).toBeVisible();
});
for(const width of [320,390]) test(`${width}px 결과 화면의 문항 행을 분리하고 건수를 숨긴다`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});await mock(page);await page.goto('/');
  await page.getByRole('spinbutton').first().fill('1');
  await page.getByRole('main').getByRole('button',{name:'채점하기',exact:true}).click();
  await expect(page.getByRole('button',{name:/^1번 정답률 78.3%/})).toBeVisible();
  const grid=page.locator('.answer-sheet-result-grid');
  const first=await grid.locator(':scope > div').nth(0).boundingBox(),next=await grid.locator(':scope > div').nth(5).boundingBox();
  expect(next!.y-(first!.y+first!.height)).toBeCloseTo(16,0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await grid.scrollIntoViewIfNeeded();await page.screenshot({path:testInfo.outputPath('result-rows.png')});
});
for(const width of [320,390,1280]) test(`${width}px에서 분포 모달과 정답표는 가로 넘침이 없다`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:800});await mock(page);await open(page);
  await page.getByRole('button',{name:/1번 정답률 78.3%/}).click();
  await expect(page.getByText('5.5%',{exact:true})).toBeVisible();
  const box=await page.getByRole('dialog').boundingBox();
  expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(width);expect(box!.y+box!.height).toBeLessThanOrEqual(800);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('question-distribution.png')});
  await page.keyboard.press('Escape');
  await page.getByRole('heading',{name:/홀수형 정답표/}).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('answer-key.png')});
});
