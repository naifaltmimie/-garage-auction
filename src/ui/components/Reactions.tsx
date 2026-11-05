// Live reactions over the auction (live-stream style) + the haptics that go with the game.
// Everything here is presentation: the host checks and relays reactions (net/room.ts), and the
// clock comes from host time (timeLeft), never from a local countdown.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { REACTIONS, REACT_BY_KEY, REACT_COOLDOWN_MS, REACT_PHASES, reactBus, type ReactEvent } from '../../engine/reactions';
import { HAPTIC, buzz, fxOn, onFx, setFx } from '../../lib/fx';
import { randId } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';

const MAX_ON_SCREEN = 12;
const IDLE_CLOSE_MS = 5000;

interface Floater {
  id: string;
  label: string;
  tone: string;
  emoji: boolean;
  name: string;
  mine: boolean;
  style: CSSProperties;
  dur: number;
}

/** The per-device switch, live. */
export function useFx(): boolean {
  const [v, setV] = useState(fxOn);
  useEffect(() => onFx(() => setV(fxOn())), []);
  return v;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Room left between the top bar and whatever is anchored to the bottom (bid panel, sale sheet). */
function useLane(phase: string, lotId: string | undefined) {
  const [geo, setGeo] = useState({ b: 300, lane: 240 });
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const H = window.innerHeight;
        let b = 0;
        document.querySelectorAll('.bidpanel, .overlay > *').forEach((el) => {
          const r = el.getBoundingClientRect();
          // only bottom-anchored blocks count; a tall sheet just shortens the lane
          if (r.height > 0 && r.top > H * 0.3 && r.bottom >= H - 40) b = Math.max(b, H - r.top);
        });
        const top = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 58;
        const lane = Math.max(120, Math.min(460, H - b - 62 - top - 18));
        setGeo((g) => (Math.abs(g.b - b) < 2 && Math.abs(g.lane - lane) < 2 ? g : { b: Math.round(b), lane: Math.round(lane) }));
      });
    };
    measure();
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 600);
    let ro: ResizeObserver | null = null;
    const panel = document.querySelector('.bidpanel');
    if (panel && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(panel);
    }
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, lotId]);
  return geo;
}

