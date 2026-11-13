import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import '../styles/question-statistics.css';
import '../styles/reference-guidance.css';
import '../styles/past-exam-data-guide.css';

type DataMethodDialogProps = { kind: 'statistics'; year?: never } | { kind: 'conversion'; year: string };

export function DataMethodDialog({ kind, year }: DataMethodDialogProps) {
  const statistics = kind === 'statistics';
  const title = statistics ? '통계 집계 기준' : '점수 환산 기준';
  return <Dialog>
    <DialogTrigger asChild><button type="button" className="reference-method-link">{title}<ChevronRight size={14} aria-hidden="true" /></button></DialogTrigger>
    <DialogContent className="question-statistics-dialog reference-method-dialog" overlayClassName="question-statistics-overlay" closeLabel="닫기">
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{statistics ? '정답률을 확인할 때 참고해주세요.' : '표준점수·백분위 확인 시 참고해주세요.'}</DialogDescription>
      {statistics ? <>
        <section><h3>집계 대상</h3><p>all LEET에 답안이 저장된 풀이 기록을 기준으로 계산합니다. 반복 채점도 포함합니다.</p></section>
        <section><h3>정답률 계산</h3><p>문항별 집계 대상 풀이 중 정답을 선택한 비율입니다. 미응답은 오답으로 포함합니다.</p></section>
        <section><h3>통계의 한계</h3><p>실제 시험 전체 응시자의 정답률과는 다를 수 있습니다. 반올림으로 선지별 비율 합계가 100%와 다를 수 있습니다.</p></section>
      </> : <>
        <section><h3>학년도별 환산 데이터</h3><p>현재 all LEET 채점에 사용하는 학년도별 점수 환산 데이터를 제공합니다.</p></section>
        <section>
          <h3>출처와 산출 방법</h3>
          {year === '2027' ? (
            <p>제공받은 환산표를 바탕으로 작성했으며, 원자료의 발행 기관은 확인되지 않았습니다. 환산표 작성에 표준점수의 선형 계산과 백분위의 정규분포 계산을 사용했습니다.</p>
          ) : (
            <p>이 표는 all LEET에 등록된 환산 데이터를 보여줍니다. 자료의 출처와 산출 기준은 학년도에 따라 다를 수 있습니다.</p>
          )}
        </section>
      </>}
      <a
        className="past-exam-guide-link"
        href={statistics ? '/past-exams/data-guide#question-statistics' : '/past-exams/data-guide#score-conversion'}
      >
        {statistics ? '정답률 집계 기준 자세히 보기' : '점수 환산 기준 자세히 보기'}
        <ChevronRight size={16} aria-hidden="true" />
      </a>
    </DialogContent>
  </Dialog>;
}
