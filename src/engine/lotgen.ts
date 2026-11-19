// Builds the night's deck: real models from the catalogue, each turned into one specific
// car with its own mileage, paint, accident history, papers, seller and hidden surprise.
import { Rng } from '../lib/rng';

import { SELLER, fill } from './lines';
import { SELLER_LINES } from './realism_lines';
import { historyFor, micronsFor, rollSurprise, scanFor } from './realism';
import { checksFor, faultPool, moreFeatures, rememberNight, serviceLines, storyFor } from './story_lines';
import { TRANSFER_FEE, increment, roundToStep } from './rules';
import { marketOf } from './markets';
import { dutchPlan } from './dutch';
import type { AdSet } from '../data/photos';
import { PHOTOS } from '../data/market';
import type {
  Body, CarModel, CarPub, Cond, FeeRule, LotFull, LotKind, Mech, PanelId, PanelStatus, PlatePub, SaleMode, Seller, Settings,
  Surprise, Tier,
} from './types';

export const NOW_YEAR = 2026;

// ---------------------------------------------------------------------------
// Reference tables

// colour share and value effect (white +2%, odd colours are harder to sell)
export const COLORS: Record<string, { hex: string; w: number; eff: number; odd?: boolean }> = {
  'أبيض': { hex: '#F1F0EB', w: 28, eff: 0.02 },
  'أبيض لؤلؤي': { hex: '#ECE7DA', w: 13, eff: 0.02 },
  'فضي': { hex: '#B7BBC0', w: 11, eff: 0.005 },
  'رصاصي': { hex: '#5B6066', w: 9, eff: 0.005 },
  'أسود': { hex: '#141518', w: 11, eff: 0.01 },
  'شمباني': { hex: '#CDB68C', w: 6, eff: 0 },
  'بيج': { hex: '#D5C6A4', w: 3, eff: -0.01 },
  'عنابي': { hex: '#5C1A22', w: 3, eff: -0.02 },
  'كحلي': { hex: '#1C2944', w: 3, eff: -0.02 },
  'أحمر': { hex: '#9C1C1C', w: 3, eff: -0.04 },
  'أزرق': { hex: '#2C4E8A', w: 2, eff: -0.02 },
  'أخضر زيتي': { hex: '#4B5136', w: 1, eff: -0.06, odd: true },
  'بني': { hex: '#583F2E', w: 1, eff: -0.04, odd: true },
  'برتقالي': { hex: '#C7601D', w: 1, eff: -0.06, odd: true },
  'أصفر': { hex: '#D5A21A', w: 1, eff: -0.06, odd: true },
  'سكني': { hex: '#8C8F8C', w: 3, eff: 0 },
};

const INTERIORS = ['بيج', 'أسود', 'بني', 'رمادي', 'أحمر', 'كريمي'] as const;

export const CITIES: readonly (readonly [string, number])[] = [
  ['الرياض', 30], ['جدة', 16], ['الدمام', 8], ['الخبر', 4], ['مكة', 4], ['المدينة', 4],
  ['بريدة', 4], ['عنيزة', 2], ['حائل', 3], ['تبوك', 3], ['أبها', 3], ['خميس مشيط', 3],
  ['الأحساء', 4], ['الطائف', 3], ['جازان', 2], ['نجران', 2], ['الجبيل', 2], ['ينبع', 1],
  ['الخرج', 2], ['سكاكا', 1], ['الباحة', 1], ['عرعر', 1],
];


const AMERICAN = new Set(['Ford', 'Chevrolet', 'GMC', 'Dodge', 'Cadillac', 'Lincoln', 'Jeep', 'RAM', 'Chrysler', 'Tesla', 'Lucid', 'Mercury']);
const GERMAN = new Set(['Mercedes-Benz', 'Mercedes', 'BMW', 'Audi', 'Porsche', 'Volkswagen', 'Maybach']);
const EXOTIC_MAKES = new Set(['Ferrari', 'Lamborghini', 'Rolls-Royce', 'Bentley', 'McLaren', 'Aston Martin', 'Maserati']);

export const SPEC_LABEL: Record<CarPub['specKind'], string> = {
  saudi: 'سعودي وكالة',
  gcc: 'خليجي',
  us: 'وارد أمريكي',
  us_salvage: 'وارد أمريكي سلفج',
  ca: 'وارد كندي',
  eu: 'وارد أوروبي',
  jp: 'وارد ياباني',
};

export const SELLER_LABEL: Record<Seller, string> = {
  owner: 'مالك',
  showroom: 'معرض',
  rental: 'شركة تأجير',
  company: 'أسطول شركة',
  gov: 'مزاد حكومي',
  insurance: 'شركة تأمين',
};

export const MODE_LABEL: Record<SaleMode, string> = {
  inspected: 'على الفحص',
  asis: 'على الحالة',
};

export const PANEL_LABEL: Record<PanelId, string> = {
  fb: 'الصدام الأمامي', hood: 'الكبوت', roof: 'السقف', trunk: 'الشنطة', rb: 'الصدام الخلفي',
  lff: 'الرفرف الأمامي يسار', lfd: 'الباب الأمامي يسار', lrd: 'الباب الخلفي يسار', lrq: 'الرفرف الخلفي يسار',
  rff: 'الرفرف الأمامي يمين', rfd: 'الباب الأمامي يمين', rrd: 'الباب الخلفي يمين', rrq: 'الرفرف الخلفي يمين',
};

export const STATUS_LABEL: Record<PanelStatus, string> = {
  ok: 'أصلي',
  spot: 'رش خفيف',
  paint: 'رش',
  dent: 'سمكرة',
  replaced: 'مغيّر',
  damaged: 'مصدوم',
  unknown: 'ما انفحص',
};

const ALL_PANELS: PanelId[] = ['fb', 'hood', 'roof', 'trunk', 'rb', 'lff', 'lfd', 'lrd', 'lrq', 'rff', 'rfd', 'rrd', 'rrq'];

export function panelsFor(doors: 2 | 4): PanelId[] {
  return doors === 2 ? ALL_PANELS.filter((p) => p !== 'lrd' && p !== 'rrd') : ALL_PANELS;
}

const FEATURES: Record<Tier, string[]> = {
  junk: ['مسجل كاسيت', 'مكيف عادي', 'دركسون هيدروليك', 'زجاج كهرباء'],
  daily: ['شاشة لمس', 'كاميرا خلفية', 'كروز كنترول', 'بلوتوث', 'حساسات خلفية', 'دخول ذكي'],
  family: ['شاشة 10 إنش', 'كاميرا 360', 'فتحة سقف', 'مقاعد جلد', 'كروز كنترول', 'شاحن لاسلكي', 'تبريد مقاعد', 'صف ثالث'],
  work: ['دبل', 'ونش أمامي', 'قفل دفرنس', 'مكيف قوي', 'رادار', 'شبك حماية'],
  luxury: ['بانوراما', 'تبريد وتدفئة مقاعد', 'شاشات خلفية', 'كاميرا 360', 'مثبت سرعة تكيفي', 'نظام صوت فاخر', 'ثلاجة', 'تعليق هوائي', 'إضاءة محيطية'],
  sport: ['عادم رياضي', 'فرامل بريمبو', 'مقاعد رياضية', 'وضع حلبة', 'لانش كنترول', 'جنوط 20 إنش'],
  exotic: ['كربون فايبر', 'فرامل سيراميك', 'رفع أمامي', 'نظام صوت فاخر', 'جلد حسب الطلب', 'سقف كربون'],
  classic: ['أصلية من الوكالة', 'مكيف وكالة', 'جنوط أصلية', 'دليل المالك الأصلي'],
};

const MODS = [
  ['تظليل حراري 30%', 0.0], ['نانو سيراميك', 0.004], ['حماية PPF كاملة', 0.01], ['شاشة أندرويد', 0],
  ['جنوط مقاس أكبر', -0.004], ['رفع 2 إنش', -0.01], ['عادم معدّل', -0.012], ['برمجة كمبيوتر', -0.02],
  ['كفرات أوف رود', 0], ['إضاءة LED معدّلة', -0.002],
] as const;

// ---------------------------------------------------------------------------

export interface GenContext {
  rng: Rng;
  settings: Settings;
}

type CondClass = 'clean' | 'touched' | 'painted' | 'hit' | 'major' | 'wreck';

function ageOf(m: CarModel) {
  return Math.max(0, NOW_YEAR - m.year);
}

function pickSpec(rng: Rng, m: CarModel): CarPub['specKind'] {
  if (EXOTIC_MAKES.has(m.makeEn)) return rng.weighted([['gcc', 50], ['saudi', 38], ['us', 8], ['eu', 4]] as const);
  if (AMERICAN.has(m.makeEn)) {
    return rng.weighted([['saudi', 58], ['gcc', 18], ['us', 12], ['us_salvage', 8], ['ca', 4]] as const);
  }
  if (GERMAN.has(m.makeEn)) return rng.weighted([['saudi', 60], ['gcc', 24], ['us', 7], ['eu', 7], ['us_salvage', 2]] as const);
  if (m.tier === 'classic') return rng.weighted([['saudi', 70], ['gcc', 20], ['jp', 6], ['us', 4]] as const);
  return rng.weighted([['saudi', 82], ['gcc', 10], ['us', 4], ['us_salvage', 2], ['ca', 2]] as const);
}

function pickCondition(rng: Rng, m: CarModel, spec: CarPub['specKind']): CondClass {
  if (spec === 'us_salvage') return rng.weighted([['hit', 55], ['major', 45]] as const);
  const age = ageOf(m);
  if (m.tier === 'junk') return rng.weighted([['clean', 10], ['touched', 18], ['painted', 26], ['hit', 22], ['major', 14], ['wreck', 10]] as const);
  if (age <= 1) return rng.weighted([['clean', 80], ['touched', 14], ['painted', 4], ['hit', 2]] as const);
  if (age <= 4) return rng.weighted([['clean', 52], ['touched', 26], ['painted', 11], ['hit', 8], ['major', 3]] as const);
  if (age <= 9) return rng.weighted([['clean', 34], ['touched', 28], ['painted', 18], ['hit', 13], ['major', 6], ['wreck', 1]] as const);
  return rng.weighted([['clean', 22], ['touched', 26], ['painted', 24], ['hit', 15], ['major', 9], ['wreck', 4]] as const);
}

