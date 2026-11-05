// Per-device switch for reactions + vibration, and the haptic vocabulary.
// Kept free of other imports (util.ts imports this) and safe when storage is blocked.

const KEY = 'mzk:fx';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

let on = read();

export function fxOn(): boolean {
  return on;
}

export function setFx(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? '1' : '0');
  } catch {
    /* private mode: the choice lasts for this visit */
  }
  listeners.forEach((f) => f());
}

export function onFx(f: () => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

let touch: boolean | null = null;
/** Only phones buzz: desktops (fine pointer) and browsers without the API stay still. */
export function canBuzz(): boolean {
  if (touch == null) {
    try {
      touch = typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches;
    } catch {
      touch = false;
    }
  }
  return touch;
}

/**
 * Each moment has its own feel, so a phone in a pocket still tells you what happened:
 * send = a dry click, outbid = two hard knocks, lead = a heartbeat tick per second in the
 * last five (stronger on the final one), win = a rising drum roll that lands.
 */
export const HAPTIC = {
  send: 8,
  outbid: [60, 40, 60],
  lead: 12,
  leadLast: 28,
  win: [24, 70, 32, 60, 44, 50, 160],
} as const;

export function buzz(p: number | readonly number[]) {
  if (!on || !canBuzz()) return;
  try {
    navigator.vibrate(p as number | number[]);
  } catch {
    /* ignore */
  }
}
