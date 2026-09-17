import { createHash } from 'node:crypto';
import { AGGREGATION_VERSION, type StatisticsCohort } from '../src/types/questionStatistics';
import { countValue, objectValue, statisticsCatalog, validateCohort } from '../src/utils/questionStatisticsModel';

export interface StatisticsArtifact {
  project_ref: string;
  aggregation_version: typeof AGGREGATION_VERSION;
  source_snapshot_at: string;
  code_revision: string;
  source_count: number;
  included_count: number;
  quarantined_count: number;
  malformed_histories: number;
  catalog: ReturnType<typeof statisticsCatalog>;
  cohorts: StatisticsCohort[];
  artifact_checksum: string;
}

export function checksum(value: Omit<StatisticsArtifact, 'artifact_checksum'>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function makeArtifact(raw: unknown, project: string, revision: string): StatisticsArtifact {
  const source = objectValue(raw);
  const catalog = statisticsCatalog();
  if (typeof source.source_snapshot_at !== 'string' || !Number.isFinite(Date.parse(source.source_snapshot_at))) throw new Error('원본 조회 시각이 잘못되었습니다.');
  if (!Array.isArray(source.cohorts)) throw new Error('집계 결과가 없습니다.');
  const cohorts = source.cohorts.map(validateCohort).sort((a,b) => `${a.year}:${a.subject}:${a.exam_type}`.localeCompare(`${b.year}:${b.subject}:${b.exam_type}`));
  if (cohorts.length !== catalog.length || new Set(cohorts.map(row => `${row.year}:${row.subject}:${row.exam_type}`)).size !== catalog.length) throw new Error('시험 조합이 누락되거나 중복되었습니다.');
  for (const row of cohorts) {
    const key = catalog.find(key => key.year === row.year && key.subject === row.subject && key.exam_type === row.exam_type);
    if (!key || key.answer_key_version !== row.answer_key_version) throw new Error('현재 정답표와 집계 버전이 다릅니다.');
  }
  const body = {
    project_ref: project, aggregation_version: AGGREGATION_VERSION, source_snapshot_at: source.source_snapshot_at,
    code_revision: revision, source_count: countValue(source.source_count), included_count: countValue(source.included_count),
    quarantined_count: countValue(source.quarantined_count), malformed_histories: countValue(source.malformed_histories), catalog, cohorts,
  };
  if (body.quarantined_count !== 0 || body.malformed_histories !== 0 || body.included_count !== body.source_count
    || cohorts.reduce((sum,row) => sum + row.sample_count,0) !== body.included_count) throw new Error('예상하지 못한 원본 데이터가 있습니다. 임의 제외하지 않고 발행을 중단합니다.');
  return { ...body, artifact_checksum: checksum(body) };
}

export function validateArtifact(raw: unknown, project: string): StatisticsArtifact {
  const source = objectValue(raw);
  if (source.project_ref !== project || source.aggregation_version !== AGGREGATION_VERSION || typeof source.code_revision !== 'string') throw new Error('프로젝트 또는 집계 규칙 버전이 다릅니다.');
  const artifact = makeArtifact(source, project, source.code_revision);
  if (source.artifact_checksum !== artifact.artifact_checksum || JSON.stringify(source.catalog) !== JSON.stringify(artifact.catalog)) throw new Error('파일이 변경되었거나 정답표가 갱신되었습니다. prepare를 다시 실행하세요.');
  return artifact;
}
