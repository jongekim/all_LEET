import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { projectId, publicAnonKey } from '../src/utils/supabase/info';
import { answerKeyVersion, formatRate, validateSnapshot } from '../src/utils/questionStatisticsModel';
import { getCorrectAnswers } from '../src/utils/answerData';

// The published, anon-readable generation is the only source for this search snapshot.
// Refresh it after a statistics publication, then review the generated diff before deployment.
const fields = 'year,subject,exam_type,snapshot_id::text,answer_key_version,aggregation_version,question_count,sample_count::text,items,source_snapshot_at,published_at';
const url = new URL(`https://${projectId}.supabase.co/rest/v1/question_statistics_snapshots`);
url.searchParams.set('select', fields);
url.searchParams.set('order', 'year.asc,subject.asc,exam_type.asc');
url.searchParams.set('limit', '1000');

async function main() {
  const response = await fetch(url, {
    headers: { apikey: publicAnonKey, Authorization: `Bearer ${publicAnonKey}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`공개 문항 통계 조회 실패: HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length !== 76) throw new Error('공개 문항 통계가 예상한 76개 조합과 다릅니다. 갱신 전 구조를 확인하세요.');

  const rows = body.map(validateSnapshot);
  const generation = rows[0].snapshot_id;
  if (rows.some(row => row.snapshot_id !== generation || row.source_snapshot_at !== rows[0].source_snapshot_at)) {
    throw new Error('공개 문항 통계에 서로 다른 발행 세대가 섞여 있습니다.');
  }
  const combinations = new Set(rows.map(row => `${row.year}:${row.subject}:${row.exam_type}`));
  if (combinations.size !== rows.length) throw new Error('공개 문항 통계 조합이 중복되었습니다.');

  const cohorts = rows.map(row => {
    const selection = { year: row.year, subject: row.subject, examType: row.exam_type };
    if (row.answer_key_version !== answerKeyVersion(selection)) {
      throw new Error(`${row.year} ${row.subject} ${row.exam_type} 정답 버전이 현재 앱과 다릅니다.`);
    }
    const answers = getCorrectAnswers(row.year, row.subject, row.exam_type);
    return {
      year: row.year, subject: row.subject, examType: row.exam_type,
      sampleCount: row.sample_count,
      rates: row.items.map(item => formatRate(item.choice_counts[answers[item.question_no] - 1], row.sample_count)),
    };
  });

  const output = {
    snapshotId: generation,
    sourceSnapshotAt: rows[0].source_snapshot_at,
    publishedAt: rows.reduce((latest, row) => row.published_at > latest ? row.published_at : latest, rows[0].published_at),
    cohorts,
  };
  const target = path.resolve('src/data/seoQuestionRates.json');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`검색용 공개 문항 통계 ${cohorts.length}개 조합을 발행본 ${generation}에서 갱신했습니다.`);
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
