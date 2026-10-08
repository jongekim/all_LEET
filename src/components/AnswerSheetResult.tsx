import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { Check, X, StickyNote } from 'lucide-react';
import { QuestionRate } from './QuestionStatistics';

interface AnswerSheetResultProps {
  disabled?: boolean;
  editing?: boolean;
  originalAnswers?: Record<number, number>;
  selectedQuestion?: number | null;
  onSelectQuestion?: (question: number) => void;
  editor?: ReactNode;
  total: number;
  userAnswers: Record<number, number>;
  correctAnswers?: Record<number, number>;
  notes?: Record<number, string>;
  onOpenNote?: (questionNum: number) => void;
}

export function AnswerSheetResult({ total, userAnswers, correctAnswers, notes, onOpenNote, disabled = false, editing = false, originalAnswers = {}, selectedQuestion, onSelectQuestion, editor }: AnswerSheetResultProps) {
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());

  const [columns, setColumns] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? (window.matchMedia('(min-width: 640px)').matches ? 10 : 5) : 10);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 640px)');
    const resize = () => setColumns(media.matches ? 10 : 5);
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  // 클릭한 문제의 정답 표시/숨김 토글
  const toggleReveal = (questionNum: number) => {
    const newRevealed = new Set(revealedQuestions);
    if (newRevealed.has(questionNum)) {
      newRevealed.delete(questionNum);
    } else {
      newRevealed.add(questionNum);
      
      // 2초 후 자동으로 숨김
      setTimeout(() => {
        setRevealedQuestions(prev => {
          const updated = new Set(prev);
          updated.delete(questionNum);
          return updated;
        });
      }, 2000);
    }
    setRevealedQuestions(newRevealed);
  };

  const getUserAnswer = (questionNum: number): number | undefined => {
    const answer = userAnswers?.[questionNum];
    if (answer === undefined || answer === null) return undefined;
    if (answer === 0) return undefined;
    return answer;
  };

  const isCorrect = (questionNum: number): boolean | null => {
    if (!correctAnswers || !correctAnswers[questionNum]) return null;
    const userAnswer = getUserAnswer(questionNum);
    if (userAnswer === undefined) return false;
    return userAnswer === correctAnswers[questionNum];
  };

  const getCellClassName = (questionNum: number): string => {
    const baseClass = "text-center p-3 rounded-lg border-2 font-semibold transition-all";
    if (editing) {
      return (userAnswers[questionNum] || 0) !== (originalAnswers[questionNum] || 0)
        ? baseClass + ' answer-edit-dirty-cell cursor-pointer'
        : baseClass + ' bg-gray-50 border-gray-300 text-gray-900 cursor-pointer';
    }
    const correct = isCorrect(questionNum);
    if (correct === true) {
      return `${baseClass} bg-green-50 border-green-500 text-green-900`;
    } else if (correct === false) {
      return `${baseClass} bg-red-50 border-red-500 text-red-900 cursor-pointer hover:bg-red-100 hover:shadow-md`;
    }
    
    return `${baseClass} bg-gray-50 border-gray-300 text-gray-900`;
  };

  const handleCellClick = (questionNum: number) => {
    if (editing) { onSelectQuestion?.(questionNum); return; }
    const correct = isCorrect(questionNum);
    if (correct === false) {
      toggleReveal(questionNum);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          맞은 개수: <span className="font-bold text-green-600">
            {Array.from({ length: total }, (_, i) => i + 1).filter(q => editing ? !!correctAnswers?.[q] && originalAnswers[q] === correctAnswers[q] : isCorrect(q) === true).length}
          </span> / {total}
        </div>
        {!editing && <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-50 border-2 border-green-500 rounded"></div>
            <span className="text-gray-600">맞음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-50 border-2 border-red-500 rounded"></div>
            <span className="text-gray-600">틀림/미제출 (클릭하여 정답 보기)</span>
          </div>
        </div>}
      </div>
      
      <div className="answer-sheet-result-grid grid grid-cols-5 sm:grid-cols-10 gap-2 ml-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((questionNum) => {
          const correct = isCorrect(questionNum);
          const isRevealed = revealedQuestions.has(questionNum);
          const userAnswer = getUserAnswer(questionNum);
          const noteText = (notes?.[questionNum] || '').trim();
          const hasNote = noteText.length > 0;
          
          return (
            <Fragment key={questionNum}><div
              key={questionNum}
              className="relative overflow-visible"
              data-question-number={questionNum}
              tabIndex={-1}
              role="group"
              aria-label={`${questionNum}번 답안표`}
            >
              {onOpenNote && (
                <button
                  type="button"
                  style={{ zIndex: 2, left: -8, top: -8, width: 24, height: 24 }}
                  aria-label={`${questionNum}번 문항 메모`}
                  title={`${questionNum}번 메모 ${hasNote ? '보기/수정' : '작성'}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenNote(questionNum);
                  }}
                  className={
                    "pointer-events-auto absolute -top-2 -left-2 z-20 inline-flex h-[22px] w-[22px] items-center justify-center rounded-md border text-xs font-semibold shadow-sm transition-colors cursor-pointer " +
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98] " +
                    (hasNote
                      ? "bg-blue-600 border-blue-700 text-white hover:bg-blue-700"
                      : "bg-gray-50 border-gray-300 text-gray-900 hover:bg-gray-100 hover:border-gray-400")
                  }
                >
                  <StickyNote className="h-3.5 w-3.5" />
                </button>
              )}
              <div className="relative">
              <button
                type="button"
                disabled={disabled || (!editing && correct !== false)}
                style={{ width: '100%', ...(editing && selectedQuestion === questionNum ? { outline: '2px solid #2563eb', outlineOffset: '3px' } : {}) }}
                aria-label={`${questionNum}번 입력 답안 ${userAnswer || '미응답'}${editing ? ', 답안 수정' : correct === false ? ', 정답 보기' : ''}`}
                className={getCellClassName(questionNum)}
                onClick={() => handleCellClick(questionNum)}
              >
                <div className="text-xs text-gray-500 mb-1">{questionNum}</div>
                <div className="text-lg">{userAnswer || '-'}</div>
                
                {!editing && correct !== null && (
                  <div className="absolute -top-1 -right-1 bg-white rounded-full shadow-sm">
                    {correct ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                )}
                {editing && (userAnswers[questionNum] || 0) !== (originalAnswers[questionNum] || 0) && <span className="answer-edit-badge">수정됨</span>}
              </button>
              
              {!editing && isRevealed && correctAnswers && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-blue-600 text-white rounded-lg shadow-lg border-2 border-blue-700">
                  <div className="text-xs opacity-80">정답</div>
                  <div className="text-2xl font-bold">{correctAnswers[questionNum]}</div>
                </div>
              )}
              </div>
              <QuestionRate question={questionNum} />
            </div>
            {editing && selectedQuestion && (questionNum % columns === 0 || questionNum === total) && Math.floor((selectedQuestion - 1) / columns) === Math.floor((questionNum - 1) / columns) && editor}
            </Fragment>
          );
        })}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <div>{editing ? '💡 문항을 눌러 답안을 수정한 뒤, 수정 반영을 눌러주세요.' : '💡 틀린 답(빨간색)을 클릭하면 정답을 확인할 수 있습니다.'}</div>
        <div className="mt-1">💡 메모 아이콘을 클릭하면 메모를 작성할 수 있습니다.</div>
      </div>
    </div>
  );
}
