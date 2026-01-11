// 2026년 LEET 시험일
const EXAM_DATE = new Date('2026-07-19');

export function calculateDday(): { dday: number; examDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const examDay = new Date(EXAM_DATE);
  examDay.setHours(0, 0, 0, 0);
  
  const diffTime = examDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const examDateStr = `${EXAM_DATE.getFullYear()}.${String(EXAM_DATE.getMonth() + 1).padStart(2, '0')}.${String(EXAM_DATE.getDate()).padStart(2, '0')}`;
  
  return {
    dday: diffDays,
    examDate: examDateStr
  };
}

export function getDdayText(): string {
  const { dday } = calculateDday();
  
  if (dday > 0) {
    return `D-${dday}`;
  } else if (dday === 0) {
    return 'D-Day';
  } else {
    return `D+${Math.abs(dday)}`;
  }
}
