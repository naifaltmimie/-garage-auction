/**
 * One delegated listener for the spotlight cards (.market, .fx-spot): tracks the pointer inside the card
 * as --mx/--my so the CSS glow follows it on desktop, and sits where the finger lands on a phone.
 */
let installed = false;

export function installSpotlight() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const sel = '.market, .fx-spot';
  let raf = 0;
  let last: PointerEvent | null = null;
  const apply = () => {
    raf = 0;
    const e = last;
    if (!e) return;
    const el = (e.target as Element | null)?.closest?.(sel) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
    el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
  };
  const queue = (e: PointerEvent) => {
    last = e;
    if (!raf) raf = requestAnimationFrame(apply);
  };
  document.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && queue(e), { passive: true });
  document.addEventListener('pointerdown', queue, { passive: true });
}
