import { useId } from 'react';
import { PANEL_LABEL, STATUS_LABEL, panelsFor } from '../../engine/lotgen';
import type { CarPub, PanelId, PanelStatus } from '../../engine/types';
import { arDigits } from '../../lib/util';

// Top view, front at the top, the car's left (driver) side on the viewer's left.
const GEOM: Record<PanelId, string> = {
  fb: 'M30 8 Q60 2 90 8 Q104 11 106 22 L106 26 L14 26 L14 22 Q16 11 30 8 Z',
  hood: 'M24 28 L96 28 L94 84 L26 84 Z',
  roof: 'M30 108 L90 108 Q92 140 90 168 L30 168 Q28 140 30 108 Z',
  trunk: 'M26 190 L94 190 L96 222 L24 222 Z',
  rb: 'M14 224 L106 224 L106 228 Q104 239 90 242 Q60 248 30 242 Q16 239 14 228 Z',
  lff: 'M8 30 L22 30 L22 84 L8 84 Q6 56 8 30 Z',
  lfd: 'M7 88 L23 88 L23 132 L7 132 Q6 110 7 88 Z',
  lrd: 'M7 135 L23 135 L23 178 L7 178 Q6 156 7 135 Z',
  lrq: 'M8 182 L22 182 L22 222 L8 222 Q6 202 8 182 Z',
  rff: 'M98 30 L112 30 Q114 56 112 84 L98 84 Z',
  rfd: 'M97 88 L113 88 Q114 110 113 132 L97 132 Z',
  rrd: 'M97 135 L113 135 Q114 156 113 178 L97 178 Z',
  rrq: 'M98 182 L112 182 Q114 202 112 222 L98 222 Z',
};
// 2-door bodies: the front doors run long and the quarter takes the rear door's place
const GEOM2: Partial<Record<PanelId, string>> = {
  lfd: 'M7 88 L23 88 L23 150 L7 150 Q6 120 7 88 Z',
  rfd: 'M97 88 L113 88 Q114 120 113 150 L97 150 Z',
  lrq: 'M8 154 L22 154 L22 222 L8 222 Q6 188 8 154 Z',
  rrq: 'M98 154 L112 154 Q114 188 112 222 L98 222 Z',
};

export const STATUS_FILL: Record<PanelStatus, string> = {
  ok: '#e9f4ed',
  spot: '#f3e09a',
  paint: '#e7b443',
  dent: '#df8a3a',
  replaced: '#d2463c',
  damaged: '#8a1d16',
  unknown: '#cdd2cc',
};

export function DamageMap({ car, onPick, picked }: { car: CarPub; onPick?: (p: PanelId) => void; picked?: PanelId | null }) {
  const id = useId().replace(/:/g, '');
  const list = panelsFor(car.doors);
  return (
    <svg viewBox="0 0 120 250" role="img" aria-label="خريطة البودي">
      <defs>
        <pattern id={`h${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill={STATUS_FILL.dent} />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#7a3d10" strokeWidth="1.6" />
        </pattern>
      </defs>
      {/* glass and wheels for context */}
      <rect x="2" y="40" width="6" height="30" rx="2" fill="#26302b" />
      <rect x="112" y="40" width="6" height="30" rx="2" fill="#26302b" />
      <rect x="2" y="186" width="6" height="30" rx="2" fill="#26302b" />
      <rect x="112" y="186" width="6" height="30" rx="2" fill="#26302b" />
      <path d="M28 87 L92 87 L88 105 L32 105 Z" fill="#5d6b74" opacity=".55" />
      <path d="M32 171 L88 171 L92 187 L28 187 Z" fill="#5d6b74" opacity=".55" />
      {list.map((p) => {
        const st = car.panels[p] ?? 'ok';
        const d = (car.doors === 2 && GEOM2[p]) || GEOM[p];
        const fill = st === 'dent' ? `url(#h${id})` : STATUS_FILL[st];
        return (
          <path
            key={p}
            d={d}
            fill={fill}
            stroke={picked === p ? '#0e1c15' : 'rgba(14,28,21,.45)'}
            strokeWidth={picked === p ? 2.2 : 1}
            onClick={onPick ? () => onPick(p) : undefined}
            style={onPick ? { cursor: 'pointer' } : undefined}
          >
            <title>{`${PANEL_LABEL[p]}: ${STATUS_LABEL[st]}`}</title>
          </path>
        );
      })}
      {list
        .filter((p) => car.panels[p] === 'unknown')
        .slice(0, 6)
        .map((p) => {
          const pos: Record<string, [number, number]> = { fb: [60, 20], hood: [60, 60], roof: [60, 142], trunk: [60, 210], rb: [60, 236], lff: [15, 60], rff: [105, 60], lfd: [15, 112], rfd: [105, 112], lrd: [15, 158], rrd: [105, 158], lrq: [15, 204], rrq: [105, 204] };
          const [x, y] = pos[p];
          return (
            <text key={`q${p}`} x={x} y={y} textAnchor="middle" fontSize="11" fontWeight="900" fill="#66746b">
              ؟
            </text>
          );
        })}
      {list
        .filter((p) => car.panels[p] === 'damaged')
        .map((p) => {
          const pos: Record<string, [number, number]> = { fb: [60, 18], hood: [60, 56], roof: [60, 138], trunk: [60, 206], rb: [60, 234], lff: [15, 56], rff: [105, 56], lfd: [15, 110], rfd: [105, 110], lrd: [15, 156], rrd: [105, 156], lrq: [15, 202], rrq: [105, 202] };
          const [x, y] = pos[p];
          return (
            <g key={`x${p}`} stroke="#fff" strokeWidth="2">
              <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
              <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} />
            </g>
          );
        })}
      <text x="60" y="5" textAnchor="middle" fontSize="6" fill="#66746b" fontWeight="700">
        قدام
      </text>
    </svg>
  );
}

export function PanelList({ car }: { car: CarPub }) {
  const items = panelsFor(car.doors).filter((p) => (car.panels[p] ?? 'ok') !== 'ok');
  if (!items.length) {
    return <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5 }}>كل القطع صبغ وكالة</p>;
  }
  return (
    <ul className="panel-list">
      {items.map((p) => {
        const st = car.panels[p]!;
        const mic = car.microns[p];
        return (
          <li key={p}>
            <span>{PANEL_LABEL[p]}</span>
            <span>
              {STATUS_LABEL[st]}
              {mic ? `، ${arDigits(mic)} ميكرون` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function Legend() {
  const keys: PanelStatus[] = ['ok', 'spot', 'paint', 'dent', 'replaced', 'damaged', 'unknown'];
  return (
    <div className="legend">
      {keys.map((k) => (
        <span key={k}>
          <i style={{ background: STATUS_FILL[k] }} />
          {STATUS_LABEL[k]}
        </span>
      ))}
    </div>
  );
}
