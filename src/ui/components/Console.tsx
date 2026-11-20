// The bidding block: one rubber block docked to the bottom of the auction screen. Top to bottom: the status
// row (clock, the دلال's call, the reactions slot), the fact line, the price tag, the one red action, the raise
// keys, and the cost line. Every other state (preview, sealed envelope, holding the bid, no money, offline…)
// is the same block with a different body. The clock lives in its own leaf, so a tick never redraws the block.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sound } from '../../audio/sound';
import { feesOf, increment, minNextBid } from '../../engine/rules';
import type { Core, LotPub, PlayerPub } from '../../engine/types';
import { money, vibrate } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';
import { Icon } from './Bits';
import { Paddle } from './Plate';
import { DutchConsole } from './DutchConsole';
import { TireLoader } from './TireLoader';
import { PriceTag } from './kit/PriceTag';

export function maxBidFor(cash: number, lot: LotPub | null): number {
  if (!lot) return cash;
  const r = lot.fee;
  const k = 1 + (r.pct / 100) * (r.vat ? 1.15 : 1);
  return Math.max(0, Math.floor((cash - r.transfer) / k / 100) * 100);
}

/** how many envelopes are in, as said: ظرف واحد، ظرفين، 3 ظروف، 11 ظرف */
const envelopes = (n: number) =>
  n === 0 ? 'ما وصل ولا ظرف' : n === 1 ? 'وصل ظرف واحد' : n === 2 ? 'وصل ظرفين' : n <= 10 ? `وصل ${n} ظروف` : `وصل ${n} ظرف`;

function phaseText(core: Core, lot: LotPub | null): string {
  // the ring beside it counts the seconds, so the call never repeats them
  if (core.phase === 'preview' && lot?.kind === 'dutch') return 'معاينة قبل النزول';
  switch (core.phase) {
    case 'intro':
      return 'الصالة تتجهز';
    case 'preview':
      return lot?.kind === 'sealed' ? 'معاينة قبل الظروف' : 'معاينة قبل السوم';
    case 'bidding':
      if (!core.bid) return core.drops > 0 ? 'نزّلناه، مين يسوم؟' : 'مين يفتح السوم؟';
      return 'مين يزيد؟';
    case 'sealed':
      return 'اكتب سومك بالظرف';
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

/** Dev-only render counter, read by the perf script (window.__rc). Stripped from production builds. */
export function countRender(name: string) {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __rc?: Record<string, number> };
  w.__rc = w.__rc || {};
  w.__rc[name] = (w.__rc[name] || 0) + 1;
}

/** Dev-only trace of what the block sent or ignored, read by the bid tests (window.__cs). */
function trace(kind: 'sent' | 'ignored', data: Record<string, unknown>) {
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __cs?: unknown[] };
  w.__cs = w.__cs || [];
  w.__cs.push({ kind, at: Math.round(performance.now()), ...data });
}

/** A second tap inside this window is treated as the same tap (no accidental double bids). */
const TAP_GAP = 450;
/** How long a sent bid waits for the host's word before the button frees itself. */
const SEND_WAIT = 2500;
/** After the price moves, the bid controls ignore taps for this long, so a thumb never bids an amount it did not read. */
const FREEZE_MS = 350;
/** The refusal the host sends when someone got there first (useRoom's wording). */
const LOW_TEXT = 'سبقك أحد على هالسعر، زوّد';

/** True while the viewport is shorter than 700px: the price tag goes compact. */
function useShort() {
  const q = '(max-height: 699px)';
  const [short, setShort] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setShort(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return short;
}

/** The phone's own idea of the network, live. */
function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

/**
 * The countdown ring: the only piece of the block that redraws on the clock. Print digits in chalk, red only in the
 * last five seconds of an open lot; a pause mark while the auction is stopped.
 */
const ClockRing = memo(function ClockRing({ core, offset, live }: { core: Core; offset: number; live: boolean }) {
  const now = useNow(offset, 12);
  const { ms, pct } = timeLeft(core, now);
  const secs = Math.max(0, Math.ceil(ms / 1000));
  const hot = live && !core.paused && ms > 0 && ms <= 5000;
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className={`cs-ring${hot ? ' hot' : ''}`} role="timer" aria-label={core.paused ? 'الساعة واقفة' : `باقي ${secs} ثانية`}>
      <svg className="cs-ring-svg" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} className="cs-ring-track" />
        <circle cx="24" cy="24" r={r} className="cs-ring-bar" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      {core.paused ? <Icon name="pause" size={16} weight="fill" className="cs-ring-pause" /> : <b className="cs-ring-n ltr">{secs}</b>}
    </div>
  );
});

