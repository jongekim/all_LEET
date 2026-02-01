export type MockExamBaseProvider = '시대인재' | '해커스' | '메가로스쿨' | '프라임';

export const MOCK_EXAM_BASE_PROVIDERS: MockExamBaseProvider[] = [
  '시대인재',
  '해커스',
  '메가로스쿨',
  '프라임',
];

export interface MockExamSubjectScore {
  standardScore: number;
  percentile: number;
}

export interface MockExamRecord {
  id: string;
  examDate: string; // YYYY-MM-DD
  provider: string;
  round?: string;
  createdAt: number; // epoch ms
  verbal?: MockExamSubjectScore | null;
  reasoning?: MockExamSubjectScore | null;
}

export function getMockExamDisplayTitle(record: MockExamRecord): string {
  const parts = [record.provider, record.round ? `${record.round}회` : undefined].filter(Boolean);
  return parts.join(' ');
}
