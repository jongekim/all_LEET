import assert from "node:assert/strict";
import { createPushHandler } from "./app.ts";
import { PushVault, randomSecret } from "./crypto.ts";

Deno.test("환경 변수 쓰기가 금지된 Edge에서도 초기화·설정 조회·암호화가 동작한다", async () => {
  const key = randomSecret();
  const values: Record<string, string> = {
    ECE_KEYLOG: "0",
    SUPABASE_URL: "https://project.invalid",
    SUPABASE_ANON_KEY: "synthetic-default-key",
    PUSH_PUBLIC_API_KEY: "synthetic-public-key",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-server-key",
    PUSH_ENABLED: "true",
    PUSH_ALLOWED_ORIGINS: "https://app.invalid",
    PUSH_VAPID_PUBLIC_KEYS: JSON.stringify({ v1: "synthetic-vapid-key" }),
    PUSH_DATA_KEYS: JSON.stringify({ v1: key }),
    PUSH_INTERNAL_DISPATCH_SECRET: randomSecret(),
  };
  const originalGet = Deno.env.get, originalSet = Deno.env.set;
  Deno.env.get = (name) => values[name];
  Deno.env.set = () => { throw new Error("Environment is read-only"); };
  try {
    const { pushDependencies } = await import("./runtime.ts");
    const dependencies = pushDependencies();
    const response = await createPushHandler("subscriptions", dependencies)(
      new Request("https://project.invalid/push-subscriptions/config", {
        headers: { apikey: values.PUSH_PUBLIC_API_KEY, origin: values.PUSH_ALLOWED_ORIGINS },
      }),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).enabled, true);
    const data = { endpoint: "synthetic" };
    const encrypted = await dependencies.encrypt(data, "fcm.googleapis.com");
    assert.deepEqual(await new PushVault({ v1: key }, "v1").decrypt(encrypted), data);
  } finally {
    Deno.env.get = originalGet;
    Deno.env.set = originalSet;
  }
});
