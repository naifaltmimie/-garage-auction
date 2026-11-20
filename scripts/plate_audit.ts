// Plate audit: npx tsx scripts/plate_audit.ts
// 1. The alphabet: the 17 plate letters and their official Latin equivalents, one table for the deck and the players.
// 2. The grader on single plates: an ordinary plate is four plain digits under three letters that spell nothing and
//    carries no tag; fewer digits are always tagged at their floor; the tier words belong to top, rare and legend.
// 3. Night simulation (2,000 nights of 8 and of 10 cars): one to three tagged plates a night, a night of eight or
//    more has one of `special` or better, rare about one night in six and legend about one in twenty where the
//    room can pay, never a legend on a wreck; tagged numbers sit on private plates (rarely transport); the share of
//    each plate kind and format.
import { Rng } from '../src/lib/rng';
import { PLATE_LETTERS, PLATE_TIERS, PLATE_WORDS, buildDeck, gradePlate, makePlate, isStandardNumber } from '../src/engine/lotgen';
import { DEFAULT_SETTINGS } from '../src/engine/rules';
import { loadMarket, CATALOGUE as CAT } from '../src/data/market';
import type { CarModel, LotFull } from '../src/engine/types';

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) };

let fail = 0;
const bad = (msg: string) => {
  fail++;
  if (fail < 30) console.log('FAIL', msg);
};
const pct = (a: number, b: number) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;

// ---------------------------------------------------------------- 1. the alphabet
const OFFICIAL: [string, string][] = [
  ['أ', 'A'], ['ب', 'B'], ['ح', 'J'], ['د', 'D'], ['ر', 'R'], ['س', 'S'], ['ص', 'X'], ['ط', 'T'], ['ع', 'E'],
  ['ق', 'G'], ['ك', 'K'], ['ل', 'L'], ['م', 'Z'], ['ن', 'N'], ['هـ', 'H'], ['و', 'U'], ['ى', 'V'],
];
// the plate prints alef without its hamza
const norm = (c: string) => (c === 'ا' ? 'أ' : c);
if (PLATE_LETTERS.length !== 17) bad(`the plate alphabet has ${PLATE_LETTERS.length} letters, not 17`);
for (const [ar, en] of OFFICIAL) {
  const hit = PLATE_LETTERS.find((l) => norm(l[0]) === ar);
  if (!hit) bad(`plate letter ${ar} missing`);
  else if (hit[1] !== en) bad(`plate letter ${ar} maps to ${hit[1]}, official is ${en}`);
}
console.log(`alphabet: ${PLATE_LETTERS.map((l) => `${l[0]} ${l[1]}`).join(' · ')}`);

