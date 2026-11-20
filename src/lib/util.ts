import { canBuzz, fxOn } from './fx';
const nf = new Intl.NumberFormat('en-US');

export const money = (n: number) => nf.format(Math.round(n));

export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** UI numbers stay Latin (like Absher and Haraj) — Arabic-Indic zero reads as a dot next to separators. */
export const arDigits = (s: string | number) => String(s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));

export function km(n: number): string {
  return `${nf.format(Math.round(n / 100) * 100)} كم`;
}

export function randId(len = 10): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < len; i++) s += a[buf[i] % a.length];
  return s;
}

const CODE_ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function roomCode(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHA[buf[i] % CODE_ALPHA.length];
  return s;
}
export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 6);
}
export const isCode = (s: string) => /^[A-Z0-9]{6}$/.test(s);

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export function vibrate(p: number | number[]) {
  try {
    if (!fxOn() || !canBuzz()) return;
    navigator.vibrate?.(p);
  } catch {
    /* ignore */
  }
}

/** Arabic count of cars: سيارة وحدة، سيارتين، 3 سيارات، 11 سيارة. */
export function carsN(n: number): string {
  if (n === 0) return 'ولا سيارة';
  if (n === 1) return 'سيارة وحدة';
  if (n === 2) return 'سيارتين';
  if (n <= 10) return `${n} سيارات`;
  return `${n} سيارة`;
}

/** A model name inside an Arabic line, as a string: isolated (U+2068 … U+2069) so a Latin or numeric name keeps
 *  its own order («812 Superfast», not «Superfast 812») and does not pull the numbers after it into one
 *  left-to-right run. In JSX use `<bdi>` around the model and its trim together. */
export const iso = (s: string): string => (s && /[A-Za-z0-9]/.test(s) ? `⁨${s}⁩` : s);

/** Arabic count of bids: سومة وحدة، سومتين، 5 سومات، 12 سومة. */
export function bidsN(n: number): string {
  if (n <= 1) return 'سومة وحدة';
  if (n === 2) return 'سومتين';
  if (n <= 10) return `${n} سومات`;
  return `${n} سومة`;
}
