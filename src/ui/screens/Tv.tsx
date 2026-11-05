// «شاشة العرض»: the big-screen viewer for a majlis. One laptop / TV shows the auction for the whole room
// while everyone bids from their phones. It's read-only (see net/viewer.ts): it renders the host's
// snapshots and never joins, so it never counts as a player.
import { useEffect, useMemo, useState } from 'react';
import type { Core, Hist, LotPub, Phase, PlayerPub, Sale } from '../../engine/types';
import { carsN, isCode, km, money, normalizeCode, signed } from '../../lib/util';
import type { Snapshot } from '../../net/room';
import { ViewerRoom, type ViewerStatus } from '../../net/viewer';
import '../../styles/tv.css';
import { QR } from '../components/Bits';
import { Wordmark } from '../components/Logo';
import { Photo } from '../components/Gallery';
import { specLine } from '../components/LotSheet';
import { CarPlate, Paddle } from '../components/Plate';
import { Silhouette } from '../components/Silhouette';
import { lotsFor } from '../../engine/rules';
import { timeLeft, useNow } from '../useRoom';

/** Counts in Latin digits, like the money and the phones (the board used to mix ١٦ with 4 سيارات). */
const num = (n: number | string) => String(n);

const W = 1920;
const H = 1080;

const PHASE: Record<Phase, { t: string; tone: 'calm' | 'live' | 'seal' | 'gold' | 'red' }> = {
  lobby: { t: 'الصالة مفتوحة', tone: 'calm' },
  intro: { t: 'المزاد بيبدأ', tone: 'calm' },
  preview: { t: 'معاينة', tone: 'calm' },
  bidding: { t: 'المزاد مفتوح', tone: 'live' },
  sealed: { t: 'الظرف المختوم', tone: 'seal' },
  approval: { t: 'بانتظار البايع', tone: 'seal' },
  dutch: { t: 'المزاد الهولندي', tone: 'live' },
  sold: { t: 'بيعت', tone: 'gold' },
  unsold: { t: 'ما انباعت', tone: 'red' },
  showcase: { t: 'الكراجات', tone: 'calm' },
  voting: { t: 'التصويت', tone: 'calm' },
  results: { t: 'النتايج', tone: 'gold' },
};

const VERDICT: Record<Sale['verdict'], string> = {
  steal: 'لقطة',
  good: 'صفقة حلوة',
  fair: 'بسعرها',
  over: 'غالية عليه',
  robbed: 'انضرب فيها',
};
const OUTCOME: Record<Sale['outcome'], string> = {
  sold: 'بيعت',
  no_bid: 'محد سام عليها',
  reserve: 'ما وصلت حد البايع',
  declined: 'البايع رفض',
  nobody: 'محد قدر يشتريها',
};

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

export function TvGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8 20h8M12 16.5V20" />
    </svg>
  );
}

/** Small link under the room screens: open this room on a laptop / TV for everyone in the majlis. */
export function TvLink({ code }: { code: string }) {
  return (
    <p className="tv-roomlink">
      <a href={`#/tv/${code}`} target="_blank" rel="noopener">
        <TvGlyph /> اعرض المزاد على شاشة كبيرة
      </a>
    </p>
  );
}

function useViewer(code: string) {
  const [snap, setSnap] = useState<Snapshot>({
    core: null,
    lot: null,
    hist: null,
  });
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<ViewerStatus>({
    connected: false,
    hostGone: false,
    lastHeard: 0,
  });
  useEffect(() => {
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
  }, [code]);
  return { snap, offset, status };
}

