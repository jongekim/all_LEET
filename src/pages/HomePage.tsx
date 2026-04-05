import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { YearSelector } from '../components/YearSelector';
import { NoticeBanner } from '../components/NoticeBanner';
import { AnswerSheet } from '../components/AnswerSheet';
import { getQuestionCount, gradeAnswers } from '../utils/grading';
import { calculateDday, getDdayText } from '../utils/dday';
import { Subject, Year, User, GradingResult, ExamType } from '../App';
import { LogOut, History, BookOpen, Brain, Calendar, GraduationCap, LogIn, HelpCircle, X, Mail, MessagesSquare, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';

interface HomePageProps {
  user: User;
  onLogout: () => void;
  onAddToHistory: (result: GradingResult) => Promise<void>;
}

export function HomePage({ user, onLogout, onAddToHistory }: HomePageProps) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [selectedYear, setSelectedYear] = useState<Year>('2026');
  const [examType, setExamType] = useState<ExamType>('odd');
  const [verbalAnswers, setVerbalAnswers] = useState<Record<number, number>>({});
  const [reasoningAnswers, setReasoningAnswers] = useState<Record<number, number>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  const verbalQuestionCount = getQuestionCount(selectedYear, 'verbal');
  const reasoningQuestionCount = getQuestionCount(selectedYear, 'reasoning');
  
  const { dday, examDate } = calculateDday();
  const ddayText = getDdayText();

  const handleYearChange = (year: Year) => {
    setSelectedYear(year);
    setVerbalAnswers({});
    setReasoningAnswers({});
  };

  const handleExamTypeChange = (type: ExamType) => {
    setExamType(type);
    setVerbalAnswers({});
    setReasoningAnswers({});
  };

  const handleVerbalAnswerChange = (questionNumber: number, answer: number) => {
    setVerbalAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleReasoningAnswerChange = (questionNumber: number, answer: number) => {
    setReasoningAnswers(prev => ({
      ...prev,
      [questionNumber]: answer
    }));
  };

  const handleGrade = async () => {
    if (isGrading) return;

    const results: GradingResult[] = [];
    const groupTimestamp = Date.now();
    // 언어이해 답안이 있으면 채점
    const hasVerbalAnswers = Object.keys(verbalAnswers).length > 0;
    if (hasVerbalAnswers) {
      const verbalResult: GradingResult = {
        ...gradeAnswers(selectedYear, 'verbal', verbalAnswers, verbalQuestionCount, examType),
        groupTimestamp,
      };
      results.push(verbalResult);
    }

    // 추리논증 답안이 있으면 채점
    const hasReasoningAnswers = Object.keys(reasoningAnswers).length > 0;
    if (hasReasoningAnswers) {
      const reasoningResult: GradingResult = {
        ...gradeAnswers(selectedYear, 'reasoning', reasoningAnswers, reasoningQuestionCount, examType),
        groupTimestamp,
      };
      results.push(reasoningResult);
    }

    if (results.length === 0) {
      alert('최소 한 과목의 답안을 입력해주세요.');
      return;
    }

    setIsGrading(true);
    try {
      for (const result of results) {
        await onAddToHistory(result);
      }
    } finally {
      setIsGrading(false);
    }

    // 결과 페이지로 이동
    navigate('/result', { state: { results } });
  };

  const handleReset = () => {
    if (window.confirm('모든 답안을 초기화하시겠습니까?')) {
      setVerbalAnswers({});
      setReasoningAnswers({});
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 639px)');
    const update = () => setIsSmallScreen(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                <span className="block sm:inline">리트 채점은 </span>
                <span className="block sm:inline whitespace-nowrap">all LEET</span>
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-red-600" />
                <p className="text-sm font-semibold text-red-600">
                  {ddayText}
                </p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-center gap-3">
              {currentUser ? (
                <>
                  <span className="text-xs sm:text-sm text-gray-600 text-center sm:text-left w-full sm:w-auto">
                    {currentUser?.user_metadata?.name ? `${currentUser.user_metadata.name}님 오늘도 화이팅!` : user.email}
                  </span>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => navigate('/history')}
                      className="gap-2 whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg"
                    >
                      <History className="w-4 h-4" />
                      성적 분석
                    </Button>
                    <button
                      onClick={onLogout}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">로그아웃</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Button
                      onClick={() => navigate('/history')}
                      className="gap-2 whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg"
                      style={
                        !currentUser
                          ? {
                              outline: '3px solid rgba(250, 204, 21, 0.85)',
                              outlineOffset: '3px',
                            }
                          : undefined
                      }
                    >
                      <History className="w-4 h-4" />
                      성적 분석
                    </Button>

                    {!currentUser && (
                      <>
                        {isSmallScreen ? (
                          <div
                            className="pointer-events-none absolute z-50"
                            style={{ bottom: '100%', right: 0, marginBottom: 8, width: 'min(260px, calc(100vw - 32px))' }}
                          >
                            <div className="relative">
                              <div className="bg-gray-50 border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs text-gray-700 animate-slide-up">
                                <span className="font-bold text-gray-900">성적 분석</span> 버튼을 눌러 예시를 먼저 둘러보세요
                              </div>
                              {/* 삼각형 테두리 (회색) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: -7,
                                  right: 15,
                                  width: 0,
                                  height: 0,
                                  borderLeft: '7px solid transparent',
                                  borderRight: '7px solid transparent',
                                  borderTop: '7px solid rgba(229, 231, 235, 1)',
                                }}
                              />
                              {/* 삼각형 본체 (흰색) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: -6,
                                  right: 16,
                                  width: 0,
                                  height: 0,
                                  borderLeft: '6px solid transparent',
                                  borderRight: '6px solid transparent',
                                  borderTop: '6px solid var(--color-gray-50)',
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="pointer-events-none absolute z-50"
                            style={{ top: '50%', right: '100%', marginRight: 10, transform: 'translateY(-50%)', width: 260 }}
                          >
                            <div className="relative">
                              <div className="bg-gray-50 border border-gray-200 shadow-lg rounded-lg px-3 py-2 text-xs text-gray-700 animate-slide-up">
                                <span className="font-bold text-gray-900">성적 분석</span> 버튼을 눌러 예시를 먼저 둘러보세요
                              </div>
                              {/* 삼각형 테두리 (회색) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  right: -7,
                                  transform: 'translateY(-50%)',
                                  width: 0,
                                  height: 0,
                                  borderTop: '7px solid transparent',
                                  borderBottom: '7px solid transparent',
                                  borderLeft: '7px solid rgba(229, 231, 235, 1)',
                                }}
                              />
                              {/* 삼각형 본체 (흰색) */}
                              <div
                                style={{
                                  position: 'absolute',
                                  top: '50%',
                                  right: -6,
                                  transform: 'translateY(-50%)',
                                  width: 0,
                                  height: 0,
                                  borderTop: '6px solid transparent',
                                  borderBottom: '6px solid transparent',
                                  borderLeft: '6px solid var(--color-gray-50)',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    onClick={() => navigate('/login')}
                    className="gap-2 whitespace-nowrap bg-blue-100 text-blue-800 hover:bg-blue-50 shadow-sm hover:shadow-md"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>로그인</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <NoticeBanner />

        {/* 로그인 안내 배너 - 비로그인 시에만 표시 */}
        {!currentUser && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="bg-white/20 backdrop-blur rounded-full p-3 mt-1">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">로그인 없이 채점 가능합니다</h3>
                <p className="text-sm text-blue-100 mb-3">
                  로그인하시면 <strong>채점 기록 저장</strong>, <strong>성적 변화 분석</strong>, <strong>로스쿨 지원 가능성 분석</strong> 기능을 이용하실 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-4 sm:p-5">
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
              wordBreak: 'keep-all',
              overflowWrap: 'normal',
            }}
          >
            <button
              onClick={() => {
                if (currentUser) {
                  navigate('/admission');
                } else {
                  navigate('/signup');
                }
              }}
              className="w-full text-left border rounded-lg p-3 transition-colors"
              style={{
                minHeight: 112,
                borderColor: '#e5e7eb',
                borderTop: '2px solid #a855f7',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-fuchsia-700" />
                <div className="text-sm font-semibold text-gray-900">로스쿨 지원 가능성 분석</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">LEET/GPA/토익 기반 예측</div>
            </button>

            <button
              onClick={() => navigate('/history')}
              className="w-full text-left border rounded-lg p-3 transition-colors"
              style={{
                minHeight: 112,
                borderColor: '#e5e7eb',
                borderTop: '2px solid #3b82f6',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-700" />
                <div className="text-sm font-semibold text-gray-900">성적분석</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">기록/추이 확인</div>
            </button>

            <button
              onClick={() => {
                if (currentUser) {
                  navigate('/mock-input');
                } else {
                  navigate('/signup');
                }
              }}
              className="w-full text-left border rounded-lg p-3 transition-colors"
              style={{
                minHeight: 112,
                borderColor: '#e5e7eb',
                borderTop: '2px solid #4f46e5',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-700" />
                <div className="text-sm font-semibold text-gray-900">사설 입력</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">시험 기록 저장</div>
            </button>

            <button
              onClick={() => navigate('/community')}
              className="w-full text-left border rounded-lg p-3 transition-colors"
              style={{
                minHeight: 112,
                borderColor: '#e5e7eb',
                borderTop: '2px solid #d946ef',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <MessagesSquare className="w-5 h-5 text-fuchsia-700" />
                <div className="text-sm font-semibold text-gray-900">커뮤니티</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">질문/정보 공유</div>
            </button>

            <button
              onClick={() => navigate('/chat')}
              className="w-full text-left border rounded-lg p-3 transition-colors"
              style={{
                minHeight: 112,
                borderColor: '#e5e7eb',
                borderTop: '2px solid #0ea5e9',
                background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
              }}
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-cyan-700" />
                <div className="text-sm font-semibold text-gray-900">채팅</div>
              </div>
              <div className="text-xs text-gray-500 mt-2">실시간 대화</div>
            </button>
          </div>
        </section>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <YearSelector selectedYear={selectedYear} onYearChange={handleYearChange} />
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                시험 유형
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExamTypeChange('odd')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    examType === 'odd'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  홀수형
                </button>
                <button
                  onClick={() => handleExamTypeChange('even')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    examType === 'even'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  짝수형
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            💡 <strong>두 과목을 동시에 채점할 수 있습니다.</strong> 각 과목의 답안을 입력한 후 "채점하기" 버튼을 누르세요. 한 과목만 입력해도 채점 가능합니다.
          </p>
        </div>

        {/* 언어이해 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-blue-600 px-4 sm:px-6 py-3 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">언어이해</h2>
            <span className="text-sm text-blue-100">({verbalQuestionCount}문항)</span>
          </div>
          <div className="p-4 sm:p-6">
            <AnswerSheet
              questionCount={verbalQuestionCount}
              userAnswers={verbalAnswers}
              onAnswerChange={handleVerbalAnswerChange}
              result={null}
            />
          </div>
        </div>

        {/* 추리논증 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-purple-600 px-4 sm:px-6 py-3 flex items-center gap-2">
            <Brain className="w-5 h-5 text-white" />
            <h2 className="text-lg font-bold text-white">추리논증</h2>
            <span className="text-sm text-purple-100">({reasoningQuestionCount}문항)</span>
          </div>
          <div className="p-4 sm:p-6">
            <AnswerSheet
              questionCount={reasoningQuestionCount}
              userAnswers={reasoningAnswers}
              onAnswerChange={handleReasoningAnswerChange}
              result={null}
            />
          </div>
        </div>

        {/* 채점 버튼 */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleGrade}
              disabled={isGrading}
              className={`flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors ${
                isGrading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              채점하기
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              전체 초기화
            </button>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 pb-24 sm:pb-28 text-center space-y-3">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigate('/privacy-policy')}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            개인정보 처리방침
          </button>
          <button
            onClick={() => navigate('/terms')}
            className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
          >
            이용약관
          </button>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          본 사이트의 모든 콘텐츠는 저작권법의 보호를 받으며, 저작자의 사전 동의 없는 무단 복제/복사/배포를 금지합니다. Copyright © all LEET | all_leet@naver.com
        </p>
      </footer>

      {/* 문의하기 버튼 (우하단 고정, 설치 버튼보다 위) */}
      <button
        onClick={() => setShowContactModal(true)}
        className="fixed right-4 sm:right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all z-50"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 156px)' }}
        aria-label="문의하기"
      >
        <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* 문의하기 모달 */}
      {showContactModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowContactModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">문의하기</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-blue-600 rounded-full p-2">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">이메일 문의</p>
                    <a 
                      href="mailto:contact@leetgrading.com" 
                      className="text-blue-600 hover:text-blue-700 font-medium break-all"
                    >
                      all_leet@naver.com
                    </a>
                  </div>
                </div>
              </div>

              <a
                href="https://open.kakao.com/o/swiu47fi"
                target="_blank"
                rel="noreferrer"
                className="block bg-yellow-50 border border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-400 rounded-full p-2">
                    <MessagesSquare className="w-5 h-5 text-yellow-900" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-yellow-900">카톡 문의</p>
                    <p className="text-sm text-yellow-800">오픈채팅으로 바로 문의하기</p>
                  </div>
                </div>
              </a>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">📝 안내사항</h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• 서비스 이용 중 문제가 발생하면 언제든지 문의해주세요</li>
                  <li>• 정답 또는 성적 데이터 관련 문의는 학년도와 과목을 명시해주세요</li>
                  <li>• 기능 개선 제안이나 버그 리포트도 환영합니다</li>
                  <li>• 의견 주신 기능은 빠른 시일 내에 제공 할 수 있도록 노력하겠습니다!</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ 긴급 문의:</strong> 정답 또는 성적 데이터 관련 문제 발생 시 이메일에 [긴급]을 제목에 포함해주세요
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    navigate('/privacy-policy');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  개인정보 처리방침 보기
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    navigate('/terms');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  이용약관 보기
                </button>
              </div>
              <button
                onClick={() => setShowContactModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}