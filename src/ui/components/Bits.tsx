import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import type { Toast } from '../useRoom';

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

export function Icon({ name, size = 20 }: { name: 'sound' | 'mute' | 'list' | 'users' | 'share' | 'copy' | 'back' | 'close' | 'pause'; size?: number }) {
  const p: Record<string, string> = {
    sound: 'M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z',
    mute: 'M4 9v6h4l5 4V5L8 9H4zm15.6 3 2.2-2.2-1.4-1.4-2.2 2.2-2.2-2.2-1.4 1.4 2.2 2.2-2.2 2.2 1.4 1.4 2.2-2.2 2.2 2.2 1.4-1.4z',
    list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3.3 0-7 1.7-7 4v3h14v-3c0-2.3-3.7-4-7-4zm8-2a3 3 0 1 0 0-6v6zm1 2.2c1.8.7 4 1.9 4 3.8v3h-4v-3c0-1.5-.7-2.8-2-3.8z',
    share: 'M18 16a3 3 0 0 0-2.4 1.2l-6.8-3.4a3 3 0 0 0 0-1.6l6.8-3.4A3 3 0 1 0 15 7l-6.8 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z',
    copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z',
    back: 'M10 6l-1.4 1.4L12.2 11H4v2h8.2l-3.6 3.6L10 18l6-6z',
    close: 'M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z',
    pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={p[name]} fill="currentColor" />
    </svg>
  );
}
