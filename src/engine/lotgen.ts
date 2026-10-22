// Builds the night's deck: real models from the catalogue, each turned into one specific
// car with its own mileage, paint, accident history, papers, seller and hidden surprise.
import { Rng } from '../lib/rng';

import { SELLER, fill } from './lines';
import { SELLER_LINES } from './realism_lines';
import { historyFor, micronsFor, rollSurprise, scanFor } from './realism';
import { TRANSFER_FEE, increment, roundToStep } from './rules';
import { PHOTOS } from '../data/photos';
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

export function makePlate(rng: Rng, m: CarModel): PlatePub {
  const pick3 = () => [rng.pick(PLATE_LETTERS), rng.pick(PLATE_LETTERS), rng.pick(PLATE_LETTERS)];
  const same3 = () => {
    const l = rng.pick(PLATE_LETTERS);
    return [l, l, l];
  };
  const d = () => String(rng.int(1, 9));
  const posh = m.tier === 'luxury' || m.tier === 'exotic' || m.tier === 'sport';
  const roll = rng.next();
  const k = posh ? 2.6 : 1;
  const round = (v: number, step: number) => Math.round(v / step) * step;
  if (roll < 0.008 * k) {
    const num = rng.chance(0.5) ? d() : d().repeat(2);
    const letters = rng.chance(0.6) ? same3() : [rng.pick(PLATE_LETTERS)];
    return plateOf(letters, num, { tier: 'rare', label: 'لوحة نادرة', value: round(rng.range(180_000, 900_000), 10_000) });
  }
  if (roll < 0.033 * k) {
    const x = d();
    const num = rng.chance(0.5) ? x.repeat(3) : x.repeat(4);
    const letters = rng.chance(0.45) ? same3() : pick3();
    return plateOf(letters, num, { tier: 'top', label: 'لوحة مميزة جداً', value: round(rng.range(35_000, 160_000), 1_000) });
  }
  if (roll < 0.075 * k) {
    const num = rng.pick(['1000', '2000', '3000', '5000', '2030', '1234', '9000', '7000', '1400', '1447']);
    return plateOf(pick3(), num, { tier: 'special', label: 'لوحة مميزة', value: round(rng.range(9_000, 45_000), 500) });
  }
  if (roll < 0.12 * k) {
    const a = d();
    const b = d();
    const num = rng.chance(0.5) ? `${a}${b}${a}${b}` : String(rng.int(1000, 9999));
    const letters = num.length === 4 && num[0] === num[2] ? pick3() : same3();
    return plateOf(letters, num, { tier: 'nice', label: 'لوحة حلوة', value: round(rng.range(3_000, 14_000), 500) });
  }
  const num = rng.chance(0.85) ? String(rng.int(1000, 9999)) : String(rng.int(100, 999));
  return plateOf(pick3(), num);
}

const AD_COLORS: [RegExp, string][] = [
  [/لؤلؤ|لولو|بيرل/, 'أبيض لؤلؤي'], [/ابيض|أبيض/, 'أبيض'], [/فضي|سلفر/, 'فضي'], [/رصاصي|رمادي|جراي|سكني/, 'رصاصي'],
  [/اسود|أسود/, 'أسود'], [/شمباني|ذهبي/, 'شمباني'], [/بيج/, 'بيج'], [/عنابي|ماروني|خمري/, 'عنابي'], [/كحلي/, 'كحلي'],
  [/احمر|أحمر/, 'أحمر'], [/ازرق|أزرق/, 'أزرق'], [/زيتي|اخضر|أخضر/, 'أخضر زيتي'], [/بني/, 'بني'], [/برتقالي/, 'برتقالي'], [/اصفر|أصفر/, 'أصفر'],
];

/** What a real ad says about the body: seller words win over dice. */
function adCondition(text: string): CondClass | null {
  const t = text.replace(/[ًٌٍَُِّْـ]/g, '');
  const no = (re: RegExp) => !re.test(t);
  if (/تشليح|للتشليح|محترق|محترقه|غرقان|غرقانه|سيل/.test(t)) return 'wreck';
  if (/مقصوص|قص |قص$|قلبان|مقلوب|مصدوم|مصدومه|مصدومة|صدمه قويه|صدمة قوية/.test(t) && no(/بدون صدمات|ما فيها صدم|مافيها صدم|بدون حوادث|ما عليها حوادث/)) return 'major';
  if (/صدمه|صدمة|صدمات|خبطه|خبطة|ضربه|ضربة|حادث/.test(t) && no(/بدون صدمات|ما فيها صدم|مافيها صدم|بدون حوادث|ما عليها حوادث|بدون حادث|خالي من الحوادث/)) return 'hit';
  if (/رش|رشه|رشة|سمكر|معجون|رنج/.test(t) && no(/بدون رش|ما فيها رش|مافيها رش|ولا رشه|ولا رشة|بدون ولا رش|خالي من الرش/)) return 'painted';
  if (/وكاله|وكالة|بدون رش|ما فيها رش|مافيها رش|قمة النظافه|قمة النظافة|نظيف|نظيفه|نظيفة|مالك اول|مالك أول|بوية وكالة|صبغ وكالة/.test(t)) return 'clean';
  return null;
}

