import { describe, expect, it } from 'vitest';
import { renderDdayTemplate, templateError } from './ddayTemplate';
import { calculateConfiguredDday, isExamDate, nextKstMidnight } from './examScheduleModel';

describe('공통 디데이 계산과 문구', () => {
  it.each([
    ['2026-07-18T14:59:59Z','D-1'],['2026-07-18T15:00:00Z','D-Day'],['2026-07-19T15:00:00Z','D+1'],
    ['2026-07-19T23:00:00-07:00','D+1'],
  ])('KST 달력 날짜로 계산한다: %s', (now,text) => {
    expect(calculateConfiguredDday('2026-07-19',new Date(now)).ddayText).toBe(text);
  });
  it('윤일과 연말을 계산하고 잘못된 달력 날짜를 차단한다', () => {
    expect(calculateConfiguredDday('2028-03-01',new Date('2028-02-29T12:00:00+09:00')).dday).toBe(1);
    expect(calculateConfiguredDday('2027-01-01',new Date('2026-12-31T12:00:00+09:00')).dday).toBe(1);
    for(const date of ['2026-02-29','2026-04-31','2026-7-19','1999-12-31','2100-01-01','infinity']) expect(isExamDate(date)).toBe(false);
    expect(nextKstMidnight(new Date('2026-07-18T14:59:59Z'))).toBe(Date.parse('2026-07-18T15:00:00Z'));
  });
  it('반복 치환과 생략을 지원하며 HTML을 문자로 유지한다', () => {
    expect(renderDdayTemplate(' {date} · {dday} · {dday} ','2026.07.19','D-120')).toBe('2026.07.19 · D-120 · D-120');
    expect(renderDdayTemplate('시험이 끝났습니다.','2026.07.19','D+1')).toBe('시험이 끝났습니다.');
    expect(renderDdayTemplate('<b>{dday}</b>','2026.07.19','D-Day')).toBe('<b>D-Day</b>');
  });
  it.each(['',' ','{year}','{DDAY}','{{dday}}','{date','value}','line\nnext','tab\t','\u0085','a\u2028b','😀'.repeat(101)])('잘못된 문구를 차단한다: %s', value => {
    expect(templateError(value)).not.toBeNull();
  });
  it('Unicode 코드 포인트 100자를 허용한다', () => {
    expect(templateError('😀'.repeat(100))).toBeNull();
  });
});
