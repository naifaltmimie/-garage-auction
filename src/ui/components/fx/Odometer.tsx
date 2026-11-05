// Mechanical Odometer: TACTILE UI by cipriantitire (tactileui.dev), via 21st.dev, MIT licence.
// Kept as published; wrap it, don't edit it, so it can be updated from the source.
"use client";

import { useEffect, useRef, type CSSProperties } from "react";
/**
 * Odometer — TACTILE UI.
 *
 * A mechanical drum counter as a number display: numerals printed on drums
 * that turn behind a window, the way an odometer, a tally counter or a petrol
 * pump register shows a number. Three mechanisms:
 *
 *   1. The carry. Only the last drum is driven; every other drum moves only
 *      while the drum to its right passes from 9 to 0. The first carry takes
 *      the last tenth of the last drum's step, and every carry above it turns
 *      in lock-step with the drum below, so 1,099 → 1,100 rolls the tens and
 *      the hundreds over TOGETHER at the very end of the units' turn. A number
 *      ticker that tweens each digit on its own cannot do that, and it is the
 *      whole reason this reads as a machine. `drumPositions` is that rule as a
 *      pure function of one continuous value.
 *   2. A spring on the value, not on the digits. A new value is a target; the
 *      continuous value springs toward it (optional overshoot), and every drum
 *      follows from the carry rule. A drum turning faster than the spin cap is
 *      drawn turning AT the cap, smeared: a jump of millions spins the low drums
 *      as a blur while the high ones visibly roll, and all of them land exactly.
 *   3. Light that does not turn. A drum is a cylinder on a horizontal axle, so
 *      the light on it depends only on height in the window, never on how far
 *      it has turned. One overlay per drum, computed once from the lamp, gives
 *      the darkening toward the top and bottom and the specular band along the
 *      drum; the numerals roll through it. The faces are real DOM text on a
 *      ten-sided CSS 3D drum, so the figures are crisp and truly foreshortened.
 *
 * It costs nothing at rest: the loop runs only while a value is travelling,
 * sleeps once it lands — a slow tally sleeps between its steps too — pauses off
 * screen and in a hidden tab, and a two-second frame gap cannot blow up the
 * spring.
 *
 * The housing is a machined plate in a material that belongs to the drums
 * (black anodised aluminium for ink drums, satin steel for bone, blackened
 * brass worn bright at the edges for brass): diamond-cut chamfers lit by the
 * one lamp, countersunk screws, an optional paint-filled engraved label, and a
 * cover glass with the lamp's reflection in it and a refracting edge.
 *
 * `size: 'fit'` (the default) fills the host's box — a preview stage, a tile,
 * a phone — and follows it; a number fixes the numeral size and shrinks only
 * when the host is narrower.
 *
 * The number is text. A visually hidden element holds the formatted value and
 * announces it politely once it has LANDED — never each frame; while counting
 * it stops announcing and is kept current for anyone who reads it; a counter
 * set `announce: false` (a tally beside the real content) never announces. The
 * drums are aria-hidden. Reduced motion: the value changes instantly, nothing spins,
 * no frame is requested.
 *
 * The numerals are Big Shoulders Bold (SIL OFL 1.1), embedded in this file as a
 * WOFF2 data URI, under its licence, so the drums print the same figures on every
 * platform. No dependencies, no image.
 */


const clamp = (n: any, lo: any, hi: any) => Math.min(hi, Math.max(lo, n));

/** How much of the last drum's step the first carry takes. The brief: the last tenth. */
const CARRY = 0.1;

/** More drums than a double can count exactly would lie about the last digit. */
const MAX_DRUMS = 15;

const wrap10 = (p: any) => ((p % 10) + 10) % 10;
/** A change of drum position folded into [-5, 5): 9.9 → 0.1 is +0.2, not -9.8. */
const wrapDelta = (d: any) => wrap10(d + 5) - 5;

/** |value| in units of the last drum, with binary dust removed: 10.1 at two decimals is 1010, not 1009.9999999999999. */
function scaled(value: any, decimals: any = 0) {
  const n = Math.abs(value) * 10 ** decimals;
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-6 ? r : n;
}

/** The value rounded to what the drums can show. */
function quantise(value: any, decimals: any = 0) {
  const f = 10 ** decimals;
  const q = Math.round(value * f) / f;
  return q === 0 ? 0 : q; // never -0: it would print a sign
}

/**
 * Every drum's position in [0, 10) for a continuous value; index 0 is the
 * last (least significant) drum. The last drum turns with the value. Drum k
 * turns only while drum k-1 passes from 9 to 0: the first carry over the last
 * `carry` of that step, every carry above it in lock-step with the drum below.
 */
function drumPositions(value: any, count: any, decimals: any = 0, carry: any = CARRY) {
  const n = scaled(value, decimals);
  const out = new Array(count);
  if (count < 1) return out;
  let below = n % 10;
  out[0] = below;
  for (let k = 1; k < count; k += 1) {
    const w = k === 1 ? carry : 1;
    const digit = Math.floor(n / 10 ** k) % 10;
    below = digit + clamp((below - 10 + w) / w, 0, 1);
    out[k] = below;
  }
  return out;
}

/** How many drums a value needs: its integer digits (at least one) plus the decimals. */
function drumsFor(value: any, decimals: any = 0) {
  const whole = Math.floor(Math.abs(value));
  return (whole >= 1 ? String(whole).length : 1) + decimals;
}

/**
 * Which drums print their zero. A leading drum — nothing but zeros at and
 * above it — has a blank where its 0 would be, so 89 on six drums reads "89",
 * not "000089". The units and the decimals always print.
 */
function blankZeros(value: any, count: any, decimals: any = 0) {
  const n = scaled(value, decimals);
  return Array.from({ length: count }, (_: any, k: any) => k > decimals && n < 10 ** k);
}

/**
 * Left to right: the sign plate, then drums and fixed separator plates. A
 * group separator stands to the right of the integer drum whose place is a
 * locale break (3, 6, 9… or 3, 5, 7… in en-IN); the decimal plate stands to
 * the right of the units drum.
 */
function slotsFor(count: any, decimals: any, breaks: any = [], signed: any = false) {
  const out: { kind: string; k?: any }[] = signed ? [{ kind: 'sign' }] : [];
  for (let k = count - 1; k >= 0; k -= 1) {
    out.push({ kind: 'drum', k });
    const j = k - decimals;
    if (j > 0 && breaks.includes(j)) out.push({ kind: 'group', k });
    if (k === decimals && decimals > 0) out.push({ kind: 'decimal', k });
  }
  return out;
}

/**
 * A locale's number, taken apart: the group and decimal marks, the minus
 * sign, the ten digit glyphs the drums are printed with, and where the group
 * breaks fall. Read from Intl.NumberFormat parts, so en-IN's lakh grouping,
 * fr-FR's narrow space and ar-EG's digits all come from the platform.
 */
function numberStyle(locale: any = 'en-US', decimals: any = 0, grouping: any = true) {
  let nf;
  try {
    nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping });
  } catch {
    nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping });
  }
  const loc = nf.resolvedOptions().locale;
  const parts = nf.formatToParts(888888888888888n);
  const ints = parts.filter((p: any) => p.type === 'integer').map((p: any) => p.value.length);
  const breaks = [];
  let acc = 0;
  for (let i = ints.length - 1; i > 0; i -= 1) {
    acc += ints[i];
    breaks.push(acc);
  }
  const group = parts.find((p: any) => p.type === 'group')?.value ?? '';
  const decimal = new Intl.NumberFormat(loc, { minimumFractionDigits: 1 }).formatToParts(1.5)
    .find((p: any) => p.type === 'decimal')?.value ?? '.';
  const minus = new Intl.NumberFormat(loc).formatToParts(-1).find((p: any) => p.type === 'minusSign')?.value ?? '-';
  const plain = new Intl.NumberFormat(loc, { useGrouping: false });
  const digits = Array.from({ length: 10 }, (_: any, i: any) => plain.format(i));
  return { nf, locale: loc, group, decimal, minus, digits, breaks };
}

/** The value as a sentence reads it: sign, prefix, the locale's number, suffix. */
function formatValue(value: any, style: any, prefix: any = '', suffix: any = '') {
  const body = style.nf.format(Math.abs(value));
  return `${value < 0 ? style.minus : ''}${prefix}${body}${suffix}`;
}

/**
 * Advance the value's spring. The step is clamped to 1/30 s and sub-stepped
 * at 1/120 s: a background tab that returns with a 2.5 s frame gap advances
 * one sane frame instead of launching the drums.
 */
