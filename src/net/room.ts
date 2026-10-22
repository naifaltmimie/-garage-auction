// Room wiring. The host runs HostEngine and publishes three retained snapshots
// (core / lot / hist); players publish intents and read snapshots.
import { CATALOGUE } from '../data/catalogue';
import { HostEngine, type Changes, type HostState, type Nack } from '../engine/host';
import type { Action, Core, Envelope, Hist, LotPub, Private } from '../engine/types';
import { randId, store } from '../lib/util';
import { Bus, type BusStatus } from './bus';
import { roomKeys, seal, unseal, type RoomKeys } from './crypto';

export interface Snapshot {
  core: Core | null;
  lot: LotPub | null;
  hist: Hist | null;
}

const T = (base: string) => ({
  core: `${base}/c`,
  lot: `${base}/l`,
  hist: `${base}/h`,
  host: `${base}/x`,
  act: (pid: string) => `${base}/a/${pid}`,
  actAll: `${base}/a/+`,
  priv: (pid: string) => `${base}/p/${pid}`,
});

function bridgeUrl(): string | null {
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('bridge') === '0') return null;
    const host = location.host;
    if (!host || location.protocol === 'file:') return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${host}/api/relay`;
  } catch {
    return null;
  }
}

function brokerOverride(): { id: string; url: string }[] | undefined {
  try {
    const q = new URLSearchParams(location.search).get('brokers');
    if (!q) return undefined;
    return q.split(',').map((url, i) => ({ id: `b${i}`, url }));
  } catch {
    return undefined;
  }
}

// ============================================================================ host

export class HostRoom {
  engine: HostEngine;
  private keys!: RoomKeys;
  private bus!: Bus;
  private t!: ReturnType<typeof T>;
  private seen = new Map<string, number>();
  private tickId: ReturnType<typeof setInterval> | null = null;
  private beatId: ReturnType<typeof setInterval> | null = null;
  private pending: Changes = {};
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  status: BusStatus = { connected: false, via: [], active: null };
  onChange: () => void = () => {};
  onStatus: (s: BusStatus) => void = () => {};

  constructor(engine: HostEngine) {
    this.engine = engine;
  }

  static load(code: string): HostRoom | null {
    const st = store.get<HostState | null>(`mzk:host:${code}`, null);
    if (!st || st.v !== 2) return null;
    return new HostRoom(new HostEngine(st, CATALOGUE));
  }

  get code() {
    return this.engine.st.code;
  }

  async start() {
    this.keys = await roomKeys(this.code);
    this.t = T(this.keys.base);
    const gone = await seal(this.keys.key, { t: 'gone', at: Date.now() });
    this.bus = new Bus({
      role: 'host',
      brokers: brokerOverride(),
      bridgeUrl: bridgeUrl(),
      will: { topic: this.t.host, payload: gone, retain: true },
      onMsg: (topic, payload) => void this.onMsg(topic, payload),
      onStatus: (s) => {
        const wasUp = this.status.connected;
        this.status = s;
        this.onStatus(s);
        if (s.connected && (!wasUp || s.via.length)) this.publishAll();
      },
    });
    this.bus.start();
    this.bus.sub([this.t.actAll]);
    this.tickId = setInterval(() => this.apply(this.engine.tick(Date.now())), 100);
    let beats = 0;
    this.beatId = setInterval(() => {
      beats += 1;
      this.publish({ core: true, lot: beats % 4 === 0 }, true);
    }, 2500);
    this.save();
  }

  stop() {
    if (this.tickId) clearInterval(this.tickId);
    if (this.beatId) clearInterval(this.beatId);
    this.bus?.stop();
  }

  /** Apply engine changes: bump revisions, notify the UI, broadcast, persist. */
  apply(ch: Changes) {
    if (!this.engine.commit(ch)) return;
    this.onChange();
    this.publish(ch);
    this.save();
  }

  private publish(ch: Changes, beat = false) {
    if (!this.bus) return;
    this.pending = { core: this.pending.core || ch.core, lot: this.pending.lot || ch.lot, hist: this.pending.hist || ch.hist };
    if (beat) return this.flush();
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 40);
  }

  private publishAll() {
    this.publish({ core: true, lot: true, hist: true });
    void seal(this.keys.key, { t: 'alive', at: Date.now() }).then((p) => this.bus.pub(this.t.host, p, true));
  }

  private async flush() {
    this.flushTimer = null;
    const ch = this.pending;
    this.pending = {};
    const now = Date.now();
    const e = this.engine;
    const jobs: Promise<void>[] = [];
    if (ch.hist) jobs.push(seal(this.keys.key, e.hist()).then((p) => void this.bus.pub(this.t.hist, p, true)));
    if (ch.lot) jobs.push(seal(this.keys.key, { rev: e.st.revLot, lot: e.lotPub() }).then((p) => void this.bus.pub(this.t.lot, p, true)));
    if (ch.core) jobs.push(seal(this.keys.key, e.core(now)).then((p) => void this.bus.pub(this.t.core, p, true)));
    await Promise.all(jobs);
  }

  private save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      store.set(`mzk:host:${this.code}`, this.engine.st);
    }, 400);
  }

  private async reply(pid: string, msg: Private) {
    const p = await seal(this.keys.key, msg);
    this.bus.pub(this.t.priv(pid), p, false);
  }

  private async onMsg(topic: string, payload: string) {
    if (!topic.startsWith(`${this.keys.base}/a/`)) return;
    const env = await unseal<Envelope>(this.keys.key, payload);
    if (!env || !env.mid || !env.pid || !env.a) return;
    if (this.seen.has(env.mid)) return;
    this.seen.set(env.mid, Date.now());
    if (this.seen.size > 800) {
      const cut = Date.now() - 60_000;
      for (const [k, v] of this.seen) if (v < cut) this.seen.delete(k);
    }
    this.handle(env, Date.now());
  }

  private handle(env: Envelope, now: number) {
    const e = this.engine;
    const a = env.a as Action;
    if (a.t === 'hello') {
      const r = e.join(env.pid, env.sec, a.name, now);
      if (r.ok) void this.reply(env.pid, { t: 'welcome', spectator: !!r.spectator, full: r.reason === 'room_full' });
      else void this.reply(env.pid, { t: 'nack', mid: env.mid, reason: r.reason ?? 'auth' });
      this.apply(r.changes);
      this.publish({ core: true, lot: true, hist: true });
      return;
    }
    if (!e.seen(env.pid, env.sec, now)) {
      void this.reply(env.pid, { t: 'nack', mid: env.mid, reason: 'unknown' });
      return;
    }
    switch (a.t) {
      case 'ping':
        void this.reply(env.pid, { t: 'pong', c: a.c, h: Date.now() });
        return;
      case 'bid': {
        const r = e.bid(env.pid, a.lot, a.amount, now);
        if (!r.ok) void this.reply(env.pid, { t: 'nack', mid: env.mid, reason: r.reason as Nack });
        this.apply(r.changes);
        return;
      }
      case 'seal': {
        const r = e.seal(env.pid, a.lot, a.amount, now);
        void this.reply(env.pid, r.ok ? { t: 'ack', mid: env.mid, kind: 'seal' } : { t: 'nack', mid: env.mid, reason: r.reason as Nack });
        this.apply(r.changes);
        return;
      }
      case 'vote': {
        const r = e.vote(env.pid, a.scores, now);
        void this.reply(env.pid, r.ok ? { t: 'ack', mid: env.mid, kind: 'vote' } : { t: 'nack', mid: env.mid, reason: r.reason as Nack });
        this.apply(r.changes);
        return;
      }
      case 'bye':
        this.apply(e.leave(env.pid, env.sec));
        return;
    }
  }

  /** The host plays too; its own intents skip the network. */
  local(a: Action): { ok: boolean; reason?: Nack } {
    const e = this.engine;
    const now = Date.now();
    const id = e.st.hostId;
    let r: { ok: boolean; reason?: Nack; changes: Changes } = { ok: false, changes: {} };
    if (a.t === 'bid') r = e.bid(id, a.lot, a.amount, now);
    else if (a.t === 'seal') r = e.seal(id, a.lot, a.amount, now);
    else if (a.t === 'vote') r = e.vote(id, a.scores, now);
    this.apply(r.changes);
    return { ok: r.ok, reason: r.reason };
  }

  snapshot(): Snapshot {
    const now = Date.now();
    return { core: this.engine.core(now), lot: this.engine.lotPub(), hist: this.engine.hist() };
  }
}

// ============================================================================ player

export interface PlayerHandlers {
  onSnap: (s: Snapshot) => void;
  onPrivate: (p: Private) => void;
  onStatus: (s: BusStatus & { hostGone: boolean; lastHeard: number }) => void;
}

export class PlayerRoom {
  private keys!: RoomKeys;
  private bus!: Bus;
  private t!: ReturnType<typeof T>;
  private snap: Snapshot = { core: null, lot: null, hist: null };
  private revs = { core: -1, beat: 0, lot: -1, hist: -1 };
  private samples: { rtt: number; off: number }[] = [];
  private pingId: ReturnType<typeof setInterval> | null = null;
  private helloId: ReturnType<typeof setInterval> | null = null;
  private welcomed = false;
  private behindSince = 0;
  private lastResync = 0;
  private hostGone = false;
  private lastHeard = 0;
  private busStatus: BusStatus = { connected: false, via: [], active: null };
  offset = 0;

  constructor(
    private code: string,
    private me: { pid: string; sec: string; name: string },
    private h: PlayerHandlers,
  ) {}

  async start() {
    this.keys = await roomKeys(this.code);
    this.t = T(this.keys.base);
    this.bus = new Bus({
      role: 'player',
      brokers: brokerOverride(),
      bridgeUrl: bridgeUrl(),
      onMsg: (topic, payload) => void this.onMsg(topic, payload),
      onStatus: (s) => {
        const was = this.busStatus.connected;
        this.busStatus = s;
        this.emitStatus();
        if (s.connected && !was) this.hello();
      },
    });
    this.bus.start();
    this.bus.sub([this.t.core, this.t.lot, this.t.hist, this.t.host, this.t.priv(this.me.pid)]);
    this.pingId = setInterval(() => this.ping(), 4000);
    this.helloId = setInterval(() => {
      if (!this.welcomed) this.hello();
    }, 2500);
  }

  stop() {
    if (this.pingId) clearInterval(this.pingId);
    if (this.helloId) clearInterval(this.helloId);
    void this.send({ t: 'bye' });
    setTimeout(() => this.bus?.stop(), 150);
  }

  private emitStatus() {
    this.h.onStatus({ ...this.busStatus, hostGone: this.hostGone, lastHeard: this.lastHeard });
  }

  hello() {
    void this.send({ t: 'hello', name: this.me.name });
    this.ping();
  }

  private ping() {
    void this.send({ t: 'ping', c: Date.now() });
  }

  async send(a: Action): Promise<string> {
    const mid = randId(12);
    if (!this.bus || !this.keys) return mid;
    const env: Envelope = { pid: this.me.pid, sec: this.me.sec, mid, a };
    const p = await seal(this.keys.key, env);
    this.bus.pub(this.t.act(this.me.pid), p, false, a.t === 'ping' ? 0 : 1);
    return mid;
  }

  private async onMsg(topic: string, payload: string) {
    const t = this.t;
    if (topic === t.core) {
      const c = await unseal<Core>(this.keys.key, payload);
      if (!c) return;
      // heartbeats repeat the same rev with a newer hostNow
      if (c.rev < this.revs.core || (c.rev === this.revs.core && c.hostNow <= this.revs.beat)) return;
      this.revs.core = c.rev;
      this.revs.beat = c.hostNow;
      this.lastHeard = Date.now();
      if (!this.samples.length) this.offset = c.hostNow - Date.now();
      if (this.hostGone) this.hostGone = false;
      this.snap = { ...this.snap, core: c };
      this.h.onSnap(this.snap);
      this.emitStatus();
      if (!c.players.some((p) => p.id === this.me.pid)) this.welcomed = false;
      // a lost lot/history message must never leave a phone on a spinner: ask the host to resend
      const behind = (c.revLot ?? -1) > this.revs.lot || (c.revHist ?? -1) > this.revs.hist;
      const now = Date.now();
      if (!behind) this.behindSince = 0;
      else if (!this.behindSince) this.behindSince = now;
      else if (now - this.behindSince > 1500 && now - this.lastResync > 4000) {
        this.lastResync = now;
        this.hello();
      }
    } else if (topic === t.lot) {
      const l = await unseal<{ rev: number; lot: LotPub | null }>(this.keys.key, payload);
      if (!l || l.rev <= this.revs.lot) return;
      this.revs.lot = l.rev;
      this.snap = { ...this.snap, lot: l.lot };
      this.h.onSnap(this.snap);
    } else if (topic === t.hist) {
      const hh = await unseal<Hist>(this.keys.key, payload);
      if (!hh || hh.rev <= this.revs.hist) return;
      this.revs.hist = hh.rev;
      this.snap = { ...this.snap, hist: hh };
      this.h.onSnap(this.snap);
    } else if (topic === t.host) {
      const x = await unseal<{ t: string; at: number }>(this.keys.key, payload);
      if (!x) return;
      this.hostGone = x.t === 'gone';
      this.emitStatus();
    } else if (topic === t.priv(this.me.pid)) {
      const p = await unseal<Private>(this.keys.key, payload);
      if (!p) return;
      if (p.t === 'pong') {
        const now = Date.now();
        const rtt = now - p.c;
        if (rtt >= 0 && rtt < 8000) {
          this.samples = [...this.samples, { rtt, off: p.h + rtt / 2 - now }].slice(-10);
          const best = [...this.samples].sort((a, b) => a.rtt - b.rtt)[0];
          this.offset = best.off;
        }
      }
      if (p.t === 'welcome') this.welcomed = true;
      this.h.onPrivate(p);
    }
  }
}

export function newIdentity(name: string) {
  return { pid: `p_${randId(10)}`, sec: randId(16), name };
}
