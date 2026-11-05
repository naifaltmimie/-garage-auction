/**
 * مزاد الكراج — the price-tag logo.
 *
 * «مزاد» sits on a red auction tag over «الكراج», set in heavy hand-cut letters: every alef and lam
 * cut on the same slant, the dots turned to diamonds, the whole thing held by one dark contour with
 * a solid drop. It's drawn as outlines (public/brand/*.svg, built by scripts/brand/craft.py), so it
 * never waits on a font and looks the same on every phone.
 *   lockup.svg      the stacked logo (tag over the word): splash, intro, join screen, TV, share card
 *   lockup-row.svg  tag beside the word, for the 58px top bars
 *   tag.svg         the tag alone: app icon, favicon, tight spots
 */

const V = '3';

export const LOGO = {
  stack: `/brand/lockup.svg?v=${V}`,
  row: `/brand/lockup-row.svg?v=${V}`,
  tag: `/brand/tag.svg?v=${V}`,
} as const;

/** width / height of each drawing, so the image box is reserved before it loads */
const RATIO = { stack: 224 / 196.2, row: 364.8 / 122, tag: 268.6 / 140.7 } as const;

type WordmarkProps = {
  /** roughly the old «مزاد» font size: the logo is drawn 1.5× this tall */
  size?: number;
  layout?: 'stack' | 'row';
  /** kept for older call sites; the logo reads on both dark and light grounds */
  tone?: 'dark' | 'light';
  className?: string;
};

export function Wordmark({ size = 40, layout = 'stack', className }: WordmarkProps) {
  const h = Math.round(size * 1.5);
  const w = Math.round(h * RATIO[layout]);
  return (
    <img
      className={['wordmark', `wordmark-${layout}`, className].filter(Boolean).join(' ')}
      src={layout === 'row' ? LOGO.row : LOGO.stack}
      width={w}
      height={h}
      alt="مزاد الكراج"
      draggable={false}
      decoding="async"
    />
  );
}

/** The tag on its own. `size` is its height in px. */
export function LogoMark({ size = 28, className, title }: { size?: number | string; className?: string; title?: string }) {
  const h = typeof size === 'number' ? size : undefined;
  return (
    <img
      className={['logomark', className].filter(Boolean).join(' ')}
      src={LOGO.tag}
      height={h}
      width={h ? Math.round(h * RATIO.tag) : undefined}
      style={typeof size === 'string' ? { height: size, width: 'auto' } : undefined}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      draggable={false}
    />
  );
}

/** The top-bar logo: tag beside the word, 40px tall (36 on small phones, from brand.css). */
export function BrandLogo() {
  return <img className="brand-logo" src={LOGO.row} width={120} height={40} alt="مزاد الكراج" draggable={false} />;
}
