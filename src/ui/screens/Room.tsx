import { markSeen } from '../../lib/seen';
import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Core, Hist } from '../../engine/types';
import { money, store } from '../../lib/util';
import { go } from '../App';
import { Icon, Toasts } from '../components/Bits';
import { joinAs, meFor, useRoom, type Me, type RoomView } from '../useRoom';
import { Auction } from './Auction';
import { Intro } from './Intro';
import { Lobby } from './Lobby';
import { Results } from './Results';
import { Showcase } from './Showcase';
import { Standings } from './Standings';
import { Voting } from './Voting';

export function RoomGate({ code }: { code: string }) {
  const [me, setMe] = useState<Me | null>(() => meFor(code));
  const [name, setName] = useState(() => store.get('mzk:name', ''));
  if (me) return <Room code={code} me={me} />;
  return (
    <main className="shell narrow">
      <div className="center-screen">
        <form
          className="stack"
          style={{ width: '100%', maxWidth: 420, gap: 16 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim().length < 2) return;
            sound.unlock();
            setMe(joinAs(code, name.trim()));
          }}
        >
          <span className="brandmark" style={{ fontSize: 34 }}>
            مزاد <em>الكراج</em>
          </span>
          <div className="code">{code}</div>
          <p className="mute" style={{ margin: 0 }}>انعزمت على المزاد. اكتب اسمك وادخل الصالة.</p>
          <input className="input" autoFocus value={name} maxLength={18} onChange={(e) => setName(e.target.value)} placeholder="اسمك" autoComplete="nickname" />
          <button className="btn btn-primary btn-block" disabled={name.trim().length < 2}>
            ادخل الصالة
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => go('/')}>
            رجوع
          </button>
        </form>
      </div>
    </main>
  );
}

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let dead = false;
    const req = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed */
      }
    };
    void req();
    const vis = () => {
      if (!dead && document.visibilityState === 'visible') void req();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      dead = true;
      document.removeEventListener('visibilitychange', vis);
      void lock?.release().catch(() => {});
    };
  }, [on]);
}

/** Every device hears the same hall: voice lines, gavel, ticks, outbid alarm. */
function useHallSounds(core: Core | null, hist: Hist | null, myId: string) {
  const last = useRef({ callout: 0, bids: -1, phase: '', sale: '' });
  useEffect(() => {
    if (!core) return;
    const L = last.current;
    const c = core.callout;
    if (c && c.id !== L.callout) {
      const fresh = L.callout !== 0 || Date.now() - c.at < 4000;
      L.callout = c.id;
      if (fresh) {
        sound.voice(c.key, c.id);
        if (c.key.startsWith('going')) sound.tick(true);
        if (c.key === 'sold' || c.key === 'accept') sound.gavel(1);
        if (c.key === 'envelopes') sound.whoosh();
        if (c.key === 'reserve_met') sound.chime();
        if (c.key === 'unsold' || c.key === 'decline') sound.gavel(1);
      }
    }
    const n = core.bid?.count ?? 0;
    if (L.bids >= 0 && n > L.bids && core.phase === 'bidding') sound.tock();
    L.bids = n;
    if (core.phase !== L.phase) {
      if (core.phase === 'preview') sound.whoosh();
      L.phase = core.phase;
    }
  }, [core]);
  // verdict sting for the buyer's result
  useEffect(() => {
    if (!core || core.phase !== 'sold' || !hist) return;
    const s = hist.sales[hist.sales.length - 1];
    if (!s || s.lotId === last.current.sale) return;
    last.current.sale = s.lotId;
    const shift = s.sealedBids?.length ? 2400 : 0;
    const t = setTimeout(() => {
      if (s.profit >= 0) sound.chime();
      else sound.womp();
    }, 2800 + shift);
    void myId;
    return () => clearTimeout(t);
  }, [core?.phase, hist, myId, core]);
}

function TopBar({ room, onPlayers }: { room: RoomView; onPlayers: () => void }) {
  const core = room.snap.core!;
  const me = core.players.find((p) => p.id === room.myId);
  const [prefs, setPrefs] = useState(sound.prefs);
  useEffect(() => {
    const f = () => setPrefs({ ...sound.prefs });
    sound.listeners.add(f);
    return () => void sound.listeners.delete(f);
  }, []);
  const inGame = !['lobby', 'results', 'showcase', 'voting'].includes(core.phase);
  const off = !room.net.connected || room.net.hostGone;
  const live = core.phase === 'bidding' || core.phase === 'sealed';
  const progress = core.lotsTotal > 0 ? Math.min(1, Math.max(0, core.lotNo / core.lotsTotal)) : 0;
  return (
    <header className={`topbar ${inGame ? 'ingame' : ''}`}>
      {inGame ? (
        <span className="brand" aria-hidden="true">
          <span className="brand-seal">
            <GavelMark />
          </span>
        </span>
      ) : (
        <button className="brand" onClick={() => go('/')} aria-label="الرئيسية">
          <span className="brand-seal">
            <GavelMark />
          </span>
          <span className="brand-name">
            مزاد <b>الكراج</b>
          </span>
        </button>
      )}
      {inGame && core.lotNo > 0 && (
        <div className={`tb-lot ${live ? 'is-live' : ''}`}>
          <small>{live ? <span className="live"><i />مباشر</span> : 'اللوت'}</small>
          <span className="tb-lot-n">
            <b className="ltr">{String(core.lotNo).padStart(2, '0')}</b>
            <span className="ltr">/{core.lotsTotal}</span>
          </span>
        </div>
      )}
      <div className="grow" />
      {off && <span className="tb-off" role="status"><i />مقطوع</span>}
      {me && !me.spectator && core.phase !== 'lobby' && (
        <div className="wallet" aria-label={`رصيدك ${money(me.cash)} ريال، الكراج ${me.garage.length} من ${core.settings.garage}`}>
          <div className="w-top">
            <small>رصيدك</small>
            <span className="wg">
              <Icon name="car" size={13} />
              <span className="ltr">{me.garage.length}/{core.settings.garage}</span>
            </span>
          </div>
          <b className="ltr">{money(me.cash)}</b>
        </div>
      )}
      <button
        className="iconbtn tb-btn"
        aria-pressed={prefs.voice}
        aria-label={prefs.voice ? 'اسكت الدلال' : 'شغّل صوت الدلال'}
        onClick={() => {
          sound.unlock();
          sound.setPrefs({ voice: !prefs.voice, sfx: true });
        }}
      >
        <Icon name={prefs.voice ? 'sound' : 'mute'} />
      </button>
      <button className="iconbtn tb-btn" aria-label="الكراجات والترتيب" onClick={onPlayers}>
        <Icon name="users" />
      </button>
      {inGame && <i className="tb-progress" style={{ ['--p' as string]: progress }} aria-hidden="true" />}
    </header>
  );
}

