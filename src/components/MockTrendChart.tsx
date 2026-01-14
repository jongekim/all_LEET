import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { MockExamRecord } from '../types/mockExam';

interface MockTrendChartProps {
  records: MockExamRecord[];
}

export function MockTrendChart({ records }: MockTrendChartProps) {
  const sorted = [...records].sort((a, b) => {
    // examDate is YYYY-MM-DD
    return a.examDate.localeCompare(b.examDate);
  });

  const chartData = sorted.map(r => ({
    name: r.examDate,
    언어_표준: r.verbal?.standardScore ?? null,
    추리_표준: r.reasoning?.standardScore ?? null,
    언어_백분: r.verbal?.percentile ?? null,
    추리_백분: r.reasoning?.percentile ?? null,
  }));

  const hasAny = chartData.length > 0;
  const hasVerbal = chartData.some(d => d.언어_표준 !== null || d.언어_백분 !== null);
  const hasReasoning = chartData.some(d => d.추리_표준 !== null || d.추리_백분 !== null);

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">표준점수 추이</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={[0, 300]} />
            <Tooltip />
            <Legend />
            {hasVerbal && (
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
            {hasReasoning && (
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
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">백분위 추이</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            {hasVerbal && (
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
            {hasReasoning && (
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
