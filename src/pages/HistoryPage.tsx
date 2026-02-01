import { useNavigate, useSearchParams } from 'react-router-dom';
import { GradingResult } from '../App';
import { TrendChart } from '../components/TrendChart';
import { MockTrendChart } from '../components/MockTrendChart';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MockExamRecord } from '../types/mockExam';
import { getMockExamDisplayTitle, MOCK_EXAM_BASE_PROVIDERS } from '../types/mockExam';
import { EXAMPLE_MOCK_HISTORY, EXAMPLE_OFFICIAL_HISTORY } from '../utils/exampleHistory';

interface HistoryPageProps {
  history: GradingResult[];
  onClearHistory: () => void;
  onDeleteRecord: (timestamps: number[]) => void;

  mockHistory: MockExamRecord[];
  onClearMockHistory: () => void;
  onDeleteMockRecord: (ids: string[]) => void;
}

type HistoryTab = 'official' | 'mock';

export function HistoryPage({
  history,
  onClearHistory,
  onDeleteRecord,
  mockHistory,
  onClearMockHistory,
  onDeleteMockRecord,
}: HistoryPageProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const showOfficialExample = history.length === 0;
  const showMockExample = mockHistory.length === 0;
  const officialHistoryForView = showOfficialExample ? EXAMPLE_OFFICIAL_HISTORY : history;
  const mockHistoryForView = showMockExample ? EXAMPLE_MOCK_HISTORY : mockHistory;

  const tabFromQuery = (searchParams.get('tab') || '').toLowerCase();
  const initialTab: HistoryTab = tabFromQuery === 'mock' ? 'mock' : 'official';
  const [tab, setTab] = useState<HistoryTab>(initialTab);

  const [sortBy, setSortBy] = useState<'date' | 'year'>('date'); // 기본값: 채점 순서
  const [providerFilter, setProviderFilter] = useState<string>('all');

  const getGroupTime = (record: GradingResult) => record.groupTimestamp ?? record.timestamp;

  // timestamp를 기준으로 기록 그룹화 (1초 이내는 같은 그룹으로 간주)
  const groupedHistory: GradingResult[][] = [];
  const processed = new Set<number>();

  officialHistoryForView.forEach((record, index) => {
    if (processed.has(index)) return;

    const group: GradingResult[] = [record];
    processed.add(index);

    // 같은 groupTimestamp(없으면 timestamp) 기준으로 그룹화 (1초 이내는 같은 그룹으로 간주)
    officialHistoryForView.forEach((otherRecord, otherIndex) => {
      if (
        otherIndex !== index &&
        !processed.has(otherIndex) &&
        Math.abs(getGroupTime(record) - getGroupTime(otherRecord)) < 1000
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
      return getGroupTime(b[0]) - getGroupTime(a[0]);
    } else {
      // 연도순 (오래된 순)
      const yearA = a[0].year === '09예비' ? 2009 : parseInt(a[0].year);
      const yearB = b[0].year === '09예비' ? 2009 : parseInt(b[0].year);
      return yearA - yearB;
    }
  });

  const setTabAndSyncQuery = (next: HistoryTab) => {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  const allProviders = useMemo(() => {
    const providers = Array.from(new Set(mockHistoryForView.map(r => (r.provider || '').trim()).filter(Boolean)));
    providers.sort((a, b) => a.localeCompare(b, 'ko-KR'));

    const baseSet = new Set(MOCK_EXAM_BASE_PROVIDERS);
    const base = providers.filter(p => baseSet.has(p as any));
    const rest = providers.filter(p => !baseSet.has(p as any));
    return [...base, ...rest];
  }, [mockHistoryForView]);

  const filteredMock = useMemo(() => {
    if (providerFilter === 'all') return mockHistoryForView;
    return mockHistoryForView.filter(r => r.provider === providerFilter);
  }, [providerFilter, mockHistoryForView]);

  const sortedMock = useMemo(() => {
    return [...filteredMock].sort((a, b) => {
      const byDate = b.examDate.localeCompare(a.examDate);
      if (byDate !== 0) return byDate;
      return b.createdAt - a.createdAt;
    });
  }, [filteredMock]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                <span className="block sm:inline">리트 채점은 </span>
                <span className="block sm:inline whitespace-nowrap">all LEET</span>
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {tab === 'official'
                  ? `총 ${history.length}개의 채점 기록${showOfficialExample ? ' (예시 미리보기)' : ''}`
                  : `총 ${mockHistory.length}개의 사설 기록${showMockExample ? ' (예시 미리보기)' : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">돌아가기</span>
              </button>
              {tab === 'mock' && (
                <button
                  onClick={() => navigate('/mock-input')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  + 입력
                </button>
              )}
              <button
                onClick={tab === 'official' ? onClearHistory : onClearMockHistory}
                disabled={tab === 'official' ? showOfficialExample : showMockExample}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  (tab === 'official' ? showOfficialExample : showMockExample)
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-100 hover:bg-red-200 text-red-700'
                }`}
                title={(tab === 'official' ? showOfficialExample : showMockExample) ? '예시 데이터는 삭제할 수 없습니다.' : undefined}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">전체 삭제</span>
              </button>
            </div>
          </div>

          <div className="mt-4">
            <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setTabAndSyncQuery('official')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  tab === 'official'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                기출 성적 분석
              </button>
              <button
                onClick={() => setTabAndSyncQuery('mock')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                  tab === 'mock'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                사설 성적 분석
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {tab === 'official' ? (
          <>
            {showOfficialExample && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-5 border border-blue-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-blue-700">예시 데이터로 미리보기 중</div>
                    <div className="text-sm text-gray-600 mt-1">
                      아직 저장된 채점 기록이 없어 예시로 화면을 보여드려요. 실제 기록을 만들면 자동으로 내 기록으로 바뀝니다.
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
                  >
                    첫 시험 채점하기
                  </button>
                </div>
              </div>
            )}
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
                <TrendChart history={officialHistoryForView} sortBy={sortBy} />
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
              const groupTime = getGroupTime(firstRecord);
              const date = new Date(groupTime).toLocaleDateString('ko-KR');
              const time = new Date(groupTime).toLocaleTimeString('ko-KR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
              const isCombined = group.length > 1;

              // 두 과목 합산 점수 계산 (같이 채점한 경우)
              const totalStandardScore = group.reduce((sum, r) => sum + r.standardScore, 0);
              const totalAdjustedScore = group.reduce(
                (sum, r) => sum + (r.adjustedScore ?? r.standardScore),
                0
              );
              const hasAdjustedScore = group.some(r => typeof r.adjustedScore === 'number');
              const avgPercentile = group.reduce((sum, r) => sum + r.percentile, 0) / group.length;

              return (
                <div
                  key={groupIndex}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    {/* 헤더 */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
                        <span className="font-bold text-lg text-gray-900">
                          {firstRecord.year}학년도
                          {firstRecord.round > 1 && (
                            <span className="block sm:inline sm:ml-2 text-sm font-semibold text-gray-600">
                              ({firstRecord.round}회독)
                            </span>
                          )}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
                          {firstRecord.examType === 'odd' ? '홀수형' : '짝수형'}
                        </span>
                        {group.map((record, idx) => {
                          const subjectName = record.subject === 'verbal' ? '언어이해' : '추리논증';
                          return (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
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
                            <span className="font-bold text-purple-700 text-base flex flex-col items-start sm:flex-row sm:items-center">
                              {totalStandardScore.toFixed(1)}
                              {hasAdjustedScore && (
                                <span className="text-xs text-purple-500 sm:ml-1 whitespace-nowrap">
                                  (보정 {totalAdjustedScore.toFixed(1)})
                                </span>
                              )}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-500">평균 백분위 </span>
                            <span className="font-bold text-orange-700 text-base">{avgPercentile.toFixed(1)}</span>
                          </div>
                        </div>
                      ) : (
                        <div></div>
                      )}
                      {!showOfficialExample ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const uniqueTimestamps = Array.from(new Set(group.map(r => r.timestamp)));
                              onDeleteRecord(uniqueTimestamps);
                            }}
                            className="text-sm text-red-600 hover:text-red-700 font-semibold whitespace-nowrap flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            삭제
                          </button>
                          <button
                            onClick={() =>
                              navigate('/result', { state: isCombined ? { results: group } : { result: firstRecord } })
                            }
                            className="text-sm text-blue-600 hover:text-blue-700 font-semibold whitespace-nowrap"
                          >
                            자세히 보기
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">예시 데이터</div>
                      )}
                    </div>
                  </div>
                </div>
              );
                  })}
                </div>
              </div>
          </>
        ) : mockHistory.length === 0 ? (
          <>
            {showMockExample && (
              <div className="bg-white rounded-lg shadow p-4 sm:p-5 border border-blue-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-blue-700">예시 데이터로 미리보기 중</div>
                    <div className="text-sm text-gray-600 mt-1">
                      아직 저장한 사설 성적이 없어 예시로 화면을 보여드려요. 성적을 입력하면 자동으로 내 기록으로 바뀝니다.
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/mock-input')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors whitespace-nowrap"
                  >
                    사설 성적 입력하기
                  </button>
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">성적 추이</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">시험기관:</span>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm shadow-sm"
                  >
                    <option value="all">전체</option>
                    {allProviders.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <MockTrendChart records={filteredMock} enforceCompleteRound />
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">상세 기록</h2>
                <div className="text-sm text-gray-500">최신 시험일 순</div>
              </div>

              {sortedMock.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
                  선택한 시험기관에 해당하는 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedMock.map((record) => {
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
                            <div className="text-xs text-gray-600">저장: {createdAtText}</div>
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
                            {!showMockExample ? (
                              <button
                                onClick={() => onDeleteMockRecord([record.id])}
                                className="text-sm text-red-600 hover:text-red-700 font-semibold whitespace-nowrap flex items-center gap-1"
                              >
                                <Trash2 className="w-4 h-4" />
                                삭제
                              </button>
                            ) : (
                              <div className="text-xs text-gray-500">예시 데이터</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-xl font-bold text-gray-900">성적 추이</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">시험기관:</span>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 text-sm shadow-sm"
                  >
                    <option value="all">전체</option>
                    {allProviders.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <MockTrendChart records={filteredMock} enforceCompleteRound />
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">상세 기록</h2>
                <div className="text-sm text-gray-500">최신 시험일 순</div>
              </div>

              {sortedMock.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-600">
                  선택한 시험기관에 해당하는 기록이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedMock.map((record) => {
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
                            <div className="text-xs text-gray-600">저장: {createdAtText}</div>
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
                              onClick={() => onDeleteMockRecord([record.id])}
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
          </>
        )}
      </main>
    </div>
  );
}