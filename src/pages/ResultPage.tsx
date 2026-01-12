import { useLocation, useNavigate } from 'react-router-dom';
import { GradingResult } from '../App';
import { ResultPanel } from '../components/ResultPanel';
import { AnswerSheetResult } from '../components/AnswerSheetResult';
import { ArrowLeft, Home } from 'lucide-react';

interface ResultWithAnswers extends GradingResult {
  correctAnswers?: Record<number, number>;
}

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const results = location.state?.results as GradingResult[] | undefined;
  const singleResult = location.state?.result as GradingResult | undefined;

  // 이전 버전과의 호환성을 위해 단일 결과도 처리
  const finalResults = results || (singleResult ? [singleResult] : undefined);

  if (!finalResults || finalResults.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">결과를 찾을 수 없습니다</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 종합 점수 계산
  const hasMultipleSubjects = finalResults.length > 1;
  const totalStandardScore = hasMultipleSubjects 
    ? finalResults.reduce((sum, r) => sum + r.standardScore, 0)
    : null;
  const totalAdjustedScore = hasMultipleSubjects
    ? finalResults.reduce((sum, r) => sum + (r.adjustedScore || r.standardScore), 0)
    : null;
  const avgPercentile = hasMultipleSubjects
    ? Math.round(finalResults.reduce((sum, r) => sum + r.percentile, 0) / finalResults.length)
    : null;
  
  // 2020년 이전 시험 여부 확인
  const yearNum = finalResults[0].year === '09예비' ? 2009 : parseInt(finalResults[0].year);
  const isPre2020 = yearNum < 2020;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">채점 결과</h1>
              <p className="text-sm text-gray-600 mt-1">
                {finalResults[0].year}학년도 - {finalResults[0].examType === 'odd' ? '홀수형' : '짝수형'}
                {hasMultipleSubjects && ' (언어이해 + 추리논증)'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">히스토리</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 종합 점수 (두 과목 모두 채점한 경우) */}
        {hasMultipleSubjects && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">종합 점수</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                <div className="text-sm opacity-90 mb-1">표준점수 합산</div>
                <div className="text-3xl font-bold">{totalStandardScore?.toFixed(1)}</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                <div className="text-sm opacity-90 mb-1">백분위 평균</div>
                <div className="text-3xl font-bold">{avgPercentile}</div>
              </div>
            </div>
            <p className="text-xs mt-4 opacity-80">
              * 표준점수는 두 과목의 합계, 백분위는 평균값입니다.
            </p>
          </div>
        )}

        {/* 각 과목별 결과 */}
        {finalResults.map((result, index) => (
          <div key={index}>
            <ResultPanel result={result} />

            <div className="mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {result.subject === 'verbal' ? '언어이해' : '추리논증'} - 입력한 답안
              </h3>
              <AnswerSheetResult
                total={result.total}
                userAnswers={result.userAnswers}
                correctAnswers={result.correctAnswers}
              />
            </div>
          </div>
        ))}

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            새로운 시험 채점하기
          </button>
          <button
            onClick={() => navigate('/history')}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            전체 히스토리 보기
          </button>
        </div>
      </main>
    </div>
  );
}