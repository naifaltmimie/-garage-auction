import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { feesOf, increment, minNextBid } from '../../engine/rules';
import type { Core, LotPub, PlayerPub } from '../../engine/types';
import { money, vibrate } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';
import { Icon } from './Bits';
import { Paddle } from './Plate';
import { BorderBeam } from './fx/BorderBeam';
import { NumberTicker } from './fx/NumberTicker';
import { DutchConsole, DutchHint } from './DutchConsole';
import { TireLoader } from './TireLoader';

export function maxBidFor(cash: number, lot: LotPub | null): number {
  if (!lot) return cash;
  const r = lot.fee;
  const k = 1 + (r.pct / 100) * (r.vat ? 1.15 : 1);
  return Math.max(0, Math.floor((cash - r.transfer) / k / 100) * 100);
}

function phaseText(core: Core, msLeft: number, lot: LotPub | null): string {
  const s = Math.ceil(msLeft / 1000);
  if (core.phase === 'preview' && lot?.kind === 'dutch') return `معاينة، السعر يبدأ ينزل بعد ${s} ث`;
  switch (core.phase) {
    case 'intro':
      return 'الصالة تتجهز';
    case 'preview':
      return lot?.kind === 'sealed' ? `معاينة، الظروف تنفتح بعد ${s} ث` : `معاينة، المزاد يفتح بعد ${s} ث`;
    case 'bidding':
      if (!core.bid) return core.drops > 0 ? 'نزّلنا السعر، مين يسوم؟' : 'المزاد مفتوح، مين يسوم؟';
      return 'مين يزيد؟';
    case 'sealed':
      return `اكتب سومك بالظرف، وصل ${core.sealedCount} ${core.sealedCount === 1 ? 'ظرف' : 'ظروف'}`;
    case 'approval':
      return 'صاحب السيارة يفكّر';
    case 'sold':
      return 'بيعت';
    case 'unsold':
      return 'ما بيعت';
    default:
      return '';
  }
}

/**
 * Countdown ring. It is the only piece of the console that redraws on the clock (12 Hz): it shrinks
 * with the host's timer and turns red in the last seconds. The panel itself only hears when it goes
 * hot or cools down, so the body never redraws on a tick.
 */
