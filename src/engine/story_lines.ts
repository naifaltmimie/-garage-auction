// The دلال's file on each car: who had it, how it lived, why it is out, what you notice at the viewing,
// and the inspector's measured readings. Everything is drawn on the host from the lot's seeded rng,
// so every phone shows the same file. The lines are built from the fragments in `story_pools.ts`
// (a persona and a habit, a route and a frame, a cause and what follows, a thing and its state) mixed
// with whole hand-written lines. The host phone remembers what it dealt (fragment ids and whole lines)
// in `mzk:said`, so a persona or a quirk does not come back the next night with a different tail.
import type { Rng } from '../lib/rng';
import type { CarPub, PanelStatus, Seller, Surprise } from './types';
import {
  BOOT_BITS, CAUSES, FLEETS, FRAMES, FRESH_FRAMES, MORE_THINGS, HABITS, NEEDS, OWNER_WHOLE, PAINT_TELLS, PANEL_NAME, PERSONAS, ROUTES, TELLS, THINGS,
  USE_WHOLE, WHY_WHOLE,
} from './story_pools';
import type { Cls, Frag, Persona, Role, Whole } from './story_pools';

export interface StoryCtx {
  car: CarPub;
  truth: CarPub;
  seller: Seller;
  surprise: Surprise | null;
  nowYear: number;
  asis: boolean;
}

// ---------------------------------------------------------------- the host's memory across nights

const SAID_KEY = 'mzk:said';
const MEM_MAX = 1600;
let mem: string[] | null = null;
let memAt: Map<string, number> | null = null;
function memory(): Map<string, number> {
  if (memAt) return memAt;
  mem = [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAID_KEY) : null;
    if (raw) mem = (JSON.parse(raw) as unknown[]).filter((x): x is string => typeof x === 'string');
  } catch {
    /* storage blocked: nothing remembered */
  }
  memAt = new Map(mem.map((k, i) => [k, i]));
  return memAt;
}
const dealt: string[] = [];
/** stores tonight's fragment ids and lines after the deck is built (oldest drop off first) */
export function rememberNight() {
  memory();
  const now = new Set(dealt);
  const all = [...mem!.filter((k) => !now.has(k)), ...now].slice(-MEM_MAX);
  mem = all;
  memAt = new Map(all.map((k, i) => [k, i]));
  dealt.length = 0;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAID_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked */
  }
}

/** what each lot's file was built from, for the variety audit */
export interface StoryTrace {
  owner: string[];
  use: string[];
  why: string[];
  quirks: string[];
  persona: string;
}
const traces: StoryTrace[] = [];
export function takeStoryTraces(): StoryTrace[] {
  return traces.splice(0, traces.length);
}

/** picks an item never said on this phone, else one said longest ago; `keys` are what is remembered */
function choose<T>(rng: Rng, items: T[], keys: (t: T) => string[], weight?: (t: T) => number): T | null {
  if (!items.length) return null;
  const at = memory();
  const last = (t: T) => Math.max(-1, ...keys(t).map((k) => at.get(k) ?? -1));
  let src = items.filter((t) => last(t) < 0);
  if (!src.length) {
    const sorted = [...items].sort((a, b) => last(a) - last(b));
    src = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 4)));
  }
  return weight ? rng.weighted(src.map((t) => [t, weight(t)] as const)) : rng.pick(src);
}

// ---------------------------------------------------------------- what the car is

function panelTouched(c: CarPub): boolean {
  return Object.values(c.panels).some((s: PanelStatus) => s === 'paint' || s === 'replaced' || s === 'spot');
}

/** the class a persona must fit; a private-plated pickup is a family's, a blue-plated one worked */
function clsOf(x: StoryCtx): Cls {
  const c = x.truth;
  if (c.tier === 'exotic') return 'top';
  if (c.tier === 'luxury') return 'lux';
  if (c.tier === 'sport') return 'sport';
  if (c.tier === 'classic') return 'classic';
  if (c.tier === 'junk') return 'junk';
  const kind = c.plate.kind ?? 'private';
  if (c.body === 'pickup' || c.body === 'van') return kind === 'transport' ? 'work' : 'fam';
  if (c.tier === 'work') return 'work';
  if (c.tier === 'family') return 'fam';
  return 'daily';
}

