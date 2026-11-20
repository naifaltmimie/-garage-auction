// Live reactions: the six the owner chose, thrown at the lot by anyone in the hall.
// They are ephemeral. The host checks and rate-limits each one, then sends it once to every
// phone on its own non-retained topic, so they never ride inside (or bloat) the snapshots,
// and a phone that joins late or misses one simply never sees it.
import type { Phase } from './types';

export interface Reaction {
  k: string;
  /** what floats over the lot: the emoji itself */
  label: string;
  emoji?: boolean;
  /** how a screen reader says it */
  say: string;
  /** colour of a floating word chip (none of the current six is a word) */
  tone?: 'good' | 'bad' | 'gold';
}

/**
 * The owner's own set, in his order, exactly as he sent them (skin tones included). Do not swap, add or reorder
 * without him. Order = order in the tray (RTL: the first sits on the right).
 */
export const REACTIONS: Reaction[] = [
  { k: 'cupid', label: '💗🏹', emoji: true, say: 'قلب وسهم' },
  { k: 'catlove', label: '😻', emoji: true, say: 'عيون قلوب' },
  { k: 'run', label: '🏃🏻', emoji: true, say: 'يركض' },
  { k: 'eagle', label: '🦅', emoji: true, say: 'صقر' },
  { k: 'pray', label: '🙏', emoji: true, say: 'تكفى' },
  { k: 'call', label: '🤙🏻', emoji: true, say: 'كلمني' },
];

export const REACT_BY_KEY = new Map(REACTIONS.map((r) => [r.k, r]));

/** While a lot is on the block or just closed. */
export const REACT_PHASES: ReadonlySet<Phase> = new Set<Phase>(['preview', 'bidding', 'sealed', 'approval', 'sold', 'unsold']);

/** What the host broadcasts. `c` echoes the sender's nonce so its own phone can skip the echo. */
export interface ReactEvent {
  i: string;
  p: string;
  n: string;
  k: string;
  a: number;
  c?: string;
}

/** The phone waits this long between two reactions; the host enforces a slightly looser gap. */
export const REACT_COOLDOWN_MS = 1200;
const HOST_MIN_GAP_MS = 1000;

/** Per-player rate limit kept on the host's device (never persisted, never published). */
export class ReactGate {
  private last = new Map<string, number>();
  allow(pid: string, now: number): boolean {
    const t = this.last.get(pid) ?? 0;
    if (now - t < HOST_MIN_GAP_MS) return false;
    this.last.set(pid, now);
    if (this.last.size > 64) {
      for (const [k, v] of this.last) if (now - v > 60_000) this.last.delete(k);
    }
    return true;
  }
}

/** In-page fan-out from the room (host or player) to the reaction layer on screen. */
type Listener = (e: ReactEvent) => void;
const listeners = new Set<Listener>();
export const reactBus = {
  emit(e: ReactEvent) {
    listeners.forEach((f) => f(e));
  },
  on(f: Listener) {
    listeners.add(f);
    return () => void listeners.delete(f);
  },
};