/** Small gold gavel used as the brand mark. */
export function GavelMark() {
  return (
    <svg className="gavelmark" viewBox="0 0 32 32" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13.5 6.5l8 8" />
        <path d="M10.6 9.4l5.7-5.7a1.6 1.6 0 0 1 2.3 0l4.7 4.7a1.6 1.6 0 0 1 0 2.3l-5.7 5.7a1.6 1.6 0 0 1-2.3 0l-4.7-4.7a1.6 1.6 0 0 1 0-2.3z" />
        <path d="M15.2 15.6L5.4 25.4" />
        <path d="M17 27h11" />
      </g>
    </svg>
  );
}

function Room({ code, me }: { code: string; me: Me }) {
  const room = useRoom(code, me);
  const core = room.snap.core;
  const [players, setPlayers] = useState(false);
  const [waited, setWaited] = useState(0);
  useHallSounds(core, room.snap.hist, room.myId);
  // remember every ad this phone sees, so the next night brings different cars
  const adKey = room.snap.lot?.adKey;
  const shown = !!core && ['preview', 'bidding', 'sealed', 'sold', 'unsold', 'approval'].includes(core.phase);
  useEffect(() => {
    if (adKey && shown) markSeen(adKey);
  }, [adKey, shown]);
  useWakeLock(!!core && !['lobby', 'results'].includes(core.phase));

  useEffect(() => {
    if (room.role === 'player' && store.get('mzk:sound', null) == null) sound.setPrefs({ voice: false, sfx: true });
  }, [room.role]);

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // phase on <html> — lets CSS (and tests) key off where the room is
  useEffect(() => {
    document.documentElement.dataset.phase = core?.phase ?? 'connecting';
    document.documentElement.dataset.lot = String(core?.lotNo ?? 0);
    return () => {
      delete document.documentElement.dataset.phase;
      delete document.documentElement.dataset.lot;
    };
  }, [core?.phase, core?.lotNo]);

  useEffect(() => {
    if (core) return;
    const iv = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(iv);
  }, [core]);

  if (!core) {
    return (
      <main className="shell narrow">
        <div className="center-screen">
          <div className="stack" style={{ justifyItems: 'center', gap: 16 }}>
            <div className="spinner" />
            <div className="t-display" style={{ fontSize: 30 }}>ندوّر على الصالة</div>
            <div className="code" style={{ fontSize: 40 }}>{code}</div>
            <p className="mute" style={{ margin: 0, maxWidth: 34 + 'ch' }}>
              {!room.net.connected
                ? 'نتصل بالمزاد…'
                : waited > 8
                  ? 'متصلين بس المضيف ما فتح الصالة للحين. تأكد من الكود أو خلّ المضيف يفتح الصفحة.'
                  : 'متصلين، ننتظر المضيف…'}
            </p>
            <button className="btn btn-quiet" onClick={() => go('/')}>رجوع</button>
          </div>
        </div>
      </main>
    );
  }

  const stale = room.role === 'player' && room.net.lastHeard > 0 && Date.now() - room.net.lastHeard > 9000;
  const hostGone = room.role === 'player' && (room.net.hostGone || stale);

  let body: React.ReactNode;
  switch (core.phase) {
    case 'lobby':
      body = <Lobby room={room} />;
      break;
    case 'intro':
      body = <Intro room={room} />;
      break;
    case 'showcase':
      body = <Showcase room={room} />;
      break;
    case 'voting':
      body = <Voting room={room} />;
      break;
    case 'results':
      body = <Results room={room} />;
      break;
    default:
      body = <Auction room={room} />;
  }

  return (
    <>
      <TopBar room={room} onPlayers={() => setPlayers(true)} />
      {hostGone && (
        <div className="shell" style={{ paddingBottom: 0 }}>
          <div className="banner">
            <span className="netdot off" />
            <span>المضيف انقطع اتصاله، ننتظره يرجع. لا تسكّر الصفحة.</span>
          </div>
        </div>
      )}
      {!room.net.connected && room.role === 'host' && (
        <div className="shell" style={{ paddingBottom: 0 }}>
          <div className="banner">
            <span className="netdot off" />
            <span>الاتصال بالمزاد مقطوع، نحاول نرجع…</span>
          </div>
        </div>
      )}
      {body}
      {players && <Standings room={room} onClose={() => setPlayers(false)} />}
      <Toasts items={room.toasts} />
    </>
  );
}
