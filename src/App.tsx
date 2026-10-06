import { useEffect, useLayoutEffect } from 'react';
import { useUserHistory } from './hooks/useUserHistory';
import { useUsageTracking } from './hooks/useUsageTracking';
import { useServiceActivity } from './hooks/useServiceActivity';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { HomePage } from './pages/HomePage';
import { PastExamsPage } from './pages/PastExamsPage';
import { ChatPage } from './pages/ChatPage';
import { ResultPage } from './pages/ResultPage';
import { HistoryPage } from './pages/HistoryPage';
import { AdmissionPage } from './pages/AdmissionPage';
import { AdmissionResultPage } from './pages/AdmissionResultPage';
import { MockExamInputPage } from './pages/MockExamInputPage';
import { CommunityPage } from './pages/CommunityPage';
import { CommunityPostPage } from './pages/CommunityPostPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';
import { AdminAnnouncementsPage } from './pages/AdminAnnouncementsPage';
import { AdminPage } from './pages/AdminPage';
import { AdminDdayPage } from './pages/AdminDdayPage';
import { ExamScheduleProvider } from './contexts/ExamScheduleContext';
import { AdminAnalyticsPage } from './pages/AdminAnalyticsPage';
import { AdminUserDataPage } from './pages/AdminUserDataPage';
import { PWAInstallButton } from './components/PWAInstallButton';
import { GlobalBottomNav } from './components/GlobalBottomNav';
import { getPageSeo, WEBSITE_SCHEMA } from './utils/pageSeo';
import { Analytics } from "@vercel/analytics/react"

// --- 타입 정의 ---
export type Subject = 'verbal' | 'reasoning';
export type Year = string;
export type ExamType = 'odd' | 'even';

export interface User {
  email: string;
}

export interface GradingResult {
  year: string;
  subject: Subject;
  correct: number;
  total: number;
  standardScore: number;
  percentile: number;
  fieldAnalysis: { field: string; correct: number; total: number; questions: number[] }[];
  timestamp: number;
  groupTimestamp?: number;
  userAnswers?: Record<number, number>;
  correctAnswers?: Record<number, number>;
  round: number;
  examType: ExamType;
  adjustedScore?: number;
}

