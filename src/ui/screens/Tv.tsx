// «شاشة العرض»: the big screen of the hall. One TV or laptop shows the auction to the room while everyone bids
// from their phones. It is read-only (see net/viewer.ts): it renders the host's snapshots and never joins, so it
// never counts as a player. It is a display, not a control: no buttons, no hover; the cursor hides when still.
// Every size is in viewport units (tv.css, `--u` is one hundredth of a 16:9 height); the kit's paper objects,
// drawn in px, are scaled with `zoom` by `--k` (the screen's height over 1080).
import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { dutchElapsed, dutchPriceAt, dutchProgress } from '../../engine/dutch';
import { damageLine } from '../../engine/lotgen';
import { marketOf } from '../../engine/markets';
import { reactBus, REACT_BY_KEY } from '../../engine/reactions';
import { gradeWord } from '../../engine/realism';
import { lotsFor } from '../../engine/rules';
import type { CarPub, Core, Hist, LotPub, Phase, PlayerPub, Sale } from '../../engine/types';
import { bidsN, carsN, isCode, money, normalizeCode, signed } from '../../lib/util';
import type { Snapshot } from '../../net/room';
import { ViewerRoom, type ViewerStatus } from '../../net/viewer';
import '../../styles/tv.css';
import { saleShown, useSaleStage, verdictSaid, type SaleStage } from '../saleStage';
import { timeLeft, useNow } from '../useRoom';
import { computeAwards } from '../components/Awards';
import { Delta } from '../components/Garage';
import { Icon, QR } from '../components/Bits';
import { Board as DutchBoard, useClockValue } from '../components/DutchConsole';
import { HowToLines } from '../components/kit/HowToLines';
import { Pairs, type Pair } from '../components/kit/Pairs';
import { PriceTag } from '../components/kit/PriceTag';
import { RollNumber } from '../components/kit/RollNumber';
import { Rows } from '../components/kit/Rows';
import { Stamp } from '../components/kit/Stamp';
import { Sticker } from '../components/kit/Sticker';
import { Photo } from '../components/Gallery';
import { bodyAr, specLine } from '../components/LotSheet';
import { Wordmark } from '../components/Logo';
import { CarPlate, Paddle } from '../components/Plate';
import { Silhouette } from '../components/Silhouette';
import { TireLoader } from '../components/TireLoader';
import { Wheel } from '../components/Wheel';

const W = 1920;
const H = 1080;

/** The state of the auction, one phrase in the top band. */
const PHASE: Record<Phase, string> = {
  lobby: 'الصالة مفتوحة',
  intro: 'المزاد بيبدأ',
  preview: 'المعاينة',
  bidding: 'المزاد مفتوح',
  sealed: 'الظرف المختوم',
  approval: 'صاحبها يفكّر',
  dutch: 'المزاد الهولندي',
  // the outcome is the stamp's to say: the band says «بيعت» only once it falls (SoldPhrase)
  sold: 'الحسم',
  unsold: 'ما بيعت',
  showcase: 'الكراجات',
  voting: 'التقييم السري',
  results: 'النتيجة',
};

/** The phones' sentences on how the gain is counted (audit S3-9): before the rating, and while it runs. */
const PROFIT_NOTE = 'الربح هنا من القيم اللي انكشفت بعد كل بيعة. التقييم السري يجي بالأخير.';
const VOTING_NOTE = 'الربح هنا من القيم اللي انكشفت بعد كل بيعة. التقييم السري يخلص بعد شوي.';

/** How the points are counted, as the phone's results say it, from the rating's weight. */
function pointsNote(w: number): string {
  return w === 0.5
    ? 'النقاط نص من تقييم الشباب ونص من الشطارة بالشراء'
    : `النقاط ${Math.round(w * 100)}% من تقييم الشباب و${Math.round((1 - w) * 100)}% من الشطارة بالشراء`;
}

/** The room link a phone opens (same as the lobby's). */
export function joinLink(code: string) {
  return `${location.origin}/#/r/${code}`;
}

/** `#/tv/CODE` → the room code, else null. */
export function tvCodeOf(hash: string): string | null {
  const m = /^#?\/?tv\/([A-Za-z0-9]{6})$/.exec(hash);
  if (!m) return null;
  const code = normalizeCode(m[1]);
  return isCode(code) ? code : null;
}

/** Opens the big screen for this room in its own tab / window. */
export function openTv(code: string) {
  const url = `${location.origin}${location.pathname}${location.search}#/tv/${code}`;
  // its own window rather than a tab: the host's page has to stay on screen, or the clock holds for everyone
  const w = window.open(url, `mzk-tv-${code}`, 'popup,width=1280,height=720');
  if (!w) window.open(url, '_blank');
}

/** Double-click or F / Enter puts the board in full screen (and back). */
function toggleFull() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  } catch {
    /* not allowed here */
  }
}

type Fixture = { snap: Snapshot; offset: number; status: ViewerStatus };
type TvWindow = Window & { __tvFix?: Fixture; __tvLast?: Fixture };

function useViewer(code: string) {
  // development only: a recorded snapshot can be replayed (QA screenshots), and the last one is kept to record
  const fix = import.meta.env.DEV ? (window as TvWindow).__tvFix : undefined;
  const [snap, setSnap] = useState<Snapshot>(fix?.snap ?? { core: null, lot: null, hist: null });
  const [offset, setOffset] = useState(fix?.offset ?? 0);
  const [status, setStatus] = useState<ViewerStatus>(fix?.status ?? { connected: false, hostGone: false, lastHeard: 0 });
  useEffect(() => {
    if (fix) return;
    let raf = 0;
    const room = new ViewerRoom(
      code,
      (s, off) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          setSnap(s);
          setOffset(off);
        });
      },
      setStatus,
    );
    void room.start();
    return () => {
      cancelAnimationFrame(raf);
      room.stop();
    };
  }, [code, fix]);
  useEffect(() => {
    if (import.meta.env.DEV) (window as TvWindow).__tvLast = { snap, offset, status };
  }, [snap, offset, status]);
  return { snap, offset, status };
}

/** The screen's height over 1080 (or its width over 1920 on a narrower screen): the zoom of the paper objects. */
const KCtx = createContext(1);
function useK() {
  const [k, setK] = useState(() => Math.min(innerWidth / W, innerHeight / H));
  useEffect(() => {
    const on = () => setK(Math.min(innerWidth / W, innerHeight / H));
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return k;
}

/** The pointer shows while it moves and hides after three seconds still. */
function useIdle(ms = 3000) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), ms);
    const on = () => {
      setIdle(false);
      clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), ms);
    };
    addEventListener('pointermove', on);
    return () => {
      clearTimeout(t);
      removeEventListener('pointermove', on);
    };
  }, [ms]);
  return idle;
}

const LOT_PHASES: ReadonlySet<Phase> = new Set<Phase>(['preview', 'bidding', 'sealed', 'approval', 'dutch', 'sold', 'unsold']);