function buildPanels(rng: Rng, cls: CondClass, doors: 2 | 4) {
  const list = panelsFor(doors);
  const panels: Partial<Record<PanelId, PanelStatus>> = {};
  for (const p of list) panels[p] = 'ok';
  let najm = 0;
  let chassis: Mech['chassis'] = 'ok';
  let airbags: Mech['airbags'] = 'ok';
  const sides: PanelId[] = list.filter((p) => !['roof', 'hood', 'trunk'].includes(p));
  const set = (p: PanelId, s: PanelStatus) => {
    if (panels[p] !== undefined) panels[p] = s;
  };
  if (cls === 'touched') {
    for (const p of rng.sample(sides, rng.int(1, 2))) set(p, rng.chance(0.6) ? 'spot' : 'paint');
    if (rng.chance(0.25)) najm = 1;
  } else if (cls === 'painted') {
    for (const p of rng.sample(list.filter((x) => x !== 'roof'), rng.int(3, 5))) set(p, rng.chance(0.7) ? 'paint' : 'spot');
    if (rng.chance(0.4)) set(rng.pick(['fb', 'rb'] as PanelId[]), 'replaced');
    if (rng.chance(0.3)) set(rng.pick(sides), 'dent');
    najm = rng.int(0, 1);
  } else if (cls === 'hit' || cls === 'major' || cls === 'wreck') {
    const front = rng.chance(0.62);
    const zone: PanelId[] = front ? ['fb', 'hood', 'lff', 'rff'] : ['rb', 'trunk', 'lrq', 'rrq'];
    const sideHit = rng.chance(0.25);
    const sideZone: PanelId[] = rng.chance(0.5) ? ['lfd', 'lrd', 'lff', 'lrq'] : ['rfd', 'rrd', 'rff', 'rrq'];
    const z = sideHit ? sideZone : zone;
    for (const p of z) {
      if (cls === 'wreck') set(p, rng.chance(0.7) ? 'damaged' : 'replaced');
      else set(p, rng.chance(cls === 'major' ? 0.55 : 0.35) ? 'replaced' : 'paint');
    }
    for (const p of rng.sample(list.filter((x) => !z.includes(x)), rng.int(0, 2))) set(p, 'spot');
    najm = cls === 'hit' ? rng.int(1, 2) : rng.int(2, 3);
    if (cls === 'major') {
      if (rng.chance(0.65)) chassis = 'repaired';
      if (rng.chance(0.45)) airbags = 'deployed';
    }
    if (cls === 'wreck') {
      chassis = rng.chance(0.6) ? 'damaged' : 'repaired';
      airbags = rng.chance(0.7) ? 'deployed' : 'ok';
    }
  }
  return { panels, najm, chassis, airbags };
}

function cond(rng: Rng, pMinor: number, pMajor: number): Cond {
  const r = rng.next();
  if (r < pMajor) return 'major';
  if (r < pMajor + pMinor) return 'minor';
  return 'ok';
}

function niceRound(v: number): number {
  if (v >= 1_000_000) return Math.round(v / 5000) * 5000;
  if (v >= 100_000) return Math.round(v / 500) * 500;
  if (v >= 20_000) return Math.round(v / 100) * 100;
  return Math.round(v / 50) * 50;
}

// ---------------------------------------------------------------------------

export interface Built {
  /** the real ad's own words, when the car comes from one */
  adText?: string;
  ad?: AdSet | null;
  /** lines already used tonight (no two lots share a seller or inspector line) */
  used?: Set<string>;
  car: CarPub;
  truth: CarPub;
  value: number;
  tags: string[];
  mode: SaleMode;
  seller: Seller;
}

// ---------------------------------------------------------------------------
// Saudi plates. 17 letters; some numbers/letters are "مميزة" and trade for real money.

const PLATE_LETTERS: readonly (readonly [string, string])[] = [
  ['ا', 'A'], ['ب', 'B'], ['ح', 'J'], ['د', 'D'], ['ر', 'R'], ['س', 'S'], ['ص', 'X'], ['ط', 'T'], ['ع', 'E'],
  ['ق', 'G'], ['ك', 'K'], ['ل', 'L'], ['م', 'Z'], ['ن', 'N'], ['هـ', 'H'], ['و', 'U'], ['ى', 'V'],
];

function plateOf(letters: (readonly [string, string])[], num: string, special?: PlatePub['special']): PlatePub {
  return { ar: letters.map((l) => l[0]).join(' '), en: letters.map((l) => l[1]).join(' '), num, special };
}

/** Clean, positive words and names the 17 plate letters can spell (read right to left). */
export const PLATE_WORDS: readonly string[] = [
  'ملك', 'صقر', 'بدر', 'سعد', 'كرم', 'نصر', 'عدل', 'حلا', 'سما', 'ورد', 'صدق', 'بطل', 'حسن', 'نور', 'هلا',
  'قمر', 'دار', 'سلم', 'حكم', 'امل', 'نبل', 'عسل', 'برق', 'رعد', 'بحر', 'نهر', 'سهل', 'نسر', 'اسد', 'حمد', 'عود',
  'درب', 'قلب', 'صبر', 'قصر', 'ربح', 'سور', 'كحل', 'حلم', 'عمر', 'حصن', 'ركن',
];
const wordKey = (letters: readonly string[]) => letters.map((l) => (l === 'هـ' ? 'ه' : l)).join('');
const WORD_SET = new Set(PLATE_WORDS);
/** plate letters for a word (ه is written هـ on the plate) */
export const wordLetters = (w: string) => [...w].map((c) => (c === 'ه' ? 'هـ' : c));

export interface PlateGrade {
  tier: 'legend' | 'rare' | 'top' | 'special' | 'nice';
  label: string;
  note: string;
  /** 0..1, where the plate sits inside its tier */
  score: number;
}