// ---------------------------------------------------------------- 2. the grader
const L = PLATE_LETTERS.map((l) => l[0]);
const words = new Set(PLATE_WORDS);
const TIER_WORDS = /لوحة (مميزة|نادرة|أسطورية)/;
const FLOOR: Record<number, string> = { 1: 'top', 2: 'special', 3: 'nice' };
const at = (t?: string) => (t ? PLATE_TIERS.indexOf(t as any) : -1);
{
  const rng = new Rng(31);
  let n = 0;
  for (let i = 0; i < 60_000; i++) {
    const k = rng.weighted([[1, 1], [2, 1], [3, 8]] as const);
    const letters = k === 2 && rng.chance(0.7) ? Array(2).fill(rng.pick(L)) : Array.from({ length: k }, () => rng.pick(L));
    const len = rng.weighted([[1, 1], [2, 2], [3, 3], [4, 6]] as const);
    const num = String(rng.int(10 ** (len - 1), 10 ** len - 1));
    const g = gradePlate(letters, num);
    n++;
    const plainLetters = letters.length === 3 && new Set(letters).size > 1 && !words.has(letters.join('').replace('هـ', 'ه'));
    const plainNum = len === 4 && !/^(\d)\1{3}$/.test(num) && !/^[1-9]000$/.test(num) && !(['1234', '4321'].includes(num) && new Set(letters).size < 3);
    if (plainLetters && plainNum && g) bad(`ordinary plate tagged: ${letters.join(' ')} ${num} → ${g.tier} ${g.label}`);
    if (!(plainLetters && plainNum) && !g) bad(`distinguished plate untagged: ${letters.join(' ')} ${num}`);
    if (len < 4 && at(g?.tier) < at(FLOOR[len])) bad(`${len}-digit plate under its floor: ${letters.join(' ')} ${num} → ${g?.tier}`);
    if (g && (g.tier === 'top' || g.tier === 'rare' || g.tier === 'legend') !== TIER_WORDS.test(g.label)) bad(`tier word misused: ${g.tier} «${g.label}»`);
    if (g && /!|مميز|حلو/.test(g.label + g.note) && !TIER_WORDS.test(g.label)) bad(`hype in a plain label: «${g.label}» ${g.note}`);
  }
  console.log(`grader: ${n} random plates checked`);
  const show = [
    [['ع'], '1'], [['م', 'م'], '22'], [['ص', 'ق', 'ر'], '7'], [['ك', 'ك', 'ك'], '7'], [['ب', 'د', 'ر'], '55'], [['ح', 'ط', 'ب'], '48'],
    [['ح', 'ط', 'ب'], '777'], [['ح', 'ط', 'ب'], '481'], [['ح', 'ط', 'ب'], '7777'], [['ح', 'ط', 'ب'], '7000'], [['س', 'س', 'س'], '4821'],
    [['ن', 'و', 'ر'], '4821'], [['ح', 'ح', 'ب'], '1234'], [['ح', 'ط', 'ب'], '4821'],
  ] as const;
  for (const [l, num] of show) {
    const g = gradePlate(l as unknown as string[], num);
    console.log(`   ${l.join(' ')} ${num.padStart(4)} → ${g ? `${g.tier.padEnd(7)} «${g.label}» ${g.note}` : 'عادية'}`);
  }
}
{
  // single plates dealt without a plan keep their own luck; every dealt number is graded the same way
  const rng = new Rng(4242);
  for (let i = 0; i < 20_000; i++) {
    const p = makePlate(rng, { tier: i % 2 ? 'luxury' : 'daily' } as unknown as CarModel);
    const g = gradePlate(p.ar.split(' '), p.num);
    if (!p.special && (g || !isStandardNumber(p.num))) bad(`untagged plate that isn't ordinary: ${p.ar} ${p.num}`);
    if (p.special && g?.tier !== p.special.tier) bad(`tier mismatch ${p.ar} ${p.num}`);
    if (/^0/.test(p.num)) bad(`zero-padded number ${p.num}`);
  }
}

