import { markSeen } from '../../lib/seen';
import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Core, Hist } from '../../engine/types';
import { money, store } from '../../lib/util';
import { go, goHome, useBack } from '../App';
import { Icon, Toasts } from '../components/Bits';
import { TireLoader } from '../components/TireLoader';
import { BrandLogo, LOGO, LogoMark } from '../components/Logo';
import { joinAs, meFor, useRoom, type Me, type RoomView } from '../useRoom';
import { Auction } from './Auction';
import { Intro } from './Intro';
import { CodePlate, Lobby } from './Lobby';
import { TvLink } from './Tv';
import { Results } from './Results';
import { Showcase } from './Showcase';
import { Standings } from './Standings';
import { Voting } from './Voting';
import { FxToggle } from '../components/Reactions';
import { RoomMenu, RoomStatus, type MenuStep } from '../components/RoomMenu';

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
          <img className="join-logo" src={LOGO.stack} width={220} height={193} alt="مزاد الكراج" draggable={false} />
          <CodePlate code={code} />
          <p className="mute join-line">انعزمت على المزاد. اكتب اسمك وادخل الصالة.</p>
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

function TopBar({ room, onPlayers, onMenu }: { room: RoomView; onPlayers: () => void; onMenu: (s: MenuStep) => void }) {
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
  const live = core.phase === 'bidding' || core.phase === 'sealed' || core.phase === 'dutch';
  const progress = core.lotsTotal > 0 ? Math.min(1, Math.max(0, core.lotNo / core.lotsTotal)) : 0;
  return (
    <header className={`topbar ${inGame ? 'ingame' : ''}`}>
      <button className="iconbtn tb-btn tb-menu" aria-label="القائمة والخروج" aria-haspopup="dialog" onClick={() => onMenu('menu')}>
        <Icon name="list" />
      </button>
      {!inGame && (
        <button className="brand" onClick={() => onMenu('leave')} aria-label="الرئيسية">
          <BrandLogo />
        </button>
      )}
      {inGame && core.lotNo > 0 && (
        <div className={`tb-lot ${live ? 'is-live' : ''}`} aria-label={`اللوت ${core.lotNo} من ${core.lotsTotal}`}>
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
        <div
          className={`wallet ${me.cash < core.settings.budget * 0.15 ? 'low' : ''}`}
          aria-label={`رصيدك ${money(me.cash)} ريال، الكراج ${me.garage.length} من ${core.settings.garage}`}
        >
          <div className="w-top">
            <small>رصيدك</small>
            <span className="wg">
              <Icon name="car" size={13} />
              <span className="ltr">{me.garage.length}/{core.settings.garage}</span>
            </span>
          </div>
          <b className="ltr">{money(me.cash)}</b>
          {/* a fuel gauge: what's left of the night's budget */}
          <i className="w-gauge" aria-hidden="true">
            <i style={{ ['--f' as string]: Math.min(1, Math.max(0, me.cash / Math.max(1, core.settings.budget))) }} />
          </i>
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
      <FxToggle />
      <button className="iconbtn tb-btn" aria-label="الكراجات والترتيب" onClick={onPlayers}>
        <Icon name="users" />
      </button>
      {inGame && <i className="tb-progress" style={{ ['--p' as string]: progress }} aria-hidden="true" />}
    </header>
  );
}

/** The price tag on its own (kept under its old name for any caller that still uses it). */
export function GavelMark() {
  return <LogoMark className="gavelmark" size={24} />;
}

function Room({ code, me }: { code: string; me: Me }) {
  const room = useRoom(code, me);
  const core = room.snap.core;
  const [players, setPlayers] = useState(false);
  const [menu, setMenu] = useState<MenuStep | null>(null);
  const [waited, setWaited] = useState(0);
  useHallSounds(core, room.snap.hist, room.myId);
  // back gesture with nothing of ours open: close whatever sheet another screen has up, else ask first
  const hasCore = useRef(false);
  hasCore.current = !!core;
  const tried = useRef<WeakSet<Element>>(new WeakSet());
  useBack(true, () => {
    if (!hasCore.current) return goHome();
    const backs = document.querySelectorAll<HTMLElement>('.drawer-back');
    if (backs.length) return backs[backs.length - 1].click();
    const dlg = document.querySelector('[role="dialog"], [aria-modal="true"]');
    if (dlg && !tried.current.has(dlg)) {
      tried.current.add(dlg);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    setMenu('leave');
  });
  // a new screen starts at the top; phases inside the auction keep their scroll
  const screen = !core ? 'wait' : ['lobby', 'intro', 'showcase', 'voting', 'results'].includes(core.phase) ? core.phase : 'auction';
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [screen]);
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
    const hosting = room.role === 'host';
    const slow = waited > 8;
    // the host's phone only opens the line once the night's market has loaded, so that's its wait
    const line = hosting
      ? 'نجهّز سوق الليلة ونصفّ السيارات…'
      : !room.net.connected
        ? 'نتصل بالمزاد…'
        : slow
          ? 'متصلين، بس المضيف ما فتح الصالة للحين'
          : 'لقينا الخط، ننتظر المضيف يرد…';
    return (
      <main className="shell narrow">
        <div className="center-screen ws-center">
          <div className="wait-screen">
            <div className="t-display ws-title">{hosting ? 'نفتح الصالة' : 'ندوّر على الصالة'}</div>
            <CodePlate code={code} />
            <TireLoader label={line} size={76} className="ws-loader" />
            {!hosting && slow && <p className="ws-help">تأكد من الكود، أو خلّ المضيف يفتح الصفحة عنده.</p>}
            <button className="btn btn-quiet" onClick={goHome}>رجوع</button>
          </div>
        </div>
      </main>
    );
  }

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
      <TopBar room={room} onPlayers={() => setPlayers(true)} onMenu={setMenu} />
      <RoomStatus room={room} />
      {body}
      {['showcase', 'voting', 'results'].includes(core.phase) && <TvLink code={code} />}
      {players && <Standings room={room} onClose={() => setPlayers(false)} />}
      {menu && <RoomMenu room={room} start={menu} onClose={() => setMenu(null)} onPlayers={() => setPlayers(true)} />}
      <Toasts items={room.toasts} />
    </>
  );
}
