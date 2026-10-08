import { getCorrectAnswers } from './answerData.ts';
import { getQuestionCount, gradeAnswers } from './grading.ts';
import { SCORE_DATA } from './scoreData.ts';
import type { GradingResult } from './types.ts';

export function answerEditPatch(original: GradingResult, raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('INVALID_INPUT');
  const answers = raw as Record<string, unknown>;
  if (Object.entries(answers).some(([question, answer]) =>
    !/^[1-9]\d*$/.test(question) || Number(question) > original.total ||
    typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > 5
  )) throw new Error('INVALID_INPUT');
  if (!['verbal', 'reasoning'].includes(original.subject) ||
    !['odd', 'even'].includes(original.examType) ||
    original.total !== getQuestionCount(original.year, original.subject) ||
    !Object.prototype.hasOwnProperty.call(SCORE_DATA, original.year)) {
    throw new Error('CALCULATION_UNAVAILABLE');
  }
  const correctAnswers = getCorrectAnswers(original.year, original.subject, original.examType);
  if (Object.keys(correctAnswers).length !== original.total ||
    (original.correctAnswers && Object.entries(correctAnswers).some(([q, a]) => original.correctAnswers?.[Number(q)] !== a))) {
    throw new Error('CALCULATION_UNAVAILABLE');
  }
  const computed = gradeAnswers(original.year, original.subject, { ...answers } as Record<number, number>, original.total, original.examType);
  if (!SCORE_DATA[original.year]?.[original.subject]?.[computed.correct]) throw new Error('CALCULATION_UNAVAILABLE');
  return {
    userAnswers: computed.userAnswers!, correctAnswers: computed.correctAnswers!,
    correct: computed.correct, standardScore: computed.standardScore, percentile: computed.percentile,
    fieldAnalysis: computed.fieldAnalysis,
    ...(computed.adjustedScore === undefined ? {} : { adjustedScore: computed.adjustedScore }),
  };
}

export function editedResult(original: GradingResult, answers: Record<number, number>): GradingResult {
  const next = { ...original, ...answerEditPatch(original, answers) };
  if (Number(original.year) >= 2020) delete next.adjustedScore;
  return next;
}

export function sameAnswers(a: Record<number, number> | undefined, b: Record<number, number>, total: number) {
  return Array.from({ length: total }, (_, i) => i + 1).every(q => (a?.[q] || 0) === (b[q] || 0));
}
