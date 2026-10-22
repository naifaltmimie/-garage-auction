const nf = new Intl.NumberFormat('en-US');

export const money = (n: number) => nf.format(Math.round(n));

/** 1,250,000 -> "1.25 مليون", 185,000 -> "185 ألف" — for compact spoken-style labels. */
export function moneyWords(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) {
    const m = a / 1_000_000;
    const s = m >= 10 ? m.toFixed(0) : m.toFixed(m % 1 === 0 ? 0 : 2).replace(/0$/, '');
    return `${n < 0 ? '−' : ''}${s} مليون`;
  }
  if (a >= 1_000) {
    const k = a / 1_000;
    const s = k >= 100 || k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${n < 0 ? '−' : ''}${s} ألف`;
  }
  return `${n < 0 ? '−' : ''}${a}`;
}

export const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
/** UI numbers stay Latin (like Absher and Haraj) — Arabic-Indic zero reads as a dot next to separators. */
export const arDigits = (s: string | number) => String(s).replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
/** Arabic-Indic digits, for the top row of a Saudi plate. */
export const indic = (s: string | number) => String(s).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

export function km(n: number): string {
  return `${nf.format(Math.round(n / 100) * 100)} كم`;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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

export function hijriToday(): string {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date());
  } catch {
    return '';
  }
}

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
    navigator.vibrate?.(p);
  } catch {
    /* ignore */
  }
}

/** Arabic count of cars: سيارة واحدة، سيارتين، 3 سيارات، 11 سيارة. */
export function carsN(n: number): string {
  if (n === 0) return 'ولا سيارة';
  if (n === 1) return 'سيارة وحدة';
  if (n === 2) return 'سيارتين';
  if (n <= 10) return `${n} سيارات`;
  return `${n} سيارة`;
}
