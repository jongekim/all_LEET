export interface ExamSchedule {
  key: 'leet';
  exam_date: string;
  display_template: string;
  revision: number;
  updated_at: string;
}

export type ExamScheduleForm = Pick<ExamSchedule, 'exam_date' | 'display_template'>;
