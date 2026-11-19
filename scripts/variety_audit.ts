// Variety audit: builds many nights the way the host does and counts repeated descriptive text.
// Run: npx tsx scripts/variety_audit.ts
import { buildDeck } from '../src/engine/lotgen';
import { DEFAULT_SETTINGS } from '../src/engine/rules';
import { loadMarket, CATALOGUE as CAT } from '../src/data/market';
import type { LotFull } from '../src/engine/types';

const COND: Record<string, string> = {};
// one host phone's storage, so the across-night memory works as on the device
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) };
const DUPS = new Map<string, number>();
function strings(l: LotFull): { all: string[]; story: string[]; sheet: string } {
  const c = l.car;
  if (!c) return { all: [], story: [], sheet: '' };
  const story: string[] = [];
  const s = (c as any).story;
  if (s) story.push(s.owner, s.use, s.why, ...s.quirks);
  const checks: string[] = ((c as any).checks ?? []).map((x: any) => `${x.k}: ${x.v}`);
  const mech = Object.entries(c.mech).map(([k, v]) => `${k}:${v}${COND[k] ?? ''}`);
  const all = [...c.inspector, ...c.history, ...c.extras, ...l.notes, ...story];
  const sheet = [...c.inspector, ...c.history, ...mech, ...checks, ...story].join('|');
  return { all, story, sheet };
}

function night(seed: number, mix: string) {
  const settings = { ...DEFAULT_SETTINGS, mix, budget: 1_500_000 } as any;
  return buildDeck(seed, settings, CAT, 4, 10);
}

function audit(mix: string, nights: number) {
  let prevNight = new Set<string>(), repPrev = 0;
  let dupWithin = 0, lots = 0, sameSheet = 0, storyTotal = 0, storyRepeat = 0;
  const seenStory = new Set<string>();
  for (let n = 0; n < nights; n++) {
    const deck = night(1000 + n * 7919, mix);
    const counts = new Map<string, number>();
    const thisNight = new Set<string>();
    const sheets = new Map<string, number>();
    for (const l of deck) {
      if (!l.car) continue;
      lots++;
      const st = strings(l);
      for (const x of new Set(st.all)) counts.set(x, (counts.get(x) ?? 0) + 1);
      for (const x of st.story) thisNight.add(x);
      sheets.set(st.sheet, (sheets.get(st.sheet) ?? 0) + 1);
      for (const x of st.story) {
        storyTotal++;
        if (seenStory.has(x)) storyRepeat++;
      }
      for (const x of st.story) { seenStory.add(x); if (prevNight.has(x)) repPrev++; }
    }
    for (const [x, k] of counts) if (k > 1) { dupWithin += k - 1; DUPS.set(x, (DUPS.get(x) ?? 0) + k - 1); }
    prevNight = thisNight;
    for (const [, k] of sheets) if (k > 1) sameSheet += k;
  }
  console.log(
    `${mix.padEnd(9)} nights=${nights} lots=${lots} dupStringsWithinNight=${dupWithin} lotsWithIdenticalSheet=${sameSheet} (${((100 * sameSheet) / Math.max(1, lots)).toFixed(1)}%) storyLines=${storyTotal} storyRepeatVsPrevNight=${((100 * repPrev) / Math.max(1, storyTotal)).toFixed(1)}% storyEverSeenBefore=${((100 * storyRepeat) / Math.max(1, storyTotal)).toFixed(1)}%`,
  );
}

loadMarket().then(() => {
  audit('balanced', 20);
  audit('luxury', 1);
  audit('street', 1);
  console.log([...DUPS].sort((a, b) => b[1] - a[1]).slice(0, 12));
});
