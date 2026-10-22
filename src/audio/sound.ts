// Sound: synthesized auction-house effects (WebAudio, no files) plus the auctioneer's
// recorded Najdi voice lines. Everything stays silent until the first tap unlocks audio.
import type { CalloutKey } from '../engine/types';
import { store } from '../lib/util';

// Recorded lines (ElevenLabs, Saudi auctioneer). A key lists clips in preference order;
// lines that were never recorded fall back to the closest one we have, or stay silent.
const VOICE_FILES: Partial<Record<CalloutKey, string[]>> = {
  hall_open: ['hall_open'],
  lot_intro: ['lot_intro_1', 'lot_intro_2'],
  open_bid: ['open_bid', 'who_more'],
  who_more: ['who_more'],
  war: ['war'],
  jump: ['war'],
  going_1: ['going_1', 'who_more'],
  going_2: ['going_2'],
  going_3: ['going_3'],
  sold: ['sold_1', 'sold_2'],
  accept: ['sold_2', 'sold_1'],
  no_bid: ['no_bid'],
  unsold: ['unsold'],
  decline: ['unsold'],
  nobody_can: ['unsold'],
  covered: ['covered'],
  sealed: ['sealed'],
  envelopes: ['envelopes'],
  bargain: ['bargain'],
  robbed: ['robbed'],
  surprise: ['surprise'],
  last_lot: ['last_lot'],
  auction_end: ['auction_end'],
  winner: ['winner'],
};

export interface SoundPrefs {
  sfx: boolean;
  voice: boolean;
}

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private verb: ConvolverNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private lastVoiceAt = 0;
  private current: AudioBufferSourceNode | null = null;
  prefs: SoundPrefs;
  listeners = new Set<() => void>();

  constructor() {
    this.prefs = store.get<SoundPrefs>('mzk:sound', { sfx: true, voice: true });
  }

  setPrefs(p: Partial<SoundPrefs>) {
    this.prefs = { ...this.prefs, ...p };
    store.set('mzk:sound', this.prefs);
    this.listeners.forEach((f) => f());
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must run inside a user gesture (iOS). */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.verb = this.ctx.createConvolver();
        this.verb.buffer = this.impulse(1.6, 2.6);
        const wet = this.ctx.createGain();
        wet.gain.value = 0.22;
        this.verb.connect(wet).connect(this.master);
        // a silent buffer primes iOS
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b;
        s.connect(this.ctx.destination);
        s.start(0);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.preload();
    } catch {
      /* no audio */
    }
  }

  private preload() {
    const all = new Set(Object.values(VOICE_FILES).flat() as string[]);
    // index.json (written at build time) lists the clips that actually exist — no 404 noise
    fetch('/voice/index.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((have: unknown) => {
        const list = Array.isArray(have) ? (have as string[]).filter((n) => all.has(n)) : [...all];
        for (const name of list) void this.load(name);
      });
  }

  private async load(name: string) {
    if (!this.ctx || this.buffers.has(name) || this.loading.has(name)) return;
    this.loading.add(name);
    try {
      const r = await fetch(`/voice/${name}.mp3`);
      if (!r.ok || !/audio|mpeg|octet/i.test(r.headers.get('content-type') ?? '')) return;
      const data = await r.arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
    } catch {
      /* missing clip: stay quiet */
    } finally {
      this.loading.delete(name);
    }
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noise(dur: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    return s;
  }

  private out(gain: number, wet = false) {
    const g = this.ctx!.createGain();
    g.gain.value = gain;
    g.connect(this.master!);
    if (wet && this.verb) g.connect(this.verb);
    return g;
  }

  private ok() {
    return this.prefs.sfx && !!this.ctx && !!this.master;
  }

  /** wood block: a placed bid */
  tock() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(720, t);
    o.frequency.exponentialRampToValueAtTime(380, t + 0.08);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.out(0.6));
    o.start(t);
    o.stop(t + 0.14);
  }

  /** clock tick for the closing seconds */
  tick(strong = false) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noise(0.03);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = strong ? 2400 : 3200;
    f.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(strong ? 0.9 : 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    n.connect(f).connect(g).connect(this.out(0.7));
    n.start(t);
  }

  /** two falling tones: somebody beat your bid */
  outbid() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    [660, 440].forEach((fr, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.11 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.1);
      o.connect(g).connect(this.out(0.5));
      o.start(t + i * 0.11);
      o.stop(t + i * 0.11 + 0.12);
    });
  }

  /** the gavel: low thump + hard wood crack, with room reverb */
  gavel(times = 1) {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    for (let k = 0; k < times; k++) {
      const t = ctx.currentTime + k * 0.32;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.18);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(1, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(this.out(0.9, true));
      o.start(t);
      o.stop(t + 0.32);
      const n = this.noise(0.06);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1700;
      f.Q.value = 1.2;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.9, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      n.connect(f).connect(gn).connect(this.out(0.8, true));
      n.start(t);
    }
  }

  /** soft bell for a good result */
  chime() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    [880, 1318.5, 1760].forEach((fr, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.22 / (i + 1), t + i * 0.07 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 1.1);
      o.connect(g).connect(this.out(0.5, true));
      o.start(t + i * 0.07);
      o.stop(t + i * 0.07 + 1.2);
    });
  }

  /** descending groan for a bad deal */
  womp() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.7);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(f).connect(g).connect(this.out(0.6));
    o.start(t);
    o.stop(t + 0.85);
  }

  /** paper whoosh between lots */
  whoosh() {
    if (!this.ok()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const n = this.noise(0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(f).connect(g).connect(this.out(0.6));
    n.start(t);
  }

  /** the auctioneer speaks (one line at a time; frequent lines are rate-limited) */
  voice(key: CalloutKey, id: number) {
    if (!this.prefs.voice || !this.ctx || !this.master) return;
    const files = VOICE_FILES[key];
    if (!files) return;
    const now = performance.now();
    const chatty = key === 'who_more' || key === 'war' || key === 'jump';
    if (chatty && now - this.lastVoiceAt < 5000) return;
    const ready = files.filter((f) => this.buffers.has(f));
    const buf = ready.length ? this.buffers.get(ready[id % ready.length]) : undefined;
    if (!buf) return;
    const urgent = key.startsWith('going') || key === 'sold' || key === 'accept' || key === 'envelopes';
    if (this.current && !urgent && now - this.lastVoiceAt < 1200) return;
    try {
      this.current?.stop();
    } catch {
      /* already ended */
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 1.15;
    s.connect(g).connect(this.master);
    if (this.verb) g.connect(this.verb);
    s.start();
    s.onended = () => {
      if (this.current === s) this.current = null;
    };
    this.current = s;
    this.lastVoiceAt = now;
  }
}

export const sound = new Sound();
