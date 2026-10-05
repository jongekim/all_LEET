import { type ImageUpload, UUID_PATTERN } from "./user-data-contract.ts";
export function imagePlans(
  raw: unknown,
  target: string,
  post: string,
  base: string,
): ImageUpload[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 5) throw new Error("INVALID_INPUT");
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ids = new Set<string>();
  return raw.map((value) => {
    if (!value || typeof value !== "object") throw new Error("INVALID_INPUT");
    const v = value as ImageUpload;
    if (
      !UUID_PATTERN.test(v.id) || ids.has(v.id) || typeof v.name !== "string" ||
      v.name.length > 200 || !extensions[v.mime] || !Number.isInteger(v.size) ||
      v.size <= 0 || v.size > 5 * 1024 * 1024 ||
      !/^[a-f0-9]{64}$/.test(v.sha256)
    ) throw new Error("INVALID_INPUT");
    ids.add(v.id);
    const path = `${target}/${post}/${crypto.randomUUID()}.${
      extensions[v.mime]
    }`;
    return {
      id: v.id,
      name: v.name,
      mime: v.mime,
      size: v.size,
      sha256: v.sha256,
      path,
      url: `${base}/storage/v1/object/public/community-post-images/${path}`,
    };
  });
}
export async function imageHash(blob: Blob) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verifyImageFile(file: File, plan: ImageUpload) {
  if (
    file.size !== plan.size || file.type !== plan.mime ||
    await imageHash(file) !== plan.sha256
  ) throw new Error("IMAGE_MISMATCH");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  const valid = plan.mime === "image/jpeg"
    ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : plan.mime === "image/png"
    ? bytes[0] === 137 && ascii(1, 4) === "PNG"
    : plan.mime === "image/gif"
    ? ["GIF87a", "GIF89a"].includes(ascii(0, 6))
    : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!valid) throw new Error("IMAGE_MISMATCH");
}
