import { ANSWER_DATA, getCorrectAnswers } from './answerData';
import { getQuestionCount } from './grading';
import { AGGREGATION_VERSION, type ExamStatisticsSelection, type StatisticsCohort, type StatisticsSnapshot } from '../types/questionStatistics';

export function answerKeyVersion(selection: ExamStatisticsSelection): string {
  const answers = getCorrectAnswers(selection.year, selection.subject, selection.examType);
  const total = getQuestionCount(selection.year, selection.subject);
  const keys = Array.from({ length: total }, (_, i) => answers[i + 1]);
  if (keys.some(answer => !Number.isInteger(answer) || answer < 1 || answer > 5)) throw new Error('등록된 정답이 올바르지 않습니다.');
  return `v1:${keys.join('')}`;
}

export function statisticsCatalog() {
  return Object.keys(ANSWER_DATA).sort().flatMap(year =>
    (['verbal', 'reasoning'] as const).flatMap(subject =>
      (['odd', 'even'] as const).map(examType => {
        const selection = { year, subject, examType };
        const answers = getCorrectAnswers(year, subject, examType);
        const question_count = getQuestionCount(year, subject);
        return {
          year, subject, exam_type: examType, question_count,
          answer_key_version: answerKeyVersion(selection),
          correct_answers: Array.from({ length: question_count }, (_, i) => answers[i + 1]),
        };
      })));
}

export function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('집계 응답 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
}

export function countValue(value: unknown): number {
  // PostgREST bigint는 SELECT에서 ::text로 수신한다. JSON 분포 값도 안전 정수만 허용한다.
  if (typeof value === 'string' && !/^\d+$/.test(value)) throw new Error('잘못된 집계 건수입니다.');
  const count = typeof value === 'string' ? Number(value) : value;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('집계 건수는 안전한 0 이상 정수여야 합니다.');
  return count;
}

export function validateCohort(value: unknown): StatisticsCohort {
  const row = objectValue(value);
  if (typeof row.year !== 'string' || !Object.prototype.hasOwnProperty.call(ANSWER_DATA, row.year)
      || (row.subject !== 'verbal' && row.subject !== 'reasoning')
      || (row.exam_type !== 'odd' && row.exam_type !== 'even')) throw new Error('지원하지 않는 집계 조합입니다.');
  const selection: ExamStatisticsSelection = { year: row.year, subject: row.subject, examType: row.exam_type };
  const total = getQuestionCount(selection.year, selection.subject);
  if (row.question_count !== total || typeof row.answer_key_version !== 'string') throw new Error('집계 문항 수/정답 버전이 올바르지 않습니다.');
  const n = countValue(row.sample_count);
  if (!Array.isArray(row.items) || row.items.length !== total) throw new Error('집계 문항이 누락되었습니다.');
  const items = row.items.map((value, index) => {
    const item = objectValue(value);
    if (item.question_no !== index + 1 || !Array.isArray(item.choice_counts) || item.choice_counts.length !== 5) throw new Error('문항 번호/선지 분포가 올바르지 않습니다.');
    const choices = item.choice_counts.map(countValue) as [number, number, number, number, number];
    const unanswered = countValue(item.unanswered_count);
    if (choices.reduce((sum, count) => sum + count, 0) + unanswered !== n) throw new Error('선지와 미응답의 합계가 전체 기록 수와 다릅니다.');
    return { question_no: index + 1, choice_counts: choices, unanswered_count: unanswered };
  });
  return { year: selection.year, subject: selection.subject, exam_type: selection.examType,
    question_count: total, answer_key_version: row.answer_key_version, sample_count: n, items };
}

export function validateSnapshot(value: unknown): StatisticsSnapshot {
  const row = objectValue(value);
  const cohort = validateCohort(row);
  if (typeof row.snapshot_id !== 'string' || !/^[1-9]\d*$/.test(row.snapshot_id)
      || row.aggregation_version !== AGGREGATION_VERSION
      || typeof row.source_snapshot_at !== 'string' || !Number.isFinite(Date.parse(row.source_snapshot_at))
      || typeof row.published_at !== 'string' || !Number.isFinite(Date.parse(row.published_at))) throw new Error('스냅샷 메타데이터가 올바르지 않습니다.');
  return { ...cohort, snapshot_id: row.snapshot_id, aggregation_version: AGGREGATION_VERSION,
    source_snapshot_at: row.source_snapshot_at, published_at: row.published_at };
}

export function formatRate(count: number, total: number): string {
  return total === 0 ? '—' : `${(100 * count / total).toFixed(1)}%`;
}

export function hasMatchingAnswers(selection: ExamStatisticsSelection, answers: Record<number, number> | undefined): boolean {
  if (!answers) return false;
  const current = getCorrectAnswers(selection.year, selection.subject, selection.examType);
  return Array.from({ length: getQuestionCount(selection.year, selection.subject) }, (_, i) => i + 1)
    .every(question => current[question] === answers[question]);
}
