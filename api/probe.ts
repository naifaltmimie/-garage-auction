// Health check: can the public brokers be reached and do retained messages round-trip?
import crypto from 'node:crypto';
import mqtt from 'mqtt';
import WebSocket from 'ws';

const TARGETS = [
  { id: 'emqx-tls', url: 'mqtts://broker.emqx.io:8883' },
  { id: 'emqx-wss', url: 'wss://broker.emqx.io:8084/mqtt' },
  { id: 'hivemq-tls', url: 'mqtts://broker.hivemq.com:8883' },
  { id: 'hivemq-wss', url: 'wss://broker.hivemq.com:8884/mqtt' },
  { id: 'mosq-tls', url: 'mqtts://test.mosquitto.org:8886' },
  { id: 'mosq-wss', url: 'wss://test.mosquitto.org:8081' },
  { id: 'shiftr-wss', url: 'wss://public:public@public.cloud.shiftr.io' },
];

function probe(url: string): Promise<{ ok: boolean; connectMs?: number; rttMs?: number; retained?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const topic = `mzk2/probe/${crypto.randomBytes(6).toString('hex')}`;
    const done = (r: { ok: boolean; connectMs?: number; rttMs?: number; retained?: boolean; error?: string }) => {
      clearTimeout(timer);
      try { c.end(true); } catch { /* ignore */ }
      resolve(r);
    };
    const timer = setTimeout(() => done({ ok: false, error: 'timeout' }), 9000);
    const c = mqtt.connect(url, { clientId: `mzkp_${crypto.randomBytes(4).toString('hex')}`, connectTimeout: 8000, reconnectPeriod: 0, clean: true, wsOptions: { headers: {} } });
    let connectMs = 0;
    c.on('error', (e) => done({ ok: false, error: String(e?.message ?? e) }));
    c.on('connect', () => {
      connectMs = Date.now() - t0;
      c.publish(topic, 'hello', { retain: true, qos: 1 }, () => {
        const t1 = Date.now();
        c.subscribe(topic, { qos: 0 });
        c.on('message', (_t, p, packet) => {
          if (p.toString() === 'hello') {
            c.publish(topic, '', { retain: true, qos: 0 });
            done({ ok: true, connectMs, rttMs: Date.now() - t1, retained: !!packet.retain });
          }
        });
      });
    });
  });
}

function probeRelay(host: string): Promise<{ ok: boolean; ms?: number; error?: string }> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const topic = `mzk2/probe/${crypto.randomBytes(6).toString('hex')}`;
    const ws = new WebSocket(`wss://${host}/api/relay`);
    const timer = setTimeout(() => { ws.terminate(); resolve({ ok: false, error: 'timeout' }); }, 12000);
    ws.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, error: String(e.message) }); });
    ws.on('message', (raw) => {
      const m = JSON.parse(String(raw));
      if (m.op === 'ready') {
        ws.send(JSON.stringify({ op: 'sub', topics: [topic] }));
        setTimeout(() => ws.send(JSON.stringify({ op: 'pub', t: topic, p: 'via-relay', r: false, q: 0 })), 600);
      }
      if (m.op === 'msg' && m.p === 'via-relay') {
        clearTimeout(timer);
        ws.close();
        resolve({ ok: true, ms: Date.now() - t0 });
      }
    });
  });
}

export default async function handler(req: { headers: Record<string, string | undefined> }, res: { setHeader: (k: string, v: string) => void; end: (s: string) => void; statusCode: number }) {
  const results: Record<string, unknown> = {};
  await Promise.all(TARGETS.map(async (t) => { results[t.id] = await probe(t.url); }));
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  results.relay = host ? await probeRelay(host) : { ok: false, error: 'no host' };
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify({ at: new Date().toISOString(), region: process.env.VERCEL_REGION, results }, null, 1));
}
