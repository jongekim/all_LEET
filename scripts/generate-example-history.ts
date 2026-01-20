import fs from 'node:fs';
import path from 'node:path';

import { getCorrectAnswers } from '../src/utils/answerData';
import { getQuestionCount, gradeAnswers } from '../src/utils/grading';
import type { ExamType, GradingResult, Subject, Year } from '../src/App';

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  if (maxInclusive < minInclusive) {
    throw new Error(`randomInt: invalid range ${minInclusive}..${maxInclusive}`);
  }
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rng() * span);
}

function shuffleInPlace<T>(rng: Rng, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pickWrongAnswer(rng: Rng, correct: number): number {
  // 답은 1~5
  const candidates = [1, 2, 3, 4, 5].filter(v => v !== correct);
  return candidates[Math.floor(rng() * candidates.length)];
}

function parseSeedFromArgs(): number {
  const arg = process.argv.find(a => a.startsWith('--seed='));
  if (!arg) return 20250106;
  const raw = arg.split('=')[1];
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid --seed: ${raw}`);
  return Math.floor(n);
}

function getKstMillis(isoLocalKst: string): number {
  // e.g. '2025-01-06T00:00:00+09:00'
  const t = new Date(isoLocalKst).getTime();
  if (!Number.isFinite(t)) throw new Error(`Invalid date: ${isoLocalKst}`);
  return t;
}

function randomUniqueTimestamp(rng: Rng, startMs: number, endMs: number, used: Set<number>): number {
  const span = endMs - startMs;
  if (span <= 0) throw new Error('Invalid timestamp range');

  let t = startMs + Math.floor(rng() * span);
  // 충돌 방지(최대 수백개 수준이라 선형 보정으로 충분)
  while (used.has(t)) t += 1;
  used.add(t);
  return t;
}

function randomUniqueTimestampAfter(
  rng: Rng,
  startMs: number,
  endMs: number,
  used: Set<number>,
  afterMs: number,
): number {
  const effectiveStart = Math.max(startMs, afterMs + 1);
  if (effectiveStart >= endMs) {
    throw new Error('No room to pick a timestamp after the given value');
  }
  return randomUniqueTimestamp(rng, effectiveStart, endMs, used);
}

const YEARS: Year[] = [
  '09예비',
  '2009',
  '2010',
  '2011',
  '2012',
  '2013',
  '2014',
  '2015',
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
  '2026',
];

const SUBJECTS: Subject[] = ['verbal', 'reasoning'];
const EXAM_TYPE: ExamType = 'odd';

function pickYearsForSecondPass(rng: Rng, years: Year[], count: number): Set<Year> {
  const pool = [...years];
  shuffleInPlace(rng, pool);
  return new Set(pool.slice(0, Math.max(0, Math.min(count, pool.length))));
}

function buildOneRecord(params: {
  rng: Rng;
  year: Year;
  subject: Subject;
  examType: ExamType;
  round: number;
  groupTimestamp: number;
  timestampOffsetMs: number;
  accuracyMin: number;
  accuracyMax: number;
}): GradingResult {
  const {
    rng,
    year,
    subject,
    examType,
    round,
    groupTimestamp,
    timestampOffsetMs,
    accuracyMin,
    accuracyMax,
  } = params;

  const total = getQuestionCount(year, subject);
  const correctAnswers = getCorrectAnswers(year, subject, examType);

  const minCorrect = Math.ceil(total * accuracyMin);
  const maxCorrect = Math.floor(total * accuracyMax);
  const targetCorrect = randomInt(rng, minCorrect, Math.max(minCorrect, maxCorrect));

  const questions = Array.from({ length: total }, (_, i) => i + 1);
  shuffleInPlace(rng, questions);
  const correctSet = new Set(questions.slice(0, targetCorrect));

  const userAnswers: Record<number, number> = {};
  for (let q = 1; q <= total; q++) {
    const correct = correctAnswers[q];
    userAnswers[q] = correctSet.has(q) ? correct : pickWrongAnswer(rng, correct);
  }

  const graded = gradeAnswers(year, subject, userAnswers, total, examType);

  return {
    ...graded,
    round,
    examType,
    groupTimestamp,
    // UI에서 표시/정렬에 쓰이는 timestamp를 요구 조건(2025-01-06~2025-07-19)에 맞춰 고정
    timestamp: groupTimestamp + timestampOffsetMs,
  };
}

function main() {
  const seed = parseSeedFromArgs();
  const rng = mulberry32(seed);

  const startMs = getKstMillis('2025-01-06T00:00:00+09:00');
  const endMs = getKstMillis('2025-07-19T23:59:59+09:00');

  // “절반의 회차는 2회독” → 19개 연도 중 10개 연도에 대해 2회독 생성
  const secondPassYearCount = Math.round(YEARS.length / 2);
  const yearsWithSecondPass = pickYearsForSecondPass(rng, YEARS, secondPassYearCount);

  const usedGroupTimestamps = new Set<number>();
  const records: GradingResult[] = [];

  for (const year of YEARS) {
    const attempts = yearsWithSecondPass.has(year) ? 2 : 1;

    // 회독 순서 보장: 1회독 timestamp < 2회독 timestamp
    const groupTimestamps: number[] = [];
    if (attempts === 1) {
      groupTimestamps.push(randomUniqueTimestamp(rng, startMs, endMs, usedGroupTimestamps));
    } else {
      // 2회독은 1회독보다 최소 1시간 이후, 최대 21일 이후로 생성(범위 내에서 자동 조정)
      const minGapMs = 60 * 60 * 1000;
      const maxGapMs = 21 * 24 * 60 * 60 * 1000;

      // 1회독은 뒤쪽 여유를 조금 남겨서 뽑기 (gap을 적용해도 end를 넘기지 않게)
      const firstLatest = Math.max(startMs, endMs - minGapMs);
      const first = randomUniqueTimestamp(rng, startMs, firstLatest, usedGroupTimestamps);
      const desiredGap = randomInt(rng, minGapMs, maxGapMs);
      const after = Math.min(endMs - 1, first + desiredGap);

      const second = randomUniqueTimestampAfter(rng, startMs, endMs, usedGroupTimestamps, after);

      groupTimestamps.push(first, second);
    }

    for (let round = 1; round <= attempts; round++) {
      const groupTimestamp = groupTimestamps[round - 1];

      for (const subject of SUBJECTS) {
        // 2회독이 조금 더 잘 보는 느낌(그래도 75~95% 범위 준수)
        const accuracyMin = round === 1 ? 0.75 : 0.8;
        const accuracyMax = 0.95;

        const timestampOffsetMs = subject === 'verbal' ? 10 : 500;

        records.push(
          buildOneRecord({
            rng,
            year,
            subject,
            examType: EXAM_TYPE,
            round,
            groupTimestamp,
            timestampOffsetMs,
            accuracyMin,
            accuracyMax,
          }),
        );
      }
    }
  }

  // 시간순 정렬(오래된 → 최신). UI에서 기본은 최신순이지만, seed는 정렬해두면 검증이 편함.
  records.sort((a, b) => (a.groupTimestamp ?? a.timestamp) - (b.groupTimestamp ?? b.timestamp));

  const outPath = path.resolve(process.cwd(), 'supabase/seed/example-history.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2), 'utf8');

  const summary = {
    seed,
    years: YEARS.length,
    yearsWithSecondPass: yearsWithSecondPass.size,
    groups: YEARS.length + yearsWithSecondPass.size,
    records: records.length,
    examType: EXAM_TYPE,
    timestampRangeKst: {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    },
  };

  console.log(`Wrote ${records.length} records to ${outPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
