import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { PastExamFiles } from './PastExamFiles';
import { AnswerKeyTable } from './AnswerKeyTable';
import { ScoreConversionTable } from './ScoreConversionTable';

function render(element: ReactNode) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(element);
  return container;
}

describe('기출 자료 표시', () => {
  it('문제지가 없으면 링크를 만들지 않고 준비 중임을 안내한다', () => {
    const container = render(<PastExamFiles documents={[]} />);
    expect(container).toHaveTextContent('선택한 유형의 문제지는 아직 준비 중');
    expect(container.querySelector('a')).toBeNull();
  });

  it('변환된 예비 짝수형도 PDF 열기와 다운로드를 제공한다', () => {
    const container = render(<PastExamFiles documents={[{
      year: '09예비', subject: 'verbal', examType: 'even', format: 'pdf', title: '예비 짝수형 문제지',
      url: 'https://example.test/LEET-preliminary.pdf', fileName: 'LEET-preliminary.pdf',
    }]} />);
    expect(container).not.toHaveTextContent('HWP');
    expect(container).toHaveTextContent('PDF 열기');
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(container.querySelector('a[download]')).toHaveAttribute('href', 'https://example.test/LEET-preliminary.pdf?download=LEET-preliminary.pdf');
  });

  it('등록된 PDF의 열기·다운로드만 제공하고 출처 표시는 제거한다', () => {
    const container = render(<PastExamFiles documents={[{
      year: '2026', subject: 'verbal', examType: 'odd', format: 'pdf', title: '테스트 문제지',
      url: '/past-exams/2026/test.pdf', fileName: 'LEET-test.pdf', sizeLabel: '1 MB',
    }]} />);
    const [open, download] = container.querySelectorAll('a');
    expect(open).toHaveTextContent('PDF 열기');
    expect(open).toHaveAttribute('href', '/past-exams/2026/test.pdf');
    expect(open).toHaveAttribute('target', '_blank');
    expect(download).toHaveAttribute('download', 'LEET-test.pdf');
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(container).not.toHaveTextContent('출처');
    expect(container).toHaveTextContent('PDF · 1 MB');
  });

  it('누락된 문항을 건너뛰거나 정답을 생성하지 않고 미등록으로 표시한다', () => {
    const container = render(<AnswerKeyTable answers={{ 1: 4, 3: 2 }} total={3} />);
    const cells = container.querySelectorAll('li');
    expect(cells).toHaveLength(3);
    expect(cells[0]).toHaveAttribute('aria-label', '1번 정답 4');
    expect(cells[1]).toHaveAttribute('aria-label', '2번 정답 미등록');
    expect(cells[1]).toHaveTextContent('—');
    expect(cells[2]).toHaveAttribute('aria-label', '3번 정답 2');
  });

  it('점수 환산표는 만점부터 0개까지 표시하고 실제 0값도 보존한다', () => {
    const container = render(<ScoreConversionTable scores={{
      2: { standardScore: 73.1, percentile: 100 },
      1: { standardScore: 9.4, percentile: 0 },
      0: { standardScore: 0, percentile: 0 },
    }} total={2} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect([...rows].map(row => row.querySelector('th')?.textContent)).toEqual(['2개', '1개', '0개']);
    expect([...rows[0].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['73.1', '100.0']);
    expect([...rows[2].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['0.0', '0.0']);
    expect(container).not.toHaveTextContent('등록된 환산 자료가 없는');
  });

  it('누락된 점수 자료는 기본 점수를 생성하지 않고 대시로 표시한다', () => {
    const container = render(<ScoreConversionTable scores={{ 1: { standardScore: 10.3, percentile: 0 } }} total={1} />);
    const rows = container.querySelectorAll('tbody tr');
    expect([...rows[1].querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['—', '—']);
    expect(container).toHaveTextContent('—는 등록된 환산 자료가 없는 구간입니다.');
  });
});
