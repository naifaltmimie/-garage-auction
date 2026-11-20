import { markSeen } from '../../lib/seen';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Core, Hist } from '../../engine/types';
import { NAME_MAX } from '../../engine/rules';
import { HAPTIC, buzz, setFx } from '../../lib/fx';
import { isCode, money, normalizeCode, store } from '../../lib/util';
import { go, goHome, useBack } from '../App';
import { Icon, Toasts } from '../components/Bits';
import { TireLoader } from '../components/TireLoader';
import { LOGO, LogoMark } from '../components/Logo';
import { HowToLines } from '../components/kit/HowToLines';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { joinAs, meFor, useRoom, type Me, type RoomView } from '../useRoom';
import { Auction } from './Auction';
import { Intro } from './Intro';
import { Lobby } from './Lobby';
import { Results } from './Results';
import { Showcase } from './Showcase';
import { Standings } from './Standings';
import { Voting } from './Voting';
import { useFx } from '../components/Reactions';
import { RoomMenu, RoomStatus, ShellSheet, type MenuStep } from '../components/RoomMenu';

/** The code on the lobby's white paper slip (the same piece and classes as the lobby's invitation), with a line under it. */
function CodeSlip({ code, line }: { code: string; line: string }) {
  return (
    <div className="lby-paper shl-slip">
      <div className="lby-paper-code">
        <span className="lby-paper-k">كود الصالة</span>
        <span className="code ltr">{code}</span>
        <span className="lby-paper-k">{line}</span>
      </div>
    </div>
  );
}

/** The small logo at the head of the join and wait screens, untouched. */
function JoinLogo() {
  return <img className="shl-logo" src={LOGO.stack} width={112} height={98} alt="مزاد الكراج" draggable={false} />;
}

/**
 * Join by link: a friend scanned the code and lands here. The code on its slip, his name, and «ادخل الصالة» in a
 * sticky bar in thumb reach; under the field, the game in three lines so a newcomer knows what he walked into.
 */
export function RoomGate({ code }: { code: string }) {
  const [me, setMe] = useState<Me | null>(() => meFor(code));
  const [remembered] = useState(() => store.get('mzk:name', ''));
  const [name, setName] = useState(remembered);
  const [tried, setTried] = useState(false);
  if (me) return <Room code={code} me={me} />;
  const bad = name.trim().length < 2;
  return (
    <main className="shell narrow shl-join">
      <form
        className="shl-join-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTried(true);
          if (bad) return;
          sound.unlock();
          setMe(joinAs(code, name.trim()));
        }}
      >
        <h1 className="shl-join-h">
          <JoinLogo />
        </h1>
        <CodeSlip code={code} line="انعزمت على هالمزاد" />
        <label className="lby-name shl-name">
          <span className="lby-label">اسمك</span>
          <input
            className="lby-input"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلًا: سعود"
            autoComplete="nickname"
            autoCapitalize="words"
            enterKeyHint="go"
            autoFocus={!remembered}
            aria-invalid={tried && bad}
            aria-describedby="shl-name-err"
          />
          <small id="shl-name-err" className="lby-err" role="alert">
            {tried && bad ? 'اكتب اسمك أول، حرفين على الأقل' : ''}
          </small>
        </label>
        <section className="shl-how" aria-labelledby="shl-how-h">
          <h2 className="shl-h" id="shl-how-h">
            اللعبة
          </h2>
          <HowToLines />
        </section>
        <button type="button" className="shl-chalk shl-home" onClick={goHome}>
          رجوع للرئيسية
        </button>
        <div className="lby-bar">
          <div className="lby-bar-in">
            <button type="submit" className="btn btn-primary btn-block lby-go">
              ادخل الصالة
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

/**
 * The wait before the room's first state arrives. Connecting: the tyre and one honest line. After 8 seconds
 * connected with no room (S2-10): the code was wrong or the room is closed; the player fixes the code right here or
 * keeps waiting. The room keeps listening the whole time: if it opens, the phone walks in.
 */
