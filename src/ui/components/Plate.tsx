import { useId } from 'react';
import type { PlatePub } from '../../engine/types';
import { money } from '../../lib/util';
import { PLATE_EMBLEM, PLATE_GLYPHS, type PlateGlyph } from './plateGlyphs';

/** The kinds the game draws (the strip's colour and mark) and the two sizes. Missing means private, standard size. */
export type PlateKind = 'private' | 'transport' | 'taxi';
export type PlateLook = { kind?: PlateKind; format?: 'us' | 'eu' };

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const INK = '#141414';
const STRIP: Record<PlateKind, string> = { private: '#efefec', transport: '#0f5fbe', taxi: '#f2c200' };

/*
 * The plate is drawn in a box 100 units high, measured from real plates (H = 100):
 * a white plate with a thin lip, a black field, and on it five white panels with softly rounded corners
 * (two rows of digits and letters, and the strip); the black between them reads as the fine rules.
 */
type Box = { x: number; y: number; w: number; h: number };
type Geo = {
  W: number;
  digits: [Box, Box]; // Arabic row, Latin row
  letters: [Box, Box];
  strip: Box;
  // type
  adTall: number; // height of a tall Arabic-Indic digit
  alH: number; // height of ا / ط
  alStep: number; // centre to centre of the letters
  ldCap: number; // Latin digit cap height
  ldStep: number | null; // centre to centre of the Latin digits (null: the font's own advance)
  llCap: number; // Latin letter cap height
  llStep: number;
};

const LIP = 1.2;
const BORDER = 1.6;
const GAP = 1.4;
const PANEL_R = 2;

function geometry(format: 'us' | 'eu'): Geo {
  const W = format === 'us' ? 202 : 473;
  const x0 = LIP + BORDER;
  const inner = W - 2 * x0;
  const y0 = x0;
  const rh = (100 - 2 * y0 - GAP) / 2;
  const row = (x: number, w: number): [Box, Box] => [
    { x, y: y0, w, h: rh },
    { x, y: y0 + rh + GAP, w, h: rh },
  ];
  if (format === 'us') {
    const dw = inner * 0.53;
    const lw = inner * 0.354;
    const sw = inner - dw - lw - 2 * GAP;
    return {
      W,
      digits: row(x0, dw),
      letters: row(x0 + dw + GAP, lw),
      strip: { x: x0 + dw + lw + 2 * GAP, y: y0, w: sw, h: 100 - 2 * y0 },
      adTall: 36,
      alH: 21.5,
      alStep: 21.5,
      ldCap: 35.2,
      ldStep: null,
      llCap: 22.1,
      llStep: 21.5,
    };
  }
  const dw = inner * 0.48;
  const bw = inner * 0.15;
  const lw = inner - dw - bw - 2 * GAP;
  return {
    W,
    digits: row(x0, dw),
    letters: row(x0 + dw + bw + 2 * GAP, lw),
    strip: { x: x0 + dw + GAP, y: y0, w: bw, h: 100 - 2 * y0 },
    adTall: 25,
    alH: 25,
    alStep: 44,
    ldCap: 34,
    ldStep: 42,
    llCap: 33,
    llStep: 44,
  };
}

/** One glyph placed by its own box: centred on (cx, cy) or on a baseline, scaled to a height. */
function Glyph({ g, s, x, y, sx = 1, thick = 0 }: { g: PlateGlyph; s: number; x: number; y: number; sx?: number; thick?: number }) {
  return (
    <path
      d={g.d}
      transform={`translate(${r(x)} ${r(y)}) scale(${r(s * sx, 5)} ${r(s, 5)})`}
      stroke={thick ? 'currentColor' : undefined}
      strokeWidth={thick ? r(thick / s, 1) : undefined}
      strokeLinejoin="round"
    />
  );
}
const r = (v: number, p = 2) => Math.round(v * 10 ** p) / 10 ** p;
const gl = (k: string) => PLATE_GLYPHS[k];

/** Arabic-Indic digits, each centred over its Western twin, every digit centred on the row. */
function ArabicDigits({ num, centres, row, tall }: { num: string; centres: number[]; row: Box; tall: number }) {
  const s = tall / 600;
  const cy = row.y + row.h / 2;
  const maxW = centres.length > 1 ? Math.abs(centres[1] - centres[0]) : 99;
  return (
    <>
      {[...num].map((d, i) => {
        const g = gl('A' + AR_DIGITS[+d]);
        if (!g) return null;
        // ٥ is small by nature on the plate; the rest stand tall
        const k = d === '5' ? s * 0.88 : s;
        const [x0, y0, x1, y1] = g.b;
        // the plate's digits are narrower than the font's: keep a clear gap between neighbours
        const sx = Math.min(1, (maxW * 0.86) / ((x1 - x0) * k));
        return <Glyph key={i} g={g} s={k} sx={sx} x={centres[i] - ((x0 + x1) / 2) * k * sx} y={cy - ((y0 + y1) / 2) * k} thick={tall * 0.015} />;
      })}
    </>
  );
}

