import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, GraduationCap, Calculator, TrendingUp } from 'lucide-react';
import { analyzeLawSchools } from '../utils/lawschool';

export function AdmissionPage() {
  const navigate = useNavigate();
  const [leet, setLeet] = useState<string>('');
  const [gpa, setGpa] = useState<string>('');

  const handleAnalyze = () => {
    const leetNum = parseFloat(leet);
    const gpaNum = parseFloat(gpa);

    if (!leet || !gpa) {
      alert('모든 점수를 입력해주세요.');
      return;
    }

    if (isNaN(leetNum) || leetNum < 0 || leetNum > 200) {
      alert('LEET 점수는 0-200 사이의 값을 입력해주세요.');
      return;
    }

    if (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 100) {
      alert('학점은 0-100 사이의 값을 입력해주세요.');
      return;
    }

    const analyses = analyzeLawSchools(leetNum, gpaNum);
    
    // sessionStorage에 저장
    sessionStorage.setItem('admissionAnalyses', JSON.stringify(analyses));
    sessionStorage.setItem('admissionInput', JSON.stringify({ leet: leetNum, gpa: gpaNum }));
    
    navigate('/admission-result', { 
      state: { 
        analyses,
        input: { leet: leetNum, gpa: gpaNum }
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">로스쿨 지원 가능성 분석</h1>
              <p className="text-sm text-gray-600 mt-1">나의 점수로 지원 가능한 로스쿨을 확인하세요</p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">홈으로</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <GraduationCap className="w-8 h-8" />
            <h2 className="text-xl font-bold">점수 입력</h2>
          </div>
          <p className="text-sm text-blue-100">
            LEET 점수와 학점(GPA)을 입력하면 25개 로스쿨의 합격 가능성을 분석해드립니다.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* LEET 점수 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              LEET 표준점수 (언어이해 + 추리논증)
            </label>
            <div className="relative">
              <input
                type="number"
                value={leet}
                onChange={(e) => setLeet(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 120"
                min="0"
                max="200"
                step="0.1"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                / 200
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              언어이해와 추리논증 표준점수의 합계를 입력하세요.
            </p>
          </div>

          {/* GPA */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              학점 (100점 만점)
            </label>
            <div className="relative">
              <input
                type="number"
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="예: 95"
                min="0"
                max="100"
                step="0.1"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                / 100
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              100점 만점 기준으로 입력하세요.
            </p>
          </div>

          {/* 분석 버튼 */}
          <button
            onClick={handleAnalyze}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            합격 가능성 분석하기
          </button>
        </div>

        {/* 안내 사항 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">📌 안내사항</h3>
          <ul className="text-xs text-yellow-800 space-y-1">
            <li>• 본 서비스는 표준점수와 GPA만을 반영합니다. 백분위 반영 대학, 환산식이 복잡한 대학, 정성요소의 영향이 큰 대학에서는 결과가 다를 수 있습니다.</li>
            <li>• 분석 결과는 최근 입시 데이터를 기반으로 한 예측이며, 실제 합격을 보장하지 않습니다.</li>
            <li>• 본 서비스는 간단히 본인의 위치를 파악할 수 있도록 제공해주는 서비스 입니다. 단순 참고 또는 동기 부여 용도로만 활용하시길 바랍니다.</li>
            <li>• 각 로스쿨의 커트라인은 매년 변동될 수 있습니다.</li>
            <li>• 로스쿨 입시는 정성 요소 등 여러 요인에 의해 크게 영향 받습니다. 본 내용은 단순 참고용으로만 사용하시기 바랍니다.</li>
            <li>• 본 서비스는 표준점수와 GPA를 반영하여 제공합니다. 백분위나 기타 환산식의 영향이 있으므로 자세한 내용은 각 학교의 모집 요강을 확인하시기 바랍니다.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}