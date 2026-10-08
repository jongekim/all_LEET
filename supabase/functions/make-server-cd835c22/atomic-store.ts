import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
export function atomicHistoryStore() {
  const client = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(12_000) }),
      },
    },
  );
  return {
    async get(key: string) {
      const { data, error } = await client.from("kv_store_cd835c22").select(
        "value",
      ).eq("key", key).maybeSingle();
      if (error) throw new Error("STORAGE_UNAVAILABLE");
      return data?.value;
    },
    async mutate(
      owner: string,
      kind: "history" | "mock_history",
      action: "append" | "clear" | "delete",
      input: unknown = {},
    ) {
      const { data, error } = await client.rpc("user_history_mutate", {
        p_owner: owner,
        p_kind: kind,
        p_action: action,
        p_input: input,
      });
      if (error) throw new Error("STORAGE_UNAVAILABLE");
      return data;
    },
    async updateAnswers(owner: string, timestamp: number, expected: unknown, patch: unknown) {
      const { data, error } = await client.rpc("user_history_update_answers", {
        p_owner: owner, p_timestamp: timestamp, p_expected: expected, p_patch: patch,
      });
      if (error) {
        const allowed = ["HISTORY_CONFLICT", "RECORD_NOT_FOUND", "AMBIGUOUS_RECORD", "INVALID_INPUT"];
        throw new Error(allowed.includes(error.message) ? error.message : "STORAGE_UNAVAILABLE");
      }
      return data;
    },
  };
}
