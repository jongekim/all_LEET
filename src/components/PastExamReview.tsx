import { useState, type ReactNode } from 'react';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export function PastExamReview({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className="past-exam-review-trigger bg-white rounded-lg shadow"
        aria-label={open ? '정답·점수표 숨기기' : '정답표·점수 환산표 보기'}
      >
        <ClipboardList className="past-exam-review-icon text-blue-600" size={22} aria-hidden="true" />
        <span className="past-exam-review-description">
          <span className="text-lg font-bold text-gray-900">정답표·점수 환산표</span>
          <span className="text-sm text-gray-600">{open ? '다시 누르면 두 표가 접힙니다.' : '문제를 푼 뒤 눌러서 확인하세요.'}</span>
          <span className="text-xs text-blue-600">{open ? '정답·점수표 숨기기' : '정답·점수표 보기'}</span>
        </span>
        <ChevronDown className="past-exam-review-chevron text-gray-500" size={20} aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="past-exam-review-content space-y-6">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