function tagHolds(t: string, x: StoryCtx, cls: Cls): boolean {
  const c = x.truth;
  const age = x.nowYear - c.year;
  switch (t) {
    case 'hi': return c.km > 180_000;
    case 'lo': return c.km < 80_000;
    case 'old': return age >= 10;
    case 'new': return age <= 4;
    case 'n15': return age <= 15;
    case 'lux': return c.tier === 'luxury' || c.tier === 'sport' || c.tier === 'exotic';
    case 'eco': return !(c.tier === 'luxury' || c.tier === 'sport' || c.tier === 'exotic');
    case 'work': return cls === 'work';
    case 'fam': return c.body === 'suv' || c.body === 'van' || c.body === 'sedan';
    case 'tall': return c.body === 'suv' || c.body === 'pickup' || c.body === 'van';
    case 'small': return c.body === 'sedan' || c.body === 'hatch' || c.body === 'coupe' || c.body === 'convertible';
    case 'x4': return c.drive === '4WD' || c.drive === 'AWD';
    case 'own': return x.seller === 'owner';
    case 'co': return x.seller === 'company' || x.seller === 'rental' || x.seller === 'gov';
    case 'rent': return x.seller === 'rental';
    case 'cmp': return x.seller === 'company';
    case 'gov': return x.seller === 'gov';
    case 'o1': return c.owners === 1;
    case 'o2': return c.owners >= 2;
    case 'd4': return c.doors === 4;
    case 'k1': return c.keys === 1;
    case 'k2': return c.keys === 2;
    case 'clean': return !panelTouched(c) && c.najm === 0;
    case 'dealer': return c.service === 'dealer';
    case 'comp': return c.insurance === 'comp';
    default: return true;
  }
}

function fits(f: { g?: string; cls?: Cls[] }, x: StoryCtx, cls: Cls): boolean {
  if (f.cls && !f.cls.includes(cls)) return false;
  for (const raw of (f.g ?? '').split(' ')) {
    if (!raw || isTell(raw)) continue;
    const neg = raw.startsWith('!');
    if (tagHolds(neg ? raw.slice(1) : raw, x, cls) === neg) return false;
  }
  return true;
}

const clash = (a?: 'R' | 'D', b?: 'R' | 'D') => !!a && !!b && a !== b;

interface Draw {
  x: StoryCtx;
  cls: Cls;
  used: Set<string>;
  topics: Set<string>;
  q?: 'R' | 'D';
  role: Role;
  trace: StoryTrace;
}

function free(f: { k?: string }, d: Draw) {
  return !f.k || !d.topics.has(f.k);
}
function take(d: Draw, slot: keyof Omit<StoryTrace, 'persona'>, f: { k?: string; q?: 'R' | 'D' } | null, key: string) {
  d.used.add(key);
  dealt.push(key);
  d.trace[slot].push(key);
  if (f?.k) d.topics.add(f.k);
  if (f?.q) d.q = f.q;
}

function wholeLine(rng: Rng, pool: Whole[], d: Draw, slot: 'owner' | 'use' | 'why'): string | null {
  const ok = pool.filter((w) => fits(w, d.x, d.cls) && free(w, d) && !clash(w.q, d.q) && !d.used.has(w.t));
  const at = memory();
  const fresh = ok.filter((w) => !at.has(w.t));
  if (!fresh.length) return null;
  const w = rng.pick(fresh);
  take(d, slot, w, w.t);
  return w.t;
}

// ---------------------------------------------------------------- owner

const LEADS = ['كانت عند {p}', 'صاحبها {p}', 'عند {p}', 'كانت مع {p}'];
const GROUP_LEADS = ['كانت عند {p}', 'عند {p}'];

/** lines that a plate's own kind decides: a taxi says so */
const KIND_OWNER: Record<string, string[]> = {
  taxi: ['كانت ليموزين، لوحتها صفرا وتشتغل الليل والنهار', 'كانت أجرة عند سواق يشتغل عليها شفتين', 'كانت ليموزين عند مكتب أجرة'],
};
const KIND_USE: Record<string, string[]> = {
  taxi: ['تمشي في شوارع المدينة من الفجر لين نص الليل', 'أغلب ممشاها مشاوير زباين، وقوف وطلوع طول اليوم'],
};
const KIND_WHY: Record<string, string[]> = {
  taxi: ['السواق ترك الأجرة واشترى ثانية', 'المكتب يبدّل سياراته القديمة'],
};

