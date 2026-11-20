// The live price on a white paper tag cut like the logo's tag: a blunt chamfered nose and a punched hole on the
// left whatever the text direction, string through the hole, lying tilted on the surface. The price reads from
// the right; who holds the bid sits after the perforation. When the amount changes the digits roll and the tag
// ticks once on its string; nothing else moves.
import { useLayoutEffect, useRef, useState } from 'react';
import { RollNumber } from './RollNumber';

export type PriceTagState = 'open' | 'live' | 'final';

const LABEL: Record<PriceTagState, string> = { open: 'يفتح على', live: 'السوم الحالي', final: 'رسا على' };

export function PriceTag({
  label,
  amount,
  unit = 'ريال',
  who,
  mine = false,
  state = 'live',
  className,
}: {
  label?: string;
  amount: number;
  unit?: string;
  who?: { no: number; name: string } | null;
  mine?: boolean;
  state?: PriceTagState;
  className?: string;
}) {
  // the tick: alternate between two identical keyframes so each change restarts it without a reflow
  const [tick, setTick] = useState(0);
  const last = useRef(amount);
  useLayoutEffect(() => {
    if (last.current === amount) return;
    last.current = amount;
    setTick((t) => t + 1);
  }, [amount]);

  const digits = String(Math.round(Math.abs(amount))).length;
  const size = digits >= 7 ? 'xl' : digits === 6 ? 'l' : 'm';

  return (
    <div
      className={`ptag ptag-${state} ptag-${size}${mine ? ' is-mine' : ''}${className ? ` ${className}` : ''}`}
      data-tick={tick === 0 ? undefined : tick % 2 ? 'a' : 'b'}
    >
      <div className="ptag-lift">
        {/* the strand that runs behind the tag: visible through the hole and above the top edge */}
        <svg className="ptag-string ptag-string-back" viewBox="0 0 48 80" aria-hidden>
          <path d="M32 68 C 30 48, 21 24, 10 6" />
        </svg>
        <div className="ptag-paper">
          <svg className="ptag-nose" viewBox="0 0 40 84" preserveAspectRatio="none" aria-hidden>
            <polyline points="40.5,5 36.2,5 5,39 5,45 36.2,79 40.5,79" />
          </svg>
          <span className="ptag-rule" aria-hidden />
          <span className="ptag-rim" aria-hidden />

          <div className="ptag-price">
            <span className="ptag-label">{label ?? LABEL[state]}</span>
            <span className="ptag-amount">
              <RollNumber value={amount} className="ptag-num" />
              <span className="ptag-unit">{unit}</span>
            </span>
          </div>

          <span className="ptag-perf" aria-hidden />

          <div className="ptag-who">
            {who ? (
              <>
                <span className="ptag-disc">{who.no}</span>
                <span className="ptag-name">{mine ? 'ماسك السوم' : who.name}</span>
              </>
            ) : (
              <span className="ptag-none">ما أحد سام</span>
            )}
          </div>
        </div>
        {/* the strand in front: leaves the hole over the paper */}
        <svg className="ptag-string ptag-string-front" viewBox="0 0 48 80" aria-hidden>
          <path d="M29.5 66 C 21 51, 13 30, 10 6" />
          {/* the knot where the two strands are tied, and its two short ends */}
          <path className="ptag-knot-ends" d="M10 6 C 8 2, 6 0, 4 -3 M10 6 C 12 2, 13 0, 15 -2" />
          <circle className="ptag-knot" cx="10" cy="6" r="2.1" />
        </svg>
      </div>
    </div>
  );
}
