import { createUserVerifier } from "./auth.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

Deno.test("Auth SDK validates the explicit request token with the anon client", async () => {
  const requests: {
    url: string;
    authorization: string | null;
    apikey: string | null;
  }[] = [];
  const verify = createUserVerifier({
    url: "https://isolated.invalid",
    anonKey: "isolated-anon",
  }, async (input, init) => {
    const headers = new Headers(init?.headers);
    requests.push({
      url: String(input),
      authorization: headers.get("Authorization"),
      apikey: headers.get("apikey"),
    });
    equal(init?.signal instanceof AbortSignal, true);
    return Response.json({
      id: headers.get("Authorization") === "Bearer token-a"
        ? "owner-a"
        : "owner-b",
      aud: "authenticated",
    });
  });
  equal(await verify("token-a"), { userId: "owner-a" });
  equal(await verify("token-b"), { userId: "owner-b" });
  equal(requests.map((r) => [r.url, r.authorization, r.apikey]), [
    [
      "https://isolated.invalid/auth/v1/user",
      "Bearer token-a",
      "isolated-anon",
    ],
    [
      "https://isolated.invalid/auth/v1/user",
      "Bearer token-b",
      "isolated-anon",
    ],
  ]);
});

for (const status of [400, 401, 403, 429, 500, 503]) {
  Deno.test(`Auth SDK status ${status} is distinguished from a valid user`, async () => {
    const verify = createUserVerifier({
      url: "https://isolated.invalid",
      anonKey: "isolated-anon",
    }, async () => Response.json({ message: "isolated error" }, { status }));
    equal(await verify("token-a"), {
      userId: null,
      unavailable: ![400, 401, 403].includes(status),
    });
  });
}

Deno.test("missing Auth configuration never falls back to service role or anonymous access", async () => {
  let calls = 0;
  const verify = createUserVerifier({}, async () => {
    calls++;
    throw new Error("must not call");
  });
  equal(await verify("token-a"), { userId: null, unavailable: true });
  equal(calls, 0);
});
