import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { getPageSeo, HOME_DESCRIPTION, HOME_TITLE } from './pageSeo';
import { getPastExamSelection, PAST_EXAM_DOCUMENTS } from './pastExamData';
import { examOutputPath, getAppRewrites, getPrerenderPages, getPrerenderRewrites, type Rewrite } from '../../scripts/prerenderRoutes';
import { APP_STATIC_PATHS, shouldNoindex } from './appRoutes';

function matches(rule: Rewrite, url: URL) {
  return rule.source === url.pathname
    && (rule.has ?? []).every(condition => url.searchParams.get(condition.key) === condition.value)
    && (rule.missing ?? []).every(condition => url.searchParams.get(condition.key) !== condition.value);
}

describe('공개 HTML과 브라우저의 검색 메타데이터·선택 일치', () => {
  test('홈은 채점·문항별 정답률·기출문제를 설명한다', () => {
    expect(getPageSeo('/')).toEqual({ title: HOME_TITLE, description: HOME_DESCRIPTION, canonical: 'https://all-leet.vercel.app/' });
    for (const keyword of ['채점', '문항별 정답률', '기출문제']) expect(HOME_TITLE).toContain(keyword);
  });

  test('모든 등록 기출문제와 생략·잘못된 선택이 동일한 HTML로 라우팅된다', () => {
    const rules = getPrerenderRewrites();
    const queries = PAST_EXAM_DOCUMENTS.flatMap(document => [
      `year=${encodeURIComponent(document.year)}&subject=${document.subject}&type=${document.examType === 'even' ? 'even' : 'odd'}`,
      `campaign=test&type=even&subject=${document.subject}&year=${encodeURIComponent(document.year)}`,
      `year=${encodeURIComponent(document.year)}`, `year=${encodeURIComponent(document.year)}&subject=invalid&type=invalid`,
    ]);
    queries.push('', 'year=invalid&subject=reasoning&type=even', 'subject=reasoning', 'type=even');
    for (const query of queries) {
      const url = new URL(`/past-exams?${query}`, 'https://all-leet.vercel.app');
      const { year, subject, examType } = getPastExamSelection(url.searchParams);
      expect(rules.find(rule => matches(rule, url))?.destination, query).toBe(examOutputPath(year, subject, examType));
      const canonical = new URL(getPageSeo(url.pathname, url.search).canonical);
      expect(canonical.search).toBe(`?${new URLSearchParams({ year, subject, type: examType })}`);
    }
  });

  test('배포 설정에 모든 공개 HTML 경로가 있고 개인 화면에는 SPA fallback을 사용한다', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
    expect(config.rewrites.filter((rule: Rewrite) => rule.destination.startsWith('/prerender/'))).toEqual(getPrerenderRewrites());
    expect(config.rewrites).toEqual(expect.arrayContaining(getAppRewrites()));
    expect(config.rewrites.some((rule: Rewrite) => rule.source === '/(.*)')).toBe(false);
    const appSource = readFileSync('src/App.tsx', 'utf8');
    const paths = [...appSource.matchAll(/path="([^":]+)"/g)].map(match => match[1]);
    expect([...APP_STATIC_PATHS].sort()).toEqual([...new Set(paths)].sort());
    const pages = getPrerenderPages();
    expect(pages.filter(page => page.url.startsWith('/past-exams?'))).toHaveLength(PAST_EXAM_DOCUMENTS.length);
    expect(new Set(pages.map(page => page.output)).size).toBe(pages.length);
    expect(pages.some(page => /login|admin|admission|community/.test(page.url))).toBe(false);
  });

  test('인증·개인·관리·없는 경로만 색인에서 제외한다', () => {
    for (const path of ['/login', '/signup', '/forgot-password', '/reset-password', '/admin', '/admin/analytics', '/result', '/not-found']) expect(shouldNoindex(path)).toBe(true);
    for (const path of ['/', '/past-exams', '/history', '/mock-history', '/community', '/community/public-post', '/terms']) expect(shouldNoindex(path)).toBe(false);
  });
});