export function Tv({ code }: { code: string }) {
  const { snap, offset, status } = useViewer(code);
  const k = useK();
  const idle = useIdle();
  const core = snap.core;

  useEffect(() => {
    const prev = document.title;
    document.title = `شاشة العرض · ${code}`;
    document.documentElement.classList.add('tv-mode');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F' || e.key === 'Enter') toggleFull();
    };
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      document.title = prev;
      document.documentElement.classList.remove('tv-mode');
    };
  }, [code]);

  let body: ReactNode;
  if (!core) body = <Waiting status={status} />;
  else if (core.phase === 'lobby') body = <LobbyBoard core={core} code={code} />;
  else if (core.phase === 'intro') body = <IntroBoard core={core} offset={offset} />;
  else if (core.phase === 'showcase') body = <ShowcaseBoard core={core} hist={snap.hist} />;
  else if (core.phase === 'voting') body = <StandingsBoard core={core} hist={snap.hist} />;
  else if (core.phase === 'results') body = <ResultsBoard core={core} hist={snap.hist} />;
  else body = <LotBoard core={core} lot={snap.lot} hist={snap.hist} offset={offset} />;

  // one strip under the top band: the connection first, then the pause
  const strip = core
    ? !status.connected
      ? 'نحاول نرجع الاتصال'
      : status.hostGone
        ? 'الدلال طلع من الصالة'
        : core.paused
          ? core.away
            ? 'المزاد واقف مؤقت، جوال الدلال طلع من الصفحة'
            : 'المزاد واقف مؤقت'
          : null
    : null;

  return (
    <KCtx.Provider value={k}>
      <div
        className={`tv${idle ? ' tv-idle' : ''}${strip ? ' tv-has-strip' : ''}`}
        dir="rtl"
        onDoubleClick={toggleFull}
        style={{ ['--k' as string]: k } as CSSProperties}
      >
        <TopBand core={core} code={code} sale={core && snap.lot ? (snap.hist?.sales.find((x) => x.lotId === snap.lot!.id) ?? null) : null} offset={offset} />
        {strip && (
          <p className="tv-strip" role="status">
            {strip}
          </p>
        )}
        <div className="tv-body" data-phase={core?.phase ?? 'wait'}>
          {body}
        </div>
      </div>
    </KCtx.Provider>
  );
}

// ============================================================================ the top band

/** On a sale the band says «الحسم» until the stamp falls, then «بيعت» (never before the phones show it). */
function SoldPhrase({ core, sale, offset }: { core: Core; sale: Sale; offset: number }) {
  const stage = useSaleStage(core, sale, offset);
  return <>{stage >= 0 && sale.outcome === 'sold' ? 'بيعت' : sale.outcome === 'sold' ? 'الحسم' : 'ما بيعت'}</>;
}

function TopBand({ core, code, sale, offset }: { core: Core | null; code: string; sale: Sale | null; offset: number }) {
  return (
    <header className="tv-band">
      <Wordmark size={34} layout="row" className="tv-band-logo" />
      <span className="tv-band-room">{core?.settings.roomName || 'مزاد الكراج'}</span>
      {core && (
        <span key={core.phase} className="tv-band-state">
          {core.phase === 'sold' && sale ? <SoldPhrase core={core} sale={sale} offset={offset} /> : PHASE[core.phase]}
        </span>
      )}
      <span className="tv-band-join">
        <span className="tv-band-join-k">ادخل من جوالك:</span>
        <span className="tv-band-host ltr">{location.host}</span>
        <span className="tv-band-code ltr">{code}</span>
      </span>
    </header>
  );
}

function Waiting({ status }: { status: ViewerStatus }) {
  const k = useContext(KCtx);
  return (
    <div className="tv-wait">
      <Wheel size={Math.round(260 * k)} spin="slow" />
      <p className="tv-wait-t">{status.connected ? 'ننتظر الدلال يفتح الصالة' : 'نتصل بالصالة'}</p>
      <p className="tv-wait-sub">شاشة العرض تتابع المزاد بس، ما تدخل كلاعب</p>
    </div>
  );
}

// ============================================================================ lobby

/** The night's terms, as the phone's conditions say them, in ruled rows. */
function terms(core: Core, bidders: number): { k: string; v: ReactNode; print?: boolean }[] {
  const s = core.settings;
  const speed = s.speed === 'fast' ? 'سريع' : s.speed === 'calm' ? 'هادي' : 'عادي';
  return [
    { k: 'السوق', v: marketOf(s.mix).label },
    { k: 'ميزانية كل لاعب', v: money(s.budget), print: true },
    { k: 'السيارات', v: String(core.lotsTotal || lotsFor(s, Math.max(2, bidders))), print: true },
    { k: 'الكراج يشيل', v: carsN(s.garage) },
    { k: 'السرعة', v: speed },
  ];
}

function LobbyBoard({ core, code }: { core: Core; code: string }) {
  const k = useContext(KCtx);
  const link = joinLink(code);
  const players = core.players.filter((p) => !p.spectator);
  const wide = players.length > 5;
  return (
    <div className="tv-lobby">
      <section className="tv-lobby-invite" aria-label="الدعوة">
        <div className="tv-slip">
          <div className="tv-slip-code">
            <span className="tv-slip-k">كود الصالة</span>
            <span className="tv-slip-n ltr">{code}</span>
            <span className="tv-slip-k">صوّر الباركود، أو افتح</span>
            <span className="tv-slip-host ltr">{location.host}</span>
            <span className="tv-slip-k">واكتب الكود</span>
          </div>
          <i className="tv-slip-cut" aria-hidden="true" />
          <QR text={link} size={480} />
        </div>
        <p className="tv-lobby-call">صوّر الباركود وادخل الصالة</p>
        <HowToLines className="tv-howto" />
      </section>
      <section className="tv-lobby-side">
        <h2 className="tv-h">
          المزايدين
          <span className="tv-h-n">
            <span className="ltr">{players.length}</span> من <span className="ltr">{core.settings.maxPlayers}</span>
          </span>
        </h2>
        {players.length ? (
          <ol className={`tv-roster${wide ? ' is-wide' : ''}`}>
            {players.map((p) => (
              <li key={p.id} className={`tv-roster-r${p.online ? '' : ' is-away'}`}>
                <Paddle n={p.paddle} />
                <span className="tv-roster-name">{p.name}</span>
                {p.host && <span className="tv-roster-role">الدلال</span>}
              </li>
            ))}
          </ol>
        ) : (
          <div className="tv-roster-empty">
            <Wheel size={Math.round(150 * k)} spin="slow" />
            <p>ننتظر الشباب يدخلون</p>
          </div>
        )}
        <Rows className="tv-terms" items={terms(core, players.length)} />
      </section>
    </div>
  );
}

// ============================================================================ intro

