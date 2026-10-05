export type Subject = 'verbal' | 'reasoning';
export type Year = string;
export type ExamType = 'odd' | 'even';

export interface User {
  email: string;
}

export interface GradingResult {
  year: string;
  subject: Subject;
  correct: number;
  total: number;
  standardScore: number;
  percentile: number;
  fieldAnalysis: { field: string; correct: number; total: number; questions: number[] }[];
  timestamp: number;
  groupTimestamp?: number;
  userAnswers?: Record<number, number>;
  correctAnswers?: Record<number, number>;
  round: number;
  examType: ExamType;
  adjustedScore?: number;
}

