import { PAST_EXAM_DOCUMENTS, getPastExamSelection } from '../src/utils/pastExamData';
import { PUBLIC_STATIC_PATHS } from '../src/utils/pageSeo';

interface QueryCondition { type: 'query'; key: string; value: string }
export interface Rewrite { source: string; destination: string; has?: QueryCondition[]; missing?: QueryCondition[] }

export function examOutputPath(year: string, subject: string, type: string) {
  return `/prerender/past-exams/${year === '09예비' ? '09-preliminary' : year}-${subject}-${type}.html`;
}

export function getPrerenderPages() {
  return [
    ...PUBLIC_STATIC_PATHS.map(url => ({ url, output: url === '/' ? '/index.html' : `/prerender${url}.html` })),
    ...PAST_EXAM_DOCUMENTS.map(document => {
      const type = document.examType === 'single' ? 'odd' : document.examType;
      return {
        url: `/past-exams?${new URLSearchParams({ year: document.year, subject: document.subject, type })}`,
        output: examOutputPath(document.year, document.subject, type),
      };
    }),
  ];
}

export function getPrerenderRewrites(): Rewrite[] {
  const exams = PAST_EXAM_DOCUMENTS.map(document => {
    const type = document.examType === 'single' ? 'odd' : document.examType;
    const has: QueryCondition[] = [{ type: 'query', key: 'year', value: document.year }];
    const missing: QueryCondition[] = [];
    (document.subject === 'reasoning' ? has : missing).push({ type: 'query', key: 'subject', value: 'reasoning' });
    if (document.examType !== 'single') (type === 'even' ? has : missing).push({ type: 'query', key: 'type', value: 'even' });
    return { source: '/past-exams', destination: examOutputPath(document.year, document.subject, type), has, ...(missing.length ? { missing } : {}) };
  });
  // 유효하지 않거나 생략된 학년도는 클라이언트와 동일하게 최신 학년도로 보정한다.
  const defaults = PAST_EXAM_DOCUMENTS.filter(document => document.year === getPastExamSelection(new URLSearchParams()).year).map(document => {
    const type = document.examType === 'single' ? 'odd' : document.examType;
    const has: QueryCondition[] = [];
    const missing: QueryCondition[] = [];
    (document.subject === 'reasoning' ? has : missing).push({ type: 'query', key: 'subject', value: 'reasoning' });
    if (document.examType !== 'single') (type === 'even' ? has : missing).push({ type: 'query', key: 'type', value: 'even' });
    return { source: '/past-exams', destination: examOutputPath(document.year, document.subject, type), ...(has.length ? { has } : {}), ...(missing.length ? { missing } : {}) };
  });
  return [
    ...PUBLIC_STATIC_PATHS.filter(path => path !== '/').map(path => ({ source: path, destination: `/prerender${path}.html` })),
    ...exams, ...defaults,
  ];
}
