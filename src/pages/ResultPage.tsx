import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GradingResult, Subject } from '../App';
import { ResultPanel } from '../components/ResultPanel';
import { AnswerSheetResult } from '../components/AnswerSheetResult';
import { ArrowLeft, Home, X } from 'lucide-react';
import { useAuth, supabase } from '../contexts/AuthContext';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';

interface ResultWithAnswers extends GradingResult {
  correctAnswers?: Record<number, number>;
}

type NotesBySubject = Record<Subject, Record<number, string>>;

function emptyNotesBySubject(): NotesBySubject {
  return { verbal: {}, reasoning: {} };
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;

  const maxWidthClassName =
    size === 'sm'
      ? 'max-w-lg'
      : size === 'lg'
        ? 'max-w-4xl'
        : 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5 sm:p-6">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={
          `relative w-full ${maxWidthClassName} max-h-[min(92dvh,calc(100vh-2rem))] overflow-hidden rounded-lg border bg-white shadow-lg`
        }
      >
        <div className="flex max-h-full flex-col p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-gray-900">{title}</div>
              {description ? (
                <div className="mt-1 text-sm text-gray-600">{description}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              aria-label="닫기"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="mt-5 flex-1 overflow-y-auto">{children}</div>

          {footer ? (
            <div className="mt-6 flex justify-end gap-2 pt-4">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const modalBtnBase =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none h-9 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.99]';
const modalBtnPrimary = `${modalBtnBase} bg-blue-600 hover:bg-blue-700 text-white shadow-sm`;
const modalBtnSecondary = `${modalBtnBase} bg-gray-200 hover:bg-gray-300 text-gray-900`;
const modalBtnOutline = `${modalBtnBase} border border-gray-300 bg-white hover:bg-gray-50 text-gray-900`;
const modalBtnDestructive = `${modalBtnBase} border border-red-300 bg-white text-red-700 hover:bg-red-50 hover:border-red-400`;

export function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const results = location.state?.results as GradingResult[] | undefined;
  const singleResult = location.state?.result as GradingResult | undefined;

  // 이전 버전과의 호환성을 위해 단일 결과도 처리
  const finalResults = results || (singleResult ? [singleResult] : undefined);

  if (!finalResults || finalResults.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">결과를 찾을 수 없습니다</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 종합 점수 계산
  const hasMultipleSubjects = finalResults.length > 1;
  const totalStandardScore = hasMultipleSubjects 
    ? finalResults.reduce((sum, r) => sum + r.standardScore, 0)
    : null;
  const totalAdjustedScore = hasMultipleSubjects
    ? finalResults.reduce((sum, r) => sum + (r.adjustedScore || r.standardScore), 0)
    : null;
  const avgPercentile = hasMultipleSubjects
    ? Math.round(finalResults.reduce((sum, r) => sum + r.percentile, 0) / finalResults.length)
    : null;
  const yearNum = finalResults[0].year === '09예비' ? 2009 : parseInt(finalResults[0].year);
  const isPre2020 = yearNum < 2020;
  const hasAdjustedScoreInResults = finalResults.some((r) => typeof r.adjustedScore === 'number');
  
  const attemptGroupTimestamp = useMemo(() => {
    const first = finalResults[0];
    return (typeof first.groupTimestamp === 'number' ? first.groupTimestamp : first.timestamp);
  }, [finalResults]);

  const [notesBySubject, setNotesBySubject] = useState<NotesBySubject>(emptyNotesBySubject);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject>('verbal');
  const [activeQuestionNo, setActiveQuestionNo] = useState<number>(1);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteDraftDirty, setNoteDraftDirty] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);

  const [allNotesOpen, setAllNotesOpen] = useState(false);

  const ensureNotesLoaded = async (): Promise<NotesBySubject | null> => {
    if (!currentUser) return null;
    if (notesLoaded || notesLoading) return null;

    setNotesLoading(true);
    setNotesError(null);
    try {
      const { data, error } = await supabase
        .from('grading_notes')
        .select('subject, question_no, content')
        .eq('group_timestamp', attemptGroupTimestamp)
        .order('subject', { ascending: true })
        .order('question_no', { ascending: true });

      if (error) throw error;

      const next = emptyNotesBySubject();
      for (const row of data || []) {
        const subject = row.subject as Subject;
        if (subject !== 'verbal' && subject !== 'reasoning') continue;
        next[subject][row.question_no] = row.content || '';
      }

      setNotesBySubject(next);
      setNotesLoaded(true);
      return next;
    } catch (e: any) {
      console.error('Failed to load grading notes:', e);
      const code = e?.code || e?.error_code || e?.cause?.code;
      if (code === 'PGRST205') {
        setNotesError('메모 DB(grading_notes) 테이블이 없습니다. Supabase 마이그레이션을 먼저 적용해주세요.');
      } else {
        setNotesError('메모를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
      return null;
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    setNotesBySubject(emptyNotesBySubject());
    setNotesLoaded(false);
    setNotesError(null);

    // 결과 페이지에서는 해당 회차 메모만 1회 조회 (히스토리 페이지에서는 조회하지 않음)
    if (currentUser) {
      void ensureNotesLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, attemptGroupTimestamp]);

  const openNoteModal = (subject: Subject, questionNo: number) => {
    // ✅ 즉시 모달을 열어 클릭 반응을 보장
    setActiveSubject(subject);
    setActiveQuestionNo(questionNo);
    setNoteDraft((notesBySubject?.[subject]?.[questionNo] || '').toString());
    setNoteDraftDirty(false);
    setNoteModalOpen(true);

    // 로그인 상태라면 백그라운드로 메모 로딩
    if (currentUser) {
      void (async () => {
        const loaded = await ensureNotesLoaded();
        if (!loaded) return;
        // 사용자가 이미 입력을 시작했다면 덮어쓰지 않음
        setNoteDraft(prev => {
          if (noteDraftDirty) return prev;
          return (loaded?.[subject]?.[questionNo] || '').toString();
        });
      })();
    }
  };

  const saveActiveNote = async () => {
    if (!currentUser) return;

    const trimmed = noteDraft.trim();
    setNoteSaving(true);
    try {
      if (trimmed.length === 0) {
        const { error } = await supabase
          .from('grading_notes')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('group_timestamp', attemptGroupTimestamp)
          .eq('subject', activeSubject)
          .eq('question_no', activeQuestionNo);
        if (error) throw error;

        setNotesBySubject(prev => ({
          ...prev,
          [activeSubject]: {
            ...prev[activeSubject],
            [activeQuestionNo]: '',
          },
        }));
      } else {
        const { error } = await supabase
          .from('grading_notes')
          .upsert(
            {
              user_id: currentUser.id,
              group_timestamp: attemptGroupTimestamp,
              year: finalResults[0].year,
              exam_type: finalResults[0].examType,
              subject: activeSubject,
              question_no: activeQuestionNo,
              content: trimmed,
            },
            {
              onConflict: 'user_id,group_timestamp,subject,question_no',
            },
          );
        if (error) throw error;

        setNotesBySubject(prev => ({
          ...prev,
          [activeSubject]: {
            ...prev[activeSubject],
            [activeQuestionNo]: trimmed,
          },
        }));
      }

      setNoteModalOpen(false);
    } catch (e) {
      console.error('Failed to save note:', e);
      alert('메모 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteActiveNote = async () => {
    const existing = (notesBySubject?.[activeSubject]?.[activeQuestionNo] || '').trim();

    // 저장된 메모가 없으면 입력만 비우기
    if (!currentUser) return;
    if (!existing) {
      setNoteDraft('');
      setNoteDraftDirty(true);
      return;
    }

    if (!window.confirm('이 메모를 삭제할까요?')) return;

    setNoteSaving(true);
    try {
      const { error } = await supabase
        .from('grading_notes')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('group_timestamp', attemptGroupTimestamp)
        .eq('subject', activeSubject)
        .eq('question_no', activeQuestionNo);
      if (error) throw error;

      setNotesBySubject(prev => ({
        ...prev,
        [activeSubject]: {
          ...prev[activeSubject],
          [activeQuestionNo]: '',
        },
      }));

      setNoteDraft('');
      setNoteDraftDirty(false);
      setNoteModalOpen(false);
    } catch (e) {
      console.error('Failed to delete note:', e);
      alert('메모 삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setNoteSaving(false);
    }
  };

  const openAllNotesModal = () => {
    // ✅ 즉시 모달을 열어 클릭 반응을 보장
    setAllNotesOpen(true);
    if (currentUser) {
      void ensureNotesLoaded();
    }
  };

  const allNotesCount = useMemo(() => {
    const v = Object.values(notesBySubject.verbal || {}).filter(t => (t || '').trim().length > 0).length;
    const r = Object.values(notesBySubject.reasoning || {}).filter(t => (t || '').trim().length > 0).length;
    return v + r;
  }, [notesBySubject]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">채점 결과</h1>
              <p className="text-sm text-gray-600 mt-1">
                {finalResults[0].year}학년도 - {finalResults[0].examType === 'odd' ? '홀수형' : '짝수형'}
                {hasMultipleSubjects && ' (언어이해 + 추리논증)'}
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
                <Button
                  onClick={() => navigate('/history')}
                  className="gap-2 whitespace-nowrap bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                >
                  <Home className="w-4 h-4" />
                  성적 분석
                </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 종합 점수 (두 과목 모두 채점한 경우) */}
        {hasMultipleSubjects && (
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
            <h2 className="text-xl font-bold mb-4">종합 점수</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                <div className="text-sm opacity-90 mb-1">표준점수 합산</div>
                <div className="text-3xl font-bold">
                  {totalStandardScore?.toFixed(1)}
                  {isPre2020 && hasAdjustedScoreInResults && totalAdjustedScore !== null && (
                    <span className="block sm:inline text-base opacity-90 mt-1 sm:mt-0 sm:ml-2 whitespace-nowrap">
                      (보정 {totalAdjustedScore.toFixed(1)})
                    </span>
                  )}
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                <div className="text-sm opacity-90 mb-1">백분위 평균</div>
                <div className="text-3xl font-bold">{avgPercentile}</div>
              </div>
            </div>
            <p className="text-xs mt-4 opacity-80">
              * 표준점수는 두 과목의 합계, 백분위는 평균값입니다.
            </p>
          </div>
        )}

        {/* 각 과목별 결과 */}
        {finalResults.map((result, index) => (
          <div key={index}>
            <ResultPanel result={result} />

            <div className="mt-6 bg-white rounded-lg shadow p-4 sm:p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {result.subject === 'verbal' ? '언어이해' : '추리논증'} - 입력한 답안
              </h3>
              <AnswerSheetResult
                total={result.total}
                userAnswers={result.userAnswers ?? {}}
                correctAnswers={result.correctAnswers}
                notes={notesBySubject[result.subject]}
                onOpenNote={(q) => openNoteModal(result.subject, q)}
              />
            </div>
          </div>
        ))}

        {/* 메모 한번에 보기 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={openAllNotesModal}
            className="flex-1 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors border border-gray-200"
          >
            메모 한번에 보기{currentUser ? ` (${allNotesCount})` : ''}
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            새로운 시험 채점하기
          </button>
          <button
            onClick={() => navigate('/history')}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            전체 히스토리 보기
          </button>
        </div>
      </main>

      {/* 문항별 메모 모달 */}
      <Modal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        size="md"
        title={`${activeSubject === 'verbal' ? '언어이해' : '추리논증'} ${activeQuestionNo}번 메모`}
        description={
          currentUser
            ? '복기 포인트를 적어두세요.'
            : '로그인 후 메모 기능을 이용할 수 있습니다.'
        }
        footer={
          currentUser ? (
            <>
              <button
                type="button"
                onClick={deleteActiveNote}
                disabled={noteSaving}
                className={modalBtnDestructive}
              >
                삭제
              </button>
              <button
                type="button"
                className={modalBtnPrimary}
                onClick={saveActiveNote}
                disabled={noteSaving}
              >
                {noteSaving ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className={modalBtnPrimary} onClick={() => navigate('/login')}>
                로그인
              </button>
            </>
          )
        }
      >
        <div className="space-y-2">
          <Textarea
            id={`note-${activeSubject}-${activeQuestionNo}`}
            name="grading_note"
            value={noteDraft}
            onChange={(e) => {
              setNoteDraftDirty(true);
              setNoteDraft(e.target.value);
            }}
            placeholder="예) 조건 해석을 반대로 함 / 단순 실수"
            className="min-h-40 p-4 text-base leading-relaxed sm:text-sm"
            disabled={!currentUser}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                if (currentUser) void saveActiveNote();
              }
            }}
          />
          <div className="text-xs text-gray-500">
            {currentUser ? '' : '메모는 로그인 후 저장됩니다.'}
          </div>
        </div>
      </Modal>

      {/* 메모 한번에 보기 모달 */}
      <Modal
        open={allNotesOpen}
        onClose={() => setAllNotesOpen(false)}
        size="lg"
        title="메모 한번에 보기"
        description={`${finalResults[0].year}학년도 - ${finalResults[0].examType === 'odd' ? '홀수형' : '짝수형'}`}
      >
        {!currentUser ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">로그인 후 메모를 확인할 수 있습니다.</div>
            <div className="flex justify-end">
              <button type="button" className={modalBtnPrimary} onClick={() => navigate('/login')}>
                로그인
              </button>
            </div>
          </div>
        ) : (
          <>
            {notesLoading && <div className="text-sm text-gray-600">메모 불러오는 중...</div>}
            {notesError && <div className="text-sm text-red-600">{notesError}</div>}

            {!notesLoading && !notesError && (
              <div className="space-y-6">
                {(['verbal', 'reasoning'] as Subject[])
                  .filter(s => finalResults.some(r => r.subject === s))
                  .map((subject) => {
                    const entries = Object.entries(notesBySubject[subject] || {})
                      .map(([q, text]) => ({ q: Number(q), text: (text || '').trim() }))
                      .filter(x => x.text.length > 0)
                      .sort((a, b) => a.q - b.q);

                    return (
                      <div key={subject}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-base font-bold text-gray-900">
                            {subject === 'verbal' ? '언어이해' : '추리논증'}
                          </h4>
                          <div className="text-xs text-gray-500">{entries.length}개</div>
                        </div>

                        {entries.length === 0 ? (
                          <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                            메모가 없습니다.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {entries.map(({ q, text }) => (
                              <div key={q} className="border rounded-lg p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900">{q}번</div>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap break-words mt-1">{text}</div>
                                  </div>
                                  <button
                                    type="button"
                                    className={`${modalBtnOutline} h-8 px-3 text-sm`}
                                    onClick={() => {
                                      setAllNotesOpen(false);
                                      openNoteModal(subject, q);
                                    }}
                                  >
                                    편집
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}