type FactItem = { id: string; pre?: string; num?: string; post?: string; tone?: 'good' | 'warn' };

/** The facts that decide a bid, in the order they are dropped from the end when the line runs out of room. */
export function lotFacts(lot: LotPub, reserveMet: boolean): FactItem[] {
  const out: FactItem[] = [];
  if (lot.reserve && reserveMet) out.push({ id: 'res', pre: 'انفك الحد', tone: 'good' });
  if (lot.kind === 'covered' || !lot.car) {
    out.push({ id: 'cov', pre: 'تحت الغطا' });
    out.push({ id: 'est', pre: 'التقدير محد يدري' });
    if (lot.cover) out.push({ id: 'yr', num: `${lot.cover.yearFrom}–${lot.cover.yearTo}` });
    return out;
  }
  const car = lot.car;
  out.push(lot.estimate ? { id: 'est', pre: 'التقدير', num: `${money(lot.estimate[0])}–${money(lot.estimate[1])}` } : { id: 'est', pre: 'التقدير مخفي' });
  out.push({ id: 'yr', num: String(car.year) });
  out.push({ id: 'km', num: money(car.km), post: 'كم' });
  if (lot.grade != null) out.push({ id: 'gr', pre: 'فحص', num: `${lot.grade.toFixed(1)}/5` });
  else if (lot.mode === 'asis') out.push({ id: 'gr', pre: 'على الحالة', tone: 'warn' });
  if (lot.reserve && !reserveMet) out.push({ id: 'res', pre: 'عليها حد' });
  return out;
}

/**
 * One line of facts, never wrapping: when it runs out of room the last facts are dropped whole (the type never
 * shrinks). Measured after layout and on resize; hiding is done on the DOM so it costs no extra render.
 */
