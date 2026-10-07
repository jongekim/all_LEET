export type Audience = "all" | "members" | "selected";
export interface PushMessage {
  title: string;
  body: string;
  path: string;
}
export interface PushComposition extends PushMessage {
  audience: Audience;
  members: string[];
}
export interface SubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface InstallationProof {
  installationId: string;
  capability: string;
}
export interface PushState {
  installationRevision: number;
  bindingRevision: number;
  subscriptionRevision: number;
  status: "none" | "pending" | "active" | "disabled" | "expired" | "failed";
  subscriptionId?: string;
  requestId?: string;
  linkedUserId?: string | null;
  linkedSessionId?: string | null;
}
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class PushError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PushError("INVALID_INPUT");
  }
  return value as Record<string, unknown>;
}
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new PushError("INVALID_INPUT");
  }
  return value.toLowerCase();
}
export function safePath(value: unknown): string {
  if (
    typeof value !== "string" || value.length > 1000 ||
    value !== value.trim() || /[\x00-\x20\x7f\\#%]/.test(value) ||
    !value.startsWith("/") || value.startsWith("//")
  ) throw new PushError("INVALID_PATH");
  const url = new URL(value, "https://push.invalid");
  if (url.origin !== "https://push.invalid") {
    throw new PushError("INVALID_PATH");
  }
  const plain = ["/", "/community", "/past-exams", "/terms", "/privacy-policy"];
  if (
    !plain.includes(url.pathname) &&
    !/^\/community\/[0-9a-f-]{36}$/.test(url.pathname)
  ) throw new PushError("INVALID_PATH");
  if (
    url.pathname.startsWith("/community/") && !UUID.test(url.pathname.slice(11))
  ) throw new PushError("INVALID_PATH");
  if (url.search && url.pathname !== "/past-exams") {
    throw new PushError("INVALID_PATH");
  }
  const seen = new Set<string>();
  for (const [key, val] of url.searchParams) {
    if (seen.has(key) || !["year", "subject", "type"].includes(key)) {
      throw new PushError("INVALID_PATH");
    }
    seen.add(key);
    if (key === "year" && !/^(2009|201[0-9]|202[0-7])$/.test(val)) {
      throw new PushError("INVALID_PATH");
    }
    if (key === "subject" && !["verbal", "reasoning"].includes(val)) {
      throw new PushError("INVALID_PATH");
    }
    if (key === "type" && !["odd", "even"].includes(val)) {
      throw new PushError("INVALID_PATH");
    }
  }
  const query = new URLSearchParams();
  for (const key of ["year", "subject", "type"]) {
    if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key)!);
  }
  return url.pathname + (query.size ? "?" + query.toString() : "");
}
export function message(value: unknown, draft = false): PushMessage {
  const obj = record(value);
  if (
    typeof obj.title !== "string" || typeof obj.body !== "string" ||
    typeof obj.path !== "string"
  ) throw new PushError("INVALID_INPUT");
  const title = obj.title.trim(), body = obj.body.trim();
  if (
    [...title].length > 50 || [...body].length > 200 ||
    (!draft && (!title || !body)) ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(title + body)
  ) throw new PushError("INVALID_MESSAGE");
  if (draft && obj.path.length > 1000) throw new PushError("INVALID_PATH");
  return {
    title,
    body,
    path: draft ? obj.path.trim() : safePath(obj.path.trim()),
  };
}
export function composition(value: unknown, draft = false): PushComposition {
  const obj = record(value), normalized = message(obj, draft);
  if (
    !["all", "members", "selected"].includes(String(obj.audience)) ||
    !Array.isArray(obj.members) || obj.members.length > 100
  ) throw new PushError("INVALID_INPUT");
  const members = [...new Set(obj.members.map(uuid))].sort();
  if (!draft && obj.audience === "selected" && !members.length) {
    throw new PushError("NO_RECIPIENTS");
  }
  return {
    ...normalized,
    audience: obj.audience as Audience,
    members: obj.audience === "selected" ? members : [],
  };
}
export function base64url(value: unknown, size: number): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new PushError("INVALID_INPUT");
  }
  let bytes: string;
  try {
    bytes = atob(
      value.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - value.length % 4) % 4),
    );
  } catch {
    throw new PushError("INVALID_INPUT");
  }
  if (bytes.length !== size) throw new PushError("INVALID_INPUT");
  if (
    btoa(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") !==
      value
  ) throw new PushError("INVALID_INPUT");
  return value;
}
export function subscription(
  value: unknown,
  hosts: string[],
): SubscriptionData {
  const obj = record(value), keys = record(obj.keys);
  if (typeof obj.endpoint !== "string" || obj.endpoint.length > 2048) {
    throw new PushError("INVALID_ENDPOINT");
  }
  const endpoint = new URL(obj.endpoint);
  if (
    endpoint.protocol !== "https:" || endpoint.port || endpoint.username ||
    endpoint.password || endpoint.hash || !hosts.includes(endpoint.hostname) ||
    !endpoint.pathname.startsWith("/") || endpoint.pathname === "/"
  ) throw new PushError("INVALID_ENDPOINT");
  const p256dh = base64url(keys.p256dh, 65);
  if (
    atob(p256dh.replace(/-/g, "+").replace(/_/g, "/") + "=")[0].charCodeAt(
      0,
    ) !== 4
  ) throw new PushError("INVALID_INPUT");
  return {
    endpoint: obj.endpoint,
    keys: { p256dh, auth: base64url(keys.auth, 16) },
  };
}
export function contentKey(value: PushMessage): string {
  return JSON.stringify([1, value.title, value.body, value.path]);
}
export function requestKey(value: PushComposition): string {
  return JSON.stringify([contentKey(value), value.audience, value.members]);
}
export const PUSH_MESSAGES: Record<string, string> = {
  INVALID_INPUT: "입력값을 확인해주세요.",
  INVALID_MESSAGE: "제목은 1~50자, 본문은 1~200자로 입력해주세요.",
  INVALID_PATH: "이 앱의 공개 페이지 주소를 선택해주세요.",
  INVALID_ENDPOINT: "지원하는 브라우저에서 알림을 등록해주세요.",
  AUTH_REQUIRED: "로그인 상태를 확인해주세요.",
  ADMIN_REQUIRED: "관리자 권한을 확인할 수 없습니다.",
  CONFLICT: "상태가 변경되었습니다. 최신 내용을 확인해주세요.",
  EXPIRED: "확인 시간이 만료되었습니다. 다시 확인해주세요.",
  NO_RECIPIENTS: "발송 가능한 구독 기기가 없습니다.",
  TEST_REQUIRED:
    "같은 내용으로 현재 기기 테스트·표시·이동 확인을 완료해주세요.",
  DUPLICATE_REQUIRED: "최근 동일 발송과 중복 가능성을 다시 확인해주세요.",
  RATE_LIMITED: "요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
  PUSH_DISABLED: "알림 기능이 아직 활성화되지 않았습니다.",
  STORAGE_UNAVAILABLE:
    "알림 서버 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
  REGISTRATION_REQUIRED: "현재 기기에서 알림 등록 확인을 완료해주세요.",
  REQUEST_UNCONFIRMED:
    "요청 결과를 확인하지 못했습니다. 기존 요청의 접수 여부를 확인해주세요.",
};
