// المزاد الهولندي console: a mechanical price counter that rolls down step by step, a rail toward
// the floor, and one big «أبيها». The price is never counted down here: every frame it is derived
// from the host's timer (time left -> elapsed -> step), and the host decides who said it first.
import { useEffect, useRef, useState } from 'react';
import { dutchElapsed, dutchPriceAt, dutchProgress, dutchSteps } from '../../engine/dutch';
import { feesOf } from '../../engine/rules';
import type { DutchPlan, LotPub, PlayerPub } from '../../engine/types';
import { money, vibrate } from '../../lib/util';
import { sound } from '../../audio/sound';
import { timeLeft, type RoomView } from '../useRoom';
import { countRender, maxBidFor } from './Console';
import '../../styles/dutch.css';

/** One wheel of the counter: when its digit changes the old one drops out and the new one falls in. */
function Wheel({ d }: { d: string }) {
  const [s, setS] = useState({ cur: d, prev: null as string | null, n: 0 });
  if (s.cur !== d) setS({ cur: d, prev: s.cur, n: s.n + 1 });
  return (
    <span className="dc-wheel">
      {s.prev != null && (
        <span key={`o${s.n}`} className="dc-d out" aria-hidden="true">
          {s.prev}
        </span>
      )}
      <span key={`i${s.n}`} className={`dc-d ${s.n ? 'in' : ''}`}>
        {s.cur}
      </span>
    </span>
  );
}

function Counter({ value }: { value: number }) {
  const chars = money(value).split('');
  return (
    <span className="dc-counter ltr" aria-label={`${money(value)} ريال`}>
      {chars.map((c, i) => {
        const pos = chars.length - i; // keyed from the right so the units never jump wheels
        return /\d/.test(c) ? <Wheel key={`w${pos}`} d={c} /> : <span key={`s${pos}`} className="dc-sep">{c}</span>;
      })}
    </span>
  );
}

/** Preview strip line: what this dutch lot will do once the report is read. */
export function DutchHint({ plan }: { plan: DutchPlan }) {
  return (
    <div className="dc-hint">
      <span className="dc-tag">مزاد هولندي</span>
      <span>
        يبدأ من <b className="t-money">{money(plan.start)}</b> وينزل لين <b className="t-money">{money(plan.floor)}</b>
      </span>
    </div>
  );
}

/**
 * Reads the host's clock at `hz` but only re-renders when the value derived from it changes (a price
 * step, a whole second), so the panel redraws about once per step instead of 24 times a second.
 */
export function useClockValue<T extends string | number>(offset: number, hz: number, read: (now: number) => T, deps: unknown[]): T {
  const readRef = useRef(read);
  readRef.current = read;
  const [v, setV] = useState(() => read(Date.now() + offset));
  useEffect(() => {
    const tick = () => setV(readRef.current(Date.now() + offset));
    tick();
    const iv = setInterval(tick, 1000 / hz);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, hz, ...deps]);
  return v;
}

