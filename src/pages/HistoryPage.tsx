import { useNavigate } from 'react-router-dom';
import { GradingResult } from '../App';
import { TrendChart } from '../components/TrendChart';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface HistoryPageProps {
  history: GradingResult[];
  onClearHistory: () => void;
}

export function HistoryPage({ history, onClearHistory }: HistoryPageProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'date' | 'year'>('date'); // 기본값: 채점 순서

  // timestamp를 기준으로 기록 그룹화 (1초 이내는 같은 그룹으로 간주)
  const groupedHistory: GradingResult[][] = [];
  const processed = new Set<number>();

  history.forEach((record, index) => {
    if (processed.has(index)) return;

    const group: GradingResult[] = [record];
    processed.add(index);

    // 같은 timestamp를 가진 다른 기록 찾기 (1초 이내)
    history.forEach((otherRecord, otherIndex) => {
      if (
        otherIndex !== index &&
        !processed.has(otherIndex) &&
        Math.abs(record.timestamp - otherRecord.timestamp) < 1000
      ) {
        group.push(otherRecord);
        processed.add(otherIndex);
      }
    });

    groupedHistory.push(group);
  });

  // 정렬 함수
  const sortedGroupedHistory = [...groupedHistory].sort((a, b) => {
    if (sortBy === 'date') {
      // 채점 순서 (최신순)
      return b[0].timestamp - a[0].timestamp;
    } else {
      // 연도순 (오래된 순)
      const yearA = a[0].year === '09예비' ? 2009 : parseInt(a[0].year);
      const yearB = b[0].year === '09예비' ? 2009 : parseInt(b[0].year);
      return yearA - yearB;
    }
  });

  if (history.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">채점 히스토리</h1>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">아직 채점한 기록이 없습니다.</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              첫 시험 채점하기
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">all LEET</h1>
              <p className="text-sm text-gray-600 mt-1">총 {history.length}개의 채점 기록</p>
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
                onClick={onClearHistory}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">전체 삭제</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">성적 추이</h2>
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSortBy('date')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortBy === 'date'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                채점순
              </button>
              <button
                onClick={() => setSortBy('year')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  sortBy === 'year'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                학년도순
              </button>
            </div>
          </div>
          <TrendChart history={history} sortBy={sortBy} />
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">상세 기록</h2>
            <div className="text-sm text-gray-500">
              {sortBy === 'date' ? '최신 순' : '오래된 연도 순'}
            </div>
          </div>
          <div className="space-y-3">
            {sortedGroupedHistory.map((group, groupIndex) => {
              const firstRecord = group[0];
              const date = new Date(firstRecord.timestamp).toLocaleDateString('ko-KR');
              const time = new Date(firstRecord.timestamp).toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              const isCombined = group.length > 1;

              // 두 과목 합산 점수 계산 (같이 채점한 경우)
              const totalStandardScore = group.reduce((sum, r) => sum + r.standardScore, 0);
              const avgPercentile = group.reduce((sum, r) => sum + r.percentile, 0) / group.length;

              return (
                <div
                  key={groupIndex}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    {/* 헤더 */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-gray-900">
                          {firstRecord.year}학년도
                          {firstRecord.round > 1 && (
                            <span className="ml-2 text-sm font-semibold text-gray-600">
                              ({firstRecord.round}회독)
                            </span>
                          )}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {firstRecord.examType === 'odd' ? '홀수형' : '짝수형'}
                        </span>
                        {group.map((record, idx) => {
                          const subjectName = record.subject === 'verbal' ? '언어이해' : '추리논증';
                          return (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                record.subject === 'verbal'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}
                            >
                              {subjectName}
                            </span>
                          );
                        })}
                      </div>
                      <div className="text-xs text-gray-600">
                        {date} {time}
                      </div>
                    </div>

                    {/* 각 과목 점수 */}
                    <div className="grid grid-cols-1 gap-2">
                      {group.map((record, idx) => {
                        const subjectName = record.subject === 'verbal' ? '언어이해' : '추리논증';
                        const recordYearNum = record.year === '09예비' ? 2009 : parseInt(record.year);
                        const isPre2020 = recordYearNum < 2020;
                        
                        return (
                          <div key={idx} className="flex items-center justify-between text-sm py-1">
                            <span className="text-gray-700 font-medium">{subjectName}</span>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <span className="text-xs text-gray-500">표준점수 </span>
                                <span className="font-bold text-purple-600">
                                  {record.standardScore}
                                  {isPre2020 && record.adjustedScore && (
                                    <span className="text-xs text-purple-500 ml-1">
                                      (보정 {record.adjustedScore})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="text-center">
                                <span className="text-xs text-gray-500">백분위 </span>
                                <span className="font-bold text-orange-600">{record.percentile}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 합산 점수 및 버튼 */}
                    <div className="pt-2 border-t flex items-center justify-between">
                      {isCombined ? (
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-xs text-gray-500">합산 표준점수 </span>
                            <span className="font-bold text-purple-700 text-base">{totalStandardScore}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">평균 백분위 </span>
                            <span className="font-bold text-orange-700 text-base">{avgPercentile.toFixed(1)}</span>
                          </div>
                        </div>
                      ) : (
                        <div></div>
                      )}
                      <button
                        onClick={() => navigate('/result', { state: isCombined ? { results: group } : { result: firstRecord } })}
                        className="text-sm text-blue-600 hover:text-blue-700 font-semibold whitespace-nowrap"
                      >
                        자세히 보기
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}