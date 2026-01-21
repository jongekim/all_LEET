import { GradingResult } from '../App';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMemo, useState } from 'react';

type TooltipPayload = {
  name: string;
  year?: string;
  groupRound?: number;
  언어_표준: number;
  추리_표준: number;
  표준점수: number;
  언어_백분위: number;
  추리_백분위: number;
  평균_백분위: number;
  언어_정답률: number;
  추리_정답률: number;
  평균_정답률: number;
  정답률: number;
};

function formatNumber(value: unknown, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const rounded = Number.isInteger(value) ? value.toString() : value.toFixed(digits);
  return rounded;
}

function StandardScoreTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data: TooltipPayload | undefined = payload?.[0]?.payload;
  if (!data) return null;

  const yearLabel = data.year ?? label;
  const roundLabel = typeof data.groupRound === 'number' && data.groupRound > 1 ? ` (${data.groupRound}회독)` : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-bold text-gray-900 mb-2">{yearLabel}학년도{roundLabel}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">언어이해</span>
          <span className="font-semibold text-blue-700">{formatNumber(data.언어_표준)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">추리논증</span>
          <span className="font-semibold text-purple-700">{formatNumber(data.추리_표준)}</span>
        </div>
        <div className="border-t pt-2 mt-2 flex items-center justify-between gap-6">
          <span className="text-gray-800 font-semibold">합산</span>
          <span className="font-bold text-gray-900">{formatNumber(data.표준점수)}</span>
        </div>
      </div>
    </div>
  );
}

function PercentileTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data: TooltipPayload | undefined = payload?.[0]?.payload;
  if (!data) return null;

  const yearLabel = data.year ?? label;
  const roundLabel = typeof data.groupRound === 'number' && data.groupRound > 1 ? ` (${data.groupRound}회독)` : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-bold text-gray-900 mb-2">{yearLabel}학년도{roundLabel}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">언어이해</span>
          <span className="font-semibold text-amber-700">{formatNumber(data.언어_백분위, 1)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">추리논증</span>
          <span className="font-semibold text-red-700">{formatNumber(data.추리_백분위, 1)}</span>
        </div>
        <div className="border-t pt-2 mt-2 flex items-center justify-between gap-6">
          <span className="text-gray-800 font-semibold">평균</span>
          <span className="font-bold text-gray-900">{formatNumber(data.평균_백분위, 1)}</span>
        </div>
      </div>
    </div>
  );
}

function CorrectRateTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data: TooltipPayload | undefined = payload?.[0]?.payload;
  if (!data) return null;

  const yearLabel = data.year ?? label;
  const roundLabel = typeof data.groupRound === 'number' && data.groupRound > 1 ? ` (${data.groupRound}회독)` : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-bold text-gray-900 mb-2">{yearLabel}학년도{roundLabel}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">언어이해</span>
          <span className="font-semibold text-blue-700">{formatNumber(data.언어_정답률, 1)}%</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-600">추리논증</span>
          <span className="font-semibold text-purple-700">{formatNumber(data.추리_정답률, 1)}%</span>
        </div>
        <div className="border-t pt-2 mt-2 flex items-center justify-between gap-6">
          <span className="text-gray-800 font-semibold">평균</span>
          <span className="font-bold text-gray-900">{formatNumber(data.평균_정답률, 1)}%</span>
        </div>
      </div>
    </div>
  );
}

interface TrendChartProps {
  history: GradingResult[];
  sortBy: 'date' | 'year';
}

type YearGroup = {
  groupTimestamp: number;
  groupRound: number;
  verbal?: GradingResult;
  reasoning?: GradingResult;
};

type ChartDatum = {
  name: string; // X축 라벨(고유)
  year: string;
  yearSort: number;
  groupTimestamp: number;
  groupRound: number;
  표준점수: number;
  언어_표준: number;
  추리_표준: number;
  언어_백분위: number;
  추리_백분위: number;
  평균_백분위: number;
  백분위: number;
  언어_정답률: number;
  추리_정답률: number;
  평균_정답률: number;
  정답률: number;
  과목수: number;
};

