import type { StatisticsCohort, StatisticsSnapshot, QuestionDistribution } from './questionStatistics';
export type LegacyFormStatistics = StatisticsSnapshot;
export const CANONICAL_AGGREGATION_VERSION = 'pooled_saved_answers_v2' as const;
export interface CanonicalQuestionDistribution {
  question_id:string;
  correct_answer:number;
  choice_counts:[number,number,number,number,number];
  unanswered_count:number;
}
export interface CanonicalCohort {
  year:string; subject:'verbal'|'reasoning'; question_count:number; sample_count:number;
  answer_key_version:string; items:CanonicalQuestionDistribution[];
}
export interface CanonicalStatistics extends CanonicalCohort {
  snapshot_id:string; aggregation_version:typeof CANONICAL_AGGREGATION_VERSION;
  catalog_id:string; catalog_sha256:string; mapping_version:string; mapping_sha256:string;
  source_snapshot_at:string; published_at:string;
}
export interface FormStatisticsView extends Omit<StatisticsCohort,'items'>, Omit<CanonicalStatistics,'items'|'answer_key_version'> {
  items:(QuestionDistribution & {question_id:string;correct_answer:number})[];
  canonical_answer_key_version:string;
}
export type CanonicalStatisticsState = {status:'loading'|'unavailable'|'error'|'mismatch';data?:never}|{status:'ready';data:FormStatisticsView};