export function FactLine({ items }: { items: FactItem[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const sig = items.map((i) => `${i.id}:${i.pre ?? ''}${i.num ?? ''}`).join('|');
  useLayoutEffect(() => {
    const ul = ref.current;
    if (!ul) return;
    const fit = () => {
      const lis = Array.from(ul.children) as HTMLElement[];
      lis.forEach((li) => li.removeAttribute('data-off'));
      const box = ul.getBoundingClientRect();
      let cut = false;
      for (const li of lis) {
        const r = li.getBoundingClientRect();
        if (cut || r.left < box.left - 0.5 || r.right > box.right + 0.5) {
          cut = true;
          li.setAttribute('data-off', '');
        }
      }
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(ul);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => ro?.disconnect();
  }, [sig]);
  return (
    <ul className="cs-facts" ref={ref} aria-label="عن السيارة">
      {items.map((f) => (
        <li key={f.id} className={f.tone ? `is-${f.tone}` : undefined}>
          {f.tone === 'good' && <Icon name="check" size={13} className="cs-fact-mark" />}
          {f.tone === 'warn' && <i className="cs-fact-dot" aria-hidden="true" />}
          {f.pre}
          {f.pre && f.num ? ' ' : null}
          {f.num && (
            <span className="ltr" dir="ltr">
              {f.num}
            </span>
          )}
          {f.post ? ` ${f.post}` : null}
        </li>
      ))}
    </ul>
  );
}

/** The status row: clock, the call in Voice, and the slot the reactions button docks into. */
export function StatusRow({
  clock,
  call,
  alert,
  rxSlot,
  lead,
}: {
  clock: ReactNode;
  call: ReactNode;
  alert?: boolean;
  rxSlot?: (el: HTMLDivElement | null) => void;
  lead?: ReactNode;
}) {
  return (
    <div className="cs-status">
      {clock}
      {lead}
      <p className={`cs-call voice${alert ? ' is-alert' : ''}`} role={alert ? 'alert' : 'status'} aria-live={alert ? 'assertive' : 'polite'}>
        {call}
      </p>
      <div className="cs-rx" ref={rxSlot} />
    </div>
  );
}

/** The host's two controls, labelled. Removing a car lives only in the room menu, behind its confirm. */
export function HostBar({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const host = room.host;
  if (!host) return null;
  const canPause = ['preview', 'bidding', 'sealed', 'dutch', 'sold', 'unsold'].includes(core.phase);
  return (
    <div className="cs-host" role="toolbar" aria-label="أدوات الدلال">
      <span className="cs-host-k">أنت الدلال</span>
      <div className="cs-host-b">
        {core.paused ? (
          <button type="button" className="cs-hkey is-on" onClick={host.resume}>
            <Icon name="play" size={16} weight="fill" />
            كمّل المزاد
          </button>
        ) : (
          canPause && (
            <button type="button" className="cs-hkey" onClick={host.pause}>
              <Icon name="pause" size={16} weight="fill" />
              وقّف مؤقت
            </button>
          )
        )}
        {core.phase === 'preview' && !core.paused && (
          <button type="button" className="cs-hkey" onClick={host.advance}>
            افتح المزاد الحين
          </button>
        )}
        {(core.phase === 'sold' || core.phase === 'unsold') && !core.paused && (
          <button type="button" className="cs-hkey" onClick={host.advance}>
            اللي بعدها
          </button>
        )}
      </div>
    </div>
  );
}

/** A calm block in place of the action: what is true, and what the player can still do. Same height as the keys. */
function Calm({ icon, title, sub, tone }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: ReactNode; tone?: 'off' }) {
  return (
    <div className={`cs-calm${tone ? ` is-${tone}` : ''}`} role="status" aria-live="polite">
      <Icon name={icon} size={22} className="cs-calm-i" />
      <div className="cs-calm-t">
        <b className="voice">{title}</b>
        <span>{sub}</span>
      </div>
    </div>
  );
}

/** Formats digits as they are typed: 1400000 → 1,400,000. */
const fmt = (n: number) => (n > 0 ? money(n) : '');

export function toNum(s: string): number {
  const latin = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const n = parseInt(latin.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Sheets: focus moves in, Tab stays inside, Escape and a tap outside close it, focus returns to the opener. */
function useSheet(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button:not(:disabled), input');
    first?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const f = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), input, [tabindex="0"]'));
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      back?.focus?.({ preventScroll: true });
    };
  }, [open]);
  return ref;
}

/** Phosphor "backspace" (bold), MIT. */
function BackspaceGlyph() {
  return (
    <svg viewBox="0 0 256 256" width="24" height="24" aria-hidden="true" fill="currentColor">
      <path d="M216,36H68.53a20.09,20.09,0,0,0-17.15,9.71L5.71,121.83a12,12,0,0,0,0,12.34l45.67,76.12h0A20.1,20.1,0,0,0,68.53,220H216a20,20,0,0,0,20-20V56A20,20,0,0,0,216,36Zm-4,160H70.8L30,128,70.8,60H212ZM103.51,143.51,119,128l-15.52-15.51a12,12,0,0,1,17-17L136,111l15.51-15.52a12,12,0,0,1,17,17L153,128l15.52,15.51a12,12,0,0,1-17,17L136,145l-15.51,15.52a12,12,0,0,1-17-17Z" />
    </svg>
  );
}

/** The free-bid sheet: a 12-key pad, the amount printed as it is typed, and a second tap for an extreme amount. */
function FreeBid({
  min,
  maxBid,
  cash,
  estTop,
  price,
  live,
  onBid,
  onClose,
}: {
  min: number;
  maxBid: number;
  cash: number;
  estTop: number | null;
  price: number;
  live: boolean;
  onBid: (amount: number) => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState('');
  const [ask, setAsk] = useState(0);
  const ref = useSheet(true, onClose);
  const amount = toNum(digits);
  useEffect(() => setAsk(0), [amount]);
  useEffect(() => {
    if (!ask) return;
    const t = window.setTimeout(() => setAsk(0), 3000);
    return () => window.clearTimeout(t);
  }, [ask]);

  const press = useCallback((k: string) => {
    vibrate(6);
    setDigits((d) => {
      if (k === 'del') return d.slice(0, -1);
      const next = (d + k).replace(/^0+/, '');
      return next.length > 9 ? d : next;
    });
  }, []);
  // a hardware keyboard types into the pad too
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [press]);

  // extreme: over twice the دلال's top estimate (three times the price without one), or over half the cash
  const ratio = estTop ? amount / estTop : price > 0 ? amount / price : 0;
  const share = cash > 0 ? amount / cash : 0;
  const overEst = estTop ? ratio > 2 : ratio > 3;
  const overCash = share > 0.5;
  const extreme = amount >= min && amount <= maxBid && (overEst || overCash);
  const times = <span dir="ltr">{ratio.toFixed(1).replace(/\.0$/, '')}×</span>;
  const warn = overEst ? (
    <>
      هذا {times} {estTop ? 'تقدير الدلال' : 'السوم الحالي'}
    </>
  ) : (
    <>
      هذا <span dir="ltr">{Math.round(share * 100)}%</span> من رصيدك
    </>
  );

  const why = !live ? 'السوم مو مفتوح الحين' : !amount ? null : amount < min ? `أقل سوم ${money(min)}` : amount > maxBid ? `رصيدك يوصل لين ${money(maxBid)}` : null;
  const ok = live && amount >= min && amount <= maxBid;

  const go = () => {
    if (!ok) return;
    if (extreme && !ask) {
      vibrate([20, 30, 20]);
      setAsk(Date.now());
      return;
    }
    onBid(amount);
    onClose();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
  return (
    <>
      <div className="cs-back" onClick={onClose} aria-hidden="true" />
      <div className="cs-sheet cs-pad" role="dialog" aria-modal="true" aria-label="سوم حر" ref={ref}>
        <div className="cs-sheet-head">
          <h3 className="voice">كم تسوم؟</h3>
          <button type="button" className="cs-x" aria-label="سكّر" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <output className={`cs-pad-amt print ltr${amount ? '' : ' is-empty'}`} dir="ltr" aria-live="polite" aria-label={amount ? `${money(amount)} ريال` : 'ما كتبت مبلغ'}>
          <span className="cs-pad-n">{amount ? fmt(amount) : money(min)}</span>
          <span className="cs-pad-u">ريال</span>
        </output>
        <p className="cs-pad-lim">
          أقل سوم <span className="ltr" dir="ltr">{money(min)}</span> · تقدر لين <span className="ltr" dir="ltr">{money(maxBid)}</span>
        </p>
        <div className="cs-keys12" dir="ltr">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className={`cs-k12${k === 'del' ? ' is-del' : ''}`}
              aria-label={k === 'del' ? 'امسح رقم' : k}
              onClick={() => press(k)}
              disabled={k === 'del' ? !digits : k.startsWith('0') && !digits}
            >
              {k === 'del' ? <BackspaceGlyph /> : <span className="print">{k}</span>}
            </button>
          ))}
        </div>
        <p className={`cs-pad-warn${ask ? ' is-on' : ''}`} role="alert">
          {ask ? warn : ''}
        </p>
        <button type="button" className={`cs-main bid-main${ask ? ' is-ask' : ''}`} disabled={!ok} onClick={go} data-autofocus>
          {why ? (
            <span className="cs-main-why">{why}</span>
          ) : ask ? (
            <>
              <span className="cs-main-l voice">متأكد؟</span>
              <span className="cs-main-a">
                <b className="print ltr">{money(amount)}</b>
                <small>ريال</small>
              </span>
            </>
          ) : (
            <>
              <span className="cs-main-l voice">سوم</span>
              <span className="cs-main-a">
                <b className="print ltr">{amount ? money(amount) : '—'}</b>
                <small>ريال</small>
              </span>
            </>
          )}
        </button>
      </div>
    </>
  );
}

