import { getPastExamSelection } from './pastExamData';
import { getExamTypeLabel } from './examType';

export const CANONICAL_ORIGIN = 'https://all-leet.vercel.app';
export const HOME_TITLE = '리트 채점은 all LEET | 문항별 정답률·기출문제';
export const HOME_DESCRIPTION = 'LEET 언어이해·추리논증을 로그인 없이 채점하고 표준점수·백분위를 확인하세요. 문항별 정답률과 선지별 응답 분포, 학년도별 기출문제 PDF·정답표·점수 환산표를 all LEET에서 제공합니다.';

const ROUTE_SEO: Record<string, { title: string; description: string }> = {
  '/': { title: HOME_TITLE, description: HOME_DESCRIPTION },
  '/history': { title: '성적 분석 및 히스토리 | all LEET', description: 'LEET 채점 결과를 기반으로 성적 분석과 히스토리를 확인하세요.' },
  '/mock-history': { title: '사설 모의고사 히스토리 | all LEET', description: '사설 모의고사 기록과 추이를 한눈에 확인하세요.' },
  '/privacy-policy': { title: '개인정보처리방침 | all LEET', description: 'all LEET 개인정보처리방침 안내 페이지입니다.' },
  '/terms': { title: '이용약관 | all LEET', description: 'all LEET 이용약관 안내 페이지입니다.' },
  '/community': { title: '커뮤니티 게시판 | all LEET', description: 'LEET 수험생 커뮤니티 게시판에서 정보를 공유해보세요.' },
};

export const PUBLIC_STATIC_PATHS = ['/', '/history', '/mock-history', '/privacy-policy', '/terms'];

export function getPageSeo(pathname: string, search = '') {
  const path = pathname.replace(/\/$/, '') || '/';
  let seo = ROUTE_SEO[path] ?? (path.startsWith('/community/')
    ? { title: '커뮤니티 게시글 | all LEET', description: 'LEET 수험생 커뮤니티 게시글을 확인하세요.' }
    : ROUTE_SEO['/']);
  let canonical = `${CANONICAL_ORIGIN}${path}`;
  if (path === '/past-exams') {
    const { year, subject, examType } = getPastExamSelection(new URLSearchParams(search));
    const yearLabel = year === '09예비' ? '09학년도 예비시험' : `${year}학년도`;
    const subjectLabel = subject === 'verbal' ? '언어이해' : '추리논증';
    const label = `${yearLabel} ${subjectLabel} ${getExamTypeLabel(year, examType)}`;
    seo = {
      title: `${label} 리트(LEET) 기출문제·정답표 | all LEET`,
      description: `${label} 리트(LEET) 기출문제 PDF와 정답표·점수 환산표를 확인하세요. 공개 통계가 있는 문항은 정답률과 선지별 응답 분포도 제공합니다.`,
    };
    canonical += `?${new URLSearchParams({ year, subject, type: examType })}`;
  }
  return { ...seo, canonical };
}

export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org', '@type': 'WebSite',
  name: 'all LEET', alternateName: ['올리트', 'ALL LEET', '리트 채점은 all LEET'],
  url: `${CANONICAL_ORIGIN}/`, inLanguage: 'ko-KR',
  description: HOME_DESCRIPTION,
};
