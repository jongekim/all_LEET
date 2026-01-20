import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MockExamRecord } from '../types/mockExam';

interface MockTrendChartProps {
  records: MockExamRecord[];
  enforceCompleteRound?: boolean;
}

function getYDomain(min: number, max: number, totalRange: number) {
  const range = max - min;
  const padding = Math.max(range * 0.3, totalRange * 0.1);
  const newMin = Math.max(0, min - padding);
  const newMax = Math.min(totalRange, max + padding);
  return [Math.floor(newMin), Math.ceil(newMax)] as [number, number];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasBothStandardScores(record: MockExamRecord): boolean {
  const v = record.verbal as any;
  const r = record.reasoning as any;
  return v != null && r != null && isFiniteNumber(v.standardScore) && isFiniteNumber(r.standardScore);
}

export function MockTrendChart({ records, enforceCompleteRound = false }: MockTrendChartProps) {
  const hasAnyCompleteRound = useMemo(() => records.some(hasBothStandardScores), [records]);

  // 선택한 시험기관에 두 과목 모두 채점된 회차가 하나라도 있으면 → 완전 회차만
  // 그 외(단일 과목만 존재/회차별로 한 과목만 입력 등) → 존재하는 과목 기준으로 표시
  const shouldFilterToCompleteOnly = enforceCompleteRound && hasAnyCompleteRound;

  const filteredRecords = useMemo(() => {
    const base = shouldFilterToCompleteOnly
      ? records.filter(hasBothStandardScores)
      : records;
    return [...base].sort((a, b) => a.examDate.localeCompare(b.examDate));
  }, [records, shouldFilterToCompleteOnly]);

  const chartData = useMemo(() => {
    return filteredRecords.map(r => {
      const verbalStd = isFiniteNumber((r.verbal as any)?.standardScore) ? (r.verbal as any).standardScore : null;
      const reasoningStd = isFiniteNumber((r.reasoning as any)?.standardScore) ? (r.reasoning as any).standardScore : null;
      const verbalPct = isFiniteNumber((r.verbal as any)?.percentile) ? (r.verbal as any).percentile : null;
      const reasoningPct = isFiniteNumber((r.reasoning as any)?.percentile) ? (r.reasoning as any).percentile : null;

      const hasBothStd = verbalStd !== null && reasoningStd !== null;
      const hasBothPct = verbalPct !== null && reasoningPct !== null;

      return {
        name: r.examDate,
        언어_표준: verbalStd,
        추리_표준: reasoningStd,
        표준점수_합: hasBothStd ? verbalStd + reasoningStd : null,
        언어_백분: verbalPct,
        추리_백분: reasoningPct,
        평균_백분: hasBothPct ? (verbalPct + reasoningPct) / 2 : null,
      };
    });
  }, [filteredRecords]);

  const standardChartData = useMemo(() => {
    if (shouldFilterToCompleteOnly) {
      // 완전 회차 모드: 합산 표준점수 있는 회차만
      return chartData.filter(d => d.표준점수_합 !== null);
    }
    // 단일/불완전 모드: 최소 1과목 표준점수 있는 회차만
    return chartData.filter(d => d.언어_표준 !== null || d.추리_표준 !== null);
  }, [chartData, shouldFilterToCompleteOnly]);

  // 백분위 차트는 표준점수 차트와 동일한 회차만 표시 (표준점수에서 빠진 회차는 X축에서도 제거)
  const percentileChartData = useMemo(() => standardChartData, [standardChartData]);

  const hasAny = chartData.length > 0;
  const hasTotalStandard = standardChartData.length > 0;
  const hasVerbalPct = percentileChartData.some(d => d.언어_백분 !== null);
  const hasReasoningPct = percentileChartData.some(d => d.추리_백분 !== null);
  const hasAvgPct = percentileChartData.some(d => d.평균_백분 !== null);

  const hasVerbalStd = standardChartData.some(d => d.언어_표준 !== null);
  const hasReasoningStd = standardChartData.some(d => d.추리_표준 !== null);

  // 백분위 기본 표시: 평균만
  const [showVerbalPct, setShowVerbalPct] = useState(false);
  const [showReasoningPct, setShowReasoningPct] = useState(false);
  const [showAvgPct, setShowAvgPct] = useState(true);

  // 단일 과목(평균 계산 불가) 상황에서는 기본값(평균만)으로 인해 그래프가 비어 보일 수 있어,
  // 평균 데이터가 없으면 표시 가능한 과목 백분위를 자동으로 켭니다.
  useEffect(() => {
    if (showAvgPct && !hasAvgPct) {
      if (hasVerbalPct || hasReasoningPct) {
        setShowAvgPct(false);
        if (hasVerbalPct) setShowVerbalPct(true);
        if (hasReasoningPct) setShowReasoningPct(true);
      }
    }
  }, [showAvgPct, hasAvgPct, hasVerbalPct, hasReasoningPct]);

  const standardValues = shouldFilterToCompleteOnly
    ? standardChartData.map(d => d.표준점수_합).filter((v): v is number => v !== null)
    : standardChartData
        .flatMap(d => [d.언어_표준, d.추리_표준])
        .filter((v): v is number => v !== null);
  const percentileValues = percentileChartData
    .flatMap(d => [d.언어_백분, d.추리_백분, d.평균_백분])
    .filter((v): v is number => v !== null);

  const standardDomain =
    standardValues.length > 0
      ? getYDomain(Math.min(...standardValues), Math.max(...standardValues), 400)
      : ([0, 400] as [number, number]);

  const percentileDomain =
    percentileValues.length > 0
      ? getYDomain(Math.min(...percentileValues), Math.max(...percentileValues), 100)
      : ([0, 100] as [number, number]);

  if (!hasAny) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
        표시할 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-end justify-between gap-4 mb-2">
          <h3 className="text-lg font-semibold text-gray-900">
            표준점수 추이 {shouldFilterToCompleteOnly ? '(두 과목 합)' : ''}
          </h3>
          {shouldFilterToCompleteOnly && (
            <span className="text-xs text-gray-500">* 두 과목 모두 채점된 회차만 표시</span>
          )}
        </div>
        {hasTotalStandard ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={standardChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis domain={standardDomain} />
              <Tooltip />
              <Legend />
              {shouldFilterToCompleteOnly ? (
                <Line
                  type="monotone"
                  dataKey="표준점수_합"
                  name="표준점수(합산)"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls
                />
              ) : (
                <>
                  {hasVerbalStd && (
                    <Line
                      type="monotone"
                      dataKey="언어_표준"
                      name="언어이해 표준점수"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  )}
                  {hasReasoningStd && (
                    <Line
                      type="monotone"
                      dataKey="추리_표준"
                      name="추리논증 표준점수"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  )}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
            {shouldFilterToCompleteOnly
              ? '표준점수(합산)를 표시하려면 두 과목이 모두 입력된 회차가 필요합니다.'
              : '표준점수 데이터를 표시할 수 없습니다.'}
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">백분위 추이</h3>
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
            <button
              disabled={!hasVerbalPct}
              onClick={() => setShowVerbalPct(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasVerbalPct
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : showVerbalPct
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              언어이해
            </button>
            <button
              disabled={!hasReasoningPct}
              onClick={() => setShowReasoningPct(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasReasoningPct
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : showReasoningPct
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              추리논증
            </button>
            <button
              disabled={!hasAvgPct}
              onClick={() => setShowAvgPct(v => !v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                !hasAvgPct
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : showAvgPct
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              평균
            </button>
          </div>
        </div>

        {!((showVerbalPct && hasVerbalPct) || (showReasoningPct && hasReasoningPct) || (showAvgPct && hasAvgPct)) ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
            표시할 백분위 항목이 없습니다. (토글을 켜주세요)
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={percentileChartData}>
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
            {hasVerbalPct && showVerbalPct && (
              <Line
                type="monotone"
                dataKey="언어_백분"
                name="언어이해 백분위"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
            {hasReasoningPct && showReasoningPct && (
              <Line
                type="monotone"
                dataKey="추리_백분"
                name="추리논증 백분위"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
            {hasAvgPct && showAvgPct && (
              <Line
                type="monotone"
                dataKey="평균_백분"
                name="평균 백분위"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
