import type { ScoreConversion } from '../utils/scoreData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface ScoreConversionTableProps {
  scores: Record<number, ScoreConversion> | undefined;
  total: number;
}

export function ScoreConversionTable({ scores, total }: ScoreConversionTableProps) {
  const counts = Array.from({ length: total + 1 }, (_, index) => total - index);
  const hasMissingScores = counts.some(count => !scores?.[count]);

  return (
    <>
      <Table className="score-conversion-table" aria-label="맞은 개수별 표준점수와 백분위" aria-describedby="score-estimate-notice">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">맞은 개수</TableHead>
            <TableHead scope="col">표준점수</TableHead>
            <TableHead scope="col">백분위</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {counts.map(count => {
            const score = scores?.[count];
            return (
              <TableRow key={count}>
                <TableHead scope="row">{count}개</TableHead>
                <TableCell title={score?.estimatedStandardScore ? '추정 표준점수' : undefined}>{score ? score.standardScore.toFixed(1) : '—'}</TableCell>
                <TableCell title={score?.estimatedPercentile ? '추정 백분위' : undefined}>{score ? score.percentile.toFixed(1) : '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasMissingScores && <p className="text-xs text-gray-500 mt-3">—는 등록된 환산 자료가 없는 구간입니다.</p>}
    </>
  );
}
