// «سجلي» — this phone's career across nights, kept in localStorage.
// Display only: built from what the host already published at the results screen.
// Every read/write is wrapped so a blocked or full storage never breaks the game.

export interface NightCar {
  name: string;
  year: number;
  paid: number;
  value: number;
}

export interface NightRec {
  key: string;
  at: number;
  room: string;
  rank: number;
  players: number;
  cars: number;
  paid: number;
  value: number;
  profit: number;
  awards: string[];
  best: (NightCar & { profit: number }) | null;
}

export interface Career {
  v: 1;
  nights: NightRec[];
  /** badge key -> first time it was earned */
  badges: Record<string, number>;
}

export interface Badge {
  key: string;
  title: string;
  how: string;
  test: (c: Career) => boolean;
}

const KEY = 'mzk:career';
const MAX_NIGHTS = 80;

const empty = (): Career => ({ v: 1, nights: [], badges: {} });

export function loadCareer(): Career {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const c = JSON.parse(raw) as Career;
    if (!c || c.v !== 1 || !Array.isArray(c.nights)) return empty();
    if (!c.badges || typeof c.badges !== 'object') c.badges = {};
    return c;
  } catch {
    return empty();
  }
}

function saveCareer(c: Career): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    return true;
  } catch {
    return false;
  }
}

export interface Totals {
  nights: number;
  wins: number;
  cars: number;
  paid: number;
  value: number;
  profit: number;
  best: (NightCar & { profit: number; room: string; at: number }) | null;
}

export function totals(c: Career): Totals {
  const t: Totals = { nights: c.nights.length, wins: 0, cars: 0, paid: 0, value: 0, profit: 0, best: null };
  for (const n of c.nights) {
    if (n.rank === 1 && n.players > 1) t.wins++;
    t.cars += n.cars;
    t.paid += n.paid;
    t.value += n.value;
    t.profit += n.profit;
    if (n.best && n.best.profit > 0 && (!t.best || n.best.profit > t.best.profit)) t.best = { ...n.best, room: n.room, at: n.at };
  }
  return t;
}

const won = (c: Career, title: string) => c.nights.some((n) => n.awards.includes(title));

/** Milestones a phone collects over many nights. */
export const BADGES: Badge[] = [
  { key: 'first_night', title: 'أول سهرة', how: 'خلّص أول مزاد لك', test: (c) => c.nights.length >= 1 },
  { key: 'first_steal', title: 'أول لقطة', how: 'اشترِ سيارة بأقل من قيمتها', test: (c) => c.nights.some((n) => (n.best?.profit ?? 0) > 0) },
  { key: 'champ', title: 'بطل الصالة', how: 'اطلع الأول في مزاد', test: (c) => c.nights.some((n) => n.rank === 1 && n.players > 1) },
  { key: 'whale', title: 'الحوت', how: 'ادفع أغلى سعر في ليلة', test: (c) => won(c, 'الحوت') },
  { key: 'clean', title: 'ولا غلطة', how: 'سيارتين أو أكثر بليلة، كلها بربح', test: (c) => c.nights.some((n) => n.cars >= 2 && n.awards.includes('__clean')) },
  { key: 'pro', title: 'شريطي محترف', how: '10 سيارات على مدى لياليك', test: (c) => totals(c).cars >= 10 },
  { key: 'million', title: 'كراج المليون', how: 'كراج قيمته مليون أو أكثر بليلة', test: (c) => c.nights.some((n) => n.value >= 1_000_000) },
  { key: 'regular', title: 'من أهل الصالة', how: 'العب 5 ليالي', test: (c) => c.nights.length >= 5 },
  { key: 'legend', title: 'أسطورة المزاد', how: 'اطلع الأول 3 مرات', test: (c) => totals(c).wins >= 3 },
];

export const badgeOf = (key: string) => BADGES.find((b) => b.key === key);

/**
 * Save tonight once (keyed by room + night). Returns the career after saving and the
 * badges this night unlocked. Calling it again for the same night changes nothing.
 */
export function recordNight(rec: NightRec): { career: Career; fresh: string[]; saved: boolean } {
  const c = loadCareer();
  if (c.nights.some((n) => n.key === rec.key)) return { career: c, fresh: [], saved: false };
  c.nights.push(rec);
  if (c.nights.length > MAX_NIGHTS) c.nights = c.nights.slice(-MAX_NIGHTS);
  const fresh: string[] = [];
  for (const b of BADGES) {
    if (c.badges[b.key]) continue;
    try {
      if (b.test(c)) {
        c.badges[b.key] = rec.at;
        fresh.push(b.key);
      }
    } catch {
      /* a bad old record never blocks the save */
    }
  }
  const saved = saveCareer(c);
  return { career: c, fresh, saved };
}

/** Badges earned on one night (keys), for the share card. */
export function badgesOfNight(c: Career, nightAt: number): string[] {
  return Object.entries(c.badges)
    .filter(([, at]) => at === nightAt)
    .map(([k]) => k);
}