function ownerLine(rng: Rng, d: Draw): string {
  const kind = d.x.truth.plate.kind ?? 'private';
  if (KIND_OWNER[kind]) {
    d.role = 'fleet';
    d.q = kind === 'taxi' ? 'D' : 'R';
    const t = choose(rng, KIND_OWNER[kind].filter((s) => !d.used.has(s)), (s) => [s]) ?? KIND_OWNER[kind][0];
    take(d, 'owner', null, t);
    d.trace.persona = `kind:${kind}`;
    return t;
  }
  const co = tagHolds('co', d.x, d.cls);
  const transport = kind === 'transport';
  if (!co && rng.chance(0.25)) {
    const w = wholeLine(rng, OWNER_WHOLE.filter((o) => !transport || (o.cls ?? []).includes('work')), d, 'owner');
    if (w) {
      d.role = 'pro';
      d.trace.persona = `w:${w}`;
      return w;
    }
  }
  const pool: Persona[] = (co ? FLEETS : PERSONAS).filter(
    (p) => fits(p, d.x, d.cls) && !d.used.has(`p:${p.id}`) && (!transport || p.role === 'trade' || p.role === 'fleet'),
  );
  const fallback = co ? FLEETS.filter((p) => fits(p, d.x, d.cls)) : PERSONAS.filter((p) => !p.cls || p.cls.includes(d.cls));
  const p = choose(rng, pool.length ? pool : fallback.length ? fallback : co ? FLEETS : PERSONAS, (p) => [`p:${p.id}`])!;
  d.role = p.role;
  d.trace.persona = `p:${p.id}`;
  take(d, 'owner', p, `p:${p.id}`);
  const habits = HABITS.filter(
    (h) => h.who.includes(p.role) && !h.not?.includes(p.id) && fits(h, d.x, d.cls) && free(h, d) && !clash(h.q, d.q) && !d.used.has(`h:${h.id}`),
  );
  const h = choose(rng, habits, (h) => [`h:${h.id}`]);
  const head = p.role === 'fleet' ? p.t : rng.pick(p.role === 'group' ? GROUP_LEADS : LEADS).replace('{p}', p.t);
  if (!h) return head;
  take(d, 'owner', h, `h:${h.id}`);
  return `${head}، ${h.t}`;
}

// ---------------------------------------------------------------- use

function useLine(rng: Rng, d: Draw): string {
  const kind = d.x.truth.plate.kind ?? 'private';
  if (KIND_USE[kind]) {
    const t = choose(rng, KIND_USE[kind].filter((s) => !d.used.has(s)), (s) => [s]) ?? KIND_USE[kind][0];
    take(d, 'use', null, t);
    return t;
  }
  if (rng.chance(0.22)) {
    const w = wholeLine(rng, USE_WHOLE, d, 'use');
    if (w) return w;
  }
  // a car that has barely been driven has no routine yet
  const fresh = d.x.truth.km < 15_000 && d.x.nowYear - d.x.truth.year <= 2;
  if (fresh && rng.chance(0.3)) {
    const t = choose(rng, FRESH_USE.filter((s) => !d.used.has(s)), (s) => [s]);
    if (t) {
      take(d, 'use', null, t);
      return t;
    }
  }
  const persona = d.trace.persona.startsWith('p:') ? d.trace.persona.slice(2) : '';
  // strict first; then a route or frame already dealt tonight may serve again in a new pairing
  for (const strict of [true, false]) {
    const routes = ROUTES.filter(
      (r) =>
        fits(r, d.x, d.cls) && free(r, d) && !clash(r.q, d.q) && (!r.who || r.who.includes(d.role)) &&
        (!r.only || r.only.includes(persona)) && (!strict || !d.used.has(`r:${r.id}`)),
    );
    while (routes.length) {
      const r = choose(rng, routes, (r) => [`r:${r.id}`], (r) => (r.like?.includes(persona) ? 6 : 1))!;
      const frames = (fresh ? FRESH_FRAMES : FRAMES).filter(
        (f) =>
          f.kinds.includes(r.kind) && fits(f, d.x, d.cls) && free(f, d) && (!f.k || f.k !== r.k) && !clash(f.q, d.q) && !clash(f.q, r.q) &&
          (!f.roles || f.roles.includes(d.role)) && (!f.person || (d.role !== 'fleet' && d.role !== 'group')) && (!f.group || d.role === 'fleet' || d.role === 'group') &&
          (!strict || !d.used.has(`f:${f.id}`)) && !d.used.has(f.t.replace('{w}', r.t)),
      );
      const f = choose(rng, frames, (f) => [`f:${f.id}`]);
      if (!f) {
        routes.splice(routes.indexOf(r), 1);
        continue;
      }
      const t = f.t.replace('{w}', r.t);
      take(d, 'use', r, `r:${r.id}`);
      take(d, 'use', f, `f:${f.id}`);
      d.used.add(t);
      return t;
    }
  }
  return wholeLine(rng, USE_WHOLE, d, 'use') ?? 'ممشاها بين البيت والدوام';
}

const FRESH_USE = [
  'توها ما مشت إلا مشاوير قليلة',
  'ما كمّلت شهرين عند صاحبها',
  'من الوكالة للبيت وللمعرض بس',
  'ممشاها مشاوير تجربة حول البيت',
  'ما شافت طريق سفر للحين',
  'مشت مشوارين للاستراحة وبس',
  'أغلب وقتها واقفة في الكراج بغطاها',
  'ما تعدّت حدود المدينة',
];

