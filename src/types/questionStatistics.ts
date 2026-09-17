export type StatisticsSubject = 'verbal' | 'reasoning';
export type StatisticsExamType = 'odd' | 'even';
export const AGGREGATION_VERSION = 'all_saved_records_v1' as const;

export interface ExamStatisticsSelection {
  year: string;
  subject: StatisticsSubject;
  examType: StatisticsExamType;
}

export interface QuestionDistribution {
  question_no: number;
  choice_counts: [number, number, number, number, number];
  unanswered_count: number;
}

export interface StatisticsCohort {
  year: string;
  subject: StatisticsSubject;
  exam_type: StatisticsExamType;
  answer_key_version: string;
  question_count: number;
  sample_count: number;
  items: QuestionDistribution[];
}

export interface StatisticsSnapshot extends StatisticsCohort {
  snapshot_id: string;
  aggregation_version: typeof AGGREGATION_VERSION;
  source_snapshot_at: string;
  published_at: string;
}

export type StatisticsState =
  | { status: 'loading' | 'unavailable' | 'error' | 'mismatch'; data?: never }
  | { status: 'ready'; data: StatisticsSnapshot };
