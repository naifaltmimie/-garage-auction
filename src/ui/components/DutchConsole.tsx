// المزاد الهولندي: the same bidding block, with a mechanical price board that rolls down step by step, a rail toward
// the lowest price, and one «أبيها». The price is never counted down here: every frame it is derived from the host's
// timer (time left -> elapsed -> step), and the host decides who said it first. The board and the button read the
// same number in the same render, and a digit change finishes in 120ms, so they never disagree.
import { useEffect, useRef, useState } from 'react';
import { dutchElapsed, dutchPriceAt, dutchProgress, dutchSteps } from '../../engine/dutch';
import { feesOf } from '../../engine/rules';
import type { DutchPlan, LotPub, PlayerPub } from '../../engine/types';
import { money, vibrate } from '../../lib/util';
import { sound } from '../../audio/sound';
import { timeLeft, type RoomView } from '../useRoom';
import { countRender, FactLine, HostBar, lotFacts, maxBidFor, StatusRow } from './Console';

/** One drum of the board: when its digit changes the old one drops out and the new one falls in (120ms). */
function Drum({ d }: { d: string }) {
  const [s, setS] = useState({ cur: d, prev: null as string | null, n: 0 });
  if (s.cur !== d) setS({ cur: d, prev: s.cur, n: s.n + 1 });
  return (
    <span className="cs-drum">
      {s.prev != null && (
        <span key={`o${s.n}`} className="cs-dd out" aria-hidden="true">
          {s.prev}
        </span>
      )}
      <span key={`i${s.n}`} className={`cs-dd${s.n ? ' in' : ''}`}>
        {s.cur}
      </span>
    </span>
  );
}

function Board({ value }: { value: number }) {
  const chars = money(value).split('');
  return (
    <span className="cs-board-n print" dir="ltr" aria-label={`${money(value)} ريال`}>
      {chars.map((c, i) => {
        const pos = chars.length - i; // keyed from the right so the units never jump drums
        return /\d/.test(c) ? <Drum key={`w${pos}`} d={c} /> : <span key={`s${pos}`} className="cs-board-sep">{c}</span>;
      })}
    </span>
  );
}