export function ReactionLayer({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const on = useFx();
  const live = REACT_PHASES.has(core.phase);
  const geo = useLane(core.phase, room.snap.lot?.id);
  const [items, setItems] = useState<Floater[]>([]);
  const [open, setOpen] = useState(false);
  const [cool, setCool] = useState(0);
  const lastSent = useRef(0);
  const mine = useRef(new Set<string>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const seq = useRef(0);
  const myId = room.myId;
  const myName = core.players.find((p) => p.id === myId)?.name ?? '';

  const spawnAt = useRef(0);
  const trayRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef(geo.lane);
  laneRef.current = geo.lane;

  const add = useCallback(
    (ev: ReactEvent) => {
      const r = REACT_BY_KEY.get(ev.k);
      if (!r) return;
      // a burst comes out one after another (240 ms apart) instead of on top of each other
      const t0 = performance.now();
      const wait = Math.max(0, spawnAt.current - t0);
      if (wait > 1200) return; // a flood: drop it rather than queue forever
      spawnAt.current = t0 + wait + 240;
      if (wait > 0) {
        const t = setTimeout(() => {
          timers.current.delete(t);
          spawn(ev, r);
        }, wait);
        timers.current.add(t);
      } else spawn(ev, r);
    },
    // spawn only reads refs and myId
    [myId],
  );

  function spawn(ev: ReactEvent, r: NonNullable<ReturnType<typeof REACT_BY_KEY.get>>) {
    const n = ++seq.current;
    const dur = Math.round(rand(2500, 3100));
    const side = Math.random() < 0.5 ? -1 : 1;
    // two loose columns so neighbours don't land on each other; with the tray open, start above it
    const tray = trayRef.current?.offsetHeight ?? 0;
    const y0 = tray ? Math.max(0, Math.min(tray + 8, laneRef.current - 112)) : 0;
    const f: Floater = {
      id: `${ev.i}#${n}`,
      label: r.label,
      tone: r.tone ?? 'plain',
      emoji: !!r.emoji,
      name: ev.p === myId ? 'أنت' : ev.n,
      mine: ev.p === myId,
      dur,
      style: {
        ['--x' as string]: `${(n % 2) * 58 + Math.round(rand(0, 14))}px`,
        ['--y0' as string]: `${y0}px`,
        ['--dx' as string]: `${Math.round(side * rand(12, 30))}px`,
        ['--rot' as string]: `${(side * rand(2, 7)).toFixed(1)}deg`,
        ['--rise' as string]: rand(0.78, 1).toFixed(2),
        ['--dur' as string]: `${dur}ms`,
        ['--slot' as string]: n % 6,
      },
    };
    setItems((list) => [...list.slice(-(MAX_ON_SCREEN - 1)), f]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setItems((list) => list.filter((x) => x.id !== f.id));
    }, dur + 60);
    timers.current.add(t);
  }

  useEffect(
    () =>
      reactBus.on((ev) => {
        if (!fxOn()) return;
        // my own reaction already floated the moment I tapped: skip the host's echo
        if (ev.c && mine.current.has(ev.c)) {
          mine.current.delete(ev.c);
          return;
        }
        add(ev);
      }),
    [add],
  );

  useEffect(() => {
    const ts = timers.current;
    return () => ts.forEach(clearTimeout);
  }, []);

  // reactions switched off: clear the sky
  useEffect(() => {
    if (!on) {
      setItems([]);
      setOpen(false);
    }
  }, [on]);

  // the tray closes on its own, on a tap elsewhere, on Escape, and when the lot is over
  const fabRef = useRef<HTMLButtonElement>(null);
  const [poke, setPoke] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), IDLE_CLOSE_MS);
    const down = (e: PointerEvent) => {
      const n = e.target as Node;
      if (trayRef.current?.contains(n) || fabRef.current?.contains(n)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [open, poke]);
  useEffect(() => {
    if (!live) setOpen(false);
  }, [live]);

  const send = (k: string) => {
    const now = Date.now();
    setPoke((p) => p + 1);
    if (now - lastSent.current < REACT_COOLDOWN_MS) return;
    lastSent.current = now;
    setCool((c) => c + 1);
    buzz(HAPTIC.send);
    const c = randId(8);
    if (room.role !== 'host') {
      // float it at once; the host's copy for everyone else is the same reaction
      mine.current.add(c);
      if (mine.current.size > 20) mine.current = new Set([...mine.current].slice(-10));
      add({ i: `me.${c}`, p: myId, n: myName, k, a: now, c });
    }
    room.act({ t: 'react', k, c });
  };

  const style = { ['--rx-b' as string]: `${geo.b}px`, ['--lane' as string]: `${geo.lane}px` } as CSSProperties;

  return (
    <div className="rx" style={style}>
      <Haptics room={room} />
      {on && (
        <div className="rx-lane" aria-hidden="true">
          {items.map((f) => (
            <span key={f.id} className={`rx-f t-${f.tone} ${f.emoji ? 'emo' : ''} ${f.mine ? 'mine' : ''}`} style={f.style}>
              <span className="rx-sway">
                <span className="rx-pop">
                  <b className="rx-t">{f.label}</b>
                  <small className="rx-n">{f.name}</small>
                </span>
              </span>
            </span>
          ))}
        </div>
      )}
      {on && live && (
        <>
          {open && (
            <div className="rx-tray" ref={trayRef} role="group" aria-label="تفاعل مع اللوت">
              <i key={cool} className={`rx-cool ${cool ? 'run' : ''}`} aria-hidden="true" />
              {REACTIONS.map((r) => (
                <button
                  key={r.k}
                  type="button"
                  className={`rx-chip t-${r.tone ?? 'plain'} ${r.emoji ? 'emo' : ''}`}
                  aria-label={r.emoji ? (r.k === 'fire' ? 'نار' : 'ضحك') : r.label}
                  onClick={() => send(r.k)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <button
            ref={fabRef}
            type="button"
            className={`rx-fab ${open ? 'open' : ''}`}
            aria-expanded={open}
            aria-label={open ? 'سكّر التفاعلات' : 'تفاعل مع اللوت'}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {open ? (
                <path d="M7 7l10 10M17 7L7 17" />
              ) : (
                <>
                  <path d="M12 3.6c-4.9 0-8.6 3.2-8.6 7.3 0 2.2 1.1 4.1 2.9 5.5l-.8 3.5 3.9-2c.8.2 1.7.3 2.6.3 4.9 0 8.6-3.2 8.6-7.3S16.9 3.6 12 3.6z" />
                  <path d="M8.7 12.3c.8 1.3 1.9 2 3.3 2s2.5-.7 3.3-2" />
                  <path d="M9 9.2h.01M15 9.2h.01" />
                </>
              )}
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/** Buzzes for the moments that matter to *me*: a win, and the last seconds while I hold the lot. */
function Haptics({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const lot = room.snap.lot;
  const hist = room.snap.hist;
  const sale = hist?.sales.length ? hist.sales[hist.sales.length - 1] : null;
  const won = useRef<string | null>(null);
  const wonNow = core.phase === 'sold' && !!sale && !!lot && sale.lotId === lot.id && sale.buyer === room.myId;
  const saleLot = sale?.lotId ?? null;
  useEffect(() => {
    if (!wonNow || !saleLot || won.current === saleLot) return;
    won.current = saleLot;
    buzz(HAPTIC.win);
  }, [wonNow, saleLot]);
  const leading = core.phase === 'bidding' && !core.paused && !!core.bid && core.bid.by === room.myId;
  return leading ? <LeadTicks room={room} /> : null;
}

/** A heartbeat each second of the last five while the top bid is mine (stronger on the last). */
function LeadTicks({ room }: { room: RoomView }) {
  const now = useNow(room.offset, 5);
  const { ms } = timeLeft(room.snap.core, now);
  const last = useRef(0);
  const s = Math.ceil(ms / 1000);
  useEffect(() => {
    if (s >= 1 && s <= 5 && s !== last.current) {
      last.current = s;
      buzz(s === 1 ? HAPTIC.leadLast : HAPTIC.lead);
    }
    if (s > 5) last.current = 0;
  }, [s]);
  return null;
}

/** Top-bar switch for reactions + vibration on this device, beside the sound button. */
export function FxToggle() {
  const on = useFx();
  return (
    <button
      type="button"
      className="iconbtn tb-btn rx-toggle"
      aria-pressed={on}
      aria-label={on ? 'وقّف التفاعلات والاهتزاز' : 'شغّل التفاعلات والاهتزاز'}
      title={on ? 'التفاعلات والاهتزاز شغّالة' : 'التفاعلات والاهتزاز طافية'}
      onClick={() => {
        setFx(!on);
        if (!on) buzz(HAPTIC.send);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="3.5" width="8" height="17" rx="2" />
        <path d="M11 17.2h2" />
        {on ? <path d="M4.6 8.5v7M2.2 10v4M19.4 8.5v7M21.8 10v4" /> : <path d="M3.5 3.5l17 17" />}
      </svg>
    </button>
  );
}
