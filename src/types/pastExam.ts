import type { ExamType, Subject, Year } from '../App';

export interface PastExamDocument {
  year: Year;
  subject: Subject;
  examType: ExamType | 'single';
  format: 'pdf';
  title: string;
  url: string;
  fileName: string;
  sizeLabel?: string;
}
