// Hidden surprises and inspection read-outs, tuned from the Saudi market research.
// Effects: "pct" is a fraction of the car's value, "sar" a fixed riyal amount (scaled by class).
import type { Rng } from '../lib/rng';
import { arDigits, money } from '../lib/util';
import type { CarModel, CarPub, PanelStatus, SaleMode, Seller, Surprise } from './types';

export interface SurpriseCtx {
  m: CarModel;
  car: CarPub;
  value: number;
  mode: SaleMode;
  seller: Seller;
  age: number;
}

interface Def {
  id: string;
  good: boolean;
  w: number;
  fits: (c: SurpriseCtx) => boolean;
  effect: (c: SurpriseCtx, rng: Rng) => number;
  text: (c: SurpriseCtx, rng: Rng, delta: number) => string;
  tells?: string[];
  /** a seller line tag that "covers" for this defect (the shady tell in the ad) */
  cover?: string;
}

const COASTAL = new Set(['جدة', 'الدمام', 'الخبر', 'جازان', 'الجبيل', 'ينبع']);
const pct = (min: number, max: number) => (c: SurpriseCtx, rng: Rng) => Math.round(c.value * rng.range(min, max));
const classScale = (c: SurpriseCtx) =>
  c.m.tier === 'exotic' ? 6 : c.m.tier === 'luxury' || c.m.tier === 'sport' ? 2.6 : c.m.tier === 'family' || c.m.tier === 'work' ? 1.4 : 1;
const sar = (min: number, max: number, capPct = 0.3) => (c: SurpriseCtx, rng: Rng) => {
  const v = rng.range(min, max) * classScale(c);
  return Math.round(Math.min(v, c.value * capPct) / 100) * 100;
};
const neg = (f: (c: SurpriseCtx, rng: Rng) => number) => (c: SurpriseCtx, rng: Rng) => -Math.abs(f(c, rng));
const isUS = (c: SurpriseCtx) => c.car.specKind === 'us' || c.car.specKind === 'ca';
const offroad = (c: SurpriseCtx) => c.car.drive === '4WD' || c.m.body === 'pickup';
const taxiish = new Set(['Camry', 'Sonata', 'Accent', 'Elantra', 'Taurus', 'Corolla', 'Altima', 'Sunny', 'Optima', 'K5', 'Malibu']);

