import type { PlatePub } from '../../engine/types';
import { indic, money } from '../../lib/util';

/** How a plate looks beyond its characters. Missing means a private plate, American size, no logo. */
export type PlateKind = 'private' | 'transport' | 'taxi' | 'diplomatic' | 'temporary';
export type PlateLook = { kind?: PlateKind; format?: 'us' | 'eu'; logo?: 'emblem' | 'hegra' | 'diriyah' };

const KINDS: readonly PlateKind[] = ['private', 'transport', 'taxi', 'diplomatic', 'temporary'];
const KIND_AR: Record<PlateKind, string> = {
  private: 'خصوصي',
  transport: 'نقل خاص',
  taxi: 'أجرة',
  diplomatic: 'دبلوماسية',
  temporary: 'مؤقتة',
};

/** The national emblem as pressed on the plate: a date palm with a trunk and a crown of fronds, standing above
 *  two crossed curved swords, blades rising outward, hilts down. Filled shapes so it still reads at 12px. */
export function Emblem({ className = 'sp-emblem' }: { className?: string }) {
  const sword = (
    <g>
      <path d="M8.4 27.5C15 25.7 23 21.4 28.7 14.1 26.7 19.4 19.8 25.4 9.3 29.1Z" />
      <line x1="8.1" y1="26.2" x2="9.5" y2="30.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="8.7" y1="28.4" x2="6.1" y2="29.2" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      <circle cx="5.6" cy="29.4" r=".95" />
    </g>
  );
  const fronds = (
    <g>
      <path d="M16 11.2C12.5 9.6 7.5 10.3 4.1 15 8 12.4 12 11.8 16 12.3Z" />
      <path d="M16 10.7C13.2 7 8.4 6 4.5 7.6 8.8 7.9 12.6 9.3 16 11.5Z" />
      <path d="M16 10.5C15 6.6 12.6 3.6 9.3 2.8 12 5 14 7.7 15.4 10.9Z" />
    </g>
  );
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <g fill="currentColor">
        {fronds}
        <g transform="matrix(-1 0 0 1 32 0)">{fronds}</g>
        <path d="M15.6 10.9C15.3 7.4 15.6 4.4 16.6 1.9 17.3 4.4 17.2 7.6 16.6 11Z" />
        <path d="M15.1 10.9h1.8l.45 13.3h-2.7Z" />
        {sword}
        <g transform="matrix(-1 0 0 1 32 0)">{sword}</g>
      </g>
    </svg>
  );
}

/** The kind's mark at the foot of the strip: a circle, or a triangle pointing up, down or left. */
function KindMark({ kind }: { kind: PlateKind }) {
  if (kind === 'diplomatic') return null;
  const d =
    kind === 'private'
      ? null
      : kind === 'taxi'
        ? 'M5 .9 9.4 8.7H.6Z'
        : kind === 'transport'
          ? 'M.6 1.3h8.8L5 9.1Z'
          : 'M.9 5 8.7.6v8.8Z';
  return (
    <svg className="sp-mark" viewBox="0 0 10 10" aria-hidden="true">
      {d ? <path d={d} fill="currentColor" /> : <circle cx="5" cy="5" r="4.1" fill="currentColor" />}
    </svg>
  );
}

/** The approved logos a plate can carry, as plain line drawings: the emblem, a rock-cut tomb façade of al-Hijr
 *  and the mud-brick skyline of at-Turaif. */
function LogoArt({ logo }: { logo: NonNullable<PlateLook['logo']> }) {
  if (logo === 'emblem') return <Emblem className="sp-logo-art" />;
  if (logo === 'hegra')
    return (
      <svg className="sp-logo-art" viewBox="0 0 32 44" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          {/* the sandstone outcrop the tomb is cut into */}
          <path d="M2 41V15c0-4 2-7 5.5-8.5C9 3.5 12.5 2.6 15.5 3.2 18 1.6 22.5 2 25 4.6c3 1.4 5 4.6 5 8.4V41" />
          {/* crow-step crown: two stepped merlons */}
          <path d="M8 17.5v-1.8h1.6v-1.8h1.6v-1.8h1.6v5.4M24 17.5v-1.8h-1.6v-1.8h-1.6v-1.8h-1.6v5.4" />
          {/* cornices */}
          <path d="M6.6 17.5h18.8M7.4 20h17.2" />
          {/* pilasters with capitals */}
          <path d="M9.5 20v20M22.5 20v20M8.4 22h2.2M21.4 22h2.2" />
          {/* the doorway and its pediment */}
          <path d="M13.2 40v-9.4h5.6V40M12.3 30.6 16 27.2l3.7 3.4Z" />
          <path d="M3.5 40.6h25" />
        </g>
      </svg>
    );
  return (
    <svg className="sp-logo-art" viewBox="0 0 32 44" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
        {/* the tall tapering tower with a saw-tooth parapet */}
        <path d="M11.6 40 12.8 9.6l.9-1.8.9 1.8.9-1.8.9 1.8.9-1.8.9 1.8.9-1.8.9 1.8L20.4 40" />
        {/* the lower houses on each side */}
        <path d="M11.8 21.4H4.2l.6-1.6.7 1.6.7-1.6.7 1.6.7-1.6.7 1.6.7-1.6.7 1.6M4.2 21.4 3.6 40" />
        <path d="M20.2 25.6h8.2l-.6-1.6-.7 1.6-.7-1.6-.7 1.6-.7-1.6-.7 1.6-.7-1.6-.7 1.6M28.4 25.6l.5 14.4" />
        {/* triangular vents and a door */}
        <path d="m14.6 15.2 1.4-2 1.4 2ZM14.6 21.2l1.4-2 1.4 2ZM6.6 27.4l1.2-1.8 1.2 1.8ZM23.4 31l1.2-1.8 1.2 1.8ZM14.5 40v-5.4h3V40" />
        <path d="M2 40.6h28" />
      </g>
    </svg>
  );
}

