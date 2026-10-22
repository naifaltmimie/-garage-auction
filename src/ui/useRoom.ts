import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../audio/sound';
import { CATALOGUE } from '../data/catalogue';
import { HostEngine } from '../engine/host';
import { DEFAULT_SETTINGS } from '../engine/rules';
import type { Action, Core, Private, Settings } from '../engine/types';
import { randId, store } from '../lib/util';
import type { BusStatus } from '../net/bus';
import { HostRoom, PlayerRoom, newIdentity, type Snapshot } from '../net/room';

export interface Me {
  pid: string;
  sec: string;
  name: string;
}

export interface Net {
  connected: boolean;
  via: string[];
  hostGone: boolean;
  lastHeard: number;
}

export interface Toast {
  id: number;
  text: string;
  tone?: 'good' | 'bad';
}

export interface HostControls {
  start(): void;
  pause(): void;
  resume(): void;
  advance(): void;
  skip(): void;
  endNow(): void;
  openVoting(): void;
  finish(): void;
  rematch(): void;
  kick(pid: string): void;
  admit(pid: string): void;
  settings(p: Partial<Settings>): void;
}

export interface RoomView {
  code: string;
  role: 'host' | 'player';
  myId: string;
  snap: Snapshot;
  offset: number;
  net: Net;
  spectator: boolean;
  act: (a: Action) => void;
  host: HostControls | null;
  toasts: Toast[];
  toast: (text: string, tone?: 'good' | 'bad') => void;
  sealedMine: Record<string, number>;
  myVote: boolean;
}

const REASONS: Record<string, string> = {
  late: 'وصل سومك متأخر، المطرقة نزلت',
  low: 'سبقك أحد على هالسعر، زوّد',
  cash: 'رصيدك ما يغطي السوم مع السعي',
  full: 'كراجك فل',
  self: 'السوم عندك أصلاً',
  phase: 'المزاد مو مفتوح الحين',
  spectator: 'أنت متفرج بهالجولة',
  unknown: 'ما وصل طلبك للمضيف، جرّب مرة ثانية',
  auth: 'هالجهاز ما يطابق اللاعب',
  room_full: 'الصالة فل، دخلت متفرج',
};

export function meFor(code: string): Me | null {
  return store.get<Me | null>(`mzk:me:${code}`, null);
}

export function saveMe(code: string, me: Me) {
  store.set(`mzk:me:${code}`, me);
  store.set('mzk:name', me.name);
}

export function createHostRoom(code: string, name: string, settings: Settings) {
  const me: Me = { pid: `h_${randId(10)}`, sec: randId(16), name };
  saveMe(code, me);
  const engine = HostEngine.create({ code, hostId: me.pid, hostSec: me.sec, hostName: name, settings: { ...DEFAULT_SETTINGS, ...settings }, now: Date.now() }, CATALOGUE);
  store.set(`mzk:host:${code}`, engine.st);
  store.set('mzk:last', { code, at: Date.now(), host: true });
}

export function joinAs(code: string, name: string): Me {
  const prev = meFor(code);
  const me = prev ? { ...prev, name } : newIdentity(name);
  saveMe(code, me);
  store.set('mzk:last', { code, at: Date.now(), host: false });
  return me;
}

