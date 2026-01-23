import type { ExamType, GradingResult } from '../App';
import type { MockExamRecord } from '../types/mockExam';

const now = Date.now();

// 작은 샘플만 번들에 포함합니다(용량/초기 로딩 영향 최소화).
// 실제 사용자 데이터가 없을 때만 “미리보기” 용도로 사용됩니다.

function buildOfficialGroup(params: {
  year: string;
  groupTimestamp: number;
  round: number;
  examType?: ExamType;
  verbal: { correct: number; total: number; standardScore: number; percentile: number };
  reasoning: { correct: number; total: number; standardScore: number; percentile: number };
  adjusted?: { verbal?: number; reasoning?: number };
}): GradingResult[] {
  const { year, groupTimestamp, round, verbal, reasoning, adjusted, examType = 'odd' } = params;

  const verbalRecord: GradingResult = {
    year,
    subject: 'verbal',
    correct: verbal.correct,
    total: verbal.total,
    standardScore: verbal.standardScore,
    adjustedScore: adjusted?.verbal,
    percentile: verbal.percentile,
    fieldAnalysis: [
      { field: '사회', correct: Math.max(0, Math.min(13, Math.floor(verbal.correct * 0.4))), total: 13, questions: [1, 2, 3, 4, 5] },
      { field: '인문', correct: Math.max(0, Math.min(10, Math.floor(verbal.correct * 0.3))), total: 10, questions: [6, 7, 8, 9, 10] },
      { field: '규범', correct: Math.max(0, Math.min(12, verbal.correct - Math.floor(verbal.correct * 0.4) - Math.floor(verbal.correct * 0.3))), total: 12, questions: [11, 12, 13, 14, 15] },
    ],
    groupTimestamp,
    timestamp: groupTimestamp + 10,
    round,
    examType,
  };

  const reasoningRecord: GradingResult = {
    year,
    subject: 'reasoning',
    correct: reasoning.correct,
    total: reasoning.total,
    standardScore: reasoning.standardScore,
    adjustedScore: adjusted?.reasoning,
    percentile: reasoning.percentile,
    fieldAnalysis: [
      { field: '논증', correct: Math.max(0, Math.min(20, Math.floor(reasoning.correct * 0.5))), total: 20, questions: [1, 2, 3, 4, 5] },
      { field: '추론', correct: Math.max(0, Math.min(20, reasoning.correct - Math.floor(reasoning.correct * 0.5))), total: 20, questions: [6, 7, 8, 9, 10] },
    ],
    groupTimestamp,
    timestamp: groupTimestamp + 500,
    round,
    examType,
  };

  return [verbalRecord, reasoningRecord];
}

// 기출: “카드(회차) 10개”가 보이도록, 10개 그룹(각 그룹은 2과목=2레코드)
export const EXAMPLE_OFFICIAL_HISTORY: GradingResult[] = [
  ...buildOfficialGroup({
    year: '2018',
    round: 1,
    examType: 'even',
    // 채점일시는 “언제 풀었는지”이므로 학년도와 독립(정렬 차이 체험용)
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 75,
    verbal: { correct: 18, total: 35, standardScore: 40.8, percentile: 18.7 },
    reasoning: { correct: 19, total: 40, standardScore: 42.1, percentile: 22.4 },
    // 2020년 이전 보정값(언어×0.9, 추리×1.2) 체험용
    adjusted: { verbal: 36.7, reasoning: 50.5 },
  }),
  ...buildOfficialGroup({
    year: '2019',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 21,
    verbal: { correct: 20, total: 35, standardScore: 45.3, percentile: 33.5 },
    reasoning: { correct: 21, total: 40, standardScore: 47.2, percentile: 36.9 },
    adjusted: { verbal: 40.8, reasoning: 56.6 },
  }),
  ...buildOfficialGroup({
    year: '2020',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 150,
    verbal: { correct: 22, total: 35, standardScore: 50.1, percentile: 48.6 },
    reasoning: { correct: 23, total: 40, standardScore: 51.4, percentile: 52.2 },
  }),
  ...buildOfficialGroup({
    year: '2021',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 120,
    verbal: { correct: 23, total: 35, standardScore: 53.2, percentile: 59.1 },
    reasoning: { correct: 24, total: 40, standardScore: 54.0, percentile: 61.7 },
  }),
  ...buildOfficialGroup({
    year: '2022',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 95,
    verbal: { correct: 24, total: 35, standardScore: 56.1, percentile: 66.8 },
    reasoning: { correct: 26, total: 40, standardScore: 58.6, percentile: 72.5 },
  }),
  ...buildOfficialGroup({
    year: '2023',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 60,
    verbal: { correct: 24, total: 35, standardScore: 57.5, percentile: 70.2 },
    reasoning: { correct: 27, total: 40, standardScore: 60.2, percentile: 76.1 },
  }),
  ...buildOfficialGroup({
    year: '2024',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 42,
    verbal: { correct: 23, total: 35, standardScore: 54.2, percentile: 62.5 },
    reasoning: { correct: 24, total: 40, standardScore: 56.8, percentile: 68.3 },
  }),
  ...buildOfficialGroup({
    year: '2025',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 28,
    verbal: { correct: 25, total: 35, standardScore: 59.4, percentile: 74.6 },
    reasoning: { correct: 27, total: 40, standardScore: 62.1, percentile: 80.2 },
  }),
  ...buildOfficialGroup({
    year: '2025',
    round: 2,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 14,
    verbal: { correct: 27, total: 35, standardScore: 63.1, percentile: 81.2 },
    reasoning: { correct: 29, total: 40, standardScore: 66.4, percentile: 85.9 },
  }),
  ...buildOfficialGroup({
    year: '2026',
    round: 1,
    groupTimestamp: now - 1000 * 60 * 60 * 24 * 7,
    verbal: { correct: 28, total: 35, standardScore: 66.8, percentile: 87.4 },
    reasoning: { correct: 30, total: 40, standardScore: 69.2, percentile: 90.8 },
  }),
];

