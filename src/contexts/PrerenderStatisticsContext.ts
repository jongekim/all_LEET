import { createContext } from 'react';
import type { StatisticsSnapshot } from '../types/questionStatistics';

// 빌드 전용 렌더러가 공개 통계를 주입한다. 브라우저에서는 기존 DB 조회를 사용한다.
export const PrerenderStatisticsContext = createContext<readonly StatisticsSnapshot[] | undefined>(undefined);