const DEFS: Def[] = [
  // ---------------------------------------------------------------- bad
  {
    id: 'flood', good: false, w: 2,
    fits: (c) => COASTAL.has(c.car.city) || c.car.specKind === 'us_salvage',
    effect: neg(pct(0.28, 0.45)),
    text: () => 'طلعت غرقانة في السيول، تحت السجاد طين والكهرباء كلها تعبانة',
    tells: ['ريحة رطوبة داخل السيارة', 'صدا على براغي الكراسي', 'سجاد جديد في سيارة قديمة', 'أعطال كهرباء تروح وترجع'],
    cover: 'flood',
  },
  {
    id: 'odometer', good: false, w: 5,
    fits: (c) => c.age >= 4 && c.car.km > 60_000,
    effect: neg(pct(0.12, 0.22)),
    text: (c, rng) => `العداد مرجّع، الممشى الحقيقي ${money(c.car.km + rng.int(8, 20) * 10_000)} كم`,
    tells: ['الدركسون والدواسات مهترية بزيادة', 'قراءة موجز السابقة أعلى من العداد', 'آثار فك حول الطبلون'],
    cover: 'history',
  },
  {
    id: 'miles', good: false, w: 4,
    fits: isUS,
    effect: neg(pct(0.08, 0.14)),
    text: (c) => {
      const mi = Math.round(c.car.km / 1000);
      return `طلع العداد بالميل مو بالكيلو، ${arDigits(mi)} ألف ميل يعني ${arDigits(Math.round(mi * 1.609))} ألف كم`;
    },
    tells: ['العداد فيه علامة MPH', 'شاشة الحرارة بالفهرنهايت'],
  },
  {
    id: 'chassis', good: false, w: 2,
    fits: (c) => c.car.mech.chassis === 'ok' || c.car.mech.chassis === 'unknown',
    effect: neg(pct(0.22, 0.34)),
    text: () => 'الشاصي الأمامي مسحوب وملحوم، الفاحص قال: اهرب',
    tells: ['فتحات الكبوت مو متساوية', 'رش على القوائم', 'الكفرات تاكل من جهة وحدة'],
  },
  {
    id: 'airbags', good: false, w: 2,
    fits: (c) => c.car.mech.airbags !== 'deployed',
    effect: neg(pct(0.14, 0.24)),
    text: () => 'الإيرباقات فاتحة من قبل ومركّب غطاء طبلون تقليد، ولمبتها مطفية بالبرمجة',
    tells: ['كود B0001 مخزن بالكمبيوتر', 'لون الطبلون مختلف شوي', 'أحزمة جديدة في سيارة قديمة'],
    cover: 'airbag',
  },
  {
    id: 'gearbox', good: false, w: 9,
    fits: (c) => c.car.trans !== 'EV' && c.m.fuel !== 'ev',
    effect: neg(sar(3000, 15000, 0.25)),
    text: (_c, _r, d) => `القير يفصّل بين الثالث والرابع، يبي له قير بـ ${money(-d)} ريال`,
    tells: ['نتعة وهي باردة', 'كود P0741 مخزن', 'زيت القير غامق وريحته محروقة'],
    cover: 'gearbox',
  },
  {
    id: 'oil', good: false, w: 8,
    fits: (c) => c.m.fuel !== 'ev' && c.age >= 3,
    effect: neg(sar(4000, 12000, 0.25)),
    text: (_c, _r, d) => `المكينة تاكل زيت، لتر كل ألف كيلو ودخان أزرق، التوضيب ${money(-d)} ريال`,
    tells: ['دخان خفيف أول التشغيل', 'كود P0300 مخزن', 'البواجي مزيّتة'],
    cover: 'engine',
  },
  {
    id: 'ac', good: false, w: 7,
    fits: (c) => c.car.mech.ac !== 'broken',
    effect: neg(sar(1000, 5000, 0.12)),
    text: () => 'المكيف يطلع هوا حار في عز شهر 8، الكمبروسر خربان',
    tells: ['حرارة المخرج فوق 15 درجة', 'طقطقة مع تشغيل المكيف'],
    cover: 'ac',
  },
  {
    id: 'salvage', good: false, w: 3,
    fits: (c) => c.car.specKind === 'us',
    effect: neg(pct(0.2, 0.3)),
    text: () => 'طلعت وارد مزاد سلفج، الكارفاكس يقول مصدومة صدمة قوية قبل الشحن',
    tells: ['إشارات خلفية حمراء', 'قطع كهرباء مو متوفرة بالوكالة'],
    cover: 'import',
  },
  {
    id: 'rental', good: false, w: 6,
    fits: (c) => c.seller !== 'rental' && (c.m.tier === 'daily' || c.m.tier === 'family') && c.age >= 2,
    effect: neg(pct(0.05, 0.12)),
    text: () => 'طلعت سيارة تأجير سابقة، مرّ عليها سواقين أكثر من ركاب باص',
    tells: ['تفاويض كثيرة في موجز', 'ستيكر شركة تحت الزجاج'],
  },
  {
    id: 'gov', good: false, w: 3,
    fits: (c) => c.seller !== 'gov' && c.age >= 4,
    effect: neg(pct(0.1, 0.15)),
    text: () => 'طلعت من مزاد حكومي، ساعات تشغيلها وهي واقفة تعادل نص عمرها',
    tells: ['فتحات بالسقف مسدودة', 'أسلاك زايدة تحت الطبلون'],
    cover: 'ex_government',
  },
  {
    id: 'taxi', good: false, w: 3,
    fits: (c) => taxiish.has(c.m.modelEn) && c.age >= 3,
    effect: neg(pct(0.2, 0.3)),
    text: () => 'كانت ليموزين، لوحتها كانت صفراء والممشى الحقيقي فلكي',
    tells: ['آثار لاصق على الأبواب', 'الفرش الخلفي مستهلك'],
  },
  {
    id: 'lien', good: false, w: 5,
    fits: (c) => c.age <= 6 && c.value > 25_000,
    effect: neg(sar(5000, 30000, 0.3)),
    text: (_c, _r, d) => `السيارة باسم البنك، باقي ${money(-d)} لازم تنسدد قبل ما تنتقل باسمك`,
  },
  {
    id: 'saher', good: false, w: 8,
    fits: () => true,
    effect: (c, rng) => -Math.round(rng.range(300, 6000) * (c.m.tier === 'sport' ? 1.8 : 1) / 100) * 100,
    text: (_c, _r, d) => `عليها مخالفات ساهر ${money(-d)} ريال، ولازم تنسدد قبل النقل`,
    cover: 'saher',
  },
  {
    id: 'catalyst', good: false, w: 3,
    fits: (c) => c.m.fuel === 'petrol' && c.age >= 5,
    effect: neg(sar(2000, 8000, 0.2)),
    text: () => 'الدبة مشلوعة ومركب بدالها بوري، ما بتعدّي الفحص الدوري',
    tells: ['كود P0420 مخزن', 'صوت العادم عالي'],
    cover: 'exhaust',
  },
  {
    id: 'rust', good: false, w: 4,
    fits: (c) => COASTAL.has(c.car.city) && c.age >= 5,
    effect: neg(pct(0.05, 0.12)),
    text: () => 'تحتها صدا من رطوبة الساحل، الأرضية والاقزوز تبي شغل',
    tells: ['صدا خفيف على العتبات'],
    cover: 'rust',
  },
  {
    id: 'desert', good: false, w: 4,
    fits: offroad,
    effect: neg(pct(0.05, 0.12)),
    text: () => 'طلعت مطعّسة، الرمل بكل زاوية والمقصات والجلب خلصانة',
    tells: ['رمل في فتحات الأبواب', 'كفرات طين ومرفوعة'],
    cover: 'kashta',
  },
  {
    id: 'trim', good: false, w: 4,
    fits: (c) => /فل|Limited|Platinum|VXR|Denali|LE|GLX/i.test(`${c.m.trim} ${c.m.trimAr ?? ''}`),
    effect: neg(pct(0.03, 0.07)),
    text: () => 'طلعت ستاندر مركبين لها كم إضافة، مو فل كامل مثل ما انكتب',
    cover: 'trim',
  },
  {
    id: 'najm', good: false, w: 8,
    fits: () => true,
    effect: neg(pct(0.06, 0.12)),
    text: () => 'سجل نجم فيه حادث ما انذكر بالإعلان، صدمة خلفية',
    tells: ['الصدام الخلفي لونه مختلف شوي'],
    cover: 'najm',
  },
  {
    id: 'nohistory', good: false, w: 4,
    fits: (c) => c.car.service !== 'none',
    effect: neg(pct(0.03, 0.05)),
    text: () => 'سجل الصيانة اللي بالإعلان طلع كلام، ولا فاتورة وحدة',
    cover: 'service',
  },
  {
    id: 'masked', good: false, w: 4,
    fits: (c) => c.m.fuel !== 'ev',
    effect: neg(sar(500, 6000, 0.15)),
    text: () => 'لمبة المكينة كانت مطفية بالبرمجة، والكمبيوتر فيه 4 أكواد',
    tells: ['الأكواد ممسوحة قريب والحساسات مو جاهزة'],
    cover: 'computer_scan',
  },
  {
    id: 'tyres_old', good: false, w: 5,
    fits: () => true,
    effect: neg(sar(1200, 3500, 0.1)),
    text: (c) => `الكفرات شكلها جديد بس صنع ${arDigits(c.car.tires - 4)}، مشققة من الشمس`,
  },
  {
    id: 'blocked', good: false, w: 0.25,
    fits: () => true,
    effect: (c) => -Math.round(c.value * 0.8),
    text: () => 'طلعت عليها حجز، لا تنتقل ولا تنباع، تنفع تشليح بس',
  },
  // ---------------------------------------------------------------- good
  {
    id: 'warranty', good: true, w: 6,
    fits: (c) => c.age <= 4 && !c.car.warranty,
    effect: pct(0.03, 0.06),
    text: () => 'مفاجأة، باقي عليها ضمان وكالة سنة ونص',
  },
  {
    id: 'freeservice', good: true, w: 5,
    fits: (c) => c.age <= 5,
    effect: sar(1000, 4000, 0.1),
    text: () => 'باقي لها 3 صيانات مجانية بالوكالة',
  },
  {
    id: 'plate', good: true, w: 3,
    // plates are on show now (CarPub.plate), so a "hidden" special plate can't happen
    fits: () => false,
    effect: (_c, rng) => {
      const r = rng.next();
      if (r < 0.006) return rng.int(10, 30) * 100_000; // legendary
      if (r < 0.25) return rng.int(60, 120) * 1000;
      return rng.int(10, 40) * 1000;
    },
    text: (_c, rng, d) => `اللوحة طلعت مميزة وما انتبه لها البائع: ${plateFor(rng, d)}`,
  },
  {
    id: 'rare', good: true, w: 3,
    fits: (c) => ['luxury', 'sport', 'classic', 'exotic'].includes(c.m.tier),
    effect: pct(0.06, 0.15),
    text: (_c, rng) => `طلعت إصدار خاص محدود، رقم ${arDigits(rng.int(12, 480))} من ${arDigits(rng.pick([500, 750, 999]))}`,
  },
  {
    id: 'history', good: true, w: 7,
    fits: (c) => c.car.service !== 'dealer',
    effect: pct(0.03, 0.05),
    text: () => 'سجل الصيانة كامل بالوكالة من أول يوم، والفواتير مرتبة',
  },
  {
    id: 'lowkm', good: true, w: 4,
    fits: (c) => c.car.km > 30_000,
    effect: pct(0.05, 0.1),
    text: () => 'الممشى مثبت بموجز وأقل من المكتوب، غلطة بالإعلان',
  },
  {
    id: 'spec', good: true, w: 3,
    fits: isUS,
    effect: pct(0.1, 0.15),
    text: () => 'طلعت سعودي وكالة مو وارد، أسهل بالبيع وأبرد بالصيف',
  },
  {
    id: 'ppf', good: true, w: 3,
    fits: (c) => c.age <= 6,
    effect: pct(0.01, 0.03),
    text: () => 'كانت مغلفة حماية من يومها، الصبغ تحتها جديد',
  },
  {
    id: 'wrap', good: true, w: 2,
    fits: (c) => ['أخضر زيتي', 'بني', 'برتقالي', 'أصفر', 'عنابي', 'كحلي'].includes(c.car.color),
    effect: pct(0.03, 0.06),
    text: () => 'تحت التغليف لون أبيض لؤلؤي وكالة',
  },
  {
    id: 'originals', good: true, w: 5,
    fits: (c) => c.car.extras.some((e) => /شاشة|جنوط|عادم/.test(e)),
    effect: sar(500, 3000, 0.08),
    text: () => 'الجنوط الأصلية والشاشة الأصلية موجودة بالشنطة',
  },
  {
    id: 'tyres_new', good: true, w: 6,
    fits: (c) => c.car.tires < 2026,
    effect: sar(1500, 3500, 0.1),
    text: () => 'الكفرات جديدة صنع 2026 والبطارية ما كملت شهر',
  },
  {
    id: 'gearbox_new', good: true, w: 3,
    fits: (c) => c.age >= 5,
    effect: pct(0.03, 0.06),
    text: () => 'القير مغيّر جديد من الوكالة قبل شهرين، والفاتورة معه',
  },
  {
    id: 'family', good: true, w: 5,
    fits: (c) => c.car.owners >= 2 && c.m.tier !== 'sport',
    effect: pct(0.01, 0.03),
    text: () => 'أول مالك فعلياً واستخدام عائلي، وموجز يؤكد',
  },
];

