import { GradingResult } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

interface TrendChartProps {
  history: GradingResult[];
  sortBy: 'date' | 'year';
}

export function TrendChart({ history, sortBy }: TrendChartProps) {
  const [roundFilter, setRoundFilter] = useState<'all' | number>('all');
  const [useAdjustedScore, setUseAdjustedScore] = useState(false); // 보정값 사용 여부

  // 필터링된 히스토리
  const filteredHistory = roundFilter === 'all' 
    ? history 
    : history.filter(h => (h.round || 1) === roundFilter);

  // 존재하는 모든 회독 수 추출
  const allRounds = Array.from(new Set(history.map(h => h.round || 1))).sort((a, b) => a - b);
  
  // 2020년 이전 시험이 있는지 확인
  const hasPre2020 = history.some(h => {
    const yearNum = h.year === '09예비' ? 2009 : parseInt(h.year);
    return yearNum < 2020;
  });

  // Group by year and combine verbal + reasoning
  const yearMap = new Map<string, { verbal?: GradingResult; reasoning?: GradingResult }>();
  
  filteredHistory.forEach(item => {
    if (!yearMap.has(item.year)) {
      yearMap.set(item.year, {});
    }
    const yearData = yearMap.get(item.year)!;
    yearData[item.subject] = item;
  });

  const chartData = Array.from(yearMap.entries()).map(([year, subjects]) => {
    const hasVerbal = !!subjects.verbal;
    const hasReasoning = !!subjects.reasoning;
    const hasBoth = hasVerbal && hasReasoning;

    let standardScore = 0;
    let percentile = 0;
    let correctRate = 0;

    if (hasBoth) {
      // 보정값 사용 여부에 따라 점수 선택
      const verbalScore = useAdjustedScore && subjects.verbal!.adjustedScore 
        ? subjects.verbal!.adjustedScore 
        : subjects.verbal!.standardScore;
      const reasoningScore = useAdjustedScore && subjects.reasoning!.adjustedScore
        ? subjects.reasoning!.adjustedScore
        : subjects.reasoning!.standardScore;
      
      // 표준점수는 합산
      standardScore = verbalScore + reasoningScore;
      // 백분위는 평균
      percentile = Math.round((subjects.verbal!.percentile + subjects.reasoning!.percentile) / 2);
      // 정답률은 평균
      const verbalRate = (subjects.verbal!.correct / subjects.verbal!.total) * 100;
      const reasoningRate = (subjects.reasoning!.correct / subjects.reasoning!.total) * 100;
      correctRate = Math.round((verbalRate + reasoningRate) / 2);
    } else if (hasVerbal) {
      standardScore = useAdjustedScore && subjects.verbal!.adjustedScore
        ? subjects.verbal!.adjustedScore
        : subjects.verbal!.standardScore;
      percentile = subjects.verbal!.percentile;
      correctRate = Math.round((subjects.verbal!.correct / subjects.verbal!.total) * 100);
    } else if (hasReasoning) {
      standardScore = useAdjustedScore && subjects.reasoning!.adjustedScore
        ? subjects.reasoning!.adjustedScore
        : subjects.reasoning!.standardScore;
      percentile = subjects.reasoning!.percentile;
      correctRate = Math.round((subjects.reasoning!.correct / subjects.reasoning!.total) * 100);
    }

    return {
      name: year,
      표준점수: standardScore,
      백분위: percentile,
      정답률: correctRate,
      과목수: (hasVerbal ? 1 : 0) + (hasReasoning ? 1 : 0),
    };
  });

  // 데이터의 최소/최대값 계산
  const standardScores = chartData.map(d => d.표준점수);
  const percentiles = chartData.map(d => d.백분위);
  const correctRates = chartData.map(d => d.정답률);

  const minStandardScore = Math.min(...standardScores);
  const maxStandardScore = Math.max(...standardScores);
  const minPercentile = Math.min(...percentiles);
  const maxPercentile = Math.max(...percentiles);
  const minCorrectRate = Math.min(...correctRates);
  const maxCorrectRate = Math.max(...correctRates);

  // Y축 범위를 데이터 중심으로 설정 (위아래 여유 공간 추가)
  const getYDomain = (min: number, max: number, totalRange: number) => {
    const range = max - min;
    const padding = Math.max(range * 0.3, totalRange * 0.1); // 데이터 범위의 30% 또는 전체 범위의 10% 중 큰 값
    const newMin = Math.max(0, min - padding);
    const newMax = Math.min(totalRange, max + padding);
    return [Math.floor(newMin), Math.ceil(newMax)];
  };

  const standardScoreDomain = getYDomain(minStandardScore, maxStandardScore, 300);
  const percentileDomain = getYDomain(minPercentile, maxPercentile, 100);
  const correctRateDomain = getYDomain(minCorrectRate, maxCorrectRate, 100);

  // 정렬 적용
  const sortedChartData = [...chartData].sort((a, b) => {
    if (sortBy === 'date') {
      // 채점 순서: history에서 해당 연도의 가장 최신 타임스탬프 기준으로 정렬
      const aTimestamp = Math.max(
        ...(history.filter(h => h.year === a.name).map(h => h.timestamp))
      );
      const bTimestamp = Math.max(
        ...(history.filter(h => h.year === b.name).map(h => h.timestamp))
      );
      return bTimestamp - aTimestamp; // 최신순
    } else {
      // 학년도순 (오래된 순)
      const yearA = a.name === '09예비' ? 2009 : parseInt(a.name);
      const yearB = b.name === '09예비' ? 2009 : parseInt(b.name);
      return yearA - yearB;
    }
  });

  return (
    <div className="space-y-6">
      {/* 회독 필터 */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-4">
        <span className="text-sm font-semibold text-gray-700">회독 필터:</span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setRoundFilter('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              roundFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            전체
          </button>
          {allRounds.map(round => (
            <button
              key={round}
              onClick={() => setRoundFilter(round)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                roundFilter === round
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border'
              }`}
            >
              {round}회독
            </button>
          ))}
        </div>
      </div>

      {/* 2020년 이전 시험 보정값 토글 */}
      {hasPre2020 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-900 mb-1">
                2020년 이전 시험 표준점수 보정
              </p>
              <p className="text-xs text-yellow-700">
                2020년 이전 시험은 점수 체계가 달라 보정값을 제공합니다. (언어이해 ×0.9, 추리논증 ×1.2)
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={() => setUseAdjustedScore(false)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  !useAdjustedScore
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                원본값
              </button>
              <button
                onClick={() => setUseAdjustedScore(true)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  useAdjustedScore
                    ? 'bg-yellow-600 text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                보정값
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">📊 점수 계산 방식</p>
        <p>• 표준점수: 언어이해 + 추리논증 <strong>합산</strong></p>
        <p>• 백분위: 언어이해와 추리논증의 <strong>평균</strong></p>
        <p className="mt-2 text-xs text-blue-700">* 같은 연도에 두 과목을 모두 채점하면 종합 점수가 표시됩니다</p>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          표준점수 추이 (합산) {hasPre2020 && useAdjustedScore && <span className="text-sm text-yellow-600">- 보정값 기준</span>}
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortBy === 'date' ? [...sortedChartData].reverse() : sortedChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={standardScoreDomain} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="표준점수" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">백분위 추이 (평균)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortBy === 'date' ? [...sortedChartData].reverse() : sortedChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={percentileDomain} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="백분위" 
              stroke="#f59e0b" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">정답률 추이 (평균)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sortedChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={correctRateDomain} />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="정답률" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}