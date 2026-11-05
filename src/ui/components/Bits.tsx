import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Toast } from '../useRoom';

/** Renders a modal at the end of <body>, so no stacking context or transformed ancestor can clip it. */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom-sheet plumbing: Escape closes, focus moves into the sheet and Tab stays inside it,
 * the page behind doesn't scroll, and focus goes back where it was when the sheet closes.
 */
export function useSheet<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const body = document.body;
    const was = body.style.overflow;
    body.style.overflow = 'hidden';
    el?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const f = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const a = f[0];
      const z = f[f.length - 1];
      const at = document.activeElement;
      if (at === el || !el.contains(at)) {
        e.preventDefault();
        (e.shiftKey ? z : a).focus();
      } else if (e.shiftKey && at === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && at === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      body.style.overflow = was;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}

/**
 * Keeps a focused text field above the on-screen keyboard on the menu screens (home, create, join).
 * Phones shrink the visual viewport when the keys slide up, and the browser's own scroll can leave
 * the field under them or under the sticky header. Live auction phases are left alone.
 */
const LIVE = new Set(['intro', 'preview', 'bidding', 'sealed', 'dutch', 'sold', 'unsold', 'approval']);
function guardField(e: FocusEvent) {
  const el = e.target as HTMLElement | null;
  if (!el || !el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea')) return;
  if (LIVE.has(document.documentElement.dataset.phase || '')) return;
  const vv = window.visualViewport;
  let t = 0;
  const check = () => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      if (document.activeElement !== el) return;
      const r = el.getBoundingClientRect();
      const top = vv ? vv.offsetTop : 0;
      const bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      if (r.bottom > bottom - 12 || r.top < top + 72) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 140);
  };
  vv?.addEventListener('resize', check);
  window.setTimeout(() => vv?.removeEventListener('resize', check), 1400);
  check();
}
if (typeof document !== 'undefined' && !(window as { __mzkField?: boolean }).__mzkField) {
  (window as { __mzkField?: boolean }).__mzkField = true;
  document.addEventListener('focusin', guardField);
}

export function QR({ text, size = 168 }: { text: string; size?: number }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <div className="qr" aria-label="رمز الدخول">
      <svg viewBox={`-1 -1 ${svg.n + 2} ${svg.n + 2}`} width={size} height={size} shapeRendering="crispEdges">
        <rect x="-1" y="-1" width={svg.n + 2} height={svg.n + 2} fill="#f6f4ee" />
        <path d={svg.d} fill="#121212" />
      </svg>
    </div>
  );
}