/** The 1920×1080 board is scaled as one piece to fit any screen (16:9 and anything near it). */
function useFit() {
  const [k, setK] = useState(() => Math.min(innerWidth / W, innerHeight / H));
  useEffect(() => {
    const on = () => setK(Math.min(innerWidth / W, innerHeight / H));
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return k;
}

export function Tv({ code }: { code: string }) {
  const { snap, offset, status } = useViewer(code);
  const k = useFit();
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

  let body: React.ReactNode;
  if (!core) body = <Waiting code={code} status={status} />;
  else if (core.phase === 'lobby') body = <LobbyBoard core={core} code={code} />;
  else if (core.phase === 'intro') body = <IntroBoard core={core} />;
  else if (core.phase === 'showcase' || core.phase === 'voting') body = <StandingsBoard core={core} hist={snap.hist} />;
  else if (core.phase === 'results') body = <ResultsBoard core={core} hist={snap.hist} />;
  else body = <LotBoard core={core} lot={snap.lot} hist={snap.hist} offset={offset} />;

  const off = !!core && (!status.connected || status.hostGone);
  return (
    <div className="tv" dir="rtl" onDoubleClick={toggleFull}>
      <div className="tv-stage" style={{ transform: `translate(-50%, -50%) scale(${k})` }}>
        <TopBar core={core} code={code} />
        <div className="tv-body">{body}</div>
        {core?.paused && <div className="tv-hold">{core.away ? 'المزاد واقف، جوال المضيف طلع من الصفحة' : 'المزاد موقف مؤقتاً'}</div>}
        {off && (
          <div className="tv-off">
            <i />
            {status.hostGone ? 'المضيف طلع من الصالة' : 'نحاول نرجع الاتصال…'}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================ chrome

function TopBar({ core, code }: { core: Core | null; code: string }) {
  const ph = core ? PHASE[core.phase] : null;
  const inLots = !!core && core.lotNo > 0 && !['lobby', 'intro', 'showcase', 'voting', 'results'].includes(core.phase);
  return (
    <header className="tv-top">
      <div className="tv-brand">
        {core && <Wordmark size={40} className="tv-wordmark" />}
        <span className="tv-brand-t">
          <small>شاشة العرض</small>
          <b>{core?.settings.roomName || 'صالة المزاد'}</b>
        </span>
      </div>
      {ph && (
        <div key={core!.phase} className={`tv-phase tone-${ph.tone}`}>
          {(core!.phase === 'bidding' || core!.phase === 'sealed') && <i className="tv-live-dot" />}
          {ph.t}
        </div>
      )}
      <div className="tv-top-end">
        {inLots && (
          <div className="tv-lotno">
            <small>اللوت</small>
            <b>
              {num(core!.lotNo)} <span>من {num(core!.lotsTotal)}</span>
            </b>
          </div>
        )}
        {core && core.phase !== 'lobby' && (
          <div className="tv-joinchip">
            <small>كود الصالة</small>
            <b className="ltr">{code}</b>
          </div>
        )}
      </div>
    </header>
  );
}

function Waiting({ code, status }: { code: string; status: ViewerStatus }) {
  return (
    <div className="tv-wait">
      <Wordmark size={112} className="tv-wait-mark" />
      <div className="tv-code-label">كود الصالة</div>
      <div className="tv-wait-code ltr">{code}</div>
      <p>{status.connected ? 'ننتظر المضيف يفتح الصالة…' : 'نتصل بالصالة…'}</p>
      <small>شاشة العرض تتابع المزاد بس، ما تدخل كلاعب</small>
    </div>
  );
}

// ============================================================================ lobby

function LobbyBoard({ core, code }: { core: Core; code: string }) {
  const link = joinLink(code);
  const shown = link.replace(/^https?:\/\//, '');
  const players = core.players.filter((p) => !p.spectator);
  const s = core.settings;
  return (
    <div className="tv-lobby">
      <section className="tv-lobby-main">
        <div className="tv-kicker">ادخل من جوالك</div>
        <h1 className="tv-lobby-title">{s.roomName || 'مزاد الكراج'}</h1>
        <div className="tv-code-label">كود الصالة</div>
        <div className="tv-code ltr" aria-label={`كود الصالة ${code.split('').join(' ')}`}>
          {code.split('').map((ch, i) => (
            <span key={i} style={{ ['--i' as string]: i }}>
              {ch}
            </span>
          ))}
        </div>
        <div className="tv-link ltr">{shown}</div>
        <div className="tv-facts">
          <span>
            <small>الميزانية</small>
            <b className="ltr">{money(s.budget)}</b>
          </span>
          <span>
            <small>عدد اللوتات</small>
            <b>{num(lotsFor(s, Math.max(2, players.length)))}</b>
          </span>
          <span>
            <small>الكراج يشيل</small>
            <b>{carsN(s.garage)}</b>
          </span>
        </div>
      </section>
      <section className="tv-lobby-side">
        <div className="tv-qr">
          <QR text={link} size={380} />
          <small>صوّر الكود بكاميرا جوالك</small>
        </div>
        <div className="tv-joined">
          <div className="tv-joined-h">
            <span>المزايدين</span>
            <b>
              {num(players.length)} <small>من {num(s.maxPlayers)}</small>
            </b>
          </div>
          <ul>
            {players.map((p) => (
              <li key={p.id} className={p.online ? '' : 'away'}>
                <Paddle n={p.paddle} />
                <span>{p.name}</span>
                {p.host && <em>المضيف</em>}
              </li>
            ))}
          </ul>
          {players.length < 2 && <p className="tv-joined-wait">ننتظر الشباب يدخلون…</p>}
          <p className="tv-full-hint">دبل كلك على الشاشة أو اضغط F عشان تملا الشاشة</p>
        </div>
      </section>
    </div>
  );
}

function IntroBoard({ core }: { core: Core }) {
  const players = core.players.filter((p) => !p.spectator);
  return (
    <div className="tv-intro">
      <div className="tv-kicker">الليلة في الصالة</div>
      <h1>{core.settings.roomName || 'مزاد الكراج'}</h1>
      <p className="tv-sep">
        <span>{num(core.lotsTotal || lotsFor(core.settings, Math.max(2, players.length)))} لوت</span>
        <span>{num(players.length)} مزايدين</span>
        <span>
          كل واحد معه <span className="ltr">{money(core.settings.budget)}</span> ريال
        </span>
      </p>
      <ul className="tv-intro-names">
        {players.map((p, i) => (
          <li key={p.id} style={{ ['--i' as string]: i }}>
            <Paddle n={p.paddle} />
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================ the lot on the block

function LotBoard({ core, lot, hist, offset }: { core: Core; lot: LotPub | null; hist: Hist | null; offset: number }) {
  const sales = hist?.sales ?? [];
  const sale = lot ? (sales.find((s) => s.lotId === lot.id) ?? null) : null;
  const done = core.phase === 'sold' || core.phase === 'unsold';
  const lastSale = [...sales].reverse().find((s) => s.outcome === 'sold' && s.lotId !== lot?.id) ?? null;
  if (!lot) {
    return (
      <div className="tv-lot-wait">
        <p>اللوت الجاي على الطريق…</p>
      </div>
    );
  }
  return (
    <div className="tv-lot" key={lot.id}>
      <div className="tv-lot-main">
        <Stage lot={lot} sale={done ? sale : null} phase={core.phase} />
        <CarHead lot={lot} sale={done ? sale : null} />
      </div>
      <aside className="tv-lot-side">{done && sale ? <Verdict core={core} sale={sale} /> : <PricePanel core={core} lot={lot} offset={offset} />}</aside>
      <footer className="tv-lot-foot">
        <Ticker core={core} sales={sales} />
        {lastSale && <LastSale core={core} sale={lastSale} />}
      </footer>
    </div>
  );
}

/** The car's photo, slowly cycling through the ad's first shots; a studio silhouette when there's none. */
function Stage({ lot, sale, phase }: { lot: LotPub; sale: Sale | null; phase: Phase }) {
  const car = lot.car ?? sale?.car ?? null;
  const covered = !car;
  // keyed by the URLs, not the object: a fresh snapshot of the same car must not restart the slideshow
  const photoKey = (car?.photos?.length ? car.photos.slice(0, 6) : lot.cover?.photo ? [lot.cover.photo] : []).join('|');
  const photos = useMemo(() => (photoKey ? photoKey.split('|') : []), [photoKey]);
  const [dead, setDead] = useState<Set<string>>(new Set());
  const list = photos.filter((u) => !dead.has(u));
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    setDead(new Set());
  }, [photoKey]);
  const cycling = list.length > 1 && (phase === 'preview' || phase === 'bidding' || phase === 'sealed' || phase === 'approval');
  useEffect(() => {
    if (!cycling) return;
    const iv = setInterval(() => setI((x) => x + 1), 6500);
    return () => clearInterval(iv);
  }, [cycling, list.length]);
  const cur = list.length ? i % list.length : -1;
  const body = car?.body ?? lot.cover?.body ?? 'sedan';
  return (
    <div className={`tv-photo ${covered ? 'covered' : ''}`}>
      {list.length ? (
        list.map((u, k) =>
          // only the shown photo and the next one are mounted: the next one loads while this one is up
          k === cur || k === (cur + 1) % list.length ? (
            <div key={u} className={`tv-ph-wrap ${k === cur ? 'on' : ''}`}>
              <Photo u={u} className="tv-ph-fill" onDead={() => {}} />
              <Photo u={u} className="tv-ph" eager={k === cur} onDead={() => setDead((s) => new Set(s).add(u))} />
            </div>
          ) : null,
        )
      ) : (
        <div className="tv-studio">
          <Silhouette body={body} color={car?.colorHex} mono={covered} />
        </div>
      )}
      {covered && !sale && <div className="tv-covered-tag">سيارة مغطاة، تنكشف بعد البيع</div>}
      {car && list.length > 1 && (
        <div className="tv-dots" aria-hidden="true">
          {list.map((u, k) => (
            <i key={u} className={k === cur ? 'on' : ''} />
          ))}
        </div>
      )}
      {car && (
        <div className="tv-plate">
          <CarPlate plate={car.plate} size="lg" showValue={!!car.plate.special} />
        </div>
      )}
    </div>
  );
}

function CarHead({ lot, sale }: { lot: LotPub; sale: Sale | null }) {
  const car = lot.car ?? sale?.car ?? null;
  if (!car) {
    const c = lot.cover;
    return (
      <div className="tv-carhead">
        <h2>{lot.title || 'سيارة مغطاة'}</h2>
        <div className="tv-specs">
          {c && (
            <span>
              موديل {num(c.yearFrom)}–{num(c.yearTo)}
            </span>
          )}
          {c?.hints.slice(0, 3).map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="tv-carhead">
      <h2>
        {car.makeAr} {car.modelAr}
        {car.trimAr || car.trim ? <small> {car.trimAr || car.trim}</small> : null}
      </h2>
      <div className="tv-specs">
        <span className="tv-year">{num(car.year)}</span>
        <span>{km(car.km)}</span>
        <span>{specLine(car)}</span>
      </div>
    </div>
  );
}

function nameOf(core: Core, id: string | null | undefined) {
  if (!id) return '';
  return core.players.find((p) => p.id === id)?.name ?? '';
}

function PricePanel({ core, lot, offset }: { core: Core; lot: LotPub; offset: number }) {
  // only the clock ticks at 10 Hz, in host time; the rest of the board re-renders on snapshots
  const now = useNow(offset, 10);
  const t = timeLeft(core, now);
  const secs = Math.ceil(t.ms / 1000);
  const bid = core.bid && core.bid.count > 0 ? core.bid : null;
  const leader = bid ? core.players.find((p) => p.id === bid.by) : undefined;
  const sealed = core.phase === 'sealed';
  const preview = core.phase === 'preview';
  const hot = (core.phase === 'bidding' || sealed) && t.ms > 0 && t.ms <= 5000;
  const feed = [...core.log].reverse().slice(0, 5);
  return (
    <div className="tv-price">
      {sealed ? (
        <div className="tv-price-main">
          <div className="tv-label">الظروف المختومة</div>
          <div className="tv-amount sealed">{num(core.sealedCount)}</div>
          <div className="tv-leader">كل واحد يكتب سعره بالسر، وأعلى ظرف ياخذها</div>
        </div>
      ) : (
        <div className="tv-price-main">
          <div className="tv-label">{bid ? 'السوم الحالي' : preview ? 'تفتح على' : 'سعر الافتتاح'}</div>
          <div key={bid ? bid.count : 'open'} className={`tv-amount ${bid ? 'tick' : ''}`}>
            <span className="ltr">{money(bid ? bid.amount : core.opening || lot.opening)}</span>
            <small>ريال</small>
          </div>
          <div key={`l-${bid?.by ?? 'none'}`} className="tv-leader">
            {leader ? (
              <>
                <Paddle n={leader.paddle} />
                <b>{leader.name}</b>
                <span className="tv-leader-tag">ماسك السوم</span>
              </>
            ) : preview ? (
              'تجهّزوا، المعاينة قبل السوم'
            ) : (
              'مين يفتح السوم؟'
            )}
          </div>
        </div>
      )}

      {core.timer && (
        <div className={`tv-clock ${hot ? 'hot' : ''}`}>
          <div className="tv-clock-n">
            <b>{num(Math.max(0, secs))}</b>
            <small>{preview ? 'ثانية للمعاينة' : core.phase === 'approval' ? 'ثانية للبايع' : 'ثانية'}</small>
          </div>
          <div className="tv-bar">
            <i style={{ transform: `scaleX(${t.pct})` }} />
          </div>
        </div>
      )}

      {lot.estimate && core.settings.estimate && !sealed && (
        <div className="tv-est">
          <small>التقدير</small>
          <span className="ltr">
            {money(lot.estimate[0])} – {money(lot.estimate[1])}
          </span>
        </div>
      )}

      {!sealed && (
        <ol className="tv-feed" aria-live="polite">
          {feed.map((l, i) => (
            <li key={l.id} className={i === 0 ? 'top' : ''}>
              <span className="tv-feed-who">{nameOf(core, l.by)}</span>
              {l.jump > 0 && i === 0 && feed.length > 1 && <em className="ltr">+{money(l.jump)}</em>}
              <b className="ltr">{money(l.amount)}</b>
            </li>
          ))}
          {!feed.length && <li className="empty">السوم يبان هنا أول بأول</li>}
        </ol>
      )}
    </div>
  );
}

function Verdict({ core, sale }: { core: Core; sale: Sale }) {
  const sold = sale.outcome === 'sold';
  const buyer = core.players.find((p) => p.id === sale.buyer);
  return (
    <div className={`tv-verdict ${sold ? 'sold' : 'unsold'}`}>
      <div className="tv-stamp">{sold ? 'بيعت' : 'ما انباعت'}</div>
      {sold ? (
        <>
          <div className="tv-label">على</div>
          <div className="tv-buyer">
            {buyer && <Paddle n={buyer.paddle} />}
            <b>{buyer?.name ?? ''}</b>
          </div>
          <div className="tv-label">بسعر</div>
          <div className="tv-amount">
            <span className="ltr">{money(sale.hammer)}</span>
            <small>ريال</small>
          </div>
          <div className={`tv-v v-${sale.verdict}`}>
            <b>{VERDICT[sale.verdict]}</b>
            <span>
              قيمتها <span className="ltr">{money(sale.value)}</span>، {sale.profit >= 0 ? 'ربح' : 'خسارة'} <span className="ltr">{signed(sale.profit)}</span>
            </span>
          </div>
          {sale.roast && <p className="tv-roast">{sale.roast}</p>}
        </>
      ) : (
        <>
          <p className="tv-unsold-why">{OUTCOME[sale.outcome]}</p>
          {sale.highBid ? (
            <div className="tv-v v-fair">
              <span>
                أعلى سوم <span className="ltr">{money(sale.highBid)}</span>
                {sale.highBy ? ` من ${nameOf(core, sale.highBy)}` : ''}
              </span>
            </div>
          ) : null}
          {sale.roast && <p className="tv-roast">{sale.roast}</p>}
        </>
      )}
    </div>
  );
}

// ============================================================================ standings

function standings(core: Core, sales: Sale[]) {
  return core.players
    .filter((p) => !p.spectator)
    .map((p) => {
      const mine = sales.filter((s) => s.outcome === 'sold' && s.buyer === p.id);
      return {
        p,
        cars: mine.length,
        profit: mine.reduce((a, s) => a + s.profit, 0),
      };
    })
    .sort((a, b) => b.profit - a.profit || b.p.cash - a.p.cash);
}

/** Bottom strip during a lot: everyone's wallet and garage, ranked by profit so far. */
function Ticker({ core, sales }: { core: Core; sales: Sale[] }) {
  const rows = standings(core, sales).slice(0, 6);
  return (
    <ol className="tv-ticker">
      {rows.map(({ p, cars }, i) => (
        <li key={p.id} className={core.phase === 'bidding' && core.bid?.by === p.id ? 'lead' : ''}>
          <span className="tv-rank">{num(i + 1)}</span>
          <span className="tv-tk-name">{p.name}</span>
          <span className="tv-tk-cash ltr">{money(p.cash)}</span>
          <span className="tv-tk-cars">
            {num(cars)}/{num(core.settings.garage)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function LastSale({ core, sale }: { core: Core; sale: Sale }) {
  return (
    <div className="tv-last">
      <small>آخر بيعة</small>
      <b>
        {sale.car.makeAr} {sale.car.modelAr} {num(sale.car.year)}
      </b>
      <span>
        على {nameOf(core, sale.buyer)} بـ <span className="ltr">{money(sale.hammer)}</span>
      </span>
    </div>
  );
}

function StandingsBoard({ core, hist }: { core: Core; hist: Hist | null }) {
  const sales = hist?.sales ?? [];
  const rows = standings(core, sales);
  const lastSale = [...sales].reverse().find((s) => s.outcome === 'sold') ?? null;
  const voting = core.phase === 'voting';
  const voters = core.players.filter((p) => !p.spectator);
  return (
    <div className="tv-board">
      <div className="tv-board-h">
        <div>
          <div className="tv-kicker">{voting ? 'كل واحد يقيّم كراجات الباقين من جواله' : 'خلص المزاد، هذي الكراجات'}</div>
          <h1>{voting ? 'التصويت على الكراجات' : 'ترتيب الصالة'}</h1>
          {voting && (
            <p className="tv-board-sub">
              صوّت {num(core.voted.length)} من {num(voters.length)}
            </p>
          )}
        </div>
        {lastSale && !voting && <LastSale core={core} sale={lastSale} />}
      </div>
      <Table
        rows={rows.map(({ p, cars, profit }) => ({
          p,
          cars,
          value: profit,
          cash: p.cash,
          voted: voting && core.voted.includes(p.id),
        }))}
        garage={core.settings.garage}
        sales={sales}
        valueLabel="الربح"
      />
    </div>
  );
}

function Table({
  rows,
  garage,
  sales,
  valueLabel,
  points,
}: {
  rows: {
    p: PlayerPub;
    cars: number;
    value: number;
    cash: number;
    voted?: boolean;
    awards?: string[];
  }[];
  garage: number;
  sales: Sale[];
  valueLabel: string;
  points?: boolean;
}) {
  return (
    <ol className={`tv-table ${rows.length > 6 ? 'dense' : ''}`}>
      <li className="tv-th">
        <span>#</span>
        <span>المزايد</span>
        <span>الكراج</span>
        <span>الرصيد</span>
        <span>{valueLabel}</span>
      </li>
      {rows.map(({ p, cars, value, cash, voted, awards }, i) => {
        const mine = sales.filter((s) => s.outcome === 'sold' && s.buyer === p.id);
        return (
          <li key={p.id} className={i === 0 ? 'first' : ''} style={{ ['--i' as string]: i }}>
            <span className="tv-rank">{num(i + 1)}</span>
            <span className="tv-who">
              <Paddle n={p.paddle} />
              <b>{p.name}</b>
              {voted && <em className="tv-voted">صوّت</em>}
              {awards?.slice(0, 2).map((a) => (
                <em key={a} className="tv-award">
                  {a}
                </em>
              ))}
            </span>
            <span className="tv-cars">
              {mine.length
                ? mine
                    .slice(0, 3)
                    .map((s) => `${s.car.makeAr} ${s.car.modelAr}`)
                    .join('، ')
                : 'فاضي'}
              <small>
                {num(cars)} من {num(garage)}
              </small>
            </span>
            <span className="tv-cash ltr">{money(cash)}</span>
            <span className={`tv-val ${points ? '' : value >= 0 ? 'gain' : 'loss'}`}>
              {points ? (
                <>
                  {num(value)} <small>نقطة</small>
                </>
              ) : (
                <span className="ltr">{signed(value)}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ResultsBoard({ core, hist }: { core: Core; hist: Hist | null }) {
  const res = hist?.results;
  const sales = hist?.sales ?? [];
  if (!res) return <StandingsBoard core={core} hist={hist} />;
  const rows = res.rows
    .map((r) => ({ r, p: core.players.find((p) => p.id === r.id) }))
    .filter((x): x is { r: (typeof res.rows)[number]; p: PlayerPub } => !!x.p)
    .sort((a, b) => a.r.rank - b.r.rank);
  const champ = rows[0];
  return (
    <div className="tv-board tv-results">
      <div className="tv-board-h">
        <div>
          <div className="tv-kicker">النتيجة النهائية</div>
          {champ && (
            <h1>
              بطل الليلة: <span className="tv-champ">{champ.p.name}</span>
            </h1>
          )}
        </div>
      </div>
      <Table
        rows={rows.map(({ r, p }) => ({
          p,
          cars: r.cars,
          value: r.total,
          cash: r.cash,
          awards: r.awards,
        }))}
        garage={core.settings.garage}
        sales={sales}
        valueLabel="النقاط"
        points
      />
      {res.awards.length > 0 && rows.length <= 8 && (
        <ul className="tv-awards">
          {res.awards.slice(0, 4).map((a) => (
            <li key={a.key}>
              <b>{a.title}</b>
              <span>{nameOf(core, a.who) || a.who}</span>
              <small>{a.detail}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
