import { beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("../contexts/AuthContext", () => ({ supabase: { auth } }));
import { adminUserDataApi } from "./adminUserDataApi";
import { persistAdmissionExecution } from "./admissionPersistence";
import { createEditorPatch } from "./userDataEditor";
const session = (id: string) => ({
  data: { session: { user: { id }, access_token: "synthetic-token" } },
  error: null,
});
beforeEach(() => {
  vi.restoreAllMocks();
  auth.getSession.mockReset();
});
it("selected data stays in the POST body and account switches discard personal responses", async () => {
  auth.getSession.mockResolvedValueOnce(session("admin")).mockResolvedValueOnce(
    session("other"),
  );
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ items: [{ name: "private" }], total: 1 }),
  );
  await expect(adminUserDataApi.read("admin", "member", "account")).rejects
    .toMatchObject({ code: "ACCOUNT_CHANGED" });
  const [url, options] = request.mock.calls[0];
  expect(String(url)).not.toContain("member");
  expect(options?.cache).toBe("no-store");
  expect(JSON.parse(String(options?.body)).target).toBe("member");
});
it("denied HTML responses are recognized and aborted scopes never return data", async () => {
  auth.getSession.mockResolvedValue(session("admin"));
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("Denied", { status: 403 }),
  );
  await expect(adminUserDataApi.read("admin", "member", "account")).rejects
    .toMatchObject({ status: 403 });
  const controller = new AbortController();
  controller.abort();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ items: [], total: 0 }),
  );
  await expect(
    adminUserDataApi.read(
      "admin",
      "member",
      "account",
      0,
      undefined,
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: "CANCELLED" });
});
it("admission retry uses one execution ID and reports only safe diagnostics", async () => {
  auth.getSession.mockResolvedValue(session("member"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 503 }),
  );
  await persistAdmissionExecution("member", "execution", {
    leet: 130,
    gpa: 97,
  });
  expect(request).toHaveBeenCalledTimes(3);
  const bodies = request.mock.calls.map(([, options]) =>
    JSON.parse(String(options?.body))
  );
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[2]).toEqual({ execution_id: "execution", code: "SAVE_FAILED" });
});
it("admission persistence never writes analysis inputs into a different account", async () => {
  auth.getSession.mockResolvedValue(session("other"));
  const request = vi.spyOn(globalThis, "fetch");
  await persistAdmissionExecution("member", "execution", {
    leet: 130,
    gpa: 97,
  });
  expect(request).not.toHaveBeenCalled();
});
it("editor submits changed allowed fields only; empty mock scores remain null", () => {
  expect(
    createEditorPatch("account", { name: "same", email: "read-only" }, {
      name: "same",
    }),
  ).toEqual({});
  expect(
    createEditorPatch("history", {
      standardScore: 50,
      percentile: 60,
      correct: 20,
      adjustedScore: 0,
      userAnswers: { 1: 2 },
    }, {
      standardScore: "51",
      percentile: "60",
      correct: "20",
      adjustedScore: "0",
      userAnswers: '{"1":2}',
    }),
  ).toEqual({ standardScore: 51 });
});