const DIG_AR = ['صفر', 'واحد', 'اثنين', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
const DIG_PL = ['أصفار', 'واحدات', 'اثنينات', 'ثلاثات', 'أربعات', 'خمسات', 'ستات', 'سبعات', 'ثمانيات', 'تسعات'];
const LIKED = new Set(['1', '5', '7', '9', '0']);

/**
 * Grades a plate the way the Saudi market does: fewer digits first, then repeated or named letters, then the
 * digits themselves. The ONLY thing that decides whether a plate is tagged, its tier, label and note.
 */
export function gradePlate(letters: readonly string[], num: string): PlateGrade | null {
  const n = letters.length;
  const len = num.length;
  const sameL = letters.every((l) => l === letters[0]);
  const repL = n === 3 && !sameL && new Set(letters).size < 3;
  const word = n === 3 && WORD_SET.has(wordKey(letters)) ? wordKey(letters) : null;
  const sameD = len >= 2 && /^(\d)\1+$/.test(num);
  const round = /^[1-9]0+$/.test(num);
  const twins = len === 2 && sameD;
  const stepped = num === '1234' || num === '4321' || num === '123' || num === '321';
  const mirror = len === 4 && (/^(\d)(\d)\2\1$/.test(num) || /^(\d)(\d)\1\2$/.test(num)) && !sameD;
  const liked = [...num].filter((c) => LIKED.has(c)).length / len;
  const one = num === '1' ? 0.25 : 0;
  const sc = (base: number) => Math.max(0, Math.min(1, base + 0.35 * liked + one));
  const g = (tier: PlateGrade['tier'], label: string, note: string, base: number): PlateGrade => ({ tier, label, note, score: sc(base) });
  const L = (tier: PlateGrade['tier']) =>
    tier === 'legend' ? 'لوحة أسطورية' : tier === 'rare' ? 'لوحة نادرة' : tier === 'top' ? 'لوحة مميزة' : '';

  if (n === 1 && len <= 2) return g('legend', L('legend'), len === 1 ? 'حرف واحد ورقم واحد' : 'حرف واحد ورقمين', len === 1 ? 0.4 : 0);
  if (n === 3 && sameL && len === 1) return g('legend', L('legend'), 'ثلاث حروف متشابهة ورقم مفرد', 0);
  if (n === 2 && sameL && len <= 2) return g('rare', L('rare'), len === 1 ? 'حرفين متشابهة ورقم مفرد' : twins ? 'حرفين متشابهة ورقمين متشابهة' : 'حرفين متشابهة ورقمين', len === 1 ? 0.4 : twins ? 0.25 : 0);
  if (word && len === 1) return g('rare', L('rare'), `اسم (${word}) ورقم مفرد`, 0.1);
  if (n === 3 && sameL && len === 2) return g('rare', L('rare'), twins ? 'ثلاث حروف متشابهة ورقمين متشابهة' : 'ثلاث حروف متشابهة ورقمين', twins ? 0.3 : 0);
  if (n === 3 && sameL && len === 3 && round) return g('rare', L('rare'), `ثلاث حروف متشابهة ورقم ${num}`, 0);
  if (n === 3 && len === 1) return g('top', L('top'), repL ? 'حروف مكررة ورقم مفرد' : 'رقم مفرد', repL ? 0.15 : 0);
  if (word && (twins || (len === 3 && sameD))) return g('top', L('top'), `اسم (${word}) و${twins ? 'رقمين متشابهة' : `ثلاث ${DIG_PL[+num[0]]}`}`, twins ? 0.2 : 0);
  if (n === 3 && sameL && len === 3 && (sameD || stepped)) return g('top', L('top'), sameD ? 'حروف متشابهة وأرقام متشابهة' : 'حروف متشابهة ورقم متسلسل', sameD ? 0.2 : 0);
  if (len === 4 && sameD) return g('special', 'رقم مميز', `أربع ${DIG_PL[+num[0]]}`, 0.2);
  if (len === 3 && sameD) return g('special', 'رقم مميز', `ثلاث ${DIG_PL[+num[0]]}`, 0.1);
  if (n === 3 && twins) return g('special', 'رقم مميز', `رقمين متشابهة (${DIG_AR[+num[0]]})`, 0.3);
  if (n === 3 && len === 2 && word) return g('special', 'رقم مميز', `رقمين واسم (${word})`, 0.15);
  // two plain digits under three unrelated letters: liked, never called مميزة
  if (n === 3 && len === 2) return g('nice', 'رقم حلو', 'رقمين', 0.7);
  if (word) return g('special', 'حروف مميزة', `اسم (${word})`, 0);
  if (n === 3 && sameL) return g('special', 'حروف مميزة', 'ثلاث حروف متشابهة', 0.1);
  if ((len === 3 || len === 4) && round) return g('nice', 'رقم حلو', len === 4 ? 'رقم ألفي' : 'رقم مئوي', 0.2);
  if (num === '1234') return g('nice', 'رقم حلو', 'أرقام متسلسلة', 0.1);
  if (mirror && repL) return g('nice', 'رقم حلو', 'رقم مرايا وحرف مكرر', 0);
  return null;
}

/** Does this plate look special to a Saudi eye? Exactly when the grader tags it (ordinary plates never do). */
function looksSpecial(num: string, letters: readonly (readonly [string, string])[]): boolean {
  return gradePlate(letters.map((l) => l[0]), num) !== null;
}

/** value ranges per tier, from real Absher/Haraj sales */
const TIER_RANGE: Record<PlateGrade['tier'], [number, number, number]> = {
  legend: [900_000, 4_500_000, 50_000],
  rare: [250_000, 1_500_000, 10_000],
  top: [60_000, 300_000, 5_000],
  special: [12_000, 90_000, 500],
  nice: [3_000, 18_000, 500],
};

/**
 * A Saudi private plate. Most are ordinary (three letters, four digits) and carry no tag at all. The special
 * ones follow what really trades: one letter and one digit (Absher sold «ع 1» for 21 million and «ط 1» for
 * 4.15 million), two letters and two digits («م م 22» 1.47 million), names in the letters («ص ق ر 7»),
 * three identical letters, three letters and one digit, four identical digits, and the cheaper «رقم حلو» patterns.
 * The tier and label always come from `gradePlate`. `cap` keeps a plate within what the room can pay.
 */
export function makePlate(rng: Rng, m: CarModel, cap = Infinity): PlatePub {
  const L = () => rng.pick(PLATE_LETTERS);
  const byAr = (c: string) => PLATE_LETTERS.find((l) => l[0] === c)!;
  const three = () => [L(), L(), L()];
  const same = (n: number) => {
    const l = L();
    return Array.from({ length: n }, () => l);
  };
  const word = () => wordLetters(rng.pick(PLATE_WORDS)).map(byAr);
  const rep = () => {
    const a = L();
    let b = L();
    while (b === a) b = L();
    return rng.pick([[a, a, b], [a, b, a], [b, a, a]]);
  };
  const d = () => String(rng.int(1, 9));
  const dl = () => rng.pick(['1', '5', '7', '9', d()]);
  const plain = (lo: number, hi: number) => String(rng.int(lo, hi));
  const posh = m.tier === 'luxury' || m.tier === 'exotic' || m.tier === 'sport';
  const w = (normal: number, rich: number) => (posh ? rich : normal);
  const tiers: [PlateGrade['tier'], number][] = [
    ['legend', cap >= 900_000 ? w(0.0015, 0.006) : 0],
    ['rare', cap >= 250_000 ? w(0.0035, 0.012) : 0],
    ['top', cap >= 60_000 ? w(0.01, 0.025) : 0],
    ['special', cap >= 12_000 ? w(0.03, 0.05) : 0],
    ['nice', cap >= 3_000 ? w(0.05, 0.06) : 0],
  ];
  let roll = rng.next();
  let tier: PlateGrade['tier'] | 'normal' = 'normal';
  for (const [t, p] of tiers) {
    if (roll < p) {
      tier = t;
      break;
    }
    roll -= p;
  }

  type Cand = [(readonly [string, string])[], string];
  const gens: Record<PlateGrade['tier'], [() => Cand, number][]> = {
    legend: [[() => [[L()], dl()], 55], [() => [[L()], plain(10, 99)], 20], [() => [same(3), dl()], 25]],
    rare: [
      [() => [same(2), rng.chance(0.5) ? dl() : rng.chance(0.5) ? d().repeat(2) : plain(10, 99)], 45],
      [() => [word(), dl()], 35],
      [() => [same(3), rng.chance(0.6) ? d().repeat(2) : `${d()}00`], 20],
    ],
    top: [
      [() => [rng.chance(0.25) ? rep() : three(), dl()], 45],
      [() => [word(), rng.chance(0.5) ? d().repeat(2) : d().repeat(3)], 35],
      [() => [same(3), rng.chance(0.7) ? d().repeat(3) : rng.pick(['123', '321'])], 20],
    ],
    special: [
      [() => [three(), d().repeat(4)], 22],
      [() => [three(), d().repeat(3)], 18],
      [() => [three(), d().repeat(2)], 22],
      [() => [word(), plain(1000, 9999)], 26],
      [() => [same(3), plain(1000, 9999)], 12],
    ],
    nice: [
      [() => [three(), plain(10, 99)], 22],
      [() => [three(), `${d()}000`], 30],
      [() => [three(), `${d()}00`], 30],
      [() => [three(), '1234'], 15],
      [() => {
        const a = d();
        let b = d();
        while (b === a) b = d();
        return [rep(), rng.pick([`${a}${b}${b}${a}`, `${a}${b}${a}${b}`])];
      }, 25],
    ],
  };

  if (tier !== 'normal') {
    for (let i = 0; i < 60; i++) {
      const [letters, num] = rng.weighted(gens[tier])();
      const gr = gradePlate(letters.map((l) => l[0]), num);
      if (!gr || gr.tier !== tier) continue;
      const [lo, hi, step] = TIER_RANGE[tier];
      const pos = Math.min(1, gr.score * 0.75 + rng.next() * 0.25);
      let v = Math.round((lo + (hi - lo) * pos * pos) / step) * step;
      if (tier === 'legend' || tier === 'rare' || tier === 'top') v = Math.round(Math.min(v, cap) / step) * step;
      return plateOf(letters, num, { tier: gr.tier, label: gr.label, note: gr.note, value: v });
    }
  }
  // an ordinary plate: nothing about it may look special
  for (;;) {
    const letters = three();
    const num = rng.chance(0.9) ? plain(1000, 9999) : plain(101, 999);
    if (!looksSpecial(num, letters)) return plateOf(letters, num);
  }
}

const AD_COLORS: [RegExp, string][] = [
  [/لؤلؤ|لولو|بيرل/, 'أبيض لؤلؤي'], [/ابيض|أبيض/, 'أبيض'], [/فضي|سلفر/, 'فضي'], [/رصاصي|رمادي|جراي|سكني/, 'رصاصي'],
  [/اسود|أسود/, 'أسود'], [/شمباني|ذهبي/, 'شمباني'], [/بيج/, 'بيج'], [/عنابي|ماروني|خمري/, 'عنابي'], [/كحلي/, 'كحلي'],
  [/احمر|أحمر/, 'أحمر'], [/ازرق|أزرق/, 'أزرق'], [/زيتي|اخضر|أخضر/, 'أخضر زيتي'], [/بني/, 'بني'], [/برتقالي/, 'برتقالي'], [/اصفر|أصفر/, 'أصفر'],
];

/** Where the car was made for, when the ad says. */
function specFromAd(t: string): CarPub['specKind'] | null {
  if (/سلفج|salvage/i.test(t)) return 'us_salvage';
  if (/وارد\s*(امريكي|أمريكي|أمريكا|امريكا)|امريكي|أمريكي|مواصفات امريكيه/.test(t)) return 'us';
  if (/كندي|وارد كندا/.test(t)) return 'ca';
  if (/ياباني|وارد اليابان/.test(t)) return 'jp';
  if (/اوروبي|أوروبي|المانيا|ألمانيا/.test(t)) return 'eu';
  if (/خليجي|خليجيه|خليجية/.test(t)) return 'gcc';
  if (/سعودي|وكاله|وكالة|عبداللطيف جميل|الجميح|الوعلان|المجدوعي|الناغي|الجزيرة/.test(t)) return 'saudi';
  return null;
}

function sellerFromAd(t: string): Seller | null {
  if (/معرض|معارض|للسيارات|المتميز للسيارات/.test(t)) return 'showroom';
  if (/تأجير|تاجير|ايجار/.test(t)) return 'rental';
  if (/مالك اول|مالك أول|استخدام شخصي|سيارتي|موتري/.test(t)) return 'owner';
  return null;
}

function interiorFromAd(t: string): string | null {
  const m = /(داخلي[ةه]?|المقاعد|الفرش)[^.،\n]{0,24}?(بيج|أسود|اسود|بني|رمادي|أحمر|احمر|كريمي|عنابي)/.exec(t);
  if (!m) return null;
  return { اسود: 'أسود', احمر: 'أحمر' }[m[2] as 'اسود' | 'احمر'] ?? m[2];
}

/**
 * The trim shown on a real ad's car is the one the ad names — never the catalogue entry's (a "GXR V8"
 * label on a car whose ad doesn't say so would be made up). Pickup trims carry the cab only when known.
 */
function trimFor(m: CarModel, ad: AdSet | null, cab: 'single' | 'double' | undefined): string {
  let t = (ad ? ad.trim : m.trim) || '';
  if (m.body === 'pickup') {
    t = t.replace(/غمارتين|غماره|غمارة|single\s*cab|double\s*cab|crew\s*cab/gi, ' ').replace(/\s+/g, ' ').trim();
    // the model's own name may already say it («شاص غمارتين»)
    if (cab && !/غمار/.test(m.modelAr)) t = `${cab === 'single' ? 'غمارة' : 'غمارتين'} ${t}`.trim();
  }
  return t;
}

function transFor(m: CarModel, ad: AdSet | null): string {
  if (!ad?.trans) return m.trans;
  const manual = /MT/i.test(m.trans);
  if (ad.trans === 'MT') return manual ? m.trans : 'MT';
  return manual ? 'AT' : m.trans;
}

/** What a real ad says about the body: seller words win over dice. */
function adCondition(text: string): CondClass | null {
  const t = text.replace(/[ًٌٍَُِّْـ]/g, '');
  const no = (re: RegExp) => !re.test(t);
  // «للتشليح» is a wreck; a panel «من التشليح» is just a used part on a running car
  if (/للتشليح|يصلح تشليح|يصلح للتشليح|محترق|محترقه|غرقان|غرقانه|سيل/.test(t)) return 'wreck';
  if (/مقصوص|قص |قص$|قلبان|مقلوب|مصدوم|مصدومه|مصدومة|صدمه قويه|صدمة قوية|كل (قطع )?البد[يى] مبدل|البد[يى] كامل مبدل|البد[يى] مغير كامل/.test(t) && no(/بدون صدمات|ما فيها صدم|مافيها صدم|بدون حوادث|ما عليها حوادث|(غير|مو|مب|ماهي|ما هي|ليست) ?مصدوم|(غير|مو|مب) ?مقلوب/)) return 'major';
  if (/صدمه|صدمة|صدمات|خبطه|خبطة|ضربه|ضربة|حادث/.test(t) && no(/بدون صدمات|ما فيها صدم|مافيها صدم|بدون حوادث|ما عليها حوادث|بدون حادث|خالي من الحوادث/)) return 'hit';
  if (/رش|رشه|رشة|سمكر|معجون|رنج/.test(t) && no(/بدون رش|ما فيها رش|مافيها رش|ولا رشه|ولا رشة|بدون ولا رش|خالي من الرش|خاليه من الرش/)) return 'painted';
  // a replaced panel (a trunk lid from the scrapyard) is body work, even on an otherwise clean car
  if (/مبدل|مبدله|مبدلة|مغير|مستبدل|تبديل/.test(t) && no(/بدون تبديل|ما فيها تبديل|مافيها تبديل|ولا قطعة مبدلة|ولا قطعه مبدله/)) return 'painted';
  if (/وكاله|وكالة|بدون رش|ما فيها رش|مافيها رش|قمة النظافه|قمة النظافة|نظيف|نظيفه|نظيفة|مالك اول|مالك أول|بوية وكالة|صبغ وكالة/.test(t)) return 'clean';
  return null;
}

/**
 * The ad's own headline, minus the asking price (the auction finds the price; the seller's ask would
 * hand it away): «بسعر 90 الف»، «اقل سعر 232 300 بضريبة»، «287 ألف شامل…»، «ب 8».
 */
export function adTitleClean(t: string): string {
  const TAIL = '(?:\\s*(?:بالضريبة|بضريبة|شامل الضريبة|شامل جميع المصاريف|شامل المصاريف|شامل))?';
  const mileage = /(ممشى|ممشا|ممشاه|ممشاها|ماشي|ماشيه|عداد|العداد|الممشى)\s*$/;
  return (
    t
      // «بسعر 90 الف»، «السعر 55.800»، «اقل سعر 232 300 بضريبة»، «ب 8»، «الحد 54 ألف ريال»
      .replace(new RegExp(`(^|[\\s\\-–(])(?:بسعر|سعر|السعر|اقل سعر|أقل سعر|سوم|السوم|الحد|حده|بـ|ب)\\s*[:：]?\\s*[\\d٠-٩][\\d٠-٩\\s,.،]*(?:\\s*(?:ألف|الف|ريال|k|K))*${TAIL}`, 'g'), '$1')
      // «(435900) شامل الضريبة»: a bare five-to-seven digit figure is a price, not a model or a mileage
      .replace(new RegExp(`\\(\\s*[\\d٠-٩]{5,7}\\s*\\)${TAIL}|(^|\\s)[\\d٠-٩]{5,7}(?:\\s*ريال)?(?=\\s*(?:شامل|بالضريبة|بضريبة|ريال))${TAIL}`, 'g'), (all: string, pre?: string) => pre ?? '')
      // a bare «287 ألف شامل…» — but «ممشى 98 الف» is the mileage, and stays
      .replace(new RegExp(`(^|\\s)[\\d٠-٩][\\d٠-٩,.،]*\\s*(?:ألف|الف|ريال)${TAIL}`, 'g'), (all: string, pre: string, off: number, str: string) =>
        mileage.test(str.slice(0, off + pre.length)) ? all : pre,
      )
      .replace(/\s*[-–|،,]\s*(?=[-–|،,]|$)/g, '')
      .replace(/\s+ال$/, '') // a cut-off «الف» left behind
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\-–|،,]+|[\s\-–|،,]+$/g, '')
      .trim()
  );
}

