// 공개 HTML 생성 전용 Vite SSR 진입점. 브라우저 번들에는 포함하지 않는다.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AuthContext } from './contexts/AuthContext';
import { AppContent } from './App';
import { ExamScheduleProvider } from './contexts/ExamScheduleContext';
import { PrerenderStatisticsContext } from './contexts/PrerenderStatisticsContext';
import type { CanonicalStatistics } from './types/canonicalStatistics';
import { PublicCommunityContext } from './contexts/PublicCommunityContext';
import type { CommunityPost } from './types/community';

const unavailable = async (): Promise<never> => { throw new Error('사전 렌더링에서는 인증·데이터 변경을 실행할 수 없습니다.'); };
const publicAuth = {
  currentUser: null, loading: false, isAdmin: false, adminLoading: false, adminError: false,
  signup: unavailable, login: unavailable, logout: unavailable,
};

export function renderPublicPage(url: string, statistics: readonly CanonicalStatistics[], community?: { posts: CommunityPost[]; post: CommunityPost | null }) {
  return renderToString(
    <StaticRouter location={url}>
      <AuthContext.Provider value={publicAuth}>
        <PrerenderStatisticsContext.Provider value={statistics}>
          <PublicCommunityContext.Provider value={community}>
            <ExamScheduleProvider><AppContent /></ExamScheduleProvider>
          </PublicCommunityContext.Provider>
        </PrerenderStatisticsContext.Provider>
      </AuthContext.Provider>
    </StaticRouter>,
  );
}
