import { describe, expect, it } from 'vitest';
import { getCorrectAnswers } from './answerData';
import { getQuestionCount, gradeAnswers } from './grading';
import { getScoreConversion, SCORE_DATA } from './scoreData';
import { getExamTypeLabel } from './examType';

// 사용자 첨부 정답표·환산표를 독립적으로 전사한 회귀 기준.
const answers = {
  verbal: [5,4,4,3,3,4,2,1,1,2,3,2,3,3,5,2,5,3,4,2,2,1,5,4,2,3,4,3,1,4],
  reasoning: [5,3,3,4,5,1,1,3,5,1,2,4,5,5,1,2,1,1,3,2,2,1,5,1,1,1,2,3,3,2,3,3,2,4,3,3,3,1,4,1],
};
const supplied = {
  verbal: [[29,69.3,99.9],[28,67.1,99.8],[27,64.9,99.4],[26,62.7,98.5],[25,60.6,96.8],[24,58.4,94],[23,56.2,89.8],[22,54,84],[21,51.8,77],[20,49.7,68.3],[19,47.5,58.7],[18,45.3,49.1]],
  reasoning: [[38,89.5,99.9],[37,87.5,99.7],[36,85.4,99.4],[35,83.3,98.6],[34,81.2,97.4],[33,79.2,95.7],[32,77.1,93.2],[31,75,90],[30,72.9,86],[29,70.9,81.1],[28,68.8,75.6],[27,66.7,69.3],[26,64.6,62.6],[25,62.6,55.7],[24,60.5,49],[23,58.4,42.4]],
};

describe('2027학년도 채점', () => {
  for (const subject of ['verbal', 'reasoning'] as const) {
    it(`${subject} 정답과 제공된 환산값을 그대로 보존한다`, () => {
      for (const type of ['odd', 'even'] as const) {
        expect(Object.values(getCorrectAnswers('2027', subject, type))).toEqual(answers[subject]);
        expect(getExamTypeLabel('2027', type)).toBe('단일 문형');
      }
      for (const [count, standardScore, percentile] of supplied[subject]) {
        expect(getScoreConversion('2027', subject, count)).toEqual({ standardScore, percentile });
      }
    });

    it(`${subject} 0개부터 만점까지 누락 없이 채점하며 환산값이 단조 증가한다`, () => {
      const total = getQuestionCount('2027', subject);
      expect(Object.keys(SCORE_DATA['2027'][subject])).toHaveLength(total + 1);
      for (let count = 0; count <= total; count++) {
        const userAnswers = Object.fromEntries(answers[subject].slice(0, count).map((answer, index) => [index + 1, answer]));
        const conversion = getScoreConversion('2027', subject, count);
        for (const type of ['odd', 'even'] as const) {
          expect(gradeAnswers('2027', subject, userAnswers, total, type)).toMatchObject({
            correct: count, total, standardScore: conversion.standardScore, percentile: conversion.percentile, fieldAnalysis: [],
          });
        }
        expect(Number.isFinite(conversion.standardScore)).toBe(true);
        expect(conversion.percentile).toBeGreaterThanOrEqual(0);
        expect(conversion.percentile).toBeLessThanOrEqual(100);
        if (count > 0) {
          const previous = getScoreConversion('2027', subject, count - 1);
          expect(conversion.standardScore).toBeGreaterThan(previous.standardScore);
          expect(conversion.percentile).toBeGreaterThanOrEqual(previous.percentile);
        }
      }
    });
  }

  it('추리 21개는 제공된 표준점수를 보존하고 백분위만 추정한다', () => {
    expect(getScoreConversion('2027', 'reasoning', 21)).toEqual({ standardScore: 54.3, percentile: 29.3, estimatedPercentile: true });
    expect(getScoreConversion('2027', 'reasoning', 22)).toEqual({ standardScore: 56.3, percentile: 35.6, estimatedStandardScore: true, estimatedPercentile: true });
    expect(getScoreConversion('2027', 'verbal', 30)).toMatchObject({ standardScore: 71.5, percentile: 100 });
    expect(getScoreConversion('2027', 'reasoning', 40)).toMatchObject({ standardScore: 93.6, percentile: 100 });
    expect(getExamTypeLabel('2026', 'even')).toBe('짝수형');
  });
});
