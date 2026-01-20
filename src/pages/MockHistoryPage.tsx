import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MockExamRecord } from '../types/mockExam';
import { getMockExamDisplayTitle, MOCK_EXAM_BASE_PROVIDERS } from '../types/mockExam';
import { MockTrendChart } from '../components/MockTrendChart';
import { ArrowLeft, Trash2 } from 'lucide-react';

interface MockHistoryPageProps {
  records: MockExamRecord[];
  onClear: () => void;
  onDelete: (ids: string[]) => void;
}

export function MockHistoryPage({ records, onClear, onDelete }: MockHistoryPageProps) {
  const navigate = useNavigate();
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const allProviders = useMemo(() => {
    const providers = Array.from(new Set(records.map(r => (r.provider || '').trim()).filter(Boolean)));
    providers.sort((a, b) => a.localeCompare(b, 'ko-KR'));

    // Prefer showing base providers first if present
    const baseSet = new Set(MOCK_EXAM_BASE_PROVIDERS);
    const base = providers.filter(p => baseSet.has(p as any));
    const rest = providers.filter(p => !baseSet.has(p as any));
    return [...base, ...rest];
  }, [records]);

  const filtered = useMemo(() => {
    if (providerFilter === 'all') return records;
    return records.filter(r => r.provider === providerFilter);
  }, [providerFilter, records]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const byDate = b.examDate.localeCompare(a.examDate);
      if (byDate !== 0) return byDate;
      return b.createdAt - a.createdAt;
    });
  }, [filtered]);

  if (records.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">사설 모의고사 히스토리</h1>
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
            <p className="text-gray-600 mb-4">아직 저장한 사설 성적이 없습니다.</p>
            <button
              onClick={() => navigate('/mock-input')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              사설 성적 입력하기
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
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">사설 모의고사 히스토리</h1>
              <p className="text-sm text-gray-600 mt-1">총 {records.length}개의 기록</p>
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
                onClick={() => navigate('/mock-input')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                + 입력
              </button>
              <button
                onClick={onClear}
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-900">성적 추이</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">시험기관:</span>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">전체</option>
                {allProviders.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <MockTrendChart records={filtered} />
        </div>

        <div className="bg-white rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">상세 기록</h2>
            <div className="text-sm text-gray-500">
              최신 시험일 순
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
              선택한 시험기관에 해당하는 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((record) => {
                const createdAtText = new Date(record.createdAt).toLocaleString('ko-KR');

                const subjects: Array<{ key: 'verbal' | 'reasoning'; label: string; color: string }> = [];
                if (record.verbal) subjects.push({ key: 'verbal', label: '언어이해', color: 'bg-blue-100 text-blue-700' });
                if (record.reasoning) subjects.push({ key: 'reasoning', label: '추리논증', color: 'bg-purple-100 text-purple-700' });

                return (
                  <div
                    key={record.id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-lg text-gray-900">
                            {getMockExamDisplayTitle(record) || '사설 모의고사'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                            {record.examDate}
                          </span>
                          {subjects.map(s => (
                            <span
                              key={s.key}
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${s.color}`}
                            >
                              {s.label}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-600">
                          저장: {createdAtText}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {record.verbal && (
                          <div className="flex items-center justify-between text-sm py-1">
                            <span className="text-gray-700 font-medium">언어이해</span>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <span className="text-xs text-gray-500">표준점수 </span>
                                <span className="font-bold text-purple-600">{record.verbal.standardScore}</span>
                              </div>
                              <div className="text-center">
                                <span className="text-xs text-gray-500">백분위 </span>
                                <span className="font-bold text-orange-600">{record.verbal.percentile}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {record.reasoning && (
                          <div className="flex items-center justify-between text-sm py-1">
                            <span className="text-gray-700 font-medium">추리논증</span>
                            <div className="flex items-center gap-3">
                              <div className="text-center">
                                <span className="text-xs text-gray-500">표준점수 </span>
                                <span className="font-bold text-purple-600">{record.reasoning.standardScore}</span>
                              </div>
                              <div className="text-center">
                                <span className="text-xs text-gray-500">백분위 </span>
                                <span className="font-bold text-orange-600">{record.reasoning.percentile}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t flex items-center justify-end">
                        <button
                          onClick={() => onDelete([record.id])}
                          className="text-sm text-red-600 hover:text-red-700 font-semibold whitespace-nowrap flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          삭제
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
