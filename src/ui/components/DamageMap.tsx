import { PANEL_LABEL, STATUS_LABEL, panelsFor } from '../../engine/lotgen';
import type { CarPub, PanelId, PanelStatus } from '../../engine/types';
import { money } from '../../lib/util';

// The body map: a top view, front at the top, the car's left (driver) side on the viewer's left.
// Every panel carries the same one-letter code the list and the legend use, so the map never relies on
// colour alone (WCAG 1.4.1). Fills come from the sheet's tokens (s-sheet.css, .dm-*).
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

/** One letter per paint state, shared by the map, the legend and the panel list. */
export const STATUS_CODE: Record<PanelStatus, string> = {
  ok: 'أ',
  spot: 'خ',
  paint: 'ر',
  dent: 'س',
  replaced: 'غ',
  damaged: 'ص',
  unknown: '؟',
};

const ORDER: PanelStatus[] = ['ok', 'spot', 'paint', 'dent', 'replaced', 'damaged', 'unknown'];

export function DamageMap({ car, onPick, picked }: { car: CarPub; onPick?: (p: PanelId) => void; picked?: PanelId | null }) {
  const list = panelsFor(car.doors);
  return (
    <svg className="dm" viewBox="0 0 120 250" role="img" aria-label="خريطة البودي، كل قطعة عليها حرف حالتها">
      {/* wheels and glass, for orientation only */}
      <rect className="dm-wheel" x="2" y="40" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="112" y="40" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="2" y="186" width="6" height="30" rx="2" />
      <rect className="dm-wheel" x="112" y="186" width="6" height="30" rx="2" />
      <path className="dm-glass" d="M28 87 L92 87 L88 105 L32 105 Z" />
      <path className="dm-glass" d="M32 171 L88 171 L92 187 L28 187 Z" />
      {list.map((p) => {
        const st = car.panels[p] ?? 'ok';
        const d = (car.doors === 2 && GEOM2[p]) || GEOM[p];
        return (
          <path
            key={p}
            d={d}
            className={`dm-p dm-${st}${picked === p ? ' on' : ''}`}
            onClick={onPick ? () => onPick(p) : undefined}
          >
            <title>{`${PANEL_LABEL[p]}: ${STATUS_LABEL[st]}`}</title>
          </path>
        );
      })}
      {list.map((p) => {
        const st = car.panels[p] ?? 'ok';
        const [x, y] = (car.doors === 2 && AT2[p]) || AT[p];
        return (
          <text key={`t${p}`} x={x} y={y} className={`dm-t dm-t-${st}`} textAnchor="middle" dominantBaseline="central" aria-hidden="true">
            {STATUS_CODE[st]}
          </text>
        );
      })}
      <text className="dm-front" x="60" y="4" textAnchor="middle" dominantBaseline="central">
        قدام
      </text>
    </svg>
  );
}

/** The letter in its paint, as on the map. */
export function StatusKey({ s }: { s: PanelStatus }) {
  return (
    <span className={`dm-key dm-${s}`} aria-hidden="true">
      {STATUS_CODE[s]}
    </span>
  );
}

/** The panels that are not original, as ruled rows: letter, panel, state, paint thickness. */
export function PanelList({ car }: { car: CarPub }) {
  const items = panelsFor(car.doors).filter((p) => (car.panels[p] ?? 'ok') !== 'ok');
  if (!items.length) return <p className="sh-plain">كل القطع صبغ وكالة.</p>;
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

/** What the letters mean, in words. Only the states this car has, plus «أصلي». */
export function Legend({ car }: { car?: CarPub }) {
  const has = new Set<PanelStatus>(car ? panelsFor(car.doors).map((p) => car.panels[p] ?? 'ok') : ORDER);
  has.add('ok');
  return (
    <ul className="dm-legend" aria-label="معنى الحروف">
      {ORDER.filter((k) => has.has(k)).map((k) => (
        <li key={k}>
          <StatusKey s={k} />
          {STATUS_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}