function stepSpring(s: any, target: any, dt: any, stiffness: any = 140, damping: any = 0.85) {
  const c = 2 * damping * Math.sqrt(stiffness);
  let left = clamp(dt, 0, 1 / 30);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    s.v += (stiffness * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
  return s;
}

/** Landed: within a thousandth of the last drum's step, and still. */
function landed(s: any, target: any, decimals: any = 0) {
  const lsd = 10 ** -decimals;
  const tol = Math.max(lsd * 1e-3, Math.abs(target) * 1e-15);
  return Math.abs(target - s.x) <= tol && Math.abs(s.v) < lsd * 0.02;
}

/** How smeared a drum is from its speed in digits per second: none below a third of the cap, all of it at the cap. */
function smear(speed: any, cap: any) {
  const t = clamp((speed - cap / 3) / (cap - cap / 3), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * A drum turning faster than the cap is DRAWN turning at the cap: past it a
 * frame skips more than half a digit, the figures strobe and can even appear
 * to run backwards. Returns the drawn position and whether it free-runs.
 */
function spin(phase: any, truePos: any, speed: any, dir: any, cap: any, dt: any) {
  if (speed > cap && dt > 0) return { pos: wrap10(phase + dir * cap * dt), free: true };
  return { pos: wrap10(truePos), free: false };
}

/** Screen direction toward the lamp: 0° is from above, clockwise; y points down. */
function lampOf(light: any) {
  const t = (light * Math.PI) / 180;
  return { lx: Math.sin(t), ly: -Math.cos(t) };
}

// Drum geometry, in em of the numeral size. Ten faces: the radius follows
// from the face (the chord between two numerals).
const FACE = 1.12;
const RADIUS = FACE / (2 * Math.tan(Math.PI / 10));
const WINDOW = 1.56;

/** The family name the stylesheet gives the bundled face. */
const FACE_FAMILY = 'Odometer Figures';

/**
 * The numeral size that fills a box: the object's width and height are
 * linear in its numeral size (every length is in em), plus a margin of
 * `pad` em on each side for the plate's shadow. A missing dimension (0) does
 * not constrain; with neither, `fallback`.
 */
function fitSize(availW: any, availH: any, perW: any, perH: any, { pad = 0.22, min = 8, max = 400, fallback = 72 }: any = {}) {
  const byW = availW > 0 && perW > 0 ? availW / (perW + 2 * pad) : Infinity;
  const byH = availH > 0 && perH > 0 ? availH / (perH + 2 * pad) : Infinity;
  const s = Math.min(byW, byH);
  return clamp(Number.isFinite(s) ? Math.floor(s * 10) / 10 : fallback, min, max);
}

/**
 * When the next step of a tally is due, in ms after `t0`: the tally adds one
 * last-drum step every |1 / rate| s (value per second).
 */
function nextStepAt(t0: any, now: any, rate: any, decimals: any = 0) {
  const every = (10 ** -decimals / Math.abs(rate)) * 1000;
  return t0 + (Math.floor((now - t0) / every + 1e-9) + 1) * every;
}

const smoothstep = (a: any, b: any, x: any) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * The light on a drum from the top of the window (0) to the bottom (1):
 * `dark` is how much black to lay over the printed surface, `light` how much
 * lamp. Lambert from the lamp 38° off the line of sight, a specular band where
 * the drum's normal bisects lamp and eye, and occlusion where the window's lip
 * hides the drum as it curves away.
 */
function drumLight(light: any, gloss: any = 0.2, samples: any = 21, radius: any = RADIUS, half: any = WINDOW / 2) {
  const { lx, ly } = lampOf(light);
  const E = Math.sin((38 * Math.PI) / 180);
  const Z = Math.cos((38 * Math.PI) / 180);
  const L = [lx * E, ly * E, Z];
  // The band lies where the normal (in the drum's plane of turn) is nearest
  // the half-vector. A lamp to the side still lights the band; it is fainter.
  const hy = L[1];
  const hz = L[2] + 1;
  const hl = Math.hypot(hy, hz);
  const side = 1 - 0.45 * Math.abs(lx);
  const out = [];
  for (let i = 0; i < samples; i += 1) {
    const at = i / (samples - 1);
    const y = (-1 + 2 * at) * half;
    const s = clamp(-y / radius, -1, 1);
    const c = Math.sqrt(1 - s * s);
    const ny = -s;
    const dif = Math.max(0, ny * L[1] + c * L[2]) / Z;
    const spec = gloss * side * Math.max(0, (ny * hy + c * hz) / hl) ** 90;
    const ao = smoothstep(0.42, 1, Math.abs(y) / half) * 0.72;
    const b = dif * (1 - ao);
    out.push({ at, dark: clamp(1 - b, 0, 0.94), light: clamp((b - 1) * 0.45 + spec, 0, 1) });
  }
  return out;
}

// ------------------------------------------------------------------ the object

let probe;
/**
 * How far to move a figure down so its ink, not its line box, sits on the
 * drum's centre line. Digits stand on the baseline, above the descender
 * space, so a centred line box puts them high: the next figure peeks in at
 * the bottom of the window and none at the top. Measured from the font the
 * page actually resolved — the bundled face once it has loaded, a fallback
 * before — and measured again when the face arrives.
 */
function opticalLift(cs: any) {
  try {
    probe ??= document.createElement('canvas').getContext('2d');
    probe.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
    const m = probe.measureText('0123456789');
    const A = m.fontBoundingBoxAscent / 100;
    const D = m.fontBoundingBoxDescent / 100;
    const gA = m.actualBoundingBoxAscent / 100;
    const gD = m.actualBoundingBoxDescent / 100;
    const lift = (D - A + gA - gD) / 2;
    return Number.isFinite(lift) ? clamp(lift, -0.2, 0.2) : 0;
  } catch {
    return 0;
  }
}

/**
 * Housings. `base` is the plate's body, `light`/`dark` its lit and shaded
 * tones; `edge`/`edgeDark` the metal a chamfer cuts down to (a diamond-cut
 * edge on anodised aluminium is bright bare aluminium, on blackened brass it
 * is brass); `ink` the paint in the engraving; `screw` the screws' metal.
 */
const PLATES: Readonly<Record<string, any>> = Object.freeze({
  anodised: Object.freeze({ base: '#232427', light: '#5e626a', dark: '#0a0b0d', ink: '#e9e2d1', edge: '#f4f6f8', edgeDark: '#2b2e33', screw: '#c9ced4', brush: 0.5 }),
  steel: Object.freeze({ base: '#a8adb3', light: '#f4f6f8', dark: '#3d4247', ink: '#1b1d20', edge: '#ffffff', edgeDark: '#565b61', screw: '#bfc4ca', brush: 0.7 }),
  graphite: Object.freeze({ base: '#393b40', light: '#8e939a', dark: '#111214', ink: '#e2e5e9', edge: '#e9ecef', edgeDark: '#2a2c30', screw: '#c4c9cf', brush: 0.55 }),
  blackened: Object.freeze({ base: '#2a241b', light: '#6b5838', dark: '#0e0b07', ink: '#dcb96f', edge: '#f6dfa0', edgeDark: '#4e3810', screw: '#c7a256', brush: 0.5 }),
});

/**
 * Drum finishes, each in the housing it would be sold in. `red` is the
 * signal drum (the classic odometer tenths).
 */
const FINISHES: Readonly<Record<string, any>> = Object.freeze({
  ink: Object.freeze({ drum: '#1a1b1d', figure: '#ece4d2', plate: 'anodised', gloss: 0.34, tint: '255, 250, 240' }),
  bone: Object.freeze({ drum: '#e6dfd0', figure: '#17181a', plate: 'steel', gloss: 0.14, tint: '255, 252, 245' }),
  steel: Object.freeze({ drum: '#5e646b', figure: '#f6f8f9', plate: 'graphite', gloss: 0.5, tint: '240, 246, 252' }),
  brass: Object.freeze({ drum: '#b48a3a', figure: '#1f1507', plate: 'blackened', gloss: 0.55, tint: '255, 236, 190' }),
});

/**
 * `finish: 'auto'` follows the page: each finish the kit ships has the drums it
 * calls for, bone in a steel housing on a light one, ink in anodised aluminium
 * on AMOLED. On Graphite, Black, Phosphor and Night (`page`) the counter is
 * drawn from the page's object tokens, in that finish's own language:
 * anodised metal with bright cut edges, black glass traced in the display's
 * light, dim metal with its figures lit from inside. A finish not listed goes
 * by the page's tone.
 */
const AUTO: Readonly<Record<string, string>> = Object.freeze({
  aluminium: 'bone', graphite: 'page', porcelain: 'bone', black: 'page', paper: 'bone', phosphor: 'page',
  daylight: 'bone', night: 'page', 'e-paper': 'bone', amoled: 'ink',
});

/** The drums drawn: the finish asked for, or on `auto` the page's finish's, then its tone, then the system's. */
function resolveMaterial(own: any, around: any, prefersDark: any, tone: any) {
  if (own !== 'auto') return own;
  if (AUTO[around]) return AUTO[around];
  return (tone === 'light' || tone === 'dark' ? tone === 'dark' : prefersDark) ? 'ink' : 'bone';
}

const SIGNAL = Object.freeze({ drum: '#d93a2b', figure: '#fff3e6' });

const BEZELS = Object.freeze(['slot', 'cells', 'bare']);
const REDS = Object.freeze(['none', 'last', 'decimals']);

const DEFAULTS = Object.freeze({
  value: 0,
  decimals: 0,
  prefix: '',
  currency: '',
  suffix: '',
  locale: 'en-US',
  grouping: true,
  digits: 1,
  zeros: false,
  finish: 'theme',
  red: 'none',
  bezel: 'slot',
  stiffness: 140,
  damping: 0.85,
  maxSpin: 24,
  count: 0,
  wear: 0.35,
  light: 315,
  size: 'fit',
  label: '',
  sound: false,
  announce: true,
});

function normalise(opts: any, previous?: any) {
  const o = { ...DEFAULTS, ...previous, ...opts };
  o.decimals = clamp(Math.round(+o.decimals || 0), 0, 6);
  o.digits = clamp(Math.round(+o.digits || 1), 1, MAX_DRUMS - o.decimals);
  o.prefix = String(o.prefix ?? '').slice(0, 8);
  o.currency = String(o.currency ?? '').slice(0, 3);
  o.suffix = String(o.suffix ?? '').slice(0, 24);
  o.label = String(o.label ?? '').slice(0, 32);
  o.locale = String(o.locale || 'en-US');
  o.grouping = o.grouping !== false;
  o.zeros = !!o.zeros;
  if (o.finish !== 'theme' && o.finish !== 'auto' && !FINISHES[o.finish]) o.finish = 'theme';
  if (!REDS.includes(o.red)) o.red = 'none';
  if (!BEZELS.includes(o.bezel)) o.bezel = 'slot';
  o.stiffness = clamp(+o.stiffness || 140, 10, 1000);
  o.damping = clamp(+o.damping || 0.85, 0.2, 2);
  o.maxSpin = clamp(+o.maxSpin || 24, 3, 120);
  o.count = Number.isFinite(+o.count) ? +o.count : 0;
  o.wear = clamp(+o.wear || 0, 0, 1);
  o.light = ((+o.light || 0) % 360 + 360) % 360;
  // 'fit' (or 0) fills the host; a number is the numeral size in px.
  o.size = +o.size > 0 ? clamp(+o.size, 8, 400) : 'fit';
  o.sound = !!o.sound;
  // false: an ambient counter (a tally beside the real content) is read in place, never announced.
  o.announce = o.announce !== false;
  return o;
}

/** The largest magnitude the drums can hold at these decimals. */
const limitFor = (decimals: any) => (10 ** (MAX_DRUMS - decimals) - 1) / 10 ** decimals;

/** A stable pseudo-random number in [0, 1) per drum and purpose: wear must not change between renders. */
const hash = (i: any, salt: any) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const STRUCTURE = ['decimals', 'locale', 'grouping', 'digits', 'zeros', 'finish', 'red', 'bezel', 'prefix', 'currency', 'suffix', 'label', 'wear'];

const el = (tag: string, cls?: string, text?: string): HTMLElement => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/**
 * Put a drum's faces where position `pos` puts them. Each face carries its
 * whole transform under a flat parent with perspective: nesting the faces in
 * a rotating preserve-3d drum is the obvious build, and Chrome culls the face
 * above the axle in it at some viewport sizes (a black cap on every drum at 0).
 * Only faces that can reach the window are placed: a face spans ±18° and the
 * window shows ±27° of the drum, so nothing past 45° is ever seen. Hiding the
 * rest matters — every face kept visible costs a layer and a repaint.
 */
function turn(faces: any, pos: any) {
  for (let i = 0; i < 10; i += 1) {
    const a = wrapDelta(pos - i) * 36; // degrees from the front, in [-180, 180)
    const f = faces[i];
    const show = Math.abs(a) < 47;
    if (show !== f.show) {
      f.el.style.visibility = show ? '' : 'hidden';
      f.show = show;
    }
    if (show) f.el.style.transform = `translateZ(calc(var(--od-r) * -1)) rotateX(${a.toFixed(3)}deg) translateZ(var(--od-r))`;
  }
}

const hex = (h: any) => [1, 3, 5].map((i: any) => parseInt(h.slice(i, i + 2), 16));
const mixHex = (a: any, b: any, t: any) => {
  const pa = hex(a);
  const pb = hex(b);
  return `rgb(${pa.map((v: any, i: any) => Math.round(v + (pb[i] - v) * t)).join(', ')})`;
};
/** The same mix, as #rrggbb. */
const blend = (a: any, b: any, t: any) => `#${((1 << 24) | hex(a).map((v: any, i: any) => Math.round(v + (hex(b)[i] - v) * t)).reduce((n: any, v: any) => (n << 8) | v, 0)).toString(16).slice(1)}`;

/** The page's object tokens a `page` counter is made from (--tui-obj-plate ... --tui-obj-mark). */
const LOOK = Object.freeze(['plate', 'dark', 'body', 'lite', 'spec', 'env', 'frame', 'edge', 'mark']);

let hexProbe = null;
/** Any opaque CSS colour (hex, rgb(), oklch() ...) as #rrggbb, the form the maths here reads: painted as one pixel and read back. */
const cssHex = (value: any) => {
  hexProbe ??= document.createElement('canvas');
  hexProbe.width = 1;
  hexProbe.height = 1;
  const g = hexProbe.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#000000';
  g.fillStyle = value;
  g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `#${((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1)}`;
};

/** The page's object tokens as hex colours and numbers, or null on a page without them. */
function readLook(el: any) {
  const s = getComputedStyle(el);
  const v = (k: any) => s.getPropertyValue(`--tui-obj-${k}`).trim();
  if (!v('frame')) return null;
  const t = Object.fromEntries(LOOK.map((k: any) => [k, cssHex(v(k) || v('frame'))]));
  t.shadow = clamp(parseFloat(v('shadow')) || 0.4, 0, 1);
  t.glow = clamp(parseFloat(v('glow')) || 0, 0, 1);
  return t;
}

/**
 * The counter in a page's own material, from its object tokens: the housing is
 * the finish's frame with its mid tone as the lit sheen, its dark for the
 * shaded side and its edge for every chamfer, bright where the lamp catches
 * it; the drums are the finish's dark glass, their figures and the engraving
 * its mark. With glow the figures, the engraving and the housing's edge glow.
 * The signal drum stays red.
 */
function finishFrom(t: any) {
  const tint = hex(t.spec).join(', ');
  return {
    key: ['page', ...LOOK.map((k: any) => t[k]), t.glow].join('|'),
    drum: blend(t.plate, t.dark, 0.5), figure: t.mark, gloss: 0.34, tint,
    plate: {
      base: t.frame, light: t.body, dark: t.dark, ink: t.mark, edge: t.edge, edgeDark: blend(t.frame, t.edge, 0.14), screw: t.lite, brush: 0.5,
    },
    edge: t.edge, glow: t.glow, hot: tint, shade: t.shadow / 0.5,
  };
}

/** The shadcn variables the "theme" finish reads, with the slate values shadcn ships as the fallback when a page has none. */
const THEME_FALLBACK: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  background: ['0 0% 100%', '222.2 84% 4.9%'],
  foreground: ['222.2 84% 4.9%', '210 40% 98%'],
  border: ['214.3 31.8% 91.4%', '217.2 32.6% 17.5%'],
  muted: ['210 40% 96.1%', '217.2 32.6% 17.5%'],
  'muted-foreground': ['215.4 16.3% 46.9%', '215 20.2% 65.1%'],
});

/** A variable's value as a CSS colour: bare "H S% L%" components (shadcn's own form) become hsl(), a full colour (oklch(), #hex) is used as it is. */
function themeVar(el: Element, name: string, darkFallback: boolean) {
  const raw = getComputedStyle(el).getPropertyValue(`--${name}`).trim();
  const v = raw || THEME_FALLBACK[name][darkFallback ? 1 : 0];
  return /^[\d.]+(deg)?[\s,]+[\d.]+%[\s,]+[\d.]+%(\s*\/\s*[\d.%]+)?$/.test(v) ? `hsl(${v})` : v;
}

/**
 * The counter made from the page's shadcn variables, through the same recipe
 * a page's own finish uses. The ground (--background) says whether the page is
 * light or dark. Light: a housing of --border drawn toward --muted-foreground
 * with --background chamfers, drums of --muted, figures in --foreground. Dark:
 * the housing drawn toward --foreground, drums in the ground, figures in --foreground.
 */
function themeLook(el: Element, systemDark: boolean) {
  const bg = cssHex(themeVar(el, 'background', systemDark));
  const [r, g, b] = hex(bg);
  const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.45;
  const c = (n: string) => cssHex(themeVar(el, n, dark));
  const fg = c('foreground');
  const border = c('border');
  const mutedFg = c('muted-foreground');
  const muted = c('muted');
  const frame = blend(border, mutedFg, dark ? 0.25 : 0.4);
  return dark
    ? { plate: bg, dark: bg, body: blend(frame, fg, 0.25), lite: mutedFg, spec: fg, env: bg, frame, edge: mutedFg, mark: fg, shadow: 0.5, glow: 0 }
    : { plate: muted, drum: blend(muted, border, 0.3), dark: blend(mutedFg, fg, 0.5), body: bg, lite: border, spec: bg, env: bg, frame, edge: bg, mark: fg, shadow: 0.35, glow: 0 };
}

/**
 * How much lamp a 45° chamfer takes, per side (top, right, bottom, left).
 * `recess` is a window cut into the plate, whose walls face inward; otherwise
 * the plate's own raised edge, whose walls face out. Same lamp as the drums.
 */
function bevel(light: any, recess: any) {
  const { lx, ly } = lampOf(light);
  const E = Math.sin((38 * Math.PI) / 180);
  const Z = Math.cos((38 * Math.PI) / 180);
  const s = recess ? 1 : -1;
  const k = Math.SQRT1_2;
  const lit = (nx: any, ny: any) => clamp(k * (nx * lx * E + ny * ly * E) + k * Z, 0, 1);
  return [lit(0, s), lit(-s, 0), lit(0, -s), lit(s, 0)];
}

/**
 * The chamfer colours, per side (top, right, bottom, left): each side's angle
 * to the lamp mixes the plate's bare-metal edge from dark to lit. `raise` is
 * the plate's outer edge, `recess` the window's walls.
 */
function chamfers(light: any, plate: any = 'anodised') {
  const p = typeof plate === 'object' ? plate : PLATES[plate] ?? PLATES.anodised;
  const tone = (b: any) => mixHex(p.edgeDark, p.edge, 0.7 * clamp((b - 0.3) / 0.62, 0, 1) ** 1.3);
  return { raise: bevel(light, false).map(tone), recess: bevel(light, true).map(tone) };
}

const rgba = (rgb: any, a: any) => `rgba(${rgb}, ${a.toFixed(3)})`;
const f3 = (n: any) => Number(n.toFixed(3));

class Odometer {
  host: any;
  o: any;
  mq: any;
  reduced: any;
  dark: any;
  target: any;
  s: any;
  visible: any;
  raf: any;
  last: any;
  lastInt: any;
  lastTick: any;
  lastText: any;
  counting: any;
  timer: any;
  text: any;
  plate: any;
  root: any;
  style: any;
  on: any;
  finishObs: any;
  io: any;
  seen: any;
  ro: any;
  mat: any;
  material: any;
  count_: any;
  signed: any;
  drums: any;
  seps: any;
  signEl: any;
  window: any;
  stepTimer: any;
  listening: any;
  audio: any;
  noise: any;
  constructor(host: any, opts: any = {}) {
    if (!host) throw new Error('Odometer needs a host element');
    this.host = host;
    this.o = normalise(opts);
    this.mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reduced = !!this.mq?.matches;
    this.dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

    this.target = this.#clampValue(this.o.value);
    this.s = { x: this.target, v: 0 };
    this.visible = false;
    this.raf = 0;
    this.last = 0;
    this.lastInt = Math.floor(scaled(this.target, this.o.decimals));
    this.lastTick = 0;
    this.lastText = 0;
    this.counting = null;
    this.timer = 0;

    const root = el('div', 'od');
    root.dataset.object = 'odometer';
    root.dataset.state = 'asleep';
    // The number is text: this is what a screen reader reads, copies and hears.
    this.text = el('span', 'od-text');
    this.text.setAttribute('aria-live', this.o.announce ? 'polite' : 'off');
    this.text.setAttribute('aria-atomic', 'true');
    this.plate = el('div', 'od-plate');
    this.plate.setAttribute('aria-hidden', 'true');
    root.append(this.text, this.plate);
    this.root = root;
    // The first value is content, not news: it is in place before the live
    // region reaches the page, so nothing announces a number nobody changed.
    this.style = numberStyle(this.o.locale, this.o.decimals, this.o.grouping);
    this.text.textContent = formatValue(this.target, this.style, this.o.currency + this.o.prefix, this.o.suffix);
    host.append(root);

    this.on = {
      motion: (e: any) => {
        this.reduced = e.matches;
        if (this.reduced) this.#jump();
        this.#restartCount();
        this.#wake();
      },
      visibility: () => {
        if (document.hidden) this.#sleep();
        else this.#wake();
      },
      gesture: () => this.#armAudio(),
      // On auto the drums follow the page's finish: a change of it builds them again in the finish it now means.
      finish: () => {
        if ((this.o.finish !== 'auto' && this.o.finish !== 'theme') || this.#material().key === this.mat?.key) return;
        this.#build();
        this.#paint(0);
      },
    };
    this.mq?.addEventListener?.('change', this.on.motion);
    this.dark?.addEventListener?.('change', this.on.finish);
    document.addEventListener('visibilitychange', this.on.visibility);
    this.finishObs = new MutationObserver(this.on.finish);
    this.finishObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-finish', 'data-tone', 'class', 'data-theme'], subtree: true });

    this.#build();
    this.#paint(0);
    if (this.o.sound) this.#listenForGesture();
    // The face arrives after the first build (it is invisible until then, not
    // a fallback that jumps): measure the figures again once it has.
    document.fonts?.load?.(`700 1em "${FACE_FAMILY}"`).then(() => {
      if (this.root.isConnected) { this.#dress(); this.#fit(); }
    }, () => {});

    this.io = new IntersectionObserver(([entry]: any) => {
      this.visible = entry.isIntersecting;
      this.seen = true;
      if (this.visible) this.#wake();
    });
    this.io.observe(root);
    // Fit: the counter fills its host and follows it. A fixed size keeps its
    // numeral size and shrinks only when the host is narrower.
    this.ro = new ResizeObserver(() => this.#fit());
    this.ro.observe(host);

    if (this.o.count) this.count(this.o.count);
  }

  /** The value the drums are going to (or showing, once landed). */
  get value() { return this.target; }

  /** What the counter is doing now: asleep, or running while a value travels. */
  get state() { return this.root.dataset.state; }

  /**
   * Roll to a new value. `instant` jumps without spinning; so does reduced
   * motion, and so does a counter known to be off screen or in a hidden tab:
   * nobody can watch that roll, and its text must not wait for them to.
   */
  setValue(v: any, { instant = false }: any = {}) {
    const t = this.#clampValue(v);
    if (!Number.isFinite(t)) return this;
    this.target = t;
    if (this.counting) {
      this.counting.base = t;
      this.counting.t0 = performance.now();
    }
    if (instant || this.reduced || (this.seen && !this.visible) || document.hidden) {
      this.#jump();
      return this;
    }
    this.#grow();
    this.#wake();
    return this;
  }

  /**
   * A live tally: add `rate` (value per second, negative counts down) in
   * whole steps of the last drum, until count(0). Each step rolls like any
   * other change; fast enough, the steps blend into a steady spin.
   */
  count(rate: any = 1) {
    const r = Number.isFinite(+rate) ? +rate : 0;
    this.o.count = r;
    this.counting = r ? { rate: r, base: this.target, t0: performance.now() } : null;
    this.#live();
    this.#restartCount();
    this.#wake();
    return this;
  }

  /** Change options in place. A `value` rolls to it; everything else redraws. */
  update(opts: any = {}) {
    const prev = this.o;
    this.o = normalise(opts, this.o);
    if (STRUCTURE.some((k: any) => prev[k] !== this.o[k])) {
      this.target = this.#clampValue(this.target);
      this.s.x = this.#clampValue(this.s.x);
      this.#build();
    } else if (prev.light !== this.o.light || prev.size !== this.o.size) {
      this.#dress();
      this.#fit();
    }
    this.#paint(0);
    if (this.o.sound && !prev.sound) this.#listenForGesture();
    if (this.o.announce !== prev.announce) this.#live();
    if ('count' in opts && this.o.count !== (this.counting?.rate ?? 0)) this.count(this.o.count);
    if ('value' in opts && this.#clampValue(opts.value) !== this.target) this.setValue(opts.value);
    else this.#announce();
    return this;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.timer);
    clearTimeout(this.stepTimer);
    this.io.disconnect();
    this.ro.disconnect();
    this.finishObs.disconnect();
    this.mq?.removeEventListener?.('change', this.on.motion);
    this.dark?.removeEventListener?.('change', this.on.finish);
    document.removeEventListener('visibilitychange', this.on.visibility);
    this.#stopListening();
    this.audio?.close?.();
    this.root.remove();
  }

  // ---------------------------------------------------------------- values

  #clampValue(v: any) {
    const lim = limitFor(this.o.decimals);
    return quantise(clamp(Number.isFinite(+v) ? +v : 0, -lim, lim), this.o.decimals);
  }

  /** Straight to the target: reduced motion, `instant`, or a restart. */
  #jump() {
    this.s.x = this.target;
    this.s.v = 0;
    this.#grow();
    this.#shrink();
    this.#paint(0);
    this.#announce();
    this.lastInt = Math.floor(scaled(this.target, this.o.decimals));
  }

  // ---------------------------------------------------------------- the build

  /**
   * The finish drawn: the option, or on `auto` the page's finish around the
   * host. `{ key, name, fin, plate }`: what changes it, the name on the root
   * (`page` for a counter made from the page's tokens), its drums and its housing.
   */
  #material() {
    if (this.o.finish === 'theme') {
      const look: any = themeLook(this.host, !!this.dark?.matches);
      const fin = { ...finishFrom(look), ...(look.drum ? { drum: look.drum } : {}) };
      return { key: fin.key, name: 'theme', fin, plate: fin.plate };
    }
    const name = resolveMaterial(this.o.finish, this.host.closest('[data-finish]')?.dataset.finish, this.dark?.matches,
      this.host.closest('[data-tone="light"], [data-tone="dark"]')?.dataset.tone);
    if (name === 'page') {
      // Read from the host, not the root: the root's own data-finish would answer with its finish's tokens.
      const t = readLook(this.host);
      if (t) {
        const fin = finishFrom(t);
        return { key: fin.key, name, fin, plate: fin.plate };
      }
      return { key: 'ink', name: 'ink', fin: FINISHES.ink, plate: PLATES[FINISHES.ink.plate] };
    }
    const fin = FINISHES[name];
    return { key: name, name, fin, plate: PLATES[fin.plate] };
  }

  /** Drums and plates for the current count, sign and locale. */
  #build() {
    const o = this.o;
    this.mat = this.#material();
    this.material = this.mat.name;
    this.style = numberStyle(o.locale, o.decimals, o.grouping);
    this.count_ = Math.min(MAX_DRUMS, Math.max(
      o.digits + o.decimals, drumsFor(this.target, o.decimals), drumsFor(this.s.x, o.decimals),
    ));
    this.signed = this.target < 0 || this.s.x < 0;
    const root = this.root;
    root.dataset.bezel = o.bezel;
    // The finish drawn, not `auto`; written only when it changes, so the observer above never chases its own tail.
    if (root.dataset.finish !== this.material) root.dataset.finish = this.material;

    const win = el('div', 'od-window');
    this.drums = [];
    this.seps = [];
    this.signEl = null;
    // Born in the state they show: a blank toggled after the first style pass
    // would fade out on page load, a ghost "00" in the leading drums.
    const blanks = o.zeros ? null : blankZeros(this.s.x, this.count_, o.decimals);
    let cur = o.currency ? el('span', 'od-sep od-currency') : null;
    cur?.append(el('span', 'od-glyph', o.currency));
    for (const slot of slotsFor(this.count_, o.decimals, o.grouping ? this.style.breaks : [], this.signed)) {
      if (slot.kind === 'drum') {
        // The currency drum stands before the first digit, after the sign: it never rolls.
        if (cur) { win.append(cur); cur = null; }
        win.append(this.#drum(slot.k, !!blanks?.[slot.k]));
      }
      else {
        const glyph = slot.kind === 'sign' ? this.style.minus : slot.kind === 'group' ? this.style.group : this.style.decimal;
        const sep = el('span', `od-sep od-${slot.kind}`);
        sep.append(el('span', 'od-glyph', glyph));
        const shown = slot.kind === 'sign' ? this.s.x < 0 : slot.kind === 'group' ? !blanks?.[slot.k] : true;
        sep.classList.toggle('od-off', !shown);
        if (slot.kind === 'sign') this.signEl = sep;
        if (slot.kind === 'group') this.seps.push({ el: sep, k: slot.k, shown });
        win.append(sep);
      }
    }
    win.append(el('span', 'od-glass'));
    this.plate.replaceChildren(win);
    if (o.prefix) this.plate.append(el('span', 'od-prefix', o.prefix));
    if (o.suffix) this.plate.append(el('span', /^\s*[^\p{L}\p{N}]{1,2}\s*$/u.test(o.suffix) ? 'od-suffix od-mark' : 'od-suffix', o.suffix));
    // A paint-filled engraving under the window, ruled out to its edges.
    if (o.label) {
      const label = el('span', 'od-label');
      label.append(el('span', 'od-label-t', o.label));
      this.plate.append(label);
    }
    // Two countersunk screws, each driven home at its own angle.
    if (o.bezel !== 'bare') {
      for (const side of ['l', 'r']) {
        const screw = el('span', `od-screw od-screw-${side}`);
        screw.style.setProperty('--od-slot', `${Math.round(hash(side === 'l' ? 1 : 2, 7) * 180)}deg`);
        this.plate.append(screw);
      }
    }
    this.window = win;
    this.#dress();
    this.#fit();
  }

  #drum(k: any, blank: any) {
    const o = this.o;
    const cell = el('span', 'od-cell');
    const red = o.red === 'last' ? k === 0 : o.red === 'decimals' ? (o.decimals ? k < o.decimals : k === 0) : false;
    if (red) cell.classList.add('od-red');
    const rot = el('span', 'od-rot');
    const w = o.wear;
    const faces = [];
    for (let i = 0; i < 10; i += 1) {
      const face = el('span', 'od-face');
      faces.push({ el: face, show: null });
      // Print registration: every figure was stamped a hair off true.
      const ink = el('span', 'od-ink');
      ink.style.transform = `translate(${f3((hash(k * 10 + i, 3) - 0.5) * 0.03 * w)}em, ${f3((hash(k * 10 + i, 4) - 0.5) * 0.026 * w)}em)`;
      ink.style.setProperty('--ink', String(f3(1 - hash(k * 10 + i, 5) * 0.22 * w)));
      ink.append(el('span', 'od-n', this.style.digits[i]), el('span', 'od-m', this.style.digits[i]));
      face.append(ink);
      rot.append(face);
    }
    cell.append(rot, el('span', 'od-lens'));
    // Wear: each drum sits a little off its detent and has a little play on
    // the axle. Stable per drum, so the number never shimmers between renders.
    const drum = {
      k,
      cell,
      rot,
      faces,
      zero: faces[0].el,
      offset: (hash(k, 1) - 0.5) * 0.09 * w,
      shown: NaN,
      phase: 0,
      blur: 0,
      b: -1,
      blank,
      free: false,
    };
    drum.zero.classList.toggle('od-blank', blank);
    cell.style.marginLeft = `${f3((hash(k, 2) - 0.5) * 0.024 * w)}em`;
    this.drums[k] = drum;
    return cell;
  }

  /** Everything the lamp and the finish decide, as custom properties. */
  #dress() {
    const o = this.o;
    const { fin, plate } = this.mat;
    const { lx, ly } = lampOf(o.light);
    const s = this.root.style;
    const set = (k: any, v: any) => s.setProperty(k, v);
    set('--od-drum', fin.drum);
    set('--od-figure', fin.figure);
    set('--od-signal', SIGNAL.drum);
    set('--od-signal-figure', SIGNAL.figure);
    set('--od-metal', plate.base);
    set('--od-metal-light', plate.light);
    set('--od-metal-dark', plate.dark);
    set('--od-plate-ink', plate.ink);
    set('--od-edge', plate.edge);
    set('--od-edge-dark', plate.edgeDark);
    set('--od-screw', plate.screw);
    set('--od-brush', String(plate.brush));
    // A finish that glows lights its figures, its engraving and its housing's edge from within (data-glow; odometer.css).
    set('--od-glow', String(fin.glow ?? 0));
    this.root.toggleAttribute('data-glow', Boolean(fin.glow));

    const shade = drumLight(o.light, fin.gloss);
    const stops = (f: any) => shade.map((p: any) => `${f(p)} ${(p.at * 100).toFixed(1)}%`).join(', ');
    set('--od-shade', `linear-gradient(180deg, ${stops((p: any) => `rgba(0, 0, 0, ${p.dark.toFixed(3)})`)})`);
    set('--od-spec', `linear-gradient(180deg, ${stops((p: any) => rgba(fin.tint, p.light))})`);

    const e = (n: any) => `${f3(n)}em`;
    // In numeral-size units, for the small text on the plate whose own em is tiny.
    const u = (n: any) => `calc(var(--od-size) * ${f3(n)})`;
    const ang = Math.round(o.light + 180);
    set('--od-lift', e(opticalLift(getComputedStyle(this.root))));
    // Diamond-cut chamfers: the window's walls and the plate's edge are cut
    // through the finish to bare metal, each side lit by the lamp.
    // Each side takes its own tone from its angle to the lamp; over that, the
    // specular hot spot, brightest at one corner and gone by the middle.
    const cut = chamfers(o.light, plate);
    set('--od-recess', cut.recess.join(' '));
    set('--od-raise', cut.raise.join(' '));
    // The hot spot is the finish's own spec (white unless it says otherwise), and the shadows fall as hard as its object shadow says.
    const hotC = fin.hot ?? '255, 255, 255';
    const sk = fin.shade ?? 1;
    const hot = (deg: any) => `linear-gradient(${deg}deg, rgba(${hotC}, 0.62) 0%, rgba(${hotC}, 0.22) 22%, rgba(${hotC}, 0) 52%)`;
    set('--od-raise-hot', hot(ang));
    set('--od-recess-hot', hot(Math.round(o.light)));
    // Edges facing the lamp are lit, the far ones dark; shadows fall away from it.
    set('--od-rim', `linear-gradient(90deg, rgba(${lx < 0 ? '255, 255, 255' : '0, 0, 0'}, ${f3(0.1 + 0.12 * Math.abs(lx))}) 0, transparent 9%, transparent 91%, rgba(${lx < 0 ? '0, 0, 0' : '255, 255, 255'}, ${f3(0.1 + 0.12 * Math.abs(lx))}) 100%)`);
    // A plate on a surface: a tight contact shadow, then the soft one the lamp throws.
    set('--od-plate-shadow', [
      `${e(-lx * 0.012)} ${e(-ly * 0.012)} ${e(0.018)} rgba(0, 0, 0, ${f3(clamp(0.5 * sk, 0, 1))})`,
      `${e(-lx * 0.05)} ${e(-ly * 0.05)} ${e(0.1)} rgba(0, 0, 0, ${f3(clamp(0.26 * sk, 0, 1))})`,
      `${e(-lx * 0.16)} ${e(-ly * 0.16)} ${e(0.42)} rgba(0, 0, 0, ${f3(clamp(0.3 * sk, 0, 1))})`,
    ].join(', '));
    // Brushed metal lights as a band across its grain, on the lamp's side, and
    // falls off away from the lamp.
    const band = Math.round(50 + lx * 26);
    set('--od-plate-sheen', [
      `linear-gradient(90deg, rgba(255, 255, 255, 0) ${band - 26}%, rgba(255, 255, 255, 0.075) ${band}%, rgba(255, 255, 255, 0) ${band + 26}%)`,
      `linear-gradient(${ang}deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.03) 36%, rgba(0, 0, 0, 0.04) 60%, rgba(0, 0, 0, 0.26))`,
    ].join(', '));
    set('--od-chamfer', [
      `${e(-lx * 0.016)} ${e(-ly * 0.016)} 0 rgba(255, 255, 255, 0.1)`,
      `${e(lx * 0.016)} ${e(ly * 0.016)} 0 rgba(0, 0, 0, 0.45)`,
    ].join(', '));
    // The window's own walls: the lip on the lamp side throws a shadow onto
    // the drums, the far wall catches a thread of light. Then the cover
    // glass's edge: a bright rim where it meets the frame, a dark refraction
    // band just inside it, and the green of float glass seen through its
    // thickness.
    set('--od-wall', [
      `inset ${e(-lx * 0.05)} ${e(-ly * 0.05)} ${e(0.07)} rgba(0, 0, 0, 0.66)`,
      `inset ${e(lx * 0.012)} ${e(ly * 0.012)} 0 rgba(255, 255, 255, 0.1)`,
      `inset 0 0 0 ${e(0.007)} rgba(255, 255, 255, 0.12)`,
      `inset 0 0 0 ${e(0.022)} rgba(0, 0, 0, 0.2)`,
      `inset 0 0 ${e(0.07)} ${e(0.018)} rgba(120, 170, 150, 0.1)`,
    ].join(', '));
    // The cover glass: the lamp's reflection is a softbox, a pane of light
    // with a clean far edge, lying across the lamp's corner of the glass; a
    // faint second pane from the room; and a sliver of the lamp along the
    // glass's lamp-side edges, seen through the glass's thickness.
    set('--od-glass', [
      `linear-gradient(${ang}deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.12) 17%, rgba(255, 255, 255, 0.05) 31%, rgba(255, 255, 255, 0) 31.6%)`,
      `linear-gradient(${ang}deg, rgba(255, 255, 255, 0) 52%, rgba(255, 255, 255, 0.028) 53%, rgba(255, 255, 255, 0.012) 60%, rgba(255, 255, 255, 0) 60.5%)`,
      `linear-gradient(${ly <= 0 ? 180 : 0}deg, rgba(255, 255, 255, ${f3(0.04 + 0.12 * Math.abs(ly))}), rgba(255, 255, 255, 0) ${e(0.05)})`,
      `linear-gradient(${lx <= 0 ? 90 : 270}deg, rgba(255, 255, 255, ${f3(0.02 + 0.08 * Math.abs(lx))}), rgba(255, 255, 255, 0) ${e(0.04)})`,
    ].join(', '));
    // Paint-filled engraving: the lip nearest the lamp shades the groove,
    // the far wall catches the light.
    set('--od-engrave', `${u(-lx * 0.009)} ${u(-ly * 0.009)} 0 rgba(255, 255, 255, 0.22), ${u(lx * 0.007)} ${u(ly * 0.007)} 0 rgba(0, 0, 0, 0.55)`);
    set('--od-groove', `inset ${u(lx * 0.006)} ${u(ly * 0.006)} 0 rgba(0, 0, 0, 0.6), inset ${u(-lx * 0.006)} ${u(-ly * 0.006)} 0 rgba(255, 255, 255, 0.2)`);
    set('--od-screw-hl', `${Math.round(50 + lx * 30)}% ${Math.round(50 + ly * 30)}%`);
    set('--od-screw-sink', `inset ${e(lx * 0.012)} ${e(ly * 0.012)} ${e(0.014)} rgba(0, 0, 0, 0.75), inset ${e(-lx * 0.008)} ${e(-ly * 0.008)} 0 rgba(255, 255, 255, 0.16)`);
    set('--od-screw-shadow', `${e(-lx * 0.01)} ${e(-ly * 0.01)} ${e(0.014)} rgba(0, 0, 0, 0.7)`);

    // One camera for the whole window: each drum's vanishing point is the
    // window's centre, so the outer drums are seen very slightly from the side.
    const px = parseFloat(getComputedStyle(this.root).fontSize) || 72;
    const mid = this.window.offsetWidth / 2;
    for (const d of this.drums) {
      if (d) d.rot.style.perspectiveOrigin = `${f3((mid - d.cell.offsetLeft) / px)}em 50%`;
    }
  }

  /**
   * Fit mode fills the host's box; a fixed size shrinks only to fit its
   * width. The host is measured with the counter taken out of it: a host that
   * takes its size from its content has none of its own, and the counter must
   * not chase itself — it falls back to 72px numerals.
   */
  #fit() {
    if (!this.root.isConnected) return;
    const host = this.host;
    const cs = getComputedStyle(host);
    const pad = (k: any) => parseFloat(cs[k]) || 0;
    const now = parseFloat(this.root.style.getPropertyValue('--od-size')) || 72;
    const perW = this.root.offsetWidth / now;
    const perH = this.root.offsetHeight / now;
    let want;
    if (this.o.size === 'fit') {
      const shown = this.root.style.display;
      this.root.style.display = 'none';
      const w = host.clientWidth - pad('paddingLeft') - pad('paddingRight');
      const h = host.clientHeight - pad('paddingTop') - pad('paddingBottom');
      this.root.style.display = shown;
      want = fitSize(w, h, perW, perH);
    } else {
      const avail = host.clientWidth - pad('paddingLeft') - pad('paddingRight');
      want = avail > 0 && perW > 0 ? Math.min(this.o.size, Math.floor((avail / perW) * 10) / 10) : this.o.size;
    }
    if (Math.abs(want - now) > 0.05 || !this.root.style.getPropertyValue('--od-size')) {
      this.root.style.setProperty('--od-size', `${Math.max(8, want)}px`);
    }
  }

  /** More drums (or a sign plate) the moment a travelling value needs them. */
  #grow() {
    const need = Math.min(MAX_DRUMS, Math.max(drumsFor(this.target, this.o.decimals), drumsFor(this.s.x, this.o.decimals)));
    const signed = this.target < 0 || this.s.x < 0;
    if (need > this.count_ || (signed && !this.signed)) this.#build();
  }

  /** And fewer once it has landed, never below the reserved `digits`. */
  #shrink() {
    const need = Math.min(MAX_DRUMS, Math.max(this.o.digits + this.o.decimals, drumsFor(this.target, this.o.decimals)));
    if (need < this.count_ || (this.signed && this.target >= 0)) this.#build();
  }

  // ---------------------------------------------------------------- drawing

  #paint(dt: any) {
    const o = this.o;
    const x = this.s.x;
    const pos = drumPositions(x, this.count_, o.decimals);
    const lsdSpeed = Math.abs(this.s.v) * 10 ** o.decimals;
    // |x| is what the drums show, so below zero they turn the other way.
    const dir = Math.sign(this.s.v) * (x < 0 ? -1 : 1);
    const cap = o.maxSpin;
    const blanks = o.zeros ? null : blankZeros(x, this.count_, o.decimals);
    let moving = false;
    for (const d of this.drums) {
      const speed = lsdSpeed / 10 ** d.k;
      const r = spin(d.phase, pos[d.k] + d.offset, speed, dir, cap, dt);
      let want;
      if (r.free) want = 1;
      else {
        // A carry is fast even when the value is slow: measure what the drum
        // actually did this frame, so a flick over is smeared too.
        const moved = dt > 0 && Number.isFinite(d.shown) ? Math.abs(wrapDelta(r.pos - d.shown)) / dt : 0;
        want = d.free ? 1 : smear(Math.max(speed, moved), cap);
      }
      d.free = r.free;
      d.phase = r.pos;
      d.blur = want >= d.blur || dt === 0 ? want : d.blur + (want - d.blur) * (1 - Math.exp(-dt / 0.07));
      if (d.blur < 0.01) d.blur = 0;
      if (d.blur) moving = true;
      if (!(Math.abs(r.pos - d.shown) < 1e-5)) {
        turn(d.faces, r.pos);
        d.shown = r.pos;
      }
      const b = Math.round(d.blur * 50) / 50;
      if (b !== d.b) {
        d.rot.style.setProperty('--b', String(b));
        d.b = b;
      }
      const blank = blanks ? blanks[d.k] : false;
      if (blank !== d.blank) {
        d.zero.classList.toggle('od-blank', blank);
        d.blank = blank;
      }
    }
    for (const sep of this.seps) {
      const shown = !blanks || !blanks[sep.k];
      if (shown !== sep.shown) {
        sep.el.classList.toggle('od-off', !shown);
        sep.shown = shown;
      }
    }
    if (this.signEl) this.signEl.classList.toggle('od-off', !(x < 0 || (x === 0 && this.target < 0)));
    return moving;
  }

  /** Announced politely unless counting (a tally is kept current, not read out) or told not to. */
  #live() {
    this.text.setAttribute('aria-live', this.counting || !this.o.announce ? 'off' : 'polite');
  }

  /** Politely, and only a landed value: never a frame's worth of digits. */
  #announce() {
    const t = formatValue(this.target, this.style, this.o.currency + this.o.prefix, this.o.suffix);
    if (this.text.textContent !== t) this.text.textContent = t;
  }

  // ---------------------------------------------------------------- the loop

  #countTarget(now: any) {
    const c = this.counting;
    const lsd = 10 ** -this.o.decimals;
    const steps = Math.floor((Math.abs(c.rate) * (now - c.t0)) / 1000 / lsd + 1e-9);
    return this.#clampValue(c.base + Math.sign(c.rate) * steps * lsd);
  }

  /** Counting under reduced motion: the tally still advances, by jumps, with no frames. */
  #restartCount() {
    clearInterval(this.timer);
    this.timer = 0;
    if (!this.counting || !this.reduced) return;
    const lsd = 10 ** -this.o.decimals;
    const every = Math.max(100, (lsd / Math.abs(this.counting.rate)) * 1000);
    this.timer = setInterval(() => {
      this.target = this.#countTarget(performance.now());
      this.s.x = this.target;
      this.#grow();
      this.#paint(0);
      this.text.textContent = formatValue(this.target, this.style, this.o.currency + this.o.prefix, this.o.suffix);
    }, every);
  }

  #frame = (t: any) => {
    this.raf = 0;
    const dt = this.last ? (t - this.last) / 1000 : 1 / 60;
    this.last = t;
    const o = this.o;
    if (this.counting) {
      const next = this.#countTarget(performance.now());
      if (next !== this.target) {
        this.target = next;
        this.#grow();
      }
      // Kept current for anyone who reads it, announced to no one.
      if (t - this.lastText > 1000) {
        this.lastText = t;
        this.text.textContent = formatValue(this.target, this.style, o.currency + o.prefix, o.suffix);
      }
    }
    stepSpring(this.s, this.target, dt, o.stiffness, o.damping);
    const done = !this.counting && landed(this.s, this.target, o.decimals);
    if (done) {
      this.s.x = this.target;
      this.s.v = 0;
    }
    const n = Math.floor(scaled(this.s.x, o.decimals));
    if (n !== this.lastInt) {
      this.lastInt = n;
      this.#tick(Math.abs(this.s.v) * 10 ** o.decimals);
    }
    const smeared = this.#paint(dt);
    if (done && !smeared) {
      this.#shrink();
      this.#paint(0);
      this.#announce();
      this.#sleep();
      return;
    }
    // A slow tally has landed its step and the next is a while off: sleep
    // until it is due instead of drawing still drums at 60 Hz.
    if (this.counting && !smeared && landed(this.s, this.target, o.decimals)) {
      const now = performance.now();
      const wait = nextStepAt(this.counting.t0, now, this.counting.rate, o.decimals) - now;
      if (wait > 60) {
        this.s.x = this.target;
        this.s.v = 0;
        this.#paint(0);
        this.text.textContent = formatValue(this.target, this.style, o.currency + o.prefix, o.suffix);
        this.#sleep();
        this.stepTimer = setTimeout(() => { this.stepTimer = 0; this.#wake(); }, wait);
        return;
      }
    }
    if (!this.visible || document.hidden) this.#sleep();
    else this.raf = requestAnimationFrame(this.#frame);
  };

  #wake() {
    clearTimeout(this.stepTimer);
    this.stepTimer = 0;
    if (this.reduced || this.raf || !this.visible || document.hidden) return;
    const idle = !this.counting && landed(this.s, this.target, this.o.decimals) && this.drums.every((d: any) => !d.blur);
    if (idle) return;
    this.root.dataset.state = 'running';
    this.last = 0;
    this.raf = requestAnimationFrame(this.#frame);
  }

  #sleep() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.stepTimer);
    this.stepTimer = 0;
    this.raf = 0;
    this.root.dataset.state = 'asleep';
  }

  // ---------------------------------------------------------------- sound

  /** The audio context may only start inside a user gesture, so wait for one. */
  #listenForGesture() {
    if (this.audio || this.listening) return;
    this.listening = true;
    addEventListener('pointerdown', this.on.gesture, true);
    addEventListener('keydown', this.on.gesture, true);
  }

  #stopListening() {
    if (!this.listening) return;
    this.listening = false;
    removeEventListener('pointerdown', this.on.gesture, true);
    removeEventListener('keydown', this.on.gesture, true);
  }

  #armAudio() {
    this.#stopListening();
    try {
      const Ctx = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
      if (!Ctx || this.audio) return;
      this.audio = new Ctx();
      const len = Math.floor(this.audio.sampleRate * 0.016);
      this.noise = this.audio.createBuffer(1, len, this.audio.sampleRate);
      const ch = this.noise.getChannelData(0);
      for (let i = 0; i < len; i += 1) ch[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 4;
    } catch { /* no audio device: the counter must still count */ }
  }

  /** A soft tick per step of the last drum, never more than one per 45 ms; a spin whirrs rather than rattles. */
  #tick(speed: any) {
    if (!this.o.sound || !this.audio || this.audio.state !== 'running') return;
    const now = performance.now();
    if (now - this.lastTick < 45) return;
    this.lastTick = now;
    try {
      const ctx = this.audio;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1900;
      band.Q.value = 3.2;
      const gain = ctx.createGain();
      gain.gain.value = 0.16 / (1 + speed / 30);
      src.connect(band).connect(gain).connect(ctx.destination);
      src.start();
    } catch { /* never let sound break the display */ }
  }
}



