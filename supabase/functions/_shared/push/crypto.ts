import { PushError, type SubscriptionData } from "./contracts.ts";
const encoder = new TextEncoder();
export function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(
    /\+/g,
    "-",
  ).replace(/\//g, "_");
}
export function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(
    atob(
      value.replace(/-/g, "+").replace(/_/g, "/") +
        "=".repeat((4 - value.length % 4) % 4),
    ),
    (c) => c.charCodeAt(0),
  );
}
export async function hash(value: string): Promise<string> {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  ].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function randomSecret(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}
export function fingerprint(s: SubscriptionData): Promise<string> {
  return hash(JSON.stringify([s.endpoint, s.keys.p256dh, s.keys.auth]));
}
export interface Envelope {
  v: 1;
  keyId: string;
  iv: string;
  ciphertext: string;
  provider: string;
}
export class PushVault {
  constructor(private keys: Record<string, string>, private active: string) {}
  async encrypt(data: unknown, provider: string): Promise<Envelope> {
    const key = await this.key(this.active),
      iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: encoder.encode(
          `leet-push:1:${this.active}:${provider}`,
        ),
      },
      key,
      encoder.encode(JSON.stringify(data)),
    );
    return {
      v: 1,
      keyId: this.active,
      iv: encode(iv),
      ciphertext: encode(new Uint8Array(ciphertext)),
      provider,
    };
  }
  async decrypt<T>(envelope: Envelope): Promise<T> {
    if (envelope.v !== 1) throw new PushError("STORAGE_UNAVAILABLE", 503);
    const key = await this.key(envelope.keyId);
    try {
      return JSON.parse(
        new TextDecoder().decode(
          await crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: decode(envelope.iv),
              additionalData: encoder.encode(
                `leet-push:1:${envelope.keyId}:${envelope.provider}`,
              ),
            },
            key,
            decode(envelope.ciphertext),
          ),
        ),
      );
    } catch {
      throw new PushError("STORAGE_UNAVAILABLE", 503);
    }
  }
  private async key(id: string): Promise<CryptoKey> {
    const raw = this.keys[id];
    if (!raw || decode(raw).length !== 32) {
      throw new PushError("STORAGE_UNAVAILABLE", 503);
    }
    return crypto.subtle.importKey(
      "raw",
      decode(raw),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }
}
