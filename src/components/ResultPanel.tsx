import { GradingResult } from '../App';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ResultPanelProps {
  result: GradingResult;
}

export function ResultPanel({ result }: ResultPanelProps) {
  const subjectName = result.subject === 'verbal' ? '언어이해' : '추리논증';
  const correctRate = ((result.correct / result.total) * 100).toFixed(1);
  
  // 2020년 이전 시험 여부 확인
  const yearNum = result.year === '09예비' ? 2009 : parseInt(result.year);
  const isPre2020 = yearNum < 2020;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">채점 결과</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-semibold mb-1">과목</div>
            <div className="text-2xl font-bold text-blue-900">{subjectName}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-semibold mb-1">정답 개수</div>
            <div className="text-2xl font-bold text-green-900">
              {result.correct} / {result.total}
            </div>
            <div className="text-sm text-green-700 mt-1">{correctRate}%</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-semibold mb-1">표준점수</div>
            <div className="text-2xl font-bold text-purple-900">
              {result.standardScore}
              {isPre2020 && result.adjustedScore && (
                <span className="text-base text-purple-600 ml-1">
                  (보정 {result.adjustedScore})
                </span>
              )}
            </div>
            {isPre2020 && (
              <div className="text-xs text-purple-700 mt-1">
                2020년 이전 시험
              </div>
            )}
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-semibold mb-1">백분위</div>
            <div className="text-2xl font-bold text-orange-900">{result.percentile}</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-3">분야별 분석</h3>
        <div className="space-y-3">
          {result.fieldAnalysis.map((field, index) => {
            const fieldRate = ((field.correct / field.total) * 100).toFixed(0);
            return (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{field.field}</span>
                  <span className="text-sm text-gray-600">
                    {field.correct} / {field.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all"
                    style={{ width: `${fieldRate}%` }}
                  ></div>
                </div>
                <div className="text-right text-sm text-gray-600 mt-1">{fieldRate}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}