/** The seller's real sentences, minus phone numbers, prices and contact lines. */
function adLines(text: string): string[] {
  return text
    .replace(/(\+?966|0)?5\d{8}/g, '')
    .split(/[\n\r.!؟?]+|،\s|\s-\s|\s–\s|•|\*/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 8 && x.length <= 110 && x.split(' ').length >= 2)
    .filter((x) => !/ريال|الف|ألف|سعر|السوم|سوم|للتواصل|تواصل|واتس|جوال|اتصال|رقم|حراج|الموقع|المكان|خاص|@|http/.test(x))
    // the photos can be a neighbouring model-year: never quote a year that could contradict the lot
    .filter((x) => !/(^|[^\d])(19|20)\d{2}([^\d]|$)|موديل|ممشى|ممشاها|ماشي|كيلو|\sكم(\s|$)/.test(x))
    .slice(0, 3);
}

export function buildCar(rng: Rng, m: CarModel, ad: AdSet | null = null, used: Set<string> = new Set(), plateCap = Infinity): Built {
  const age = ageOf(m);
  const tags: string[] = [];
  // the cab is what the ad says; a car with no ad keeps the catalogue's. A pickup whose ad doesn't say
  // gets the two-door body map (never invent rear doors a single cab doesn't have) and no door count.
  const cab = m.body === 'pickup' ? (ad ? ad.cab : m.cab) : undefined;
  const doors: 2 | 4 =
    m.body === 'coupe' || m.body === 'convertible' ? 2 : m.body === 'pickup' ? (cab === 'double' ? 4 : 2) : (m.doors ?? 4);

  // mileage: log-normal around the model's typical figure
  let kmv: number;
  if (age === 0) kmv = rng.chance(0.4) ? rng.int(5, 60) * 100 : rng.int(30, 220) * 100;
  else kmv = m.km * Math.exp(rng.normal(0, 0.32));
  kmv = Math.max(age === 0 ? 300 : 4000, Math.min(m.km * 2.4, kmv));
  kmv = Math.round(kmv / 100) * 100;
  // the ad's own mileage when it states one
  if (ad?.isNew) kmv = ad.km != null && ad.km < 20_000 ? Math.round(ad.km / 100) * 100 : rng.int(0, 30) * 100;
  else if (ad?.km && ad.km >= 1000 && ad.km < 1_500_000) kmv = Math.round(ad.km / 100) * 100;
  const ratio = m.km > 0 ? kmv / m.km : 1;
  const kmTag = ratio < 0.55 && age > 1 ? 'low' : ratio > 1.5 ? 'high' : undefined;

  const adSays = ad ? [ad.title, ad.text, ...(ad.lines ?? []), ...(ad.feats ?? [])].filter(Boolean).join(' ') : '';
  // a real ad that doesn't say where the car is from is, like most of Haraj, a Saudi or Gulf car —
  // never a made-up American import its photos could contradict
  const specSaid = adSays ? specFromAd(adSays) : null;
  let specKind = specSaid ?? (ad ? rng.weighted([['saudi', 72], ['gcc', 28]] as const) : pickSpec(rng, m));
  if (ad && specKind === 'us_salvage' && !ad.damaged) specKind = 'us';
  const fromAd = adSays ? adCondition(adSays) : null;
  // a real ad's photos show the body: visible damage only when the ad says so
  let cls: CondClass;
  if (!ad) cls = pickCondition(rng, m, specKind);
  else if (fromAd === 'wreck') cls = 'wreck';
  else if (ad.damaged) cls = fromAd === 'hit' ? 'hit' : 'major';
  else if (fromAd === 'major' || fromAd === 'hit' || fromAd === 'painted') cls = fromAd;
  else if (ad.isNew || fromAd === 'clean') cls = rng.chance(0.85) ? 'clean' : 'touched';
  else cls = rng.weighted([['clean', 55], ['touched', 45]] as const);
  // «طلع الاربكات»، «ارباك طالع»: the airbags went off — a real hit, whatever else the ad says
  const bagsOut = /(ا|إ|أ)?[يى]?ر?باك(ات)?\s*(طالع|طلع|مفتوح|ضارب|ضاربه|ضاربة|مفقوع)|(طلع|طلعت|ضرب|ضربت|انفتح|انفتحت)\s*(ال)?(ا|إ|أ)?[يى]?ر?باك|(ا|إ|أ)?[يى]?رب?كات\s*(طالع|طلع|مفتوح)|طلع\s*(ال)?(ا|إ|أ)?[يى]?رب?كات/.test(adSays);
  if (ad && bagsOut && (cls === 'clean' || cls === 'touched' || cls === 'painted')) cls = 'hit';
  const body = buildPanels(rng, cls, doors);
  if (bagsOut) body.airbags = 'deployed';

  // mechanical health grows worse with age and mileage
  const wear = Math.min(1, age / 18 + (ratio - 1) * 0.15);
  const mech: Mech = {
    engine: cond(rng, 0.04 + 0.16 * wear, 0.005 + 0.05 * wear),
    gearbox: cond(rng, 0.04 + 0.14 * wear, 0.004 + 0.04 * wear),
    chassis: body.chassis,
    airbags: body.airbags,
    ac: rng.chance(0.03 + 0.1 * wear) ? (rng.chance(0.3) ? 'broken' : 'weak') : 'cold',
    susp: cond(rng, 0.05 + 0.2 * wear, 0.01 + 0.04 * wear),
  };
  if (/القير (يبي|يبغى|فيه|تعبان)|نتعه|نتعة|يرفس|القير يتأخر/.test(adSays)) mech.gearbox = 'minor';
  if (/المكينه (تبي|تبغى|فيها|تعبانه)|المكينة (تبي|تبغى|فيها|تعبانة)|تهريب زيت|تاكل زيت|تأكل زيت|دخان/.test(adSays)) mech.engine = 'minor';
  if (/المكيف (يبي|يبغى|ضعيف|خربان)|المكيف ما يبرد/.test(adSays)) mech.ac = 'weak';
  if (m.tier === 'junk') {
    if (rng.chance(0.35)) mech.engine = rng.chance(0.4) ? 'major' : 'minor';
    if (rng.chance(0.3)) mech.gearbox = rng.chance(0.35) ? 'major' : 'minor';
  }
  let runs: CarPub['runs'] = 'drive';
  if (cls === 'wreck') runs = rng.chance(0.5) ? 'starts' : 'dead';
  else if (mech.engine === 'major' && rng.chance(0.35)) runs = 'starts';
  if (m.tier === 'junk' && rng.chance(0.06)) runs = 'dead';

  // seller and how it's sold
  let seller: Seller = rng.weighted([['owner', 52], ['showroom', 30], ['company', 5], ['gov', 5]] as const);
  if ((m.tier === 'daily' || m.tier === 'family') && age >= 1 && age <= 6 && rng.chance(0.16)) seller = 'rental';
  if ((cls === 'major' || cls === 'wreck' || specKind === 'us_salvage') && rng.chance(0.4)) seller = 'insurance';
  if (m.tier === 'exotic' && seller === 'gov') seller = 'showroom';
  if (ad) {
    // a Haraj ad is an owner or a showroom (a wrecked one may come through insurance)
    seller = sellerFromAd(adSays) ?? (ad.isNew ? 'showroom' : rng.weighted([['owner', 68], ['showroom', 32]] as const));
    if ((cls === 'major' || cls === 'wreck') && rng.chance(0.3)) seller = 'insurance';
  }
  let mode: SaleMode = rng.chance(0.78) ? 'inspected' : 'asis';
  if (seller === 'gov' || seller === 'insurance') mode = rng.chance(0.75) ? 'asis' : 'inspected';
  if (runs === 'dead') mode = 'asis';
  if (!ad && seller === 'rental' && kmv < m.km * 1.15) kmv = Math.round((m.km * rng.range(1.15, 1.6)) / 100) * 100;

  const colorPool = m.colors.filter((c) => COLORS[c]);
  let color =
    colorPool.length && rng.chance(0.75)
      ? rng.pick(colorPool)
      : rng.weighted(Object.entries(COLORS).map(([k, v]) => [k, v.w] as const));
  if (ad) {
    // the colour the ad states, or the one its photos show
    const said = ad.color ?? '';
    const hit = COLORS[said] ? said : AD_COLORS.find(([re]) => re.test(`${said} ${ad.title ?? ''}`))?.[1];
    color = hit ?? 'حسب الصور';
  }
  const colorHex = COLORS[color]?.hex ?? '#C9CCC8';
  const interior = ad ? (interiorFromAd(adSays) ?? 'حسب الصور') : m.tier === 'sport' && rng.chance(0.3) ? 'أحمر' : rng.pick(INTERIORS.slice(0, 4));
  const city = ad?.city && ad.city.length <= 14 ? ad.city : rng.weighted(CITIES);

  const owners = age <= 1 ? 1 : age <= 4 ? rng.int(1, 2) : age <= 10 ? rng.int(1, 3) : rng.int(2, 5);
  const service: CarPub['service'] =
    seller === 'rental' || seller === 'company'
      ? 'dealer'
      : age <= 4 || m.tier === 'luxury' || m.tier === 'exotic'
        ? rng.weighted([['dealer', 70], ['workshop', 26], ['none', 4]] as const)
        : rng.weighted([['dealer', 22], ['workshop', 58], ['none', 20]] as const);

  const istimara: CarPub['istimara'] = rng.chance(m.tier === 'junk' || seller === 'gov' ? 0.38 : 0.1) ? 'expired' : 'valid';
  const mvpiOk = runs === 'drive' && istimara === 'valid' && rng.chance(0.8);
  const mvpiUntil = mvpiOk ? `${NOW_YEAR + (rng.chance(0.6) ? 1 : 0)}/${String(rng.int(1, 12)).padStart(2, '0')}` : undefined;
  const insurance: CarPub['insurance'] = age <= 4 ? rng.weighted([['comp', 70], ['tpl', 28], ['none', 2]] as const) : rng.weighted([['comp', 18], ['tpl', 70], ['none', 12]] as const);
  const fines = rng.chance(0.12) ? rng.int(3, 60) * 100 : 0;

  const tires = Math.min(NOW_YEAR, Math.max(m.year, NOW_YEAR - rng.int(0, 4)));
  const extras = ad ? (ad.feats ?? []).slice(0, 6) : (() => {
        const pool = [...new Set([...(FEATURES[m.tier] ?? FEATURES.daily), ...moreFeatures(m.tier)])];
        const fresh = pool.filter((x) => !used.has(x));
        const got = rng.sample(fresh.length >= 4 ? fresh : pool, rng.int(2, 4));
        for (const x of got) used.add(x);
        return got;
      })();
  const modsPicked = !ad && rng.chance(0.55) ? rng.sample(MODS, rng.int(1, 2)) : [];
  for (const [label] of modsPicked) extras.push(label);
  const warranty = age <= 3 && service === 'dealer' && specKind === 'saudi' && rng.chance(0.75) ? `ضمان وكالة ساري حتى ${m.year + 5}` : undefined;
  const keys: 1 | 2 = specKind === 'us_salvage' || age > 12 || rng.chance(0.12) ? 1 : 2;

  // inspection visibility: an as-is sale hides part of the sheet
  const panels = { ...body.panels };
  let shownMech = { ...mech };
  if (mode === 'asis') {
    for (const p of Object.keys(panels) as PanelId[]) if (rng.chance(0.45)) panels[p] = 'unknown';
    shownMech = {
      ...mech,
      engine: rng.chance(0.6) ? 'unknown' : mech.engine,
      gearbox: rng.chance(0.6) ? 'unknown' : mech.gearbox,
      chassis: rng.chance(0.7) ? 'unknown' : mech.chassis,
      susp: 'unknown',
    };
  }

  // ---- valuation (true value, before any surprise) ----
  let v = ad?.value ?? m.value;
  if (!ad?.value) {
    if (ratio < 1) v *= 1 + Math.min(0.1, (1 - ratio) * 0.14);
    else v *= 1 - Math.min(0.32, (ratio - 1) * 0.16);
  }
  let panelHit = 0;
  for (const s of Object.values(body.panels)) {
    panelHit += s === 'spot' ? 0.006 : s === 'paint' ? 0.016 : s === 'dent' ? 0.01 : s === 'replaced' ? 0.032 : s === 'damaged' ? 0.06 : 0;
  }
  v *= 1 - Math.min(0.38, panelHit);
  if (body.chassis === 'repaired') v *= 0.8;
  if (body.chassis === 'damaged') v *= 0.65;
  if (body.airbags === 'deployed') v *= 0.9;
  if (mech.engine === 'minor') v *= 0.96;
  if (mech.engine === 'major') v *= 0.78;
  if (mech.gearbox === 'minor') v *= 0.97;
  if (mech.gearbox === 'major') v *= 0.86;
  if (mech.ac === 'weak') v *= 0.99;
  if (mech.ac === 'broken') v -= Math.min(4000, v * 0.03);
  if (mech.susp === 'minor') v *= 0.985;
  if (mech.susp === 'major') v *= 0.96;
  if (runs === 'starts') v *= 0.9;
  if (runs === 'dead') v *= 0.72;
  const specCut: Record<CarPub['specKind'], number> = { saudi: 1, gcc: 0.97, us: 0.91, us_salvage: 0.72, ca: 0.91, eu: 0.94, jp: 0.94 };
  v *= specCut[specKind];
  if (owners > 2) v *= 1 - 0.015 * (owners - 2);
  if (service === 'dealer') v *= 1.03;
  if (service === 'none') v *= 0.97;
  if (seller === 'rental') v *= 0.93;
  const ceff = COLORS[color]?.eff ?? 0;
  if (!(ceff < 0 && (m.tier === 'sport' || m.tier === 'exotic'))) v *= 1 + ceff;
  for (const [, eff] of modsPicked) v *= 1 + eff;
  if (warranty) v *= 1.02;
  if (istimara === 'expired') v -= 800;
  if (!mvpiOk && runs === 'drive') v -= 300;
  v -= fines;
  const floor = m.body === 'suv' || m.body === 'pickup' ? 4000 : 2500;
  v = Math.max(floor, v);
  v = niceRound(v);
  const plate = makePlate(rng, m, plateCap);
  if (plate.special) v += plate.special.value;

  // tags drive the seller's ad text
  const any = (s: PanelStatus) => Object.values(body.panels).includes(s);
  if (cls === 'clean') tags.push('clean');
  if (mech.ac === 'cold' && rng.chance(0.5)) tags.push('ac');
  if (service === 'dealer') tags.push('dealer');
  if (service === 'workshop') tags.push('workshop');
  if (kmTag === 'low') tags.push('lowkm');
  if (kmTag === 'high') tags.push('highkm');
  if (tires >= NOW_YEAR - 1) tags.push('tires');
  if (any('paint') || any('spot')) tags.push('paint');
  if (cls === 'hit' || cls === 'major') tags.push('hit');
  if (mech.gearbox === 'minor' || mech.susp === 'minor') tags.push('mech_minor');
  if (m.tier === 'junk') tags.push('junk');
  if (runs === 'dead') tags.push('dead');
  tags.push(seller);
  if (m.tier === 'sport' || m.tier === 'exotic') tags.push('sport');
  if (m.tier === 'classic') tags.push('classic');
  if (m.tier === 'work') tags.push('work');
  if (m.tier === 'luxury') tags.push('luxury');
  if (cls !== 'clean' && rng.chance(0.3)) tags.push('shady');
  if (rng.chance(0.18)) tags.push('urgent');
  tags.push(cls);

  const japanese = ['Toyota', 'Lexus', 'Nissan', 'Infiniti', 'Honda', 'Mazda', 'Mitsubishi', 'Isuzu', 'Suzuki'].includes(m.makeEn);
  const truthMicrons: Partial<Record<PanelId, number | null>> = {};
  for (const [k, st] of Object.entries(body.panels) as [PanelId, PanelStatus][]) truthMicrons[k] = micronsFor(rng, st, japanese);
  const shownMicrons: Partial<Record<PanelId, number | null>> = {};
  for (const k of Object.keys(panels) as PanelId[]) shownMicrons[k] = panels[k] === 'unknown' ? null : truthMicrons[k] ?? null;
  const notes: string[] = [];
  // the inspector words the same fault differently from car to car: no two lots tonight share a note
  const say = (options: string[]) => {
    const fresh = options.filter((x) => !used.has(x));
    const x = rng.pick(fresh.length ? fresh : options);
    used.add(x);
    notes.push(x);
  };
  if (mode === 'asis') notes.push('فحص خارجي فقط، العيوب الخفية ما تنضمن');
  if (mech.engine === 'minor') say(faultPool('engine_minor'));
  if (mech.engine === 'major') say(faultPool('engine_major'));
  if (mech.gearbox === 'minor') say(faultPool('gearbox_minor'));
  if (mech.gearbox === 'major') say(faultPool('gearbox_major'));
  if (mech.susp === 'minor') say(faultPool('susp_minor'));
  if (mech.ac === 'weak') say(faultPool('ac_weak'));
  if (body.chassis === 'repaired') say(faultPool('chassis'));
  if (cls === 'clean' && service === 'dealer' && rng.chance(0.6)) say(faultPool('dealer_clean'));
  if (mech.susp === 'major') say(faultPool('susp_major'));
  // a clean car gets the inspector's plain findings, worded differently from car to car
  if (mode !== 'asis' && notes.length === 0 && mech.ac === 'cold') say(faultPool('positive'));
  // the model's own known weak spots, as a Saudi inspector would flag them
  const freshIssues = m.issues.filter((x) => !used.has(x));
  if (freshIssues.length && rng.chance(cls === 'clean' ? 0.3 : 0.6)) {
    const x = rng.pick(freshIssues);
    used.add(x);
    notes.push(x);
  }
  const regType = m.body === 'pickup' || m.body === 'van' ? 'نقل خاص' : 'خصوصي';

  const car: CarPub = {
    modelId: m.id,
    makeAr: m.makeAr,
    makeEn: m.makeEn,
    modelAr: m.modelAr,
    modelEn: m.modelEn,
    nick: m.nick,
    trim: trimFor(m, ad, cab),
    trimAr: ad ? undefined : m.trimAr,
    year: m.year,
    body: m.body,
    // '?' = the ad's car has another engine than the model's usual one and doesn't say which: show none
    engine: ad?.engine === '?' ? '' : ad?.engine ?? m.engine,
    hp: ad?.engine && !ad.hp ? undefined : (ad?.hp ?? m.hp),
    fuel: ad?.fuel ?? m.fuel,
    drive: ad?.drive ?? m.drive,
    trans: transFor(m, ad),
    tier: m.tier,
    doors,
    km: kmv,
    kmTag,
    spec: SPEC_LABEL[specKind],
    specKind,
    color,
    colorHex,
    interior,
    city,
    owners,
    service,
    najm: body.najm,
    istimara,
    mvpi: mvpiOk ? 'valid' : 'expired',
    mvpiUntil,
    insurance,
    fines,
    panels,
    mech: shownMech,
    tires,
    extras,
    warranty,
    runs,
    keys,
    microns: shownMicrons,
    scan: { status: 'none', codes: [] },
    history: [],
    inspector: mode === 'asis' ? notes.slice(0, 1) : notes,
    regType,
    plate,
    photos: ad ? ad.imgs.slice(0, 10) : undefined,
    adTitle: ad?.title ? adTitleClean(ad.title) : undefined,
    adUrl: ad && /^\d{8,}$/.test(ad.key) ? `https://haraj.com.sa/${ad.key}` : undefined,
    said: ad
      ? [
          ...(ad.km && ad.km >= 1000 ? ['km'] : ad.isNew ? ['km'] : []),
          ...(specSaid ? ['spec'] : []),
          ...(COLORS[color] ? ['color'] : []),
          ...(ad.engine ? ['engine', ...(ad.hp ? ['hp'] : [])] : []),
          ...(ad.trans ? ['trans'] : []),
          ...(ad.fuel ? ['fuel'] : []),
          ...(ad.drive ? ['drive'] : []),
          ...(interior !== 'حسب الصور' ? ['interior'] : []),
          ...(m.body !== 'pickup' || cab ? ['doors'] : []),
        ]
      : undefined,
  };
  const truth: CarPub = { ...car, panels: body.panels, mech, microns: truthMicrons, inspector: notes };
  truth.scan = scanFor(rng, truth);
  truth.history = [...historyFor(rng, truth, NOW_YEAR), ...serviceLines(rng, truth, NOW_YEAR, used)];
  car.scan = mode === 'asis' ? { status: 'none', codes: [] } : truth.scan;
  car.history = truth.history;
  return { car, truth, value: v, tags, mode, seller, adText: ad?.text ?? undefined, ad, used };
}

