import { afterEach, describe, expect, it, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock(
  "../contexts/AuthContext",
  () => ({ supabase: { auth: { getSession: session } } }),
);
import { pushRequest } from "./pushApi";
afterEach(() => {
  vi.unstubAllGlobals();
  session.mockReset();
});
describe("administrator UI account scope", () => {
  it("A 화면 입력은 SDK가 B 계정으로 바뀌면 B 명의로 제출하지 않는다", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    session.mockResolvedValue({
      data: { session: { user: { id: "B" }, access_token: "token" } },
    });
    await expect(pushRequest("admin-push", "draft-save", {}, undefined, "A"))
      .rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("응답 중 같은 계정의 세션이 바뀌어도 이전 결과를 반환하지 않는다", async () => {
    const token = (id: string) =>
      "mock." + btoa(JSON.stringify({ session_id: id })) + ".sig";
    session.mockResolvedValueOnce({
      data: { session: { user: { id: "A" }, access_token: token("old") } },
    }).mockResolvedValue({
      data: { session: { user: { id: "A" }, access_token: token("new") } },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    await expect(pushRequest("admin-push", "draft-list", {}, undefined, "A"))
      .rejects.toMatchObject({ status: 401 });
  });
});
