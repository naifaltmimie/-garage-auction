// Room traffic rides on public MQTT brokers, so every payload is compressed and sealed with
// AES-GCM. The key and topic are derived from the 6-letter room code nobody else has.
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

const enc = new TextEncoder();

function hex(b: Uint8Array) {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export interface RoomKeys {
  key: CryptoKey;
  base: string;
}

export async function roomKeys(code: string): Promise<RoomKeys> {
  const k = await crypto.subtle.digest('SHA-256', enc.encode(`mzk-key|v2|${code}`));
  const t = await crypto.subtle.digest('SHA-256', enc.encode(`mzk-topic|v2|${code}`));
  const key = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { key, base: `mzk2/${hex(new Uint8Array(t)).slice(0, 24)}` };
}

function b64(u: Uint8Array): string {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u.length; i += CH) s += String.fromCharCode(...u.subarray(i, i + CH));
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

/** JSON -> deflate -> AES-GCM -> base64 text (MQTT payloads stay plain ASCII). */
export async function seal(key: CryptoKey, obj: unknown): Promise<string> {
  const raw = deflateSync(strToU8(JSON.stringify(obj)), { level: 6 });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, raw as Uint8Array<ArrayBuffer>));
  const out = new Uint8Array(13 + ct.length);
  out[0] = 2;
  out.set(iv, 1);
  out.set(ct, 13);
  return b64(out);
}

export async function unseal<T>(key: CryptoKey, text: string): Promise<T | null> {
  try {
    const data = unb64(text);
    if (data[0] !== 2 || data.length < 14) return null;
    const pt = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(1, 13) }, key, data.slice(13)));
    return JSON.parse(strFromU8(inflateSync(pt))) as T;
  } catch {
    return null;
  }
}