/** The sealed envelope: title in the status row; here the rule, three suggestions, the field and «اختم الظرف». */
function Envelope({ room, lot, maxBid, step, mine }: { room: RoomView; lot: LotPub; maxBid: number; step: number; mine: number | undefined }) {
  const core = room.snap.core!;
  const [val, setVal] = useState('');
  const [editing, setEditing] = useState(false);
  const n = toNum(val);
  const sealed = mine != null && !editing;
  useEffect(() => {
    if (mine != null) setEditing(false);
  }, [mine]);

  if (sealed) {
    return (
      <div className="cs-sealed" role="status" aria-live="polite">
        <div className="cs-sealed-env">
          <span className="cs-seal" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
          <div className="cs-sealed-t">
            <span>ظرفك مختوم على</span>
            <b className="print ltr">
              {money(mine!)} <small>ريال</small>
            </b>
          </div>
        </div>
        <div className="cs-sealed-wait">
          <TireLoader className="tl-inline" size={22} label={`ننتظر الباقين، ${envelopes(core.sealedCount)}`} />
        </div>
        <button
          type="button"
          className="cs-quiet"
          onClick={() => {
            setVal(String(mine));
            setEditing(true);
          }}
          disabled={core.paused}
        >
          غيّر الظرف
        </button>
      </div>
    );
  }

  const picks = [1, 1.25, 1.6].map((f) => ({ f, a: Math.min(maxBid, Math.round((core.opening * f) / step) * step) }));
  const bad = !n ? null : n < core.opening ? `أقل ظرف ${money(core.opening)}` : n > maxBid ? `رصيدك يوصل لين ${money(maxBid)}` : null;
  return (
    <div className="cs-env">
      <p className="cs-env-rule">
        أعلى ظرف ياخذها بمبلغه · <span className="nb">{envelopes(core.sealedCount)}</span>
      </p>
      <div className="cs-raise three" role="group" aria-label="مبالغ مقترحة">
        {picks.map(({ f, a }) => (
          <button key={f} type="button" className="cs-key" aria-pressed={n === a} onClick={() => setVal(String(a))} disabled={a < core.opening}>
            <b className="print ltr">{money(a)}</b>
            <small>{f === 1 ? 'أقل ظرف' : f === 1.25 ? 'فوق الأقل بشوي' : 'ظرف قوي'}</small>
          </button>
        ))}
      </div>
      <label className="cs-field">
        <span className="cs-field-k">مبلغ الظرف</span>
        <input
          className="print ltr"
          dir="ltr"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="done"
          placeholder={money(core.opening)}
          value={fmt(n)}
          onChange={(e) => setVal(String(toNum(e.target.value)).slice(0, 9))}
        />
        <span className="cs-field-u">ريال</span>
      </label>
      <button
        type="button"
        className="cs-main bid-main"
        disabled={!n || !!bad || core.paused}
        onClick={() => {
          if (n) {
            vibrate(18);
            room.act({ t: 'seal', lot: lot.id, amount: n });
          }
        }}
      >
        {bad ? (
          <span className="cs-main-why">{bad}</span>
        ) : (
          <>
            <span className="cs-main-l voice">اختم الظرف</span>
            {n > 0 && (
              <span className="cs-main-a">
                <b className="print ltr">{money(n)}</b>
                <small>ريال</small>
              </span>
            )}
          </>
        )}
      </button>
      {editing && (
        <button type="button" className="cs-quiet" onClick={() => setEditing(false)}>
          خلّه على <span className="ltr">{money(mine!)}</span>
        </button>
      )}
    </div>
  );
}