// ---------------------------------------------------------------- why

function whyLine(rng: Rng, d: Draw): string {
  const kind = d.x.truth.plate.kind ?? 'private';
  if (KIND_WHY[kind]) {
    const t = choose(rng, KIND_WHY[kind].filter((s) => !d.used.has(s)), (s) => [s]) ?? KIND_WHY[kind][0];
    take(d, 'why', null, t);
    return t;
  }
  const co = tagHolds('co', d.x, d.cls);
  if (!co && rng.chance(0.25)) {
    const w = wholeLine(rng, WHY_WHOLE, d, 'why');
    if (w) return w;
  }
  const causeOk = (c: Frag & { cat: string }) => (co ? c.cat === 'fleet' : c.cat !== 'fleet') && fits(c, d.x, d.cls) && !d.used.has(`c:${c.id}`);
  let causes = CAUSES.filter(causeOk);
  if (!causes.length) causes = CAUSES.filter((c) => (co ? c.cat === 'fleet' : c.cat !== 'fleet'));
  for (let i = 0; i < 6; i++) {
    const c = choose(rng, causes, (c) => [`c:${c.id}`]);
    if (!c) break;
    // the pairing matters more than the need alone: a fresh pairing first
    const combo = (n: { t: string }) => [`${c.t}، ${n.t}`];
    let needs = NEEDS.filter((n) => n.cat === c.cat && fits(n, d.x, d.cls) && !d.used.has(`n:${n.id}`));
    if (!needs.length) needs = NEEDS.filter((n) => n.cat === c.cat && fits(n, d.x, d.cls) && !d.used.has(`${c.t}، ${n.t}`));
    const n = choose(rng, needs, combo);
    if (!n) {
      causes = causes.filter((x) => x !== c);
      continue;
    }
    take(d, 'why', c, `c:${c.id}`);
    take(d, 'why', n, `n:${n.id}`);
    take(d, 'why', null, `${c.t}، ${n.t}`);
    return `${c.t}، ${n.t}`;
  }
  return wholeLine(rng, WHY_WHOLE, d, 'why') ?? 'صاحبها يبي يغيّر';
}

// ---------------------------------------------------------------- quirks

function isTell(t: string): boolean {
  return t.startsWith('T:') || t === 'P' || t === 'hot' || t === 'ac' || t === 'sus';
}
const tellsOf = (w: Whole) => (w.g ?? '').split(' ').filter(isTell);

/** a tell holds when the hidden truth backs it */
function tellHolds(tag: string, x: StoryCtx): boolean {
  const c = x.truth;
  if (tag.startsWith('T:')) return x.surprise?.key === tag.slice(2);
  if (tag === 'P') return panelTouched(c);
  if (tag === 'hot') return c.mech.engine === 'major' || c.mech.engine === 'minor';
  if (tag === 'ac') return c.mech.ac === 'weak' || c.mech.ac === 'broken';
  if (tag === 'sus') return c.mech.susp === 'minor' || c.mech.susp === 'major';
  return false;
}

function paintTell(rng: Rng, d: Draw): string | null {
  const touched = Object.entries(d.x.truth.panels).filter(([, s]) => s === 'paint' || s === 'replaced' || s === 'spot').map(([p]) => p);
  if (!touched.length) return null;
  const panel = PANEL_NAME[rng.pick(touched)];
  const opts = PAINT_TELLS.map((t) => t.replace('{panel}', panel)).filter((t) => !d.used.has(t));
  return opts.length ? rng.pick(opts) : null;
}

function fill(rng: Rng, t: string, x: StoryCtx): string {
  const four = x.truth.doors === 4;
  return t
    .replace('{side}', () => rng.pick(['اليمين', 'اليسار']))
    .replace('{door}', () => rng.pick(four ? ['الأمامي اليمين', 'الأمامي اليسار', 'الخلفي اليمين', 'الخلفي اليسار'] : ['اليمين', 'اليسار']))
    .replace('{win}', () => rng.pick(four ? ['الأمامية اليمين', 'الأمامية اليسار', 'الخلفية اليمين', 'الخلفية اليسار'] : ['اليمين', 'اليسار']))
    .replace('{boot}', () => rng.pick(BOOT_BITS));
}

const ALL_THINGS = [...THINGS, ...MORE_THINGS];

