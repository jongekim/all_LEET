import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import {
  DATA_DOMAINS,
  type DataDomain,
  type DataOperation,
  type DataRow,
  EDIT_FIELDS,
  FIELD_LABELS,
  RECALCULATE_FIELDS,
} from "../../../supabase/functions/_shared/user-data-contract";
import { UserDataImageEditor } from "./UserDataImageEditor";
import { COMMUNITY_TAGS } from "../../types/community";
import { createEditorPatch, DATA_WARNING } from "../../utils/userDataEditor";
const jsonFields = new Set(["userAnswers", "verbal", "reasoning", "input"]);
const numericFields = new Set([
  "correct",
  "standardScore",
  "percentile",
  "adjustedScore",
]);
export function UserDataEditor({
  domain,
  record,
  busy,
  onCancel,
  onPrepare,
  requestError,
}: {
  domain: DataDomain;
  record: DataRow;
  busy: boolean;
  onCancel: () => void;
  requestError?: string;
  onPrepare: (
    patch: DataRow,
    recalculate: string[],
    files?: File[],
  ) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (EDIT_FIELDS[domain] || []).map((field) => [
        field,
        jsonFields.has(field)
          ? JSON.stringify(record[field] ?? null, null, 2)
          : String(record[field] ?? (numericFields.has(field) ? 0 : "")),
      ]),
    )
  );
  const [keptImages, setKeptImages] = useState<string[]>(() =>
    Array.isArray(record.image_urls) ? record.image_urls as string[] : []
  );
  const [files, setFiles] = useState<File[]>([]);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [recalculate, setRecalculate] = useState<string[]>([]);
  const [error, setError] = useState("");
  const submit = async () => {
    try {
      setError("");
      const patch = createEditorPatch(domain, record, drafts);
      if (
        domain === "posts" &&
        (files.length ||
          JSON.stringify(keptImages) !==
            JSON.stringify(record.image_urls || []))
      ) patch.image_urls = keptImages;
      await onPrepare(patch, recalculate, files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "입력값을 확인해주세요.");
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent
        closeLabel="닫기"
        className="admin-user-data-dialog z-[60] bg-white max-h-[85dvh] overflow-y-auto sm:max-w-2xl"
        overlayClassName="admin-user-data-overlay"
      >
        <DialogTitle>{DATA_DOMAINS[domain]} 수정</DialogTitle>
        <DialogDescription>
          입력 후 변경 내용과 영향을 확인하고 승인합니다.
        </DialogDescription>
        <fieldset disabled={busy} className="space-y-4">
          {(EDIT_FIELDS[domain] || []).map((field) => (
            <label key={field} className="block text-sm font-semibold">
              {FIELD_LABELS[field] || field}
              {field === "tag"
                ? (
                  <select
                    aria-label={FIELD_LABELS[field]}
                    value={drafts[field]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                    className="mt-2 border rounded px-3 py-2 w-full"
                  >
                    {COMMUNITY_TAGS.map((tag) => (
                      <option key={tag}>{tag}</option>
                    ))}
                  </select>
                )
                : jsonFields.has(field) || field === "content"
                ? (
                  <textarea
                    aria-label={FIELD_LABELS[field] || field}
                    value={drafts[field]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                    rows={field === "userAnswers" ? 8 : 4}
                    className="mt-2 border rounded p-3 w-full font-normal"
                  />
                )
                : (
                  <input
                    aria-label={FIELD_LABELS[field] || field}
                    type={numericFields.has(field)
                      ? "number"
                      : field === "examDate"
                      ? "date"
                      : "text"}
                    step="any"
                    value={drafts[field]}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [field]: e.target.value }))}
                    className="mt-2 border rounded px-3 py-2 w-full font-normal"
                  />
                )}
              {field === "userAnswers" && (
                <span className="block text-xs font-normal text-gray-500">
                  JSON 형식: 문항 번호와 답(0은 미응답, 1~5는 선택 답안).
                </span>
              )}
            </label>
          ))}
          {domain === "posts" && (
            <UserDataImageEditor
              kept={keptImages}
              files={files}
              disabled={busy}
              onProcessing={setImageProcessing}
              onChange={(kept, chosen) => {
                setKeptImages(kept);
                setFiles(chosen);
              }}
            />
          )}
          {domain === "history" && (
            <div className="border rounded p-3 space-y-2">
              <p className="font-semibold text-sm">재계산할 항목을 직접 선택</p>
              <p className="text-xs text-gray-600">
                현재 서비스의 정답·점수표를 사용합니다. 직접 수정한 항목과 중복
                선택할 수 없습니다.
              </p>
              {Object.entries(RECALCULATE_FIELDS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={recalculate.includes(key)}
                    onChange={(e) =>
                      setRecalculate((fields) =>
                        e.target.checked
                          ? [...fields, key]
                          : fields.filter((f) =>
                            f !== key
                          )
                      )}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          {domain === "admission" && (
            <p className="text-sm text-gray-600">
              입력을 변경하면 현재 서비스 기준으로 분석 결과를 다시 계산합니다.
            </p>
          )}
        </fieldset>
        {(error || requestError) && (
          <p role="alert" className="text-red-700 text-sm">
            {error || requestError}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            취소
          </Button>
          <Button
            disabled={busy || imageProcessing}
            onClick={() => void submit()}
          >
            {busy ? "준비 중…" : "변경 내용 확인"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
export function UserDataApproval({
  operation,
  targetLabel,
  busy,
  error,
  onClose,
  onCommit,
  onCheck,
  files = [],
}: {
  operation: DataOperation;
  targetLabel: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCommit: (approval: string) => void;
  onCheck: () => void;
  files?: File[];
}) {
  const [approval, setApproval] = useState("");
  const [composing, setComposing] = useState(false);
  const ready = operation.state === "prepared";
  const missingFiles = !!operation.uploads?.length && !files.length;
  const approvable = (ready && !missingFiles) ||
    operation.state === "partial" ||
    (!!operation.uploads?.length && files.length > 0 &&
      ["unknown", "executing"].includes(operation.state));
  const [previews] = useState(() =>
    files.map((file) => URL.createObjectURL(file))
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [
    previews,
  ]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        closeLabel="닫기"
        className="admin-user-data-dialog admin-user-data-approval z-[70] bg-white max-h-[85dvh] overflow-y-auto sm:max-w-xl"
        overlayClassName="admin-user-data-overlay admin-user-data-approval-overlay"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogTitle>
          {ready ? "데이터 변경 승인" : "변경 처리 결과"}
        </DialogTitle>
        <DialogDescription>{DATA_WARNING}</DialogDescription>
        <p className="text-sm break-all">
          대상: <strong>{targetLabel}</strong>
        </p>
        <div className="rounded border p-3 text-sm">
          <p className="font-semibold">영향 항목·건수</p>
          <ul>
            {Object.entries(operation.impact || {}).map(([key, count]) => (
              <li key={key}>
                {DATA_DOMAINS[key as DataDomain] ||
                  ({
                    images_added: "추가 이미지",
                    images_removed: "제거 이미지",
                    images: "첨부 이미지",
                    publications: "일별 집계 발행",
                  } as Record<string, string>)[key] || key}: {count}건
              </li>
            ))}
          </ul>
          <p className="mt-2 text-red-700">
            변경과 삭제는 확정되며 복구 기능은 없습니다.
          </p>
        </div>
        {!!operation.selection?.length && (
          <details open>
            <summary className="text-sm font-semibold">
              선택한 원본 기록 · 최대 20개 표시
            </summary>
            <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(operation.selection,null,2)}</pre>
          </details>
        )}
        {operation.uploads?.length && (
          <div className="grid grid-cols-2 gap-2">
            {operation.uploads.map((file, index) => (
              <div key={file.id}>
                {previews[index] && (
                  <img
                    src={previews[index]}
                    alt={`추가 이미지 ${index + 1}`}
                    className="h-28 w-full object-contain"
                  />
                )}
                <p className="text-xs break-all">
                  {file.name} / {Math.ceil(file.size / 1024)}KB
                </p>
              </div>
            ))}
          </div>
        )}
        {operation.payload && Object.keys(operation.payload).length > 0 && (
          <details open>
            <summary className="text-sm font-semibold">
              적용할 변경 내용
            </summary>
            <pre className="mt-2 p-3 rounded bg-gray-50 text-xs whitespace-pre-wrap break-all max-h-52 overflow-auto">{JSON.stringify(operation.payload,null,2)}</pre>
          </details>
        )}
        {operation.state === "partial" && (
          <p role="status" className="text-sm text-amber-800">
            DB 변경은 완료했습니다. 같은 승인 작업에 포함된 미처리 첨부 파일만
            다시 정리합니다.
          </p>
        )}
        {operation.rules_version && (
          <p className="text-xs text-gray-600">
            계산 기준: 현재 서비스 · {operation.rules_version}
          </p>
        )}
        {ready && missingFiles && (
          <p role="status">
            승인할 새 이미지 파일이 현재 탭에 없습니다. 원본을 다시 조회하고
            이미지를 선택해주세요.
          </p>
        )}
        {approvable
          ? (
            <label className="block text-sm font-semibold">
              승인 직접 입력<input
                aria-label="승인 직접 입력"
                autoComplete="off"
                value={approval}
                disabled={busy}
                onChange={(e) => setApproval(e.target.value)}
                onPaste={(e) => e.preventDefault()}
                onDrop={(e) => e.preventDefault()}
                onCompositionStart={() => setComposing(true)}
                onCompositionEnd={() => setComposing(false)}
                className="block w-full mt-2 rounded border px-3 py-2"
                placeholder="승인"
              />
            </label>
          )
          : (
            <p role="status" className="text-sm">
              {({
                succeeded: "변경을 완료했습니다.",
                conflict:
                  "데이터가 바뀌어 적용하지 않았습니다. 다시 조회하고 승인해주세요.",
                partial:
                  "DB 변경은 완료했지만 첨부 파일 정리를 모두 확인하지 못했습니다.",
                unknown:
                  "변경 결과를 아직 확인하지 못했습니다. 동일 작업의 상태를 확인해주세요.",
                executing: "변경 결과를 확인하고 있습니다.",
                failed:
                  "적용하지 못했습니다. 기록을 확인한 뒤 다시 준비해주세요.",
              } as Record<string, string>)[operation.state]}
            </p>
          )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            닫기
          </Button>
          {approvable
            ? (
              <Button
                disabled={busy || composing || approval !== "승인"}
                onClick={() => {
                  onCommit(approval);
                  setApproval("");
                }}
              >
                {busy
                  ? "처리 중…"
                  : operation.state === "partial"
                  ? "승인 후 첨부 파일 정리 재시도"
                  : operation.uploads?.length && !ready
                  ? "승인 후 이미지 업로드 재시도"
                  : "승인 후 적용"}
              </Button>
            )
            : null}
          {["unknown", "executing", "partial"].includes(operation.state) && (
            <Button disabled={busy} onClick={onCheck}>결과 확인</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