// ---------------------------------------------------------------------------
// Hidden surprises, revealed after the hammer falls

function applySurprise(truth: CarPub, s: Surprise) {
  if (s.key === 'chassis') truth.mech = { ...truth.mech, chassis: 'repaired' };
  if (s.key === 'airbags') {
    truth.mech = { ...truth.mech, airbags: 'deployed' };
    truth.scan = { status: 'stored', codes: [...truth.scan.codes, ['B0001', 'خلل في دائرة إيرباق السائق']] };
  }
  if (s.key === 'gearbox') truth.mech = { ...truth.mech, gearbox: 'major' };
  if (s.key === 'oil') truth.mech = { ...truth.mech, engine: 'major' };
  if (s.key === 'ac') truth.mech = { ...truth.mech, ac: 'broken' };
  if (s.key === 'najm') {
    truth.najm += 1;
    truth.panels = { ...truth.panels, rb: 'replaced', trunk: truth.panels.trunk === 'ok' ? 'paint' : truth.panels.trunk };
    truth.history = ['نجم: حادث خلفي ما انذكر بالإعلان', ...truth.history];
  }
  if (s.key === 'saher') truth.fines += -s.delta;
  if (s.key === 'salvage') {
    truth.specKind = 'us_salvage';
    truth.spec = SPEC_LABEL.us_salvage;
  }
  if (s.key === 'spec') {
    truth.specKind = 'saudi';
    truth.spec = SPEC_LABEL.saudi;
  }
  if (s.key === 'masked') truth.scan = { status: 'cleared', codes: [['P0171', 'خليط فقير'], ['P0300', 'تقطيع عشوائي بالسلندرات']] };
  if (s.key === 'wrap') {
    truth.color = 'أبيض لؤلؤي';
    truth.colorHex = COLORS['أبيض لؤلؤي'].hex;
  }
}

