import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionStatistics, QuestionRate } from './QuestionStatistics';
import { AnswerSheetResult } from './AnswerSheetResult';
import { answerKeyVersion } from '../utils/questionStatisticsModel';
import { AGGREGATION_VERSION, type StatisticsState } from '../types/questionStatistics';

const mock = vi.hoisted(() => ({ state: { status:'loading' } as StatisticsState, retry:vi.fn() }));
vi.mock('../hooks/useQuestionStatistics', () => ({ useQuestionStatistics: () => mock }));
const selection = {year:'2026',subject:'verbal',examType:'odd'} as const;
let root:Root, container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const render=(node:ReactNode)=>act(()=>root.render(node));
const click=(selector:string)=>act(()=>{const button=document.querySelector<HTMLButtonElement>(selector);expect(button).not.toBeNull();button!.click();});
function ready(n:number, examType:'odd'|'even'='odd') {
  mock.state={status:'ready',data:{year:'2026',subject:'verbal',exam_type:examType,answer_key_version:answerKeyVersion({...selection,examType}),question_count:30,
    sample_count:n,snapshot_id:'1',aggregation_version:AGGREGATION_VERSION,source_snapshot_at:'2026-09-17T07:00:00Z',published_at:'2026-09-17T08:00:00Z',
    items:Array.from({length:30},(_,i)=>({question_no:i+1,choice_counts:[0,0,0,n,0],unanswered_count:0}))}};
}
describe('공개 문항 통계 UI',()=>{
  it.each(['odd','even'] as const)('%s 유형 안내와 모달에 집계 날짜를 표시하지 않는다',examType=>{
    ready(30,examType);render(<QuestionStatistics selection={{...selection,examType}}><QuestionRate question={1}/></QuestionStatistics>);
    const notice=container.querySelector('.question-statistics-notice')!;
    expect(notice.textContent).not.toMatch(/집계|2026/);
    expect(notice.textContent?.includes('짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.')).toBe(examType==='even');
    expect(notice.querySelector('.question-statistics-warning')).not.toBeNull();
    click('.question-rate');
    const dialog=document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).not.toMatch(/집계|2026-09-17|2026\. 9\. 17/);
    expect(dialog.textContent?.includes('짝수형은 다회독 데이터가 많아 실제 정답률보다 높게 나타나는 경향이 있습니다.')).toBe(examType==='even');
    expect(dialog.querySelector('.question-statistics-warning')).not.toBeNull();
  });
  it.each([0,1,30,31])('%i건 표시와 30건 이하 경고',n=>{
    ready(n);render(<QuestionStatistics selection={selection}><QuestionRate question={1}/></QuestionStatistics>);
    expect(container.textContent).not.toContain(`채점 기록 ${n}건`);
    expect(container.querySelector('.question-statistics-warning')!==null).toBe(n<=30);
    expect(container.querySelector('.question-rate')).not.toBeNull();
  });
  it('정답표의 퍼센트 버튼에는 반복 라벨을 넣지 않는다',()=>{
    ready(254);render(<QuestionStatistics selection={selection}><QuestionRate question={1} variant="answer-key"/></QuestionStatistics>);
    expect(container.querySelector('.question-rate--answer-key')).not.toBeNull();
    expect(container.querySelector('.question-rate-caption')).toBeNull();
    expect(container.querySelector('.question-rate')?.getAttribute('aria-label')).toContain('1번 정답률');
  });
  it('6개 분포와 정답 보기/메모를 분리한다',()=>{
    ready(254);
    if(mock.state.status==='ready') mock.state.data.items[0]={question_no:1,choice_counts:[4,19,6,199,12],unanswered_count:14};
    const note=vi.fn();
    render(<QuestionStatistics selection={selection}><AnswerSheetResult total={1} userAnswers={{1:1}} correctAnswers={{1:4}} onOpenNote={note}/></QuestionStatistics>);
    click('.question-rate');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('.question-distribution')?.textContent).toContain('미응답5.5%');
    expect(document.querySelector('[role="dialog"]')?.textContent).not.toMatch(/\d+건/);
    expect(document.querySelectorAll('.distribution-values')).toHaveLength(6);
    for(const row of document.querySelectorAll('.distribution-values')) expect(row.lastChild?.textContent).toMatch(/^\d+\.\d%$/);
    expect(document.querySelectorAll('.question-distribution > li')).toHaveLength(6);
    expect(note).not.toHaveBeenCalled();
    click('[role="dialog"] button');
    click('button[aria-label="1번 문항 메모"]');expect(note).toHaveBeenCalledWith(1);
    vi.useFakeTimers();
    click('button[aria-label="1번 입력 답안 1, 정답 보기"]');
    expect(container.textContent).toContain('정답4');
    act(()=>vi.advanceTimersByTime(2000));
    expect(container.textContent).not.toContain('정답4');
  });
  it.each(['error','unavailable','mismatch','loading'] as const)('통계 %s 상태에도 기존 답안 유지',status=>{
    mock.state={status};render(<QuestionStatistics selection={selection}><p>기존 답안</p><QuestionRate question={1}/></QuestionStatistics>);
    expect(container.textContent).toContain('기존 답안');expect(container.querySelector('.question-rate')).toBeNull();
    if(status==='error') {click('.question-statistics-notice button');expect(mock.retry).toHaveBeenCalled();}
  });
});
