// Plate audit: npx tsx scripts/plate_audit.ts
import { Rng } from '../src/lib/rng';
import { PLATE_WORDS, gradePlate, makePlate } from '../src/engine/lotgen';
import type { CarModel } from '../src/engine/types';

const N = 20_000;
let fail = 0;
const bad = (msg: string) => {
  fail++;
  if (fail < 20) console.log('FAIL', msg);
};
const words = new Set(PLATE_WORDS);
for (const cls of ['economy', 'luxury'] as const) {
  const rng = new Rng(cls === 'economy' ? 4242 : 9191);
  const m = { tier: cls } as unknown as CarModel;
  const by: Record<string, { ar: string; num: string; label: string; note?: string; value: number }[]> = {};
  for (let i = 0; i < N; i++) {
    const p = makePlate(rng, m);
    const letters = p.ar.split(' ');
    const gr = gradePlate(letters, p.num);
    const t = p.special?.tier ?? 'none';
    (by[t] ??= []).push({ ar: p.ar, num: p.num, label: p.special?.label ?? '', note: p.special?.note, value: p.special?.value ?? 0 });
    if (!p.special && gr) bad(`untagged looks special: ${p.ar} ${p.num}`);
    if (p.special && gr?.tier !== p.special.tier) bad(`tier mismatch ${p.ar} ${p.num} ${p.special.tier} vs ${gr?.tier}`);
    const plainLetters = letters.length === 3 && new Set(letters).size === 3 && !words.has(letters.join('').replace('هـ', 'ه'));
    const plainNum = p.num.length >= 3 && !/^(\d)\1+$/.test(p.num) && !/^[1-9]0+$/.test(p.num);
    if (p.special && plainLetters && plainNum && /مميزة|نادرة|أسطورية/.test(p.special.label)) bad(`premium label on plain plate ${p.ar} ${p.num}`);
  }
  console.log(`\n=== ${cls} (${N}) ===`);
  for (const t of ['legend', 'rare', 'top', 'special', 'nice', 'none']) {
    const xs = by[t] ?? [];
    console.log(`${t}: ${xs.length} (${((xs.length / N) * 100).toFixed(2)}%)`);
    const ex = [...xs].sort(() => rng.next() - 0.5).slice(0, t === 'none' ? 5 : 20);
    for (const e of ex) console.log(`   ${e.ar} ${e.num} | ${e.label} | ${e.note ?? ''} | ${e.value.toLocaleString('en')}`);
  }
}
console.log(fail ? `\n${fail} FAILURES` : '\nALL ASSERTIONS PASS');
process.exit(fail ? 1 : 0);
