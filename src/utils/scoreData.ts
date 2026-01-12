import { Year, Subject } from '../App';

// 정답 개수에 따른 표준점수와 백분위 데이터
export interface ScoreConversion {
  standardScore: number;
  percentile: number;
}

// 과목별 점수 변환 테이블 (정답 개수 -> 표준점수/백분위)
type SubjectScoreTable = Record<number, ScoreConversion>;

// 연도별 점수 변환 데이터
interface YearScoreData {
  verbal: SubjectScoreTable;
  reasoning: SubjectScoreTable;
}

type ScoreDatabase = Record<Year, YearScoreData>;

// 실제 LEET 점수 변환 데이터
// 각 연도/과목별로 정답 개수에 따른 표준점수와 백분위를 입력하세요
export const SCORE_DATA: ScoreDatabase = {
  '09예비': {
    verbal: {
      // [언어이해] 40문항 만점 (2009년 예비시험 추정 자료 기반)
    // 표준점수: 제공된 예상 T점수표 사용
    // 백분위: 제공된 언어이해 빈도 누적비 기반 보간 추정
    40: { standardScore: 84.4, percentile: 100.0 }, // 구간 초과 (100% 수렴)
    39: { standardScore: 82.5, percentile: 100.0 },
    38: { standardScore: 80.6, percentile: 100.0 },
    37: { standardScore: 78.7, percentile: 100.0 }, // 빈도표상 75점 이상 0명
    36: { standardScore: 76.8, percentile: 99.9 },  // 최상위권 추정
    35: { standardScore: 74.9, percentile: 99.8 },  // 70-74구간 상단
    34: { standardScore: 73.0, percentile: 99.7 },  // 70-74구간
    33: { standardScore: 71.1, percentile: 99.6 },
    32: { standardScore: 69.2, percentile: 99.0 },  // 65-69구간 보간
    31: { standardScore: 67.3, percentile: 97.5 },
    30: { standardScore: 65.4, percentile: 96.5 },
    29: { standardScore: 63.5, percentile: 93.0 },  // 60-64구간 보간
    28: { standardScore: 61.6, percentile: 88.0 },
    27: { standardScore: 59.7, percentile: 83.0 },
    26: { standardScore: 57.8, percentile: 78.0 },  // 55-59구간 보간
    25: { standardScore: 55.9, percentile: 69.5 },
    24: { standardScore: 54.0, percentile: 63.5 },  // 50-54구간 보간
    23: { standardScore: 52.1, percentile: 52.0 },
    22: { standardScore: 50.2, percentile: 43.8 },
    21: { standardScore: 48.3, percentile: 39.5 },  // 45-49구간 보간
    20: { standardScore: 46.4, percentile: 33.5 },
    19: { standardScore: 44.5, percentile: 28.5 },
    18: { standardScore: 42.6, percentile: 23.0 },  // 40-44구간 보간
    17: { standardScore: 40.7, percentile: 19.0 },
    16: { standardScore: 38.8, percentile: 16.5 },  // 35-39구간 보간
    15: { standardScore: 36.9, percentile: 12.0 },
    14: { standardScore: 35.0, percentile: 9.7 },   // 30-34구간 보간
    13: { standardScore: 33.1, percentile: 6.5 },
    12: { standardScore: 31.2, percentile: 4.0 },
    11: { standardScore: 29.3, percentile: 2.9 },   // 25-29구간 보간
    10: { standardScore: 27.4, percentile: 2.0 },
    9: { standardScore: 25.5, percentile: 1.3 },
    8: { standardScore: 23.6, percentile: 1.0 },    // 20-24구간 보간
    7: { standardScore: 21.7, percentile: 0.5 },
    6: { standardScore: 19.8, percentile: 0.1 },    // 15-19구간 (0% 수렴)
    5: { standardScore: 17.9, percentile: 0.0 },
    4: { standardScore: 16.0, percentile: 0.0 },
    3: { standardScore: 14.1, percentile: 0.0 },
    2: { standardScore: 12.2, percentile: 0.0 },
    1: { standardScore: 10.3, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점 (2009년 예비시험 추정 자료 기반)
    // 표준점수: 제공된 예상 T점수표 사용
    // 백분위: 제공된 추리논증 빈도 누적비 기반 보간 추정
    40: { standardScore: 84.4, percentile: 100.0 },
    39: { standardScore: 82.5, percentile: 100.0 },
    38: { standardScore: 80.6, percentile: 100.0 },
    37: { standardScore: 78.7, percentile: 100.0 },
    36: { standardScore: 76.8, percentile: 100.0 }, // 빈도표상 75점 이상 극소수
    35: { standardScore: 74.9, percentile: 99.9 },  // 70-74구간 상단
    34: { standardScore: 73.0, percentile: 99.5 },
    33: { standardScore: 71.1, percentile: 99.0 },
    32: { standardScore: 69.2, percentile: 98.7 },  // 65-69구간 보간
    31: { standardScore: 67.3, percentile: 96.5 },
    30: { standardScore: 65.4, percentile: 95.0 },
    29: { standardScore: 63.5, percentile: 92.0 },  // 60-64구간 보간
    28: { standardScore: 61.6, percentile: 88.0 },
    27: { standardScore: 59.7, percentile: 83.5 },
    26: { standardScore: 57.8, percentile: 79.5 },  // 55-59구간 보간
    25: { standardScore: 55.9, percentile: 71.0 },
    24: { standardScore: 54.0, percentile: 67.0 },  // 50-54구간 보간
    23: { standardScore: 52.1, percentile: 56.5 },
    22: { standardScore: 50.2, percentile: 48.0 },
    21: { standardScore: 48.3, percentile: 44.0 },  // 45-49구간 보간
    20: { standardScore: 46.4, percentile: 36.0 },
    19: { standardScore: 44.5, percentile: 28.5 },  // 40-44구간 보간
    18: { standardScore: 42.6, percentile: 22.0 },
    17: { standardScore: 40.7, percentile: 18.0 },
    16: { standardScore: 38.8, percentile: 13.5 },  // 35-39구간 보간
    15: { standardScore: 36.9, percentile: 11.5 },
    14: { standardScore: 35.0, percentile: 8.0 },   // 30-34구간 보간
    13: { standardScore: 33.1, percentile: 6.5 },
    12: { standardScore: 31.2, percentile: 3.5 },
    11: { standardScore: 29.3, percentile: 2.7 },   // 25-29구간 보간
    10: { standardScore: 27.4, percentile: 1.5 },
    9: { standardScore: 25.5, percentile: 1.0 },
    8: { standardScore: 23.6, percentile: 0.1 },    // 20-24구간 보간
    7: { standardScore: 21.7, percentile: 0.1 },
    6: { standardScore: 19.8, percentile: 0.0 },
    5: { standardScore: 17.9, percentile: 0.0 },
    4: { standardScore: 16.0, percentile: 0.0 },
    3: { standardScore: 14.1, percentile: 0.0 },
    2: { standardScore: 12.2, percentile: 0.0 },
    1: { standardScore: 10.3, percentile: 0.0 },
    },
  },
  
  '2009': {
    verbal: {
    // [언어이해] 평균: 28.52
    // 15점 미만은 점수당 약 2.05점씩 차감하여 추정함
    40: { standardScore: 73.3, percentile: 99.9 },
    39: { standardScore: 71.3, percentile: 99.7 },
    38: { standardScore: 69.3, percentile: 99.0 },
    37: { standardScore: 67.2, percentile: 97.5 },
    36: { standardScore: 65.2, percentile: 95.0 },
    35: { standardScore: 63.2, percentile: 91.6 },
    34: { standardScore: 61.1, percentile: 87.1 },
    33: { standardScore: 59.1, percentile: 81.5 },
    32: { standardScore: 57.1, percentile: 74.8 },
    31: { standardScore: 55.0, percentile: 67.2 },
    30: { standardScore: 53.0, percentile: 59.1 },
    29: { standardScore: 51.0, percentile: 51.1 },
    28: { standardScore: 48.9, percentile: 43.3 },
    27: { standardScore: 46.9, percentile: 35.8 },
    26: { standardScore: 44.9, percentile: 29.3 },
    25: { standardScore: 42.8, percentile: 23.5 },
    24: { standardScore: 40.8, percentile: 18.2 },
    23: { standardScore: 38.8, percentile: 13.7 },
    // 이하 백분위 데이터 없음 (추세에 따라 감소 추정)
    22: { standardScore: 36.7, percentile: 9.5 },  // 추정
    21: { standardScore: 34.7, percentile: 6.0 },  // 추정
    20: { standardScore: 32.7, percentile: 3.5 },  // 추정
    19: { standardScore: 30.6, percentile: 2.0 },  // 추정
    18: { standardScore: 28.6, percentile: 1.0 },  // 추정
    17: { standardScore: 26.6, percentile: 0.5 },  // 추정
    16: { standardScore: 24.5, percentile: 0.2 },  // 추정
    15: { standardScore: 22.5, percentile: 0.1 },  // 추정
    // 이하 원점수 14~0 구간 (선형 감소 추정: -2.05/step)
    14: { standardScore: 20.5, percentile: 0.0 },
    13: { standardScore: 18.4, percentile: 0.0 },
    12: { standardScore: 16.4, percentile: 0.0 },
    11: { standardScore: 14.3, percentile: 0.0 },
    10: { standardScore: 12.3, percentile: 0.0 },
    9: { standardScore: 10.2, percentile: 0.0 },
    8: { standardScore: 8.2, percentile: 0.0 },
    7: { standardScore: 6.1, percentile: 0.0 },
    6: { standardScore: 4.1, percentile: 0.0 },
    5: { standardScore: 2.0, percentile: 0.0 },
    4: { standardScore: 0.0, percentile: 0.0 },
    3: { standardScore: 0.0, percentile: 0.0 }, // 통상 0점 미만 표기 안함
    2: { standardScore: 0.0, percentile: 0.0 },
    1: { standardScore: 0.0, percentile: 0.0 },
    0: { standardScore: 0.0, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 평균: 22.63
    // 15점 미만은 점수당 약 1.9점씩 차감하여 추정함
    40: { standardScore: 83.0, percentile: 100.0 },
    39: { standardScore: 81.1, percentile: 100.0 },
    38: { standardScore: 79.2, percentile: 100.0 },
    37: { standardScore: 77.3, percentile: 99.9 },
    36: { standardScore: 75.4, percentile: 99.7 },
    35: { standardScore: 73.5, percentile: 99.4 },
    34: { standardScore: 71.6, percentile: 98.8 },
    33: { standardScore: 69.7, percentile: 97.9 },
    32: { standardScore: 67.8, percentile: 96.5 },
    31: { standardScore: 65.9, percentile: 94.6 },
    30: { standardScore: 64.0, percentile: 91.9 },
    29: { standardScore: 62.1, percentile: 88.0 },
    28: { standardScore: 60.2, percentile: 83.6 },
    27: { standardScore: 58.3, percentile: 78.8 },
    26: { standardScore: 56.4, percentile: 73.0 },
    25: { standardScore: 54.5, percentile: 66.4 },
    24: { standardScore: 52.6, percentile: 59.4 },
    23: { standardScore: 50.7, percentile: 52.1 },
    22: { standardScore: 48.8, percentile: 44.9 },
    21: { standardScore: 46.9, percentile: 37.7 },
    20: { standardScore: 45.0, percentile: 30.5 }, // 추정 (중간값 보간)
    19: { standardScore: 43.1, percentile: 24.5 }, // 추정 (중간값 보간)
    18: { standardScore: 41.2, percentile: 19.3 },
    17: { standardScore: 39.3, percentile: 14.5 },
    // 이하 백분위 데이터 없음 (추세에 따라 감소 추정)
    16: { standardScore: 37.4, percentile: 10.0 }, // 추정
    15: { standardScore: 35.5, percentile: 6.5 },  // 추정
    // 이하 원점수 14~0 구간 (선형 감소 추정: -1.9/step)
    14: { standardScore: 33.6, percentile: 4.0 },
    13: { standardScore: 31.7, percentile: 2.0 },
    12: { standardScore: 29.8, percentile: 1.0 },
    11: { standardScore: 27.9, percentile: 0.5 },
    10: { standardScore: 26.0, percentile: 0.1 },
    9: { standardScore: 24.1, percentile: 0.0 },
    8: { standardScore: 22.2, percentile: 0.0 },
    7: { standardScore: 20.3, percentile: 0.0 },
    6: { standardScore: 18.4, percentile: 0.0 },
    5: { standardScore: 16.5, percentile: 0.0 },
    4: { standardScore: 14.6, percentile: 0.0 },
    3: { standardScore: 12.7, percentile: 0.0 },
    2: { standardScore: 10.8, percentile: 0.0 },
    1: { standardScore: 8.9, percentile: 0.0 },
    0: { standardScore: 7.0, percentile: 0.0 },
    },
  },
  
  '2010': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 20.84
    // 16점 미만은 점수당 약 2.25점씩 차감하여 추정
    35: { standardScore: 81.8, percentile: 100.0 }, // 백분위 표기 없으나 최상위로 100 추정
    34: { standardScore: 79.5, percentile: 100.0 },  // 백분위 표기 없으나 최상위로 99.9 추정
    33: { standardScore: 77.3, percentile: 100.0 },
    32: { standardScore: 75.0, percentile: 99.8 },
    31: { standardScore: 72.8, percentile: 99.5 },
    30: { standardScore: 70.6, percentile: 98.8 },
    29: { standardScore: 68.3, percentile: 97.5 },
    28: { standardScore: 66.1, percentile: 95.3 },
    27: { standardScore: 63.8, percentile: 92.0 },
    26: { standardScore: 61.6, percentile: 87.5 },
    25: { standardScore: 59.3, percentile: 81.8 },
    24: { standardScore: 57.1, percentile: 74.9 },
    23: { standardScore: 54.8, percentile: 67.1 },
    22: { standardScore: 52.6, percentile: 58.8 },
    21: { standardScore: 50.4, percentile: 50.2 },
    20: { standardScore: 48.1, percentile: 41.4 },
    19: { standardScore: 45.9, percentile: 33.1 },
    18: { standardScore: 43.6, percentile: 25.7 },
    17: { standardScore: 41.4, percentile: 19.3 },
    // 이하 데이터 없음 (추세 기반 추정)
    16: { standardScore: 39.1, percentile: 14.0 }, // 추정
    15: { standardScore: 36.9, percentile: 10.0 },  // 추정
    14: { standardScore: 34.6, percentile: 7.0 },  // 추정
    13: { standardScore: 32.4, percentile: 4.5 },   // 추정
    12: { standardScore: 30.1, percentile: 2.5 },  // 추정
    11: { standardScore: 27.9, percentile: 1.0 },   // 추정
    10: { standardScore: 25.6, percentile: 0.5 },  // 추정
    9: { standardScore: 23.4, percentile: 0.1 },    // 추정
    8: { standardScore: 21.1, percentile: 0.0 },
    7: { standardScore: 18.9, percentile: 0.0 },
    6: { standardScore: 16.6, percentile: 0.0 },
    5: { standardScore: 14.4, percentile: 0.0 },
    4: { standardScore: 12.1, percentile: 0.0 },
    3: { standardScore: 9.9, percentile: 0.0 },
    2: { standardScore: 7.6, percentile: 0.0 },
    1: { standardScore: 5.4, percentile: 0.0 },
    0: { standardScore: 3.1, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 20.93
    // 16점 미만은 점수당 약 2.15점씩 차감하여 추정
    35: { standardScore: 80.1, percentile: 100.0 }, // 백분위 표기 없으나 최상위로 100 추정
    34: { standardScore: 78.0, percentile: 99.9 },
    33: { standardScore: 75.8, percentile: 99.8 },
    32: { standardScore: 73.7, percentile: 99.5 },
    31: { standardScore: 71.5, percentile: 98.9 },
    30: { standardScore: 69.4, percentile: 97.8 },
    29: { standardScore: 67.3, percentile: 96.1 },
    28: { standardScore: 65.1, percentile: 93.6 },
    27: { standardScore: 63.0, percentile: 90.3 },
    26: { standardScore: 60.8, percentile: 85.8 },
    25: { standardScore: 58.7, percentile: 80.3 },
    24: { standardScore: 56.6, percentile: 73.8 },
    23: { standardScore: 54.4, percentile: 66.1 },
    22: { standardScore: 52.3, percentile: 58.0 },
    21: { standardScore: 50.1, percentile: 49.7 },
    20: { standardScore: 48.0, percentile: 41.4 },
    19: { standardScore: 45.9, percentile: 33.5 },
    18: { standardScore: 43.7, percentile: 26.5 },
    17: { standardScore: 41.6, percentile: 20.0 }, // 백분위 표기 없음 (18점과 간격 고려 추정)
    // 이하 데이터 없음 (추세 기반 추정)
    16: { standardScore: 39.4, percentile: 15.0 }, // 추정
    15: { standardScore: 37.3, percentile: 11.0 },  // 추정
    14: { standardScore: 35.1, percentile: 7.5 },  // 추정
    13: { standardScore: 33.0, percentile: 5.0 },   // 추정
    12: { standardScore: 30.8, percentile: 3.0 },  // 추정
    11: { standardScore: 28.7, percentile: 1.5 },   // 추정
    10: { standardScore: 26.5, percentile: 0.8 },  // 추정
    9: { standardScore: 24.4, percentile: 0.2 },    // 추정
    8: { standardScore: 22.2, percentile: 0.0 },
    7: { standardScore: 20.1, percentile: 0.0 },
    6: { standardScore: 17.9, percentile: 0.0 },
    5: { standardScore: 15.8, percentile: 0.0 },
    4: { standardScore: 13.6, percentile: 0.0 },
    3: { standardScore: 11.5, percentile: 0.0 },
    2: { standardScore: 9.3, percentile: 0.0 },
    1: { standardScore: 7.2, percentile: 0.0 },
    0: { standardScore: 5.0, percentile: 0.0 },
    },
  },
  
  '2011': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 23.6
    // 데이터가 없는 8점 이하는 2.0점씩 차감하여 선형 추정
    35: { standardScore: 72.8, percentile: 99.9 },
    34: { standardScore: 70.8, percentile: 99.6 },
    33: { standardScore: 68.8, percentile: 98.8 },
    32: { standardScore: 66.8, percentile: 97.0 },
    31: { standardScore: 64.8, percentile: 94.2 },
    30: { standardScore: 62.8, percentile: 90.4 },
    29: { standardScore: 60.8, percentile: 85.7 },
    28: { standardScore: 58.8, percentile: 79.9 },
    27: { standardScore: 56.8, percentile: 73.2 },
    26: { standardScore: 54.8, percentile: 66.0 },
    25: { standardScore: 52.8, percentile: 58.1 },
    24: { standardScore: 50.8, percentile: 50.0 },
    23: { standardScore: 48.8, percentile: 42.4 },
    22: { standardScore: 46.8, percentile: 35.4 },
    21: { standardScore: 44.8, percentile: 29.0 },
    20: { standardScore: 42.8, percentile: 23.2 },
    19: { standardScore: 40.8, percentile: 18.1 },
    18: { standardScore: 38.8, percentile: 13.9 },
    17: { standardScore: 36.8, percentile: 10.4 },
    16: { standardScore: 34.8, percentile: 7.6 },
    15: { standardScore: 32.8, percentile: 5.5 },
    14: { standardScore: 30.8, percentile: 3.9 },
    13: { standardScore: 28.8, percentile: 2.6 },
    12: { standardScore: 26.8, percentile: 1.7 },
    11: { standardScore: 24.8, percentile: 1.0 }, // 백분위 공란 추정
    10: { standardScore: 22.8, percentile: 0.5 }, // 백분위 공란 추정
    9: { standardScore: 20.8, percentile: 0.1 },  // 백분위 공란 추정
    // 이하 추정 구간 (Slope: -2.0)
    8: { standardScore: 18.8, percentile: 0.0 },
    7: { standardScore: 16.8, percentile: 0.0 },
    6: { standardScore: 14.8, percentile: 0.0 },
    5: { standardScore: 12.8, percentile: 0.0 },
    4: { standardScore: 10.8, percentile: 0.0 },
    3: { standardScore: 8.8, percentile: 0.0 },
    2: { standardScore: 6.8, percentile: 0.0 },
    1: { standardScore: 4.8, percentile: 0.0 },
    0: { standardScore: 2.8, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 19.44
    // 데이터가 없는 8점 이하는 2.1점씩 차감하여 선형 추정
    35: { standardScore: 83.0, percentile: 100.0 },
    34: { standardScore: 80.9, percentile: 100.0 },
    33: { standardScore: 78.8, percentile: 99.8 },
    32: { standardScore: 76.6, percentile: 99.8 },
    31: { standardScore: 74.5, percentile: 99.6 },
    30: { standardScore: 72.4, percentile: 99.0 },
    29: { standardScore: 70.3, percentile: 98.1 },
    28: { standardScore: 68.2, percentile: 96.6 },
    27: { standardScore: 66.0, percentile: 94.5 },
    26: { standardScore: 63.9, percentile: 91.7 },
    25: { standardScore: 61.8, percentile: 88.0 },
    24: { standardScore: 59.7, percentile: 82.8 },
    23: { standardScore: 57.6, percentile: 76.8 },
    22: { standardScore: 55.4, percentile: 69.9 },
    21: { standardScore: 53.3, percentile: 62.2 },
    20: { standardScore: 51.2, percentile: 54.3 },
    19: { standardScore: 49.1, percentile: 46.2 },
    18: { standardScore: 47.0, percentile: 38.0 },
    17: { standardScore: 44.8, percentile: 30.5 },
    16: { standardScore: 42.7, percentile: 23.7 },
    15: { standardScore: 40.6, percentile: 17.7 },
    14: { standardScore: 38.5, percentile: 12.7 },
    13: { standardScore: 36.3, percentile: 8.8 },
    12: { standardScore: 34.2, percentile: 5.9 },
    11: { standardScore: 32.1, percentile: 3.9 },
    10: { standardScore: 30.0, percentile: 2.6 },
    9: { standardScore: 27.9, percentile: 1.4 },
    // 이하 추정 구간 (Slope: 약 -2.1)
    8: { standardScore: 25.8, percentile: 0.8 }, // 추정
    7: { standardScore: 23.7, percentile: 0.4 }, // 추정
    6: { standardScore: 21.6, percentile: 0.1 }, // 추정
    5: { standardScore: 19.5, percentile: 0.0 },
    4: { standardScore: 17.4, percentile: 0.0 },
    3: { standardScore: 15.3, percentile: 0.0 },
    2: { standardScore: 13.2, percentile: 0.0 },
    1: { standardScore: 11.1, percentile: 0.0 },
    0: { standardScore: 9.0, percentile: 0.0 },
    },
  },
  
  '2012': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 20.33
    // 16점 미만은 점수당 약 2.35점씩 차감하여 추정
    35: { standardScore: 84.7, percentile: 100.0 }, // 추정
    34: { standardScore: 82.4, percentile: 99.9 },  // 추정
    33: { standardScore: 80.0, percentile: 99.9 },  // 추정
    32: { standardScore: 77.6, percentile: 99.8 },  // 추정
    31: { standardScore: 75.3, percentile: 99.7 },  // 추정
    30: { standardScore: 72.9, percentile: 99.5 },
    29: { standardScore: 70.5, percentile: 98.7 },
    28: { standardScore: 68.2, percentile: 97.2 },
    27: { standardScore: 65.8, percentile: 95.0 },
    26: { standardScore: 63.4, percentile: 91.4 },
    25: { standardScore: 61.1, percentile: 86.5 },
    24: { standardScore: 58.7, percentile: 80.3 },
    23: { standardScore: 56.4, percentile: 72.4 },
    22: { standardScore: 54.0, percentile: 63.8 },
    21: { standardScore: 51.6, percentile: 54.9 },
    20: { standardScore: 49.3, percentile: 45.7 },
    19: { standardScore: 46.9, percentile: 36.9 },
    18: { standardScore: 44.6, percentile: 28.9 },
    17: { standardScore: 42.2, percentile: 22.4 }, // 중간값 보간 추정
    16: { standardScore: 39.8, percentile: 15.9 },
    // 이하 추정 구간 (Slope: 약 -2.35)
    15: { standardScore: 37.4, percentile: 11.0 }, // 추정
    14: { standardScore: 35.1, percentile: 7.5 },   // 추정
    13: { standardScore: 32.7, percentile: 5.0 },  // 추정
    12: { standardScore: 30.4, percentile: 3.5 },   // 추정
    11: { standardScore: 28.0, percentile: 2.0 },  // 추정
    10: { standardScore: 25.7, percentile: 1.0 },   // 추정
    9: { standardScore: 23.3, percentile: 0.5 },
    8: { standardScore: 21.0, percentile: 0.1 },
    7: { standardScore: 18.6, percentile: 0.0 },
    6: { standardScore: 16.3, percentile: 0.0 },
    5: { standardScore: 13.9, percentile: 0.0 },
    4: { standardScore: 11.6, percentile: 0.0 },
    3: { standardScore: 9.2, percentile: 0.0 },
    2: { standardScore: 6.9, percentile: 0.0 },
    1: { standardScore: 4.5, percentile: 0.0 },
    0: { standardScore: 2.2, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 19.86
    // 16점 미만은 점수당 약 2.45점씩 차감하여 추정
    35: { standardScore: 87.3, percentile: 100.0 }, // 추정
    34: { standardScore: 84.8, percentile: 100.0 }, // 추정
    33: { standardScore: 82.4, percentile: 100.0 }, // 추정
    32: { standardScore: 79.9, percentile: 100.0 }, // 추정
    31: { standardScore: 77.5, percentile: 99.9 },
    30: { standardScore: 75.0, percentile: 99.7 },
    29: { standardScore: 72.6, percentile: 99.3 },
    28: { standardScore: 70.1, percentile: 98.4 },
    27: { standardScore: 67.7, percentile: 97.0 },
    26: { standardScore: 65.2, percentile: 94.5 },
    25: { standardScore: 62.7, percentile: 90.6 },
    24: { standardScore: 60.3, percentile: 84.9 },
    23: { standardScore: 57.8, percentile: 77.6 },
    22: { standardScore: 55.3, percentile: 69.0 },
    21: { standardScore: 52.9, percentile: 59.7 },
    20: { standardScore: 50.4, percentile: 50.0 },
    19: { standardScore: 47.9, percentile: 40.2 },
    18: { standardScore: 45.5, percentile: 31.2 },
    17: { standardScore: 43.0, percentile: 23.4 },
    16: { standardScore: 41.6, percentile: 16.0 }, // 백분위 공란 추정
    // 이하 추정 구간 (Slope: 약 -2.45)
    15: { standardScore: 39.1, percentile: 11.0 }, // 추정
    14: { standardScore: 36.7, percentile: 8.0 },    // 추정
    13: { standardScore: 34.2, percentile: 5.5 },   // 추정
    12: { standardScore: 31.8, percentile: 3.5 },    // 추정
    11: { standardScore: 29.3, percentile: 2.0 },   // 추정
    10: { standardScore: 26.9, percentile: 1.0 },    // 추정
    9: { standardScore: 24.4, percentile: 0.5 },
    8: { standardScore: 22.0, percentile: 0.1 },
    7: { standardScore: 19.5, percentile: 0.0 },
    6: { standardScore: 17.1, percentile: 0.0 },
    5: { standardScore: 14.6, percentile: 0.0 },
    4: { standardScore: 12.2, percentile: 0.0 },
    3: { standardScore: 9.7, percentile: 0.0 },
    2: { standardScore: 7.3, percentile: 0.0 },
    1: { standardScore: 4.8, percentile: 0.0 },
    0: { standardScore: 2.4, percentile: 0.0 },
    },
  },
  
  '2013': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 18.48
    // 15점 미만은 점수당 약 2.3점씩 차감하여 추정
    35: { standardScore: 88.2, percentile: 100.0 },
    34: { standardScore: 85.9, percentile: 100.0 },
    33: { standardScore: 83.6, percentile: 100.0 },
    32: { standardScore: 81.3, percentile: 99.9 },
    31: { standardScore: 79.0, percentile: 99.9 },
    30: { standardScore: 76.7, percentile: 99.7 },
    29: { standardScore: 74.3, percentile: 99.4 },
    28: { standardScore: 72.0, percentile: 98.9 },
    27: { standardScore: 69.7, percentile: 97.8 },
    26: { standardScore: 67.4, percentile: 95.9 },
    25: { standardScore: 65.1, percentile: 93.3 },
    24: { standardScore: 62.8, percentile: 89.6 },
    23: { standardScore: 60.5, percentile: 84.8 },
    22: { standardScore: 58.1, percentile: 78.9 },
    21: { standardScore: 55.8, percentile: 71.6 },
    20: { standardScore: 53.5, percentile: 63.6 },
    19: { standardScore: 51.2, percentile: 54.8 },
    18: { standardScore: 48.9, percentile: 45.5 },
    17: { standardScore: 46.6, percentile: 36.7 },
    16: { standardScore: 44.3, percentile: 28.4 },
    15: { standardScore: 42.0, percentile: 21.2 },
    // 이하 추정 구간 (Slope: 약 -2.3)
    14: { standardScore: 39.7, percentile: 15.0 }, // 추정
    13: { standardScore: 37.4, percentile: 10.0 }, // 추정
    12: { standardScore: 35.1, percentile: 7.0 },  // 추정
    11: { standardScore: 32.8, percentile: 5.0 },  // 추정
    10: { standardScore: 30.5, percentile: 3.5 },  // 추정
    9: { standardScore: 28.2, percentile: 2.0 },   // 추정
    8: { standardScore: 25.9, percentile: 1.0 },
    7: { standardScore: 23.6, percentile: 0.5 },
    6: { standardScore: 21.3, percentile: 0.1 },
    5: { standardScore: 19.0, percentile: 0.0 },
    4: { standardScore: 16.7, percentile: 0.0 },
    3: { standardScore: 14.4, percentile: 0.0 },
    2: { standardScore: 12.1, percentile: 0.0 },
    1: { standardScore: 9.8, percentile: 0.0 },
    0: { standardScore: 7.5, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 18.86
    // 15점 미만은 점수당 약 2.4점씩 차감하여 추정
    35: { standardScore: 88.3, percentile: 100.0 },
    34: { standardScore: 85.9, percentile: 100.0 },
    33: { standardScore: 83.5, percentile: 100.0 },
    32: { standardScore: 81.1, percentile: 100.0 },
    31: { standardScore: 78.8, percentile: 99.9 },
    30: { standardScore: 76.4, percentile: 99.8 },
    29: { standardScore: 74.0, percentile: 99.5 },
    28: { standardScore: 71.7, percentile: 98.9 },
    27: { standardScore: 69.3, percentile: 97.8 },
    26: { standardScore: 66.9, percentile: 95.9 },
    25: { standardScore: 64.6, percentile: 88.7 },
    24: { standardScore: 62.2, percentile: 76.7 }, // 오타수정
    23: { standardScore: 59.8, percentile: 73.4 }, // 오타수정
    22: { standardScore: 57.4, percentile: 68.9 },
    21: { standardScore: 55.1, percentile: 59.7 },
    20: { standardScore: 52.7, percentile: 50.2 },
    19: { standardScore: 50.3, percentile: 40.9 },
    18: { standardScore: 48.0, percentile: 32.5 },
    17: { standardScore: 38.5, percentile: 24.8 }, // 원본값 유지 (표준점수 급락 구간 주의)
    16: { standardScore: 36.1, percentile: 18.3 },
    15: { standardScore: 33.7, percentile: 13.0 },
    // 이하 추정 구간 (Slope: 약 -2.4)
    14: { standardScore: 31.3, percentile: 9.0 },  // 추정
    13: { standardScore: 28.9, percentile: 6.0 },  // 추정
    12: { standardScore: 26.5, percentile: 4.0 },  // 추정
    11: { standardScore: 24.1, percentile: 2.5 },  // 추정
    10: { standardScore: 21.7, percentile: 1.5 },  // 추정
    9: { standardScore: 19.3, percentile: 0.8 },   // 추정
    8: { standardScore: 16.9, percentile: 0.3 },
    7: { standardScore: 14.5, percentile: 0.1 },
    6: { standardScore: 12.1, percentile: 0.0 },
    5: { standardScore: 9.7, percentile: 0.0 },
    4: { standardScore: 7.3, percentile: 0.0 },
    3: { standardScore: 4.9, percentile: 0.0 },
    2: { standardScore: 2.5, percentile: 0.0 },
    1: { standardScore: 0.1, percentile: 0.0 },
    0: { standardScore: 0.0, percentile: 0.0 },
    },
  },
  
  '2014': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 25.1
    // 15점 미만은 점수당 1.9점씩 차감하여 추정
    35: { standardScore: 68.9, percentile: 99.7 },
    34: { standardScore: 67.0, percentile: 98.6 },
    33: { standardScore: 65.1, percentile: 95.2 },
    32: { standardScore: 63.2, percentile: 92.3 },
    31: { standardScore: 61.3, percentile: 87.1 },
    30: { standardScore: 59.4, percentile: 81.2 },
    29: { standardScore: 57.5, percentile: 74.7 },
    28: { standardScore: 55.6, percentile: 67.5 },
    27: { standardScore: 53.7, percentile: 60.0 },
    26: { standardScore: 51.8, percentile: 52.5 },
    25: { standardScore: 49.9, percentile: 45.1 },
    24: { standardScore: 48.0, percentile: 38.2 },
    23: { standardScore: 46.1, percentile: 31.8 },
    22: { standardScore: 44.2, percentile: 26.2 },
    21: { standardScore: 42.3, percentile: 21.3 },
    20: { standardScore: 40.4, percentile: 16.9 },
    19: { standardScore: 38.5, percentile: 13.3 },
    18: { standardScore: 36.6, percentile: 10.5 },
    17: { standardScore: 34.7, percentile: 8.1 },
    16: { standardScore: 32.8, percentile: 6.1 },
    15: { standardScore: 30.9, percentile: 4.5 },
    // 이하 추정 구간 (Slope: -1.9)
    14: { standardScore: 29.0, percentile: 3.5 }, // 추정
    13: { standardScore: 27.1, percentile: 2.5 }, // 추정
    12: { standardScore: 25.2, percentile: 1.8 }, // 추정
    11: { standardScore: 23.3, percentile: 1.2 }, // 추정
    10: { standardScore: 21.4, percentile: 0.8 }, // 추정
    9: { standardScore: 19.5, percentile: 0.5 },  // 추정
    8: { standardScore: 17.6, percentile: 0.2 },
    7: { standardScore: 15.7, percentile: 0.1 },
    6: { standardScore: 13.8, percentile: 0.0 },
    5: { standardScore: 11.9, percentile: 0.0 },
    4: { standardScore: 10.0, percentile: 0.0 },
    3: { standardScore: 8.1, percentile: 0.0 },
    2: { standardScore: 6.2, percentile: 0.0 },
    1: { standardScore: 4.3, percentile: 0.0 },
    0: { standardScore: 2.4, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 22.4
    // 15점 미만은 점수당 약 2.05점씩 차감하여 추정
    35: { standardScore: 75.9, percentile: 100.0 },
    34: { standardScore: 73.9, percentile: 99.8 },
    33: { standardScore: 71.8, percentile: 99.4 },
    32: { standardScore: 69.8, percentile: 98.5 },
    31: { standardScore: 67.7, percentile: 97.2 },
    30: { standardScore: 65.6, percentile: 95.2 },
    29: { standardScore: 63.6, percentile: 92.2 },
    28: { standardScore: 61.5, percentile: 87.9 },
    27: { standardScore: 59.5, percentile: 82.6 },
    26: { standardScore: 57.4, percentile: 76.0 },
    25: { standardScore: 55.3, percentile: 68.3 },
    24: { standardScore: 53.3, percentile: 60.5 },
    23: { standardScore: 51.2, percentile: 52.5 },
    22: { standardScore: 49.2, percentile: 44.8 },
    21: { standardScore: 47.1, percentile: 37.2 },
    20: { standardScore: 45.1, percentile: 29.8 },
    19: { standardScore: 43.0, percentile: 23.4 },
    18: { standardScore: 40.9, percentile: 17.9 },
    17: { standardScore: 38.9, percentile: 13.6 },
    16: { standardScore: 36.8, percentile: 10.1 },
    15: { standardScore: 34.8, percentile: 5.3 },
    // 이하 추정 구간 (Slope: 약 -2.05)
    14: { standardScore: 32.7, percentile: 3.5 }, // 추정
    13: { standardScore: 30.7, percentile: 2.0 },  // 추정
    12: { standardScore: 28.6, percentile: 1.0 }, // 추정
    11: { standardScore: 26.6, percentile: 0.5 },  // 추정
    10: { standardScore: 24.5, percentile: 0.2 }, // 추정
    9: { standardScore: 22.5, percentile: 0.1 },   // 추정
    8: { standardScore: 20.4, percentile: 0.0 },
    7: { standardScore: 18.4, percentile: 0.0 },
    6: { standardScore: 16.3, percentile: 0.0 },
    5: { standardScore: 14.3, percentile: 0.0 },
    4: { standardScore: 12.2, percentile: 0.0 },
    3: { standardScore: 10.2, percentile: 0.0 },
    2: { standardScore: 8.1, percentile: 0.0 },
    1: { standardScore: 6.1, percentile: 0.0 },
    0: { standardScore: 4.0, percentile: 0.0 },
    },
  },
  
  '2015': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 24.0
    // 15점 미만은 점수당 약 1.9점씩 차감하여 추정
    35: { standardScore: 70.8, percentile: 99.8 },
    34: { standardScore: 68.9, percentile: 99.2 },
    33: { standardScore: 67.0, percentile: 97.8 },
    32: { standardScore: 65.1, percentile: 95.5 },
    31: { standardScore: 63.2, percentile: 92.1 },
    30: { standardScore: 61.3, percentile: 87.6 },
    29: { standardScore: 59.4, percentile: 82.1 },
    28: { standardScore: 57.5, percentile: 75.5 }, // 중간값 보간 추정 (29점 82.1 <-> 27점 68.8)
    27: { standardScore: 55.7, percentile: 68.8 },
    26: { standardScore: 53.8, percentile: 61.3 },
    25: { standardScore: 51.9, percentile: 53.4 },
    24: { standardScore: 50.0, percentile: 46.0 },
    23: { standardScore: 48.1, percentile: 39.0 },
    22: { standardScore: 46.2, percentile: 32.6 },
    21: { standardScore: 44.3, percentile: 26.8 },
    20: { standardScore: 42.4, percentile: 21.6 },
    19: { standardScore: 40.5, percentile: 17.2 },
    18: { standardScore: 38.6, percentile: 13.5 },
    17: { standardScore: 36.7, percentile: 10.2 },
    16: { standardScore: 34.8, percentile: 7.7 },
    15: { standardScore: 32.9, percentile: 5.8 },
    // 이하 추정 구간 (Slope: 약 -1.9)
    14: { standardScore: 31.0, percentile: 4.5 }, // 추정
    13: { standardScore: 29.1, percentile: 3.5 }, // 추정
    12: { standardScore: 27.2, percentile: 2.5 }, // 추정
    11: { standardScore: 25.3, percentile: 1.8 }, // 추정
    10: { standardScore: 23.4, percentile: 1.2 }, // 추정
    9: { standardScore: 21.5, percentile: 0.8 },  // 추정
    8: { standardScore: 19.6, percentile: 0.5 },
    7: { standardScore: 17.7, percentile: 0.2 },
    6: { standardScore: 15.8, percentile: 0.0 },
    5: { standardScore: 13.9, percentile: 0.0 },
    4: { standardScore: 12.0, percentile: 0.0 },
    3: { standardScore: 10.1, percentile: 0.0 },
    2: { standardScore: 8.2, percentile: 0.0 },
    1: { standardScore: 6.3, percentile: 0.0 },
    0: { standardScore: 4.4, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 21.4
    // 15점 미만은 점수당 약 2.15점씩 차감하여 추정
    35: { standardScore: 79.2, percentile: 100.0 },
    34: { standardScore: 77.1, percentile: 100.0 },
    33: { standardScore: 74.9, percentile: 99.8 },
    32: { standardScore: 72.8, percentile: 99.5 },
    31: { standardScore: 70.6, percentile: 98.9 },
    30: { standardScore: 68.5, percentile: 97.7 },
    29: { standardScore: 66.4, percentile: 95.6 },
    28: { standardScore: 64.2, percentile: 92.6 },
    27: { standardScore: 62.1, percentile: 88.7 },
    26: { standardScore: 59.9, percentile: 83.6 },
    25: { standardScore: 57.8, percentile: 77.3 },
    24: { standardScore: 55.7, percentile: 70.2 },
    23: { standardScore: 53.5, percentile: 62.3 },
    22: { standardScore: 51.4, percentile: 54.0 },
    21: { standardScore: 49.2, percentile: 45.5 },
    20: { standardScore: 47.1, percentile: 37.3 },
    19: { standardScore: 45.0, percentile: 29.7 },
    18: { standardScore: 42.8, percentile: 23.0 },
    17: { standardScore: 40.7, percentile: 17.6 },
    16: { standardScore: 38.5, percentile: 13.0 },
    15: { standardScore: 36.4, percentile: 9.2 },
    // 이하 추정 구간 (Slope: 약 -2.15)
    14: { standardScore: 34.2, percentile: 6.5 }, // 추정
    13: { standardScore: 32.1, percentile: 4.5 },  // 추정
    12: { standardScore: 29.9, percentile: 3.0 }, // 추정
    11: { standardScore: 27.8, percentile: 2.0 },  // 추정
    10: { standardScore: 25.6, percentile: 1.2 }, // 추정
    9: { standardScore: 23.5, percentile: 0.8 },   // 추정
    8: { standardScore: 21.3, percentile: 0.4 },
    7: { standardScore: 19.2, percentile: 0.1 },
    6: { standardScore: 17.0, percentile: 0.0 },
    5: { standardScore: 14.9, percentile: 0.0 },
    4: { standardScore: 12.7, percentile: 0.0 },
    3: { standardScore: 10.6, percentile: 0.0 },
    2: { standardScore: 8.4, percentile: 0.0 },
    1: { standardScore: 6.3, percentile: 0.0 },
    0: { standardScore: 4.1, percentile: 0.0 },
    },
  },
  
  '2016': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 23.21
    // 15점 미만은 점수당 약 1.95점씩 차감하여 추정
    35: { standardScore: 73.0, percentile: 99.9 },
    34: { standardScore: 71.1, percentile: 99.7 },
    33: { standardScore: 69.1, percentile: 98.9 },
    32: { standardScore: 67.2, percentile: 97.4 },
    31: { standardScore: 65.2, percentile: 95.0 },
    30: { standardScore: 63.3, percentile: 91.7 },
    29: { standardScore: 61.3, percentile: 87.4 },
    28: { standardScore: 59.3, percentile: 81.8 },
    27: { standardScore: 57.4, percentile: 75.3 },
    26: { standardScore: 55.4, percentile: 68.3 },
    25: { standardScore: 53.5, percentile: 61.0 },
    24: { standardScore: 51.5, percentile: 53.4 },
    23: { standardScore: 49.6, percentile: 45.5 },
    22: { standardScore: 47.6, percentile: 38.1 }, // 이미지 판독 보정 (흐름상 38.1)
    21: { standardScore: 45.7, percentile: 31.3 },
    20: { standardScore: 43.7, percentile: 24.9 },
    19: { standardScore: 41.8, percentile: 19.8 },
    18: { standardScore: 39.8, percentile: 15.6 },
    17: { standardScore: 37.9, percentile: 12.0 },
    16: { standardScore: 35.9, percentile: 9.1 },
    15: { standardScore: 34.0, percentile: 6.7 },
    // 이하 추정 구간 (Slope: -1.95)
    14: { standardScore: 32.0, percentile: 5.0 }, // 추정
    13: { standardScore: 30.1, percentile: 4.0 },  // 추정
    12: { standardScore: 28.1, percentile: 3.0 }, // 추정
    11: { standardScore: 26.2, percentile: 2.0 },  // 추정
    10: { standardScore: 24.2, percentile: 1.5 }, // 추정
    9: { standardScore: 22.3, percentile: 1.0 },   // 추정
    8: { standardScore: 20.3, percentile: 0.5 },
    7: { standardScore: 18.4, percentile: 0.2 },
    6: { standardScore: 16.4, percentile: 0.0 },
    5: { standardScore: 14.5, percentile: 0.0 },
    4: { standardScore: 12.5, percentile: 0.0 },
    3: { standardScore: 10.6, percentile: 0.0 },
    2: { standardScore: 8.6, percentile: 0.0 },
    1: { standardScore: 6.7, percentile: 0.0 },
    0: { standardScore: 4.7, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 19.07
    // 15점 미만은 점수당 약 2.18점씩 차감하여 추정
    35: { standardScore: 84.7, percentile: 100.0 },
    34: { standardScore: 82.6, percentile: 100.0 },
    33: { standardScore: 80.4, percentile: 100.0 },
    32: { standardScore: 78.2, percentile: 100.0 },
    31: { standardScore: 76.0, percentile: 99.9 },
    30: { standardScore: 73.8, percentile: 99.6 },
    29: { standardScore: 71.7, percentile: 99.2 },
    28: { standardScore: 69.5, percentile: 98.2 },
    27: { standardScore: 67.3, percentile: 96.5 },
    26: { standardScore: 65.1, percentile: 93.9 },
    25: { standardScore: 62.9, percentile: 90.4 },
    24: { standardScore: 60.8, percentile: 85.7 },
    23: { standardScore: 58.6, percentile: 79.7 },
    22: { standardScore: 56.4, percentile: 72.5 },
    21: { standardScore: 54.2, percentile: 64.7 },
    20: { standardScore: 52.0, percentile: 56.3 },
    19: { standardScore: 49.8, percentile: 47.8 },
    18: { standardScore: 47.7, percentile: 39.6 },
    17: { standardScore: 45.5, percentile: 32.1 },
    16: { standardScore: 43.3, percentile: 25.3 },
    15: { standardScore: 41.1, percentile: 19.4 },
    // 이하 추정 구간 (Slope: 약 -2.18)
    14: { standardScore: 38.9, percentile: 14.5 }, // 추정
    13: { standardScore: 36.7, percentile: 10.5 }, // 추정
    12: { standardScore: 34.5, percentile: 7.5 },  // 추정
    11: { standardScore: 32.3, percentile: 5.0 },  // 추정
    10: { standardScore: 30.2, percentile: 3.0 },   // 추정
    9: { standardScore: 28.0, percentile: 1.5 },   // 추정
    8: { standardScore: 25.8, percentile: 0.8 },
    7: { standardScore: 23.6, percentile: 0.4 },
    6: { standardScore: 21.4, percentile: 0.1 },
    5: { standardScore: 19.3, percentile: 0.0 },
    4: { standardScore: 17.1, percentile: 0.0 },
    3: { standardScore: 14.9, percentile: 0.0 },
    2: { standardScore: 12.7, percentile: 0.0 },
    1: { standardScore: 10.5, percentile: 0.0 },
    0: { standardScore: 8.4, percentile: 0.0 },
    },
  },
  
  '2017': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 21.8
    // 15점 미만은 점수당 약 1.9점씩 차감하여 추정
    35: { standardScore: 74.9, percentile: 100.0 },
    34: { standardScore: 73.0, percentile: 99.8 },
    33: { standardScore: 71.1, percentile: 99.4 },
    32: { standardScore: 69.3, percentile: 98.5 },
    31: { standardScore: 67.4, percentile: 97.1 },
    30: { standardScore: 65.5, percentile: 95.0 },
    29: { standardScore: 63.6, percentile: 91.9 },
    28: { standardScore: 61.7, percentile: 87.7 },
    27: { standardScore: 59.8, percentile: 83.0 },
    26: { standardScore: 57.9, percentile: 77.4 },
    25: { standardScore: 56.1, percentile: 70.9 },
    24: { standardScore: 54.2, percentile: 63.8 },
    23: { standardScore: 52.3, percentile: 56.7 },
    22: { standardScore: 50.4, percentile: 49.6 },
    21: { standardScore: 48.5, percentile: 42.4 },
    20: { standardScore: 46.6, percentile: 35.5 },
    19: { standardScore: 44.8, percentile: 29.3 },
    18: { standardScore: 42.9, percentile: 23.6 },
    17: { standardScore: 41.0, percentile: 18.6 },
    16: { standardScore: 39.1, percentile: 14.8 }, // 중간값 보간 추정
    15: { standardScore: 37.2, percentile: 11.0 },
    // 이하 추정 구간 (Slope: 약 -1.9)
    14: { standardScore: 35.3, percentile: 8.0 },  // 추정
    13: { standardScore: 33.4, percentile: 5.5 },  // 추정
    12: { standardScore: 31.5, percentile: 3.5 },  // 추정
    11: { standardScore: 29.6, percentile: 2.0 },  // 추정
    10: { standardScore: 27.7, percentile: 1.0 },  // 추정
    9: { standardScore: 25.8, percentile: 0.5 },   // 추정
    8: { standardScore: 23.9, percentile: 0.2 },
    7: { standardScore: 22.0, percentile: 0.1 },
    6: { standardScore: 20.1, percentile: 0.0 },
    5: { standardScore: 18.2, percentile: 0.0 },
    4: { standardScore: 16.3, percentile: 0.0 },
    3: { standardScore: 14.4, percentile: 0.0 },
    2: { standardScore: 12.5, percentile: 0.0 },
    1: { standardScore: 10.6, percentile: 0.0 },
    0: { standardScore: 8.7, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 21.4
    // 15점 미만은 점수당 약 1.9점씩 차감하여 추정
    35: { standardScore: 76.3, percentile: 100.0 },
    34: { standardScore: 74.3, percentile: 99.9 },
    33: { standardScore: 72.4, percentile: 99.7 },
    32: { standardScore: 70.5, percentile: 99.1 },
    31: { standardScore: 68.6, percentile: 98.0 },
    30: { standardScore: 66.6, percentile: 96.2 },
    29: { standardScore: 64.7, percentile: 93.7 },
    28: { standardScore: 62.8, percentile: 90.2 },
    27: { standardScore: 60.9, percentile: 86.0 },
    26: { standardScore: 58.9, percentile: 80.7 },
    25: { standardScore: 57.0, percentile: 74.7 },
    24: { standardScore: 55.1, percentile: 67.3 },
    23: { standardScore: 53.2, percentile: 60.0 },
    22: { standardScore: 51.2, percentile: 52.8 },
    21: { standardScore: 49.3, percentile: 45.7 },
    20: { standardScore: 47.4, percentile: 38.5 },
    19: { standardScore: 45.5, percentile: 31.5 },
    18: { standardScore: 43.5, percentile: 25.2 },
    17: { standardScore: 41.6, percentile: 20.5 }, // 중간값 보간 추정
    16: { standardScore: 39.7, percentile: 15.7 },
    15: { standardScore: 37.8, percentile: 11.5 }, // 추정 (하락폭 반영)
    // 이하 추정 구간 (Slope: 약 -1.9)
    14: { standardScore: 35.9, percentile: 8.0 },  // 추정
    13: { standardScore: 34.0, percentile: 5.5 },  // 추정
    12: { standardScore: 32.1, percentile: 3.5 },  // 추정
    11: { standardScore: 30.2, percentile: 2.0 },  // 추정
    10: { standardScore: 28.3, percentile: 1.0 },  // 추정
    9: { standardScore: 26.4, percentile: 0.5 },   // 추정
    8: { standardScore: 24.5, percentile: 0.2 },
    7: { standardScore: 22.6, percentile: 0.1 },
    6: { standardScore: 20.7, percentile: 0.0 },
    5: { standardScore: 18.8, percentile: 0.0 },
    4: { standardScore: 16.9, percentile: 0.0 },
    3: { standardScore: 15.0, percentile: 0.0 },
    2: { standardScore: 13.1, percentile: 0.0 },
    1: { standardScore: 11.2, percentile: 0.0 },
    0: { standardScore: 9.3, percentile: 0.0 },
    },
  },
  
  '2018': {
    verbal: {
      // [언어이해] 35문항 만점 / 평균 21.3
    // 15점 미만은 점수당 약 2.0점씩 차감하여 추정
    35: { standardScore: 78.2, percentile: 100.0 },
    34: { standardScore: 76.2, percentile: 100.0 },
    33: { standardScore: 74.2, percentile: 99.9 },
    32: { standardScore: 72.2, percentile: 99.6 },
    31: { standardScore: 70.2, percentile: 99.0 },
    30: { standardScore: 68.1, percentile: 97.8 },
    29: { standardScore: 66.1, percentile: 95.9 },
    28: { standardScore: 64.1, percentile: 93.0 },
    27: { standardScore: 62.1, percentile: 89.0 },
    26: { standardScore: 60.0, percentile: 83.9 },
    25: { standardScore: 58.0, percentile: 78.0 },
    24: { standardScore: 56.0, percentile: 71.1 },
    23: { standardScore: 53.9, percentile: 63.2 },
    22: { standardScore: 51.9, percentile: 55.0 },
    21: { standardScore: 49.9, percentile: 47.0 },
    20: { standardScore: 47.9, percentile: 39.9 },
    19: { standardScore: 45.8, percentile: 32.9 }, // 보간 추정 (39.9 <-> 25.8 중간)
    18: { standardScore: 43.8, percentile: 25.8 },
    17: { standardScore: 41.8, percentile: 18.7 }, // 보간 추정 (25.8 <-> 11.5 중간)
    16: { standardScore: 39.7, percentile: 15.1 }, // 보간 추정 (17점과 15점 사이)
    15: { standardScore: 37.7, percentile: 11.5 },
    // 이하 추정 구간 (Slope: 약 -2.0)
    14: { standardScore: 35.7, percentile: 8.0 },  // 추정
    13: { standardScore: 33.7, percentile: 5.5 },  // 추정
    12: { standardScore: 31.7, percentile: 3.5 },  // 추정
    11: { standardScore: 29.7, percentile: 2.0 },  // 추정
    10: { standardScore: 27.7, percentile: 1.0 },  // 추정
    9: { standardScore: 25.7, percentile: 0.5 },   // 추정
    8: { standardScore: 23.7, percentile: 0.2 },
    7: { standardScore: 21.7, percentile: 0.1 },
    6: { standardScore: 19.7, percentile: 0.0 },
    5: { standardScore: 17.7, percentile: 0.0 },
    4: { standardScore: 15.7, percentile: 0.0 },
    3: { standardScore: 13.7, percentile: 0.0 },
    2: { standardScore: 11.7, percentile: 0.0 },
    1: { standardScore: 9.7, percentile: 0.0 },
    0: { standardScore: 7.7, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 35문항 만점 / 평균 20.6
    // 15점 미만은 점수당 약 1.9점씩 차감하여 추정
    35: { standardScore: 77.4, percentile: 100.0 },
    34: { standardScore: 75.5, percentile: 100.0 },
    33: { standardScore: 73.6, percentile: 99.8 },
    32: { standardScore: 71.7, percentile: 99.4 },
    31: { standardScore: 69.8, percentile: 98.5 },
    30: { standardScore: 67.9, percentile: 97.2 },
    29: { standardScore: 66.0, percentile: 95.2 },
    28: { standardScore: 64.1, percentile: 92.6 },
    27: { standardScore: 62.2, percentile: 88.8 },
    26: { standardScore: 60.3, percentile: 84.1 },
    25: { standardScore: 58.4, percentile: 78.9 },
    24: { standardScore: 56.5, percentile: 72.7 },
    23: { standardScore: 54.6, percentile: 65.8 },
    22: { standardScore: 52.7, percentile: 58.6 },
    21: { standardScore: 50.8, percentile: 51.3 },
    20: { standardScore: 48.9, percentile: 44.1 },
    19: { standardScore: 47.0, percentile: 38.3 }, // 보간 추정 (20점 44.1 ~ 15점 15.2 사이)
    18: { standardScore: 45.1, percentile: 32.5 }, // 보간 추정
    17: { standardScore: 43.2, percentile: 26.7 }, // 보간 추정
    16: { standardScore: 41.3, percentile: 21.0 }, // 보간 추정
    15: { standardScore: 39.4, percentile: 15.2 },
    // 이하 추정 구간 (Slope: 약 -1.9)
    14: { standardScore: 37.5, percentile: 10.5 }, // 추정
    13: { standardScore: 35.6, percentile: 7.0 },  // 추정
    12: { standardScore: 33.7, percentile: 4.5 },  // 추정
    11: { standardScore: 31.8, percentile: 2.5 },  // 추정
    10: { standardScore: 29.9, percentile: 1.2 },  // 추정
    9: { standardScore: 28.0, percentile: 0.6 },   // 추정
    8: { standardScore: 26.1, percentile: 0.2 },
    7: { standardScore: 24.2, percentile: 0.1 },
    6: { standardScore: 22.3, percentile: 0.0 },
    5: { standardScore: 20.4, percentile: 0.0 },
    4: { standardScore: 18.5, percentile: 0.0 },
    3: { standardScore: 16.6, percentile: 0.0 },
    2: { standardScore: 14.7, percentile: 0.0 },
    1: { standardScore: 12.8, percentile: 0.0 },
    0: { standardScore: 10.9, percentile: 0.0 },
    },
  },
  
  '2019': {
    verbal: {
      // [언어이해] 30문항 만점 / 평균 17.1
    // 16점 미만은 점수당 약 2.4점씩 차감하여 추정 (소수점 첫째 자리까지)
    30: { standardScore: 81.2, percentile: 100.0 },
    29: { standardScore: 78.7, percentile: 100.0 },
    28: { standardScore: 76.3, percentile: 99.9 },
    27: { standardScore: 73.9, percentile: 99.6 },
    26: { standardScore: 71.4, percentile: 98.9 },
    25: { standardScore: 69.0, percentile: 97.6 },
    24: { standardScore: 66.6, percentile: 95.4 },
    23: { standardScore: 64.1, percentile: 92.0 },
    22: { standardScore: 61.7, percentile: 87.5 },
    21: { standardScore: 59.3, percentile: 81.7 },
    20: { standardScore: 56.9, percentile: 74.8 },
    19: { standardScore: 54.4, percentile: 66.5 },
    18: { standardScore: 52.2, percentile: 58.2 }, // 보간 추정 (66.5 - 8.3)
    17: { standardScore: 50.1, percentile: 49.9 }, // 보간 추정 (58.2 - 8.3)
    // 이하 추정 구간 (Slope: 약 -2.4)
    16: { standardScore: 47.7, percentile: 41.6 }, // 추정
    15: { standardScore: 45.3, percentile: 33.3 }, // 추정
    14: { standardScore: 42.9, percentile: 25.0 }, // 추정
    13: { standardScore: 40.5, percentile: 16.7 }, // 추정
    12: { standardScore: 38.1, percentile: 10.0 }, // 추정
    11: { standardScore: 35.7, percentile: 5.0 },  // 추정
    10: { standardScore: 33.3, percentile: 2.5 },  // 추정
    9: { standardScore: 30.9, percentile: 1.0 },   // 추정
    8: { standardScore: 28.5, percentile: 0.5 },
    7: { standardScore: 26.1, percentile: 0.1 },
    6: { standardScore: 23.7, percentile: 0.0 },
    5: { standardScore: 21.3, percentile: 0.0 },
    4: { standardScore: 18.9, percentile: 0.0 },
    3: { standardScore: 16.5, percentile: 0.0 },
    2: { standardScore: 14.1, percentile: 0.0 },
    1: { standardScore: 11.7, percentile: 0.0 },
    0: { standardScore: 9.3, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점 / 평균 25.3
    // 23점 미만은 점수당 약 1.6점씩 차감하여 추정 (소수점 첫째 자리까지)
    40: { standardScore: 74.3, percentile: 100.0 },
    39: { standardScore: 72.7, percentile: 99.9 },
    38: { standardScore: 71.1, percentile: 99.7 },
    37: { standardScore: 69.5, percentile: 99.2 },
    36: { standardScore: 67.8, percentile: 98.2 },
    35: { standardScore: 66.2, percentile: 96.6 },
    34: { standardScore: 64.6, percentile: 94.2 },
    33: { standardScore: 63.0, percentile: 91.1 },
    32: { standardScore: 61.4, percentile: 87.5 },
    31: { standardScore: 59.8, percentile: 84.2 },
    30: { standardScore: 58.2, percentile: 78.1 },
    29: { standardScore: 56.6, percentile: 72.2 },
    28: { standardScore: 54.9, percentile: 66.0 },
    27: { standardScore: 53.3, percentile: 59.7 },
    26: { standardScore: 51.7, percentile: 53.5 },
    25: { standardScore: 50.1, percentile: 47.4 },
    24: { standardScore: 48.5, percentile: 41.4 },
    // 이하 추정 구간 (Slope: 약 -1.6)
    23: { standardScore: 46.9, percentile: 35.4 }, // 추정 (41.4 - 6.0)
    22: { standardScore: 45.3, percentile: 29.4 }, // 추정
    21: { standardScore: 43.7, percentile: 23.4 }, // 추정
    20: { standardScore: 42.1, percentile: 17.4 }, // 추정
    19: { standardScore: 40.5, percentile: 12.0 }, // 추정
    18: { standardScore: 38.9, percentile: 8.0 },  // 추정
    17: { standardScore: 37.3, percentile: 5.0 },  // 추정
    16: { standardScore: 35.7, percentile: 3.0 },  // 추정
    15: { standardScore: 34.1, percentile: 1.5 },  // 추정
    14: { standardScore: 32.5, percentile: 0.8 },  // 추정
    13: { standardScore: 30.9, percentile: 0.4 },  // 추정
    12: { standardScore: 29.3, percentile: 0.2 },
    11: { standardScore: 27.7, percentile: 0.1 },
    10: { standardScore: 26.1, percentile: 0.0 },
    9: { standardScore: 24.5, percentile: 0.0 },
    8: { standardScore: 22.9, percentile: 0.0 },
    7: { standardScore: 21.3, percentile: 0.0 },
    6: { standardScore: 19.7, percentile: 0.0 },
    5: { standardScore: 18.1, percentile: 0.0 },
    4: { standardScore: 16.5, percentile: 0.0 },
    3: { standardScore: 14.9, percentile: 0.0 },
    2: { standardScore: 13.3, percentile: 0.0 },
    1: { standardScore: 11.7, percentile: 0.0 },
    0: { standardScore: 10.1, percentile: 0.0 },
    },
  },
  
  '2020': {
    verbal: {
      // [언어이해] 30문항 만점 / 평균 16.8
    // 10점 미만은 점수당 2.1점씩 차감하여 추정 (소수점 첫째 자리)
    30: { standardScore: 71.9, percentile: 100.0 },
    29: { standardScore: 69.9, percentile: 100.0 }, // 보간 추정
    28: { standardScore: 67.9, percentile: 99.9 },
    27: { standardScore: 65.9, percentile: 99.6 },
    26: { standardScore: 63.8, percentile: 98.9 },
    25: { standardScore: 61.7, percentile: 97.7 },
    24: { standardScore: 59.6, percentile: 95.7 },
    23: { standardScore: 57.5, percentile: 92.2 },
    22: { standardScore: 55.4, percentile: 87.3 },
    21: { standardScore: 53.4, percentile: 81.2 },
    20: { standardScore: 51.3, percentile: 74.1 },
    19: { standardScore: 49.2, percentile: 66.1 },
    18: { standardScore: 47.1, percentile: 57.4 },
    17: { standardScore: 45.0, percentile: 48.5 },
    16: { standardScore: 42.9, percentile: 40.0 },
    15: { standardScore: 40.9, percentile: 32.0 },
    14: { standardScore: 38.8, percentile: 25.0 },
    13: { standardScore: 36.7, percentile: 19.8 }, // 보간 추정 (25.0 ~ 14.6 사이)
    12: { standardScore: 34.6, percentile: 14.6 },
    11: { standardScore: 32.5, percentile: 10.0 }, // 추정
    10: { standardScore: 30.4, percentile: 6.0 },  // 추정
    // 이하 추정 구간 (Slope: 약 -2.1)
    9: { standardScore: 28.3, percentile: 3.5 }, // 추정
    8: { standardScore: 26.2, percentile: 2.0 }, // 추정
    7: { standardScore: 24.1, percentile: 1.0 }, // 추정
    6: { standardScore: 22.0, percentile: 0.5 }, // 추정
    5: { standardScore: 19.9, percentile: 0.1 }, // 추정
    4: { standardScore: 17.8, percentile: 0.0 },
    3: { standardScore: 15.7, percentile: 0.0 },
    2: { standardScore: 13.6, percentile: 0.0 },
    1: { standardScore: 11.5, percentile: 0.0 },
    0: { standardScore: 9.4, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점 / 평균 24.0
    // 20점 미만은 점수당 2.0점씩 차감하여 추정 (소수점 첫째 자리)
    40: { standardScore: 92.0, percentile: 100.0 },
    39: { standardScore: 90.0, percentile: 99.9 }, // 보간 추정
    38: { standardScore: 88.0, percentile: 99.8 },
    37: { standardScore: 86.0, percentile: 99.4 }, // 보간 추정
    36: { standardScore: 84.0, percentile: 99.0 },
    35: { standardScore: 82.0, percentile: 98.1 },
    34: { standardScore: 79.9, percentile: 96.5 },
    33: { standardScore: 77.9, percentile: 94.3 },
    32: { standardScore: 75.9, percentile: 91.2 },
    31: { standardScore: 73.9, percentile: 87.5 },
    30: { standardScore: 71.8, percentile: 83.1 },
    29: { standardScore: 69.8, percentile: 77.8 },
    28: { standardScore: 67.8, percentile: 72.0 },
    27: { standardScore: 65.8, percentile: 65.9 },
    26: { standardScore: 63.8, percentile: 59.6 },
    25: { standardScore: 61.7, percentile: 53.1 },
    24: { standardScore: 59.7, percentile: 46.8 },
    23: { standardScore: 57.7, percentile: 40.6 },
    22: { standardScore: 55.7, percentile: 34.6 },
    21: { standardScore: 53.6, percentile: 29.2 },
    20: { standardScore: 51.5, percentile: 23.4 },
    // 이하 추정 구간 (Slope: 약 -2.0)
    19: { standardScore: 49.5, percentile: 19.0 }, // 추정
    18: { standardScore: 47.5, percentile: 15.0 }, // 추정
    17: { standardScore: 45.5, percentile: 11.5 }, // 추정
    16: { standardScore: 43.5, percentile: 8.5 },  // 추정
    15: { standardScore: 41.5, percentile: 6.0 },  // 추정
    14: { standardScore: 39.5, percentile: 4.0 },  // 추정
    13: { standardScore: 37.5, percentile: 2.5 },  // 추정
    12: { standardScore: 35.5, percentile: 1.5 },  // 추정
    11: { standardScore: 33.5, percentile: 0.8 },  // 추정
    10: { standardScore: 31.5, percentile: 0.4 },  // 추정
    9: { standardScore: 29.5, percentile: 0.1 },   // 추정
    8: { standardScore: 27.5, percentile: 0.0 },
    7: { standardScore: 25.5, percentile: 0.0 },
    6: { standardScore: 23.5, percentile: 0.0 },
    5: { standardScore: 21.5, percentile: 0.0 },
    4: { standardScore: 19.5, percentile: 0.0 },
    3: { standardScore: 17.5, percentile: 0.0 },
    2: { standardScore: 15.5, percentile: 0.0 },
    1: { standardScore: 13.5, percentile: 0.0 },
    0: { standardScore: 11.5, percentile: 0.0 },
    },
  },
  
  '2021': {
    verbal: {
      // [언어이해] 30문항 만점
    // 12점 미만은 점수당 약 2.3점씩 차감하여 추정 (소수점 첫째 자리)
    30: { standardScore: 77.1, percentile: 100.0 },
    29: { standardScore: 75.9, percentile: 100.0 },
    28: { standardScore: 73.6, percentile: 100.0 },
    27: { standardScore: 71.4, percentile: 99.9 },
    26: { standardScore: 69.1, percentile: 99.8 },
    25: { standardScore: 66.9, percentile: 99.4 },
    24: { standardScore: 64.6, percentile: 98.8 },
    23: { standardScore: 62.4, percentile: 97.6 },
    22: { standardScore: 60.1, percentile: 95.3 },
    21: { standardScore: 57.9, percentile: 92.1 },
    20: { standardScore: 55.6, percentile: 87.6 },
    19: { standardScore: 53.4, percentile: 81.6 },
    18: { standardScore: 51.1, percentile: 74.4 },
    17: { standardScore: 48.9, percentile: 66.1 },
    16: { standardScore: 46.6, percentile: 57.0 },
    15: { standardScore: 44.4, percentile: 47.2 },
    14: { standardScore: 42.1, percentile: 37.6 },
    13: { standardScore: 39.9, percentile: 28.7 },
    12: { standardScore: 37.6, percentile: 20.8 },
    // 이하 추정 구간 (Slope: 약 -2.3)
    11: { standardScore: 35.3, percentile: 14.5 }, // 추정
    10: { standardScore: 33.0, percentile: 9.5 },  // 추정
    9: { standardScore: 30.7, percentile: 6.0 },   // 추정
    8: { standardScore: 28.4, percentile: 3.5 },   // 추정
    7: { standardScore: 26.1, percentile: 2.0 },   // 추정
    6: { standardScore: 23.8, percentile: 1.0 },   // 추정
    5: { standardScore: 21.5, percentile: 0.5 },   // 추정
    4: { standardScore: 19.2, percentile: 0.1 },   // 추정
    3: { standardScore: 16.9, percentile: 0.0 },
    2: { standardScore: 14.6, percentile: 0.0 },
    1: { standardScore: 12.3, percentile: 0.0 },
    0: { standardScore: 10.0, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점
    // 20점 미만은 점수당 약 2.0점씩 차감하여 추정 (소수점 첫째 자리)
    40: { standardScore: 96.5, percentile: 100.0 },
    39: { standardScore: 94.5, percentile: 100.0 },
    38: { standardScore: 92.5, percentile: 99.9 },
    37: { standardScore: 90.5, percentile: 99.7 },
    36: { standardScore: 88.5, percentile: 99.4 },
    35: { standardScore: 86.4, percentile: 98.9 },
    34: { standardScore: 84.4, percentile: 98.2 },
    33: { standardScore: 82.4, percentile: 97.2 },
    32: { standardScore: 80.4, percentile: 95.6 },
    31: { standardScore: 78.4, percentile: 93.5 },
    30: { standardScore: 76.4, percentile: 90.9 },
    29: { standardScore: 74.4, percentile: 87.6 },
    28: { standardScore: 72.4, percentile: 83.7 },
    27: { standardScore: 70.4, percentile: 79.4 },
    26: { standardScore: 68.3, percentile: 74.5 },
    25: { standardScore: 66.3, percentile: 69.0 },
    24: { standardScore: 64.3, percentile: 63.2 },
    23: { standardScore: 62.3, percentile: 57.4 },
    22: { standardScore: 60.3, percentile: 51.2 },
    21: { standardScore: 58.3, percentile: 44.9 },
    20: { standardScore: 56.3, percentile: 38.5 },
    // 이하 추정 구간 (Slope: 약 -2.0)
    19: { standardScore: 54.3, percentile: 32.5 }, // 추정
    18: { standardScore: 52.3, percentile: 27.0 }, // 추정
    17: { standardScore: 50.3, percentile: 22.0 }, // 추정
    16: { standardScore: 48.3, percentile: 17.5 }, // 추정
    15: { standardScore: 46.3, percentile: 13.5 }, // 추정
    14: { standardScore: 44.3, percentile: 10.0 }, // 추정
    13: { standardScore: 42.3, percentile: 7.0 },  // 추정
    12: { standardScore: 40.3, percentile: 4.5 },  // 추정
    11: { standardScore: 38.3, percentile: 2.5 },  // 추정
    10: { standardScore: 36.3, percentile: 1.2 },  // 추정
    9: { standardScore: 34.3, percentile: 0.6 },   // 추정
    8: { standardScore: 32.3, percentile: 0.2 },
    7: { standardScore: 30.3, percentile: 0.1 },
    6: { standardScore: 28.3, percentile: 0.0 },
    5: { standardScore: 26.3, percentile: 0.0 },
    4: { standardScore: 24.3, percentile: 0.0 },
    3: { standardScore: 22.3, percentile: 0.0 },
    2: { standardScore: 20.3, percentile: 0.0 },
    1: { standardScore: 18.3, percentile: 0.0 },
    0: { standardScore: 16.3, percentile: 0.0 },
    },
  },
  
  '2022': {
    verbal: {
      // [언어이해] 30문항 만점
    // 10점 미만은 점수당 약 2.0점씩 차감하여 추정 (소수점 첫째 자리)
    30: { standardScore: 72.4, percentile: 100.0 }, // 추정
    29: { standardScore: 70.3, percentile: 100.0 }, // 추정
    28: { standardScore: 68.3, percentile: 99.9 },  // 추정
    27: { standardScore: 66.2, percentile: 99.6 },
    26: { standardScore: 64.1, percentile: 99.1 },
    25: { standardScore: 62.1, percentile: 98.1 },
    24: { standardScore: 60.1, percentile: 95.7 },  // 보간 추정 (98.1 ~ 93.2)
    23: { standardScore: 58.1, percentile: 93.2 },
    22: { standardScore: 56.0, percentile: 88.9 },
    21: { standardScore: 54.0, percentile: 83.3 },
    20: { standardScore: 52.0, percentile: 76.7 },
    19: { standardScore: 49.9, percentile: 69.1 },
    18: { standardScore: 47.9, percentile: 60.8 },
    17: { standardScore: 45.9, percentile: 51.9 },
    16: { standardScore: 43.8, percentile: 43.2 },
    15: { standardScore: 41.8, percentile: 35.3 },
    14: { standardScore: 39.8, percentile: 28.1 },
    13: { standardScore: 37.7, percentile: 22.2 },  // 보간 추정 (28.1 ~ 16.2)
    12: { standardScore: 35.7, percentile: 16.2 },
    11: { standardScore: 33.7, percentile: 11.6 },
    10: { standardScore: 31.7, percentile: 7.9 },
    // 이하 추정 구간 (Slope: 약 -2.0)
    9: { standardScore: 29.7, percentile: 5.0 },   // 추정
    8: { standardScore: 27.7, percentile: 3.0 },   // 추정
    7: { standardScore: 25.7, percentile: 1.5 },   // 추정
    6: { standardScore: 23.7, percentile: 0.8 },   // 추정
    5: { standardScore: 21.7, percentile: 0.4 },   // 추정
    4: { standardScore: 19.7, percentile: 0.1 },   // 추정
    3: { standardScore: 17.7, percentile: 0.0 },
    2: { standardScore: 15.7, percentile: 0.0 },
    1: { standardScore: 13.7, percentile: 0.0 },
    0: { standardScore: 11.7, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점
    // 20점 미만은 점수당 약 2.2점씩 차감하여 추정 (소수점 첫째 자리)
    40: { standardScore: 96.8, percentile: 100.0 },
    39: { standardScore: 94.8, percentile: 100.0 }, // 추정
    38: { standardScore: 92.6, percentile: 100.0 }, // 추정
    37: { standardScore: 90.4, percentile: 99.9 },  // 추정
    36: { standardScore: 88.2, percentile: 99.6 },
    35: { standardScore: 86.1, percentile: 98.1 },
    34: { standardScore: 84.0, percentile: 97.7 },  // 보간 추정 (98.1 ~ 97.2)
    33: { standardScore: 81.9, percentile: 97.2 },
    32: { standardScore: 79.8, percentile: 95.5 },
    31: { standardScore: 77.7, percentile: 93.3 },
    30: { standardScore: 76.6, percentile: 90.2 }, // 원본 오타 가능성(76.6 vs 77.7 간격 좁음) 있으나 원본 유지
    29: { standardScore: 73.4, percentile: 86.4 },
    28: { standardScore: 71.3, percentile: 81.8 },
    27: { standardScore: 69.2, percentile: 76.7 },
    26: { standardScore: 67.1, percentile: 70.8 },
    25: { standardScore: 65.0, percentile: 64.5 },
    24: { standardScore: 62.8, percentile: 58.1 },
    23: { standardScore: 60.7, percentile: 51.3 },
    22: { standardScore: 58.6, percentile: 44.4 },
    21: { standardScore: 56.5, percentile: 38.1 },
    20: { standardScore: 54.3, percentile: 32.0 },  // 추정
    // 이하 추정 구간 (Slope: 약 -2.2)
    19: { standardScore: 52.1, percentile: 26.5 }, // 추정
    18: { standardScore: 49.9, percentile: 21.0 }, // 추정
    17: { standardScore: 47.7, percentile: 16.0 }, // 추정
    16: { standardScore: 45.5, percentile: 11.5 }, // 추정
    15: { standardScore: 43.3, percentile: 8.0 },  // 추정
    14: { standardScore: 41.1, percentile: 5.0 },  // 추정
    13: { standardScore: 38.9, percentile: 3.0 },  // 추정
    12: { standardScore: 36.7, percentile: 1.5 },  // 추정
    11: { standardScore: 34.5, percentile: 0.8 },  // 추정
    10: { standardScore: 32.3, percentile: 0.4 },  // 추정
    9: { standardScore: 30.1, percentile: 0.1 },   // 추정
    8: { standardScore: 27.9, percentile: 0.0 },
    7: { standardScore: 25.7, percentile: 0.0 },
    6: { standardScore: 23.5, percentile: 0.0 },
    5: { standardScore: 21.3, percentile: 0.0 },
    4: { standardScore: 19.1, percentile: 0.0 },
    3: { standardScore: 16.9, percentile: 0.0 },
    2: { standardScore: 14.7, percentile: 0.0 },
    1: { standardScore: 12.5, percentile: 0.0 },
    0: { standardScore: 10.3, percentile: 0.0 },
    },
  },
  
  '2023': {
    verbal: {
      // [언어이해] 30문항 만점
    // 13점 미만은 점수당 약 2.1점씩 차감하여 추정 (소수점 첫째 자리)
    30: { standardScore: 72.5, percentile: 100.0 }, // 추정
    29: { standardScore: 70.4, percentile: 100.0 }, // 추정
    28: { standardScore: 68.3, percentile: 99.8 },
    27: { standardScore: 66.2, percentile: 99.0 },
    26: { standardScore: 64.1, percentile: 98.0 },
    25: { standardScore: 62.0, percentile: 97.3 },
    24: { standardScore: 59.9, percentile: 95.3 },
    23: { standardScore: 57.8, percentile: 92.3 },
    22: { standardScore: 55.7, percentile: 87.9 },
    21: { standardScore: 53.6, percentile: 82.3 },
    20: { standardScore: 51.5, percentile: 75.7 },
    19: { standardScore: 49.3, percentile: 67.8 },
    18: { standardScore: 47.2, percentile: 58.8 },
    17: { standardScore: 45.1, percentile: 49.8 },
    16: { standardScore: 43.0, percentile: 40.7 },
    15: { standardScore: 40.9, percentile: 32.1 },
    14: { standardScore: 38.8, percentile: 24.5 },
    // 이하 추정 구간 (Slope: 약 -2.1)
    13: { standardScore: 36.7, percentile: 18.0 }, // 추정
    12: { standardScore: 34.6, percentile: 12.5 }, // 추정
    11: { standardScore: 32.5, percentile: 8.0 },  // 추정
    10: { standardScore: 30.4, percentile: 4.5 },  // 추정
    9: { standardScore: 28.3, percentile: 2.0 },   // 추정
    8: { standardScore: 26.2, percentile: 1.0 },   // 추정
    7: { standardScore: 24.1, percentile: 0.5 },   // 추정
    6: { standardScore: 22.0, percentile: 0.1 },   // 추정
    5: { standardScore: 19.9, percentile: 0.0 },
    4: { standardScore: 17.8, percentile: 0.0 },
    3: { standardScore: 15.7, percentile: 0.0 },
    2: { standardScore: 13.6, percentile: 0.0 },
    1: { standardScore: 11.5, percentile: 0.0 },
    0: { standardScore: 9.4, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점
    // 19점 미만은 점수당 약 2.1점씩 차감하여 추정 (소수점 첫째 자리)
    40: { standardScore: 94.8, percentile: 100.0 }, // 추정
    39: { standardScore: 92.7, percentile: 100.0 }, // 추정
    38: { standardScore: 90.7, percentile: 100.0 }, // 추정
    37: { standardScore: 88.6, percentile: 100.0 }, // 추정
    36: { standardScore: 86.5, percentile: 99.3 },
    35: { standardScore: 84.5, percentile: 98.0 },
    34: { standardScore: 82.4, percentile: 97.7 },
    33: { standardScore: 80.4, percentile: 96.0 },
    32: { standardScore: 78.3, percentile: 94.3 },
    31: { standardScore: 76.2, percentile: 91.6 },
    30: { standardScore: 74.1, percentile: 88.1 },
    29: { standardScore: 72.1, percentile: 83.9 },
    28: { standardScore: 70.0, percentile: 78.8 },
    27: { standardScore: 68.0, percentile: 73.1 },
    26: { standardScore: 65.9, percentile: 66.9 },
    25: { standardScore: 63.8, percentile: 60.5 },
    24: { standardScore: 61.8, percentile: 53.9 },
    23: { standardScore: 59.7, percentile: 47.3 },
    22: { standardScore: 57.7, percentile: 40.9 },
    21: { standardScore: 55.6, percentile: 34.8 },
    20: { standardScore: 53.5, percentile: 29.3 },
    // 이하 추정 구간 (Slope: 약 -2.1)
    19: { standardScore: 51.4, percentile: 24.0 }, // 추정
    18: { standardScore: 49.3, percentile: 19.5 }, // 추정
    17: { standardScore: 47.2, percentile: 15.0 }, // 추정
    16: { standardScore: 45.1, percentile: 11.5 }, // 추정
    15: { standardScore: 43.0, percentile: 8.5 },  // 추정
    14: { standardScore: 40.9, percentile: 6.0 },  // 추정
    13: { standardScore: 38.8, percentile: 4.0 },  // 추정
    12: { standardScore: 36.7, percentile: 2.5 },  // 추정
    11: { standardScore: 34.6, percentile: 1.5 },  // 추정
    10: { standardScore: 32.5, percentile: 0.8 },  // 추정
    9: { standardScore: 30.4, percentile: 0.4 },   // 추정
    8: { standardScore: 28.3, percentile: 0.1 },
    7: { standardScore: 26.2, percentile: 0.0 },
    6: { standardScore: 24.1, percentile: 0.0 },
    5: { standardScore: 22.0, percentile: 0.0 },
    4: { standardScore: 19.9, percentile: 0.0 },
    3: { standardScore: 17.8, percentile: 0.0 },
    2: { standardScore: 15.7, percentile: 0.0 },
    1: { standardScore: 13.6, percentile: 0.0 },
    0: { standardScore: 11.5, percentile: 0.0 },
    },
  },
  
  '2024': {
    verbal: {
      // [언어이해] 30문항 만점
    // 10점 미만은 점수당 약 2.45점씩 차감하여 추정
    30: { standardScore: 80.9, percentile: 100.0 },
    29: { standardScore: 78.4, percentile: 100.0 },
    28: { standardScore: 76.0, percentile: 100.0 },
    27: { standardScore: 73.6, percentile: 100.0 }, // 보간 추정 (100.0과 99.9 사이)
    26: { standardScore: 71.1, percentile: 99.9 },
    25: { standardScore: 68.7, percentile: 99.8 }, // 보완 (24_2.png)
    24: { standardScore: 66.3, percentile: 99.4 },
    23: { standardScore: 63.8, percentile: 98.6 },
    22: { standardScore: 61.4, percentile: 97.1 },
    21: { standardScore: 59.0, percentile: 94.5 }, // 보완 (24_2.png)
    20: { standardScore: 56.5, percentile: 90.3 },
    19: { standardScore: 54.1, percentile: 84.3 },
    18: { standardScore: 51.7, percentile: 76.4 }, // 보완 (24_2.png)
    17: { standardScore: 49.3, percentile: 67.0 }, // 보완 (24_2.png)
    16: { standardScore: 46.8, percentile: 56.7 }, // 보완 (24_2.png)
    15: { standardScore: 44.4, percentile: 46.0 }, // 보완 (24_2.png)
    14: { standardScore: 42.0, percentile: 35.9 }, // 보완 (24_2.png)
    13: { standardScore: 39.5, percentile: 26.9 }, // 보완 (24_2.png)
    12: { standardScore: 37.1, percentile: 19.0 }, // 보완 (24_2.png)
    11: { standardScore: 34.7, percentile: 12.5 }, // 추정 (하락폭 반영)
    10: { standardScore: 32.2, percentile: 7.0 },  // 추정
    // 이하 추정 구간 (Slope: 약 -2.45)
    9: { standardScore: 29.8, percentile: 3.5 },   // 추정
    8: { standardScore: 27.3, percentile: 1.5 },   // 추정
    7: { standardScore: 24.9, percentile: 0.8 },   // 추정
    6: { standardScore: 22.4, percentile: 0.2 },   // 추정
    5: { standardScore: 20.0, percentile: 0.1 },   // 추정
    4: { standardScore: 17.5, percentile: 0.0 },
    3: { standardScore: 15.1, percentile: 0.0 },
    2: { standardScore: 12.6, percentile: 0.0 },
    1: { standardScore: 10.2, percentile: 0.0 },
    0: { standardScore: 7.7, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점
    // 20점 미만은 점수당 약 2.1점씩 차감하여 추정
    40: { standardScore: 97.5, percentile: 100.0 },
    39: { standardScore: 95.4, percentile: 100.0 },
    38: { standardScore: 93.3, percentile: 99.9 }, // 추정 (24_2.png 데이터 없음, 37점과 39점 사이)
    37: { standardScore: 91.2, percentile: 99.9 },
    36: { standardScore: 89.1, percentile: 99.8 },
    35: { standardScore: 86.9, percentile: 99.5 }, // 보완 (24_2.png)
    34: { standardScore: 84.8, percentile: 99.1 },
    33: { standardScore: 82.7, percentile: 98.3 },
    32: { standardScore: 80.6, percentile: 96.9 },
    31: { standardScore: 78.5, percentile: 95.0 }, // 보완 (24_2.png)
    30: { standardScore: 76.4, percentile: 92.3 }, // 보완 (24_2.png)
    29: { standardScore: 74.3, percentile: 88.7 },
    28: { standardScore: 72.2, percentile: 84.3 }, // 보완 (24_2.png)
    27: { standardScore: 70.1, percentile: 79.3 }, // 보완 (24_2.png)
    26: { standardScore: 68.0, percentile: 73.3 },
    25: { standardScore: 65.9, percentile: 66.6 },
    24: { standardScore: 63.8, percentile: 59.7 }, // 보완 (24_2.png)
    23: { standardScore: 61.7, percentile: 52.8 }, // 보완 (24_2.png)
    22: { standardScore: 59.6, percentile: 46.2 }, // 보완 (24_2.png)
    21: { standardScore: 57.5, percentile: 39.9 }, // 보완 (24_2.png)
    20: { standardScore: 55.4, percentile: 33.5 }, // 추정
    // 이하 추정 구간 (Slope: 약 -2.1)
    19: { standardScore: 53.3, percentile: 27.5 }, // 추정
    18: { standardScore: 51.2, percentile: 22.0 }, // 추정
    17: { standardScore: 49.1, percentile: 17.0 }, // 추정
    16: { standardScore: 47.0, percentile: 12.5 }, // 추정
    15: { standardScore: 44.9, percentile: 8.5 },  // 추정
    14: { standardScore: 42.8, percentile: 5.5 },  // 추정
    13: { standardScore: 40.7, percentile: 3.0 },  // 추정
    12: { standardScore: 38.6, percentile: 1.5 },  // 추정
    11: { standardScore: 36.5, percentile: 0.8 },  // 추정
    10: { standardScore: 34.4, percentile: 0.4 },  // 추정
    9: { standardScore: 32.3, percentile: 0.1 },   // 추정
    8: { standardScore: 30.2, percentile: 0.0 },
    7: { standardScore: 28.1, percentile: 0.0 },
    6: { standardScore: 26.0, percentile: 0.0 },
    5: { standardScore: 23.9, percentile: 0.0 },
    4: { standardScore: 21.8, percentile: 0.0 },
    3: { standardScore: 19.7, percentile: 0.0 },
    2: { standardScore: 17.6, percentile: 0.0 },
    1: { standardScore: 15.5, percentile: 0.0 },
    0: { standardScore: 13.4, percentile: 0.0 },
    },
  },
  
  '2025': {
    verbal: {
      // [언어이해] 30문항 만점
    // 10점 미만은 점수당 약 2.2점씩 차감하여 추정 (소수점 첫째 자리)
    30: { standardScore: 73.5, percentile: 100.0 },
    29: { standardScore: 71.3, percentile: 100.0 },
    28: { standardScore: 69.1, percentile: 99.9 },
    27: { standardScore: 66.9, percentile: 99.7 },
    26: { standardScore: 64.7, percentile: 99.1 },
    25: { standardScore: 62.5, percentile: 98.0 },
    24: { standardScore: 60.3, percentile: 96.2 },
    23: { standardScore: 58.1, percentile: 93.3 },
    22: { standardScore: 55.9, percentile: 89.0 },
    21: { standardScore: 53.7, percentile: 83.1 },
    20: { standardScore: 51.5, percentile: 75.5 },
    19: { standardScore: 49.3, percentile: 66.4 }, // 보간 추정 (75.5와 57.3의 중간)
    18: { standardScore: 47.1, percentile: 57.3 },
    17: { standardScore: 44.9, percentile: 48.0 }, // 추정 (감소폭 반영)
    16: { standardScore: 42.7, percentile: 39.0 }, // 추정
    15: { standardScore: 40.5, percentile: 30.5 }, // 추정
    14: { standardScore: 38.3, percentile: 22.5 }, // 추정
    13: { standardScore: 36.2, percentile: 15.5 }, // 추정
    12: { standardScore: 34.0, percentile: 9.5 },  // 추정
    11: { standardScore: 31.8, percentile: 5.0 },  // 추정
    10: { standardScore: 29.6, percentile: 2.5 },  // 추정
    // 이하 추정 구간 (Slope: 약 -2.2)
    9: { standardScore: 27.4, percentile: 1.0 },   // 추정
    8: { standardScore: 25.2, percentile: 0.5 },   // 추정
    7: { standardScore: 23.0, percentile: 0.2 },   // 추정
    6: { standardScore: 20.8, percentile: 0.1 },   // 추정
    5: { standardScore: 18.6, percentile: 0.0 },
    4: { standardScore: 16.4, percentile: 0.0 },
    3: { standardScore: 14.2, percentile: 0.0 },
    2: { standardScore: 12.0, percentile: 0.0 },
    1: { standardScore: 9.8, percentile: 0.0 },
    0: { standardScore: 7.6, percentile: 0.0 },
    },
    reasoning: {
      // [추리논증] 40문항 만점
    // 20점 미만은 점수당 약 2.1점씩 차감하여 추정 (소수점 첫째 자리)
    40: { standardScore: 91.5, percentile: 100.0 },
    39: { standardScore: 89.4, percentile: 100.0 },
    38: { standardScore: 87.3, percentile: 99.8 },
    37: { standardScore: 85.2, percentile: 99.4 },
    36: { standardScore: 83.1, percentile: 98.7 },
    35: { standardScore: 81.0, percentile: 97.5 },
    34: { standardScore: 78.9, percentile: 95.8 },
    33: { standardScore: 76.7, percentile: 93.2 },
    32: { standardScore: 74.6, percentile: 89.6 },
    31: { standardScore: 72.5, percentile: 85.4 },
    30: { standardScore: 70.4, percentile: 80.4 },
    29: { standardScore: 68.3, percentile: 74.4 },
    28: { standardScore: 66.2, percentile: 67.7 },
    27: { standardScore: 64.1, percentile: 60.6 }, // 보간 추정 (67.7 ~ 39.4 구간)
    26: { standardScore: 61.9, percentile: 53.5 }, // 보간 추정
    25: { standardScore: 59.8, percentile: 46.5 }, // 보간 추정
    24: { standardScore: 57.7, percentile: 39.4 },
    23: { standardScore: 55.6, percentile: 32.5 }, // 추정 (감소폭 반영)
    22: { standardScore: 53.5, percentile: 26.0 }, // 추정
    21: { standardScore: 51.4, percentile: 20.0 }, // 추정
    20: { standardScore: 49.3, percentile: 15.0 }, // 추정
    // 이하 추정 구간 (Slope: 약 -2.1)
    19: { standardScore: 47.2, percentile: 10.5 }, // 추정
    18: { standardScore: 45.1, percentile: 7.0 },  // 추정
    17: { standardScore: 43.0, percentile: 4.5 },  // 추정
    16: { standardScore: 40.9, percentile: 2.5 },  // 추정
    15: { standardScore: 38.8, percentile: 1.5 },  // 추정
    14: { standardScore: 36.7, percentile: 0.8 },  // 추정
    13: { standardScore: 34.6, percentile: 0.4 },  // 추정
    12: { standardScore: 32.5, percentile: 0.2 },  // 추정
    11: { standardScore: 30.4, percentile: 0.1 },  // 추정
    10: { standardScore: 28.3, percentile: 0.0 },
    9: { standardScore: 26.2, percentile: 0.0 },
    8: { standardScore: 24.1, percentile: 0.0 },
    7: { standardScore: 22.0, percentile: 0.0 },
    6: { standardScore: 19.9, percentile: 0.0 },
    5: { standardScore: 17.8, percentile: 0.0 },
    4: { standardScore: 15.7, percentile: 0.0 },
    3: { standardScore: 13.6, percentile: 0.0 },
    2: { standardScore: 11.5, percentile: 0.0 },
    1: { standardScore: 9.4, percentile: 0.0 },
    0: { standardScore: 7.3, percentile: 0.0 },
    },
  },
  
  '2026': {
    verbal: {
      // [언어이해] 30문항 만점 (2026학년도 추정 자료 기반)
    // 실데이터(28~15점) 외 구간은 기울기 2.2 적용하여 추정
    30: { standardScore: 73.1, percentile: 100.0 }, // 추정
    29: { standardScore: 70.9, percentile: 100.0 }, // 추정
    28: { standardScore: 68.7, percentile: 100.0 },
    27: { standardScore: 66.5, percentile: 99.8 },
    26: { standardScore: 64.3, percentile: 99.2 },
    25: { standardScore: 62.1, percentile: 98.2 },
    24: { standardScore: 59.9, percentile: 96.2 },
    23: { standardScore: 57.7, percentile: 92.9 },
    22: { standardScore: 55.5, percentile: 88.0 },
    21: { standardScore: 53.3, percentile: 81.5 },
    20: { standardScore: 51.2, percentile: 73.5 },
    19: { standardScore: 49.0, percentile: 64.6 },
    18: { standardScore: 46.8, percentile: 55.4 },
    17: { standardScore: 44.6, percentile: 46.1 },
    16: { standardScore: 42.4, percentile: 37.2 },
    15: { standardScore: 40.2, percentile: 29.1 },
    // 이하 추정 구간 (Slope: 약 -2.2)
    14: { standardScore: 38.0, percentile: 22.0 }, // 추정
    13: { standardScore: 35.8, percentile: 16.0 }, // 추정
    12: { standardScore: 33.6, percentile: 11.0 }, // 추정
    11: { standardScore: 31.4, percentile: 7.0 },  // 추정
    10: { standardScore: 29.2, percentile: 4.0 },  // 추정
    9: { standardScore: 27.0, percentile: 2.0 },   // 추정
    8: { standardScore: 24.8, percentile: 1.0 },   // 추정
    7: { standardScore: 22.6, percentile: 0.5 },   // 추정
    6: { standardScore: 20.4, percentile: 0.1 },   // 추정
    5: { standardScore: 18.2, percentile: 0.0 },
    4: { standardScore: 16.0, percentile: 0.0 },
    3: { standardScore: 13.8, percentile: 0.0 },
    2: { standardScore: 11.6, percentile: 0.0 },
    1: { standardScore: 9.4, percentile: 0.0 },
    0: { standardScore: 7.2, percentile: 0.0 },
    },
    reasoning: {
      40: { standardScore: 99.5, percentile: 100.0 }, // 추정
    39: { standardScore: 97.2, percentile: 100.0 }, // 추정
    38: { standardScore: 94.9, percentile: 100.0 }, // 추정
    37: { standardScore: 92.6, percentile: 100.0 }, // 추정
    36: { standardScore: 90.3, percentile: 99.9 },
    35: { standardScore: 88.0, percentile: 99.7 },
    34: { standardScore: 85.7, percentile: 99.3 },
    33: { standardScore: 83.4, percentile: 98.6 },
    32: { standardScore: 81.1, percentile: 97.3 },
    31: { standardScore: 78.8, percentile: 95.3 },
    30: { standardScore: 76.5, percentile: 92.5 },
    29: { standardScore: 74.2, percentile: 88.7 },
    28: { standardScore: 71.9, percentile: 83.6 },
    27: { standardScore: 69.6, percentile: 77.5 },
    26: { standardScore: 67.3, percentile: 70.9 },
    25: { standardScore: 65.0, percentile: 63.8 },
    24: { standardScore: 62.7, percentile: 56.4 },
    23: { standardScore: 60.4, percentile: 48.7 },
    22: { standardScore: 58.0, percentile: 41.3 },
    21: { standardScore: 55.7, percentile: 34.7 }, // 보간 추정 (빈칸)
    20: { standardScore: 53.4, percentile: 28.0 },
    19: { standardScore: 51.1, percentile: 22.5 },
    // 이하 추정 구간 (Slope: 약 -2.3)
    18: { standardScore: 48.8, percentile: 17.5 }, // 추정
    17: { standardScore: 46.5, percentile: 13.0 }, // 추정
    16: { standardScore: 44.2, percentile: 9.5 },  // 추정
    15: { standardScore: 41.9, percentile: 6.5 },  // 추정
    14: { standardScore: 39.6, percentile: 4.0 },  // 추정
    13: { standardScore: 37.3, percentile: 2.5 },  // 추정
    12: { standardScore: 35.0, percentile: 1.5 },  // 추정
    11: { standardScore: 32.7, percentile: 0.8 },  // 추정
    10: { standardScore: 30.4, percentile: 0.4 },  // 추정
    9: { standardScore: 28.1, percentile: 0.1 },   // 추정
    8: { standardScore: 25.8, percentile: 0.0 },
    7: { standardScore: 23.5, percentile: 0.0 },
    6: { standardScore: 21.2, percentile: 0.0 },
    5: { standardScore: 18.9, percentile: 0.0 },
    4: { standardScore: 16.6, percentile: 0.0 },
    3: { standardScore: 14.3, percentile: 0.0 },
    2: { standardScore: 12.0, percentile: 0.0 },
    1: { standardScore: 9.7, percentile: 0.0 },
    0: { standardScore: 7.4, percentile: 0.0 },
    },
  },
};

// 임시 점수 테이블 생성 함수 (실제 데이터로 교체할 때까지 사용)
function generatePlaceholderScoreTable(totalQuestions: number): SubjectScoreTable {
  const table: SubjectScoreTable = {};
  
  for (let correct = 0; correct <= totalQuestions; correct++) {
    const correctRate = correct / totalQuestions;
    
    // 임시 표준점수 계산 (정규분포 기반)
    const mean = 0.6;
    const stdDev = 0.15;
    const zScore = (correctRate - mean) / stdDev;
    const standardScore = Math.max(50, Math.min(150, Math.round(100 + zScore * 20)));
    
    // 임시 백분위 계산
    let percentile: number;
    if (zScore >= 2) percentile = 98;
    else if (zScore >= 1.5) percentile = 93;
    else if (zScore >= 1) percentile = 84;
    else if (zScore >= 0.5) percentile = 69;
    else if (zScore >= 0) percentile = 50;
    else if (zScore >= -0.5) percentile = 31;
    else if (zScore >= -1) percentile = 16;
    else if (zScore >= -1.5) percentile = 7;
    else percentile = 2;
    
    table[correct] = { standardScore, percentile };
  }
  
  return table;
}

// 정답 개수로 표준점수와 백분위 가져오기
export function getScoreConversion(
  year: Year,
  subject: Subject,
  correctCount: number
): ScoreConversion {
  const yearData = SCORE_DATA[year];
  if (!yearData) {
    return { standardScore: 100, percentile: 50 }; // 기본값
  }
  
  const subjectData = yearData[subject];
  const conversion = subjectData[correctCount];
  
  if (!conversion) {
    return { standardScore: 100, percentile: 50 }; // 기본값
  }
  
  return conversion;
}
