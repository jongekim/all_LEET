import { createContext } from 'react';
import type { ExamScheduleStore } from '../utils/examScheduleStore';

export const ExamScheduleContext = createContext<ExamScheduleStore | null>(null);