function plateFor(rng: Rng, delta: number): string {
  const L = ['ا', 'ب', 'ح', 'د', 'ر', 'س', 'ص', 'ط', 'ع', 'ق', 'ك', 'ل', 'م', 'ن', 'هـ', 'و', 'ى'];
  const l = rng.pick(L);
  const d = rng.int(1, 9);
  if (delta >= 1_000_000) return `${l} ${arDigits(d)}`;
  if (delta >= 60_000) return `${rng.pick(L)} ${rng.pick(L)} ${l} ${arDigits(d)}`;
  return `${l} ${rng.pick(L)} ${l} ${arDigits(`${d}${d}${d}${rng.chance(0.5) ? d : ''}`)}`;
}

export interface Rolled {
  surprise: Surprise | null;
  tell: string | null;
  cover: string | null;
}

/** Roll the hidden surprise for one car, plus an inspector tell that hints at it (or a false alarm). */
export function rollSurprise(rng: Rng, c: SurpriseCtx, coveredLot: boolean): Rolled {
  const p = coveredLot ? 0.4 : c.mode === 'asis' ? 0.45 : 0.2;
  if (!rng.chance(p)) {
    // false alarm: an inspector note that sounds bad but means nothing
    if (c.mode === 'inspected' && rng.chance(0.1)) {
      const d = rng.pick(DEFS.filter((x) => !x.good && x.tells));
      return { surprise: null, tell: rng.pick(d.tells!), cover: null };
    }
    return { surprise: null, tell: null, cover: null };
  }
  const goodShare = c.mode === 'asis' || coveredLot ? 0.35 : 0.5;
  const wantGood = rng.chance(goodShare);
  const pool = DEFS.filter((d) => d.good === wantGood && d.fits(c));
  if (!pool.length) return { surprise: null, tell: null, cover: null };
  const d = rng.weighted(pool.map((x) => [x, x.w] as const));
  let delta = d.effect(c, rng);
  if (c.value + delta < 1500) delta = 1500 - c.value;
  const surprise: Surprise = { key: d.id, text: d.text(c, rng, delta), delta, good: d.good };
  const tell = d.tells && rng.chance(c.mode === 'inspected' ? 0.55 : 0.35) ? rng.pick(d.tells) : null;
  const cover = d.cover && rng.chance(0.6) ? d.cover : null;
  return { surprise, tell, cover };
}

