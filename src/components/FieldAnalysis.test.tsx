import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GradingResult } from '../App';
import { gradeAnswers } from '../utils/grading';
import { getCorrectAnswers } from '../utils/answerData';
import { FieldAnalysis } from './FieldAnalysis';

afterEach(cleanup);

function result(): GradingResult {
  const answers = { ...getCorrectAnswers('2026', 'verbal', 'odd') };
  answers[7] = answers[7] % 5 + 1;
  answers[28] = 0;
  return { ...gradeAnswers('2026', 'verbal', answers, 30, 'odd'), timestamp: 123, round: 3 };
}

describe('분야별 분석', () => {
  it('분야 요약을 유지하며 한 분야만 펼치고 정오답·미응답을 구별한다', () => {
    const onSelect = vi.fn();
    render(<FieldAnalysis result={result()} onQuestionSelect={onSelect} />);
    const rows = screen.getAllByRole('button', { name: /내 정답 비율/ });
    expect(rows).toHaveLength(5);
    expect(screen.queryByRole('region', { name: /문항별 결과/ })).toBeNull();
    fireEvent.click(rows[0]);
    expect(screen.getAllByRole('region', { name: /문항별 결과/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /언어이해 사회 .*문항 보기/ }));
    const detail = screen.getByRole('region', { name: '언어이해 사회 문항별 결과' });
    expect(screen.getAllByRole('region', { name: /문항별 결과/ })).toHaveLength(1);
    expect(detail.textContent).toContain('정답 10 · 오답 1 · 미응답 1');
    expect(within(detail).getByRole('button', { name: '언어이해 28번 미응답, 답안표로 이동' })).toBeDefined();
    fireEvent.click(within(detail).getByRole('button', { name: '언어이해 7번 오답, 답안표로 이동' }));
    expect(onSelect).toHaveBeenCalledWith(7);
    fireEvent.click(screen.getByRole('button', { name: '언어이해 분야별 분석 접기' }));
    expect(screen.queryByRole('button', { name: /내 정답 비율/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '언어이해 분야별 분석 펼치기' }));
    expect(screen.getAllByRole('button', { name: /내 정답 비율/ })).toHaveLength(5);
    expect(screen.queryByRole('region', { name: /문항별 결과/ })).toBeNull();
  });

  it('반영된 답안으로 수치와 열린 문항 상태를 함께 갱신한다', () => {
    const before = result();
    const { rerender } = render(<FieldAnalysis result={before} onQuestionSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /언어이해 사회 .*문항 보기/ }));
    const updated = { ...before, ...gradeAnswers('2026', 'verbal', { ...before.userAnswers, 7: before.correctAnswers![7] }, 30, 'odd') };
    rerender(<FieldAnalysis result={updated} onQuestionSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /언어이해 사회 11\/12 정답/ })).toBeDefined();
    expect(screen.getByRole('region', { name: '언어이해 사회 문항별 결과' }).textContent).toContain('정답 11 · 오답 0 · 미응답 1');
    expect(screen.getByRole('button', { name: '언어이해 7번 정답, 답안표로 이동' })).toBeDefined();
  });

  it('분류·답안·문항 자료가 없는 과거 결과를 임의의 오답으로 표시하지 않는다', () => {
    const old = { ...result(), userAnswers: undefined, fieldAnalysis: [{ field: '사회', correct: 0, total: 0, questions: [7] }] };
    const { rerender } = render(<FieldAnalysis result={old} onQuestionSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /내 정답 비율 미계산/ }));
    expect(screen.getByRole('button', { name: '언어이해 7번 결과 없음, 답안표로 이동' })).toBeDefined();
    expect(screen.queryByText(/정답 0 · 오답/)).toBeNull();
    rerender(<FieldAnalysis result={{ ...old, fieldAnalysis: [{ field: '사회', correct: 0, total: 0, questions: [] }] }} onQuestionSelect={vi.fn()} />);
    expect(screen.getByText('문항 정보가 없습니다.')).toBeDefined();
    rerender(<FieldAnalysis result={{ ...old, fieldAnalysis: [] }} onQuestionSelect={vi.fn()} />);
    expect(screen.getByText('분야별 분류 자료가 아직 준비되지 않았습니다.')).toBeDefined();
  });
});
