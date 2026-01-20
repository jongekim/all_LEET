import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MockExamRecord } from '../types/mockExam';
import { MOCK_EXAM_BASE_PROVIDERS } from '../types/mockExam';
import { ArrowLeft } from 'lucide-react';

interface MockExamInputPageProps {
  existingRecords: MockExamRecord[];
  onAddRecord: (record: Omit<MockExamRecord, 'id' | 'createdAt'>) => Promise<void>;
}

type ProviderSelectValue = (typeof MOCK_EXAM_BASE_PROVIDERS)[number] | '기타';

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

export function MockExamInputPage({ existingRecords, onAddRecord }: MockExamInputPageProps) {
  const navigate = useNavigate();

  const customProviders = useMemo(() => {
    const base = new Set(MOCK_EXAM_BASE_PROVIDERS);
    return Array.from(
      new Set(
        existingRecords
          .map(r => (r.provider || '').trim())
          .filter(p => p && !base.has(p as any))
      )
    ).sort((a, b) => a.localeCompare(b, 'ko-KR'));
  }, [existingRecords]);

  const [examDate, setExamDate] = useState('');
  const [providerSelect, setProviderSelect] = useState<ProviderSelectValue>('시대인재');
  const [customProvider, setCustomProvider] = useState('');
  const [round, setRound] = useState('');

  const [verbalStandardScore, setVerbalStandardScore] = useState('');
  const [verbalPercentile, setVerbalPercentile] = useState('');
  const [reasoningStandardScore, setReasoningStandardScore] = useState('');
  const [reasoningPercentile, setReasoningPercentile] = useState('');

  const [saving, setSaving] = useState(false);

  const providerOptions: Array<{ label: string; value: string }> = [
    ...MOCK_EXAM_BASE_PROVIDERS.map(p => ({ label: p, value: p })),
    ...customProviders.map(p => ({ label: p, value: p })),
    { label: '기타(직접 입력)', value: '기타' },
  ];

  const handleSubmit = async () => {
    if (saving) return;

    const provider = providerSelect === '기타' ? customProvider.trim() : providerSelect;

    if (!examDate) {
      alert('시험일자를 입력해주세요.');
      return;
    }

    if (!provider) {
      alert('시험기관을 선택/입력해주세요.');
      return;
    }

    const vStd = parseOptionalNumber(verbalStandardScore);
    const vPct = parseOptionalNumber(verbalPercentile);
    const rStd = parseOptionalNumber(reasoningStandardScore);
    const rPct = parseOptionalNumber(reasoningPercentile);

    const hasVerbal = vStd !== null && vPct !== null;
    const hasReasoning = rStd !== null && rPct !== null;

    if (!hasVerbal && !hasReasoning) {
      alert('언어이해 또는 추리논증 점수를 입력해주세요. (미응시 과목은 비워둘 수 있습니다)');
      return;
    }

    if ((vStd === null) !== (vPct === null)) {
      alert('언어이해는 표준점수/백분위를 모두 입력하거나 모두 비워두세요.');
      return;
    }

    if ((rStd === null) !== (rPct === null)) {
      alert('추리논증은 표준점수/백분위를 모두 입력하거나 모두 비워두세요.');
      return;
    }

    const record: Omit<MockExamRecord, 'id' | 'createdAt'> = {
      examDate,
      provider,
      round: round.trim() ? round.trim() : undefined,
      verbal: hasVerbal ? { standardScore: vStd!, percentile: vPct! } : null,
      reasoning: hasReasoning ? { standardScore: rStd!, percentile: rPct! } : null,
    };

    setSaving(true);
    try {
      await onAddRecord(record);
      navigate('/mock-history');
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      alert(`저장에 실패했습니다.\n${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">사설 모의고사 성적 입력</h1>
              <p className="text-sm text-gray-600 mt-1">시험일자/기관/점수를 수동으로 저장합니다</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">시험일자</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">시험기관</label>
              <select
                value={providerSelect}
                onChange={(e) => setProviderSelect(e.target.value as ProviderSelectValue)}
                className="w-full border rounded-lg px-3 py-2"
              >
                {providerOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {providerSelect === '기타' && (
                <input
                  type="text"
                  value={customProvider}
                  onChange={(e) => setCustomProvider(e.target.value)}
                  placeholder="예: 조승우 강사모"
                  className="mt-2 w-full border rounded-lg px-3 py-2"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">시험회차 (선택)</label>
              <input
                type="text"
                value={round}
                onChange={(e) => setRound(e.target.value)}
                placeholder="예: 1"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <p>
              • 과목을 응시하지 않았다면 해당 과목 점수는 비워둘 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">언어이해</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">표준점수</label>
                  <input
                    inputMode="decimal"
                    value={verbalStandardScore}
                    onChange={(e) => setVerbalStandardScore(e.target.value)}
                    placeholder="예: 70"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">백분위</label>
                  <input
                    inputMode="decimal"
                    value={verbalPercentile}
                    onChange={(e) => setVerbalPercentile(e.target.value)}
                    placeholder="예: 85"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">추리논증</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">표준점수</label>
                  <input
                    inputMode="decimal"
                    value={reasoningStandardScore}
                    onChange={(e) => setReasoningStandardScore(e.target.value)}
                    placeholder="예: 75"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">백분위</label>
                  <input
                    inputMode="decimal"
                    value={reasoningPercentile}
                    onChange={(e) => setReasoningPercentile(e.target.value)}
                    placeholder="예: 90"
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex-1 bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors ${
                saving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'
              }`}
            >
              저장하기
            </button>
            <button
              onClick={() => navigate('/mock-history')}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              사설 히스토리 보기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
