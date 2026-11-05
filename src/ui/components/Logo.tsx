/**
 * The brand mark of مزاد الكراج: an auctioneer's gavel whose head is a Saudi number plate.
 *
 * The head carries the plate's own geometry: the black border, the face split in four (numbers |
 * letters, Arabic over Latin) and the nationality strip at the end, here with three dots where
 * K·S·A sit. The gavel's shaft continues the plate's centre divider, so plate and gavel share one
 * axis. Everything is drawn on a 64-unit grid, tilted 45°, in currentColor.
 *
 * `full` is the mark from ~24px up; `compact` (solid head, strip cut off by a gap) is for favicons
 * and anything ≤ 20px, where the plate's fine lines would turn to mush.
 */

type MarkProps = {
  size?: number | string;
  variant?: 'full' | 'compact';
  className?: string;
  title?: string;
};

/** Shared placement: centre of the shaft at the head, then the 45° tilt (head up-left, toward the name in RTL). */
const AXIS = 'translate(38.4 38.4) rotate(-45)';

function FullMark() {
  return (
    <g transform={AXIS}>
      {/* plate border */}
      <rect x="-20.1" y="-21.6" width="40.2" height="15.2" rx="3.1" fill="none" stroke="currentColor" strokeWidth="3.8" />
      {/* the plate's cross: Arabic over Latin, numbers | letters; the vertical one runs into the shaft */}
      <path d="M-20 -14H11.6M0 -21.6V-6.4" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* nationality strip with K·S·A knocked out */}
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M11.6 -23.5H17a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H11.6z M16.8 -19.7a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6z M16.8 -15.3a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6z M16.8 -10.9a1.3 1.3 0 1 0 0 2.6a1.3 1.3 0 1 0 0-2.6z"
      />
      {/* shaft */}
      <rect x="-3.7" y="-6" width="7.4" height="29.5" rx="3.7" fill="currentColor" />
    </g>
  );
}

function CompactMark() {
  return (
    <g transform={AXIS} fill="currentColor">
      <path d="M10.2 -23.5H-17a5 5 0 0 0-5 5v9a5 5 0 0 0 5 5H10.2z" />
      <path d="M13.4 -23.5H17a5 5 0 0 1 5 5v9a5 5 0 0 1-5 5H13.4z" />
      <rect x="-3.9" y="-5" width="7.8" height="28.5" rx="3.9" />
    </g>
  );
}

/** The mark alone. Colour comes from `color` (currentColor). */
export function LogoMark({ size = 28, variant = 'full', className, title }: MarkProps) {
  return (
    <svg
      className={['logomark', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {variant === 'compact' ? <CompactMark /> : <FullMark />}
    </svg>
  );
}

/**
 * Mark + name. The name is set in IBM Plex Sans Arabic Bold (never letter-spaced, so the letters
 * stay joined); «الكراج» takes the gold. `twin` adds the Latin line under it, the way the plate
 * prints Latin under Arabic.
 */
export function Wordmark({ size = 28, twin = false, className }: { size?: number; twin?: boolean; className?: string }) {
  return (
    <span className={['wordmark', twin ? 'has-twin' : '', className].filter(Boolean).join(' ')} role="img" aria-label="مزاد الكراج">
      <LogoMark size={size} className="wordmark-mark" />
      <span className="wordmark-text" aria-hidden="true">
        <span className="wordmark-name">
          مزاد <b>الكراج</b>
        </span>
        {twin && <span className="wordmark-twin">MAZAD AL-KARAJ</span>}
      </span>
    </span>
  );
}
