// 빌드 시에만 Vite SSR로 읽는 진입점이며 브라우저에 배포하지 않는다.
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { AuthContext } from './contexts/AuthContext';
import { AppContent } from './App';

const unavailable = async (): Promise<never> => { throw new Error('사전 렌더링에서는 인증·데이터 변경을 실행할 수 없습니다.'); };
const publicAuth = {
  currentUser: null, loading: false, isAdmin: false, adminLoading: false, adminError: false,
  signup: unavailable, login: unavailable, logout: unavailable,
};

export function renderPublicPage(url: string) {
  return renderToString(
    <StaticRouter location={url}>
      <AuthContext.Provider value={publicAuth}>
        <AppContent />
      </AuthContext.Provider>
    </StaticRouter>,
  );
}
