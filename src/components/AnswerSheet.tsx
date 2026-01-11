import { GradingResult } from '../App';
import { useRef, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';

interface AnswerSheetProps {
  questionCount: number;
  userAnswers: Record<number, number>;
  onAnswerChange: (questionNumber: number, answer: number) => void;
  result: GradingResult | null;
  correctAnswers?: Record<number, number>;
}

export function AnswerSheet({ questionCount, userAnswers, onAnswerChange, result, correctAnswers }: AnswerSheetProps) {
  const questions = Array.from({ length: questionCount }, (_, i) => i + 1);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, questionCount);
  }, [questionCount]);

  // 결과가 바뀔 때마다 보여진 정답 초기화
  useEffect(() => {
    setRevealedAnswers(new Set());
  }, [result]);

  const handleInputChange = (questionNum: number, value: string) => {
    const numValue = parseInt(value);
    if (value === '') {
      // 빈 값이면 답안 삭제
      onAnswerChange(questionNum, 0);
    } else if (numValue >= 1 && numValue <= 5) {
      onAnswerChange(questionNum, numValue);
      // 자동으로 다음 입력 필드로 포커스 이동
      if (questionNum < questionCount) {
        const nextInput = inputRefs.current[questionNum];
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  const handleKeyDown = (questionNum: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // 백스페이스 키를 누르고 현재 입력이 비어있으면 이전 입력으로 이동
    if (e.key === 'Backspace' && !userAnswers[questionNum]) {
      if (questionNum > 1) {
        const prevInput = inputRefs.current[questionNum - 2];
        if (prevInput) {
          prevInput.focus();
        }
      }
    }
  };

  const toggleRevealAnswer = (questionNum: number) => {
    const newRevealed = new Set(revealedAnswers);
    if (newRevealed.has(questionNum)) {
      newRevealed.delete(questionNum);
    } else {
      newRevealed.add(questionNum);
    }
    setRevealedAnswers(newRevealed);
  };

  const isCorrect = (questionNum: number): boolean | null => {
    if (!correctAnswers || !userAnswers[questionNum]) return null;
    return userAnswers[questionNum] === correctAnswers[questionNum];
  };

  const getInputClassName = (questionNum: number): string => {
    const baseClass = "w-full px-3 py-2 border rounded-lg text-center font-semibold";
    const isAnswered = userAnswers[questionNum];
    
    if (!result || !isAnswered) {
      return `${baseClass} border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500`;
    }

    const correct = isCorrect(questionNum);
    if (correct === true) {
      return `${baseClass} border-green-500 bg-green-50 text-green-900`;
    } else if (correct === false) {
      return `${baseClass} border-red-500 bg-red-50 text-red-900 cursor-pointer hover:bg-red-100`;
    }
    
    return `${baseClass} border-gray-300`;
  };

  const handleCellClick = (questionNum: number) => {
    if (!result) return;
    const correct = isCorrect(questionNum);
    if (correct === false) {
      toggleRevealAnswer(questionNum);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          답안 입력 (총 {questionCount}문제)
        </h2>
        {result && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Check className="w-4 h-4 text-green-600" />
              <span className="text-green-600 font-semibold">맞음</span>
            </div>
            <div className="flex items-center gap-1">
              <X className="w-4 h-4 text-red-600" />
              <span className="text-red-600 font-semibold">틀림 (클릭하여 정답 보기)</span>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {questions.map((questionNum) => {
          const correct = isCorrect(questionNum);
          const isRevealed = revealedAnswers.has(questionNum);
          
          return (
            <div
              key={questionNum}
              className="flex items-center gap-2 relative"
            >
              <label className="font-semibold text-gray-700 min-w-[3rem]">
                {questionNum}.
              </label>
              <div className="relative flex-1">
                <input
                  ref={(el) => (inputRefs.current[questionNum - 1] = el)}
                  type="number"
                  min="1"
                  max="5"
                  value={userAnswers[questionNum] || ''}
                  onChange={(e) => handleInputChange(questionNum, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(questionNum, e)}
                  onClick={() => handleCellClick(questionNum)}
                  className={getInputClassName(questionNum)}
                  placeholder="1-5"
                  readOnly={result !== null}
                />
                {result && correct !== null && (
                  <div className="absolute -right-2 -top-2 bg-white rounded-full">
                    {correct ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <X className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                )}
                {isRevealed && correctAnswers && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-600 text-white font-bold text-lg rounded-lg pointer-events-none">
                    {correctAnswers[questionNum]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