/** The seller's real sentences, minus phone numbers, prices and contact lines. */
function adLines(text: string): string[] {
  return text
    .replace(/(\+?966|0)?5\d{8}/g, '')
    .split(/[\n\r.!؟?]+|،\s|\s-\s|\s–\s|•|\*/)
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter((x) => x.length >= 8 && x.length <= 110)
    .filter((x) => !/ريال|الف|ألف|سعر|السوم|سوم|للتواصل|تواصل|واتس|جوال|اتصال|رقم|حراج|الموقع|المكان|خاص|@|http/.test(x))
    // the photos can be a neighbouring model-year: never quote a year that could contradict the lot
    .filter((x) => !/(^|[^\d])(19|20)\d{2}([^\d]|$)|موديل|ممشى|ممشاها|ماشي|كيلو|\sكم(\s|$)/.test(x))
    .slice(0, 3);
}

export function buildCar(rng: Rng, m: CarModel): Built {
  const age = ageOf(m);
  const tags: string[] = [];
  const doors: 2 | 4 = m.doors ?? (m.body === 'coupe' || m.body === 'convertible' ? 2 : m.body === 'pickup' && m.cab === 'single' ? 2 : 4);

  // mileage: log-normal around the model's typical figure
  let kmv: number;
  if (age === 0) kmv = rng.chance(0.4) ? rng.int(5, 60) * 100 : rng.int(30, 220) * 100;
  else kmv = m.km * Math.exp(rng.normal(0, 0.32));
  kmv = Math.max(age === 0 ? 300 : 4000, Math.min(m.km * 2.4, kmv));
  kmv = Math.round(kmv / 100) * 100;
  // a real ad for this model: its photos decide the colour, and its city/km when stated
  const ads = PHOTOS[m.id]?.filter((a) => a.imgs.length >= 3) ?? [];
  const ad = ads.length ? rng.pick(ads) : null;
  if (ad?.km && ad.km > 500 && ad.km < Math.max(m.km, 20_000) * 3 && ad.km > m.km * 0.15) kmv = Math.round(ad.km / 100) * 100;
  const ratio = m.km > 0 ? kmv / m.km : 1;
  const kmTag = ratio < 0.55 && age > 1 ? 'low' : ratio > 1.5 ? 'high' : undefined;

  const specKind = pickSpec(rng, m);
  const adSays = ad ? `${ad.title ?? ''} ${ad.text ?? ''}` : '';
  const fromAd = adSays ? adCondition(adSays) : null;
  // a "clean" ad is usually right, sometimes a little generous
  const cls: CondClass = fromAd ? (fromAd === 'clean' && rng.chance(0.2) ? 'touched' : fromAd) : pickCondition(rng, m, specKind);
  const body = buildPanels(rng, cls, doors);

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
  let mode: SaleMode = rng.chance(0.78) ? 'inspected' : 'asis';
  if (seller === 'gov' || seller === 'insurance') mode = rng.chance(0.75) ? 'asis' : 'inspected';
  if (runs === 'dead') mode = 'asis';
  if (seller === 'rental' && kmv < m.km * 1.15) kmv = Math.round((m.km * rng.range(1.15, 1.6)) / 100) * 100;

  const colorPool = m.colors.filter((c) => COLORS[c]);
  let color =
    colorPool.length && rng.chance(0.75)
      ? rng.pick(colorPool)
      : rng.weighted(Object.entries(COLORS).map(([k, v]) => [k, v.w] as const));
  if (ad) {
    const said = `${ad.color ?? ''} ${ad.title ?? ''}`;
    const hit = AD_COLORS.find(([re]) => re.test(said));
    color = hit ? hit[1] : 'حسب الصور';
  }
  const colorHex = COLORS[color]?.hex ?? '#C9CCC8';
  const interior = m.tier === 'sport' && rng.chance(0.3) ? 'أحمر' : rng.pick(INTERIORS.slice(0, 4));
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
  const extras = rng.sample(FEATURES[m.tier] ?? FEATURES.daily, rng.int(2, 4));
  const modsPicked = rng.chance(0.55) ? rng.sample(MODS, rng.int(1, 2)) : [];
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
  let v = m.value;
  if (ratio < 1) v *= 1 + Math.min(0.1, (1 - ratio) * 0.14);
  else v *= 1 - Math.min(0.32, (ratio - 1) * 0.16);
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
  const plate = makePlate(rng, m);
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
  if (mode === 'asis') notes.push('فحص خارجي فقط، العيوب الخفية ما تنضمن');
  if (mech.engine === 'minor') notes.push(rng.pick(['تهريب زيت خفيف من غطا البلوف', 'تكتكة خفيفة وهي باردة']));
  if (mech.engine === 'major') notes.push('دخان أزرق مع الدعسة');
  if (mech.gearbox === 'minor') notes.push('نتعة خفيفة بين الأول والثاني');
  if (mech.gearbox === 'major') notes.push('تأخير تعشيق واضح');
  if (mech.susp === 'minor') notes.push('صوت جلب من قدام');
  if (mech.ac === 'weak') notes.push('المكيف يبرد على خفيف');
  if (body.chassis === 'repaired') notes.push('أثر لحام على القائمة الأمامية');
  if (cls === 'clean' && service === 'dealer' && rng.chance(0.6)) notes.push('السيارة بحالة وكالة');
  // the model's own known weak spots, as a Saudi inspector would flag them
  if (m.issues.length && rng.chance(cls === 'clean' ? 0.3 : 0.6)) notes.push(rng.pick(m.issues));
  const regType = m.body === 'pickup' || m.body === 'van' ? 'نقل خاص' : 'خصوصي';

  const car: CarPub = {
    modelId: m.id,
    makeAr: m.makeAr,
    makeEn: m.makeEn,
    modelAr: m.modelAr,
    modelEn: m.modelEn,
    nick: m.nick,
    trim: m.trim,
    trimAr: m.trimAr,
    year: m.year,
    body: m.body,
    engine: m.engine,
    hp: m.hp,
    fuel: m.fuel,
    drive: m.drive,
    trans: m.trans,
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
    adTitle: ad?.title,
    adUrl: ad?.url,
  };
  const truth: CarPub = { ...car, panels: body.panels, mech, microns: truthMicrons, inspector: notes };
  truth.scan = scanFor(rng, truth);
  truth.history = historyFor(rng, truth, NOW_YEAR);
  car.scan = mode === 'asis' ? { status: 'none', codes: [] } : truth.scan;
  car.history = truth.history;
  return { car, truth, value: v, tags, mode, seller, adText: ad?.text ?? undefined };
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
const MIX: Record<Settings['mix'], Record<Bucket, number>> = {
  balanced: { cheap: 0.17, low: 0.25, mid: 0.3, high: 0.2, dream: 0.08 },
  luxury: { cheap: 0.07, low: 0.13, mid: 0.27, high: 0.33, dream: 0.2 },
  street: { cheap: 0.32, low: 0.33, mid: 0.23, high: 0.1, dream: 0.02 },
};

function bucketOf(value: number, perSlot: number, budget: number): Bucket | null {
  if (value > budget * 0.92) return null;
  const r = value / perSlot;
  if (r < 0.12) return 'cheap';
  if (r < 0.45) return 'low';
  if (r < 1.1) return 'mid';
  if (r < 2.4) return 'high';
  return 'dream';
}

export function titleOf(c: { makeAr: string; modelAr: string; trim: string; nick?: string }) {
  return `${c.makeAr} ${c.modelAr} ${c.trim}`.trim();
}

const TOP_TRIM = /فل|Limited|Platinum|VXR|VX|Denali|High Country|Ultra|LE|GLX|Titanium|Prestige|Signature/i;
const FILLER = new Set(['urgency', 'sentimental', 'negotiation', 'haraj', 'interior', 'cliche', 'condition']);

/** Pick 2–3 ad lines that match what this car really is — or what its seller wants you to believe. */
function sellerNotes(rng: Rng, m: CarModel, b: Built, cover: string | null): string[] {
  // a real ad speaks for itself; a hidden problem may still get its cover line
  if (b.adText) {
    const real = adLines(b.adText);
    if (real.length) {
      if (cover) {
        const hit = SELLER_LINES.filter((l) => l.g.includes(cover) && ['shady', 'proud', 'funny'].includes(l.g[0]));
        if (hit.length) real.push(rng.pick(hit).t);
      }
      return real.slice(0, 4);
    }
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
  const scored = SELLER_LINES.map((l) => [l.t, fits(l.g)] as const).filter(([, sc]) => sc > 0);
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
  return [...new Set(out)].slice(0, 3);
}

function estimateFor(rng: Rng, v: number, mode: SaleMode): [number, number] {
  const center = v * Math.max(0.9, Math.min(1.1, rng.normal(1, 0.055)));
  const w = 0.07 + (mode === 'asis' ? 0.04 : 0);
  const lo = center * (1 - w);
  const hi = center * (1 + w);
  const step = increment(center);
  return [Math.max(step, Math.floor(lo / step) * step), Math.ceil(hi / step) * step];
}

export function buildDeck(seed: number, settings: Settings, catalogue: CarModel[], players: number, total: number): LotFull[] {
  const rng = new Rng(seed);
  const budget = settings.budget;
  const perSlot = budget / Math.max(1, settings.garage);
  const byBucket: Record<Bucket, CarModel[]> = { cheap: [], low: [], mid: [], high: [], dream: [] };
  for (const m of catalogue) {
    const b = bucketOf(m.value, perSlot, budget);
    if (b) byBucket[b].push(m);
  }
  const order: Bucket[] = ['cheap', 'low', 'mid', 'high', 'dream'];
  const mix = MIX[settings.mix];

  // decide the kind of each lot
  const kinds: LotKind[] = Array.from({ length: total }, () => 'open' as LotKind);
  const slots = rng.shuffle(Array.from({ length: Math.max(0, total - 2) }, (_, i) => i + 1));
  let k = 0;
  if (settings.covered) for (let i = 0; i < Math.max(1, Math.round(total * 0.1)); i++) kinds[slots[k++]] = 'covered';
  if (settings.sealed) for (let i = 0; i < Math.max(1, Math.round(total * 0.09)); i++) kinds[slots[k++]] = 'sealed';

  // One car per model family a night, and only cars with a real ad behind them (photos, seller text).
  // The rules relax step by step only if the catalogue runs dry for a budget band.
  const usedFam = new Set<string>();
  const usedId = new Set<string>();
  const tierCount = new Map<Tier, number>();
  const famKey = (m: CarModel) => `${m.makeEn}|${m.modelEn}`;
  const hasPics = (m: CarModel) => !!PHOTOS[m.id]?.some((a) => a.imgs.length >= 3);
  const passes: ((m: CarModel) => boolean)[] = [
    (m) => hasPics(m) && !usedFam.has(famKey(m)),
    (m) => !usedFam.has(famKey(m)),
    (m) => !usedId.has(m.id),
  ];
  const pickFrom = (bucket: Bucket): CarModel | null => {
    const idx = order.indexOf(bucket);
    for (const ok of passes) {
      for (const off of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
        const bk = order[idx + off];
        if (!bk) continue;
        const pool = byBucket[bk].filter(ok);
        if (!pool.length) continue;
        const weights = pool.map((m) => {
          const tc = tierCount.get(m.tier) ?? 0;
          const pop = m.pop === 'high' ? 1.4 : m.pop === 'medium' ? 1 : 0.7;
          return [m, pop / (1 + tc * 0.9)] as const;
        });
        return rng.weighted(weights);
      }
    }
    return null;
  };

  const deck: LotFull[] = [];
  for (let i = 0; i < total; i++) {
    const kind = kinds[i];
    let bucket: Bucket = rng.weighted(order.map((b) => [b, mix[b]] as const));
    if (i === 0) bucket = rng.pick(['low', 'mid'] as Bucket[]);
    if (i === total - 1) bucket = rng.pick(['high', 'dream'] as Bucket[]);
    if (kind === 'covered') bucket = rng.weighted([['cheap', 0.34], ['low', 0.26], ['mid', 0.2], ['high', 0.14], ['dream', 0.06]] as const);
    const m = pickFrom(bucket);
    if (!m) break;
    usedFam.add(famKey(m));
    usedId.add(m.id);
    tierCount.set(m.tier, (tierCount.get(m.tier) ?? 0) + 1);
    deck.push(makeLot(rng, m, kind, i + 1, settings));
  }
  return deck;
}

export function makeLot(rng: Rng, m: CarModel, kind: LotKind, no: number, settings: Settings): LotFull {
  const b = buildCar(rng, m);
  const age = Math.max(0, NOW_YEAR - m.year);
  const rolled = rollSurprise(rng, { m, car: b.car, value: b.value, mode: b.mode, seller: b.seller, age }, kind === 'covered');
  const surprise = rolled.surprise;
  if (surprise) applySurprise(b.truth, surprise);
  if (rolled.tell) {
    b.car.inspector = [...b.car.inspector, rolled.tell];
    b.truth.inspector = [...b.truth.inspector, rolled.tell];
  }
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
    title: titleOf(m),
    notes: kind === 'covered' ? ['الغطا ما ينشال إلا بعد البيع'] : notes,
    estimate,
    opening,
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
