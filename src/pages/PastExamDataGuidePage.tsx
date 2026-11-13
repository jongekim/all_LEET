import { BookOpenText } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import '../styles/past-exams.css';
import '../styles/past-exam-data-guide.css';

export function PastExamDataGuidePage() {
  return (
    <div className="past-exams-page min-h-screen bg-gray-50">
      <PageHeader
        title={<span className="flex items-center gap-2"><BookOpenText className="w-6 h-6 text-blue-600 shrink-0" aria-hidden="true" />기출 정답·정답률·점수 환산 기준</span>}
        description="all LEET 기출 정답표와 통계, 점수 환산표를 읽는 방법입니다."
        backTo="/past-exams"
      />
      <main className="past-exam-main past-exam-data-guide">
        <nav className="past-exam-panel guide-panel" aria-label="기출 데이터 기준 목차">
          <h2>목차</h2>
          <ul className="guide-toc">
            <li><a href="#answer-keys">정답과 문제지</a></li>
            <li><a href="#question-statistics">문항별 정답률</a></li>
            <li><a href="#score-conversion">표준점수와 백분위</a></li>
            <li><a href="#corrections">정정 문의</a></li>
          </ul>
        </nav>

        <section id="answer-keys" className="past-exam-panel guide-panel" aria-labelledby="answer-keys-title">
          <h2 id="answer-keys-title">정답과 문제지</h2>
          <p>문제지와 정답표를 볼 때는 학년도·과목·문형을 맞춰 확인하세요. 정답표는 all LEET 채점에 사용하는 정답 데이터와 같습니다. 2027학년도 기출은 단일 문형으로 제공합니다.</p>
          <p>법학적성시험 문제의 저작권은 법학전문대학원협의회에 있습니다.</p>
        </section>

        <section id="question-statistics" className="past-exam-panel guide-panel" aria-labelledby="question-statistics-title">
          <h2 id="question-statistics-title">문항별 정답률</h2>
          <p>문항별 정답률은 집계 대상인 저장 풀이 중 해당 문항의 정답을 고른 비율입니다. 반복 저장 풀이도 집계하고, 답안을 저장했지만 문항을 건너뛴 경우에는 미응답을 오답으로 포함합니다.</p>
          <p>홀수형과 짝수형의 공통 문항은 합산하고 선지별 선택률은 현재 문제지의 순서로 보여줍니다. 이 정답률은 all LEET의 풀이 기록을 바탕으로 하므로 실제 시험 전체 응시자의 정답률과 차이가 있을 수 있습니다.</p>
          <p>통계가 공개되지 않은 시험은 준비 중으로 표시합니다. 집계 대상 풀이가 없는 문항에는 정답률을 ‘—’로 표시합니다.</p>
        </section>

        <section id="score-conversion" className="past-exam-panel guide-panel" aria-labelledby="score-conversion-title">
          <h2 id="score-conversion-title">표준점수와 백분위</h2>
          <p>환산표는 맞은 개수별로 표준점수와 백분위를 보여줍니다. all LEET 채점 결과는 선택한 학년도와 과목의 환산표를 기준으로 표시합니다.</p>
          <h3>2027학년도 환산표 산출 기준</h3>
          <p>제공 자료를 바탕으로 환산표를 작성했습니다. 표준점수에는 선형 계산을, 백분위에는 정규분포 계산을 사용했습니다. 환산표의 값은 소수점 첫째 자리까지 표시합니다.</p>
          <p>원자료의 발행 기관은 확인되지 않았습니다.</p>
        </section>

        <section id="corrections" className="past-exam-panel guide-panel" aria-labelledby="corrections-title">
          <h2 id="corrections-title">정정 문의</h2>
          <p>정답이나 환산값의 오류를 발견했다면 학년도·과목·문형과 문항 번호 또는 맞은 개수를 함께 보내주세요.</p>
          <a className="past-exam-guide-link" href="mailto:all_leet@naver.com">all_leet@naver.com</a>
        </section>
      </main>
    </div>
  );
}