// ---------------------------------------------------------------- read-outs

/** Paint-meter reading in microns that matches a panel's status (factory paint ~90–150µm). */
export function micronsFor(rng: Rng, s: PanelStatus, japanese: boolean): number | null {
  const base = japanese ? [88, 122] : [98, 148];
  switch (s) {
    case 'ok': return rng.int(base[0], base[1]);
    case 'spot': return rng.int(160, 215);
    case 'paint': return rng.int(210, 320);
    case 'dent': return rng.int(380, 900);
    case 'replaced': return rng.int(base[0] + 10, base[1] + 40);
    case 'damaged': return null;
    default: return null;
  }
}

export const OBD = {
  engineMinor: [['P0171', 'خليط فقير'], ['P0128', 'حرارة المكينة أقل من الطبيعي'], ['P0300', 'تقطيع عشوائي بالسلندرات']],
  engineMajor: [['P0300', 'تقطيع عشوائي بالسلندرات'], ['P0016', 'خلل توقيت عمود الكامات']],
  gearMinor: [['P0741', 'أداء قابض محول العزم']],
  gearMajor: [['P0730', 'نسبة تعشيق غير صحيحة'], ['P0700', 'عطل في نظام التحكم بالقير']],
  airbag: [['B0001', 'خلل في دائرة إيرباق السائق']],
  abs: [['C0035', 'حساس سرعة العجلة الأمامية يسار']],
} as const;

