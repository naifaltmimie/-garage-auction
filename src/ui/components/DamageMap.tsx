import { PANEL_LABEL, STATUS_LABEL, panelsFor } from '../../engine/lotgen';
import type { CarPub, PanelId, PanelStatus } from '../../engine/types';
import { money } from '../../lib/util';

// The body map: a top view, front at the top, the car's left (driver) side on the viewer's left.
// Only what is not original is marked: that panel turns white paper with its code letter in black, the same
// letter the legend and the list use (WCAG 1.4.1: the letter carries the meaning, not the fill). Original panels
// are just the car's outline; a panel nobody inspected is a dashed outline with «؟». Styles: s-sheet.css, .dm-*.
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
// where each panel's letter sits
const AT: Record<PanelId, [number, number]> = {
  fb: [60, 17], hood: [60, 56], roof: [60, 138], trunk: [60, 206], rb: [60, 234],
  lff: [15, 57], lfd: [15, 110], lrd: [15, 156], lrq: [15, 202],
  rff: [105, 57], rfd: [105, 110], rrd: [105, 156], rrq: [105, 202],
};
const AT2: Partial<Record<PanelId, [number, number]>> = { lfd: [15, 119], rfd: [105, 119], lrq: [15, 188], rrq: [105, 188] };

/** One letter per paint state, shared by the map, the legend and the panel list. Original has none. */
export const STATUS_CODE: Record<PanelStatus, string> = {
  ok: '',
  spot: 'خ',
  paint: 'ر',
  dent: 'س',
  replaced: 'غ',
  damaged: 'ص',
  unknown: '؟',
};

const ORDER: PanelStatus[] = ['spot', 'paint', 'dent', 'replaced', 'damaged', 'unknown'];

const SIDE_L: PanelId[] = ['lff', 'lfd', 'lrd', 'lrq'];
const SIDE_R: PanelId[] = ['rff', 'rfd', 'rrd', 'rrq'];

/** A panel's bounding box, read from its path (every path is straight segments and quadratic bows). */
function box(d: string): [number, number, number, number] {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function DamageMap({ car, onPick, picked }: { car: CarPub; onPick?: (p: PanelId) => void; picked?: PanelId | null }) {
  const list = panelsFor(car.doors);
  const geom = (p: PanelId) => (car.doors === 2 && GEOM2[p]) || GEOM[p];
  return (
    <svg className="dm" viewBox="-10 -12 140 274" role="img" aria-label="خريطة البودي، القطع اللي مو أصلية عليها حرف حالتها">
      {/* wheels and glass, for orientation only */}
      <rect className="dm-wheel" x="1" y="40" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="113" y="40" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="1" y="186" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="113" y="186" width="6" height="30" rx="2" />
      <path className="dm-glass" d="M28 87 L92 87 L88 105 L32 105 Z" />
      <path className="dm-glass" d="M32 171 L88 171 L92 187 L28 187 Z" />
      {list.map((p) => {
        const st = car.panels[p] ?? 'ok';
        return (
          <path key={p} d={geom(p)} className={`dm-p ${st === 'ok' ? 'dm-orig' : st === 'unknown' ? 'dm-unk' : 'dm-mark'}${picked === p ? ' on' : ''}`}>
            <title>{`${PANEL_LABEL[p]}: ${STATUS_LABEL[st]}`}</title>
          </path>
        );
      })}
      {list.map((p) => {
        const st = car.panels[p] ?? 'ok';
        if (st === 'ok') return null;
        const [x, y] = (car.doors === 2 && AT2[p]) || AT[p];
        return (
          <text key={`t${p}`} x={x} y={y} className={`dm-t ${st === 'unknown' ? 'dm-t-unk' : 'dm-t-mark'}${SIDE_L.includes(p) || SIDE_R.includes(p) ? ' dm-t-side' : ''}`} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
            {STATUS_CODE[st]}
          </text>
        );
      })}
      {/* invisible tap areas: the thin side panels, the two bumpers and the boot reach past their drawing (out to
          the map's margins, up over the rear glass), so a thumb finds them: 44px and up from a 360px phone */}
      {onPick &&
        list.map((p) => {
          const [x0, y0, x1, y1] = box(geom(p));
          const l = SIDE_L.includes(p) ? -15 : x0;
          const r = SIDE_R.includes(p) ? 135 : x1;
          const t = p === 'fb' ? -12 : p === 'trunk' ? 185 : y0;
          const b = p === 'rb' ? 262 : y1;
          return <rect key={`h${p}`} className="dm-hit" x={l} y={t} width={r - l} height={b - t} onClick={() => onPick(p)} />;
        })}
      <text className="dm-front" x="60" y="-5" textAnchor="middle" dominantBaseline="central">
        قدام
      </text>
    </svg>
  );
}

/** The letter as it sits on the map: black on white paper, or «؟» in a dashed outline. Nothing for original. */
export function StatusKey({ s }: { s: PanelStatus }) {
  if (s === 'ok') return null;
  return (
    <span className={`dm-key ${s === 'unknown' ? 'dm-key-unk' : 'dm-key-mark'}`} aria-hidden="true">
      {STATUS_CODE[s]}
    </span>
  );
}

/** The panels that are not original, as ruled rows: letter, panel, state, paint thickness. */
export function PanelList({ car }: { car: CarPub }) {
  const items = panelsFor(car.doors).filter((p) => (car.panels[p] ?? 'ok') !== 'ok');
  if (!items.length) return null;
  return (
    <dl className="rows sh-panels">
      {items.map((p) => {
        const st = car.panels[p]!;
        const mic = car.microns[p];
        return (
          <div className="rows-r" key={p}>
            <dt>
              <StatusKey s={st} />
              {PANEL_LABEL[p]}
            </dt>
            <dd>
              {STATUS_LABEL[st]}
              {mic ? (
                <small className="sh-mic">
                  <span className="print ltr">{money(mic)}</span> ميكرون
                </small>
              ) : null}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** What the letters on this car mean, then one line for the rest; a car with nothing marked says so. */
export function Legend({ car }: { car?: CarPub }) {
  const states = car ? panelsFor(car.doors).map((p) => car.panels[p] ?? 'ok') : ORDER;
  const has = new Set<PanelStatus>(states);
  const shown = ORDER.filter((k) => has.has(k));
  if (!shown.length) return <p className="dm-all">كل القطع أصلي</p>;
  return (
    <ul className="dm-legend" aria-label="معنى الحروف">
      {shown.map((k) => (
        <li key={k}>
          <StatusKey s={k} />
          {STATUS_LABEL[k]}
        </li>
      ))}
      {has.has('ok') && <li className="dm-rest">الباقي أصلي</li>}
    </ul>
  );
}