export function DutchConsole({ room, me, lot, plan }: { room: RoomView; me: PlayerPub | undefined; lot: LotPub; plan: DutchPlan }) {
  const { snap, offset, act, host, spectator } = room;
  const core = snap.core!;
  countRender('dutch');
  // step index, plus the hold seconds once the price sits on the floor; derived from the host's timer
  const tickKey = useClockValue(
    offset,
    24,
    (now) => {
      const { ms } = timeLeft(core, now);
      const el = dutchElapsed(core.timer, ms);
      const st = Math.min(dutchSteps(plan), Math.floor(el / plan.every));
      return dutchPriceAt(plan, el) <= plan.floor ? `${st}|${Math.max(0, Math.ceil(ms / 1000))}` : `${st}`;
    },
    [core.timer, core.paused, plan],
  );
  const [stepStr, holdStr] = tickKey.split('|');
  const step = Number(stepStr);
  const price = Math.max(plan.floor, plan.start - step * plan.step);
  const prog = dutchProgress(plan, price);
  const onFloor = price <= plan.floor;
  // tension: calm, warmer past halfway, gold close to the floor, red for the last steps and the floor
  const heat = onFloor || prog >= 0.9 ? 3 : prog >= 0.72 ? 2 : prog >= 0.45 ? 1 : 0;

  const cash = me?.cash ?? 0;
  const maxBid = maxBidFor(cash, lot);
  const garageFull = !!me && me.garage.length >= core.settings.garage;
  const canPay = price <= maxBid;
  const total = feesOf(price, lot.fee).total;

  // a soft mechanical click on every step down, sharper as the floor gets close
  const lastStep = useRef(step);
  useEffect(() => {
    if (step !== lastStep.current && !core.paused) {
      sound.tick(heat >= 2);
      if (heat === 3) vibrate(8);
    }
    lastStep.current = step;
  }, [step, heat, core.paused]);

  // the tap shows at once; the host's answer (sold, or a refusal toast) clears it
  const [sent, setSent] = useState<{ at: number; lot: string } | null>(null);
  const sending = !!sent && sent.lot === lot.id && Date.now() - sent.at < 2500;
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 2600);
    return () => clearTimeout(t);
  }, [sent]);
  const [pressAt, setPressAt] = useState(0);

  const reason = spectator
    ? 'أنت متفرج بهالجولة'
    : garageFull
      ? 'كراجك فل'
      : core.paused
        ? 'المزاد واقف'
        : !canPay
          ? maxBid >= plan.floor
            ? `تقدر عليها إذا نزلت تحت ${money(maxBid)}`
            : 'رصيدك ما يغطيها حتى على الأرضية'
          : '';

  // a second tap before the re-render (or within 2.5 s of the first) is the same tap
  const lastTake = useRef(0);
  const take = () => {
    if (reason || sending) return;
    const t = performance.now();
    if (t - lastTake.current < 2500) return;
    lastTake.current = t;
    vibrate([28, 30, 50]);
    sound.tock();
    setPressAt(Date.now());
    setSent({ at: Date.now(), lot: lot.id });
    act({ t: 'take', lot: lot.id });
  };

  // rail marks: the estimate band and how far down this player can afford
  const pos = (v: number) => Math.max(0, Math.min(1, (plan.start - v) / Math.max(1, plan.start - plan.floor)));
  const est = lot.estimate;
  const myMark = !spectator && !garageFull && maxBid < plan.start && maxBid >= plan.floor ? pos(maxBid) : null;
  const holdSecs = holdStr ? Number(holdStr) : 0;

  return (
    <section className="bidpanel dutch-panel" data-heat={heat} aria-label="المزاد الهولندي">
      {host && (
        <div className="host-bar" role="toolbar" aria-label="أدوات المضيف">
          <span className="hb-label">أنت الدلال</span>
          {core.paused ? (
            <button className="hb on" onClick={host.resume}>كمّل المزاد</button>
          ) : (
            <button className="hb" onClick={host.pause}>وقف مؤقت</button>
          )}
          <button className="hb" onClick={host.skip}>شيل السيارة</button>
        </div>
      )}

      <div className="dc-head">
        <span className="dc-tag">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 1v8M2.5 6 6 9.5 9.5 6" />
          </svg>
          مزاد هولندي
        </span>
        <span className="dc-call" key={core.callout?.id ?? 0} aria-live="polite">
          {core.paused ? (core.away ? 'المضيف طلع من الصفحة، المزاد واقف' : 'المزاد واقف') : onFloor ? `وصلت الأرضية، ترجع للمعرض بعد ${holdSecs} ث` : core.callout?.text ?? 'السعر ينزل، أول واحد يقول أبيها ياخذها'}
        </span>
      </div>

      <div className="dc-board">
        <div className="dc-window">
          <Counter value={price} />
          <span className="dc-cur">ريال</span>
        </div>
        <div className="dc-meta">
          <span>
            ينزل <b className="t-money">{money(plan.step)}</b> كل {String(plan.every / 1000)} ث
          </span>
          {!spectator && <span>عليك مع السعي <b className="t-money">{money(total)}</b></span>}
        </div>
      </div>

      <div className="dc-rail" aria-hidden="true">
        <div className="dc-track">
          {est && <span className="dc-band" style={{ insetInlineStart: `${pos(est[1]) * 100}%`, width: `${(pos(est[0]) - pos(est[1])) * 100}%` }} />}
          <span className="dc-fill" style={{ transform: `scaleX(${prog})`, transitionDuration: `${plan.every}ms` }} />
          {myMark != null && <span className="dc-mine" style={{ insetInlineStart: `${myMark * 100}%` }} />}
        </div>
        <div className="dc-ends">
          <span>
            بدأ <b className="t-money">{money(plan.start)}</b>
          </span>
          {est && <span className="dc-est">التقدير</span>}
          {myMark != null && <span className="dc-mine-l">حدّك {money(maxBid)}</span>}
          <span>
            الأرضية <b className="t-money">{money(plan.floor)}</b>
          </span>
        </div>
      </div>

      <button
        className={`dc-take ${sending ? 'sending' : ''}`}
        disabled={!!reason || sending}
        onClick={take}
        aria-label={reason || `أبيها بـ ${money(price)} ريال`}
      >
        {pressAt > 0 && <span key={pressAt} className="dc-ring" aria-hidden="true" />}
        <b>{sending ? 'وصلت أبيها…' : 'أبيها'}</b>
        <small>{reason || (sending ? 'ننتظر الدلال' : `بـ ${money(price)} ريال`)}</small>
      </button>
    </section>
  );
}