function getGroupTime(record: GradingResult) {
  return typeof record.groupTimestamp === 'number' ? record.groupTimestamp : record.timestamp;
}

export function TrendChart({ history, sortBy }: TrendChartProps) {
  const [roundFilter, setRoundFilter] = useState<'all' | number>('all');
  const [useAdjustedScore, setUseAdjustedScore] = useState(false); // 보정값 사용 여부
  // 백분위 기본 표시: 평균만
  const [showVerbalPercentile, setShowVerbalPercentile] = useState(false);
  const [showReasoningPercentile, setShowReasoningPercentile] = useState(false);
  const [showAvgPercentile, setShowAvgPercentile] = useState(true);

  // year + groupTimestamp 단위로 두 과목을 한 세트로 묶고, 세트 순서를 회독으로 계산
  const yearGroups = useMemo(() => {
    const byYear = new Map<string, Map<number, { groupTimestamp: number; verbal?: GradingResult; reasoning?: GradingResult }>>();

    for (const item of history) {
      const year = item.year;
      const t = getGroupTime(item);
      if (!byYear.has(year)) byYear.set(year, new Map());

      const byTime = byYear.get(year)!;
      const existing = byTime.get(t) || { groupTimestamp: t };
      if (item.subject === 'verbal') existing.verbal = item;
      if (item.subject === 'reasoning') existing.reasoning = item;
      byTime.set(t, existing);
    }

    const out = new Map<string, YearGroup[]>();
    for (const [year, byTime] of byYear.entries()) {
      const sorted = Array.from(byTime.values()).sort((a, b) => a.groupTimestamp - b.groupTimestamp);
      out.set(
        year,
        sorted.map((g, idx) => ({
          groupTimestamp: g.groupTimestamp,
          groupRound: idx + 1,
          verbal: g.verbal,
          reasoning: g.reasoning,
        }))
      );
    }

    return out;
  }, [history]);

  // 존재하는 모든 회독 수 추출 (두 과목이 모두 있는 세트 기준)
  const allRounds = useMemo(() => {
    const rounds = new Set<number>();
    for (const groups of yearGroups.values()) {
      for (const g of groups) {
        if (g.verbal && g.reasoning) rounds.add(g.groupRound);
      }
    }
    return Array.from(rounds).sort((a, b) => a - b);
  }, [yearGroups]);
  
  // 2020년 이전 시험이 있는지 확인
  const hasPre2020 = history.some(h => {
    const yearNum = h.year === '09예비' ? 2009 : parseInt(h.year);
    return yearNum < 2020;
  });

  const chartData = useMemo(() => {
    return Array.from(yearGroups.entries()).flatMap(([year, groups]) => {
      const completeGroups = groups.filter(g => g.verbal && g.reasoning);
      if (completeGroups.length === 0) return [];

      const targets =
        roundFilter === 'all'
          ? completeGroups
          : completeGroups.filter(g => g.groupRound === roundFilter);

      const yearSort = year === '09예비' ? 2009 : parseInt(year);

      return targets
        .filter(g => g.verbal && g.reasoning)
        .map((g): ChartDatum => {
          const verbal = g.verbal!;
          const reasoning = g.reasoning!;

          // 보정값 사용 여부에 따라 점수 선택
          const verbalScore = useAdjustedScore && verbal.adjustedScore
            ? verbal.adjustedScore
            : verbal.standardScore;
          const reasoningScore = useAdjustedScore && reasoning.adjustedScore
            ? reasoning.adjustedScore
            : reasoning.standardScore;

          // 표준점수는 합산
          const standardScore = verbalScore + reasoningScore;
          // 백분위는 평균
          const verbalPercentile = verbal.percentile;
          const reasoningPercentile = reasoning.percentile;
          const avgPercentile = (verbalPercentile + reasoningPercentile) / 2;
          // 정답률은 평균
          const verbalRate = (verbal.correct / verbal.total) * 100;
          const reasoningRate = (reasoning.correct / reasoning.total) * 100;
          const correctRate = Math.round((verbalRate + reasoningRate) / 2);
          const avgCorrectRate = (verbalRate + reasoningRate) / 2;

          return {
            name: `${year}-${g.groupRound}`,
            year,
            yearSort,
            groupTimestamp: g.groupTimestamp,
            groupRound: g.groupRound,
            표준점수: standardScore,
            언어_표준: verbalScore,
            추리_표준: reasoningScore,
            언어_백분위: verbalPercentile,
            추리_백분위: reasoningPercentile,
            평균_백분위: avgPercentile,
            백분위: avgPercentile,
            언어_정답률: verbalRate,
            추리_정답률: reasoningRate,
            평균_정답률: avgCorrectRate,
            정답률: correctRate,
            과목수: 2,
          };
        });
    });
  }, [yearGroups, roundFilter, useAdjustedScore]);

  // 데이터의 최소/최대값 계산
  const hasChartData = chartData.length > 0;
  const standardScores = chartData.map(d => d.표준점수);
  const percentiles = chartData.flatMap(d => [d.언어_백분위, d.추리_백분위, d.평균_백분위]);
  const correctRates = chartData.map(d => d.정답률);

  const minStandardScore = hasChartData ? Math.min(...standardScores) : 0;
  const maxStandardScore = hasChartData ? Math.max(...standardScores) : 300;
  const minPercentile = hasChartData ? Math.min(...percentiles) : 0;
  const maxPercentile = hasChartData ? Math.max(...percentiles) : 100;
  const minCorrectRate = hasChartData ? Math.min(...correctRates) : 0;
  const maxCorrectRate = hasChartData ? Math.max(...correctRates) : 100;

  // Y축 범위를 데이터 중심으로 설정 (위아래 여유 공간 추가)
  const getYDomain = (min: number, max: number, totalRange: number, padding = 5) => {
    const newMin = Math.max(0, min - padding);
    const newMax = Math.min(totalRange, max + padding);
    return [Math.floor(newMin), Math.ceil(newMax)];
  };

  const standardScoreDomain = hasChartData ? getYDomain(minStandardScore, maxStandardScore, 300) : [0, 300];
  const percentileDomain = hasChartData ? getYDomain(minPercentile, maxPercentile, 100) : [0, 100];
  const correctRateDomain = hasChartData ? getYDomain(minCorrectRate, maxCorrectRate, 100) : [0, 100];

  // 정렬 적용
  const sortedChartData = [...chartData].sort((a, b) => {
    if (sortBy === 'date') {
      return b.groupTimestamp - a.groupTimestamp; // 최신순
    } else {
      // 학년도순 (오래된 순) + 같은 학년도 내 회독순
      const byYear = a.yearSort - b.yearSort;
      if (byYear !== 0) return byYear;
      return a.groupRound - b.groupRound;
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
        <p>• 백분위: 언어이해/추리논증/평균을 <strong>선택 표시</strong></p>
        <p className="mt-2 text-xs text-blue-700">* 추이 그래프는 같은 연도에 두 과목을 모두 채점한 경우에만 표시됩니다</p>
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
            <Tooltip content={<StandardScoreTooltip />} />
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">백분위 추이</h3>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setShowVerbalPercentile(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                showVerbalPercentile
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              언어이해
            </button>
            <button
              onClick={() => setShowReasoningPercentile(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                showReasoningPercentile
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              추리논증
            </button>
            <button
              onClick={() => setShowAvgPercentile(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                showAvgPercentile
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              평균
            </button>
          </div>
        </div>

        {!((showVerbalPercentile || showReasoningPercentile || showAvgPercentile)) ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
            표시할 백분위 항목이 없습니다. (토글을 켜주세요)
          </div>
        ) : (
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
            <Tooltip content={<PercentileTooltip />} />
            <Legend />
            {showVerbalPercentile && (
              <Line
                type="monotone"
                dataKey="언어_백분위"
                name="언어이해 백분위"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            )}
            {showReasoningPercentile && (
              <Line
                type="monotone"
                dataKey="추리_백분위"
                name="추리논증 백분위"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            )}
            {showAvgPercentile && (
              <Line
                type="monotone"
                dataKey="평균_백분위"
                name="평균 백분위"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">정답률 추이 (평균)</h3>
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
            <YAxis domain={correctRateDomain} />
            <Tooltip content={<CorrectRateTooltip />} />
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