export function Console({
  room,
  me,
  onLog,
  rxSlot,
}: {
  room: RoomView;
  me: PlayerPub | undefined;
  onLog: () => void;
  rxSlot?: (el: HTMLDivElement | null) => void;
}) {
  const { snap, offset, act, spectator, sealedMine } = room;
  const core = snap.core!;
  const lot = snap.lot;
  countRender('console');
  const short = useShort();
  const online = useOnline();
  const offline = !online || !room.net.connected || (room.role !== 'host' && room.net.hostGone);

  const bidding = core.phase === 'bidding' && !core.paused;
  const top = core.bid;
  const iAmTop = top?.by === room.myId;
  const min = minNextBid(top?.amount ?? null, core.opening);
  const step = increment(top?.amount ?? core.opening);
  const cash = me?.cash ?? 0;
  const maxBid = maxBidFor(cash, lot);
  const garageFull = !!me && me.garage.length >= core.settings.garage;
  const mine = lot ? sealedMine[lot.id] : undefined;
  const topP = top ? core.players.find((p) => p.id === top.by) : undefined;

  // ---- S1-1: the price froze under the thumb. Every change of the top bid freezes the controls for FREEZE_MS;
  // a tap is resolved against the amounts that were on screen at commit time, never against a newer state.
  const topAmount = top?.amount ?? null;
  const shown = useRef<{ min: number; chips: number[]; at: number; amount: number | null }>({ min, chips: [], at: 0, amount: topAmount });
  const chips = useMemo(() => {
    const base = topAmount ?? core.opening;
    const mk = (n: number) => (topAmount != null ? base + step * n : core.opening + step * (n - 1));
    return [2, 5, 10].map((n) => ({ n, amount: mk(n), delta: mk(n) - base }));
  }, [topAmount, core.opening, step]);
  const [frozenAt, setFrozenAt] = useState(0);
  useLayoutEffect(() => {
    const moved = shown.current.amount !== topAmount;
    shown.current = { min, chips: chips.map((c) => c.amount), at: moved ? performance.now() : shown.current.at, amount: topAmount };
    if (moved) setFrozenAt(shown.current.at);
  }, [topAmount, min, chips]);
  useEffect(() => {
    if (!frozenAt) return;
    const t = window.setTimeout(() => setFrozenAt(0), FREEZE_MS);
    return () => window.clearTimeout(t);
  }, [frozenAt]);
  const frozen = frozenAt > 0;

  // ---- outbid: shown for 2.6 s by a timer, so it needs no clock
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

  // ---- S2-9: «تمدد الوقت» takes the call line for 1.6 s, never floats over it
  const lastExt = useRef(core.ext);
  const [ext, setExt] = useState(false);
  useEffect(() => {
    const grew = core.ext > lastExt.current;
    lastExt.current = core.ext;
    if (!grew) {
      setExt(false);
      return;
    }
    setExt(true);
    const t = window.setTimeout(() => setExt(false), 1600);
    return () => window.clearTimeout(t);
  }, [core.ext]);

  const [custom, setCustom] = useState(false);
  // the keypad belongs to one lot's bidding: it closes when the lot or the phase moves on
  useEffect(() => setCustom(false), [lot?.id, core.phase]);

  // ---- the tap shows at once (press, buzz, click, «في الطريق»); the button then waits for the host's word:
  // a new top bid at or above ours, a refusal toast, or SEND_WAIT. One bid in flight at a time.
  const [sent, setSent] = useState<{ amount: number; lot: string } | null>(null);
  const flight = useRef<{ amount: number; lot: string; at: number } | null>(null);
  const lastTap = useRef(0);
  const confirmed = !!sent && !!top && top.amount >= sent.amount;
  const toast = room.toast;
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
      // S1-3: a bid that got no answer says so, instead of freeing silently
      toast('سومك ما وصل، جرّب مرة ثانية', 'bad');
    }, SEND_WAIT);
    return () => window.clearTimeout(t);
  }, [sent, confirmed, toast]);
  // a refusal from the host (a red toast) frees the button at once; «someone got there first» also names the new price
  const lastBadT = room.toasts.reduce<(typeof room.toasts)[number] | null>((m, t) => (t.tone === 'bad' && (!m || t.id > m.id) ? t : m), null);
  const lastBad = lastBadT?.id ?? 0;
  const seenBad = useRef(lastBad);
  const [low, setLow] = useState(false);
  useEffect(() => {
    if (lastBad <= seenBad.current) return;
    seenBad.current = lastBad;
    if (!flight.current) return;
    flight.current = null;
    setSent(null);
    if (lastBadT?.text === LOW_TEXT) {
      setLow(true);
      const t = window.setTimeout(() => setLow(false), 2600);
      return () => window.clearTimeout(t);
    }
  }, [lastBad, lastBadT?.text]);
  const sending = !!sent && sent.lot === lot?.id && !confirmed;

  const bid = (amount: number, src: string) => {
    if (!lot || !bidding || offline) return;
    const t = performance.now();
    if (t - shown.current.at < FREEZE_MS) {
      trace('ignored', { src, amount, why: 'frozen', shownMin: shown.current.min });
      return;
    }
    const f = flight.current;
    if (f && f.lot === lot.id && t - f.at < SEND_WAIT && !(top && top.amount >= f.amount)) return;
    if (t - lastTap.current < TAP_GAP) return;
    lastTap.current = t;
    flight.current = { amount, lot: lot.id, at: t };
    vibrate(18);
    sound.tock();
    setSent({ amount, lot: lot.id });
    trace('sent', { src, amount, shownMin: shown.current.min, top: top?.amount ?? null });
    act({ t: 'bid', lot: lot.id, amount });
  };

  if (core.phase === 'dutch' && lot?.dutch) return <DutchConsole key={lot.id} room={room} me={me} lot={lot} plan={lot.dutch} rxSlot={rxSlot} />;

  const preview = core.phase === 'preview' || core.phase === 'intro';
  const after = core.phase === 'sold' || core.phase === 'unsold' || core.phase === 'approval';
  const showRing = ['preview', 'bidding', 'sealed', 'intro'].includes(core.phase);
  const going = !!core.callout && core.callout.key.startsWith('going') && bidding;

  // the call line: an alert wins over the time extension, which wins over «على واحد…», which wins over the phase
  let call: ReactNode;
  let alert = false;
  if (showOutbid) {
    call = (
      <>
        زاودوا عليك
        <span className="cs-call-x">
          ، المطلوب <span className="print ltr">{money(min)}</span>
        </span>
      </>
    );
    alert = true;
  } else if (low && top) {
    call = (
      <>
        سبقك أحد
        <span className="cs-call-x">
          ، السوم صار <span className="print ltr">{money(top.amount)}</span>
        </span>
      </>
    );
    alert = true;
  } else if (ext && bidding) call = 'تمدد الوقت';
  else if (core.paused) call = 'المزاد واقف';
  else if (going) call = core.callout!.text;
  else call = phaseText(core, lot);

  // ---- the body under the tag
  const total = lot ? feesOf(min, lot.fee).total : min;
  let body: ReactNode = null;
  let kind = 'bid';
  if (after) {
    kind = 'after';
    body = (
      <div className="cs-next">
        <TireLoader className="tl-inline" size={26} label={core.paused ? 'المزاد واقف' : 'السيارة الجاية في الطريق'} />
      </div>
    );
  } else if (preview) {
    kind = 'preview';
    body = (
      <p className="cs-foot-t cs-stack">
        {lot?.kind === 'dutch' && lot.dutch ? (
          <span className="nb">
            هولندي: يبدأ من <span className="ltr">{money(lot.dutch.start)}</span> وينزل لين <span className="ltr">{money(lot.dutch.floor)}</span>
          </span>
        ) : (
          <span>{lot?.kind === 'sealed' ? 'ظرف مختوم، كل واحد يكتب سومه ومحد يشوفه' : 'اقرأ التقرير، السوم يفتح بعد المعاينة'}</span>
        )}
        <span className="nb">
          تقدر لين <span className="ltr">{money(maxBid)}</span>
        </span>
      </p>
    );
  } else if (spectator) {
    kind = 'calm';
    body = <Calm icon="eye" title="أنت متفرج بهالجولة" sub="تابع السوم وتفاعل مع الشباب" />;
  } else if (garageFull) {
    kind = 'calm';
    body = <Calm icon="car" title="كراجك فل" sub="تفرّج وقيّم السيارات، والتفاعل شغّال" />;
  } else if (offline) {
    kind = 'calm';
    body = <Calm icon="info" title="مقطوع، نرجّع الخط…" sub="السوم يرجع لك أول ما يرجع الخط، والساعة ماشية" tone="off" />;
  } else if (core.paused) {
    kind = 'calm';
    body = (
      <Calm
        icon="pause"
        title="المزاد واقف"
        sub={core.away ? 'الدلال طلع من الصفحة، يكمّل أول ما يرجع' : 'الدلال وقّفه، يكمّل بعد شوي'}
      />
    );
  } else if (core.phase === 'sealed' ? core.opening > maxBid && mine == null : min > maxBid && !iAmTop) {
    kind = 'calm';
    body = (
      <Calm
        icon="wallet"
        title="رصيدك ما يكفي هالسيارة"
        sub={
          <>
            تقدر لين <span className="ltr">{money(maxBid)}</span> · تفرّج وتفاعل لين تجي سيارة على قدك
          </>
        }
      />
    );
  } else if (core.phase === 'sealed' && lot) {
    kind = 'sealed';
    body = <Envelope room={room} lot={lot} maxBid={maxBid} step={step} mine={mine} />;
  } else if (iAmTop && top) {
    kind = 'hold';
    body = (
      <div className="cs-hold" role="status" aria-live="polite">
        <div className="cs-hold-r">
          <b className="voice">السوم عندك</b>
          <span className="cs-hold-a">
            <b className="print ltr">{money(top.amount)}</b>
            <small>ريال</small>
          </span>
        </div>
        <span className="cs-hold-s">لا أحد يزيد عليك لين تخلص الساعة</span>
      </div>
    );
  } else {
    const off = !bidding || sending;
    const label = showOutbid ? 'زاود عليه' : top ? 'زاود' : 'افتح السوم';
    body = (
      <>
        <button
          type="button"
          className={`cs-main bid-main${sending ? ' is-sending' : ''}${frozen ? ' is-frozen' : ''}`}
          disabled={off}
          aria-disabled={frozen || undefined}
          onClick={() => bid(min, 'main')}
          aria-label={`${label} ${money(min)} ريال`}
        >
          {sending && sent ? (
            <>
              <span className="cs-main-l">
                <span className="cs-spin" aria-hidden="true" />
                سومك في الطريق
              </span>
              <span className="cs-main-a">
                <b className="print ltr">{money(sent.amount)}</b>
                <small>ريال</small>
              </span>
            </>
          ) : (
            <>
              <span className="cs-main-l voice">{label}</span>
              <span className="cs-main-a">
                <b className="print ltr">{money(min)}</b>
                <small>ريال</small>
              </span>
            </>
          )}
        </button>
        <div className={`cs-raise${frozen ? ' is-frozen' : ''}`} role="group" aria-label="زوّد أكثر">
          {chips.map((c, i) => (
            <button
              key={c.n}
              type="button"
              className="cs-key"
              disabled={off || c.amount > maxBid}
              aria-disabled={frozen || undefined}
              onClick={() => {
                const a = shown.current.chips[i] ?? c.amount;
                bid(a, `chip${c.n}`);
              }}
              aria-label={`سُم ${money(c.amount)} ريال`}
            >
              <b className="print ltr">+{money(c.delta)}</b>
              <small className="ltr">{money(c.amount)}</small>
            </button>
          ))}
          <button type="button" className="cs-key is-free" disabled={off} onClick={() => setCustom(true)}>
            <b>سوم حر</b>
            <small>اكتب مبلغك</small>
          </button>
        </div>
      </>
    );
  }

  const tagState = top ? 'live' : 'open';
  const showTag = !after && core.phase !== 'sealed' && lot;
  const short12 = (n: string) => (n.length > 12 ? `${n.slice(0, 11)}…` : n);
  const tagLabel = top && short && topP ? (iAmTop ? 'السوم عندك' : `السوم عند ${short12(topP.name)}`) : top ? undefined : lot?.kind === 'sealed' ? 'أقل ظرف' : lot?.kind === 'dutch' ? 'يبدأ من' : 'يفتح على';
  const canBid = kind === 'bid' || kind === 'hold';

  return (
    <section
      className={`cs cs--${kind}${short ? ' is-short' : ''}${showOutbid || (low && top) ? ' is-outbid' : ''}`}
      aria-label="لوحة المزايدة"
      data-cs={kind}
    >
      <HostBar room={room} />
      <StatusRow
        clock={showRing ? <ClockRing core={core} offset={offset} live={core.phase === 'bidding'} /> : null}
        call={call}
        alert={alert}
        rxSlot={rxSlot}
      />
      {lot && !after && <FactLine items={lotFacts(lot, core.reserveMet)} />}
      {showTag && (
        <PriceTag
          key={lot.id}
          className={iAmTop ? 'cs-tag cs-tag-mine' : 'cs-tag'}
          state={tagState}
          label={tagLabel}
          amount={top?.amount ?? (lot.kind === 'dutch' && lot.dutch ? lot.dutch.start : core.opening)}
          who={top && topP ? { no: topP.paddle, name: iAmTop ? 'أنت' : topP.name } : null}
          compact={short}
        />
      )}
      {body}
      {custom && kind === 'bid' && lot && (
        <FreeBid
          min={min}
          maxBid={maxBid}
          cash={cash}
          estTop={lot.estimate ? lot.estimate[1] : null}
          price={top?.amount ?? core.opening}
          live={bidding && !offline}
          onBid={(a) => bid(a, 'free')}
          onClose={() => setCustom(false)}
        />
      )}
      {(canBid || kind === 'calm') && core.phase === 'bidding' && (
        <div className="cs-foot">
          <p className="cs-foot-t">
            {canBid && bidding && kind === 'bid' && (
              <span className="nb">
                مع السعي والضريبة <span className="ltr">{money(total)}</span>
              </span>
            )}
            <span className="nb">
              تقدر لين <span className="ltr">{money(maxBid)}</span>
            </span>
          </p>
          <button type="button" className="cs-log" onClick={onLog}>
            سجل السوم (<span className="ltr">{core.log.length}</span>)
          </button>
        </div>
      )}
    </section>
  );
}

