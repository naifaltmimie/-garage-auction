// Variety audit: builds many nights the way the host does and counts repeated descriptive text.
// Run: npx tsx scripts/variety_audit.ts
import { buildDeck } from '../src/engine/lotgen';
import { DEFAULT_SETTINGS } from '../src/engine/rules';
import { loadMarket, CATALOGUE as CAT } from '../src/data/market';
import type { LotFull } from '../src/engine/types';

const COND: Record<string, string> = {};
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
  let dupWithin = 0, lots = 0, sameSheet = 0, storyTotal = 0, storyRepeat = 0;
  const seenStory = new Set<string>();
  for (let n = 0; n < nights; n++) {
    const deck = night(1000 + n * 7919, mix);
    const counts = new Map<string, number>();
    const sheets = new Map<string, number>();
    for (const l of deck) {
      if (!l.car) continue;
      lots++;
      const st = strings(l);
      for (const x of new Set(st.all)) counts.set(x, (counts.get(x) ?? 0) + 1);
      sheets.set(st.sheet, (sheets.get(st.sheet) ?? 0) + 1);
      for (const x of st.story) {
        storyTotal++;
        if (seenStory.has(x)) storyRepeat++;
      }
      for (const x of st.story) seenStory.add(x);
    }
    for (const [, k] of counts) if (k > 1) dupWithin += k - 1;
    for (const [, k] of sheets) if (k > 1) sameSheet += k;
  }
  console.log(
    `${mix.padEnd(9)} nights=${nights} lots=${lots} dupStringsWithinNight=${dupWithin} lotsWithIdenticalSheet=${sameSheet} (${((100 * sameSheet) / Math.max(1, lots)).toFixed(1)}%) storyLines=${storyTotal} storyRepeatAcrossNights=${((100 * storyRepeat) / Math.max(1, storyTotal)).toFixed(1)}%`,
  );
}

loadMarket().then(() => {
  audit('balanced', 20);
  audit('luxury', 1);
  audit('street', 1);
});
