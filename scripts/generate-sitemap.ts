import { writeFileSync } from 'node:fs';
import { getPastExamSelection, PAST_EXAM_DOCUMENTS } from '../src/utils/pastExamData';

const origin = 'https://all-leet.vercel.app';
const publicPaths = ['/', '/history', '/mock-history', '/community', '/privacy-policy', '/terms'];

const examPaths = PAST_EXAM_DOCUMENTS.map(document => {
  const type = document.examType === 'single' ? 'odd' : document.examType;
  const params = new URLSearchParams({ year: document.year, subject: document.subject, type });
  const selection = getPastExamSelection(params);
  if (selection.year !== document.year || selection.subject !== document.subject || selection.examType !== type) {
    throw new Error(`기출문제 선택 URL이 문서와 일치하지 않습니다: ${params}`);
  }
  return `/past-exams?${params}`;
});

if (new Set(examPaths).size !== examPaths.length) {
  throw new Error('기출문제 선택 URL이 중복됩니다.');
}

const paths = [publicPaths[0], ...examPaths, ...publicPaths.slice(1)];
const locations = paths.map(path => {
  const url = `${origin}${path}`.replace(/&/g, '&amp;');
  return `  <url><loc>${url}</loc></url>`;
});
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locations.join('\n')}\n</urlset>\n`;
writeFileSync(new URL('../src/public/sitemap.xml', import.meta.url), sitemap);
console.log(`사이트맵 생성 완료: 기출문제 ${examPaths.length}개, 전체 ${paths.length}개 URL`);
