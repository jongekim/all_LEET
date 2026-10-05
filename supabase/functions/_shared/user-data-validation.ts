import {
  type DataDomain,
  type DataRow,
  EDIT_FIELDS,
  RECALCULATE_FIELDS,
  type RecalculateField,
} from "./user-data-contract.ts";
import { gradeAnswers } from "./user-data-rules/grading.ts";
import { getCorrectAnswers } from "./user-data-rules/answerData.ts";
import { SCORE_DATA } from "./user-data-rules/scoreData.ts";
import { analyzeLawSchools } from "./user-data-rules/lawschool.ts";
import type { GradingResult } from "./user-data-rules/types.ts";
import { USER_DATA_RULES_VERSION } from "./user-data-contract.ts";
export const RULES_VERSION = USER_DATA_RULES_VERSION;
const fail = (): never => {
  throw new Error("INVALID_INPUT");
};
function number(v: unknown, min: number, max: number, integer = false): number {
  if (
    typeof v !== "number" || !Number.isFinite(v) || v < min || v > max ||
    integer && !Number.isInteger(v)
  ) return fail();
  return v;
}
function text(v: unknown, min: number, max: number): string {
  if (typeof v !== "string" || v.trim().length < min || v.length > max) {
    return fail();
  }
  return v.trim();
}
export function admissionInput(v: unknown): { leet: number; gpa: number } {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  const input = v as DataRow;
  if (Object.keys(input).some((k) => !["leet", "gpa"].includes(k))) {
    return fail();
  }
  return {
    leet: number(input.leet, 0, 200, true),
    gpa: number(input.gpa, 0, 100, true),
  };
}
export function mutationPatch(
  domain: DataDomain,
  original: DataRow,
  raw: unknown,
  recalc: unknown = [],
): DataRow {
  if (
    !raw || typeof raw !== "object" || Array.isArray(raw) ||
    !Array.isArray(recalc)
  ) return fail();
  const payload = raw as DataRow;
  const allowed = domain === "posts"
    ? [...(EDIT_FIELDS[domain] || []), "image_urls"]
    : EDIT_FIELDS[domain] || [];
  if (Object.keys(payload).some((k) => !allowed.includes(k))) return fail();
  if (
    recalc.some((f) =>
      typeof f !== "string" ||
      !Object.prototype.hasOwnProperty.call(RECALCULATE_FIELDS, f)
    ) || new Set(recalc).size !== recalc.length
  ) return fail();
  if (recalc.length && domain !== "history" && domain !== "admission") {
    return fail();
  }
  if (recalc.some((f) => Object.prototype.hasOwnProperty.call(payload, f))) {
    throw new Error("CALCULATION_CONFLICT");
  }
  const out: DataRow = {};
  for (const [key, v] of Object.entries(payload)) {
    if (key === "image_urls") {
      if (
        !Array.isArray(v) || v.length > 5 ||
        v.some((u) =>
          typeof u !== "string" ||
          !(original.image_urls as string[] || []).includes(u)
        )
      ) return fail();
      out[key] = v;
    } else if (key === "userAnswers") {
      if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
      const answers = v as DataRow;
      const total = number(original.total, 1, 100, true);
      if (
        Object.entries(answers).some(([n, a]) =>
          !/^\d+$/.test(n) || Number(n) < 1 || Number(n) > total ||
          typeof a !== "number" || !Number.isInteger(a) || a < 0 || a > 5
        )
      ) return fail();
      out[key] = answers;
    } else if (["standardScore", "adjustedScore"].includes(key)) {
      out[key] = number(v, 0, 300);
    } else if (key === "percentile") out[key] = number(v, 0, 100);
    else if (key === "correct") {
      out[key] = number(v, 0, number(original.total, 1, 100, true), true);
    } else if (key === "input") out[key] = admissionInput(v);
    else if (key === "verbal" || key === "reasoning") {
      if (v === null) {
        out[key] = null;
        continue;
      }
      if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
      const score = v as DataRow;
      if (
        Object.keys(score).some((k) =>
          !["standardScore", "percentile"].includes(k)
        )
      ) return fail();
      out[key] = {
        standardScore: number(score.standardScore, 0, 300),
        percentile: number(score.percentile, 0, 100),
      };
    } else if (key === "examDate") {
      if (
        typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
        !Number.isFinite(new Date(v).getTime()) ||
        new Date(v).toISOString().slice(0, 10) !== v
      ) return fail();
      out[key] = v;
    } else if (key === "tag") {
      if (
        !["자유", "모의고사", "입시", "질문", "스터디 모집", "사고팔고"]
          .includes(String(v))
      ) return fail();
      out[key] = v;
    } else {out[key] = text(
        v,
        key === "round" ? 0 : 1,
        key === "content"
          ? (domain === "chat" ? 500 : domain === "notes" ? 4000 : 20000)
          : key === "title"
          ? 200
          : 80,
      );}
  }
  if (domain === "history" && recalc.length) {
    const result = { ...original, ...out } as unknown as GradingResult;
    if (
      !["verbal", "reasoning"].includes(result.subject) ||
      !["odd", "even"].includes(result.examType) ||
      !Object.prototype.hasOwnProperty.call(SCORE_DATA, result.year) ||
      !getCorrectAnswers(result.year, result.subject, result.examType) ||
      Object.keys(
          getCorrectAnswers(result.year, result.subject, result.examType),
        ).length !== result.total
    ) throw new Error("CALCULATION_UNAVAILABLE");
    const computed = gradeAnswers(
      result.year,
      result.subject,
      result.userAnswers || {},
      result.total,
      result.examType,
    );
    const correct = (recalc as string[]).includes("correct")
      ? computed.correct
      : result.correct;
    const score = SCORE_DATA[result.year]?.[result.subject]?.[correct];
    for (const field of recalc as RecalculateField[]) {
      if (["standardScore", "percentile", "adjustedScore"].includes(field)) {
        if (!score) throw new Error("CALCULATION_UNAVAILABLE");
        out[field] = field === "adjustedScore"
          ? (Number(result.year) < 2020 || result.year === "09예비"
            ? Math.round(
              score.standardScore * (result.subject === "verbal" ? 0.9 : 1.2),
            )
            : null)
          : score[field as "standardScore" | "percentile"];
      } else out[field] = computed[field];
    }
  }
  if (domain === "admission") {
    // Changing inputs updates the analysis snapshot using precisely the public rules.
    const input = admissionInput(out.input || original.input);
    out.input = input;
    out.analyses = analyzeLawSchools(input.leet, input.gpa);
    out.rules_version = RULES_VERSION;
  }
  if (!Object.keys(out).length) return fail();
  return out;
}
