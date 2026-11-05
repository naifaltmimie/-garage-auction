// Live reactions: short Saudi auction banter anyone in the hall can throw at the lot.
// They are ephemeral. The host checks and rate-limits each one, then sends it once to every
// phone on its own non-retained topic, so they never ride inside (or bloat) the snapshots,
// and a phone that joins late or misses one simply never sees it.
import type { Phase } from './types';

export interface Reaction {
  k: string;
  label: string;
  emoji?: boolean;
  /** colour of the floating chip: a steal, too pricey, or plain hall banter */
  tone?: 'good' | 'bad' | 'gold';
}

/** Order = order in the tray (RTL: first item sits on the right). */
export const REACTIONS: Reaction[] = [
  { k: 'laqta', label: 'لقطة', tone: 'good' },
  { k: 'ghalya', label: 'غالية', tone: 'bad' },
  { k: 'yasalam', label: 'يا سلام', tone: 'good' },
  { k: 'shareeti', label: 'شريطي', tone: 'gold' },
  { k: 'khudha', label: 'خذها', tone: 'gold' },
  { k: 'latfoot', label: 'لا تفوتك', tone: 'gold' },
  { k: 'fire', label: '🔥', emoji: true },
  { k: 'lol', label: '😂', emoji: true },
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
