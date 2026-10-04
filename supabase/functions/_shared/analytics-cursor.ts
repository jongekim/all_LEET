export interface CursorCodec { encode(value: unknown, context: string): Promise<string>; decode(cursor: string, context: string): Promise<unknown> }
const bytes = (s: string) => new TextEncoder().encode(s);
const base64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unbase64 = (s: string) => Uint8Array.from(atob(s), c=>c.charCodeAt(0));
export function createCursorCodec(secret: string): CursorCodec {
  const key = crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
  return {
    async encode(value,context) { const body=base64(bytes(JSON.stringify(value))); const signature=await crypto.subtle.sign('HMAC',await key,bytes(`${context}:${body}`)); return `${body}.${base64(new Uint8Array(signature))}`; },
    async decode(cursor,context) {
      try {
        if(cursor.length>2048) throw new Error();
        const [body,sig,...extra]=cursor.split('.');
        if(!body||!sig||extra.length||!await crypto.subtle.verify('HMAC',await key,unbase64(sig),bytes(`${context}:${body}`))) throw new Error();
        return JSON.parse(new TextDecoder().decode(unbase64(body)));
      } catch { throw new Error('INVALID_CURSOR'); }
    },
  };
}
