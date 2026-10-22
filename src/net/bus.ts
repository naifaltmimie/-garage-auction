// Multi-path pub/sub. The host connects to every public broker it can reach (and our own
// Vercel bridge when a broker is blocked), so any player who reaches at least one of them
// meets the host. Players subscribe on one live path and keep the others warm.
import mqtt, { type MqttClient } from 'mqtt';

export const BROKERS: { id: string; url: string }[] = [
  { id: 'emqx', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'hivemq', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { id: 'mosquitto', url: 'wss://test.mosquitto.org:8081' },
];

export type OnMsg = (topic: string, payload: string, via: string) => void;

export interface Will {
  topic: string;
  payload: string;
  retain: boolean;
}

interface Path {
  id: string;
  up: boolean;
  start(): void;
  stop(): void;
  sub(t: string[]): void;
  unsub(t: string[]): void;
  pub(topic: string, payload: string, retain: boolean, qos: 0 | 1): boolean;
}

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

class MqttPath implements Path {
  up = false;
  private c: MqttClient | null = null;
  private subs = new Set<string>();
  constructor(
    public id: string,
    private url: string,
    private will: Will | null,
    private onMsg: OnMsg,
    private onState: () => void,
  ) {}
  start() {
    if (this.c) return;
    const c = mqtt.connect(this.url, {
      clientId: `mzk_${rid()}`,
      clean: true,
      keepalive: 25,
      reconnectPeriod: 2500,
      connectTimeout: 8000,
      protocolVersion: 4,
      will: this.will ? { topic: this.will.topic, payload: this.will.payload, retain: this.will.retain, qos: 0 } : undefined,
    });
    this.c = c;
    c.on('connect', () => {
      this.up = true;
      if (this.subs.size) c.subscribe([...this.subs], { qos: 0 });
      this.onState();
    });
    const down = () => {
      if (this.up) {
        this.up = false;
        this.onState();
      }
    };
    c.on('close', down);
    c.on('offline', down);
    c.on('error', () => {});
    c.on('message', (topic, payload) => this.onMsg(topic, payload.toString(), this.id));
  }
  stop() {
    this.up = false;
    this.c?.end(true);
    this.c = null;
  }
  sub(t: string[]) {
    const fresh = t.filter((x) => !this.subs.has(x));
    fresh.forEach((x) => this.subs.add(x));
    if (this.up && fresh.length) this.c?.subscribe(fresh, { qos: 0 });
  }
  unsub(t: string[]) {
    const had = t.filter((x) => this.subs.delete(x));
    if (this.up && had.length) this.c?.unsubscribe(had);
  }
  pub(topic: string, payload: string, retain: boolean, qos: 0 | 1) {
    if (!this.up || !this.c) return false;
    this.c.publish(topic, payload, { retain, qos });
    return true;
  }
}

/** WebSocket to /api/relay on our own domain (port 443), which fans out to every broker server-side. */
class BridgePath implements Path {
  up = false;
  private ws: WebSocket | null = null;
  private subs = new Set<string>();
  private stopped = true;
  private delay = 800;
  constructor(
    public id: string,
    private url: string,
    private will: Will | null,
    private onMsg: OnMsg,
    private onState: () => void,
  ) {}
  start() {
    this.stopped = false;
    this.open();
  }
  private open() {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.retry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      if (this.will) ws.send(JSON.stringify({ op: 'will', t: this.will.topic, p: this.will.payload, r: this.will.retain }));
      if (this.subs.size) ws.send(JSON.stringify({ op: 'sub', topics: [...this.subs] }));
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(String(ev.data));
        if (m.op === 'ready') {
          this.delay = 800;
          if (!this.up) {
            this.up = true;
            this.onState();
          }
        } else if (m.op === 'msg') this.onMsg(m.t, m.p, this.id);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      if (this.up) {
        this.up = false;
        this.onState();
      }
      this.retry();
    };
    ws.onerror = () => ws.close();
  }
  private retry() {
    if (this.stopped) return;
    setTimeout(() => this.open(), this.delay);
    this.delay = Math.min(6000, this.delay * 1.6);
  }
  stop() {
    this.stopped = true;
    this.up = false;
    this.ws?.close();
    this.ws = null;
  }
  sub(t: string[]) {
    const fresh = t.filter((x) => !this.subs.has(x));
    fresh.forEach((x) => this.subs.add(x));
    if (this.ws?.readyState === 1 && fresh.length) this.ws.send(JSON.stringify({ op: 'sub', topics: fresh }));
  }
  unsub(t: string[]) {
    const had = t.filter((x) => this.subs.delete(x));
    if (this.ws?.readyState === 1 && had.length) this.ws.send(JSON.stringify({ op: 'unsub', topics: had }));
  }
  pub(topic: string, payload: string, retain: boolean, qos: 0 | 1) {
    if (!this.up || this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify({ op: 'pub', t: topic, p: payload, r: retain, q: qos }));
    return true;
  }
}