// ---------------------------------------------------------------------------
// Inspection read-outs (Manheim-style grade, Saudi chassis card, Copart-style damage line)

export function gradeOf(c: CarPub): number | null {
  const vals = Object.values(c.panels);
  if (vals.some((v) => v === 'unknown') || c.mech.engine === 'unknown') return null;
  let g = 5;
  for (const v of vals) g -= v === 'spot' ? 0.12 : v === 'paint' ? 0.28 : v === 'dent' ? 0.22 : v === 'replaced' ? 0.42 : v === 'damaged' ? 0.8 : 0;
  if (c.mech.chassis === 'repaired') g -= 1.2;
  if (c.mech.chassis === 'damaged') g -= 2;
  if (c.mech.airbags === 'deployed') g -= 0.6;
  g -= c.mech.engine === 'minor' ? 0.3 : c.mech.engine === 'major' ? 1.2 : 0;
  g -= c.mech.gearbox === 'minor' ? 0.25 : c.mech.gearbox === 'major' ? 1 : 0;
  g -= c.mech.susp === 'minor' ? 0.15 : c.mech.susp === 'major' ? 0.4 : 0;
  g -= c.mech.ac === 'weak' ? 0.1 : c.mech.ac === 'broken' ? 0.25 : 0;
  if (c.kmTag === 'high') g -= 0.3;
  if (c.runs === 'starts') g -= 0.6;
  if (c.runs === 'dead') g -= 1.4;
  return Math.max(0.5, Math.round(g * 10) / 10);
}

export function chassisCard(c: CarPub): { label: string; tone: 'good' | 'mid' | 'bad' | 'unknown' } {
  if (c.mech.chassis === 'unknown') return { label: 'ما انفحص', tone: 'unknown' };
  if (c.mech.chassis === 'damaged') return { label: 'قص أو قلبان', tone: 'bad' };
  if (c.mech.chassis === 'repaired') return { label: 'معدّل', tone: 'bad' };
  const hits = Object.values(c.panels).filter((v) => v === 'replaced' || v === 'damaged').length;
  if (hits > 0 || c.najm > 0) return { label: '4 جيد', tone: 'mid' };
  return { label: 'كرت أبيض', tone: 'good' };
}

export function damageLine(c: CarPub): string {
  const bad = (ids: PanelId[]) => ids.some((p) => c.panels[p] === 'replaced' || c.panels[p] === 'damaged');
  if (Object.values(c.panels).every((v) => v === 'unknown')) return 'غير معروف';
  if (bad(['fb', 'hood', 'lff', 'rff'])) return 'صدمة أمامية';
  if (bad(['rb', 'trunk', 'lrq', 'rrq'])) return 'صدمة خلفية';
  if (bad(['lfd', 'lrd', 'rfd', 'rrd'])) return 'صدمة جانبية';
  if (Object.values(c.panels).some((v) => v === 'paint' || v === 'spot' || v === 'dent')) return 'رش وتجميل';
  return 'بدون ضرر';
}

