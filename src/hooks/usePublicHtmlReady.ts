import { useLayoutEffect } from 'react';
import { finishPublicHtml } from '../utils/publicHtml';

export function usePublicHtmlReady(ready: boolean) {
  useLayoutEffect(() => { if (ready) finishPublicHtml(); }, [ready]);
}
