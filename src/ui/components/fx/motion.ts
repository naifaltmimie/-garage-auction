/** Shared motion helpers for the fx layer. The curves and durations themselves live as CSS variables in styles/fx.css. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** expo-out: fast start, long settle — the same curve as --fx-out */
export const easeOut = (k: number) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));
