import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import type { GradingResult } from '../App';
import { AnswerSheetResult } from './AnswerSheetResult';
import { QuestionStatistics } from './QuestionStatistics';
import { hasMatchingAnswers } from '../utils/questionStatisticsModel';
import { editedResult } from '../../supabase/functions/_shared/user-data-rules/answerEdit';
import { HistoryApiError } from '../utils/historyApi';
import { useUnsavedDdayChanges } from '../hooks/useUnsavedDdayChanges';
import { Button } from './ui/button';
import '../styles/answer-edit.css';

const label = (answer?: number) => answer ? ['', '①', '②', '③', '④', '⑤'][answer] : '미응답';

export function EditableAnswers({ result, notes, onOpenNote, editing, anotherEditing, canEdit, persisted, onStart, onFinish, onApply, onDirtyChange }: {
  result: GradingResult;
  notes: Record<number, string>;
  onOpenNote: (question: number) => void;
  editing: boolean;
  anotherEditing: boolean;
  canEdit: boolean;
  persisted: boolean;
  onStart: () => void;
  onFinish: () => void;
  onApply: (expected: GradingResult, answers: Record<number, number>) => Promise<GradingResult>;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [base, setBase] = useState(result);
  const [draft, setDraft] = useState<Record<number, number>>(() => ({ ...result.userAnswers }));
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const changed = Array.from({ length: result.total }, (_, i) => i + 1)
    .filter(q => (draft[q] || 0) !== (base.userAnswers?.[q] || 0));
  const computed = useMemo(() => {
    try { return editedResult(base, draft); } catch { return null; }
  }, [base, draft]);
  const dirty = editing && (changed.length > 0 || saving);
  useUnsavedDdayChanges(dirty);
  useEffect(() => { if (editing) onDirtyChange(dirty); }, [dirty, editing, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href]')) return;
      if (inFlight.current || !window.confirm('저장하지 않은 변경사항을 버리고 이동할까요?')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [dirty]);

  const start = () => {
    setBase(result); setDraft({ ...result.userAnswers }); setSelected(null);
    setMessage(''); setError(''); setBlocked(false); onStart();
  };
  const cancel = () => {
    if (inFlight.current || (changed.length && !window.confirm('변경한 답안을 버리고 수정을 취소할까요?'))) return;
    setSelected(null); onDirtyChange(false); onFinish();
  };
  const apply = async () => {
    if (inFlight.current || !changed.length || !computed || blocked) return;
    inFlight.current = true; setSaving(true); setError('');
    try {
      await onApply(base, draft);
      if (!alive.current) return;
      setMessage(`${changed.length}문항 수정이 반영되었습니다.${persisted ? ' 기존 회독과 메모는 유지됩니다.' : ' 이 결과는 현재 화면에만 반영됩니다.'}`);
      setSelected(null); onDirtyChange(false); onFinish();
    } catch (failure) {
      if (!alive.current) return;
      console.error('답안 수정 실패', failure);
      setError(failure instanceof Error ? failure.message : '답안 수정에 실패했습니다. 입력한 내용은 유지됩니다.');
      setBlocked(failure instanceof HistoryApiError && ['HISTORY_CONFLICT', 'AMBIGUOUS_RECORD', 'RECORD_NOT_FOUND', 'RESULT_UNKNOWN', 'STORAGE_UNAVAILABLE', 'ACCOUNT_CHANGED'].includes(failure.code));
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  };
  const editor: ReactNode = selected === null ? null : (
    <div className="answer-edit-picker" role="group" aria-label={`${selected}번 답안 선택`}>
      <div className="answer-edit-picker-heading">
        <span>{selected}번 답안 수정</span>
        <span className="answer-edit-original">기존 답안 {label(base.userAnswers?.[selected])}</span>
      </div>
      <div className="answer-edit-options">
        {[1, 2, 3, 4, 5, 0].map(answer => (
          <button type="button" key={answer} className="answer-edit-option" disabled={saving}
            aria-pressed={(draft[selected] || 0) === answer} aria-label={`${selected}번 ${answer ? `${answer}번 선지` : '미응답'} 선택`}
            onClick={() => setDraft(previous => ({ ...previous, [selected]: answer }))}>{label(answer)}</button>
        ))}
      </div>
    </div>
  );
  return <>
    <div className="answer-edit-heading">
      <h3 className="text-lg font-bold text-gray-900 mb-4">{result.subject === 'verbal' ? '언어이해' : '추리논증'} - 입력한 답안</h3>
      {editing ? <span className="answer-edit-mode">답안 수정 중</span> : canEdit &&
        <Button type="button" variant="outline" size="sm" className="answer-edit-start" disabled={anotherEditing || !computed}
          title={computed ? undefined : '저장된 정답과 현재 채점 자료가 달라 수정할 수 없습니다.'} onClick={start}>
          <Pencil className="w-4 h-4" />답안 수정
        </Button>}
    </div>
    <QuestionStatistics selection={{ year: result.year, subject: result.subject, examType: result.examType }}
      compatible={hasMatchingAnswers({ year: result.year, subject: result.subject, examType: result.examType }, result.correctAnswers)}>
      <AnswerSheetResult key={editing ? 'editing' : 'saved'} total={result.total} userAnswers={editing ? draft : result.userAnswers ?? {}}
        correctAnswers={result.correctAnswers} notes={notes} onOpenNote={onOpenNote}
        editing={editing} originalAnswers={base.userAnswers ?? {}} selectedQuestion={selected}
        onSelectQuestion={setSelected} editor={editor} disabled={saving} />
    </QuestionStatistics>
    {editing && <div className="answer-edit-footer">
      <div aria-live="polite">
        <p className="answer-edit-count">{changed.length ? `${changed.length}문항 변경 · 예상 정답 ${base.correct} → ${computed?.correct ?? '-'}개` : '수정할 문항을 선택하세요.'}</p>
        {changed.length > 0 && <p className="answer-edit-diff">{changed.map(q => `${q}번 ${label(base.userAnswers?.[q])} → ${label(draft[q])}`).join(' · ')}</p>}
        <p className="answer-edit-caption">{persisted ? `현재 ${result.round}회독 기록에 반영되며, 문항별 메모는 유지됩니다.` : '비로그인 채점 결과는 현재 화면에서만 수정됩니다.'}</p>
      </div>
      <div className="answer-edit-actions">
        <Button type="button" variant="outline" disabled={saving} onClick={cancel}>취소</Button>
        <Button type="button" disabled={saving || !changed.length || !computed || blocked} className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => void apply()}>
          {saving ? '반영 중...' : '수정 반영'}
        </Button>
      </div>
    </div>}
    {editing && error && <p className="answer-edit-error" role="alert">{error}</p>}
    {!editing && message && <p className="text-sm text-green-600 mt-4" role="status">{message}</p>}
  </>;
}
