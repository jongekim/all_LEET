import type { ExamType, Subject, Year } from '../App';

export interface PastExamDocument {
  year: Year;
  subject: Subject;
  examType: ExamType;
  title: string;
  url: string;
  fileName: string;
  sizeLabel?: string;
  sourceUrl?: string;
}