export type MechanicalOdometerProps = {
  /** The number shown. Changing it rolls the drums, and carries like a real odometer. */
  value: number;
  /** The least number of drums, counting the decimals. */
  digits?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** A currency drum before the figures: a symbol of up to three characters. */
  currency?: string;
  locale?: string;
  /** Thousands separators. */
  grouping?: boolean;
  /** Keep leading zeros on the drums. */
  zeros?: boolean;
  /** Which drums are the red signal drums. */
  red?: "none" | "last" | "decimals";
  bezel?: "slot" | "cells" | "bare";
  /**
   * "theme" (default) draws the counter from the page's shadcn variables (--background, --foreground, --border, --muted, --muted-foreground) and follows .dark.
   * "auto" follows the page: prefers-color-scheme, a .dark ancestor or a [data-finish] ancestor; "ink", "bone", "steel" and "brass" keep the named drums and housings.
   */
  finish?: "theme" | "auto" | "ink" | "bone" | "steel" | "brass";
  /** A small engraved label under the window. */
  label?: string;
  /** How worn the figures are, 0 to 1. */
  wear?: number;
  /** Where the lamp is, in degrees clockwise from above. */
  light?: number;
  /** The numeral size in px, or "fit" to fill the box. */
  size?: number | "fit";
  /** A soft tick as the drums turn (starts after the first gesture). */
  sound?: boolean;
  /** Announce the number to screen readers once it lands. */
  announce?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** A mechanical drum counter: 1,099 to 1,100 rolls the last three drums over together. */
export function MechanicalOdometer({ value, className, style, ...options }: MechanicalOdometerProps) {
  const host = useRef<HTMLDivElement>(null);
  const odo = useRef<Odometer | null>(null);
  const live = useRef(value);
  live.current = value;
  const opts: Record<string, unknown> = { ...options };
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
  const optsKey = JSON.stringify(opts);

  useEffect(() => {
    if (!host.current) return;
    const o = new Odometer(host.current, { ...JSON.parse(optsKey), value: live.current });
    odo.current = o;
    return () => { o.destroy(); odo.current = null; };
    // created once; later option changes go through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { odo.current?.update(JSON.parse(optsKey)); }, [optsKey]);
  useEffect(() => { odo.current?.setValue(value); }, [value]);

  return (
    <>
      <style>{CSS}</style>
      <div ref={host} className={className} style={{ width: 480, height: 160, maxWidth: "100%", display: "grid", placeItems: "center", ...style }} />
    </>
  );
}

export default MechanicalOdometer;

// The numerals: Big Shoulders Bold (SIL OFL 1.1), embedded as a data URI so the piece needs no files and no network.
const BIG_SHOULDERS_BOLD = "data:font/woff2;base64,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";

// The stylesheet, as the source ships it (scoped under .od).
const CSS = `/* Odometer — TACTILE UI.
   The object sizes itself from its numeral size (--od-size, set by the
   component: filling its host in fit mode, or from the \`size\` option). Every
   length below is in em of that size, so the drum geometry scales as one
   piece. Lamp-dependent values (--od-shade, --od-spec, --od-wall, …) are
   written by the component from the \`light\` option. */

/* The drums are printed in Big Shoulders Bold (SIL OFL 1.1, see
   BigShoulders-OFL.txt beside this file): the same figures on every platform.
   \`block\`: until the face is in, the drums show no figures rather than a
   fallback that jumps when it arrives. */
@font-face {
  font-family: 'Odometer Figures';
  src: url("${BIG_SHOULDERS_BOLD}") format('woff2');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

.od {
  --od-size: 72px;
  --od-face: 1.12em;   /* one face: the chord between two numerals */
  --od-r: 1.7235em;    /* ten faces: radius = face / (2 tan 18°) */
  --od-win: 1.56em;    /* the window shows ±27° of the drum */
  --od-w: 0.6em;       /* drum width: a condensed figure on a narrow drum */
  /* Printed stock is never a flat fill: a fine static grain, blended over the drum colour. */
  --od-grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0.5 0.3 0.2 0 0  0.5 0.3 0.2 0 0  0.5 0.3 0.2 0 0  0 0 0 0 0.42'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
  /* Brushing: long fine streaks along the plate. */
  --od-brushed: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='120'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0022 0.95' numOctaves='3' seed='11' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0.6 0.2 0.2 0 0.08  0.6 0.2 0.2 0 0.08  0.6 0.2 0.2 0 0.08  0 0 0 0 0.6'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23b)'/%3E%3C/svg%3E");
  position: relative;
  display: inline-block;
  width: max-content;
  vertical-align: middle;
  font-size: var(--od-size);
  line-height: 1;
  font-family: 'Odometer Figures', Bahnschrift, 'DIN Alternate', 'DIN Condensed', 'Barlow Semi Condensed', 'Roboto Condensed', 'Arial Narrow', sans-serif;
  font-weight: 700;
  font-stretch: 87.5%;
  font-synthesis: none;
  font-variant-numeric: lining-nums;
  font-kerning: none;
  -webkit-font-smoothing: antialiased;
}

/* The number, as text. Hidden from sight, read by everything else. */
.od-text {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* The housing: a machined plate the window is cut into. Window in the
   middle column, a printed prefix and suffix either side, an engraved label
   under the window. */
.od-plate {
  position: relative;
  display: grid;
  grid-template-columns: auto auto auto;
  align-items: center;
  padding: 0.2em 0.2em;
  border: 0.028em solid;
  border-color: var(--od-raise);
  border-radius: 0.11em;
  color: var(--od-plate-ink);
  background:
    var(--od-plate-sheen),
    var(--od-brushed),
    var(--od-metal);
  background-origin: border-box;
  background-size: 100% 100%, 100% 100%, 600px 120px, auto;
  background-blend-mode: normal, normal, overlay, normal;
  box-shadow: var(--od-plate-shadow), inset 0 0 0 0.006em rgb(0 0 0 / 0.35);
  -webkit-user-select: none;
  user-select: none;
}
/* Room at each end for a screw. */
.od[data-bezel='slot'] .od-plate,
.od[data-bezel='cells'] .od-plate { padding-inline: 0.42em; }
.od-window { grid-column: 2; grid-row: 1; }

/* The chamfers catch the lamp hardest at the corner nearest it (the plate's
   edge) or farthest from it (the window's walls, which face back toward it):
   a specular falloff laid over each side's own tone. The window's ring is
   the plate's: an absolutely placed grid item takes the window's grid area as
   its box, and the window itself clips its drums. */
.od-plate::before,
.od-plate::after {
  content: '';
  position: absolute;
  z-index: 3;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
  pointer-events: none;
}
.od-plate::before {
  inset: -0.028em;
  padding: 0.028em;
  border-radius: inherit;
  background: var(--od-raise-hot);
}
.od-plate::after {
  grid-column: 2 / 3; /* an absolute item's auto end line would be the padding edge */
  grid-row: 1 / 2;
  inset: 0;
  padding: 0.036em;
  border-radius: 0.055em;
  background: var(--od-recess-hot);
}
.od[data-bezel='bare'] .od-plate::before,
.od[data-bezel='bare'] .od-plate::after,
.od[data-bezel='cells'] .od-plate::after { display: none; }

/* A finish that glows (data-glow, with --od-glow from 0 to 1) lights its figures and its engraving from within, and traces the housing's edge: the
   glow is each part's own colour, so the signal drum glows red. Without data-glow nothing here applies. */
.od[data-glow] .od-n,
.od[data-glow] .od-glyph {
  text-shadow:
    0 0 0.05em color-mix(in srgb, currentColor calc(var(--od-glow) * 100%), transparent),
    0 0 0.16em color-mix(in srgb, currentColor calc(var(--od-glow) * 55%), transparent);
}
.od[data-glow] :is(.od-prefix, .od-suffix, .od-label) {
  text-shadow: var(--od-engrave), 0 0 0.35em color-mix(in srgb, currentColor calc(var(--od-glow) * 90%), transparent);
}
.od[data-glow]:not([data-bezel='bare']) .od-plate {
  box-shadow:
    var(--od-plate-shadow),
    inset 0 0 0 0.006em rgb(0 0 0 / 0.35),
    0 0 0.07em 0.006em color-mix(in srgb, var(--od-edge) calc(var(--od-glow) * 75%), transparent);
}

/* A countersunk screw: the sink cut into the plate, the domed head in it,
   the slot across the head. */
.od-screw {
  position: absolute;
  top: 50%;
  width: 0.17em;
  height: 0.17em;
  margin-top: -0.085em;
  border-radius: 50%;
  background: color-mix(in srgb, var(--od-metal-dark) 70%, var(--od-metal));
  box-shadow: var(--od-screw-sink);
}
.od-screw-l { left: calc(0.21em - 0.085em); }
.od-screw-r { right: calc(0.21em - 0.085em); }
.od-screw::before {
  content: '';
  position: absolute;
  inset: 0.022em;
  border-radius: 50%;
  background:
    radial-gradient(circle at var(--od-screw-hl), rgb(255 255 255 / 0.9) 0, rgb(255 255 255 / 0) 34%),
    radial-gradient(circle at var(--od-screw-hl), var(--od-screw) 0, color-mix(in srgb, var(--od-screw) 55%, #000) 78%, color-mix(in srgb, var(--od-screw) 30%, #000) 100%);
  box-shadow: var(--od-screw-shadow);
}
.od-screw::after {
  content: '';
  position: absolute;
  left: 0.032em;
  right: 0.032em;
  top: 50%;
  height: 0.024em;
  margin-top: -0.012em;
  border-radius: 0.01em;
  background: rgb(0 0 0 / 0.78);
  box-shadow: 0 0.005em 0 rgb(255 255 255 / 0.28);
  transform: rotate(var(--od-slot, 30deg));
}

.od-prefix,
.od-suffix {
  color: var(--od-plate-ink);
  text-shadow: var(--od-engrave);
  white-space: nowrap;
}
.od-prefix {
  grid-column: 1;
  grid-row: 1;
  position: relative;
  top: var(--od-lift, 0);
  font-size: 0.6em;
  padding-inline: 0 0.2em;
}
.od-suffix {
  grid-column: 3;
  grid-row: 1;
  align-self: end;
  font-size: 0.24em;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding-inline: 0.55em 0;
  margin-bottom: 0.9em;
}
.od-suffix.od-mark {
  /* A symbol after the number (€, %) is set like the prefix, not as a label. */
  position: relative;
  top: var(--od-lift, 0);
  align-self: center;
  font-size: 0.6em;
  letter-spacing: 0;
  text-transform: none;
  padding-inline: 0.2em 0;
  margin-bottom: 0;
}

/* The engraved label strip: letters cut into the plate and filled with
   paint, ruled out to the window's edges. */
.od-label {
  grid-column: 2;
  grid-row: 2;
  /* The window's width, never more: a label longer than the window must not
     widen its column (that would open a gap inside the window). It overflows
     both ways instead, centred. */
  width: 0;
  min-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7em;
  margin-top: 0.55em;
  margin-bottom: -0.15em;
  font-size: 0.2em;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--od-plate-ink);
  text-shadow: var(--od-engrave);
}
.od-label-t { margin-right: -0.3em; } /* the tracking after the last letter is not space */
.od-label::before,
.od-label::after {
  content: '';
  flex: 1 1 0;
  min-width: 1em;
  height: 0.12em;
  border-radius: 0.1em;
  background: color-mix(in srgb, var(--od-plate-ink) 55%, transparent);
  box-shadow: var(--od-groove);
}

/* The window: a slot in the plate, with the drums behind it. */
.od-window {
  position: relative;
  display: flex;
  height: var(--od-win);
  padding: 0 0.045em;
  gap: 0.04em;
  background: #050506;
  border: 0.036em solid;
  border-color: var(--od-recess);
  border-radius: 0.055em;
  overflow: hidden;
  box-shadow: var(--od-chamfer);
}

/* Glass over it: the lamp's reflection, the refracting edge, the window's walls. */
.od-glass,
.od-lens {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: inherit;
  background: var(--od-glass);
  box-shadow: var(--od-wall);
}
.od-lens { display: none; }

/* One drum: ten printed figures around an axle, seen through the window. The
   drum's surface is the cell (a cylinder's colour does not turn); the faces
   carry only ink, so a smeared figure can run into the next without a seam. */
.od-cell {
  position: relative;
  flex: none;
  width: var(--od-w);
  background: var(--od-rim), var(--od-grain), var(--od-drum);
  background-size: auto, 140px 140px, auto;
  background-blend-mode: normal, overlay, normal;
}
/* Flat, with perspective: each face carries its own whole transform. */
.od-rot {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: var(--od-face);
  margin-top: calc(var(--od-face) / -2);
  perspective: 16em;
}
.od-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  backface-visibility: hidden;
  color: var(--od-figure);
}
.od-ink {
  position: relative;
  font-size: 0.92em;
  top: var(--od-lift, 0);
  display: grid;
  place-items: center;
  opacity: var(--ink, 1);
  transition: opacity 0.18s;
}
.od-blank .od-ink { opacity: 0; }
.od-n,
.od-m { grid-area: 1 / 1; }
.od-n { opacity: calc(1 - var(--b, 0)); }
/* The same figure smeared along the turn: shown as the drum speeds up. Long
   enough that, at full speed, one figure's streak meets the next one's. */
.od-m {
  --s1: color-mix(in srgb, var(--od-figure) 6%, transparent);
  --s2: color-mix(in srgb, var(--od-figure) 11%, transparent);
  --s3: color-mix(in srgb, var(--od-figure) 16%, transparent);
  --s4: color-mix(in srgb, var(--od-figure) 20%, transparent);
  opacity: var(--b, 0);
  color: transparent;
  text-shadow:
    0 -0.48em 0.1em var(--s1), 0 -0.4em 0.09em var(--s2), 0 -0.32em 0.08em var(--s3),
    0 -0.24em 0.07em var(--s4), 0 -0.16em 0.06em var(--s4), 0 -0.08em 0.055em var(--s4),
    0 0 0.05em var(--s4),
    0 0.08em 0.055em var(--s4), 0 0.16em 0.06em var(--s4), 0 0.24em 0.07em var(--s4),
    0 0.32em 0.08em var(--s3), 0 0.4em 0.09em var(--s2), 0 0.48em 0.1em var(--s1);
}

/* Light that does not turn: the drum rolls under it. */
.od-cell::after,
.od-sep::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: var(--od-spec), var(--od-shade);
}

/* The signal drum: the classic odometer tenths. */
.od-red {
  --od-drum: var(--od-signal);
  --od-figure: var(--od-signal-figure);
}

/* Fixed plates between drums: group marks, the decimal point, the sign. */
.od-sep {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 0.22em;
  background: var(--od-rim), var(--od-grain), var(--od-drum);
  background-size: auto, 140px 140px, auto;
  background-blend-mode: normal, overlay, normal;
  color: var(--od-figure);
}
.od-sign { width: 0.4em; }
/* The currency drum: a wheel as wide as a digit, its finish a step toward its own figure (lighter on ink, darker on bone), so it reads as part of the counter yet apart from the drums that turn. */
.od-currency {
  width: var(--od-w);
  background-image: var(--od-rim), var(--od-grain), linear-gradient(color-mix(in srgb, var(--od-drum) 78%, var(--od-figure)), color-mix(in srgb, var(--od-drum) 78%, var(--od-figure)));
}
.od-glyph { font-size: 0.92em; position: relative; top: var(--od-lift, 0); transition: opacity 0.18s, transform 0.18s; }
.od-off .od-glyph { opacity: 0; }
.od-sign.od-off .od-glyph { transform: rotateX(90deg); }

/* A window per drum, like a tally counter. */
.od[data-bezel='cells'] .od-window {
  background: none;
  border: 0;
  overflow: visible;
  box-shadow: none;
  padding: 0;
  gap: 0.1em;
}
.od[data-bezel='cells'] .od-glass { display: none; }
.od[data-bezel='cells'] .od-cell {
  overflow: hidden;
  border: 0.03em solid;
  border-color: var(--od-recess);
  border-radius: 0.06em;
  box-shadow: var(--od-chamfer);
}
.od[data-bezel='cells'] .od-lens { display: block; }
.od[data-bezel='cells'] .od-sep {
  background: none;
  width: 0.2em;
  color: var(--od-plate-ink);
  text-shadow: var(--od-engrave);
}
.od[data-bezel='cells'] .od-sep::after { display: none; }

/* No housing: the drums alone, to sit in a line of text. */
.od[data-bezel='bare'] .od-plate {
  background: none;
  border: 0;
  box-shadow: none;
  padding: 0;
  color: inherit;
}
.od[data-bezel='bare'] .od-prefix,
.od[data-bezel='bare'] .od-suffix,
.od[data-bezel='bare'] .od-label {
  color: inherit;
  text-shadow: none;
}
.od[data-bezel='bare'] .od-label::before,
.od[data-bezel='bare'] .od-label::after { box-shadow: none; background: currentColor; opacity: 0.35; }
.od[data-bezel='bare'] .od-prefix { font-size: 0.8em; padding-inline-end: 0.1em; }
.od[data-bezel='bare'] .od-suffix:not(.od-mark) { font-size: 0.42em; margin-bottom: 0.3em; padding-inline-start: 0.3em; }
.od[data-bezel='bare'] .od-suffix.od-mark { font-size: 0.8em; }
.od[data-bezel='bare'] .od-window { border-width: 0.02em; border-radius: 0.08em; }

@media (prefers-reduced-motion: reduce) {
  .od-ink,
  .od-glyph { transition: none; }
}
`;
