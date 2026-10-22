import { HostEngine } from '../src/engine/host';
import { CATALOGUE } from '../src/data/catalogue';
import { DEFAULT_SETTINGS, minNextBid } from '../src/engine/rules';
import { money } from '../src/lib/util';

let now = 1_000_000;
const eng = HostEngine.create({ code: 'TEST01', hostId: 'h1', hostSec: 's', hostName: 'نايف', settings: { ...DEFAULT_SETTINGS, budget: 1_500_000, speed: 'fast' }, now }, CATALOGUE);
for (const [id, name] of [['p2', 'فهد'], ['p3', 'سعد'], ['p4', 'عبدالله']]) eng.join(id, 's', name, now);
eng.start(now);
const ids = ['h1', 'p2', 'p3', 'p4'];
let guard = 0;
while (eng.st.phase !== 'showcase' && guard++ < 200000) {
  now += 100;
  for (const p of eng.st.players) p.lastSeen = now;
  eng.tick(now);
  const st = eng.st;
  const lot = eng.lot;
  if (st.phase === 'bidding' && lot && Math.random() < 0.12) {
    const who = ids[Math.floor(Math.random() * ids.length)];
    const min = minNextBid(st.bid?.amount ?? null, st.opening);
    if (min < lot.base * (0.75 + Math.random() * 0.4)) eng.bid(who, lot.id, min, now);
  }
  if (st.phase === 'sealed' && lot && Math.random() < 0.05) {
    const who = ids[Math.floor(Math.random() * ids.length)];
    eng.seal(who, lot.id, Math.round(lot.base * (0.5 + Math.random() * 0.4)), now);
  }
}
for (const s of eng.st.sales) {
  console.log(`#${s.no} ${s.kind.padEnd(7)} ${s.title} ${s.car.year} | ${s.outcome} | paid ${money(s.paid)} value ${money(s.value)} profit ${money(s.profit)} ${s.surprise ? '| ' + s.surprise.text : ''}`);
}
eng.openVoting(now);
for (const v of ids) eng.vote(v, Object.fromEntries(ids.filter((x) => x !== v).map((x) => [x, 1 + Math.floor(Math.random() * 10)])), now);
console.log(eng.st.phase);
for (const r of eng.st.results!.rows) console.log(r.rank, eng.st.players.find((p) => p.id === r.id)!.name, 'cars', r.cars, 'profit', money(r.profit), 'rating', r.ratingAvg, 'deal', r.dealScore, 'total', r.total, r.awards.join('، '));
const l = eng.st.deck[0];
console.log(JSON.stringify({ notes: l.notes, inspector: l.carFull.inspector, scan: l.carFull.scan, history: l.carFull.history, grade: l.grade, fee: l.fee, reserve: l.reservePrice, est: l.estimate, opening: l.opening, base: l.base, microns: l.carFull.microns }, null, 0));