/** The broad Arabic letters, drawn narrower so each still keeps clear of its neighbours, as on the plate. */
const WIDE: Record<string, string> = { 'ص': 'w2', 'ط': 'w1', 'ق': 'w1', 'ك': 'w1' };

/** One row of characters in equal slots, so every Arabic character sits exactly over its Latin twin. The zero-width
 *  non-joiners keep each Arabic letter in its isolated form, as pressed on the plate. */
function Slots({ chars, cls }: { chars: string[]; cls: string }) {
  return (
    <span className={cls}>
      {chars.map((c, i) => (
        <i key={i} className={WIDE[c]}>{`\u200c${c}\u200c`}</i>
      ))}
    </span>
  );
}

/** The plate face itself: the 2 × 2 field, the strip and the optional logo panel. `en` is in Arabic order. */
function Face({ ar, en, num, kind, logo, word }: { ar: string[]; en: string[]; num: string; kind: PlateKind; logo?: PlateLook['logo']; word: boolean }) {
  return (
    <div className="sp-face">
      {logo && (
        <span className="sp-logo">
          <LogoArt logo={logo} />
        </span>
      )}
      {num && <Slots cls="sp-cell sp-na" chars={[...indic(num)]} />}
      {num && <Slots cls="sp-cell sp-ne" chars={[...num]} />}
      <Slots cls="sp-cell sp-la" chars={ar} />
      <Slots cls="sp-cell sp-le" chars={en} />
      <span className="sp-strip" aria-hidden="true">
        <span className="sp-em">
          <Emblem />
        </span>
        {word && <span className="sp-word">السعودية</span>}
        <span className="sp-ksa">KSA</span>
        <KindMark kind={kind} />
      </span>
    </div>
  );
}

const SIZES = ['sm', 'md', 'lg'] as const;

/**
 * A Saudi plate drawn from the real one (series since 2006): white retro-reflective face, black pressed characters,
 * thin black border. The field is ruled 2 × 2: Arabic-Indic digits and the Arabic letters on top, Western digits and
 * the Latin letters below, each Latin letter under its Arabic one. The strip (emblem, «السعودية», KSA, the kind's
 * mark) stands at the right edge of the American size and in the middle of the long size; its colour tells the kind.
 * Plates with one to three digits are the distinguished ones and show only those digits, centred.
 * Special plates get an alloy rim and their tag.
 */
export function CarPlate({ plate, size = 'md', showValue }: { plate: PlatePub; size?: 'sm' | 'md' | 'lg'; showValue?: boolean }) {
  const look = plate as PlatePub & PlateLook;
  const kind: PlateKind = look.kind && KINDS.includes(look.kind) ? look.kind : 'private';
  const format = look.format === 'eu' ? 'eu' : 'us';
  const logo = look.logo === 'emblem' || look.logo === 'hegra' || look.logo === 'diriyah' ? look.logo : undefined;
  const sz = SIZES.includes(size) ? size : 'md';
  const sp = plate.special;
  const ar = plate.ar.split(/\s+/).filter(Boolean);
  const en = plate.en.split(/\s+/).filter(Boolean);
  const num = String(plate.num ?? '').replace(/[^0-9]/g, '');
  const kindWord = kind === 'private' ? '' : `، ${KIND_AR[kind]}`;
  return (
    <div
      className={`splate ${format} ${sz} k-${kind}${logo ? ' has-logo' : ''}${sp ? ` special t-${sp.tier}` : ''}`}
      role="img"
      aria-label={`لوحة ${plate.ar} ${num}${kindWord}${sp ? `، ${sp.label}` : ''}`}
    >
      <Face ar={ar} en={en} num={num} kind={kind} logo={logo} word={sz !== 'sm'} />
      {sp && (
        <div className="sp-tag">
          <span>{sp.label}</span>
          {showValue && (
            <>
              {' · '}
              <span className="ltr">{money(sp.value)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The player's own plate letters as a miniature private plate beside their name: Arabic over Latin, white strip
 *  with the emblem and the circle. `letters` is [Arabic, Latin in reading order]. */
export function MiniPlate({ letters }: { letters: [string, string] }) {
  const ar = letters[0].split(/\s+/).filter(Boolean);
  const en = letters[1].split(/\s+/).filter(Boolean).reverse();
  return (
    <span className="splate mini us k-private" aria-hidden="true">
      <Face ar={ar} en={en} num="" kind="private" word={false} />
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