function IntroBoard({ core, offset }: { core: Core; offset: number }) {
  const players = core.players.filter((p) => !p.spectator);
  const now = useNow(offset, 8);
  const { ms } = timeLeft(core, now);
  const sec = core.timer ? Math.max(1, Math.ceil(ms / 1000)) : null;
  return (
    <div className="tv-intro">
      <h1 className="tv-intro-room">{core.settings.roomName || 'مزاد الكراج'}</h1>
      {sec !== null && (
        <span key={sec} className="tv-intro-n ltr" role="timer">
          {sec}
        </span>
      )}
      <p className="tv-intro-facts">
        {carsN(core.lotsTotal || lotsFor(core.settings, Math.max(2, players.length)))} · <span className="ltr">{players.length}</span> مزايدين · كل واحد معه{' '}
        <span className="ltr">{money(core.settings.budget)}</span>
      </p>
    </div>
  );
}

// ============================================================================ the lot on the block

function nameOf(core: Core, id: string | null | undefined) {
  if (!id) return '';
  return core.players.find((p) => p.id === id)?.name ?? '';
}

function LotBoard({ core, lot, hist, offset }: { core: Core; lot: LotPub | null; hist: Hist | null; offset: number }) {
  const sales = hist?.sales ?? [];
  const sale = lot ? (sales.find((s) => s.lotId === lot.id) ?? null) : null;
  if (!lot) {
    return (
      <div className="tv-next">
        <TireLoader size={120} label="السيارة الجاية في الطريق" />
      </div>
    );
  }
  if (core.phase === 'sold' && sale && sale.outcome === 'sold') return <Hammer core={core} sale={sale} offset={offset} />;
  if ((core.phase === 'sold' || core.phase === 'unsold') && sale) return <Unsold core={core} sale={sale} />;
  return (
    <div className="tv-lot" key={lot.id}>
      <section className="tv-car" aria-label="السيارة">
        <CarPhoto lot={lot} phase={core.phase} />
        <CarHead lot={lot} />
      </section>
      <section className="tv-board-col" aria-label="السوم">
        <Board core={core} lot={lot} offset={offset} />
      </section>
      <PlayerStrip core={core} />
    </div>
  );
}

/** The car's photo, the gallery advancing on its own; the cover on a covered car; the lot's sticker; the reactions. */
function CarPhoto({ lot, phase }: { lot: LotPub; phase: Phase }) {
  const car = lot.car;
  const covered = !car;
  // keyed by the URLs, not the object: a fresh snapshot of the same car must not restart the gallery
  const photoKey = (car?.photos?.length ? car.photos.slice(0, 6) : []).join('|');
  const photos = useMemo(() => (photoKey ? photoKey.split('|') : []), [photoKey]);
  const [dead, setDead] = useState<Set<string>>(new Set());
  const list = photos.filter((u) => !dead.has(u));
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    setDead(new Set());
  }, [photoKey]);
  const cycling = list.length > 1 && LOT_PHASES.has(phase);
  useEffect(() => {
    if (!cycling) return;
    const iv = setInterval(() => setI((x) => x + 1), 7000);
    return () => clearInterval(iv);
  }, [cycling, list.length]);
  const cur = list.length ? i % list.length : -1;
  return (
    <div className={`tv-photo${covered ? ' is-covered' : ''}`}>
      {covered ? (
        <div className="tv-cover">
          <div className="tv-cover-shape">
            <Silhouette body={lot.cover?.body ?? 'sedan'} mono />
          </div>
          <p className="tv-cover-t">تحت الغطا، تنكشف بعد البيع</p>
        </div>
      ) : list.length ? (
        list.map((u, n) =>
          // only the shown photo and the next one are mounted: the next one loads while this one is up
          n === cur || n === (cur + 1) % list.length ? (
            <Photo key={u} u={u} className={`tv-ph${n === cur ? ' is-on' : ''}`} eager={n === cur} onDead={() => setDead((s) => new Set(s).add(u))} />
          ) : null,
        )
      ) : (
        <div className="tv-studio">
          <Silhouette body={car.body} color={car.colorHex} />
        </div>
      )}
      <Sticker no={lot.no} className="tv-sticker" />
      <Reactions />
    </div>
  );
}

function gradeTone(g: number): 'good' | 'bad' | undefined {
  return g >= 4 ? 'good' : g < 2.5 ? 'bad' : undefined;
}

/** The six facts a buyer reads first, as the phone's car sheet shows them. */
function keyFacts(car: CarPub, lot: LotPub): Pair[] {
  const g = lot.grade;
  const dmg = damageLine(car);
  const approxKm = !!car.said && !car.said.includes('km');
  return [
    {
      k: 'الممشى',
      v: (
        <>
          <span className="tv-num ltr">{money(Math.round(car.km / 100) * 100)}</span> كم{approxKm ? ' تقريباً' : ''}
        </>
      ),
      tone: !approxKm && car.kmTag === 'low' ? 'good' : !approxKm && car.kmTag === 'high' ? 'bad' : undefined,
    },
    { k: 'المواصفات', v: car.spec, tone: car.specKind === 'us_salvage' ? 'bad' : undefined },
    {
      k: 'درجة الفحص',
      v:
        g == null ? (
          lot.mode === 'asis' ? 'على الحالة' : 'ما انفحصت'
        ) : (
          <>
            <span className="tv-num ltr">{g.toFixed(1)}</span> {gradeWord(g)}
          </>
        ),
      tone: g == null ? (lot.mode === 'asis' ? 'bad' : undefined) : gradeTone(g),
    },
    { k: 'الضرر', v: dmg, tone: dmg === 'بدون ضرر' ? 'good' : dmg.startsWith('صدمة') ? 'bad' : undefined },
    {
      k: 'اللون',
      v: (
        <>
          <span className="tv-swatch" style={{ background: car.colorHex }} aria-hidden="true" />
          {car.color}
        </>
      ),
    },
    { k: 'المدينة', v: car.city },
  ];
}

