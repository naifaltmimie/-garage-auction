/**
 * مزاد الكراج — brand.
 *
 * The identity is the stacked title: «مزاد» over «الكراج», set in Marhey Bold (real text, so the
 * Arabic shapes and joins come from the font), «مزاد» large in cream, «الكراج» smaller in gold so
 * both lines run the same width, with the ز of «مزاد» dropping into the line below.
 * The monogram is the Marhey «م» from the same title, outlined to a path so it needs no font.
 */

/** Marhey Bold «م» (isolated), outlined, on a 64-unit square. */
const MEEM =
  'M17.57 54Q17.03 51 16.6 47.29Q16.17 43.59 16.17 40.53Q16.17 36.72 17.03 33.56Q17.89 30.39 20.03 28.46Q20.62 27.92 21.38 27.55Q21.48 26.2 21.64 24.7Q21.97 22.07 22.74 19.5Q23.52 16.92 24.84 14.78Q26.15 12.63 28.14 11.31Q30.12 10 32.86 10Q35.86 10 38.57 11.26Q41.28 12.52 43.38 14.75Q45.47 16.98 46.65 19.82Q47.83 22.66 47.83 25.88Q47.83 28.89 46.65 30.69Q45.47 32.48 43.62 33.29Q41.77 34.09 39.73 34.09Q38.12 34.09 36.29 33.69Q34.47 33.29 32.78 32.91Q31.09 32.54 29.75 32.54Q28.73 32.54 28.11 32.97Q27.49 33.4 27.22 34.17Q26.96 34.95 26.96 36.02Q26.96 37.37 27.33 39.16Q27.71 40.96 28.35 42.87Q29 44.77 29.69 46.49Q30.39 48.2 31.03 49.39ZM27.33 26.63Q27.81 26.69 28.4 26.74Q29.8 26.9 31.17 26.9Q32.54 26.9 33.48 26.42Q34.41 25.94 34.41 24.6Q34.41 23.58 33.82 22.72Q33.23 21.86 32.32 21.32Q31.41 20.79 30.5 20.79Q29.32 20.79 28.67 21.43Q28.03 22.07 27.73 23.12Q27.44 24.17 27.39 25.45Q27.39 26.04 27.33 26.63Z';

type MarkProps = {
  size?: number | string;
  className?: string;
  title?: string;
};

/** The monogram alone, in currentColor. For the round seal, favicons and tight spots. */
export function LogoMark({ size = 28, className, title }: MarkProps) {
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
      <path d={MEEM} fill="currentColor" transform="translate(0 2.5)" />
    </svg>
  );
}

/**
 * The stacked title lockup. Size it with font-size on the element (or `size`, in px, for the
 * «مزاد» line); everything else is in em, so it scales as one piece. `tone="light"` is for
 * plate-white or stone backgrounds. Styles live in src/styles/brand.css.
 */
export function Wordmark({ size, tone = 'dark', className }: { size?: number; tone?: 'dark' | 'light'; className?: string }) {
  return (
    <span
      className={['wordmark', tone === 'light' ? 'is-light' : '', className].filter(Boolean).join(' ')}
      style={size ? { fontSize: size } : undefined}
      role="img"
      aria-label="مزاد الكراج"
    >
      <span className="wordmark-top" aria-hidden="true">
        مزاد
      </span>
      <span className="wordmark-bottom" aria-hidden="true">
        الكراج
      </span>
    </span>
  );
}