export function feeRuleFor(seller: Seller, settings: Settings): FeeRule {
  if (settings.fee <= 0) return { pct: 0, vat: false, transfer: 0, label: 'بدون رسوم' };
  if (seller === 'gov') return { pct: 5, vat: false, transfer: TRANSFER_FEE, label: 'سعي 5% شامل الضريبة' };
  return { pct: settings.fee, vat: true, transfer: TRANSFER_FEE, label: `سعي ${settings.fee}% + ضريبة` };
}

// ---------------------------------------------------------------------------
// Deck building

type Bucket = 'cheap' | 'low' | 'mid' | 'high' | 'dream';
// how the lots spread over price bands (relative to one garage slot of the budget)
const SPREAD: Record<Bucket, number> = { cheap: 0.16, low: 0.25, mid: 0.3, high: 0.2, dream: 0.09 };

export function bucketOf(value: number, perSlot: number, budget: number): Bucket | null {
  if (value > budget * 0.92) return null;
  const r = value / perSlot;
  if (r < 0.12) return 'cheap';
  if (r < 0.45) return 'low';
  if (r < 1.1) return 'mid';
  if (r < 2.4) return 'high';
  return 'dream';
}

export function titleOf(c: { makeAr: string; modelAr: string; trim: string; nick?: string }) {
  // «رنج روفر» is what everyone calls it — «لاند روفر رنج روفر» reads the name twice
  const make = /^رنج/.test(c.modelAr) ? '' : c.makeAr;
  return `${make} ${c.modelAr} ${c.trim}`.trim();
}

const TOP_TRIM = /فل|Limited|Platinum|VXR|VX|Denali|High Country|Ultra|LE|GLX|Titanium|Prestige|Signature/i;
const FILLER = new Set(['urgency', 'sentimental', 'negotiation', 'haraj', 'interior', 'cliche', 'condition']);

/** Pick 2–3 ad lines that match what this car really is — or what its seller wants you to believe. */
function sellerNotes(rng: Rng, m: CarModel, b: Built, cover: string | null): string[] {
  const used = b.used ?? new Set<string>();
  const ad = b.ad;
  // a real ad speaks for itself: only its own words and feature list — never a stock line, never
  // something the seller didn't write
  if (ad) {
    const real: string[] = [];
    if (ad.lines?.length) real.push(...ad.lines);
    else if (ad.text) real.push(...adLines(ad.text));
    if (ad.feats?.length) real.push(`فيها: ${ad.feats.slice(0, 7).join('، ')}`);
    return [...new Set(real)].filter((x) => !used.has(x)).slice(0, 5);
  }
  const c = b.car;
  const t = b.truth;
  const vals = Object.values(t.panels);
  const hasPaint = vals.some((v) => v === 'paint' || v === 'spot');
  const hasBody = vals.some((v) => v === 'replaced' || v === 'damaged');
  const mods = c.extras.some((e) => /تظليل|نانو|PPF|أندرويد|جنوط|رفع|عادم|برمجة|أوف رود/.test(e));
  const facts: Record<string, boolean> = {
    paint: hasPaint, body: hasBody, accident: t.najm > 0, najm: t.najm > 0, ac: t.mech.ac === 'cold',
    mileage: c.kmTag === 'low' || (c.kmTag === undefined && rng.chance(0.4)), service: c.service === 'dealer',
    history: c.service === 'dealer', family: m.tier === 'family', tyres: c.tires >= NOW_YEAR - 1,
    docs: c.istimara === 'valid' && c.mvpi === 'valid', insurance: c.insurance === 'comp',
    inspection: b.mode === 'inspected', saher: c.fines > 0, import: c.specKind === 'us' || c.specKind === 'ca',
    spec: c.specKind === 'gcc', warranty: !!c.warranty, mods, kashta: c.drive === '4WD' || m.body === 'pickup',
    exhaust: c.extras.includes('عادم معدّل'), engine: t.mech.engine !== 'ok' || c.extras.includes('برمجة كمبيوتر'),
    gearbox: t.mech.gearbox !== 'ok', suspension: t.mech.susp !== 'ok', rust: c.city === 'جدة', jeddah: c.city === 'جدة',
    flood: ['جدة', 'الدمام', 'الخبر', 'جازان'].includes(c.city), fuel: m.tier === 'daily', computer_scan: t.scan.status !== 'clean',
    trim: TOP_TRIM.test(`${m.trim} ${m.trimAr ?? ''}`), ownership: c.owners === 1, ex_government: b.seller === 'gov',
    ex_rental: b.seller === 'rental', airbag: t.mech.airbags === 'deployed', colour: !!COLORS[c.color]?.odd,
    tyres_new: c.tires >= NOW_YEAR - 1,
  };
  const fits = (g: string[]) => {
    const [mood, ...topics] = g;
    const real = topics.filter((x) => !FILLER.has(x) && x !== 'proud' && x !== 'funny' && x !== 'shady' && x !== 'honest');
    if (cover && topics.includes(cover) && (mood === 'shady' || mood === 'proud' || mood === 'funny')) return 3;
    if (mood === 'shady') return real.some((x) => facts[x]) ? (rng.chance(0.5) ? 1 : 0) : 0;
    if (mood === 'honest') return real.length && real.every((x) => facts[x]) ? 2 : 0;
    if (mood === 'proud' && topics.includes('paint')) return hasPaint ? (rng.chance(0.15) ? 1 : 0) : 2;
    if (mood === 'proud' && (topics.includes('accident') || topics.includes('najm'))) return t.najm === 0 ? 2 : (rng.chance(0.15) ? 1 : 0);
    if (real.length === 0) return 1;
    return real.every((x) => facts[x]) ? 2 : 0;
  };
  const scored = SELLER_LINES.map((l) => [l.t, fits(l.g)] as const).filter(([t, sc]) => sc > 0 && !used.has(t));
  const out: string[] = [];
  const top = scored.filter(([, sc]) => sc === 3);
  if (top.length) out.push(rng.pick(top)[0]);
  const good = rng.shuffle(scored.filter(([, sc]) => sc === 2).map(([x]) => x));
  for (const x of good) {
    if (out.length >= 2) break;
    if (!out.includes(x)) out.push(x);
  }
  // a line from the old pool keyed to seller type keeps gov/insurance/rental lots honest
  const own = SELLER[b.seller];
  if (own && out.length < 3 && (b.seller !== 'owner' && b.seller !== 'showroom')) out.push(rng.pick(own));
  if (m.perks.length && out.length < 3 && rng.chance(0.7)) out.push(rng.pick(m.perks));
  if (out.length < 2) {
    const filler = scored.filter(([, sc]) => sc === 1).map(([x]) => x);
    if (filler.length) out.push(rng.pick(filler));
  }
  if (!out.length) out.push(rng.pick(SELLER.urgent));
  const final = [...new Set(out)].slice(0, 3);
  for (const x of final) used.add(x);
  return final;
}

function estimateFor(rng: Rng, v: number, mode: SaleMode): [number, number] {
  const center = v * Math.max(0.9, Math.min(1.1, rng.normal(1, 0.055)));
  const w = 0.07 + (mode === 'asis' ? 0.04 : 0);
  const lo = center * (1 - w);
  const hi = center * (1 + w);
  const step = increment(center);
  return [Math.max(step, Math.floor(lo / step) * step), Math.ceil(hi / step) * step];
}

/**
 * The night's lots. Every lot is a different real ad from the chosen market, with its own photos.
 * `seen` holds the ads the phones in the room were shown on earlier nights (rank 0 = most recent):
 * those never come back while the market still has fresh ones, and when it runs dry the ones seen
 * longest ago return first. A model shows up once a night when the market is wide; a narrow market
 * (giants, supercars) may show two different ads of one model, never back to back.
 */