export interface BusStatus {
  connected: boolean;
  via: string[];
  active: string | null;
}

export interface BusOptions {
  role: 'host' | 'player';
  brokers?: { id: string; url: string }[];
  bridgeUrl?: string | null;
  will?: Will | null;
  onMsg: OnMsg;
  onStatus?: (s: BusStatus) => void;
}

export class Bus {
  private paths: Path[] = [];
  private bridge: Path | null = null;
  private topics = new Set<string>();
  private active: Path | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  constructor(private o: BusOptions) {}

  start() {
    const brokers = this.o.brokers ?? BROKERS;
    for (const b of brokers) {
      const p = new MqttPath(b.id, b.url, this.o.will ?? null, this.o.onMsg, () => this.changed());
      this.paths.push(p);
      p.start();
    }
    if (this.o.bridgeUrl) {
      this.bridge = new BridgePath('bridge', this.o.bridgeUrl, this.o.will ?? null, this.o.onMsg, () => this.changed());
      // the bridge joins when direct brokers are slow or partly blocked
      const wait = this.o.role === 'host' ? 6000 : 4500;
      this.timers.push(setTimeout(() => {
        const up = this.paths.filter((p) => p.up).length;
        if (this.o.role === 'host' ? up < this.paths.length : up === 0) this.addBridge();
      }, wait));
      this.timers.push(setInterval(() => {
        if (!this.paths.some((p) => p.up)) this.addBridge();
      }, 9000) as unknown as ReturnType<typeof setTimeout>);
    }
  }

  private addBridge() {
    if (!this.bridge || this.paths.includes(this.bridge)) return;
    this.paths.push(this.bridge);
    if (this.o.role === 'host') this.bridge.sub([...this.topics]);
    this.bridge.start();
  }

  private changed() {
    if (this.o.role === 'player') {
      if (!this.active || !this.active.up) {
        const next = this.paths.find((p) => p.up && p !== this.active) ?? null;
        if (this.active && next) this.active.unsub([...this.topics]);
        this.active = next;
        if (next) next.sub([...this.topics]);
      }
    }
    const via = this.paths.filter((p) => p.up).map((p) => p.id);
    this.o.onStatus?.({ connected: via.length > 0, via, active: this.active?.id ?? (via[0] ?? null) });
  }

  sub(topics: string[]) {
    topics.forEach((t) => this.topics.add(t));
    if (this.o.role === 'host') this.paths.forEach((p) => p.sub(topics));
    else if (this.active) this.active.sub(topics);
  }

  /** Host publishes everywhere; players send intents on every live path (the host dedupes). */
  pub(topic: string, payload: string, retain = false, qos: 0 | 1 = 0): boolean {
    let any = false;
    for (const p of this.paths) if (p.up) any = p.pub(topic, payload, retain, qos) || any;
    return any;
  }

  status(): BusStatus {
    const via = this.paths.filter((p) => p.up).map((p) => p.id);
    return { connected: via.length > 0, via, active: this.active?.id ?? null };
  }

  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.paths.forEach((p) => p.stop());
    this.bridge?.stop();
    this.paths = [];
  }
}
