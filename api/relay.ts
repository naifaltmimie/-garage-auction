// WebSocket bridge for networks that block the public brokers' ports.
// One browser socket in, one MQTT connection per broker out. Stateless: the brokers hold the room.
import http from 'node:http';
import crypto from 'node:crypto';
import mqtt, { type MqttClient } from 'mqtt';
import { WebSocketServer, type WebSocket } from 'ws';

const BROKERS = [
  'mqtts://broker.emqx.io:8883',
  'mqtts://broker.hivemq.com:8883',
  'mqtts://test.mosquitto.org:8886',
];
const PREFIX = 'mzk2/';

function bridge(ws: WebSocket) {
  const subs = new Set<string>();
  const seen = new Map<string, number>();
  let will: { t: string; p: string; r: boolean } | null = null;
  let ready = false;
  const clients: MqttClient[] = BROKERS.map((url) =>
    mqtt.connect(url, {
      clientId: `mzkb_${crypto.randomBytes(5).toString('hex')}`,
      clean: true,
      keepalive: 25,
      reconnectPeriod: 2000,
      connectTimeout: 7000,
    }),
  );
  const send = (o: unknown) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(o));
  };
  for (const c of clients) {
    c.on('connect', () => {
      if (subs.size) c.subscribe([...subs], { qos: 0 });
      if (!ready) {
        ready = true;
        send({ op: 'ready' });
      }
    });
    c.on('error', () => {});
    c.on('message', (t, payload) => {
      const p = payload.toString();
      const key = `${t}|${crypto.createHash('sha1').update(p).digest('base64')}`;
      if (seen.has(key)) return;
      seen.set(key, Date.now());
      send({ op: 'msg', t, p });
    });
  }
  const gc = setInterval(() => {
    const cut = Date.now() - 15_000;
    for (const [k, v] of seen) if (v < cut) seen.delete(k);
  }, 10_000);
  ws.on('message', (raw) => {
    let m: { op: string; topics?: string[]; t?: string; p?: string; r?: boolean; q?: 0 | 1 };
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    const ok = (t?: string) => typeof t === 'string' && t.startsWith(PREFIX) && t.length < 200;
    if (m.op === 'sub' && Array.isArray(m.topics)) {
      const ts = m.topics.filter(ok);
      ts.forEach((t) => subs.add(t));
      for (const c of clients) if (c.connected && ts.length) c.subscribe(ts, { qos: 0 });
    } else if (m.op === 'unsub' && Array.isArray(m.topics)) {
      const ts = m.topics.filter((t) => subs.delete(t));
      for (const c of clients) if (c.connected && ts.length) c.unsubscribe(ts);
    } else if (m.op === 'pub' && ok(m.t) && typeof m.p === 'string' && m.p.length < 200_000) {
      for (const c of clients) if (c.connected) c.publish(m.t!, m.p, { retain: !!m.r, qos: m.q === 1 ? 1 : 0 });
    } else if (m.op === 'will' && ok(m.t) && typeof m.p === 'string') {
      will = { t: m.t!, p: m.p, r: !!m.r };
    }
  });
  ws.on('close', () => {
    clearInterval(gc);
    if (will) for (const c of clients) if (c.connected) c.publish(will.t, will.p, { retain: will.r, qos: 0 });
    setTimeout(() => clients.forEach((c) => c.end(true)), 400);
  });
  ws.on('error', () => ws.close());
}

const server = http.createServer((_req, res) => {
  res.writeHead(426, { 'content-type': 'text/plain' });
  res.end('websocket only');
});
const wss = new WebSocketServer({ server });
wss.on('connection', bridge);

export default server;
