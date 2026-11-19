import type { PlatePub } from '../../engine/types';
import { indic, money } from '../../lib/util';

/** The national emblem as pressed on the plate's KSA strip: a date palm standing above two crossed
 *  curved swords, blades up, hilts down. Filled shapes so it still reads at 14px. */
function Emblem() {
  return (
    <svg className="kp-emblem" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        {/* fronds: five filled leaves fanning from the crown */}
        <path d="M12 7.2C10.6 5.4 8.2 4.9 5.6 5.9c2.2.1 4 .8 6.4 1.9Z" />
        <path d="M12 7.2c1.4-1.8 3.8-2.3 6.4-1.3-2.2.1-4 .8-6.4 1.9Z" />
        <path d="M12 7.4C10.2 7 7.9 8 6.6 10.4c1.6-1.3 3.3-2 5.4-2.4Z" />
        <path d="M12 7.4c1.8-.4 4.1.6 5.4 3-1.6-1.3-3.3-2-5.4-2.4Z" />
        <path d="M12 7.2c-.9-1.9-.6-3.8.9-5.2-.5 1.7-.6 3.3-.3 5.2Z" />
        {/* trunk */}
        <path d="M11.35 7.6h1.3l-.25 8.4h-.8Z" />
        {/* swords: curved blades rising from the hilts, crossing under the trunk */}
        <path d="M4.6 10.6c1.6 3.4 5.4 6.6 12.6 8.6l.5-.9c-6.6-2.3-10.3-4.8-13.1-7.7Z" />
        <path d="M19.4 10.6c-1.6 3.4-5.4 6.6-12.6 8.6l-.5-.9c6.6-2.3 10.3-4.8 13.1-7.7Z" />
        {/* guards and grips */}
        <path d="M15.9 17.2l2.7 2.6-.7.7-2.7-2.6Z" />
        <path d="M8.1 17.2l-2.7 2.6.7.7 2.7-2.6Z" />
        <path d="M17.6 19.3l1.9 1.9-.9.9-1.9-1.9Z" />
        <path d="M6.4 19.3l-1.9 1.9.9.9 1.9-1.9Z" />
      </g>
    </svg>
  );
}

/**
 * A Saudi private plate as it sits on the car (long format): numbers on the left — Arabic-Indic
 * over Latin — letters on the right with every Latin letter under its Arabic one (so the Latin
 * reads backwards, exactly like the real plate), and the KSA strip with the emblem at the edge.
 * Special plates get an alloy rim and their tag.
 */
export function CarPlate({ plate, size = 'md', showValue }: { plate: PlatePub; size?: 'sm' | 'md' | 'lg'; showValue?: boolean }) {
  const sp = plate.special;
  const ar = plate.ar.split(/\s+/).filter(Boolean);
  const en = plate.en.split(/\s+/).filter(Boolean);
  return (
    <div className={`kplate ${size} ${sp ? `special ${sp.tier}` : ''}`} role="img" aria-label={`لوحة ${plate.ar} ${plate.num}${sp ? `، ${sp.label}` : ''}`}>
      <div className="kp-face">
        <span className="kp-c kp-num ar">{indic(plate.num)}</span>
        <span className="kp-c kp-let ar">
          {ar.map((l, i) => (
            <i key={i}>{l}</i>
          ))}
        </span>
        <span className="kp-c kp-num en">{plate.num}</span>
        <span className="kp-c kp-let en">
          {en.map((l, i) => (
            <i key={i}>{l}</i>
          ))}
        </span>
        <span className="kp-band" aria-hidden="true">
          <Emblem />
          <b>K</b>
          <b>S</b>
          <b>A</b>
        </span>
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
      <span className="band">
        <b>K</b>
        <b>S</b>
        <b>A</b>
      </span>
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