/** The falling-arrow mark that stands where the clock stands on other lots. */
function DutchMark() {
  return (
    <span className="cs-dmark" aria-hidden="true">
      <svg viewBox="0 0 256 256" width="20" height="20" fill="currentColor">
        {/* Phosphor "arrow-down" (bold), MIT */}
        <path d="M208.49,152.49l-72,72a12,12,0,0,1-17,0l-72-72a12,12,0,0,1,17-17L116,187V40a12,12,0,0,1,24,0V187l51.51-51.52a12,12,0,0,1,17,17Z" />
      </svg>
    </span>
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

export function DutchConsole({
  room,
  me,
  lot,
  plan,
  rxSlot,
}: {
  room: RoomView;
  me: PlayerPub | undefined;
  lot: LotPub;
  plan: DutchPlan;
  rxSlot?: (el: HTMLDivElement | null) => void;
}) {
  const { snap, offset, act, spectator } = room;
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
  // tension: chalk while it falls, caliper red only for the last steps and the floor
  const heat = onFloor || prog >= 0.9 ? 3 : prog >= 0.72 ? 2 : prog >= 0.45 ? 1 : 0;

  const cash = me?.cash ?? 0;
  const maxBid = maxBidFor(cash, lot);
  const garageFull = !!me && me.garage.length >= core.settings.garage;
  const canPay = price <= maxBid;
  const total = feesOf(price, lot.fee).total;
  const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || !room.net.connected || (room.role !== 'host' && room.net.hostGone);

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
  const [sent, setSent] = useState<{ at: number; lot: string; price: number } | null>(null);
  const sending = !!sent && sent.lot === lot.id && Date.now() - sent.at < 2500;
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => setSent(null), 2600);
    return () => clearTimeout(t);
  }, [sent]);

  const reason = spectator
    ? 'أنت متفرج بهالجولة'
    : garageFull
      ? 'كراجك فل'
      : offline
        ? 'مقطوع، نرجّع الخط'
        : core.paused
          ? 'المزاد واقف'
          : !canPay
            ? maxBid >= plan.floor
              ? `تقدر عليها إذا نزلت تحت ${money(maxBid)}`
              : 'رصيدك ما يغطيها حتى بأقل سعر'
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
    setSent({ at: Date.now(), lot: lot.id, price });
    act({ t: 'take', lot: lot.id });
  };

  // rail marks: the estimate band and how far down this player can afford
  const pos = (v: number) => Math.max(0, Math.min(1, (plan.start - v) / Math.max(1, plan.start - plan.floor)));
  const est = lot.estimate;
  const myMark = !spectator && !garageFull && maxBid < plan.start && maxBid >= plan.floor ? pos(maxBid) : null;
  const holdSecs = holdStr ? Number(holdStr) : 0;

  const call = core.paused ? 'المزاد واقف' : onFloor ? `أقل سعر، باقي ${holdSecs} ث` : 'اللي يسبق ياخذها';

  return (
    <section className="cs cs--dutch dutch-panel" data-heat={heat} data-cs="dutch" aria-label="المزاد الهولندي">
      <HostBar room={room} />
      <StatusRow clock={<DutchMark />} call={call} rxSlot={rxSlot} />
      <FactLine items={lotFacts(lot, false)} />

      <div className="cs-board">
        <div className="cs-board-w">
          <Board value={price} />
          <span className="cs-board-u">ريال</span>
        </div>
        <p className="cs-board-meta">
          <span className="nb">
            ينزل <span className="ltr">{money(plan.step)}</span> كل <span className="ltr">{String(plan.every / 1000)}</span> ث
          </span>
          {!spectator && (
            <span className="nb">
              عليك مع السعي <span className="ltr">{money(total)}</span>
            </span>
          )}
        </p>
      </div>

      <div className="cs-rail" aria-hidden="true">
        <div className="cs-track">
          {est && <span className="cs-band" style={{ insetInlineStart: `${pos(est[1]) * 100}%`, width: `${(pos(est[0]) - pos(est[1])) * 100}%` }} />}
          <span className="cs-fill" style={{ transform: `scaleX(${prog})`, transitionDuration: `${plan.every}ms` }} />
          {myMark != null && <span className="cs-mine" style={{ insetInlineStart: `${myMark * 100}%` }} />}
        </div>
        <div className="cs-ends">
          <span>
            بدأ <span className="ltr">{money(plan.start)}</span>
          </span>
          {myMark != null ? (
            <span className="cs-ends-me">
              حدّك <span className="ltr">{money(maxBid)}</span>
            </span>
          ) : est ? (
            <span className="cs-ends-est">التقدير</span>
          ) : null}
          <span>
            أقل سعر <span className="ltr">{money(plan.floor)}</span>
          </span>
        </div>
      </div>

      <button
        type="button"
        className={`cs-main bid-main dc-take${sending ? ' is-sending' : ''}`}
        disabled={!!reason || sending}
        onClick={take}
        aria-label={reason || `أبيها بـ ${money(price)} ريال`}
      >
        {reason ? (
          <span className="cs-main-why">{reason}</span>
        ) : sending && sent ? (
          <>
            <span className="cs-main-l">
              <span className="cs-spin" aria-hidden="true" />
              ننتظر الدلال
            </span>
            <span className="cs-main-a">
              <b className="print ltr">{money(sent.price)}</b>
              <small>ريال</small>
            </span>
          </>
        ) : (
          <>
            <span className="cs-main-l voice">أبيها</span>
            <span className="cs-main-a">
              <b className="print ltr">{money(price)}</b>
              <small>ريال</small>
            </span>
          </>
        )}
      </button>
    </section>
  );
}