export function useRoom(code: string, me: Me): RoomView {
  const isHost = useMemo(() => !!store.get(`mzk:host:${code}`, null), [code]);
  const [snap, setSnap] = useState<Snapshot>({ core: null, lot: null, hist: null });
  const [net, setNet] = useState<Net>({ connected: false, via: [], hostGone: false, lastHeard: 0 });
  const [offset, setOffset] = useState(0);
  const [spectator, setSpectator] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sealedMine, setSealedMine] = useState<Record<string, number>>({});
  const [myVote, setMyVote] = useState(false);
  const hostRef = useRef<HostRoom | null>(null);
  const playerRef = useRef<PlayerRoom | null>(null);
  const pendingSeal = useRef<Map<string, { lot: string; amount: number }>>(new Map());
  const pendingVote = useRef<Set<string>>(new Set());
  const tid = useRef(0);

  const toast = useCallback((text: string, tone?: 'good' | 'bad') => {
    const id = ++tid.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  useEffect(() => {
    let raf = 0;
    if (isHost) {
      const room = HostRoom.load(code);
      if (!room) return;
      hostRef.current = room;
      const push = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setSnap(room.snapshot()));
      };
      room.onChange = push;
      room.onStatus = (s: BusStatus) => setNet({ connected: s.connected, via: s.via, hostGone: false, lastHeard: Date.now() });
      void room.start();
      push();
      // keep the host's own lobby view of "online" dots fresh
      const iv = setInterval(push, 3000);
      // the host's phone runs the auction: keep its screen awake, and if it still leaves the page
      // (another app, screen off) hold the clock for everyone until it's back
      let lock: { release: () => Promise<void> } | null = null;
      const wake = async () => {
        try {
          const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
          if (wl && document.visibilityState === 'visible' && !lock) {
            lock = await wl.request('screen');
            (lock as unknown as EventTarget).addEventListener?.('release', () => {
              lock = null;
            });
          }
        } catch {
          lock = null; // denied or unsupported: the away-pause still covers it
        }
      };
      const onVis = () => {
        const hidden = document.visibilityState === 'hidden';
        room.away(hidden);
        if (!hidden) void wake();
      };
      const onHide = () => room.away(true);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pagehide', onHide);
      void wake();
      return () => {
        clearInterval(iv);
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', onHide);
        void lock?.release().catch(() => {});
        room.stop();
        hostRef.current = null;
      };
    }
    const room = new PlayerRoom(code, me, {
      onSnap: (s) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          setSnap(s);
          setOffset(room.offset);
        });
      },
      onPrivate: (p: Private) => {
        if (p.t === 'welcome') setSpectator(p.spectator);
        if (p.t === 'pong') setOffset(room.offset);
        if (p.t === 'nack') {
          const seal = pendingSeal.current.get(p.mid);
          if (seal) pendingSeal.current.delete(p.mid);
          if (pendingVote.current.has(p.mid)) pendingVote.current.delete(p.mid);
          toast(REASONS[p.reason] ?? 'ما انقبل الطلب', 'bad');
          sound.outbid();
        }
        if (p.t === 'ack' && p.kind === 'seal') {
          const seal = pendingSeal.current.get(p.mid);
          if (seal) {
            setSealedMine((m) => ({ ...m, [seal.lot]: seal.amount }));
            pendingSeal.current.delete(p.mid);
            toast('انختم ظرفك', 'good');
          }
        }
        if (p.t === 'ack' && p.kind === 'vote') {
          setMyVote(true);
          pendingVote.current.delete(p.mid);
        }
      },
      onStatus: (s) => setNet({ connected: s.connected, via: s.via, hostGone: s.hostGone, lastHeard: s.lastHeard }),
    });
    playerRef.current = room;
    void room.start();
    return () => {
      cancelAnimationFrame(raf);
      room.stop();
      playerRef.current = null;
    };
  }, [code, isHost, me, toast]);

  const act = useCallback(
    (a: Action) => {
      const h = hostRef.current;
      if (h) {
        const r = h.local(a);
        if (!r.ok && r.reason) {
          toast(REASONS[r.reason] ?? 'ما انقبل', 'bad');
          return;
        }
        if (r.ok && a.t === 'seal') {
          setSealedMine((m) => ({ ...m, [a.lot]: a.amount }));
          toast('انختم ظرفك', 'good');
        }
        if (r.ok && a.t === 'vote') setMyVote(true);
        return;
      }
      const p = playerRef.current;
      if (!p) return;
      void p.send(a).then((mid) => {
        if (a.t === 'seal') pendingSeal.current.set(mid, { lot: a.lot, amount: a.amount });
        if (a.t === 'vote') pendingVote.current.add(mid);
      });
    },
    [toast],
  );

  const host = useMemo<HostControls | null>(() => {
    if (!isHost) return null;
    const run = (f: (e: HostEngine, now: number) => ReturnType<HostEngine['tick']>) => () => {
      const r = hostRef.current;
      if (r) r.apply(f(r.engine, Date.now()));
    };
    return {
      start: () => {
        const r = hostRef.current;
        if (r) r.apply(r.engine.start(Date.now(), r.avoidSet()));
      },
      pause: run((e, n) => e.pause(n)),
      resume: run((e, n) => e.resume(n)),
      advance: run((e, n) => e.advance(n)),
      skip: run((e, n) => e.skipLot(n)),
      endNow: run((e, n) => e.endNow(n)),
      openVoting: run((e, n) => e.openVoting(n)),
      finish: run((e, n) => e.finish(n)),
      rematch: run((e, n) => e.rematch(n)),
      kick: (pid: string) => {
        const r = hostRef.current;
        if (r) r.apply(r.engine.kick(pid));
      },
      admit: (pid: string) => {
        const r = hostRef.current;
        if (r) r.apply(r.engine.admit(pid));
      },
      settings: (p: Partial<Settings>) => {
        const r = hostRef.current;
        if (r) r.apply(r.engine.setSettings(p));
      },
    };
  }, [isHost]);

  // a fresh voting round clears my "voted" mark
  const phase = snap.core?.phase;
  useEffect(() => {
    if (phase !== 'voting') setMyVote(false);
  }, [phase]);

  return {
    code,
    role: isHost ? 'host' : 'player',
    myId: me.pid,
    snap,
    offset: isHost ? 0 : offset,
    net,
    // the roster is the truth once it has me in it (the host can admit a latecomer mid-game)
    spectator: isHost ? false : (snap.core?.players.find((p) => p.id === me.pid)?.spectator ?? spectator),
    act,
    host,
    toasts,
    toast,
    sealedMine,
    myVote: myVote || !!snap.core?.voted.includes(me.pid),
  };
}

/** 10 Hz clock in host time. */
export function useNow(offset: number, hz = 10) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now() + offset), 1000 / hz);
    return () => clearInterval(iv);
  }, [offset, hz]);
  return now;
}

export function timeLeft(core: Core | null, now: number) {
  const t = core?.timer;
  if (!t) return { ms: 0, pct: 0 };
  const ms = core!.paused ? t.frozenLeft ?? 0 : Math.max(0, t.endsAt - now);
  return { ms, pct: t.total > 0 ? Math.max(0, Math.min(1, ms / t.total)) : 0 };
}
