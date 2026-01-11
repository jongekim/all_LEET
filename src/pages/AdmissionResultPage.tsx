import { useLocation, useNavigate } from 'react-router-dom';
import { LawSchoolAnalysis, getSchoolsByChance } from '../utils/lawschool';
import { ArrowLeft, TrendingUp, AlertCircle, XCircle, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AdmissionResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<LawSchoolAnalysis[] | null>(null);
  const [input, setInput] = useState<{ leet: number; gpa: number } | null>(null);

  useEffect(() => {
    // state에서 먼저 가져오기 시도
    const stateAnalyses = location.state?.analyses as LawSchoolAnalysis[] | undefined;
    const stateInput = location.state?.input as { leet: number; gpa: number } | undefined;

    if (stateAnalyses && stateInput) {
      setAnalyses(stateAnalyses);
      setInput(stateInput);
    } else {
      // state가 없으면 sessionStorage에서 가져오기
      const storedAnalyses = sessionStorage.getItem('admissionAnalyses');
      const storedInput = sessionStorage.getItem('admissionInput');

      if (storedAnalyses && storedInput) {
        try {
          setAnalyses(JSON.parse(storedAnalyses));
          setInput(JSON.parse(storedInput));
        } catch (error) {
          console.error('Failed to parse stored data:', error);
          navigate('/admission');
        }
      } else {
        navigate('/admission');
      }
    }
  }, [location.state, navigate]);

  if (!analyses || !input) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">분석 결과를 불러오는 중...</h2>
        </div>
      </div>
    );
  }

  const { moderate, reach, impossible } = getSchoolsByChance(analyses);

  const getChanceColor = (chance: string) => {
    switch (chance) {
      case '적정': return 'text-blue-700 bg-blue-100 border-blue-300';
      case '소신': return 'text-orange-700 bg-orange-100 border-orange-300';
      case '불가': return 'text-red-700 bg-red-100 border-red-300';
      default: return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  const getChanceIcon = (chance: string) => {
    switch (chance) {
      case '적정': return <TrendingUp className="w-5 h-5" />;
      case '소신': return <AlertCircle className="w-5 h-5" />;
      case '불가': return <XCircle className="w-5 h-5" />;
      default: return null;
    }
  };

  const renderSchoolCard = (analysis: LawSchoolAnalysis) => (
    <div
      key={analysis.school.id}
      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-gray-900">{analysis.school.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {analysis.school.region}
            </span>
          </div>
          <div className="text-sm text-gray-600">
            <div>표준: LEET {analysis.school.standardScore.leet} / GPA {analysis.school.standardScore.gpa}</div>
            {/* 추가된 로직에 맞춰 갭 정보 등을 표시하고 싶다면 아래와 같이 활용 가능 */}
            {/* <div>차이: {analysis.gap > 0 ? `+${analysis.gap}` : analysis.gap}점</div> */}
          </div>
        </div>
        <div className={`px-3 py-1 rounded-lg border-2 font-bold flex items-center gap-1 ${getChanceColor(analysis.chance)}`}>
          {getChanceIcon(analysis.chance)}
          {analysis.chance}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">합격 가능성 분석 결과</h1>
              <p className="text-sm text-gray-600 mt-1">
                LEET {input.leet} / GPA {input.gpa}
              </p>
            </div>
            <button
              onClick={() => navigate('/admission')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">다시 분석</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{moderate.length}</div>
            <div className="text-sm text-blue-600 mt-1">적정</div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-orange-700">{reach.length}</div>
            <div className="text-sm text-orange-600 mt-1">소신</div>
          </div>
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-red-700">{impossible.length}</div>
            <div className="text-sm text-red-600 mt-1">불가</div>
          </div>
        </div>

        {/* 적정권 */}
        {moderate.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">적정권 ({moderate.length}개교)</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {moderate.map(renderSchoolCard)}
            </div>
          </div>
        )}

        {/* 소신권 */}
        {reach.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-bold text-gray-900">소신권 ({reach.length}개교)</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {reach.map(renderSchoolCard)}
            </div>
          </div>
        )}

        {/* 불가 - 수정됨: 모든 학교 표시 */}
        {impossible.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">지원 비추천 ({impossible.length}개교)</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {/* slice(0, 4) 제거됨 */}
              {impossible.map(renderSchoolCard)}
            </div>
            {/* '외 N개교' 표시 로직 제거됨 */}
          </div>
        )}

        {/* 안내 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 지원 전략 가이드</h3>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• <strong>적정권:</strong> 적절한 합격 가능성이 있습니다. 메인 지원 대상으로 고려하세요.</li>
            <li>• <strong>소신권:</strong> 도전적 지원입니다. 상향 지원으로 고려해보세요.</li>
            <li>• <strong>불가:</strong> 현재 점수로는 합격이 어렵습니다. 점수 향상이 필요합니다.</li>
          </ul>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/admission')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            다른 점수로 다시 분석하기
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </main>
    </div>
  );
}