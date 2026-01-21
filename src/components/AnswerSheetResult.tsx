import { useState } from 'react';
import { Check, X, StickyNote } from 'lucide-react';

interface AnswerSheetResultProps {
  total: number;
  userAnswers: Record<number, number>;
  correctAnswers?: Record<number, number>;
  notes?: Record<number, string>;
  onOpenNote?: (questionNum: number) => void;
}

export function AnswerSheetResult({ total, userAnswers, correctAnswers, notes, onOpenNote }: AnswerSheetResultProps) {
  const [revealedQuestions, setRevealedQuestions] = useState<Set<number>>(new Set());

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
    const correct = isCorrect(questionNum);
    if (correct === true) {
      return `${baseClass} bg-green-50 border-green-500 text-green-900`;
    } else if (correct === false) {
      return `${baseClass} bg-red-50 border-red-500 text-red-900 cursor-pointer hover:bg-red-100 hover:shadow-md`;
    }
    
    return `${baseClass} bg-gray-50 border-gray-300 text-gray-900`;
  };

  const handleCellClick = (questionNum: number) => {
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
            {Array.from({ length: total }, (_, i) => i + 1).filter(q => isCorrect(q) === true).length}
          </span> / {total}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-50 border-2 border-green-500 rounded"></div>
            <span className="text-gray-600">맞음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-50 border-2 border-red-500 rounded"></div>
            <span className="text-gray-600">틀림/미제출 (클릭하여 정답 보기)</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 ml-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((questionNum) => {
          const correct = isCorrect(questionNum);
          const isRevealed = revealedQuestions.has(questionNum);
          const userAnswer = getUserAnswer(questionNum);
          const noteText = (notes?.[questionNum] || '').trim();
          const hasNote = noteText.length > 0;
          
          return (
            <div
              key={questionNum}
              className="relative overflow-visible"
            >
              {onOpenNote && (
                <button
                  type="button"
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
              <div
                className={getCellClassName(questionNum)}
                onClick={() => handleCellClick(questionNum)}
              >
                <div className="text-xs text-gray-500 mb-1">{questionNum}</div>
                <div className="text-lg">{userAnswer || '-'}</div>
                
                {correct !== null && (
                  <div className="absolute -top-1 -right-1 bg-white rounded-full shadow-sm">
                    {correct ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <X className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                )}
              </div>
              
              {isRevealed && correctAnswers && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-600 text-white rounded-lg shadow-lg border-2 border-blue-700">
                  <div className="text-xs opacity-80">정답</div>
                  <div className="text-2xl font-bold">{correctAnswers[questionNum]}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
        <div>💡 틀린 답/미제출(빨간색)을 클릭하면 정답을 확인할 수 있습니다.</div>
        <div className="mt-1">💡 메모 아이콘을 클릭하면 문제별로 메모를 작성할 수 있습니다.</div>
      </div>
    </div>
  );
}