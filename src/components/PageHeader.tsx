import type { ReactNode } from 'react';
import { PageBackButton } from './PageBackButton';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  backTo?: string;
  onBack?: () => void;
  backDisabled?: boolean;
}

export function PageHeader({ title, description, backTo, onBack, backDisabled }: PageHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div style={{ minWidth: 0 }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
            {description && <div className="text-sm text-gray-600 mt-1">{description}</div>}
          </div>
          <PageBackButton to={backTo} onClick={onBack} disabled={backDisabled} />
        </div>
      </div>
    </header>
  );
}
