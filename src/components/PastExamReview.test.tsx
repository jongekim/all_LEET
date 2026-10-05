// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fixture from '../../e2e/fixtures/question-statistics-2026.json';
import { PrerenderStatisticsContext } from '../contexts/PrerenderStatisticsContext';
import { getCorrectAnswers } from '../utils/answerData';
import { validatePublicStatistics } from '../../scripts/prerenderStatistics';
import { PastExamReview } from './PastExamReview';
import { QuestionStatistics } from './QuestionStatistics';
import { AnswerKeyTable } from './AnswerKeyTable';

const from = vi.hoisted(() => vi.fn());
vi.mock('../contexts/AuthContext', () => ({ supabase: { from } }));

function render(year = '2026') {
  return renderToStaticMarkup(
    <PrerenderStatisticsContext.Provider value={validatePublicStatistics(fixture)}>
      <PastExamReview>
        <QuestionStatistics selection={{ year, subject: 'verbal', examType: 'odd' }}>
          <AnswerKeyTable answers={getCorrectAnswers(year, 'verbal', 'odd')} total={30} />
        </QuestionStatistics>
      </PastExamReview>
    </PrerenderStatisticsContext.Provider>,
  );
}

describe('접힌 정답표의 사전 HTML', () => {
  it('기존 보기 버튼과 기본 접힘을 유지하며 실제 문항·정답률을 HTML에 포함한다', () => {
    const html = render();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toMatch(/hidden=""[^>]*class="past-exam-review-content/);
    expect(html).toContain('1번 정답률 78.3%, 응답 분포 보기');
    expect(html.match(/class="answer-key-cell"/g)).toHaveLength(30);
    expect(html.match(/class="question-rate question-rate--answer-key"/g)).toHaveLength(30);
    expect(html).not.toContain('문항 통계를 불러오는 중');
    expect(html).not.toMatch(/sample_count|choice_counts|source_snapshot_at|published_at|254건|2026-09-17/);
    expect(from).not.toHaveBeenCalled();
  });

  it('공개 발행본이 없는 2027에는 임의 정답률 없이 기존 정답을 제공한다', () => {
    const html = render('2027');
    expect(html).toContain('이 시험의 문항 통계가 아직 준비되지 않았습니다.');
    expect(html).not.toContain('question-rate--answer-key');
    expect(html.match(/class="answer-key-cell"/g)).toHaveLength(30);
  });
});