/** The bid log: ruled rows, newest first: paddle, name, amount in Print. */
export function BidLog({ core, myId, onClose }: { core: Core; myId: string; onClose: () => void }) {
  const ref = useSheet(true, onClose);
  const who = (id: string) => core.players.find((p) => p.id === id);
  return (
    <>
      <div className="cs-back" onClick={onClose} aria-hidden="true" />
      <div className="cs-sheet cs-logsheet" role="dialog" aria-modal="true" aria-label="سجل السوم" ref={ref}>
        <div className="cs-sheet-head">
          <h3 className="voice">سجل السوم</h3>
          <button type="button" className="cs-x" aria-label="سكّر" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        <ol className="cs-logrows" aria-live="polite">
          {[...core.log].reverse().map((l) => {
            const p = who(l.by);
            const me = l.by === myId;
            return (
              <li key={l.id} className={me ? 'is-me' : undefined}>
                <Paddle n={p?.paddle ?? 0} me={me} />
                <span className="cs-log-n">
                  {me ? 'أنت' : p?.name ?? ''}
                  {l.jump > increment(l.amount - l.jump) * 4 ? <em> رمية</em> : null}
                </span>
                <b className="print ltr">{money(l.amount)}</b>
              </li>
            );
          })}
          <li className="is-open">
            <span className="cs-log-n">يفتح على</span>
            <b className="print ltr">{money(core.opening)}</b>
          </li>
        </ol>
        <button type="button" className="cs-quiet cs-block" onClick={onClose}>
          سكّر
        </button>
      </div>
    </>
  );
}
