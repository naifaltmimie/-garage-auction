// Fonts are fetched at build time (Thmanyah, via the community web package's pinned commit)
// so the deploy bundle stays text-only. Never fails the build if a file is already present.
import fs from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/engdawood/thmanyah-font-web/4266a9d/fonts';
const MIRROR = 'https://cdn.jsdelivr.net/gh/engdawood/thmanyah-font-web@4266a9d/fonts';
const FILES = [
  'thmanyah-sans/woff2/thmanyah-sans-Regular.woff2',
  'thmanyah-sans/woff2/thmanyah-sans-Medium.woff2',
  'thmanyah-sans/woff2/thmanyah-sans-Bold.woff2',
  'thmanyah-sans/woff2/thmanyah-sans-Black.woff2',
  'thmanyah-serif-display/woff2/thmanyah-serif-display-Medium.woff2',
  'thmanyah-serif-display/woff2/thmanyah-serif-display-Bold.woff2',
  'thmanyah-serif-display/woff2/thmanyah-serif-display-Black.woff2',
];
await fs.mkdir('public/fonts', { recursive: true });
let ok = 0;
await Promise.all(
  FILES.map(async (f) => {
    const dest = `public/fonts/${f.split('/').pop()}`;
    try {
      const st = await fs.stat(dest);
      if (st.size > 10_000) return void ok++;
    } catch {
      /* fetch it */
    }
    for (const base of [BASE, MIRROR]) {
      try {
        const r = await fetch(`${base}/${f}`, { signal: AbortSignal.timeout(15000) });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 10_000) continue;
        await fs.writeFile(dest, buf);
        ok++;
        return;
      } catch {
        /* next */
      }
    }
    console.warn('[fonts] missing', f);
  }),
);
console.log(`[fonts] ${ok}/${FILES.length}`);