export const EXAMPLE_MOCK_HISTORY: MockExamRecord[] = [
  {
    id: 'example-1',
    examDate: '2025-09-08',
    provider: '시대인재',
    round: '1',
    createdAt: now - 1000 * 60 * 60 * 24 * 150,
    verbal: { standardScore: 56.4, percentile: 64.9 },
    reasoning: { standardScore: 55.8, percentile: 63.7 },
  },
  {
    id: 'example-2',
    examDate: '2025-09-29',
    provider: '해커스',
    round: '1',
    createdAt: now - 1000 * 60 * 60 * 24 * 135,
    verbal: { standardScore: 52.9, percentile: 58.6 },
    reasoning: { standardScore: 59.6, percentile: 71.8 },
  },
  {
    id: 'example-3',
    examDate: '2025-10-13',
    provider: '메가로스쿨',
    round: '1',
    createdAt: now - 1000 * 60 * 60 * 24 * 121,
    verbal: { standardScore: 58.7, percentile: 70.9 },
    reasoning: { standardScore: 57.4, percentile: 66.0 },
  },
  {
    id: 'example-4',
    examDate: '2025-10-27',
    provider: '시대인재',
    round: '2',
    createdAt: now - 1000 * 60 * 60 * 24 * 107,
    verbal: { standardScore: 55.1, percentile: 63.4 },
    reasoning: { standardScore: 61.9, percentile: 76.7 },
  },
  {
    id: 'example-5',
    examDate: '2025-11-10',
    provider: '해커스',
    round: '2',
    createdAt: now - 1000 * 60 * 60 * 24 * 93,
    verbal: { standardScore: 60.8, percentile: 78.6 },
    reasoning: { standardScore: 60.1, percentile: 72.9 },
  },
  {
    id: 'example-6',
    examDate: '2025-11-24',
    provider: '메가로스쿨',
    round: '2',
    createdAt: now - 1000 * 60 * 60 * 24 * 79,
    verbal: { standardScore: 57.2, percentile: 68.1 },
    reasoning: { standardScore: 63.8, percentile: 83.4 },
  },
  {
    id: 'example-7',
    examDate: '2025-12-08',
    provider: '시대인재',
    round: '3',
    createdAt: now - 1000 * 60 * 60 * 24 * 65,
    verbal: { standardScore: 62.4, percentile: 83.2 },
    reasoning: { standardScore: 62.0, percentile: 77.6 },
  },
  {
    id: 'example-8',
    examDate: '2025-12-22',
    provider: '해커스',
    round: '3',
    createdAt: now - 1000 * 60 * 60 * 24 * 51,
    verbal: { standardScore: 59.0, percentile: 73.9 },
    reasoning: { standardScore: 65.9, percentile: 87.1 },
  },
  {
    id: 'example-9',
    examDate: '2026-01-05',
    provider: '메가로스쿨',
    round: '3',
    createdAt: now - 1000 * 60 * 60 * 24 * 37,
    verbal: { standardScore: 63.6, percentile: 86.0 },
    reasoning: { standardScore: 63.5, percentile: 80.4 },
  },
  {
    id: 'example-10',
    examDate: '2026-01-19',
    provider: '시대인재',
    round: '4',
    createdAt: now - 1000 * 60 * 60 * 24 * 23,
    verbal: { standardScore: 61.2, percentile: 80.1 },
    reasoning: { standardScore: 67.3, percentile: 90.8 },
  },
];