function RoomWait({ room, code, me }: { room: RoomView; code: string; me: Me }) {
  const hosting = room.role === 'host';
  const [waited, setWaited] = useState(0);
  const [patience, setPatience] = useState(8);
  const [fix, setFix] = useState(false);
  const [draft, setDraft] = useState(code);
  const [err, setErr] = useState('');
  useEffect(() => {
    const iv = setInterval(() => setWaited((w) => w + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  // once the phone has said «ما لقينا», it keeps saying it while the line blinks; «انتظر شوي» gives it 8 more seconds
  const [said, setSaid] = useState(false);
  const due = !hosting && room.net.connected && waited >= patience;
  useEffect(() => {
    if (due) setSaid(true);
  }, [due]);
  const lost = due || said;
  if (!lost) {
    // the host's phone only opens the line once the night's market has loaded, so that's its wait
    const line = hosting
      ? 'نجهّز سوق الليلة ونصفّ السيارات…'
      : !room.net.connected
        ? waited >= 8
          ? 'النت ثقيل، للحين نحاول نتصل…'
          : 'نتصل بالمزاد…'
        : 'وصلنا، ننتظر رد الدلال…';
    return (
      <main className="shell narrow shl-wait">
        <h1 className="shl-join-h">
          <JoinLogo />
        </h1>
        <CodeSlip code={code} line={hosting ? 'نفتح الصالة' : 'ندوّر على الصالة'} />
        <TireLoader label={line} size={72} className="shl-loader" />
        <button type="button" className="shl-chalk shl-home" onClick={goHome}>
          رجوع للرئيسية
        </button>
      </main>
    );
  }
  const clean = normalizeCode(draft);
  return (
    <main className="shell narrow shl-wait shl-lost">
      <ScreenTitle caption="تأكد من الكود عند اللي فتح الصالة، أو انتظر لين يفتحها.">ما لقينا صالة بهالكود</ScreenTitle>
      {fix ? (
        <form
          id="shl-fix"
          className="shl-fix"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!isCode(clean)) {
              setErr(clean.length === 0 ? 'اكتب كود الصالة، ست خانات' : `الكود ست خانات، كتبت ${clean.length}`);
              return;
            }
            if (clean === code) {
              setFix(false);
              setSaid(false);
              setPatience(waited + 8);
              return;
            }
            joinAs(clean, me.name);
            go(`/r/${clean}`);
          }}
        >
          <label className="lby-name">
            <span className="lby-label">كود الصالة</span>
            <input
              className="lby-input shl-code-input"
              value={clean}
              autoFocus
              dir="ltr"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              maxLength={6}
              aria-invalid={!!err}
              aria-describedby="shl-fix-err"
              onChange={(e) => {
                setDraft(e.target.value);
                if (err) setErr('');
              }}
            />
            <small id="shl-fix-err" className="lby-err" role="alert">
              {err}
            </small>
          </label>
        </form>
      ) : (
        <CodeSlip code={code} line="ما فيه صالة مفتوحة على هالكود" />
      )}
      <p className="shl-lost-line" role="status">
        بننتظر معك، وإذا انفتحت الصالة تدخلها على طول.
      </p>
      <div className="lby-bar">
        <div className="lby-bar-in">
          {fix ? (
            // a fresh element (key): the tap that opened the editor must not land on a submit button
            <button key="go" type="submit" form="shl-fix" className="btn btn-primary btn-block lby-go">
              ادخل الصالة
            </button>
          ) : (
            <button key="fix" type="button" className="btn btn-primary btn-block lby-go" onClick={() => setFix(true)}>
              عدّل الكود
            </button>
          )}
          <button
            type="button"
            className="btn btn-quiet btn-block shl-close"
            onClick={() => {
              setFix(false);
              setErr('');
              setDraft(code);
              setSaid(false);
              setPatience(waited + 8);
            }}
          >
            انتظر شوي
          </button>
        </div>
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

/** The sound switch's state, live. */
function useSoundPrefs() {
  const [prefs, setPrefs] = useState(sound.prefs);
  useEffect(() => {
    const f = () => setPrefs({ ...sound.prefs });
    sound.listeners.add(f);
    return () => void sound.listeners.delete(f);
  }, []);
  return prefs;
}

/**
 * The top bar: one 56px bar, the same in every phase. Start: the menu. Centre: the logo outside the lots (not a
 * button), during them the car counter on a paper sticker and the player's wallet. End: players, vibration and
 * reactions, sound; each a 44px icon button whose off state is a slash through the icon in the mute tone.
 * At 340px and under the counter drops its «/10» first (the hairline under the bar still shows the night's
 * progress), then the wallet's amount steps down a size; nothing wraps or truncates at 320 with a 7-digit wallet.
 */
function TopBar({ room, onPlayers, onMenu }: { room: RoomView; onPlayers: () => void; onMenu: (s: MenuStep) => void }) {
  const core = room.snap.core!;
  const me = core.players.find((p) => p.id === room.myId);
  const prefs = useSoundPrefs();
  const fx = useFx();
  const inGame = !['lobby', 'results', 'showcase', 'voting'].includes(core.phase);
  const lots = inGame && core.lotNo > 0;
  const progress = core.lotsTotal > 0 ? Math.min(1, Math.max(0, core.lotNo / core.lotsTotal)) : 0;
  return (
    <header className="shl-bar">
      <button type="button" className="shl-ib" aria-label="قائمة الصالة" aria-haspopup="dialog" onClick={() => onMenu('menu')}>
        <Icon name="list" size={22} />
      </button>
      <div className="shl-mid">
        {!lots ? (
          <img className="shl-bar-logo" src={LOGO.row} width={108} height={36} alt="مزاد الكراج" draggable={false} />
        ) : (
          <>
            <span className="shl-lot ltr" role="img" aria-label={`السيارة ${core.lotNo} من ${core.lotsTotal}`}>
              <b>{String(core.lotNo).padStart(2, '0')}</b>
              <span className="shl-lot-of">/{core.lotsTotal}</span>
            </span>
            {me && !me.spectator ? (
              <span className="shl-wallet" role="img" aria-label={`رصيدك ${money(me.cash)} ريال، الكراج ${me.garage.length} من ${core.settings.garage}`}>
                <span className="shl-wallet-k">
                  رصيدك
                  <span className="shl-wallet-g ltr">
                    {me.garage.length}/{core.settings.garage}
                  </span>
                </span>
                <b className="shl-wallet-n ltr">{money(me.cash)}</b>
              </span>
            ) : (
              <span className="shl-spec">تتفرج</span>
            )}
          </>
        )}
      </div>
      <div className="shl-end">
        <button type="button" className="shl-ib" aria-label={room.host ? 'اللاعبين والكراجات' : 'الكراجات والترتيب'} aria-haspopup="dialog" onClick={onPlayers}>
          <Icon name="users" size={22} />
        </button>
        <button
          type="button"
          className={`shl-ib${fx ? '' : ' is-off'}`}
          aria-pressed={fx}
          aria-label="الاهتزاز والتعليقات"
          title={fx ? 'الاهتزاز والتعليقات شغّالة' : 'الاهتزاز والتعليقات طافية'}
          onClick={() => {
            setFx(!fx);
            if (!fx) buzz(HAPTIC.send);
          }}
        >
          <Icon name="vibrate" size={22} />
          <i className="shl-slash" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`shl-ib${prefs.voice ? '' : ' is-off'}`}
          aria-pressed={prefs.voice}
          aria-label="صوت الدلال"
          title={prefs.voice ? 'صوت الدلال شغّال' : 'صوت الدلال طافي'}
          onClick={() => {
            sound.unlock();
            sound.setPrefs({ voice: !prefs.voice, sfx: true });
          }}
        >
          <Icon name={prefs.voice ? 'sound' : 'mute'} size={22} />
        </button>
      </div>
      {inGame && <i className="shl-progress" style={{ ['--p' as string]: progress }} aria-hidden="true" />}
    </header>
  );
}

/**
 * The bar and the status strip under it, stuck to the top together. Their height is written to `--top-total` while
 * the room is open, so everything that sits under the bar (the car sheet's sticky tabs, toasts) sits under the strip.
 */
function RoomHead({ room, onPlayers, onMenu }: { room: RoomView; onPlayers: () => void; onMenu: (s: MenuStep) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--top-total', `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--top-total');
    };
  }, []);
  return (
    <div ref={ref} className="shl-head">
      <TopBar room={room} onPlayers={onPlayers} onMenu={onMenu} />
      <RoomStatus room={room} />
    </div>
  );
}