function quirks(rng: Rng, d: Draw): string[] {
  const x = d.x;
  const out: string[] = [];
  const usable = (w: Whole) => fits(w, x, d.cls) && !d.used.has(w.t);
  const trueTells = TELLS.filter((w) => usable(w) && tellsOf(w).length > 0 && tellsOf(w).every((t) => tellHolds(t, x)));
  const falseTells = TELLS.filter((w) => usable(w) && tellsOf(w).some((t) => t.startsWith('T:')) && !tellsOf(w).every((t) => tellHolds(t, x)) && !tellsOf(w).some((t) => !t.startsWith('T:')));
  const takeTell = (pool: Whole[]) => {
    const w = choose(rng, pool, (w) => [w.t]);
    if (!w) return;
    take(d, 'quirks', w, w.t);
    out.push(w.t);
  };
  const n = rng.chance(0.55) ? 3 : 2;
  // a surprise-backed tell shows most of the time, a visible-condition tell less often, a false alarm rarely
  const surpriseTells = trueTells.filter((w) => tellsOf(w).some((t) => t.startsWith('T:')));
  if (surpriseTells.length && rng.chance(0.7)) takeTell(surpriseTells);
  else if (panelTouched(x.truth) && rng.chance(0.25)) {
    const t = paintTell(rng, d);
    if (t) {
      take(d, 'quirks', null, t);
      out.push(t);
    }
  } else if (trueTells.length && rng.chance(0.4)) takeTell(trueTells);
  else if (falseTells.length && rng.chance(0.06)) takeTell(falseTells);
  while (out.length < n) {
    const things = ALL_THINGS.filter((q) => fits(q, x, d.cls) && free(q, d) && !d.used.has(`q:${q.id}`));
    const q = choose(rng, things, (q) => [`q:${q.id}`]);
    if (!q) break;
    const states = q.s
      .filter((s) => typeof s === 'string' || fits({ g: s[1] }, x, d.cls))
      .map((s) => fill(rng, typeof s === 'string' ? s : s[0], x))
      .filter((s) => !d.used.has(s) && !out.includes(s));
    take(d, 'quirks', q, `q:${q.id}`);
    if (!states.length) continue;
    const s = choose(rng, states, (s) => [s])!;
    d.used.add(s);
    dealt.push(s);
    out.push(s);
  }
  return out;
}

export function storyFor(rng: Rng, x: StoryCtx, used: Set<string>): NonNullable<CarPub['story']> {
  const d: Draw = { x, cls: clsOf(x), used, topics: new Set(), role: 'pro', trace: { owner: [], use: [], why: [], quirks: [], persona: '' } };
  const owner = ownerLine(rng, d);
  const use = useLine(rng, d);
  const why = whyLine(rng, d);
  const q = quirks(rng, d);
  traces.push(d.trace);
  return { owner, use, why, quirks: q };
}

const POSITIVE: string[] = [
  'المكينة ناعمة وثابتة على الفاضي',
  'القير يعشّق بسلاسة بارد وحار',
  'الشاصي سليم، القوايم أصلية بالبراغي',
  'ما فيها تهريب من تحت',
  'المكيف يبرد من أول دقيقتين',
  'الفرامل تمسك بخط مستقيم بدون رجفة',
  'الدركسون مستقيم والميزانية مضبوطة',
  'التعليق متماسك على المطبات بدون صوت',
  'العادم نظيف، لا دخان ولا ريحة',
  'البطارية قوية والتشغيل من أول مرة',
  'كل الأنوار والحساسات تشتغل',
  'الكمبيوتر ما فيه أعطال مخزّنة',
  'سيور المكينة نظيفة وما فيها شقوق',
  'زيت المكينة لونه نظيف ومستواه مضبوط',
  'الأبواب تسكّر بصوت واحد وفتحاتها متساوية',
  'ما فيه أثر لحام ولا تعديل تحت السجاد',
  'الجوانب البلاستيك تحت السيارة سليمة',
  'الماي في الرديتر نظيف بدون زيت',
  'الكراسي الكهربا كلها تشتغل',
  'ما فيه أي ريحة رطوبة في الكابينة',
  'الكابلات الأصلية ما انلمست',
  'الصوت من تحت الكبوت متوازن بدون تكتكة',
];

