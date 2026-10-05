import { supabase } from "../contexts/AuthContext";
import { projectId, publicAnonKey } from "./supabase/info";
import { USER_DATA_RULES_VERSION as RULES_VERSION } from "../../supabase/functions/_shared/user-data-contract";
// Deliberately independent from analytics consent/kill switch/admin exclusion.
// The result page does not wait for this write and gains no alerts or controls.
export async function persistAdmissionExecution(
  owner: string,
  execution_id: string,
  input: { leet: number; gpa: number },
) {
  async function send(body: Record<string, unknown>) {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session || data.session.user.id !== owner) {
      throw new Error("ACCOUNT_CHANGED");
    }
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admission-history/save`,
      {
        method: "POST",
        headers: {
          apikey: publicAnonKey,
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        keepalive: true,
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403
          ? "ACCOUNT_CHANGED"
          : "SAVE_FAILED",
      );
    }
  }
  const body = { execution_id, input, rules_version: RULES_VERSION };
  try {
    await send(body);
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_CHANGED") return;
    // Same execution ID: a retry cannot create another analysis or overwrite admin changes.
    try {
      await send(body);
    } catch {
      console.error("지원 분석 서버 저장을 확인하지 못했습니다.");
      try {
        await send({ execution_id, code: "SAVE_FAILED" });
      } catch { /* Offline/closed tabs cannot guarantee server diagnostics. */ }
    }
  }
}