/** Western digits in DIN, on one baseline, the group centred in its cell. Returns the digit centres. */
function latinDigitCentres(num: string, row: Box, cap: number, step: number | null) {
  const s = cap / 692;
  const ws = [...num].map((d) => (gl('L' + d)?.w ?? 500) * s);
  if (step) {
    const c = row.x + row.w / 2;
    return ws.map((_, i) => c + (i - (ws.length - 1) / 2) * step);
  }
  const total = ws.reduce((a, b) => a + b, 0);
  let x = row.x + (row.w - total) / 2;
  return ws.map((w) => {
    const c = x + w / 2;
    x += w;
    return c;
  });
}

function LatinDigits({ num, centres, row, cap }: { num: string; centres: number[]; row: Box; cap: number }) {
  const s = cap / 692;
  const base = row.y + row.h / 2 + cap / 2;
  return (
    <>
      {[...num].map((d, i) => {
        const g = gl('L' + d);
        if (!g) return null;
        return <Glyph key={i} g={g} s={s} x={centres[i] - (g.w / 2) * s} y={base} />;
      })}
    </>
  );
}

/** Letter centres: the first Arabic letter (and its Latin twin) on the right. */
function letterCentres(n: number, row: Box, step: number) {
  const c = row.x + row.w / 2;
  return Array.from({ length: n }, (_, i) => c + ((n - 1) / 2 - i) * step);
}

function ArabicLetters({ ar, centres, row, h, maxW }: { ar: string[]; centres: number[]; row: Box; h: number; maxW: number }) {
  const s = h / 680;
  // the plate centres each letter on the row, a touch low, rather than setting them on one baseline
  const cy = row.y + row.h / 2 + row.h * 0.045;
  return (
    <>
      {ar.map((l, i) => {
        const g = gl('A' + l);
        if (!g || centres[i] === undefined) return null;
        const [x0, y0, x1, y1] = g.b;
        const sx = Math.min(1, maxW / ((x1 - x0) * s));
        return <Glyph key={i} g={g} s={s} sx={sx} x={centres[i] - ((x0 + x1) / 2) * s * sx} y={cy - ((y0 + y1) / 2) * s} thick={h * 0.03} />;
      })}
    </>
  );
}

function LatinLetters({ en, centres, row, cap }: { en: string[]; centres: number[]; row: Box; cap: number }) {
  const s = cap / 692;
  const base = row.y + row.h / 2 + cap / 2 + 1;
  return (
    <>
      {en.map((l, i) => {
        const g = gl('L' + l.toUpperCase());
        if (!g || centres[i] === undefined) return null;
        const [x0, , x1] = g.b;
        return <Glyph key={i} g={g} s={s} x={centres[i] - ((x0 + x1) / 2) * s} y={base} />;
      })}
    </>
  );
}

/** The emblem, fitted to a box by its height. */
function Emblem({ cx, top, h }: { cx: number; top: number; h: number }) {
  const s = h / 420;
  return <path d={PLATE_EMBLEM} transform={`translate(${r(cx - 190 * s)} ${r(top)}) scale(${r(s, 5)})`} />;
}

