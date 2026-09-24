import { PAST_EXAM_DOCUMENTS } from '../utils/pastExamData';

export const SITE_ORIGIN = 'https://all-leet.vercel.app';

export interface RouteSeo {
  title: string;
  description: string;
  canonicalPath: string | null;
  indexable: boolean;
}

const searchable: Record<string, RouteSeo> = {
  '/': {
    title: '리트 채점·기출문제 | all LEET',
    description: '리트 답안을 채점하고 학년도별 LEET 기출문제 PDF, 정답표, 문항별 정답률과 점수 환산표를 확인하세요.',
    canonicalPath: '/', indexable: true,
  },
  '/past-exams': {
    title: '리트 기출문제·정답표 | all LEET',
    description: '2009~2027학년도 LEET 언어이해·추리논증 기출문제 PDF, 홀수형·짝수형 정답표와 점수 환산표를 학년도별로 확인하세요.',
    canonicalPath: '/past-exams', indexable: true,
  },
  '/question-rates': {
    title: '리트 문항별 정답률·선지별 응답 분포 | all LEET',
    description: 'LEET 학년도·과목·문형별 문항 정답률과 선지별 선택률을 확인하세요. all LEET 채점 기록을 바탕으로 한 통계입니다.',
    canonicalPath: '/question-rates', indexable: true,
  },
};

const appOnly: Record<string, Pick<RouteSeo, 'title' | 'description'>> = {
  '/history': { title: '성적 분석 및 히스토리 | all LEET', description: '내 LEET 채점 기록과 성적 변화를 확인하세요.' },
  '/mock-history': { title: '사설 모의고사 히스토리 | all LEET', description: '내 사설 모의고사 기록을 확인하세요.' },
  '/community': { title: '커뮤니티 게시판 | all LEET', description: 'LEET 수험생 커뮤니티 게시판입니다.' },
  '/privacy-policy': { title: '개인정보처리방침 | all LEET', description: 'all LEET 개인정보처리방침입니다.' },
  '/terms': { title: '이용약관 | all LEET', description: 'all LEET 이용약관입니다.' },
};

export function getRouteSeo(pathname: string): RouteSeo {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : '/';
  if (searchable[path]) return searchable[path];

  const match = /^\/past-exams\/(\d{4})$/.exec(path);
  if (match && PAST_EXAM_DOCUMENTS.some(document => document.year === match[1])) {
    const year = match[1];
    return {
      title: `${year}학년도 리트 기출문제·정답표 | all LEET`,
      description: `${year}학년도 LEET 언어이해·추리논증 기출문제 PDF와 홀수형·짝수형 정답표를 확인하세요. 문항별 정답률과 점수 환산표로 이어집니다.`,
      canonicalPath: path, indexable: true,
    };
  }

  const details = appOnly[path];
  return {
    title: details?.title ?? 'all LEET',
    description: details?.description ?? '리트 채점 및 기출문제 서비스 all LEET',
    canonicalPath: null,
    indexable: false,
  };
}
