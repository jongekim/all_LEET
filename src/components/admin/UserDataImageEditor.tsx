import { useEffect, useMemo, useState } from "react";
import { compressImageFile } from "../../utils/imageCompression";
export function UserDataImageEditor({
  kept,
  files,
  onChange,
  disabled,
  onProcessing,
}: {
  kept: string[];
  files: File[];
  onChange: (kept: string[], files: File[]) => void;
  disabled: boolean;
  onProcessing: (busy: boolean) => void;
}) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [
    previews,
  ]);
  async function choose(chosen: File[]) {
    setProcessing(true);
    onProcessing(true);
    setError("");
    try {
      if (
        chosen.some((file) =>
          !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
            file.type,
          ) || file.size > 20 * 1024 * 1024
        )
      ) {
        throw new Error(
          "JPEG·PNG·WebP·GIF 파일만 선택할 수 있습니다. 입력 파일은 최대 20MB입니다.",
        );
      }
      const compressed = await Promise.all(
        chosen.map((file) =>
          compressImageFile(file, {
            maxBytes: 5 * 1024 * 1024,
            maxDimension: 2400,
            minDimension: 720,
          })
        ),
      );
      if (kept.length + files.length + compressed.length > 5) {
        throw new Error("첨부 이미지는 최대 5장입니다.");
      }
      onChange(kept, [...files, ...compressed]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "이미지를 준비하지 못했습니다.",
      );
    } finally {
      setProcessing(false);
      onProcessing(false);
    }
  }
  return (
    <fieldset disabled={disabled || processing} className="border rounded p-3">
      <legend className="text-sm font-semibold">첨부 이미지 · 최대 5장</legend>
      <div className="grid grid-cols-2 gap-3">
        {kept.map((url) => (
          <div key={url}>
            <img
              src={url}
              alt="기존 첨부 이미지"
              className="h-24 w-full object-contain"
            />
            <button
              type="button"
              className="text-red-700 text-xs mt-1"
              onClick={() =>
                onChange(kept.filter((value) => value !== url), files)}
            >
              첨부에서 제외
            </button>
          </div>
        ))}
        {files.map((file, index) => (
          <div key={`${file.name}:${index}`}>
            <img
              src={previews[index]}
              alt={`추가 이미지 ${index + 1}`}
              className="h-24 w-full object-contain"
            />
            <p className="text-xs break-all">
              {file.name} · {Math.ceil(file.size / 1024)}KB
            </p>
            <button
              type="button"
              className="text-red-700 text-xs"
              onClick={() =>
                onChange(
                  kept,
                  files.filter((_, i) => i !== index),
                )}
            >
              선택 취소
            </button>
          </div>
        ))}
      </div>
      <label className="block mt-3 text-sm">
        새 이미지 선택<input
          aria-label="새 이미지 선택"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => {
            const chosen = Array.from(e.target.files || []);
            e.target.value = "";
            void choose(chosen);
          }}
        />
      </label>
      <p className="mt-2 text-xs text-gray-600">
        파일은 미리보기만 합니다. 승인 후 업로드하며 파일당 최대 5MB로
        압축합니다.
      </p>
      {processing && <p role="status" className="text-xs">이미지 준비 중…</p>}
      {error && <p role="alert" className="text-red-700 text-xs">{error}</p>}
    </fieldset>
  );
}
