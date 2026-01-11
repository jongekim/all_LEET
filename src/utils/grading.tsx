import { Subject, Year, GradingResult, ExamType } from '../App';
import { getCorrectAnswers } from './answerData';
import { getScoreConversion } from './scoreData';

// 문제 수 결정
export function getQuestionCount(year: Year, subject: Subject): number {
  const yearNum = year === '09예비' ? 2009 : parseInt(year);
  
  if (subject === 'verbal') {
    if (yearNum <= 2009) return 40;
    if (yearNum <= 2018) return 35;
    return 30;
  } else {
    if (yearNum <= 2009) return 40;
    if (yearNum <= 2018) return 35;
    return 40;
  }
}

// 모의 정답 생성 (실제로는 실제 정답을 사용해야 함)
// 년도, 과목, 시험 유형에 따라 고정된 정답을 반환하기 위해 시드 기반 랜덤 사용
function generateCorrectAnswers(year: Year, subject: Subject, count: number, examType: ExamType): Record<number, number> {
  // 실제 정답 데이터 사용
  return getCorrectAnswers(year, subject, examType);
}

// 분야별 문제 범위 (모의 데이터)
function getFieldRanges(subject: Subject, total: number) {
  if (subject === 'verbal') {
    const perField = Math.floor(total / 3);
    return [
      { field: '인문', start: 1, end: perField },
      { field: '사회', start: perField + 1, end: perField * 2 },
      { field: '과학/기술', start: perField * 2 + 1, end: total },
    ];
  } else {
    const perField = Math.floor(total / 4);
    return [
      { field: '논리', start: 1, end: perField },
      { field: '논증', start: perField + 1, end: perField * 2 },
      { field: '법학', start: perField * 2 + 1, end: perField * 3 },
      { field: '수리', start: perField * 3 + 1, end: total },
    ];
  }
}

// 채점 실행
export function gradeAnswers(
  year: Year,
  subject: Subject,
  userAnswers: Record<number, number>,
  total: number,
  examType: ExamType
): GradingResult {
  const correctAnswers = generateCorrectAnswers(year, subject, total, examType);
  const fieldRanges = getFieldRanges(subject, total);
  
  // 전체 정답 개수 계산
  let correct = 0;
  for (let i = 1; i <= total; i++) {
    if (userAnswers[i] === correctAnswers[i]) {
      correct++;
    }
  }
  
  // 분야별 정답 개수 계산
  const fieldAnalysis = fieldRanges.map(range => {
    let fieldCorrect = 0;
    for (let i = range.start; i <= range.end; i++) {
      if (userAnswers[i] === correctAnswers[i]) {
        fieldCorrect++;
      }
    }
    return {
      field: range.field,
      correct: fieldCorrect,
      total: range.end - range.start + 1,
    };
  });
  
  // 실제 점수 데이터에서 표준점수와 백분위 가져오기
  const scoreConversion = getScoreConversion(year, subject, correct);
  const standardScore = scoreConversion.standardScore;
  const percentile = scoreConversion.percentile;
  
  // 2020년 이전 시험의 보정 점수 계산
  const yearNum = year === '09예비' ? 2009 : parseInt(year);
  let adjustedScore: number | undefined;
  
  if (yearNum < 2020) {
    if (subject === 'verbal') {
      adjustedScore = Math.round(standardScore * 0.9);
    } else if (subject === 'reasoning') {
      adjustedScore = Math.round(standardScore * 1.2);
    }
  }
  
  return {
    year,
    subject,
    correct,
    total,
    standardScore,
    percentile,
    fieldAnalysis,
    timestamp: Date.now(),
    userAnswers,
    correctAnswers,
    examType,
    adjustedScore,
  };
}