const ClockRing = memo(function ClockRing({ core, offset, live, onHot }: { core: Core; offset: number; live: boolean; onHot: (h: boolean) => void }) {
  const now = useNow(offset, 12);
  const { ms, pct } = timeLeft(core, now);
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const hot = live && ms < 4000;
  useEffect(() => onHot(hot), [hot, onHot]);
  useEffect(() => () => onHot(false), [onHot]);
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className={`ring ${hot ? 'hot' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={r} className="track" />
        <circle cx="24" cy="24" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <b>{core.paused ? '❚❚' : secs}</b>
    </div>
  );
});

/** The preview line counts seconds, so it is the one status line that subscribes to the clock. */
function PreviewLine({ core, lot, offset }: { core: Core; lot: LotPub | null; offset: number }) {
  const now = useNow(offset, 8);
  return <b>{phaseText(core, timeLeft(core, now).ms, lot)}</b>;
}

function PhaseLine({ core, lot, offset }: { core: Core; lot: LotPub | null; offset: number }) {
  if (core.paused) return <b>{core.away ? 'المضيف طلع من الصفحة، المزاد واقف لين يرجع' : 'المزاد واقف'}</b>;
  if (core.phase === 'preview') return <PreviewLine core={core} lot={lot} offset={offset} />;
  return <b>{phaseText(core, 0, lot)}</b>;
}

/** Dev-only render counter, read by the perf script (window.__rc). Stripped from production builds. */
export function countRender(name: string) {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __rc?: Record<string, number> };
  w.__rc = w.__rc || {};
  w.__rc[name] = (w.__rc[name] || 0) + 1;
}

/** A second tap inside this window is treated as the same tap (no accidental double bids). */
const TAP_GAP = 450;
/** How long a sent bid waits for the host's word before the button frees itself. */
const SEND_WAIT = 2500;

export function Console({ room, me, onLog }: { room: RoomView; me: PlayerPub | undefined; onLog: () => void }) {
  const { snap, offset, act, host, spectator, sealedMine } = room;
  const core = snap.core!;
  const lot = snap.lot;
  countRender('console');
  const players = core.players;
  const playerOf = (id: string | null) => players.find((p) => p.id === id);

  const bidding = core.phase === 'bidding' && !core.paused;
  const top = core.bid;
  const iAmTop = top?.by === room.myId;
  const min = minNextBid(top?.amount ?? null, core.opening);
  const step = increment(top?.amount ?? core.opening);
  const cash = me?.cash ?? 0;
  const maxBid = maxBidFor(cash, lot);
  const garageFull = !!me && me.garage.length >= core.settings.garage;
  const mine = lot ? sealedMine[lot.id] : undefined;

  const reason = spectator ? 'أنت متفرج بهالجولة' : garageFull ? 'كراجك فل' : iAmTop ? 'السوم عندك' : min > maxBid ? 'رصيدك ما يغطي السوم' : '';
  // why the big button is grey right now, in words (the same button, never a different one)
  const why = reason ? (iAmTop ? 'السوم عندك، انتظر' : reason) : core.phase === 'bidding' && core.paused ? 'المزاد واقف' : '';

  // outbid flash: shown for 2.6 s by a timer, so it needs no clock
  const prevTop = useRef<string | null>(null);
  const outT = useRef<number>();
  const [outbid, setOutbid] = useState(false);
  useEffect(() => {
    const was = prevTop.current;
    prevTop.current = top?.by ?? null;
    if (was === room.myId && top && top.by !== room.myId) {
      setOutbid(true);
      vibrate([60, 40, 60]);
      window.clearTimeout(outT.current);
      outT.current = window.setTimeout(() => setOutbid(false), 2600);
    }
  }, [top?.by, top?.amount, room.myId, top]);
  useEffect(() => {
    setOutbid(false);
    return () => window.clearTimeout(outT.current);
  }, [lot?.id]);
  const showOutbid = outbid && !iAmTop;

  // extension pill: 1.6 s after the clock was pushed back
  const lastExt = useRef(core.ext);
  const [ext, setExt] = useState(0);
  useEffect(() => {
    const grew = core.ext > lastExt.current;
    lastExt.current = core.ext;
    if (!grew) {
      setExt(0);
      return;
    }
    setExt(core.ext);
    const t = window.setTimeout(() => setExt(0), 1600);
    return () => window.clearTimeout(t);
  }, [core.ext]);

  // the ring tells us when the last seconds start; the panel redraws twice a lot for it, not 12 times a second
  const [hotClock, setHot] = useState(false);

  const [custom, setCustom] = useState(false);
  const [val, setVal] = useState('');
  const [sealVal, setSealVal] = useState('');

  const chips = useMemo(() => {
    const base = top?.amount ?? core.opening;
    const mk = (n: number) => (top ? base + step * n : core.opening + step * (n - 1));
    return [2, 5, 10].map((n) => ({ n, amount: mk(n) }));
  }, [top, core.opening, step]);

  // the tap shows at once (press, buzz, click, «في الطريق»); the button then waits for the host's word:
  // a new top bid at or above ours, a refusal toast, or SEND_WAIT. One bid in flight at a time.
  const [sent, setSent] = useState<{ amount: number; lot: string } | null>(null);
  const flight = useRef<{ amount: number; lot: string; at: number } | null>(null);
  const lastTap = useRef(0);
  const confirmed = !!sent && !!top && top.amount >= sent.amount;
  useEffect(() => {
    if (!sent) return;
    if (confirmed) {
      flight.current = null;
      setSent(null);
      return;
    }
    const t = window.setTimeout(() => {
      flight.current = null;
      setSent(null);
    }, SEND_WAIT);
    return () => window.clearTimeout(t);
  }, [sent, confirmed]);
  // a refusal from the host (a red toast) frees the button at once instead of after SEND_WAIT
  const lastBad = room.toasts.reduce((m, t) => (t.tone === 'bad' && t.id > m ? t.id : m), 0);
  const seenBad = useRef(lastBad);
  useEffect(() => {
    if (lastBad <= seenBad.current) return;
    seenBad.current = lastBad;
    flight.current = null;
    setSent(null);
  }, [lastBad]);
  const sending = !!sent && sent.lot === lot?.id && !confirmed;
  const bid = (amount: number) => {
    if (!lot || !bidding) return;
    const t = performance.now();
    const f = flight.current;
    if (f && f.lot === lot.id && t - f.at < SEND_WAIT && !(top && top.amount >= f.amount)) return;
    if (t - lastTap.current < TAP_GAP) return;
    lastTap.current = t;
    flight.current = { amount, lot: lot.id, at: t };
    vibrate(18);
    sound.tock();
    setSent({ amount, lot: lot.id });
    act({ t: 'bid', lot: lot.id, amount });
  };

  const hot = hotClock && bidding && !!top;
  const going = !!core.callout && core.callout.key.startsWith('going') && bidding;
  const showSecs = ['preview', 'bidding', 'sealed', 'intro'].includes(core.phase);
  const total = lot ? feesOf(min, lot.fee).total : min;
  // while the report is being read the panel shrinks to a strip; people who can't bid just watch
  const compact = core.phase === 'preview' || core.phase === 'intro';
  const watching = spectator || garageFull;
  const topP = playerOf(top?.by ?? null);

  if (core.phase === 'dutch' && lot?.dutch) return <DutchConsole key={lot.id} room={room} me={me} lot={lot} plan={lot.dutch} />;

  return (
    <section className={`bidpanel ${compact ? 'compact' : ''} ${hot ? 'hot' : ''} ${showOutbid ? 'outbid' : ''}`} aria-label="لوحة المزايدة">
      {host && (
        <div className="host-bar" role="toolbar" aria-label="أدوات المضيف">
          <span className="hb-label">أنت الدلال</span>
          {core.paused ? (
            <button className="hb on" onClick={host.resume}>كمّل المزاد</button>
          ) : (
            ['preview', 'bidding', 'sealed', 'sold', 'unsold'].includes(core.phase) && (
              <button className="hb" onClick={host.pause}>وقف مؤقت</button>
            )
          )}
          {core.phase === 'preview' && !core.paused && (
            <button className="hb" onClick={host.advance}>افتح المزاد الحين</button>
          )}
          {(core.phase === 'sold' || core.phase === 'unsold') && !core.paused && (
            <button className="hb" onClick={host.advance}>اللي بعدها</button>
          )}
          {['preview', 'bidding', 'sealed'].includes(core.phase) && (
            <button className="hb" onClick={host.skip}>شيل السيارة</button>
          )}
        </div>
      )}

      <div className="bp-status" aria-live="off">
        {showSecs && <ClockRing core={core} offset={offset} live={bidding && !!top} onHot={setHot} />}
        <div className="bp-state">
          <PhaseLine core={core} lot={lot} offset={offset} />
          {core.callout && (
            <span key={core.callout.id} className={`bp-call ${going ? 'going' : ''}`} aria-live="polite">
              {core.callout.text}
            </span>
          )}
        </div>
        {ext > 0 && <span key={ext} className="chip chip-gold ext-pill">تمدد الوقت</span>}
        {core.reserveMet && lot?.reserve && <span className="chip chip-green">انفك الحد</span>}
      </div>

      {compact && lot && (
        <div className="bp-open">
          <span>{lot.kind === 'sealed' ? 'أقل ظرف' : 'يفتح على'}</span>
          <b className="t-money">{money(core.opening)}</b>
          <small>ريال</small>
        </div>
      )}
      {compact && lot?.kind === 'dutch' && lot.dutch && <DutchHint plan={lot.dutch} />}

      {!compact && core.phase !== 'sealed' && (
        <div className="bp-price">
          {bidding && <BorderBeam />}
          <div className="bp-amount">
            <small>{top ? 'السوم الحالي' : 'يفتح على'}</small>
            <div key={top ? `${top.amount}-${top.by}` : 'open'} className="bp-num">
              <b className="t-money"><NumberTicker id={`bp-${lot?.id ?? ''}`} value={top?.amount ?? core.opening} /></b>
              <span>ريال</span>
            </div>
          </div>
          <div className={`bp-bidder ${iAmTop ? 'me' : ''}`}>
            {top && topP ? (
              <>
                <Paddle n={topP.paddle} me={iAmTop} />
                <div>
                  <b>{iAmTop ? 'أنت' : topP.name}</b>
                  <small>{top.count} سوم</small>
                </div>
              </>
            ) : (
              <small>ما أحد سام للحين</small>
            )}
          </div>
        </div>
      )}

      {compact ? null : core.phase === 'sold' || core.phase === 'unsold' ? (
        <div className="bp-next">
          <TireLoader className="tl-inline" size={30} label={core.paused ? 'المزاد واقف' : 'السيارة الجاية في الطريق'} />
        </div>
      ) : watching ? (
        <div className="bp-note">{spectator ? 'أنت متفرج بهالجولة، تابع السوم' : 'كراجك فل، تفرّج على الباقين'}</div>
      ) : core.phase === 'sealed' ? (
        <div className="envelope">
          {mine != null && (
            <div className="env-wait">
              <TireLoader className="tl-inline" size={30} label="ظرفك مختوم، ننتظر ظروف الباقين" />
              <b className="t-money">{money(mine)}</b>
            </div>
          )}
          <input
            className="input amount-input"
            inputMode="numeric"
            placeholder={money(core.opening)}
            value={sealVal}
            onChange={(e) => setSealVal(e.target.value.replace(/[^\d٠-٩]/g, ''))}
            aria-label="مبلغ الظرف"
          />
          <div className="bid-chips three">
            {[1, 1.25, 1.6].map((f) => {
              const a = Math.min(maxBid, Math.round((core.opening * f) / step) * step);
              return (
                <button key={f} className="btn btn-ghost" onClick={() => setSealVal(String(a))} disabled={a < core.opening}>
                  <b className="ltr">{money(a)}</b>
                  <small>{f === 1 ? 'أقل ظرف' : `×${f}`}</small>
                </button>
              );
            })}
          </div>
          <button
            className="btn btn-primary btn-block bid-main"
            disabled={!lot || !toNum(sealVal) || toNum(sealVal) < core.opening || toNum(sealVal) > maxBid || core.paused}
            onClick={() => {
              const a = toNum(sealVal);
              if (lot && a) act({ t: 'seal', lot: lot.id, amount: a });
            }}
          >
            {mine != null ? 'غيّر الظرف' : 'اختم الظرف'}
          </button>
          <div className="bp-foot">
            <span>محد يشوف ظرفك لين تنفتح الظروف</span>
            <span>تقدر لين {money(maxBid)}</span>
          </div>
        </div>
      ) : (
        <div className="bid-actions">
          {showOutbid && <div className="bp-line out">زاودوا عليك، المطلوب الحين {money(min)}</div>}
          <button
            className={`btn btn-block bid-main ${iAmTop ? 'btn-top' : 'btn-primary'} ${sending ? 'sending' : ''}`}
            disabled={!bidding || !!reason || sending}
            onClick={() => bid(min)}
            aria-label={`زاود ${money(min)}`}
          >
            {sending && sent ? (
              <>
                <span className="bm-label">
                  <span className="bm-spin" aria-hidden="true" />
                  سومك في الطريق
                </span>
                <span className="bm-amt">
                  <b>{money(sent.amount)}</b>
                  <small>ريال</small>
                </span>
              </>
            ) : why ? (
              <span className="bm-reason">{why}</span>
            ) : (
              <>
                <span className="bm-label">
                  <Icon name="gavel" size={22} />
                  {showOutbid ? 'زاود عليه' : top ? 'زاود' : 'افتح السوم'}
                </span>
                <span className="bm-amt">
                  <b><NumberTicker id={`bm-${lot?.id ?? ''}`} value={min} /></b>
                  <small>ريال</small>
                </span>
              </>
            )}
          </button>
          <div className="bid-chips">
            {chips.map((c) => (
              <button key={c.n} className="btn btn-ghost" disabled={!bidding || !!reason || sending || c.amount > maxBid} onClick={() => bid(c.amount)} aria-label={`سُم ${money(c.amount)}`}>
                <b className="ltr">+{money(c.amount - (top?.amount ?? core.opening))}</b>
                <small className="ltr">{money(c.amount)}</small>
              </button>
            ))}
            <button className="btn btn-ghost chip-free" disabled={!bidding || !!reason || sending} onClick={() => setCustom(true)}>
              <b>سوم حر</b>
              <small>اكتب مبلغك</small>
            </button>
          </div>
          <div className="bp-foot">
            <span>
              {bidding && !reason ? (
                <>
                  مع السعي والضريبة <b className="ltr">{money(total)}</b>
                </>
              ) : (
                <>
                  تقدر لين <b className="ltr">{money(maxBid)}</b>
                </>
              )}
            </span>
            <button onClick={onLog}>سجل السوم ({core.log.length})</button>
          </div>
        </div>
      )}

      {custom && (
        <>
          <div className="drawer-back" onClick={() => setCustom(false)} />
          <div className="drawer" role="dialog" aria-label="سوم حر">
            <h3>كم تسوم؟</h3>
            <div className="stack">
              <input
                autoFocus
                className="input amount-input"
                inputMode="numeric"
                placeholder={money(min)}
                value={val}
                onChange={(e) => setVal(e.target.value.replace(/[^\d٠-٩]/g, ''))}
              />
              <div className="bp-foot">
                <span>أقل سوم {money(min)}</span>
                <span>تقدر لين {money(maxBid)}</span>
              </div>
              <button
                className="btn btn-primary btn-block bid-main"
                disabled={!bidding || toNum(val) < min || toNum(val) > maxBid}
                onClick={() => {
                  bid(toNum(val));
                  setCustom(false);
                  setVal('');
                }}
              >
                سُم {toNum(val) ? money(toNum(val)) : ''}
              </button>
              <button className="btn btn-quiet" onClick={() => setCustom(false)}>رجوع</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function toNum(s: string): number {
  const latin = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = parseInt(latin, 10);
  return Number.isFinite(n) ? n : 0;
}

export function BidLog({ core, myId, onClose }: { core: Core; myId: string; onClose: () => void }) {
  const nameOf = (id: string) => core.players.find((p) => p.id === id)?.name ?? '';
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="سجل السوم">
        <h3>سجل السوم</h3>
        <ul className="log" aria-live="polite">
          {[...core.log].reverse().map((l) => (
            <li key={l.id} className={l.by === myId ? 'me' : ''}>
              <span>
                {l.by === myId ? 'أنت' : nameOf(l.by)}
                {l.jump > increment(l.amount - l.jump) * 4 ? <em> رمية</em> : null}
              </span>
              <b className="ltr">{money(l.amount)}</b>
            </li>
          ))}
          <li className="open">
            <span>يفتح على</span>
            <b className="ltr">{money(core.opening)}</b>
          </li>
        </ul>
        <button className="btn btn-ghost btn-block" onClick={onClose}>سكّر</button>
      </div>
    </>
  );
}