// --- 인증 보호 라우트 ---
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isAdmin, adminLoading, adminError } = useAuth();

  if (!currentUser) return <Navigate to="/login" replace />;
  if (adminLoading) return <p role="status" className="p-6">관리자 권한을 확인하고 있습니다.</p>;
  if (adminError) return <p role="alert" className="p-6">관리자 권한을 확인하지 못했습니다. 새로고침 후 다시 시도해주세요.</p>;
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export function AppContent() {
  useUsageTracking();
  useServiceActivity();
  useLayoutEffect(() => {
    // 인증 초기화가 끝나 실제 화면이 준비된 뒤 정적 화면을 교체한다.
    document.getElementById('root')?.setAttribute('data-app-ready', 'true');
    document.getElementById('prerender-shell')?.remove();
  }, []);
  const location = useLocation();
  const { currentUser, logout } = useAuth();
  const userHistory = useUserHistory(currentUser?.id ?? null);
  const { history, mockHistory } = userHistory;
  // ----------------------------------------------------------------
  // ✅ PWA 필수 설정 주입 (index.html이 없는 환경 대응)
  // ----------------------------------------------------------------
  useEffect(() => {
    // 1. Manifest 연결 (안드로이드 설치 필수)
    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement;
    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/manifest.json';
      document.head.appendChild(manifestLink);
    }

    // 2. 테마 컬러 설정 (브라우저 상단바 색상)
    let themeMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      themeMeta.content = '#2563eb';
      document.head.appendChild(themeMeta);
    }

    // 3. 뷰포트 설정 (모바일 확대/축소 방지 및 최적화)
    let viewportMeta = document.querySelector("meta[name='viewport']") as HTMLMetaElement;
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      document.head.appendChild(viewportMeta);
    }

    // 4. 아이콘 설정 (iOS 및 즐겨찾기용)
    let iconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.rel = 'apple-touch-icon';
      iconLink.href = '/icon.svg';
      document.head.appendChild(iconLink);
    }
    
    // 5. 기본 파비콘
    let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      faviconLink.type = 'image/svg+xml';
      faviconLink.href = '/icon.svg';
      document.head.appendChild(faviconLink);
    }

    // 6. 구조화데이터(WebSite) 설정
    const ldJsonId = 'ldjson-website';
    let ldJsonScript = document.getElementById(ldJsonId) as HTMLScriptElement | null;
    if (!ldJsonScript) {
      ldJsonScript = document.createElement('script');
      ldJsonScript.id = ldJsonId;
      ldJsonScript.type = 'application/ld+json';
      document.head.appendChild(ldJsonScript);
    }

    ldJsonScript.text = JSON.stringify(WEBSITE_SCHEMA);

  }, []);

  useEffect(() => {
    const seo = getPageSeo(location.pathname, location.search);
    const canonicalUrl = seo.canonical;
    document.title = seo.title;

    const upsertMeta = (selector: string, attrs: Record<string, string>) => {
      let meta = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        Object.entries(attrs).forEach(([key, value]) => meta?.setAttribute(key, value));
        document.head.appendChild(meta);
      }
      if ('content' in attrs) {
        meta.content = attrs.content;
      }
    };

    let canonicalLink = document.head.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    upsertMeta("meta[name='description']", {
      name: 'description',
      content: seo.description,
    });
    upsertMeta("meta[property='og:title']", {
      property: 'og:title',
      content: seo.title,
    });
    upsertMeta("meta[property='og:description']", {
      property: 'og:description',
      content: seo.description,
    });
    upsertMeta("meta[property='og:url']", {
      property: 'og:url',
      content: canonicalUrl,
    });
    upsertMeta("meta[name='twitter:title']", {
      name: 'twitter:title',
      content: seo.title,
    });
    upsertMeta("meta[name='twitter:description']", {
      name: 'twitter:description',
      content: seo.description,
    });
  }, [location.pathname, location.search]);

  // ----------------------------------------------------------------
  // 이력 인증·조회·변경은 사용자별 hook에서 관리한다.
  // ----------------------------------------------------------------
  const handleLogout = async () => { await logout(); };

  const user: User = currentUser ? { email: currentUser.email || '' } : { email: '' };

  // ----------------------------------------------------------------
  // 라우팅 렌더링
  // ----------------------------------------------------------------
  return (
    <>
      <div style={{ paddingBottom: location.pathname.startsWith('/admin') ? 0 : '96px' }}>
        <Routes>
          {/* 인증 불필요 페이지 */}
          <Route path="/login" element={currentUser ? <Navigate to="/" /> : <LoginPage />} />
          <Route path="/signup" element={currentUser ? <Navigate to="/" /> : <SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/admin" element={<PrivateRoute><AdminRoute><AdminPage /></AdminRoute></PrivateRoute>} />
          <Route path="/admin/user-data" element={<PrivateRoute><AdminRoute><AdminUserDataPage key={currentUser?.id} /></AdminRoute></PrivateRoute>} />
          <Route path="/admin/analytics" element={<PrivateRoute><AdminRoute><AdminAnalyticsPage /></AdminRoute></PrivateRoute>} />
          <Route path="/admin/dday" element={<AdminRoute><AdminDdayPage key={currentUser?.id} /></AdminRoute>} />
          <Route
            path="/admin/announcements"
            element={
              <AdminRoute>
                <AdminAnnouncementsPage />
              </AdminRoute>
            }
          />
          
          {/* 메인 페이지 (로그인 상태에 따라 다르게 보일 수 있음) */}
          <Route
            path="/"
            element={<HomePage user={user} onLogout={handleLogout} onAddToHistory={userHistory.addOfficial} />}
          />

          <Route path="/community" element={<CommunityPage />} />
          <Route path="/past-exams" element={<PastExamsPage />} />
          <Route path="/community/:id" element={<CommunityPostPage />} />

          <Route path="/chat" element={<ChatPage />} />
          <Route
            path="/result"
            element={<ResultPage />}
          />

          {/* 인증 필요 페이지 (PrivateRoute) */}
          <Route
            path="/history"
            element={
              <HistoryPage
                history={history}
                loading={userHistory.loading}
                errors={userHistory.errors}
                onRetry={userHistory.reload}
                onClearHistory={userHistory.clearOfficial}
                onDeleteRecord={userHistory.deleteOfficial}
                mockHistory={mockHistory}
                onClearMockHistory={userHistory.clearMock}
                onDeleteMockRecord={userHistory.deleteMock}
              />
            }
          />
          <Route
            path="/admission"
            element={
              <PrivateRoute>
                <AdmissionPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admission-result"
            element={
              <PrivateRoute>
                <AdmissionResultPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/mock-input"
            element={
              <PrivateRoute>
                <MockExamInputPage existingRecords={mockHistory} onAddRecord={userHistory.addMock} />
              </PrivateRoute>
            }
          />
          <Route
            path="/mock-history"
            element={
              <HistoryPage
                history={history}
                loading={userHistory.loading}
                errors={userHistory.errors}
                onRetry={userHistory.reload}
                onClearHistory={userHistory.clearOfficial}
                onDeleteRecord={userHistory.deleteOfficial}
                mockHistory={mockHistory}
                onClearMockHistory={userHistory.clearMock}
                onDeleteMockRecord={userHistory.deleteMock}
              />
            }
          />
        </Routes>
      </div>
      {!location.pathname.startsWith('/admin') && <GlobalBottomNav />}
      {!location.pathname.startsWith('/admin') && <PWAInstallButton />}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ExamScheduleProvider>
          <AppContent />
        </ExamScheduleProvider>
        <Analytics />
      </AuthProvider>
    </Router>
  );
}
