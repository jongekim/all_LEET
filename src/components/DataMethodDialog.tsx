import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';
import '../styles/question-statistics.css';
import '../styles/reference-guidance.css';

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
        <section><h3>일부 구간은 추정값입니다</h3><p>제공된 환산값이 없는 일부 구간은 추정값으로, 실제 성적과 차이가 있을 수 있습니다. 참고용으로 확인해주세요.</p></section>
        <section>
          <h3>출처와 산출 방법</h3>
          {year === '2027' ? (
            <p>제공받은 환산표를 바탕으로 작성했으며, 원자료의 발행 기관은 확인되지 않았습니다. 빈 구간의 표준점수는 제공값의 변화 폭으로, 낮은 구간의 백분위는 정규분포를 이용해 추정했습니다.</p>
          ) : (
            <p>이 표는 all LEET에 등록된 환산 데이터를 보여줍니다. 원자료의 발행 기관과 구간별 추정 방법은 학년도에 따라 다를 수 있습니다.</p>
          )}
        </section>
      </>}
    </DialogContent>
  </Dialog>;
}
