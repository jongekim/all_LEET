import { projectId, publicAnonKey } from "./supabase/info";
import { supabase } from "../contexts/AuthContext";
import { PUSH_MESSAGES } from "../../supabase/functions/_shared/push/contracts";
export {
  composition,
  contentKey,
  message,
  safePath,
} from "../../supabase/functions/_shared/push/contracts";
export type {
  InstallationProof,
  PushComposition,
  PushMessage,
  PushState,
} from "../../supabase/functions/_shared/push/contracts";
export class PushApiError extends Error {
  constructor(
    public code: string,
    public status = 0,
    public details?: Record<string, unknown>,
  ) {
    super(PUSH_MESSAGES[code] || "알림 요청을 처리하지 못했습니다.");
  }
}
export function pushEnabled(): boolean {
  if (
    typeof window === "undefined" ||
    import.meta.env.VITE_PUSH_ENABLED !== "true"
  ) return false;
  return (import.meta.env.VITE_PUSH_ALLOWED_ORIGINS || "").split(",").includes(
    window.location.origin,
  );
}
const base = `https://${projectId}.supabase.co/functions/v1/`;
export async function pushRequest<T>(
  kind: "push-subscriptions" | "admin-push",
  action: string,
  input?: unknown,
  signal?: AbortSignal,
  expectedUserId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    apikey: publicAnonKey,
    "Content-Type": "application/json",
  };
  let actor: string | undefined, actorSession: string | null = null;
  if (kind === "admin-push" || action === "bind") {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || (expectedUserId && session.user.id !== expectedUserId)) {
      throw new PushApiError("AUTH_REQUIRED", 401);
    }
    actor = session.user.id;
    actorSession = sessionIdentity(session.access_token);
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 12000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(base + kind + "/" + action, {
      method: input === undefined ? "GET" : "POST",
      headers,
      body: input === undefined ? undefined : JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new PushApiError(
        response.status === 401
          ? "AUTH_REQUIRED"
          : response.status === 403
          ? "ADMIN_REQUIRED"
          : "REQUEST_UNCONFIRMED",
        response.status >= 500 ? 0 : response.status,
      );
    }
    if (actor) {
      const { data: { session } } = await supabase.auth.getSession();
      if (
        session?.user.id !== actor ||
        sessionIdentity(session?.access_token) !== actorSession
      ) {
        throw new PushApiError("AUTH_REQUIRED", 401);
      }
    }
    if (!response.ok) {
      const detail = data && typeof data === "object"
        ? data as Record<string, unknown>
        : {};
      throw new PushApiError(
        String(detail.code || "STORAGE_UNAVAILABLE"),
        response.status,
        detail,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof PushApiError) throw error;
    throw new PushApiError("REQUEST_UNCONFIRMED");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function pushErrorMessage(
  error: unknown,
  fallback = "알림 요청을 처리하지 못했습니다.",
): string {
  if (error instanceof Error) {
    if (PUSH_MESSAGES[error.message]) return PUSH_MESSAGES[error.message];
    if (/[가-힣]/.test(error.message)) return error.message;
  }
  return fallback;
}

function sessionIdentity(token?: string): string | null {
  try {
    const claim = JSON.parse(
      atob((token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return typeof claim.session_id === "string" ? claim.session_id : null;
  } catch {
    return null;
  }
}