/** Under the photo: the model in Voice, the make, year and spec in one Text line, the plate, the six key facts. */
function CarHead({ lot }: { lot: LotPub }) {
  const k = useContext(KCtx);
  const car = lot.car;
  if (!car) {
    // a covered car says only what the phones say: its body and its years, never its name
    const c = lot.cover;
    return (
      <div className="tv-carhead">
        <div className="tv-carhead-top">
          <h2 className="tv-model">تحت الغطا</h2>
        </div>
        <p className="tv-spec">
          {c ? bodyAr(c.body) : 'سيارة'}
          {c && (
            <>
              {' · '}
              <span className="ltr">{c.yearFrom === c.yearTo ? c.yearFrom : `${c.yearFrom}–${c.yearTo}`}</span>
              {c.hints.slice(0, 3).map((h) => ` · ${h}`)}
            </>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="tv-carhead">
      <div className="tv-carhead-top">
        <h2 className="tv-model">
          {/* the model and its trim as one name in its own direction («812 Superfast», «G63 AMG») */}
          <bdi>
            {car.modelAr}
            {car.trimAr || car.trim ? <span className="tv-trim"> {car.trimAr || car.trim}</span> : null}
          </bdi>
        </h2>
        <span className="tv-plate-row">
          {/* a special plate's name and worth, at the board's size (the plate's own caption is a phone's size) */}
          {car.plate.special && (
            <span className="tv-plate-val">
              <span className="tv-plate-val-k">{car.plate.special.label}</span>
              <span className="tv-plate-val-n ltr">{money(car.plate.special.value)}</span>
            </span>
          )}
          <span className="tv-plate-at" style={{ zoom: 0.8 * k } as CSSProperties}>
            <CarPlate plate={car.plate} size="lg" />
          </span>
        </span>
      </div>
      <p className="tv-spec">
        <bdi>{car.makeAr}</bdi> · <span className="ltr">{car.year}</span> · {specLine(car)}
      </p>
      <Pairs className="tv-pairs" items={keyFacts(car, lot)} />
    </div>
  );
}

/** The دلال's call: what the host's phone says now, or what the moment is. */
function callOf(core: Core, lot: LotPub): string {
  if (core.callout?.text) return core.callout.text;
  if (core.phase === 'preview') return 'المعاينة، شوفوها زين قبل السوم';
  if (core.phase === 'sealed') return 'كل واحد يكتب سعره بالسر، وأعلى ظرف ياخذها';
  if (core.phase === 'dutch') return 'السعر ينزل، أول واحد يقول أبيها ياخذها';
  if (core.phase === 'approval') return 'صاحبها يفكّر';
  if (lot.kind === 'covered') return 'تحت الغطا، مين يغامر؟';
  return core.bid?.count ? 'مين يزيد؟' : 'مين يفتح السوم؟';
}

/** The board: the call, the tag, the clock, the estimate read low to high, the last three bids. */
function Board({ core, lot, offset }: { core: Core; lot: LotPub; offset: number }) {
  const k = useContext(KCtx);
  const bid = core.bid && core.bid.count > 0 ? core.bid : null;
  const leader = bid ? core.players.find((p) => p.id === bid.by) : undefined;
  const sealed = core.phase === 'sealed';
  const dutch = core.phase === 'dutch' && lot.dutch;
  const approval = core.phase === 'approval';
  const feed = sealed || dutch ? [] : [...core.log].reverse().slice(0, 3);

  let tag: ReactNode;
  if (sealed) tag = <Envelopes n={core.sealedCount} />;
  else if (dutch) tag = <DutchTag core={core} plan={lot.dutch!} offset={offset} estimate={core.settings.estimate ? lot.estimate : null} />;
  else
    tag = (
      <div className="tv-tag" style={{ zoom: 2.6 * k } as CSSProperties}>
        <PriceTag
          state={bid ? 'live' : 'open'}
          label={approval ? 'وقف السوم على' : undefined}
          amount={bid ? bid.amount : core.opening || lot.opening}
          who={leader ? { no: leader.paddle, name: leader.name } : null}
        />
      </div>
    );

  return (
    <div className={`tv-board is-${core.phase}`}>
      <p key={core.callout?.id ?? core.phase} className="tv-call" aria-live="polite">
        {callOf(core, lot)}
      </p>
      {tag}
      {!dutch && <div className="tv-board-low">
        <Clock core={core} offset={offset} />
        <div className="tv-board-facts">
          {lot.estimate && core.settings.estimate && !sealed && (
            <div className="tv-est">
              <span className="tv-est-k">التقدير</span>
              {/* low to high, left to right, as on the phones (audit S3-3) */}
              <span className="tv-est-v ltr">
                {money(lot.estimate[0])} – {money(lot.estimate[1])}
              </span>
            </div>
          )}
          {!!feed.length && (
            <ol className="tv-feed">
              {feed.map((l, i) => (
                <li key={l.id} className={i === 0 ? 'is-top' : undefined}>
                  <span className="tv-feed-who">{nameOf(core, l.by)}</span>
                  <span className="tv-feed-n ltr">{money(l.amount)}</span>
                </li>
              ))}
            </ol>
          )}
          {sealed && <p className="tv-board-note">الظروف ما تنفتح إلا بعد ما يخلص الوقت</p>}
          {approval && <p className="tv-board-note">ما وصل الحد. يا يقول على البركة، يا يفتح الله</p>}
        </div>
      </div>}
    </div>
  );
}

/** The clock as a ring with its seconds in Print; red only in the last five seconds of a live lot. */
function Clock({ core, offset }: { core: Core; offset: number }) {
  const now = useNow(offset, 10);
  if (!core.timer) return null;
  const t = timeLeft(core, now);
  const secs = Math.max(0, Math.ceil(t.ms / 1000));
  const live = core.phase === 'bidding' || core.phase === 'sealed';
  const hot = live && t.ms > 0 && t.ms <= 5000;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className={`tv-clock${hot ? ' is-hot' : ''}`} role="timer" aria-label={`${secs} ثانية`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="tv-clock-track" cx="50" cy="50" r={r} />
        <circle className="tv-clock-arc" cx="50" cy="50" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - t.pct)} />
      </svg>
      <span className="tv-clock-n">
        <span key={hot ? secs : 'n'} className="tv-clock-d ltr">
          {secs}
        </span>
        <span className="tv-clock-u">{core.phase === 'preview' ? 'للمعاينة' : core.phase === 'approval' ? 'لصاحبها' : 'ثانية'}</span>
      </span>
    </div>
  );
}

/** Sealed: the envelopes arriving, a count, never an amount. */
function Envelopes({ n }: { n: number }) {
  const shown = Math.min(n, 10);
  return (
    <div className="tv-env" aria-live="polite">
      <div className="tv-env-stack" aria-hidden="true">
        {Array.from({ length: shown }, (_, i) => (
          <i key={i} className="tv-env-e" style={{ ['--i' as string]: i } as CSSProperties} />
        ))}
        {!shown && <i className="tv-env-e is-ghost" />}
      </div>
      <p className="tv-env-t">
        <span className="tv-env-n ltr">{n}</span>
        <span className="tv-env-k">{n === 0 ? 'ولا ظرف وصل للحين' : n === 1 ? 'ظرف مختوم وصل' : n === 2 ? 'ظرفين مختومة وصلت' : 'ظروف مختومة وصلت'}</span>
      </p>
    </div>
  );
}

/** Dutch: the falling price on the tag, the rail from the start price down to the floor under it. */
function DutchTag({ core, plan, offset, estimate }: { core: Core; plan: NonNullable<LotPub['dutch']>; offset: number; estimate: [number, number] | null }) {
  const k = useContext(KCtx);
  const price = useClockValue(offset, 12, (now) => dutchPriceAt(plan, dutchElapsed(core.timer, timeLeft(core, now).ms)), [core.timer, core.paused, plan]);
  const prog = dutchProgress(plan, price);
  const onFloor = price <= plan.floor;
  // the phone's tension: chalk while it falls, red for the last steps and the floor
  const heat = onFloor || prog >= 0.9 ? 3 : prog >= 0.72 ? 2 : prog >= 0.45 ? 1 : 0;
  const pos = (v: number) => Math.max(0, Math.min(1, (plan.start - v) / Math.max(1, plan.start - plan.floor)));
  // the board is sized for the start price, so it never grows or shrinks while the price falls
  const digits = String(Math.round(plan.start)).length;
  return (
    // the phone's own board and rail (DutchConsole / s-console.css), scaled up whole: one price, one object
    <div className="cs--dutch tv-dutch" data-heat={heat}>
      <div className="cs-board tv-dboard" style={{ zoom: (digits >= 7 ? 2.3 : digits === 6 ? 2.65 : 2.9) * k } as CSSProperties}>
        <span className="tv-dboard-k">السعر الحين</span>
        <div className="cs-board-w">
          <DutchBoard value={price} />
          <span className="cs-board-u">ريال</span>
        </div>
      </div>
      <div className="cs-rail tv-drail" aria-hidden="true" style={{ zoom: 2.4 * k } as CSSProperties}>
        <div className="cs-track">
          {estimate && <span className="cs-band" style={{ insetInlineStart: `${pos(estimate[1]) * 100}%`, width: `${(pos(estimate[0]) - pos(estimate[1])) * 100}%` }} />}
          <span className="cs-fill" style={{ transform: `scaleX(${prog})`, transitionDuration: `${plan.every}ms` }} />
        </div>
        <div className="cs-ends">
          <span>
            بدأ <span className="ltr">{money(plan.start)}</span>
          </span>
          {estimate && (
            <span className="cs-ends-est">
              التقدير <span className="ltr">{money(estimate[0])}–{money(estimate[1])}</span>
            </span>
          )}
          <span>
            أقل سعر <span className="ltr">{money(plan.floor)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Every bidder as one cell of a ruled strip: paddle, name, what he has left, his garage. The leader is in alloy. */
function PlayerStrip({ core }: { core: Core }) {
  const players = core.players.filter((p) => !p.spectator);
  const lead = core.bid && core.bid.count > 0 && (core.phase === 'bidding' || core.phase === 'approval') ? core.bid.by : null;
  const two = players.length > 6;
  return (
    <ol className={`tv-pstrip${two ? ' is-two' : ''}`} style={{ ['--n' as string]: two ? Math.ceil(players.length / 2) : Math.max(players.length, 4) } as CSSProperties}>
      {players.map((p) => (
        <li key={p.id} className={`tv-pcell${p.id === lead ? ' is-lead' : ''}${p.online ? '' : ' is-away'}`}>
          <Paddle n={p.paddle} />
          <span className="tv-pcell-name">{p.name}</span>
          <span className="tv-pcell-cash ltr">{money(p.cash)}</span>
          <span className="tv-pcell-cars" aria-label={`${p.garage.length} من ${core.settings.garage} سيارات`}>
            <Icon name="car" size={20} className="tv-pcell-car" />
            <span className="ltr">
              {p.garage.length}/{core.settings.garage}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

// ============================================================================ reactions

/** How many glyphs a reaction shows (a pair, like the heart with its arrow, is drawn smaller to fit its slot). */
function graphemes(t: string): number {
  try {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t)].length;
  } catch {
    return 1;
  }
}

interface Floater {
  id: string;
  label: string;
  name: string;
  /** the slot's inline-start offset and width in the lane (px) */
  at: number;
  w: number;
  dur: number;
  /** how far it rises (px) and how long it waits before rising (ms) */
  rise: number;
  wait: number;
}

/** The six reactions floating up over the car (never over the price), large, with who sent them.
 *  Positions are dealt, never drawn at random: the photo is cut into slots wide enough for an emoji and a name, the
 *  far slots from the lot sticker come first, and each new reaction takes the next free slot in turn (with a small
 *  jitter inside it). A slot under the sticker rises only to just below it. When every slot is in flight, the slot
 *  that took off first is reused, and the new one waits until the old one has climbed clear of it. */
function Reactions() {
  const [items, setItems] = useState<Floater[]>([]);
  const timers = useRef(new Set<number>());
  const lane = useRef<HTMLDivElement>(null);
  // per slot: when its last reaction took off (ms, wall clock) and how long that one flies
  const slots = useRef<{ start: number; dur: number; wait: number; rise: number }[]>([]);
  const turn = useRef(0);
  useEffect(() => {
    const off = reactBus.on((ev) => {
      const r = REACT_BY_KEY.get(ev.k);
      const el = lane.current;
      if (!r || !el) return;
      const W = el.clientWidth;
      const H = el.clientHeight;
      const u = Math.min(innerHeight / 100, innerWidth / 177.78);
      const n = Math.max(2, Math.min(6, Math.floor(W / (u * 16))));
      const sw = W / n;
      if (slots.current.length !== n) slots.current = Array.from({ length: n }, () => ({ start: 0, dur: 0, wait: 0, rise: 0 }));
      // the sticker's reach from the lane's inline-start edge, and its bottom
      const lr = el.getBoundingClientRect();
      const st = el.parentElement?.querySelector('.tv-sticker')?.getBoundingClientRect();
      const stReach = st ? lr.right - st.left + u : 0;
      const stBottom = st ? st.bottom - lr.top + u : 0;
      // dealing order: from the far end (away from the sticker) back toward it
      const order = Array.from({ length: n }, (_, i) => n - 1 - i);
      const now = Date.now();
      let pick = -1;
      for (let k = 0; k < n; k++) {
        const i = order[(turn.current + k) % n];
        const sl = slots.current[i];
        if (now > sl.start + sl.wait + sl.dur) {
          pick = i;
          turn.current = (turn.current + k + 1) % n;
          break;
        }
      }
      let wait = 0;
      if (pick < 0) {
        // all in flight: reuse the one that took off first, once it has climbed a whole emoji and name (16u) above
        // where the new one starts; on a short photo that is when the old one has gone
        pick = slots.current.reduce((m, sl, i, a) => (sl.start + sl.wait < a[m].start + a[m].wait ? i : m), 0);
        const sl = slots.current[pick];
        const p = Math.min(1, 0.12 + (0.88 * u * 16) / Math.max(1, sl.rise));
        wait = Math.max(0, sl.start + sl.wait + sl.dur * p - now);
      }
      const dur = 3400 + Math.random() * 500;
      const at = pick * sw;
      const under = at < stReach;
      const top = under ? stBottom : u * 2;
      const rise = Math.max(0, H - u * 3 - u * 15 - top);
      slots.current[pick] = { start: now, dur, wait, rise };
      const f: Floater = { id: ev.i, label: r.label, name: ev.n, at: at + (Math.random() - 0.5) * u * 1.6, w: sw, dur, rise, wait };
      setItems((l) => [...l.slice(-11), f]);
      const t = window.setTimeout(() => {
        timers.current.delete(t);
        setItems((l) => l.filter((x) => x.id !== f.id));
      }, wait + dur + 80);
      timers.current.add(t);
    });
    const ts = timers.current;
    return () => {
      off();
      ts.forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="tv-rx" aria-hidden="true" ref={lane}>
      {items.map((f) => (
        <span
          key={f.id}
          className="tv-rx-f"
          style={
            {
              insetInlineStart: `${Math.max(0, f.at)}px`,
              width: `${f.w}px`,
              animationDuration: `${f.dur}ms`,
              animationDelay: `${f.wait}ms`,
              ['--rise' as string]: `${f.rise}px`,
            } as CSSProperties
          }
        >
          <span className={`tv-rx-e${graphemes(f.label) > 1 ? ' is-pair' : ''}`}>{f.label}</span>
          <span className="tv-rx-n">{f.name}</span>
        </span>
      ))}
    </div>
  );
}

// ============================================================================ the hammer

/** The value counting up once, in a few eased steps, then rolling straight to any later change (the surprise). */
function CountRoll({ target }: { target: number }) {
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [v, setV] = useState(() => (still ? target : Math.round(target * 0.2)));
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || still) {
      setV(target);
      counted.current = true;
      return;
    }
    counted.current = true;
    const steps = [0.38, 0.66, 0.84, 0.94, 1];
    const ids = steps.map((f, i) => window.setTimeout(() => setV(f === 1 ? target : Math.round(target * f)), 80 + i * 200));
    return () => ids.forEach(clearTimeout);
  }, [target, still]);
  return <RollNumber value={v} className="tv-value-n" />;
}

/** The photo with the cover lifting off a covered car, then the stamp slamming once. */
function HammerPhoto({ sale, stamp, uncover }: { sale: Sale; stamp: 'sold' | 'unsold' | null; uncover: boolean }) {
  const k = useContext(KCtx);
  const photo = sale.car.photos?.[0];
  const [dead, setDead] = useState(false);
  return (
    <div className={`tv-photo tv-hphoto${stamp ? ' is-stamped' : ''}`}>
      {photo && !dead ? (
        <Photo u={photo} className="tv-ph is-on" eager onDead={() => setDead(true)} />
      ) : (
        <div className="tv-studio">
          <Silhouette body={sale.car.body} color={sale.car.colorHex} />
        </div>
      )}
      {uncover && <div className="tv-uncover" aria-hidden="true" />}
      {stamp && <div className="tv-mute" aria-hidden="true" />}
      {stamp && (
        <div className="tv-stamp" style={{ zoom: 2.4 * k } as CSSProperties}>
          <Stamp kind={stamp} sub={`سيارة رقم ${sale.no}`} />
        </div>
      )}
      <Sticker no={sale.no} className="tv-sticker" />
      <Reactions />
    </div>
  );
}

/** How it went, in one line. */
function howOf(sale: Sale): string {
  if (sale.approved) return 'صاحبها قال على البركة';
  if (sale.kind === 'dutch') return 'قال أبيها قبل الكل';
  if (sale.sealedBids?.length) return sale.sealedBids.length === 1 ? 'الظرف الوحيد' : `أعلى ظرف من ${sale.sealedBids.length}`;
  return `بعد ${bidsN(sale.bids)}`;
}

/** The sold moment, full screen, in the reveal's stages (saleStage.ts): the big screen never shows a number before the
 *  phones do. -1 the envelopes open or the cover lifts; 0 the stamp, the buyer, the hammer; 1 «سعرها الصدق بالسوق»;
 *  2 the value counts up with the difference and the word; 3 settled, with the surprise if one lands. */
function Hammer({ core, sale, offset }: { core: Core; sale: Sale; offset: number }) {
  const k = useContext(KCtx);
  const stage: SaleStage = useSaleStage(core, sale, offset);
  const buyer = core.players.find((p) => p.id === sale.buyer);
  const name = buyer?.name ?? 'واحد طلع';
  const shown = saleShown(sale, stage);
  const up = (shown.profit ?? 0) >= 0;
  const said = verdictSaid(sale.verdict, shown, false, name);
  const surprise = stage >= 3 ? sale.surprise : null;
  const sealed = !!sale.sealedBids?.length;
  const carName = (
    <>
      <bdi>{sale.car.makeAr}</bdi> <bdi>{sale.car.modelAr}</bdi> <span className="ltr">{sale.car.year}</span>
    </>
  );
  return (
    <div className="tv-hammer" key={sale.lotId}>
      <section className="tv-car">
        <HammerPhoto sale={sale} stamp={stage >= 0 ? 'sold' : null} uncover={stage < 0 && sale.kind === 'covered'} />
        <p className="tv-hammer-car">{stage < 0 && sale.kind === 'covered' ? 'نشيل الغطا…' : carName}</p>
      </section>
      <section className="tv-hammer-side" aria-live="polite">
        {stage < 0 ? (
          sealed ? (
            <OpenEnvelopes core={core} sale={sale} />
          ) : (
            <p className="tv-call">نشيل الغطا…</p>
          )
        ) : (
          <>
            <div className="tv-buyer">
              {buyer && <Paddle n={buyer.paddle} />}
              <div className="tv-buyer-t">
                <p className="tv-buyer-name">راحت لـ {name}</p>
                <p className="tv-buyer-how">{howOf(sale)}</p>
              </div>
            </div>
            <div className="tv-final">
              <div className="tv-tag tv-tag-final" style={{ zoom: 2.2 * k } as CSSProperties}>
                <PriceTag state="final" label="رست على" amount={sale.hammer} compact />
              </div>
            </div>
            <div className="tv-verdict">
              <p className={`tv-verdict-k${stage >= 1 ? ' is-on' : ''}`}>سعرها الصدق بالسوق</p>
              <div className="tv-value">
                {shown.value === null ? (
                  // the number is on its way: nothing before the caption, then the tyre turns where it will land
                  stage >= 1 ? <TireLoader className="tv-value-wait" size={Math.round(170 * k)} /> : null
                ) : (
                  <>
                    <CountRoll target={shown.value} />
                    <span className="tv-value-u">ريال</span>
                  </>
                )}
              </div>
              {surprise && (
                <p className="tv-surprise">
                  <span className="tv-diff ltr">{signed(surprise.delta)}</span>
                  <span>
                    {surprise.good ? 'مفاجأة حلوة: ' : 'مفاجأة شينة: '}
                    {surprise.text}
                  </span>
                </p>
              )}
              <div className="tv-word-row">
                {shown.profit !== null && (
                  <>
                    <span className="tv-word">{said.word}</span>
                    <span className={`tv-diff ltr${up ? ' is-up' : ' is-down'}`}>{signed(shown.profit)}</span>
                    {said.who && <span className="tv-word-who">{said.who}</span>}
                  </>
                )}
              </div>
            </div>
            {stage >= 2 && (
              <p className="tv-paid">
                دفع <span className="ltr">{money(sale.paid)}</span> مع السعي والضريبة
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** The sealed lead-in: the envelopes opened in a ruled list, highest first. */
function OpenEnvelopes({ core, sale }: { core: Core; sale: Sale }) {
  const all = sale.sealedBids ?? [];
  const list = all.slice(0, 4);
  const rest = all.length - list.length;
  return (
    <div className="tv-open">
      <p className="tv-call">فتح الظروف</p>
      <ol className="tv-open-l">
        {list.map((b, i) => (
          <li key={b.by} className={i === 0 ? 'is-top' : undefined} style={{ animationDelay: `${i * 0.5}s` }}>
            <span className="tv-open-who">{nameOf(core, b.by) || 'واحد طلع'}</span>
            <span className="tv-open-n ltr">{money(b.amount)}</span>
          </li>
        ))}
      </ol>
      {rest > 0 && <p className="tv-open-more">{rest === 1 ? 'وظرف ثاني أقل' : `و${rest} ظروف ثانية أقل`}</p>}
    </div>
  );
}

function Unsold({ core, sale }: { core: Core; sale: Sale }) {
  const who = nameOf(core, sale.highBy);
  const why =
    sale.outcome === 'reserve'
      ? 'ما وصلت الحد'
      : sale.outcome === 'declined'
        ? 'صاحبها قال يفتح الله'
        : sale.outcome === 'nobody'
          ? 'ما أحد يقدر عليها'
          : 'ما أحد سام عليها';
  const high = sale.highBid ?? 0;
  return (
    <div className="tv-hammer is-unsold" key={sale.lotId}>
      <section className="tv-car">
        <HammerPhoto sale={sale} stamp="unsold" uncover={false} />
        <p className="tv-hammer-car">
          <bdi>{sale.car.makeAr}</bdi> <bdi>{sale.car.modelAr}</bdi> <span className="ltr">{sale.car.year}</span>
        </p>
      </section>
      <section className="tv-hammer-side">
        <p className="tv-why">{why}</p>
        <p className="tv-buyer-how">ترجع لصاحبها</p>
        <Rows
          className="tv-unsold-rows"
          items={[
            ...(high > 0 ? [{ k: who ? `أعلى سوم، عند ${who}` : 'أعلى سوم', v: money(high), print: true }] : []),
            { k: 'قيمتها حول', v: money(sale.base), print: true },
          ]}
        />
      </section>
    </div>
  );
}

// ============================================================================ the end of the night

function standings(core: Core, sales: Sale[]) {
  return core.players
    .filter((p) => !p.spectator)
    .map((p) => {
      const mine = sales.filter((s) => s.outcome === 'sold' && s.buyer === p.id);
      return { p, cars: mine.length, profit: mine.reduce((a, s) => a + s.profit, 0) };
    })
    .sort((a, b) => b.profit - a.profit || b.p.cash - a.p.cash);
}

/** The showcase: every garage as one ruled column (paddle, name, each car with what was paid, its value and the
 *  difference, then the garage's totals), with the same data and rules as the phone's GarageCard. Up to six
 *  bidders stand side by side; more go in two rows, each car on one line. */
function ShowcaseBoard({ core, hist }: { core: Core; hist: Hist | null }) {
  const sales = (hist?.sales ?? []).filter((x) => x.outcome === 'sold' && x.buyer);
  const active = core.players.filter((p) => !p.spectator).sort((a, b) => a.paddle - b.paddle);
  const slots = core.settings.garage;
  const two = active.length > 6;
  const most = Math.max(0, ...active.map((p) => sales.filter((x) => x.buyer === p.id).length));
  // how many cars a column can list before it says «وn ثانية»
  const cap = two ? 3 : most > 4 ? 7 : 4;
  const compact = two || most > 4;
  return (
    <div className="tv-end tv-show">
      <header className="tv-end-head">
        <h1 className="tv-end-title">عرض الكراجات</h1>
        <p className="tv-end-sub">
          {sales.length ? `انباعت ${carsN(sales.length)}. ` : 'ما انباعت ولا سيارة. '}
          {PROFIT_NOTE}
        </p>
      </header>
      <div className={`tv-garages${two ? ' is-two' : ''}${compact ? ' is-compact' : ''}`} style={{ ['--n' as string]: two ? Math.ceil(active.length / 2) : Math.max(active.length, 3) } as CSSProperties}>
        {active.map((p) => {
          const mine = sales.filter((x) => x.buyer === p.id);
          const paid = mine.reduce((a, x) => a + x.paid, 0);
          const value = mine.reduce((a, x) => a + x.value, 0);
          const free = Math.max(0, slots - mine.length);
          const shown = mine.slice(0, cap);
          return (
            <section key={p.id} className="tv-gar" aria-label={`كراج ${p.name}`}>
              <header className="tv-gar-head">
                <Paddle n={p.paddle} />
                <span className="tv-gar-name">{p.name}</span>
                <span className="tv-gar-count ltr">
                  {mine.length}/{slots}
                </span>
              </header>
              <ul className="tv-gar-cars">
                {shown.map((x) => (
                  <li key={x.lotId} className="tv-gar-car">
                    <span className="tv-gar-model">
                      <bdi>{x.car.modelAr}</bdi> <span className="ltr">{x.car.year}</span>
                    </span>
                    <Delta v={x.profit} className="tv-gar-delta" />
                    {!compact && (
                      <span className="tv-gar-nums">
                        دفع <span className="ltr">{money(x.paid)}</span> · قيمتها <span className="ltr">{money(x.value)}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {mine.length > shown.length && <p className="tv-gar-more">و{carsN(mine.length - shown.length)} ثانية</p>}
              {!mine.length && <p className="tv-gar-more">ما شرى ولا سيارة</p>}
              {mine.length > 0 && free > 0 && !two && <p className="tv-gar-more">{free === 1 ? 'موقف فاضي' : free === 2 ? 'موقفين فاضية' : `${free} مواقف فاضية`}</p>}
              {mine.length > 0 && (
                <dl className="tv-gar-total">
                  <div>
                    <dt>دفع</dt>
                    <dd className="ltr">{money(paid)}</dd>
                  </div>
                  <div>
                    <dt>قيمتها</dt>
                    <dd className="ltr">{money(value)}</dd>
                  </div>
                  <div>
                    <dt>{value - paid >= 0 ? 'الربح' : 'الخسارة'}</dt>
                    <dd>
                      <Delta v={value - paid} />
                    </dd>
                  </div>
                </dl>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** The secret rating: every garage as a ruled row; while rating, who has rated (never a score). */
function StandingsBoard({ core, hist }: { core: Core; hist: Hist | null }) {
  const rows = standings(core, hist?.sales ?? []);
  const voting = core.phase === 'voting';
  const done = core.voted.length;
  return (
    <div className="tv-end">
      <header className="tv-end-head">
        <h1 className="tv-end-title">{voting ? 'الشباب يقيّمون الكراجات' : 'الكراجات'}</h1>
        <p className="tv-end-sub">
          {voting ? (
            <>
              كل واحد يقيّم كراجات الباقين من جواله · قيّم <span className="ltr">{done}</span> من <span className="ltr">{rows.length}</span>
            </>
          ) : (
            'خلص المزاد، هذي كراجات الليلة'
          )}
        </p>
      </header>
      <div role="table" className={`tv-table${rows.length > 6 ? ' is-dense' : rows.length <= 4 ? ' is-few' : ''}`} style={{ ['--cols' as string]: voting ? 'var(--u5) minmax(0,1fr) var(--u14) var(--u20) var(--u14)' : 'var(--u5) minmax(0,1fr) var(--u14) var(--u20)' } as CSSProperties}>
          <div role="row" className="tv-tr tv-th">
            <span role="columnheader" className="tv-c-rank">#</span>
            <span role="columnheader" className="tv-c-who">المزايد</span>
            <span role="columnheader" className="tv-c-n">الكراج</span>
            <span role="columnheader" className="tv-c-n">الربح</span>
            {voting && <span role="columnheader" className="tv-c-state">التقييم</span>}
          </div>
          {rows.map(({ p, cars, profit }, i) => {
            const v = core.voted.includes(p.id);
            return (
              <div role="row" className="tv-tr" key={p.id}>
                <span role="cell" className="tv-c-rank ltr">{i + 1}</span>
                <span role="cell" className="tv-c-who">
                  <Paddle n={p.paddle} />
                  <span className="tv-c-name">{p.name}</span>
                </span>
                <span role="cell" className="tv-c-n ltr">
                  {cars}/{core.settings.garage}
                </span>
                <span role="cell" className="tv-c-n"><Delta v={profit} /></span>
                {voting && (
                  <span role="cell" className={`tv-c-state${v ? ' is-done' : ''}`}>
                    {v ? (
                      <>
                        <Icon name="check" size={20} className="tv-check" /> قيّم
                      </>
                    ) : (
                      'لسه'
                    )}
                  </span>
                )}
              </div>
            );
          })}
      </div>
      <p className="tv-note">{voting ? VOTING_NOTE : PROFIT_NOTE}</p>
    </div>
  );
}

/** The results: the champion on the one alloy surface with the wheel as the trophy, every player as a ruled row;
 *  then the night's awards one at a time, full screen, and back to the table. */
function ResultsBoard({ core, hist }: { core: Core; hist: Hist | null }) {
  const k = useContext(KCtx);
  const res = hist?.results;
  const sales = hist?.sales ?? [];
  const awards = useMemo(() => (res ? computeAwards(core, sales, res) : []), [core, sales, res]);
  // the room's own loop: the table for 16 s, then each award for 6 s
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  if (!res) {
    return (
      <div className="tv-next">
        <TireLoader size={120} label="نجمع النقاط…" />
      </div>
    );
  }
  const rows = res.rows
    .map((r) => ({ r, p: core.players.find((p) => p.id === r.id) }))
    .filter((x): x is { r: (typeof res.rows)[number]; p: PlayerPub } => !!x.p)
    .sort((a, b) => a.r.rank - b.r.rank);
  const cycle = 16 + awards.length * 6;
  const at = t % cycle;
  const ai = at >= 16 ? Math.floor((at - 16) / 6) : -1;
  const award = ai >= 0 ? awards[ai] : null;
  if (award) {
    const who = core.players.find((p) => p.id === award.who);
    return (
      <div className="tv-award" key={award.key} aria-live="polite">
        <span className="tv-award-count">
          الجايزة <span className="ltr">{ai + 1}</span> من <span className="ltr">{awards.length}</span>
        </span>
        <section className={`tv-award-band${award.grand ? ' is-grand' : ''}`}>
          {award.grand ? <Wheel size={Math.round(250 * k)} className="tv-award-wheel" /> : who && <Paddle n={who.paddle} />}
          <div className="tv-award-t">
            <h1 className="tv-award-title">{award.title}</h1>
            <p className="tv-award-name">{award.name}</p>
          </div>
          {award.figure && (
            <p className={`tv-award-fig${award.tone ? ` is-${award.tone}` : ''}`}>
              <span className="tv-award-fig-n ltr">{award.figure}</span>
              <span className="tv-award-fig-k">{award.figureLabel}</span>
            </p>
          )}
        </section>
        <p className="tv-award-line">{award.line}</p>
      </div>
    );
  }
  const champ = rows[0];
  return (
    <div className="tv-end tv-results">
      {champ && (
        <header className="tv-champ">
          <Wheel size={Math.round(170 * k)} className="tv-champ-wheel" />
          <div className="tv-champ-t">
            <span className="tv-champ-k">بطل الليلة</span>
            <span className="tv-champ-name">{champ.p.name}</span>
          </div>
          <span className="tv-champ-pts">
            <span className="ltr">{champ.r.total}</span>
            <small>نقطة</small>
          </span>
        </header>
      )}
      <div role="table" className={`tv-table${rows.length > 6 ? ' is-dense' : rows.length <= 4 ? ' is-few' : ''}`} style={{ ['--cols' as string]: 'var(--u5) minmax(0,1fr) var(--u12) var(--u20) var(--u12) var(--u12)' } as CSSProperties}>
          <div role="row" className="tv-tr tv-th">
            <span role="columnheader" className="tv-c-rank">#</span>
            <span role="columnheader" className="tv-c-who">المزايد</span>
            <span role="columnheader" className="tv-c-n">السيارات</span>
            <span role="columnheader" className="tv-c-n">الربح</span>
            <span role="columnheader" className="tv-c-n">التقييم</span>
            <span role="columnheader" className="tv-c-n">النقاط</span>
          </div>
          {rows.map(({ r, p }) => (
            <div role="row" key={p.id} className={`tv-tr${r.rank === 1 ? ' is-first' : ''}`}>
              <span role="cell" className="tv-c-rank ltr">{r.rank}</span>
              <span role="cell" className="tv-c-who">
                <Paddle n={p.paddle} />
                <span className="tv-c-name">{p.name}</span>
              </span>
              <span role="cell" className="tv-c-n ltr">{r.cars}</span>
              <span role="cell" className="tv-c-n"><Delta v={r.profit} /></span>
              <span role="cell" className="tv-c-n ltr">{r.ratingAvg == null ? '–' : r.ratingAvg.toFixed(1)}</span>
              <span role="cell" className="tv-c-n tv-c-total ltr">{r.total}</span>
            </div>
          ))}
      </div>
      <p className="tv-note">{pointsNote(core.settings.ratingWeight)}</p>
    </div>
  );
}