/** «السعودية», fitted to a width and centred on a point. */
function Saudia({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  const g = gl('SAUDIA');
  const [x0, y0, x1, y1] = g.b;
  const s = w / (x1 - x0);
  return <Glyph g={g} s={s} x={cx - ((x0 + x1) / 2) * s} y={cy - ((y0 + y1) / 2) * s} thick={0.35} />;
}

function Ksa({ ch, cx, cy, cap }: { ch: string; cx: number; cy: number; cap: number }) {
  const g = gl('K' + ch);
  const s = cap / 688;
  const [x0, , x1] = g.b;
  return <Glyph g={g} s={s} x={cx - ((x0 + x1) / 2) * s} y={cy + cap / 2} />;
}

function Mark({ kind, cx, cy, d }: { kind: PlateKind; cx: number; cy: number; d: number }) {
  if (kind === 'private') return <circle cx={r(cx)} cy={r(cy)} r={r(d / 2)} />;
  const h = d * 0.9;
  const w = d * 1.04;
  const up = kind === 'taxi';
  const pts = up
    ? [[cx, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]
    : [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx, cy + h / 2]];
  return <path d={`M${pts.map((p) => p.map((v) => r(v)).join(' ')).join('L')}Z`} />;
}

/** The silver hologram patch on the strip. */
function Holo({ x, y, w, h, id }: { x: number; y: number; w: number; h: number; id: string }) {
  return <rect x={r(x)} y={r(y)} width={r(w)} height={r(h)} rx={0.6} fill={`url(#${id}-holo)`} stroke="none" />;
}

type FaceProps = { ar: string[]; en: string[]; num: string; kind: PlateKind; format: 'us' | 'eu'; small: boolean; label: string };

/** The whole plate as one SVG. `en` is in Arabic order (each Latin letter at the index of its Arabic one). */
function PlateSvg({ ar, en, num, kind, format, small, label }: FaceProps) {
  const id = useId().replace(/:/g, '');
  const G = geometry(format);
  const W = G.W;
  const panels = [...G.digits, ...G.letters];
  const ldC = num ? latinDigitCentres(num, G.digits[1], G.ldCap, G.ldStep) : [];
  const lc = letterCentres(Math.max(ar.length, en.length), G.letters[1], format === 'us' ? G.alStep : G.alStep);
  const st = G.strip;
  const scx = st.x + st.w / 2 + (format === 'us' && !small ? st.w * 0.05 : 0);

  const ink = (
    <>
      {num && <ArabicDigits num={num} centres={ldC} row={G.digits[0]} tall={G.adTall} />}
      {num && <LatinDigits num={num} centres={ldC} row={G.digits[1]} cap={G.ldCap} />}
      <ArabicLetters ar={ar} centres={lc} row={G.letters[0]} h={G.alH} maxW={format === 'us' ? 15.5 : 30} />
      <LatinLetters en={en} centres={lc} row={G.letters[1]} cap={G.llCap} />
      {format === 'us' ? (
        <>
          <Emblem cx={scx} top={8} h={17.5} />
          <Saudia cx={scx} cy={31.5} w={st.w * 0.8} />
          <Ksa ch="K" cx={scx} cy={42} cap={8} />
          <Ksa ch="S" cx={scx} cy={53.5} cap={8} />
          <Ksa ch="A" cx={scx} cy={65} cap={8} />
          <Mark kind={kind} cx={scx} cy={87.7} d={12.8} />
        </>
      ) : (
        <>
          <Emblem cx={scx} top={7} h={29} />
          <Saudia cx={scx} cy={43} w={st.w * 0.5} />
          <Ksa ch="K" cx={scx - 9.4} cy={60} cap={11} />
          <Ksa ch="S" cx={scx} cy={60} cap={11} />
          <Ksa ch="A" cx={scx + 9.4} cy={60} cap={11} />
          <Mark kind={kind} cx={scx + st.w * 0.2} cy={81} d={15} />
        </>
      )}
    </>
  );

  return (
    <svg className="sp-svg" viewBox={`0 0 ${W} 100`} role="img" aria-label={label} style={{ ['--r' as string]: W / 100 }}>
      <defs>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".42" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".07" />
        </linearGradient>
        <linearGradient id={`${id}-holo`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#d9dbe0" />
          <stop offset=".35" stopColor="#f4f5f7" />
          <stop offset=".55" stopColor="#b9bdc5" />
          <stop offset=".8" stopColor="#e6e8ec" />
          <stop offset="1" stopColor="#a9adb5" />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9da2aa" />
          <stop offset=".45" stopColor="#eceef1" />
          <stop offset="1" stopColor="#b4b8bf" />
        </linearGradient>
        <g id={`${id}-ink`}>{ink}</g>
      </defs>

      {/* the plate, its lip and the black field */}
      <rect x="0" y="0" width={W} height="100" rx="6" fill="#f6f6f3" />
      <rect x={LIP} y={LIP} width={W - 2 * LIP} height={100 - 2 * LIP} rx="5" fill={INK} />
      {/* the five panels */}
      {panels.map((p, i) => (
        <rect key={i} x={r(p.x)} y={r(p.y)} width={r(p.w)} height={r(p.h)} rx={PANEL_R} fill="#efefec" />
      ))}
      <rect x={r(st.x)} y={r(st.y)} width={r(st.w)} height={r(st.h)} rx={PANEL_R} fill={STRIP[kind]} />
      {format === 'us' && !small && (
        <rect x={r(st.x + 0.6)} y={r(st.y + 0.6)} width={r(st.w * 0.12)} height={r(st.h - 1.2)} rx={0.5} fill={`url(#${id}-band)`} />
      )}
      {format === 'us' ? (
        <Holo x={scx - 8} y={74 - 2.75} w={16} h={5.5} id={id} />
      ) : (
        <Holo x={scx - st.w * 0.36} y={81 - 4} w={st.w * 0.34} h={8} id={id} />
      )}

      {/* pressed characters: a hairline light edge above, a soft dark edge below, then the ink */}
      {!small && <use href={`#${id}-ink`} fill="#fff" color="#fff" opacity=".9" transform="translate(0 -0.45)" />}
      <use href={`#${id}-ink`} fill="#000" color="#000" opacity=".16" transform="translate(0 0.55)" />
      <use href={`#${id}-ink`} fill={INK} color={INK} />

      {/* the sheen over the whole face */}
      <rect x="0" y="0" width={W} height="100" rx="6" fill={`url(#${id}-sheen)`} pointerEvents="none" />
    </svg>
  );
}

const SIZES = ['sm', 'md', 'lg'] as const;
const KINDS: readonly PlateKind[] = ['private', 'transport', 'taxi'];
const KIND_AR: Record<PlateKind, string> = { private: '', transport: '، نقل خاص', taxi: '، أجرة' };

/**
 * A Saudi plate drawn as the real one: white plate, black field, five white panels. Top row: Arabic-Indic digits
 * and the Arabic letters; bottom row: Western digits (DIN) and the Latin letters, each under its Arabic one, so the
 * Latin reads in the opposite order. The strip carries the emblem, «السعودية», K S A, the hologram and the kind's
 * mark: a circle on a white strip (private), a triangle down on blue (نقل خاص), a triangle up on yellow (أجرة).
 * Standard size (2.1 : 1) unless the plate is the long one (4.73 : 1), whose strip block stands in the middle.
 * Plates with one to three digits show only those digits. A rare or legend plate sits in an alloy holder.
 */
export function CarPlate({ plate, size = 'md', showValue }: { plate: PlatePub; size?: 'sm' | 'md' | 'lg'; showValue?: boolean }) {
  const look = plate as PlatePub & { kind?: string; format?: string };
  const kind: PlateKind = KINDS.includes(look.kind as PlateKind) ? (look.kind as PlateKind) : 'private';
  const format = look.format === 'eu' ? 'eu' : 'us';
  const sz = SIZES.includes(size) ? size : 'md';
  const sp = plate.special;
  const ar = plate.ar.split(/\s+/).filter(Boolean);
  const en = plate.en.split(/\s+/).filter(Boolean);
  const num = String(plate.num ?? '').replace(/[^0-9]/g, '').slice(0, 4);
  const label = `لوحة ${plate.ar} ${num}${KIND_AR[kind]}${sp ? `، ${sp.label}` : ''}`;
  return (
    <div className={`splate ${format} ${sz}${sp ? ` special t-${sp.tier}` : ''}`}>
      <span className="sp-holder">
        <PlateSvg ar={ar} en={en} num={num} kind={kind} format={format} small={sz === 'sm'} label={label} />
      </span>
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

/** The player's own plate as a miniature standard plate beside their name: their letters, Arabic over Latin,
 *  with the private strip. `letters` is [Arabic, Latin in reading order]. */
export function MiniPlate({ letters }: { letters: [string, string] }) {
  const ar = letters[0].split(/\s+/).filter(Boolean);
  const en = letters[1].split(/\s+/).filter(Boolean).reverse();
  return (
    <span className="splate mini" aria-hidden="true">
      <MiniSvg ar={ar} en={en} />
    </span>
  );
}

/** The miniature: the letters panel and the strip only, its characters drawn larger so they read at 24px. */
function MiniSvg({ ar, en }: { ar: string[]; en: string[] }) {
  const W = 112;
  const x0 = LIP + BORDER;
  const rh = (100 - 2 * x0 - GAP) / 2;
  const lw = 82;
  const sw = W - 2 * x0 - lw - GAP;
  const top: Box = { x: x0, y: x0, w: lw, h: rh };
  const bot: Box = { x: x0, y: x0 + rh + GAP, w: lw, h: rh };
  const lc = letterCentres(Math.max(ar.length, en.length), bot, 25);
  const sx = x0 + lw + GAP;
  const scx = sx + sw / 2;
  return (
    <svg className="sp-svg" viewBox={`0 0 ${W} 100`} style={{ ['--r' as string]: W / 100 }}>
      <rect x="0" y="0" width={W} height="100" rx="7" fill="#f6f6f3" />
      <rect x={LIP} y={LIP} width={W - 2 * LIP} height={100 - 2 * LIP} rx="6" fill={INK} />
      <rect x={top.x} y={top.y} width={top.w} height={top.h} rx={PANEL_R} fill="#efefec" />
      <rect x={bot.x} y={bot.y} width={bot.w} height={bot.h} rx={PANEL_R} fill="#efefec" />
      <rect x={sx} y={x0} width={sw} height={100 - 2 * x0} rx={PANEL_R} fill={STRIP.private} />
      <g fill={INK} color={INK}>
        <ArabicLetters ar={ar} centres={lc} row={top} h={28} maxW={21} />
        <LatinLetters en={en} centres={lc} row={bot} cap={24} />
        <Emblem cx={scx} top={10} h={28} />
        <Mark kind="private" cx={scx} cy={78} d={14} />
      </g>
    </svg>
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
