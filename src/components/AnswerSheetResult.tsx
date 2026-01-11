import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface AnswerSheetResultProps {
  total: number;
  userAnswers: Record<number, number>;
  correctAnswers?: Record<number, number>;
}

export function AnswerSheetResult({ total, userAnswers, correctAnswers }: AnswerSheetResultProps) {
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

  const isCorrect = (questionNum: number): boolean | null => {
    if (!correctAnswers || !userAnswers || !userAnswers[questionNum]) return null;
    return userAnswers[questionNum] === correctAnswers[questionNum];
  };

  const getCellClassName = (questionNum: number): string => {
    const baseClass = "text-center p-3 rounded-lg border-2 font-semibold transition-all";
    const userAnswer = userAnswers?.[questionNum];
    
    if (!userAnswer) {
      return `${baseClass} bg-gray-50 border-gray-200 text-gray-400`;
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
            <span className="text-gray-600">틀림 (클릭하여 정답 보기)</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
        {Array.from({ length: total }, (_, i) => i + 1).map((questionNum) => {
          const correct = isCorrect(questionNum);
          const isRevealed = revealedQuestions.has(questionNum);
          const userAnswer = userAnswers?.[questionNum];
          
          return (
            <div
              key={questionNum}
              className="relative"
              onClick={() => handleCellClick(questionNum)}
            >
              <div className={getCellClassName(questionNum)}>
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
        💡 틀린 답(빨간색)을 클릭하면 정답을 확인할 수 있습니다.
      </div>
    </div>
  );
}