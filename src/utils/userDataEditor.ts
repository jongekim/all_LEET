import {
  type DataDomain,
  type DataRow,
  EDIT_FIELDS,
} from "../../supabase/functions/_shared/user-data-contract";
export const DATA_WARNING =
  "이 과정은 데이터 수정을 수반합니다. 정말로 진행하시겠습니까?";
const jsonFields = new Set(["userAnswers", "verbal", "reasoning", "input"]);
const numericFields = new Set([
  "correct",
  "standardScore",
  "percentile",
  "adjustedScore",
]);
export function createEditorPatch(
  domain: DataDomain,
  record: DataRow,
  drafts: Record<string, string>,
) {
  const patch: DataRow = {};
  for (const field of EDIT_FIELDS[domain] || []) {
    const draft = drafts[field];
    const value = jsonFields.has(field)
      ? JSON.parse(draft)
      : numericFields.has(field)
      ? Number(draft)
      : draft;
    if (
      JSON.stringify(value) !==
        JSON.stringify(
          record[field] ??
            (jsonFields.has(field) ? null : numericFields.has(field) ? 0 : ""),
        )
    ) patch[field] = value;
  }
  return patch;
}
