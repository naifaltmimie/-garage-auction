// Read-only room viewer for the big screen («شاشة العرض»). It reads exactly what players read — the host's
// retained, encrypted core / lot / hist snapshots under the room key derived from the code — but it never
// publishes anything: no hello, no pings, no intents. So the host never sees it: it isn't a player, has no
// budget and never shows up in lots, players or votes.
import type { Core, Hist, LotPub } from '../engine/types';
import { Bus, type BusStatus } from './bus';
import { roomKeys, unseal, type RoomKeys } from './crypto';
import type { Snapshot } from './room';

// same topic layout and URL overrides as room.ts (kept local so the shared file stays untouched)
const topics = (base: string) => ({ core: `${base}/c`, lot: `${base}/l`, hist: `${base}/h`, host: `${base}/x` });

function bridgeUrl(): string | null {
  try {
    if (new URLSearchParams(location.search).get('bridge') === '0') return null;
    if (!location.host || location.protocol === 'file:') return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/relay`;
  } catch {
    return null;
  }
}

function brokerOverride(): { id: string; url: string }[] | undefined {
  try {
    const q = new URLSearchParams(location.search).get('brokers');
    return q ? q.split(',').map((url, i) => ({ id: `b${i}`, url })) : undefined;
  } catch {
    return undefined;
  }
}

export interface ViewerStatus {
  connected: boolean;
  hostGone: boolean;
  lastHeard: number;
}

export class ViewerRoom {
  private keys!: RoomKeys;
  private bus: Bus | null = null;
  private t!: ReturnType<typeof topics>;
  private snap: Snapshot = { core: null, lot: null, hist: null };
  private revs = { core: -1, beat: 0, lot: -1, hist: -1 };
  /** recent (hostNow − arrival) samples: transit only ever makes them smaller, so the max is the best guess */
  private offs: number[] = [];
  private status: ViewerStatus = { connected: false, hostGone: false, lastHeard: 0 };
  private stopped = false;
  offset = 0;

  constructor(
    private code: string,
    private onSnap: (s: Snapshot, offset: number) => void,
    private onStatus: (s: ViewerStatus) => void,
  ) {}

  async start() {
    this.keys = await roomKeys(this.code);
    if (this.stopped) return;
    this.t = topics(this.keys.base);
    this.bus = new Bus({
      role: 'player',
      brokers: brokerOverride(),
      bridgeUrl: bridgeUrl(),
      onMsg: (topic, payload) => void this.onMsg(topic, payload),
      onStatus: (s: BusStatus) => {
        this.status = { ...this.status, connected: s.connected };
        this.onStatus(this.status);
      },
    });
    this.bus.start();
    this.bus.sub([this.t.core, this.t.lot, this.t.hist, this.t.host]);
  }

  stop() {
    this.stopped = true;
    this.bus?.stop();
    this.bus = null;
  }

  private async onMsg(topic: string, payload: string) {
    const t = this.t;
    if (topic === t.core) {
      const c = await unseal<Core>(this.keys.key, payload);
      if (!c) return;
      const arrived = Date.now();
      this.offs = [...this.offs, c.hostNow - arrived].slice(-12);
      this.offset = Math.max(...this.offs);
      // heartbeats repeat the same rev with a newer hostNow
      if (c.rev < this.revs.core || (c.rev === this.revs.core && c.hostNow <= this.revs.beat)) return;
      this.revs.core = c.rev;
      this.revs.beat = c.hostNow;
      this.status = { ...this.status, hostGone: false, lastHeard: arrived };
      this.snap = { ...this.snap, core: c };
      this.onSnap(this.snap, this.offset);
      this.onStatus(this.status);
    } else if (topic === t.lot) {
      const l = await unseal<{ rev: number; lot: LotPub | null }>(this.keys.key, payload);
      if (!l || l.rev <= this.revs.lot) return;
      this.revs.lot = l.rev;
      this.snap = { ...this.snap, lot: l.lot };
      this.onSnap(this.snap, this.offset);
    } else if (topic === t.hist) {
      const h = await unseal<Hist>(this.keys.key, payload);
      if (!h || h.rev <= this.revs.hist) return;
      this.revs.hist = h.rev;
      this.snap = { ...this.snap, hist: h };
      this.onSnap(this.snap, this.offset);
    } else if (topic === t.host) {
      const x = await unseal<{ t: string; at: number }>(this.keys.key, payload);
      if (!x) return;
      this.status = { ...this.status, hostGone: x.t === 'gone' };
      this.onStatus(this.status);
    }
  }
}