export function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone ?? ''}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function Gavel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="gv-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a5a2b" />
          <stop offset=".5" stopColor="#5c3818" />
          <stop offset="1" stopColor="#3a220d" />
        </linearGradient>
        <linearGradient id="gv-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0d48a" />
          <stop offset="1" stopColor="#a87a32" />
        </linearGradient>
      </defs>
      <g transform="rotate(-32 60 60)">
        <rect x="28" y="22" width="56" height="26" rx="6" fill="url(#gv-wood)" />
        <rect x="34" y="22" width="6" height="26" fill="url(#gv-brass)" />
        <rect x="72" y="22" width="6" height="26" fill="url(#gv-brass)" />
        <rect x="53" y="46" width="7" height="58" rx="3.5" fill="url(#gv-wood)" />
      </g>
      <ellipse cx="62" cy="104" rx="34" ry="7" fill="#2a1a0b" />
      <rect x="32" y="96" width="60" height="9" rx="4" fill="url(#gv-wood)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ icons
   One drawn set: a 24px grid with a 2px safe edge, 1.9 strokes, round caps and joins, outlines only
   (dots are zero-length strokes; the finish flag's checks are the one fill). Each glyph is balanced on
   its stroked bounds, not its path, so a row of mixed icons sits level. Arrows that mean "back" or
   "out" point the RTL way: back goes right, the exit leaves to the left, and the car faces left. */

const SPEAKER = 'M3 10.2a1 1 0 0 1 1-1h2.6L11 5.6v12.8l-4.4-3.6H4a1 1 0 0 1-1-1z';
const TREAD = [0, 40, 80, 120, 160, 200, 240, 280, 320];

const GLYPH = {
  sound: (
    <>
      <path d={SPEAKER} />
      <path d="M15.3 8.9a4.4 4.4 0 0 1 0 6.2M18.1 6.2a8.2 8.2 0 0 1 0 11.6" />
    </>
  ),
  mute: (
    <>
      <path d={SPEAKER} />
      <path d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8" />
    </>
  ),
  list: <path d="M4 6.5h11.5M4 12h11.5M4 17.5h11.5M19.6 6.5h.01M19.6 12h.01M19.6 17.5h.01" />,
  users: (
    <>
      <circle cx="9" cy="7.8" r="3.3" />
      <path d="M3 19.5v-.6a5.4 5.4 0 0 1 5.4-5.4h1.2a5.4 5.4 0 0 1 5.4 5.4v.6" />
      <path d="M15.4 4.6a3.2 3.2 0 0 1 0 6.4M17.6 13.8a5.4 5.4 0 0 1 3.4 5v.7" />
    </>
  ),
  share: (
    <>
      <circle cx="17.5" cy="5.5" r="2.6" />
      <circle cx="6.5" cy="12" r="2.6" />
      <circle cx="17.5" cy="18.5" r="2.6" />
      <path d="M8.75 10.7l6.5-3.9M8.75 13.3l6.5 3.9" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.2" />
      <path d="M15.5 5.3V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h.3" />
    </>
  ),
  back: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4" height="15" rx="1.2" />
      <rect x="14" y="4.5" width="4" height="15" rx="1.2" />
    </>
  ),
  // a saloon in profile: drawn facing right, then turned to face the way the page reads
  car: (
    <g transform="matrix(-1 0 0 1 24 -.6)">
      <path d="M4.8 16.5H3.4A1.4 1.4 0 0 1 2 15.1v-2.3a1.6 1.6 0 0 1 1.2-1.55l2.3-.55 2.1-3.1a1.9 1.9 0 0 1 1.6-.85h4.6a1.9 1.9 0 0 1 1.5.75l2.5 3.2 2.9.7a2.2 2.2 0 0 1 1.3 2.15v1.55a1.4 1.4 0 0 1-1.4 1.4h-1.4M9.2 16.5h5.6" />
      <path d="M5.5 10.7h12.3M11.7 6.75v3.95" />
      <circle cx="7" cy="16.5" r="2.2" />
      <circle cx="17" cy="16.5" r="2.2" />
    </g>
  ),
  // the head is banded at both faces; it hangs over the sound block it's about to strike
  gavel: (
    <>
      <g transform="rotate(45 13 9)">
        <rect x="8" y="6.2" width="10" height="5.6" rx="1.4" />
        <path d="M10.6 6.2v5.6M15.4 6.2v5.6M13 11.8v9.7" />
      </g>
      <rect x="11.5" y="17.6" width="8.5" height="3.2" rx="1.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  tire: (
    <>
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 12h.01" />
      {TREAD.map((a) => (
        <path key={a} d="M11.3 2.8l1.5 2.4" transform={`rotate(${a} 12 12)`} />
      ))}
    </>
  ),
  trophy: (
    <>
      <path d="M7 3.5h10V9A5 5 0 0 1 7 9z" />
      <path d="M7 5.5H5a1.5 1.5 0 0 0-1.5 1.5v.5a4 4 0 0 0 4.2 4M17 5.5h2a1.5 1.5 0 0 1 1.5 1.5v.5a4 4 0 0 1-4.2 4" />
      <path d="M12 14v3M9.5 17h5l1 3.5h-7z" />
    </>
  ),
  crown: (
    <>
      <path d="M5.6 16.8 3.8 7.5l4.6 3.8L12 4.3l3.6 7 4.6-3.8-1.8 9.3z" />
      <path d="M6 19.8h12" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M9.5 2.5h5M12 2.5V6M12 13.5l3-3M18.6 7l1.4-1.4" />
    </>
  ),
  wallet: (
    <>
      <path d="M20.5 9.5V8a2 2 0 0 0-2-2h-13A2.5 2.5 0 0 0 3 8.5v9A2.5 2.5 0 0 0 5.5 20h13a2 2 0 0 0 2-2v-1.5" />
      <path d="M20.5 9.5h-4a3.5 3.5 0 0 0 0 7h4z" />
      <path d="M6.5 6l9-2.7a1.5 1.5 0 0 1 1.9 1.45V6M16.6 13h.01" />
    </>
  ),
  // the chequered flag that ends the night
  flag: (
    <>
      <path d="M5 21.5V3.5M5 4h13.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5" />
      <path
        d="M5 4h3.6v3.35H5zM12.25 4h3.6v3.35h-3.6zM8.6 7.35h3.65v3.3H8.6zM15.85 7.35h3.65v3.3h-3.65zM5 10.65h3.6V14H5zM12.25 10.65h3.6V14h-3.6z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  exit: <path d="M13.5 3.5H18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-4.5M15.5 12H4M8.5 7.5 4 12l4.5 4.5" />,
  eye: (
    <>
      <path d="M2.5 12C4.6 7.8 8 5.75 12 5.75s7.4 2.05 9.5 6.25c-2.1 4.2-5.5 6.25-9.5 6.25S4.6 16.2 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="16" r="4.5" />
      <path d="M11.2 12.8 20 4M17.2 6.8l2.2 2.2M14.6 9.4l1.6 1.6M7.9 16.1h.01" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
      <path d="M8 2.5l4 4.5 4-4.5" />
    </>
  ),
  play: <path d="M8 6.2v11.6Q8 19 9.04 18.4l9.92-5.8Q20 12 18.96 11.4L9.04 5.6Q8 5 8 6.2z" />,
  settings: (
    <>
      <path d="M4 6.5h8.8M17.2 6.5H20M4 12h2.8M11.2 12H20M4 17.5h9.8M18.2 17.5H20" />
      <circle cx="15" cy="6.5" r="2.2" />
      <circle cx="9" cy="12" r="2.2" />
      <circle cx="16" cy="17.5" r="2.2" />
    </>
  ),
  check: <path d="M4.5 12.8l4.8 4.7L19.5 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M12 11v5.5M12 7.6h.01" />
    </>
  ),
  'arrow-left': <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />,
  'arrow-right': <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPH;
/** every glyph, in drawing order (the contact sheet and any picker read this) */
export const ICON_NAMES = Object.keys(GLYPH) as IconName[];

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `ic ${className}` : 'ic'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPH[name]}
    </svg>
  );
}
