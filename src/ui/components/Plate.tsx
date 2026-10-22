import type { PlatePub } from '../../engine/types';
import { indic, money } from '../../lib/util';

/** The palm and crossed swords, as printed small on the plate's KSA strip. */
function Emblem() {
  return (
    <svg className="kp-emblem" viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 14.2V6.8" strokeWidth="1.5" />
        <path d="M12 6.8c-1.9-1.7-4.3-1.9-6.2-.7M12 6.8c1.9-1.7 4.3-1.9 6.2-.7M12 6.8c-1.6-.3-3.3.8-4.1 2.5M12 6.8c1.6-.3 3.3.8 4.1 2.5M12 6.8c-.6-1.6-.2-3.2 1-4.3" strokeWidth="1.25" />
        <path d="M5.2 20c3.6-1 7.8-3.3 13.4-7.6M18.8 20c-3.6-1-7.8-3.3-13.4-7.6" strokeWidth="1.35" />
        <path d="M6 18.1l1.4 2.3M18 18.1l-1.4 2.3" strokeWidth="1.15" />
      </g>
    </svg>
  );
}

/**
 * A Saudi private plate as it sits on the car (long format): numbers on the left — Arabic-Indic
 * over Latin — letters on the right with every Latin letter under its Arabic one (so the Latin
 * reads backwards, exactly like the real plate), and the KSA strip with the emblem at the edge.
 * Special plates get a gold rim and their tag.
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