/** A friend who walks in after the auction started (S2-14): told once, on his first look at the room, why he
 *  watches and until when. A player the host moved to the stands later is not told this. */
function useLateSheet(room: RoomView, code: string) {
  const core = room.snap.core;
  const decided = useRef(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!core || decided.current) return;
    const me = core.players.find((p) => p.id === room.myId);
    if (!me) return;
    decided.current = true;
    const key = `mzk:late:${code}`;
    if (me?.spectator && core.phase !== 'lobby' && !store.get(key, false)) {
      store.set(key, true);
      setShow(true);
    }
  }, [core, room.myId, code]);
  return [show, () => setShow(false)] as const;
}

function LateSheet({ onClose }: { onClose: () => void }) {
  useBack(true, onClose);
  return (
    <ShellSheet
      label="دخلت متفرج"
      onClose={onClose}
      foot={
        <button type="button" className="btn btn-primary btn-block shl-go" onClick={onClose}>
          تمام
        </button>
      }
    >
      <ScreenTitle as="h2" caption="المزاد بدأ قبل لا تدخل. تتفرج الحين، وتدخل اللعب بالمزاد الجاي إذا الدلال بدأ مزاد ثاني بنفس الشباب.">
        دخلت متفرج
      </ScreenTitle>
      <p className="shl-sheet-note">تقدر تعلّق وتشوف الكراجات، والدلال يقدر يدخّلك من قائمة اللاعبين.</p>
    </ShellSheet>
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

  const [late, closeLate] = useLateSheet(room, code);

  if (!core) return <RoomWait room={room} code={code} me={me} />;

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
      <RoomHead room={room} onPlayers={() => setPlayers(true)} onMenu={setMenu} />
      {body}
      {players && <Standings room={room} onClose={() => setPlayers(false)} />}
      {menu && <RoomMenu room={room} start={menu} onClose={() => setMenu(null)} onPlayers={() => setPlayers(true)} />}
      {late && !players && !menu && <LateSheet onClose={closeLate} />}
      <Toasts items={room.toasts} />
    </>
  );
}