const FAULTS: Record<string, string[]> = {
  engine_minor: [
    'تهريب زيت خفيف من غطا البلوف', 'تكتكة خفيفة وهي باردة', 'رجفة بسيطة على الفاضي', 'أثر زيت تحت المكينة',
    'صوت سير خفيف أول التشغيل', 'المكينة تبي صيانة بواجي وفلاتر', 'تهريب من صوفة الكرنك الخلفية', 'رشح زيت حول فلتر الزيت',
    'كويلات تحتاج فحص، رجفة على العزوم المنخفضة', 'خرطوم الهوا متشقق عند البوابة', 'جلدة غطا البلوف مرهقة', 'قاعدة المكينة اليمين متعبة',
    'حساس الأكسجين يعطي قراءة متذبذبة', 'بخاخات تحتاج تنظيف، التسارع فيه تردد',
  ],
  engine_major: [
    'دخان أزرق مع الدعسة', 'ضغط المكينة ضعيف في سلندر', 'صوت طقطقة من تحت الغطا', 'المكينة تسخن مع الوقفة',
    'تهريب ماء من الرديتر وأثر حرارة', 'زيت مختلط بالماي في الغطا', 'صوت دق من البستم وهي حارة', 'الضغط متفاوت بين السلندرات',
    'غطا الراس فيه أثر تسريب', 'دخان أبيض كثيف بعد التشغيل', 'صوت عمود الكامات عالي', 'ضغط الزيت ينزل مع الحرارة',
  ],
  gearbox_minor: [
    'نتعة خفيفة بين الأول والثاني', 'القير يتأخر شوي وهو بارد', 'رفسة بسيطة على الريوس', 'زيت القير يبي تغيير',
    'تعشيق الثالث فيه تردد بسيط', 'تهريب خفيف من صوفة العكس', 'قاعدة القير متعبة، رجة مع التعشيق', 'القير يرفع الدورات قبل ما يبدل',
    'نتعة على النزول من الثالث للثاني', 'لون زيت القير غامق', 'صوت خفيف من الدفرنس الخلفي', 'القير يتردد في التعشيق مع الطلعة',
  ],
  gearbox_major: [
    'تأخير تعشيق واضح', 'القير يفصل على السرعات العالية', 'صوت صفير من القير مع الدعسة', 'القير ينتع بقوة بين الثاني والثالث',
    'القير يدخل وضع الطوارئ', 'زيت القير محروق وريحته واضحة', 'القير يزحلق على الطلعات', 'الريوس ما يعشّق إلا بعد ثواني',
    'صوت طحن مع التبديل', 'القير يعلّق على الثاني', 'تهريب زيت قير من الكرتير', 'لمبة القير تولع مع الحرارة',
  ],
  susp_minor: [
    'صوت جلب من قدام', 'المساعدات الخلفية تعبانة شوي', 'ميزانية تبي ضبط، تسحب يمين', 'صوت طقطقة مع اللف من المقص',
    'جلد المقصات متشقق', 'رمانة الدركسون فيها لعب بسيط', 'عمود التوازن الأمامي يطقطق', 'جلدة الدبل مشقوقة اليسار',
    'المساعد الأمامي اليمين يرشح', 'كراسي المقصات الخلفية تعبانة', 'رجفة في الدركسون فوق 110', 'بلية الكفر الخلفي تونّ',
  ],
  susp_major: [
    'المساعدات الأمامية منتهية', 'المقص الأمامي مكسور الجلب', 'السيارة نازلة من جهة', 'صوت دق قوي من الخلف',
    'الدركسون فيه لعب كبير', 'البلية الأمامية تصيح', 'مسمار المقص مرتخي', 'جربوكس الدركسون يهرّب',
    'الياي الخلفي مكسور', 'نظام التعليق الهوائي ما يرفع', 'عمود الدبل يطق مع اللف', 'تآكل غير طبيعي في الكفرات من الاعوجاج',
  ],
  ac_weak: [
    'المكيف يبرد على خفيف', 'المكيف يبي تعبئة فريون', 'مروحة المكيف ضعيفة', 'المكيف يبرد بعد ما تمشي فيها',
    'الكمبروسر يفصل ويشبك', 'فلتر المكيف مسدود', 'مروحة المكثف بطيئة', 'الفتحات اليمين أحر من اليسار',
    'صمام التمدد يحتاج تغيير', 'المكيف يحمّي على الوقفة', 'تهريب فريون خفيف عند الوصلة', 'ريحة رطوبة من فتحات المكيف',
  ],
  chassis: [
    'أثر لحام على القائمة الأمامية', 'الشاصي الخلفي مسحوب ومعدل', 'أثر تعديل على الدعامة الأمامية', 'برغي القائمة مفكوك ومعاد',
    'أرضية الشنطة فيها أثر سحب', 'الدعامة الخلفية اليسار مقصوصة وملحومة', 'أثر شد على العارضة الأمامية', 'لحام نقطي مو أصلي عند العمود',
    'العارضة الخلفية مغيّرة', 'معجون على البرواز الأمامي', 'فتحات الأبواب مو متساوية', 'القائمة الوسطى فيها تموج',
  ],
  dealer_clean: [
    'السيارة بحالة وكالة', 'البودي وكالة والسجل منتظم', 'المكينة والقير وكالة ما انفكت', 'نظيفة ومخدومة عند الوكيل',
    'أختام الوكالة على البراغي ما انفكت', 'الصيانات كلها في النظام عند الوكيل', 'ما فيها قطعة مو أصلية', 'التحديثات البرمجية من الوكالة كاملة',
    'القطع المغيّرة كلها أصلية بفواتيرها', 'جهاز الوكالة ما طلع ولا ملاحظة', 'زيوتها وكالة بالموعد', 'الفحص الدوري يطلع من أول مرة',
  ],
};

