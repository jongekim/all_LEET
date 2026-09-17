import { describe, expect, it } from 'vitest';
import { ANSWER_DATA, getCorrectAnswers } from './answerData';
import { getQuestionCount } from './grading';
import { getPastExamSelection, PAST_EXAM_YEARS } from './pastExamData';

describe('기출문제 정답 데이터', () => {
  it('최신 학년도부터 표시하고 예비시험을 마지막에 표시한다', () => {
    expect(PAST_EXAM_YEARS.at(-1)).toBe('09예비');
    const years = PAST_EXAM_YEARS.filter(year => year !== '09예비').map(Number);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(PAST_EXAM_YEARS).toHaveLength(Object.keys(ANSWER_DATA).length);
  });

  for (const year of PAST_EXAM_YEARS) {
    for (const subject of ['verbal', 'reasoning'] as const) {
      for (const type of ['odd', 'even'] as const) {
        it(`${year} ${subject} ${type}의 모든 문항에 1~5 정답이 있다`, () => {
          const answers = getCorrectAnswers(year, subject, type);
          const count = getQuestionCount(year, subject);
          expect(Object.keys(answers).map(Number).sort((a, b) => a - b))
            .toEqual(Array.from({ length: count }, (_, index) => index + 1));
          for (const answer of Object.values(answers)) {
            expect(Number.isInteger(answer)).toBe(true);
            expect(answer).toBeGreaterThanOrEqual(1);
            expect(answer).toBeLessThanOrEqual(5);
          }
        });
      }
    }
  }

  it('빈 URL과 잘못된 선택을 지원하는 기본값으로 보정한다', () => {
    const defaults = { year: PAST_EXAM_YEARS[0], subject: 'verbal', examType: 'odd' };
    expect(getPastExamSelection(new URLSearchParams())).toEqual(defaults);
    expect(getPastExamSelection(new URLSearchParams('year=2099&subject=invalid&type=invalid'))).toEqual(defaults);
  });

  it('예비시험과 선택한 과목·유형을 유지한다', () => {
    expect(getPastExamSelection(new URLSearchParams('year=09예비&subject=reasoning&type=even')))
      .toEqual({ year: '09예비', subject: 'reasoning', examType: 'even' });
  });
});
