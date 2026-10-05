import { supabase } from "../contexts/AuthContext";
import { projectId, publicAnonKey } from "./supabase/info";
import type {
  DataDomain,
  DataMembers,
  DataOperation,
  DataPage,
  DataRow,
  ImageUpload,
} from "../../supabase/functions/_shared/user-data-contract";
export class UserDataError extends Error {
  constructor(public code: string, public status: number | null = null) {
    super(
      ({
        AUTH_REQUIRED: "로그인 상태를 다시 확인해주세요.",
        ADMIN_REQUIRED: "사용자 데이터를 볼 관리자 권한이 없습니다.",
        ACCOUNT_CHANGED: "관리자 계정이 변경되어 작업을 중단했습니다.",
        CONFLICT:
          "확인 후 데이터가 변경되었습니다. 새로 조회한 뒤 다시 승인해주세요.",
        EXPIRED: "승인 유효 시간이 지났습니다. 변경 내용을 다시 준비해주세요.",
        APPROVAL_REQUIRED: "승인을 정확히 입력해주세요.",
        NICKNAME_TAKEN: "이미 사용 중인 채팅 닉네임입니다.",
        INVALID_INPUT: "입력값을 확인해주세요.",
        FILE_IN_USE:
          "게시글에서 사용 중인 이미지입니다. 연결된 게시글의 첨부를 먼저 확인해주세요.",
        IMAGE_MISMATCH:
          "승인한 이미지와 업로드 파일이 일치하지 않습니다. 다시 선택해주세요.",
        CALCULATION_CONFLICT: "직접 입력한 항목과 재계산 항목이 겹칩니다.",
        CALCULATION_UNAVAILABLE: "현재 계산 자료가 없어 재계산할 수 없습니다.",
        NOT_FOUND: "선택한 기록을 찾을 수 없습니다.",
        INVALID_STATE:
          "처리 결과가 확인되지 않은 작업이 있습니다. 감사 이력에서 해당 작업의 결과를 먼저 확인해주세요.",
      } as Record<string, string>)[code] ||
        "사용자 데이터를 처리하지 못했습니다. 연결과 서버 설정을 확인해주세요.",
    );
  }
}
export async function userDataRequest<T>(
  owner: string,
  path: string,
  body: DataRow,
  signal?: AbortSignal,
  files?: { id: string; file: File }[],
): Promise<T> {
  const session = await supabase.auth.getSession();
  if (session.error || !session.data.session) {
    throw new UserDataError("AUTH_REQUIRED", 401);
  }
  if (session.data.session.user.id !== owner) {
    throw new UserDataError("ACCOUNT_CHANGED", 401);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(abort, files?.length ? 90_000 : 25_000);
  const form = files?.length ? new FormData() : null;
  if (form) {
    form.set("operation_id", String(body.operation_id));
    form.set("approval", String(body.approval));
    for (const item of files || []) form.set(item.id, item.file);
  }
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admin-user-data/${path}`,
      {
        method: "POST",
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${session.data.session.access_token}`,
          ...(form ? {} : { "Content-Type": "application/json" }),
        },
        body: form || JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (response.status === 401 || response.status === 403) {
      throw new UserDataError(
        response.status === 401 ? "AUTH_REQUIRED" : "ADMIN_REQUIRED",
        response.status,
      );
    }
    const result = await response.json().catch(() => null);
    const latest = await supabase.auth.getSession();
    if (
      latest.error || !latest.data.session ||
      latest.data.session.user.id !== owner
    ) throw new UserDataError("ACCOUNT_CHANGED", 401);
    if (signal?.aborted) throw new UserDataError("CANCELLED");
    if (!response.ok) {
      throw new UserDataError(
        typeof result?.code === "string" ? result.code : "STORAGE_UNAVAILABLE",
        response.status,
      );
    }
    if (!result || typeof result !== "object") {
      throw new UserDataError("INVALID_RESPONSE");
    }
    return result as T;
  } catch (error) {
    if (error instanceof UserDataError) throw error;
    console.error("관리자 사용자 데이터 요청 실패");
    throw new UserDataError("NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export const adminUserDataApi = {
  members: (
    owner: string,
    query = "",
    cursor: string | null = null,
    signal?: AbortSignal,
  ) =>
    userDataRequest<DataMembers>(owner, "members", { query, cursor }, signal),
  context: (
    owner: string,
    target: string,
    domain: DataDomain,
    reference: string,
    context_offset: number,
    signal?: AbortSignal,
  ) =>
    userDataRequest<DataPage>(owner, "read", {
      target,
      domain,
      references: [reference],
      context_offset,
    }, signal),
  read: (
    owner: string,
    target: string,
    domain: DataDomain | "history_summary" | "mock_summary",
    offset = 0,
    references?: string[],
    signal?: AbortSignal,
  ) =>
    userDataRequest<DataPage>(owner, "read", {
      target,
      domain,
      offset,
      ...(references ? { references } : {}),
    }, signal),
  notes: (owner: string, target: string, group: number, signal?: AbortSignal) =>
    userDataRequest<DataPage>(owner, "notes", { target, group }, signal),
  prepare: (
    owner: string,
    target: string,
    domain: DataDomain,
    action: "update" | "delete",
    references: string[],
    payload: DataRow = {},
    recalculate: string[] = [],
    signal?: AbortSignal,
    uploads?: ImageUpload[],
  ) =>
    userDataRequest<DataOperation>(owner, "prepare", {
      target,
      domain,
      action,
      references,
      payload,
      recalculate,
      ...(uploads ? { uploads } : {}),
    }, signal),
  commit: (
    owner: string,
    operation_id: string,
    approval: string,
    signal?: AbortSignal,
    files?: { id: string; file: File }[],
  ) =>
    userDataRequest<DataOperation>(
      owner,
      "commit",
      { operation_id, approval },
      signal,
      files,
    ),
  operation: (owner: string, operation_id: string, signal?: AbortSignal) =>
    userDataRequest<DataOperation>(
      owner,
      "operation",
      { operation_id },
      signal,
    ),
};
