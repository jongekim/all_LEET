import { message, subscription, type SubscriptionData } from "./contracts.ts";
import type { Envelope } from "./crypto.ts";
export interface PushJob {
  id: string;
  attemptId: string;
  leaseToken: string;
  keyId: string;
  provider: string;
  expiresAt: string;
  encryptedData: Envelope;
  registration: boolean;
  installationId?: string;
  requestId?: string;
  fingerprint?: string;
  revision?: number;
  content?: unknown;
  externalCount?: number;
}
export interface WorkerDependencies {
  enabled: boolean;
  hosts: string[];
  now(): number;
  rpc(action: string, input: Record<string, unknown>): Promise<unknown>;
  decrypt(
    envelope: Envelope,
  ): Promise<{ subscription: SubscriptionData; nonce?: string }>;
  prepare(
    data: SubscriptionData,
    payload: string,
    keyId: string,
    ttl: number,
  ): Promise<
    { endpoint: string; headers: Record<string, string>; body: Uint8Array }
  >;
  fetch: typeof fetch;
  log(code: string): void;
}
export async function runPushWorker(
  dep: WorkerDependencies,
): Promise<{ processed: number }> {
  if (!dep.enabled) {
    await dep.rpc("claim", { recoveryOnly: true });
    return { processed: 0 };
  }
  const deadline = dep.now() + 25000;
  let slot: unknown, slotToken: unknown, processed = 0;
  try {
    while (dep.now() < deadline - 7000) {
      const claimed = await dep.rpc(
        "claim",
        slotToken ? { slot, slotToken } : {},
      ) as { slot?: number; slotToken?: string; jobs: PushJob[] };
      slot = claimed.slot;
      slotToken = claimed.slotToken;
      if (!claimed.jobs.length) break;
      await Promise.all(claimed.jobs.map(async (job) => {
        const lease = {
          id: job.id,
          attemptId: job.attemptId,
          leaseToken: job.leaseToken,
        };
        let started = false;
        try {
          const data = await dep.decrypt(job.encryptedData),
            s = subscription(data.subscription, dep.hosts);
          const ttl = Math.floor(
            (Date.parse(job.expiresAt) - dep.now()) / 1000,
          );
          const payload = job.registration
            ? {
              version: 1,
              type: "registration",
              deliveryId: job.id,
              installationId: job.installationId,
              requestId: job.requestId,
              revision: job.revision,
              fingerprint: job.fingerprint,
              nonce: data.nonce,
              expiresAt: job.expiresAt,
            }
            : {
              version: 1,
              type: "notification",
              deliveryId: job.id,
              ...message(job.content),
              expiresAt: job.expiresAt,
            };
          const serialized = JSON.stringify(payload);
          if (new TextEncoder().encode(serialized).length > 3072) {
            throw new Error("PAYLOAD_TOO_LARGE");
          }
          const details = await dep.prepare(
            s,
            serialized,
            job.keyId,
            Math.max(0, ttl),
          );
          subscription({ ...s, endpoint: details.endpoint }, dep.hosts);
          if (dep.now() > deadline - 7000) {
            await dep.rpc("release", lease);
            return;
          }
          const permission = await dep.rpc("start", lease) as {
            allowed: boolean;
          };
          if (!permission.allowed) return;
          started = true;
          let status: number | undefined;
          let outcome = "unknown",
            reason = "transport_unconfirmed",
            retrySeconds = Math.ceil(
              30 * 2 ** (job.externalCount || 0) * (0.8 + Math.random() * 0.4),
            );
          try {
            const response = await dep.fetch(details.endpoint, {
              method: "POST",
              headers: details.headers,
              body: new Uint8Array(details.body),
              redirect: "manual",
              signal: AbortSignal.timeout(5000),
            });
            status = response.status;
            void response.body?.cancel();
            if (status >= 200 && status < 300) {
              outcome = "accepted";
              reason = "provider_accepted";
            } else if (status === 429) {
              outcome = "retry_wait";
              reason = "provider_rate_limited";
              const retry = response.headers.get("retry-after");
              const delay = retry && /^\d+$/.test(retry)
                ? Number(retry)
                : retry
                ? Math.ceil((Date.parse(retry) - dep.now()) / 1000)
                : retrySeconds;
              retrySeconds = Number.isFinite(delay)
                ? Math.max(5, delay)
                : retrySeconds;
            } else if (status >= 500) reason = "provider_unconfirmed";
            else {
              outcome = "failed";
              reason = [401, 403].includes(status)
                ? "provider_key_error"
                : [404, 410].includes(status)
                ? "provider_expired"
                : "provider_rejected";
            }
          } catch {
            /* A transport error cannot prove the provider did not accept. */
          }
          await dep.rpc("finish", {
            ...lease,
            outcome,
            reason,
            httpStatus: status ?? null,
            retrySeconds,
          });
          processed++;
        } catch {
          dep.log(started ? "RESULT_UNCONFIRMED" : "PREPARE_UNAVAILABLE");
          if (!started) {
            try {
              await dep.rpc("pause", lease);
            } catch {
              dep.log("LEASE_RECOVERY_PENDING");
            }
          }
          // A started call with a missing result is recovered as unknown by SQL.
        }
      }));
    }
  } finally {
    if (slotToken) {
      try {
        await dep.rpc("close", { slot, slotToken });
      } catch {
        dep.log("SLOT_RECOVERY_PENDING");
      }
    }
  }
  return { processed };
}
