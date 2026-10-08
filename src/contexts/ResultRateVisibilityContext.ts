import { createContext } from 'react';

export const ResultRateVisibilityContext = createContext<{
  visible: boolean;
  toggle: () => void;
} | null>(null);
