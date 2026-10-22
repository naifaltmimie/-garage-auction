// Which real ads this phone has already seen at auction, so the next night brings different cars.
// The host also collects every player's list before it builds the deck.
const KEY = 'mzk:seen';
const MAX = 2500;
const TTL = 1000 * 60 * 60 * 24 * 60; // two months

function read(): Record<string, number> {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function write(v: Record<string, number>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the night still works, it just may repeat */
  }
}

export function markSeen(key: string | undefined | null) {
  if (!key) return;
  const v = read();
  if (v[key]) return;
  v[key] = Date.now();
  const now = Date.now();
  const entries = Object.entries(v).filter(([, t]) => now - t < TTL);
  entries.sort((a, b) => b[1] - a[1]);
  write(Object.fromEntries(entries.slice(0, MAX)));
}

/** The most recently seen ad keys, newest first. */
export function recentSeen(n = 800): string[] {
  const now = Date.now();
  return Object.entries(read())
    .filter(([, t]) => now - t < TTL)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}
