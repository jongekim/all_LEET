import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageBackButtonProps {
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function PageBackButton({ to = '/', onClick, disabled }: PageBackButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={onClick ?? (() => navigate(to))}
      disabled={disabled}
      aria-label="돌아가기"
      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
      style={{ flexShrink: 0 }}
    >
      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">돌아가기</span>
    </button>
  );
}