const FEATURES_MORE: Record<string, string[]> = {
  basic: ['شاشة أندرويد مركّبة', 'كاميرا خلفية مركّبة', 'حساسات خلفية', 'مثبت سرعة', 'بلوتوث', 'زجاج كهربا', 'مرايات كهربا', 'قفل مركزي بالريموت', 'جنوط ألمنيوم', 'إضاءة نهارية', 'كشافات ضباب', 'تظليل حراري', 'مكيف خلفي', 'منفذ شحن قدام', 'كراسي قماش مكسوة جلد'],
  mid: ['كاميرا 360', 'شاشة لمس كبيرة', 'ربط الجوال بالشاشة', 'تشغيل بصمة', 'دخول ذكي', 'كراسي جلد', 'مثبت سرعة متكيف', 'تنبيه النقطة العمياء', 'تحذير مغادرة المسار', 'فتحة سقف', 'شحن لاسلكي', 'كراسي مبردة', 'ذاكرة كرسي السواق', 'مكابح طوارئ', 'إضاءة لِد كاملة'],
  lux: ['سقف بانوراما', 'كراسي مساج', 'نظام صوت فاخر', 'شاشة عرض على الزجاج', 'تعليق هوائي', 'إضاءة محيطية', 'أبواب شفط', 'شاشات خلفية', 'تبريد وتدفئة الكراسي', 'ثلاجة في الكونسول', 'رؤية ليلية', 'ركن ذاتي', 'كراسي خلفية كهربا', 'زجاج عازل للصوت', 'مفتاح رقمي في الجوال'],
};

export function moreFeatures(tier: string): string[] {
  return tier === 'luxury' || tier === 'exotic' || tier === 'sport' ? FEATURES_MORE.lux : tier === 'economy' || tier === 'junk' || tier === 'work' ? FEATURES_MORE.basic : FEATURES_MORE.mid;
}

export function faultPool(k: string): string[] {
  if (k === 'positive') return POSITIVE;
  return FAULTS[k] ?? [];
}

const TYRES = ['ميشلان', 'بريجستون', 'يوكوهاما', 'هانكوك', 'كومهو', 'كونتيننتال', 'بيريللي', 'دنلوب', 'تويو', 'فالكن', 'جوديير', 'نيتو'];

