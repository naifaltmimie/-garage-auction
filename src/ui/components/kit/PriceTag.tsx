// The live price on a white paper tag cut like the logo's tag: a blunt chamfered nose and a punched hole on the
// left whatever the text direction, string through the hole, lying tilted on the surface. The price reads from
// the right; who holds the bid sits after the perforation. When the amount changes the digits roll and the tag
// ticks once on its string; nothing else moves.
// The component's own box includes the room the string rises into (padding-top), so it is placed with normal
// spacing. `compact` is the same tag 60px tall, label and amount only, with no stub and no string: for lists
// and headers.
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
  compact = false,
  className,
}: {
  label?: string;
  amount: number;
  unit?: string;
  who?: { no: number; name: string } | null;
  mine?: boolean;
  state?: PriceTagState;
  compact?: boolean;
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
      className={`ptag ptag-${state} ptag-${size}${compact ? ' ptag-compact' : ''}${mine ? ' is-mine' : ''}${className ? ` ${className}` : ''}`}
    >
      <div className="ptag-body" data-tick={tick === 0 ? undefined : tick % 2 ? 'a' : 'b'}>
        <div className="ptag-lift">
          {/* the strand that runs behind the tag: visible through the hole and above the top edge */}
          {!compact && (
            <svg className="ptag-string ptag-string-back" viewBox="0 0 48 80" aria-hidden>
              <path d="M32 68 C 30 48, 21 24, 10 6" />
            </svg>
          )}
          <div className="ptag-paper">
            {compact ? (
              <svg className="ptag-nose" viewBox="0 0 29.8 60" preserveAspectRatio="none" aria-hidden>
                <polyline points="29.8,4.5 25.3,4.5 4,27.6 4,32.4 25.3,55.5 29.8,55.5" />
              </svg>
            ) : (
              <svg className="ptag-nose" viewBox="0 0 40 84" preserveAspectRatio="none" aria-hidden>
                <polyline points="40.8,5.5 35.9,5.5 5,39 5,45 35.9,78.5 40.8,78.5" />
              </svg>
            )}
            <span className="ptag-rule" aria-hidden />
            <span className="ptag-rim" aria-hidden />

            <div className="ptag-price">
              <span className="ptag-label">{label ?? LABEL[state]}</span>
              <span className="ptag-amount">
                <RollNumber value={amount} className="ptag-num" />
                <span className="ptag-unit">{unit}</span>
              </span>
            </div>

            {!compact && (
              <>
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
              </>
            )}
          </div>
          {/* the strand in front: leaves the hole over the paper */}
          {!compact && (
            <svg className="ptag-string ptag-string-front" viewBox="0 0 48 80" aria-hidden>
              <path d="M29.5 66 C 21 51, 13 30, 10 6" />
              {/* the knot where the two strands are tied, and its two short ends */}
              <path className="ptag-knot-ends" d="M10 6 C 8 2, 6 0, 4 -3 M10 6 C 12 2, 13 0, 15 -2" />
              <circle className="ptag-knot" cx="10" cy="6" r="2.1" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