export function buildDeck(
  seed: number, settings: Settings, catalogue: CarModel[], players: number, total: number,
  seen: Map<string, number> | Set<string> = new Map(),
): LotFull[] {
  const rng = new Rng(seed);
  const budget = settings.budget;
  const perSlot = budget / Math.max(1, settings.garage);
  const market = marketOf(settings.mix);
  const order: Bucket[] = ['cheap', 'low', 'mid', 'high', 'dream'];
  const rank = (key: string): number | undefined => (seen instanceof Map ? seen.get(key) : seen.has(key) ? 0 : undefined);

  // every candidate is one real ad with photos; a model without an ad never comes up
  type Cand = { m: CarModel; ad: AdSet; key: string; fam: string; b: Bucket; seenRank: number | undefined; extra?: boolean };
  const byKey = new Map<string, Cand>();
  for (const m of catalogue) {
    if (!market.test(m)) continue;
    const fam = `${m.makeEn}|${m.modelEn}`;
    for (const ad of PHOTOS[m.id] ?? []) {
      if (ad.imgs.length < 3 || byKey.has(ad.key)) continue;
      const b = bucketOf(ad.value ?? m.value, perSlot, budget);
      if (b) byKey.set(ad.key, { m, ad, key: ad.key, fam, b, seenRank: rank(ad.key) });
    }
  }
  const cands = [...byKey.values()];

  // how many lots the market can fill without an ad anyone here has seen
  const famSize = (list: Cand[]) => {
    const n = new Map<string, number>();
    for (const c of list) n.set(c.fam, (n.get(c.fam) ?? 0) + 1);
    return [...n.values()];
  };
  const room = (list: Cand[], cap: number) => famSize(list).reduce((n, k) => n + Math.min(cap, k), 0);
  const fresh = cands.filter((c) => c.seenRank === undefined);
  let famCap = 1;
  while (famCap < 3 && room(fresh, famCap) < total) famCap++;
  let pool = fresh;
  let count = Math.min(total, room(fresh, famCap));
  const floor = Math.min(total, 12);
  if (count < floor && market.id !== 'balanced') {
    // this group has used the themed market up: fill the night with fresh ads of the same kind
    // (same tier and body) from the rest of the market before anything they've seen comes back
    const kinds = new Set(cands.map((c) => `${c.m.tier}|${c.m.body}`));
    const extra: Cand[] = [];
    for (const m of catalogue) {
      if (market.test(m) || !kinds.has(`${m.tier}|${m.body}`)) continue;
      const fam = `${m.makeEn}|${m.modelEn}`;
      for (const ad of PHOTOS[m.id] ?? []) {
        if (ad.imgs.length < 3 || byKey.has(ad.key) || rank(ad.key) !== undefined) continue;
        const b = bucketOf(ad.value ?? m.value, perSlot, budget);
        if (b) extra.push({ m, ad, key: ad.key, fam, b, seenRank: undefined, extra: true });
      }
    }
    pool = [...fresh, ...rng.shuffle(extra)];
    count = Math.min(total, room(pool, famCap));
  }
  if (count < Math.min(total, 8)) {
    // nearly everything here has been seen: bring back the ads seen longest ago
    const stale = cands.filter((c) => c.seenRank !== undefined).sort((a, b) => (b.seenRank ?? 0) - (a.seenRank ?? 0));
    pool = [...pool, ...stale.slice(0, Math.max((Math.min(total, 8) - count) * 3, 12))];
    count = Math.min(total, room(pool, famCap));
  }
  if (count <= 0) return [];

  // decide the kind of each lot
  const kinds: LotKind[] = Array.from({ length: count }, () => 'open' as LotKind);
  const slots = rng.shuffle(Array.from({ length: Math.max(0, count - 2) }, (_, i) => i + 1));
  let k = 0;
  if (settings.covered) for (let i = 0; i < Math.max(1, Math.round(count * 0.1)) && k < slots.length; i++) kinds[slots[k++]] = 'covered';
  if (settings.sealed) for (let i = 0; i < Math.max(1, Math.round(count * 0.09)) && k < slots.length; i++) kinds[slots[k++]] = 'sealed';
  // المزاد الهولندي: about one lot in ten, never one of the first two
  if (settings.dutch !== false) {
    const want = Math.max(1, Math.round(count * 0.1));
    for (let i = k, n = 0; i < slots.length && n < want; i++) if (slots[i] >= 2) { kinds[slots[i]] = 'dutch'; n++; }
  }
  // test hook: ?dutch=force on the host's page puts dutch lots at #2 and #3
  if (typeof location !== 'undefined' && /[?&]dutch=force/.test(location.search)) for (const i of [1, 2]) if (i < count) kinds[i] = 'dutch';

  const famCount = new Map<string, number>();
  const usedKey = new Set<string>();
  const recent: string[] = [];
  const tierCount = new Map<Tier, number>();
  // strictest first: a model not shown tonight; then another ad of one shown, but not within three lots
  const passes: ((c: Cand) => boolean)[] = [
    (c) => !famCount.has(c.fam),
    (c) => (famCount.get(c.fam) ?? 0) < famCap && !recent.includes(c.fam),
    (c) => (famCount.get(c.fam) ?? 0) < famCap,
  ];
  const pick = (bucket: Bucket): Cand | null => {
    const idx = order.indexOf(bucket);
    for (const ok of passes) {
      for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        const bk = order[idx + off];
        if (!bk) continue;
        const live = pool.filter((c) => c.b === bk && !usedKey.has(c.key) && ok(c));
        if (!live.length) continue;
        // one weight per model, so a model with five ads isn't five times as likely
        const perFam = new Map<string, number>();
        for (const c of live) perFam.set(c.fam, (perFam.get(c.fam) ?? 0) + 1);
        const weights = live.map((c) => {
          const tc = tierCount.get(c.m.tier) ?? 0;
          const pop = c.m.pop === 'high' ? 1.4 : c.m.pop === 'medium' ? 1 : 0.75;
          // a fresh ad always beats one this room saw before
          const stale = c.seenRank === undefined ? 1 : 0.05;
          // the chosen market's own cars first; look-alikes from the wider market fill in
          const own = c.extra ? 0.3 : 1;
          return [c, (pop * stale * own) / (1 + tc * 0.6) / perFam.get(c.fam)!] as const;
        });
        return rng.weighted(weights);
      }
    }
    return null;
  };

  const deck: LotFull[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    const kind = kinds[i];
    let bucket: Bucket = rng.weighted(order.map((b) => [b, SPREAD[b]] as const));
    if (i === 0) bucket = rng.pick(['low', 'mid'] as Bucket[]);
    if (i === count - 1) bucket = rng.pick(['high', 'dream'] as Bucket[]);
    if (kind === 'covered') bucket = rng.weighted([['cheap', 0.34], ['low', 0.26], ['mid', 0.2], ['high', 0.14], ['dream', 0.06]] as const);
    const c = pick(bucket);
    if (!c) break;
    famCount.set(c.fam, (famCount.get(c.fam) ?? 0) + 1);
    usedKey.add(c.key);
    recent.push(c.fam);
    if (recent.length > 3) recent.shift();
    tierCount.set(c.m.tier, (tierCount.get(c.m.tier) ?? 0) + 1);
    deck.push(makeLot(rng, c.m, kind, i + 1, settings, c.ad, used));
  }
  rememberNight();
  return deck;
}

/** How many different real ads the market has for this budget (the most lots a night can hold). */
export function marketDepth(settings: Settings, catalogue: CarModel[]): number {
  const market = marketOf(settings.mix);
  const perSlot = settings.budget / Math.max(1, settings.garage);
  const keys = new Set<string>();
  for (const m of catalogue) {
    if (!market.test(m)) continue;
    for (const a of PHOTOS[m.id] ?? []) if (a.imgs.length >= 3 && bucketOf(a.value ?? m.value, perSlot, settings.budget)) keys.add(a.key);
  }
  return keys.size;
}

export function makeLot(
  rng: Rng, m: CarModel, kind: LotKind, no: number, settings: Settings, ad: AdSet | null = null, used: Set<string> = new Set(),
): LotFull {
  // a plate never costs more than half a player's money: the lot must stay biddable
  const b = buildCar(rng, m, ad, used, settings.budget * 0.5);
  const age = Math.max(0, NOW_YEAR - m.year);
  const rolled = rollSurprise(rng, { m, car: b.car, value: b.value, mode: b.mode, seller: b.seller, age }, kind === 'covered');
  const surprise = rolled.surprise;
  if (surprise) applySurprise(b.truth, surprise);
  if (rolled.tell && !used.has(rolled.tell)) {
    used.add(rolled.tell);
    b.car.inspector = [...b.car.inspector, rolled.tell];
    b.truth.inspector = [...b.truth.inspector, rolled.tell];
  }
  // the دلال's file and the inspector's readings, drawn after the surprise so the tells can follow it
  const sctx = { car: b.car, truth: b.truth, seller: b.seller, surprise, nowYear: NOW_YEAR, asis: b.mode === 'asis' };
  const story = storyFor(rng, sctx, used);
  const checks = checksFor(rng, sctx);
  b.car.story = story;
  b.car.checks = checks;
  b.truth.story = story;
  b.truth.checks = checks;
  const v = b.value;
  let opening: number;
  if (kind === 'covered') {
    const base = settings.budget / Math.max(1, settings.garage);
    opening = roundToStep(base * rng.range(0.08, 0.16));
  } else if (kind === 'sealed') {
    opening = roundToStep(v * rng.range(0.38, 0.55));
  } else {
    opening = roundToStep(v * rng.range(0.42, 0.66));
  }
  opening = Math.max(500, opening);
  const estimate = settings.estimate && kind !== 'covered' ? estimateFor(rng, v, b.mode) : null;
  // dutch: the price falls from above the estimate to well under it
  const dutch = kind === 'dutch' ? dutchPlan(estimate ?? [roundToStep(v * 0.88), roundToStep(v * 1.12)], settings.speed) : undefined;
  if (dutch) opening = dutch.start;
  // hidden reserve (الحد): roughly half the open lots carry one, set below true value
  const reservePrice = kind === 'open' && rng.chance(0.52) ? roundToStep(v * rng.range(0.72, 0.92)) : null;
  const notes = sellerNotes(rng, m, b, rolled.cover).map((t) => fill(t, { city: b.car.city }));
  const id = `L${no}-${m.id}`.slice(0, 48);
  const cover =
    kind === 'covered'
      ? {
          body: m.body as Body,
          yearFrom: m.year - rng.int(1, 4),
          yearTo: Math.min(NOW_YEAR, m.year + rng.int(1, 4)),
          hints: coverHints(rng, b),
          photo: b.car.photos?.[0],
        }
      : undefined;
  return {
    id,
    no,
    kind,
    reserve: reservePrice != null,
    relist: 0,
    fee: feeRuleFor(b.seller, settings),
    grade: kind === 'covered' || b.mode === 'asis' ? null : gradeOf(b.car),
    mode: kind === 'covered' ? 'asis' : b.mode,
    seller: b.seller,
    car: kind === 'covered' ? null : b.car,
    cover,
    title: titleOf({ ...m, trim: b.car.trim }),
    adKey: ad?.key ?? m.id,
    notes: kind === 'covered' ? ['الغطا ما ينشال إلا بعد البيع'] : notes,
    estimate,
    opening,
    ...(dutch ? { dutch } : {}),
    carFull: b.truth,
    base: v,
    reservePrice,
    surprise,
    tags: b.tags,
    comps: m.comps?.slice(0, 3),
  };
}

function coverHints(rng: Rng, b: Built): string[] {
  const c = b.car;
  const pool = [
    c.km > 200_000 ? 'الممشى فوق 200 ألف' : c.km < 60_000 ? 'الممشى تحت 60 ألف' : 'الممشى بين 60 و200 ألف',
    `المواصفات: ${c.specKind === 'saudi' ? 'سعودي' : c.specKind === 'gcc' ? 'خليجي' : 'وارد'}`,
    `اللون: ${c.color}`,
    c.fuel === 'diesel' ? 'ديزل' : c.fuel === 'hybrid' ? 'هايبرد' : c.fuel === 'ev' ? 'كهرباء' : 'بنزين',
    c.drive === '4WD' || c.drive === 'AWD' ? 'دفع رباعي' : 'دفع ثنائي',
    `من ${c.city}`,
    c.runs === 'drive' ? 'تمشي' : 'ما تمشي',
  ];
  return rng.sample(pool, 3);
}