/** the inspector's measured readings, from the truth already on the car (the shown mech stays the judge of what is said) */
export function checksFor(rng: Rng, x: StoryCtx): NonNullable<CarPub['checks']> {
  const c = x.car;
  const t = x.truth;
  const age = Math.max(0, x.nowYear - c.year);
  const out: NonNullable<CarPub['checks']> = [];
  const tyreAge = x.nowYear - c.tires;
  const tread = Math.max(1.6, Math.min(8.5, 8.4 - tyreAge * 1.3 - rng.range(0, 1.4)));
  out.push({ k: 'الكفرات', v: `${rng.pick(TYRES)} ${c.tires}، دعسة ${tread.toFixed(1)} مم`, tone: tread >= 5 ? 'good' : tread >= 3 ? 'mid' : 'bad' });
  if (x.asis) {
    const batt = rng.int(40, 95);
    out.push({ k: 'البطارية', v: c.runs === 'dead' ? 'ما تشغّل' : `${batt}% من بعيد`, tone: c.runs === 'dead' ? 'bad' : 'mid' });
    out.push({ k: 'الباقي', v: 'ما انفحص', tone: 'mid' });
    return out;
  }
  const pads = Math.max(8, Math.min(95, Math.round(90 - (c.km % 45_000) / 600 - rng.range(0, 15))));
  out.push({ k: 'فحمات الفرامل', v: `${pads}% باقي`, tone: pads >= 50 ? 'good' : pads >= 25 ? 'mid' : 'bad' });
  const battAge = rng.int(0, Math.min(4, age));
  const batt = Math.max(42, Math.round(100 - battAge * 12 - rng.range(0, 10)));
  out.push({ k: 'البطارية', v: `${batt}%، عمرها ${battAge === 0 ? 'أقل من سنة' : battAge === 1 ? 'سنة' : battAge === 2 ? 'سنتين' : `${battAge} سنين`}`, tone: batt >= 75 ? 'good' : batt >= 55 ? 'mid' : 'bad' });
  const mic = Object.values(c.microns).filter((v): v is number => typeof v === 'number');
  if (mic.length) {
    const avg = Math.round(mic.reduce((a, b) => a + b, 0) / mic.length);
    const max = Math.max(...mic);
    out.push({ k: 'جهاز الطلاء', v: `متوسط ${avg} ميكرون، أعلى قراءة ${max}`, tone: max > 250 ? 'bad' : max > 160 ? 'mid' : 'good' });
  }
  const e = c.mech.engine;
  out.push({
    k: 'الزيت والماي',
    v: e === 'major' ? 'الماي ناقص والزيت غامق' : e === 'minor' ? 'الزيت غامق، الماي مضبوط' : rng.pick(['الزيت نظيف، الماي على المستوى', 'زيت جديد، الماي صافي', 'المستويات مضبوطة']),
    tone: e === 'major' ? 'bad' : e === 'minor' ? 'mid' : 'good',
  });
  const rpm = e === 'ok' ? rng.int(65, 80) * 10 : rng.int(55, 95) * 10;
  out.push({ k: 'الفاضي', v: `${rpm} دورة، ${e === 'ok' ? 'ثابت' : 'يتذبذب'}`, tone: e === 'ok' ? 'good' : e === 'minor' ? 'mid' : 'bad' });
  const ac = c.mech.ac;
  if (ac !== 'unknown') {
    const temp = ac === 'cold' ? rng.int(4, 8) : ac === 'weak' ? rng.int(13, 19) : rng.int(26, 34);
    out.push({ k: 'حرارة الفتحات', v: `${temp}°م`, tone: ac === 'cold' ? 'good' : ac === 'weak' ? 'mid' : 'bad' });
  }
  const s = c.mech.susp;
  out.push({ k: 'التعليق', v: s === 'ok' ? 'متماسك، بدون صوت' : s === 'minor' ? 'صوت خفيف من قدام' : 'المساعدات منتهية', tone: s === 'ok' ? 'good' : s === 'minor' ? 'mid' : 'bad' });
  const leak = e === 'major' || c.mech.gearbox === 'major';
  const sweat = !leak && (e === 'minor' || c.mech.gearbox === 'minor' || (age > 12 && rng.chance(0.4)));
  out.push({ k: 'أسفل السيارة', v: leak ? 'تهريب واضح' : sweat ? 'رشح خفيف' : 'ناشف', tone: leak ? 'bad' : sweat ? 'mid' : 'good' });
  void t;
  // 5 to 7 readings: the tyre, the paint gauge and the faults always stay
  const keep = new Set(['الكفرات', 'جهاز الطلاء']);
  while (out.length > 7 || (out.length > 5 && rng.chance(0.5))) {
    const drop = out.findIndex((r, i) => i > 0 && !keep.has(r.k) && r.tone === 'good');
    if (drop < 0) break;
    out.splice(drop, 1);
  }
  return out;
}

/** dated service lines for the records tab */
export function serviceLines(rng: Rng, c: CarPub, nowYear: number, used: Set<string>): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (used.has(s)) return;
    used.add(s);
    out.push(s);
  };
  if (c.service !== 'none') {
    const oil = Math.max(1000, Math.round((c.km - rng.int(400, 7000)) / 100) * 100);
    add(`آخر غيار زيت: على ${oil.toLocaleString('en-US')} كم${c.service === 'dealer' ? ' عند الوكيل' : ''}`);
  }
  const ys = (back: number) => Math.max(c.year, nowYear - rng.int(0, back));
  const pool: (() => string)[] = [
    () => `بطارية: تغيرت ${ys(3)}`,
    () => `فحمات أمامية: تغيرت ${ys(2)}`,
    () => `سير المكينة: تغيّر على ${(Math.round(c.km * rng.range(0.5, 0.9) / 1000) * 1000).toLocaleString('en-US')} كم`,
    () => `الكفرات: تغيرت ${Math.min(nowYear, c.tires + rng.int(0, 1))}`,
    () => `بواجي: تغيرت ${ys(3)}`,
    () => `زيت القير: تغيّر ${ys(4)}`,
    () => `غسيل رديتر: ${ys(3)}`,
  ];
  const n = c.service === 'none' ? 1 : rng.int(1, 3);
  for (const f of [...pool].sort(() => rng.next() - 0.5).slice(0, n)) add(f());
  if (c.mvpi === 'valid' && rng.chance(0.25)) add(`الفحص الدوري: رسبت مرة ${ys(2)} ونجحت بعد الإصلاح`);
  if (c.fines > 0) {
    const n2 = Math.max(1, Math.round(c.fines / rng.pick([150, 300, 500])));
    add(`مخالفات ساهر: ${n2} ${n2 === 1 ? 'مخالفة' : n2 <= 10 ? 'مخالفات' : 'مخالفة'} بمجموع ${c.fines.toLocaleString('en-US')} ريال`);
  }
  return out;
}