export function scanFor(rng: Rng, car: CarPub): { status: 'clean' | 'stored' | 'active' | 'cleared' | 'none'; codes: [string, string][] } {
  if (car.runs === 'dead') return { status: 'none', codes: [] };
  const codes: [string, string][] = [];
  const m = car.mech;
  if (m.engine === 'minor') codes.push([...rng.pick(OBD.engineMinor)] as [string, string]);
  if (m.engine === 'major') codes.push([...rng.pick(OBD.engineMajor)] as [string, string]);
  if (m.gearbox === 'minor') codes.push([...OBD.gearMinor[0]] as [string, string]);
  if (m.gearbox === 'major') codes.push([...rng.pick(OBD.gearMajor)] as [string, string]);
  if (m.airbags === 'deployed') codes.push([...OBD.airbag[0]] as [string, string]);
  if (!codes.length && rng.chance(0.06)) codes.push([...OBD.abs[0]] as [string, string]);
  if (!codes.length) return { status: 'clean', codes };
  const active = m.engine === 'major' || m.gearbox === 'major';
  return { status: active ? 'active' : 'stored', codes };
}

export function historyFor(rng: Rng, car: CarPub, nowYear: number): string[] {
  const out: string[] = [];
  if (car.najm === 0) out.push('سجل نجم: لا توجد حوادث مسجلة');
  else {
    for (let i = 0; i < car.najm; i++) {
      const y = Math.max(car.year, nowYear - rng.int(0, Math.max(1, nowYear - car.year)));
      const fault = rng.pick([0, 0, 25, 50, 100]);
      const dmg = rng.int(18, 160) * 100;
      out.push(`نجم ${arDigits(y)}: حادث، نسبة الخطأ ${arDigits(fault)}%، تقدير الأضرار ${money(dmg)} ريال`);
    }
  }
  const tafweed = car.owners > 1 ? rng.int(0, car.owners + 1) : 0;
  const ownersTxt = car.owners === 1 ? 'مالك واحد' : car.owners === 2 ? 'مالكين' : `${arDigits(car.owners)} ملاك`;
  out.push(`موجز: ${ownersTxt}${tafweed ? `، ${arDigits(tafweed)} ${tafweed === 1 ? 'تفويض' : 'تفاويض'}` : ''}`);
  if (car.service === 'dealer') out.push('سجل الصيانة: منتظم بالوكالة');
  else if (car.service === 'workshop') out.push('سجل الصيانة: ورش خارجية، فواتير متفرقة');
  else out.push('سجل الصيانة: لا يوجد');
  if (car.specKind === 'us_salvage') out.push('كارفاكس: Salvage title');
  return out;
}

export function gradeWord(g: number | null): string {
  if (g == null) return 'ما انفحصت';
  if (g >= 4.5) return 'ممتاز';
  if (g >= 3.8) return 'جيد جداً';
  if (g >= 3) return 'جيد';
  if (g >= 2) return 'مقبول';
  return 'ضعيف';
}
