import { describe, expect, it } from 'vitest';
import { answerKeyVersion, countValue, formatRate, hasMatchingAnswers, statisticsCatalog, validateCohort, validateSnapshot } from './questionStatisticsModel';
import { getCorrectAnswers } from './answerData';
import { AGGREGATION_VERSION } from '../types/questionStatistics';
import { makeArtifact, validateArtifact } from '../../scripts/question-statistics-artifact';

const selection = { year: '2026', subject: 'verbal', examType: 'odd' } as const;
function cohort(n = 254) {
  return { year: '2026', subject: 'verbal', exam_type: 'odd', answer_key_version: answerKeyVersion(selection), question_count: 30,
    sample_count: String(n), items: Array.from({length:30}, (_,i) => ({question_no:i+1,choice_counts:[0,0,0,n,0],unanswered_count:0})) };
}
describe('문항별 통계 모델', () => {
  it('실제 26학년도 홀수형 언어이해 1번 분포를 전체 기록 기준으로 계산한다', () => {
    const row=cohort(); row.items[0]={question_no:1,choice_counts:[4,19,6,199,12],unanswered_count:14};
    const parsed=validateCohort(row);
    expect(formatRate(parsed.items[0].choice_counts[3],parsed.sample_count)).toBe('78.3%');
    expect(formatRate(parsed.items[0].unanswered_count,parsed.sample_count)).toBe('5.5%');
  });
  it.each([0,1,30,31])('표본 %i건을 숨기지 않고 받아들인다', n => expect(validateCohort(cohort(n)).sample_count).toBe(n));
  it('0건은 0% 대신 미계산을 표시한다', () => expect(formatRate(0,0)).toBe('—'));
  it('누락 문항, 합계 불일치, 문자열 답안/음수/부동소수/안전 정수 초과를 차단한다', () => {
    const wrong=cohort(); wrong.items[0].unanswered_count=1;
    expect(() => validateCohort(wrong)).toThrow();
    expect(() => validateCohort({...cohort(),items:[]})).toThrow();
    for (const value of [-1,0.2,null,'1e3','',Number.MAX_SAFE_INTEGER+1]) expect(() => countValue(value)).toThrow();
  });
  it('수신된 스냅샷 세대·규칙·시각을 검증한다', () => {
    const raw={...cohort(),snapshot_id:'1',aggregation_version:AGGREGATION_VERSION,source_snapshot_at:'2026-09-17T07:00:00Z',published_at:'2026-09-17T08:00:00Z'};
    expect(validateSnapshot(raw).snapshot_id).toBe('1');
    expect(() => validateSnapshot({...raw,aggregation_version:'unknown'})).toThrow();
  });
  it('유형과 저장 정답이 다르면 현재 정답률을 섞지 않는다', () => {
    expect(hasMatchingAnswers(selection,getCorrectAnswers('2026','verbal','odd'))).toBe(true);
    expect(hasMatchingAnswers(selection,getCorrectAnswers('2026','verbal','even'))).toBe(false);
    expect(hasMatchingAnswers(selection,undefined)).toBe(false);
  });
  it('76개 조합의 발행 파일 검증·변조 방지·격리 시 중단', () => {
    const cohorts=statisticsCatalog().map(c => ({...c,sample_count:0,items:Array.from({length:c.question_count},(_,i)=>({question_no:i+1,choice_counts:[0,0,0,0,0],unanswered_count:0}))}));
    const source={source_snapshot_at:'2026-09-17T07:00:00Z',source_count:0,included_count:0,quarantined_count:0,malformed_histories:0,cohorts};
    const artifact=makeArtifact(source,'jkxxtyaanyhmjbdtybkp','test');
    expect(validateArtifact(JSON.parse(JSON.stringify(artifact)),artifact.project_ref)).toEqual(artifact);
    expect(() => validateArtifact({...artifact,code_revision:'changed'},artifact.project_ref)).toThrow();
    expect(() => makeArtifact({...source,quarantined_count:1},artifact.project_ref,'test')).toThrow();
    expect(() => makeArtifact({...source,cohorts:cohorts.slice(1)},artifact.project_ref,'test')).toThrow();
  });
});
