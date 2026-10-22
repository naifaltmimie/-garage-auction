import type { PlatePub } from '../../engine/types';
import { indic, money } from '../../lib/util';

/**
 * A Saudi private plate as it sits on the car: numbers on the left (Arabic-Indic over Latin),
 * letters on the right, the KSA band at the edge. Special plates get a gold rim and their tag.
 */
export function CarPlate({ plate, size = 'md', showValue }: { plate: PlatePub; size?: 'sm' | 'md' | 'lg'; showValue?: boolean }) {
  const sp = plate.special;
  return (
    <div className={`kplate ${size} ${sp ? `special ${sp.tier}` : ''}`} role="img" aria-label={`لوحة ${plate.ar} ${plate.num}${sp ? `، ${sp.label}` : ''}`}>
      <div className="kp-face">
        <div className="kp-cell kp-num">
          <span className="ar">{indic(plate.num)}</span>
          <span className="en">{plate.num}</span>
        </div>
        <i className="kp-rule" />
        <div className="kp-cell kp-let">
          <span className="ar">{plate.ar}</span>
          <span className="en">{plate.en}</span>
        </div>
        <div className="kp-band" aria-hidden="true">
          <span className="sa">السعودية</span>
          <b>K</b>
          <b>S</b>
          <b>A</b>
        </div>
      </div>
      {sp && (
        <div className="kp-tag">
          {sp.label}
          {showValue && <span className="ltr"> · {money(sp.value)}</span>}
        </div>
      )}
    </div>
  );
}

/** The player's own plate letters, as a small badge next to their name. */
export function MiniPlate({ letters }: { letters: [string, string] }) {
  return (
    <span className="mplate" aria-hidden="true">
      <span className="c">{letters[1]}</span>
      <span className="band">KSA</span>
    </span>
  );
}

/** Bidder paddle number. */
export function Paddle({ n, me }: { n: number; me?: boolean }) {
  return (
    <span className={`paddle ${me ? 'me' : ''}`} aria-label={`رقم المزايد ${n}`}>
      {n > 0 ? String(n).padStart(2, '0') : '—'}
    </span>
  );
}