// ---------------------------------------------------------------- 3. nights
function nights(count: number, budget: number, mix: string, N: number) {
  const perNight: number[] = [0, 0, 0, 0, 0];
  const tierNights: Record<string, number> = {};
  const tierPlates: Record<string, number> = {};
  const kinds: Record<string, number> = {};
  const formats: Record<string, number> = {};
  let pv = 0, pvT = 0, cs = 0, csT = 0;
  let plates = 0, tagged = 0, specialPlus8 = 0, nights8 = 0;
  const examples: string[] = [];
  const kindOk = (l: LotFull) => {
    const c = l.carFull;
    const p = c.plate;
    const k = p.kind ?? 'private';
    if (p.special && k !== 'private' && k !== 'transport') bad(`tagged number on a ${k} plate`);
    if (k === 'transport' && !['pickup', 'van'].includes(c.body)) bad(`transport plate on a ${c.body}`);
    if (k === 'taxi' && (c.body !== 'sedan' || c.km < 200_000)) bad(`taxi plate on ${c.body} ${c.km} km`);
    if (p.special?.tier === 'legend' && Object.values(c.panels).filter((s) => s === 'damaged').length > 0 && c.runs !== 'drive') bad('legend on a wreck');
    if (p.special?.tier === 'legend' && c.mech.chassis === 'damaged') bad('legend on a wreck');
    const want = { private: 'خصوصي', transport: 'نقل خاص', taxi: 'أجرة' }[k];
    if (c.regType !== want) bad(`regType ${c.regType} on a ${k} plate`);
    if (p.special && /^\d{4}$/.test(p.num) === false && p.num.length > 4) bad(`odd number ${p.num}`);
    if (!p.special && !isStandardNumber(p.num)) bad(`untagged ${p.num}`);
  };
  for (let n = 0; n < N; n++) {
    const deck = buildDeck(9000 + n * 104729, { ...DEFAULT_SETTINGS, mix, budget } as any, CAT, 4, count);
    let t = 0;
    const seen = new Set<string>();
    for (const l of deck) {
      const p = l.carFull.plate;
      plates++;
      kinds[p.kind ?? 'private'] = (kinds[p.kind ?? 'private'] ?? 0) + 1;
      formats[p.format ?? 'us'] = (formats[p.format ?? 'us'] ?? 0) + 1;
      kindOk(l);
      const c = l.carFull;
      if (c.body === 'pickup' || c.body === 'van') {
        pv++;
        if (p.kind === 'transport') pvT++;
      }
      if (c.body === 'sedan' && (c.tier === 'daily' || c.tier === 'junk')) {
        cs++;
        if (p.kind === 'taxi') csT++;
      }
      if (p.special) {
        t++;
        tagged++;
        tierPlates[p.special.tier] = (tierPlates[p.special.tier] ?? 0) + 1;
        seen.add(p.special.tier);
        if (examples.length < 12 && n % 37 === 0) examples.push(`${p.ar} ${p.num} «${p.special.label}» ${p.special.note} · ${p.special.value.toLocaleString('en')}`);
      }
    }
    perNight[Math.min(4, t)]++;
    for (const s of seen) tierNights[s] = (tierNights[s] ?? 0) + 1;
    if (t < 1) bad(`night ${n} (${count} cars) has no tagged plate`);
    if (t > 3) bad(`night ${n} (${count} cars) has ${t} tagged plates`);
    if (deck.length >= 8) {
      nights8++;
      if ([...seen].some((s) => s !== 'nice')) specialPlus8++;
      else bad(`night ${n} of ${deck.length} cars has nothing better than nice`);
    }
  }
  console.log(`\n=== ${N} nights of ${count} cars · ${mix} · budget ${budget.toLocaleString('en')} ===`);
  console.log(`tagged plates per night: ${perNight.map((k, i) => `${i}: ${pct(k, N)}`).join('  ')}`);
  console.log(`nights with a tier: ${['legend', 'rare', 'top', 'special', 'nice'].map((t) => `${t} ${pct(tierNights[t] ?? 0, N)}`).join('  ')}`);
  console.log(`tagged plates by tier: ${['legend', 'rare', 'top', 'special', 'nice'].map((t) => `${t} ${tierPlates[t] ?? 0}`).join('  ')}`);
  console.log(`plate kinds: ${Object.entries(kinds).map(([k, v]) => `${k} ${pct(v, plates)}`).join('  ')}`);
  console.log(`transport among pickups and vans: ${pct(pvT, pv)} of ${pv} · taxi among cheap sedans: ${pct(csT, cs)} of ${cs}`);
  console.log(`formats: ${Object.entries(formats).map(([k, v]) => `${k} ${pct(v, plates)}`).join('  ')}`);
  for (const e of examples) console.log(`   ${e}`);
  return { N, tierNights, nights8, specialPlus8 };
}

function near(label: string, got: number, want: number, tol: number) {
  if (Math.abs(got - want) > tol) bad(`${label}: ${(got * 100).toFixed(1)}%, want about ${(want * 100).toFixed(1)}%`);
}

loadMarket().then(() => {
  for (const count of [8, 10]) {
    const rich = nights(count, 5_000_000, 'balanced', 2000);
    near(`rare nights (${count} cars, rich room)`, (rich.tierNights.rare ?? 0) / rich.N, 1 / 6, 0.05);
    near(`legend nights (${count} cars, rich room)`, (rich.tierNights.legend ?? 0) / rich.N, 1 / 20, 0.025);
    nights(count, 1_500_000, 'balanced', 2000);
  }
  // the markets where kinds show up
  nights(10, 750_000, 'work', 500);
  nights(10, 300_000, 'street', 500);
  nights(10, 5_000_000, 'luxury', 500);
  nights(10, 1_500_000, 'german', 500);
  console.log(fail ? `\n${fail} FAILURES` : '\nALL ASSERTIONS PASS');
  process.exit(fail ? 1 : 0);
});
