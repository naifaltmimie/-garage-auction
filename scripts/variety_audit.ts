// Variety audit: builds consecutive nights on one host phone (its `mzk:said` memory included) and measures how
// often the دلال's file repeats. Run: npx tsx scripts/variety_audit.ts [nights] [--samples N]
//   whole lines: the owner, use and why lines and each quirk, as the player reads them
//   fragments:   the persona, habit, route, frame, cause, need and quirk object each line was built from
// Asserts: no file line twice in one night; under 5% repeat from the previous night; under 12% seen in the previous
// five nights. Prints twenty sample files so the writing can be judged.
import { Rng } from '../src/lib/rng';
import { buildDeck } from '../src/engine/lotgen';
import { takeStoryTraces } from '../src/engine/story_lines';
import { DEFAULT_SETTINGS } from '../src/engine/rules';
import { loadMarket, CATALOGUE as CAT } from '../src/data/market';
import type { LotFull } from '../src/engine/types';

const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) };

const NIGHTS = Number(process.argv[2]) || 20;
const SAMPLES = 20;

interface NightRec {
  lines: string[];
  frags: string[];
  personas: string[];
}

function run(mix: string, budget: number, nights: number, seed0: number, keepSamples: boolean) {
  const recs: NightRec[] = [];
  const samples: LotFull[] = [];
  let withinDup = 0;
  let lineN = 0, linePrev = 0, line5 = 0, fragN = 0, fragPrev = 0, frag5 = 0;
  let lots = 0, persona5 = 0, personaPrev = 0;
  const bySlot: Record<string, [number, number]> = {};
  const lineSlot: Record<string, [number, number]> = {};
  for (let n = 0; n < nights; n++) {
    const deck = buildDeck(seed0 + n * 7919, { ...DEFAULT_SETTINGS, mix, budget } as any, CAT, 4, 10);
    const traces = takeStoryTraces();
    const rec: NightRec = { lines: [], frags: [], personas: [] };
    const prev = recs[n - 1];
    const last5 = recs.slice(Math.max(0, n - 5));
    const in5 = (k: string, f: (r: NightRec) => string[]) => last5.some((r) => f(r).includes(k));
    for (const l of deck) {
      const s = l.carFull.story;
      if (!s) continue;
      lots++;
      if (keepSamples) samples.push(l);
      const slots: [string, string][] = [['owner', s.owner], ['use', s.use], ['why', s.why], ...s.quirks.map((q) => ['quirk', q] as [string, string])];
      for (const [slot, x] of slots) {
        if (rec.lines.includes(x)) withinDup++;
        rec.lines.push(x);
        lineN++;
        const b = (lineSlot[slot] ??= [0, 0]);
        b[0]++;
        if (prev?.lines.includes(x)) linePrev++;
        if (in5(x, (r) => r.lines)) {
          line5++;
          b[1]++;
        }
      }
    }
    for (const t of traces) {
      for (const slot of ['owner', 'use', 'why', 'quirks'] as const) {
        for (const k of t[slot]) {
          if (k.length > 40 || !/^[a-z]:/.test(k)) continue; // whole lines are counted above
          rec.frags.push(k);
          fragN++;
          const b = (bySlot[k[0]] ??= [0, 0]);
          b[0]++;
          if (prev?.frags.includes(k)) fragPrev++;
          if (in5(k, (r) => r.frags)) {
            frag5++;
            b[1]++;
          }
        }
      }
      if (in5(t.persona, (r) => r.personas)) persona5++;
      if (prev?.personas.includes(t.persona)) personaPrev++;
      rec.personas.push(t.persona);
    }
    recs.push(rec);
  }
  const pct = (a: number, b: number) => (100 * a) / Math.max(1, b);
  const r = {
    mix, nights, lots, withinDup,
    linePrev: pct(linePrev, lineN), line5: pct(line5, lineN),
    fragPrev: pct(fragPrev, fragN), frag5: pct(frag5, fragN),
    persona5: pct(persona5, lots),
    personaPrev: pct(personaPrev, lots),
  };
  console.log(
    `${mix.padEnd(9)} nights=${nights} lots=${lots} lines=${lineN} dupWithinNight=${withinDup}` +
      ` | lines: vsPrevNight=${r.linePrev.toFixed(1)}% inPrev5=${r.line5.toFixed(1)}%` +
      ` | fragments: vsPrevNight=${r.fragPrev.toFixed(1)}% inPrev5=${r.frag5.toFixed(1)}%` +
      ` | owner persona repeats: vsPrevNight ${r.personaPrev.toFixed(1)}%, within 5 nights ${r.persona5.toFixed(1)}% of lots`,
  );
  console.log(
    '          lines seen in the previous five nights, by part: ' +
      Object.entries(lineSlot).map(([k, [a, b]]) => `${k} ${pct(b, a).toFixed(1)}%`).join(', '),
  );
  const names: Record<string, string> = { p: 'persona', h: 'habit', r: 'route', f: 'frame', c: 'cause', n: 'need', q: 'quirk object' };
  console.log(
    '          fragments seen in the previous five nights, by kind: ' +
      Object.entries(bySlot).map(([k, [a, b]]) => `${names[k] ?? k} ${pct(b, a).toFixed(0)}%`).join(', '),
  );
  return { r, samples };
}

function file(l: LotFull): string {
  const c = l.carFull;
  const s = c.story!;
  const reads = (c.checks ?? []).map((x) => `${x.k}: ${x.v}`).join(' · ');
  return [
    `#${l.no} ${l.title} ${c.year} · ${c.km.toLocaleString('en')} كم · ${c.tier}/${c.body} · ${l.seller} · لوحة ${c.plate.ar} ${c.plate.num} (${c.regType})${c.plate.special ? ` «${c.plate.special.label}»` : ''}${l.surprise ? ` · المفاجأة: ${l.surprise.key}` : ''}`,
    `   سالفتها: ${s.owner}، ${s.use}.`,
    `   ليش تنباع: ${s.why}.`,
    `   شفنا بالمعاينة: ${s.quirks.join(' / ')}`,
    `   القراءات: ${reads}`,
  ].join('\n');
}

loadMarket().then(() => {
  let fail = 0;
  const check = (ok: boolean, msg: string) => {
    if (!ok) {
      fail++;
      console.log('FAIL', msg);
    }
  };
  const main = run('balanced', 1_500_000, NIGHTS, 1000, true);
  check(main.r.withinDup === 0, 'a file line repeats within a night');
  check(main.r.linePrev < 5, `lines repeat from the previous night ${main.r.linePrev.toFixed(1)}% (target under 5%)`);
  check(main.r.line5 < 12, `lines seen in the previous five nights ${main.r.line5.toFixed(1)}% (target under 12%)`);
  for (const [mix, budget] of [['luxury', 5_000_000], ['exotic', 10_000_000], ['work', 750_000], ['street', 300_000], ['family', 750_000]] as const) {
    mem.clear();
    const o = run(mix, budget, NIGHTS, 5000, false);
    check(o.r.withinDup === 0, `${mix}: a file line repeats within a night`);
  }
  const rng = new Rng(77);
  console.log(`\n=== ${SAMPLES} sample files (balanced) ===`);
  for (const l of rng.sample(main.samples, SAMPLES)) console.log(file(l) + '\n');
  console.log(fail ? `${fail} FAILURES` : 'ALL ASSERTIONS PASS');
  process.exit(fail ? 1 : 0);
});
