// Pull the recorded auctioneer clips into public/voice before the build.
// Sources, in order: a file already in public/voice → the signed ElevenLabs URLs in
// voice-src/manifest.json (they expire) → the copy on the live site (keeps clips alive
// across redeploys). Never fails the build; writes public/voice/index.json with what exists.
import fs from 'node:fs/promises';

const MANIFEST = 'voice-src/manifest.json';
const DIR = 'public/voice';
const online = !!process.env.VERCEL || process.env.FETCH_VOICE === '1';

const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
await fs.mkdir(DIR, { recursive: true });

const isMp3 = (b) => b.length > 2000 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));

async function have(dest) {
  try {
    return isMp3(await fs.readFile(dest));
  } catch {
    return false;
  }
}

async function grab(key, urls) {
  const dest = `${DIR}/${key}.mp3`;
  if (await have(dest)) return key;
  if (!online) return null;
  for (const u of [...urls, `${manifest.fallback}${key}.mp3`]) {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (!isMp3(buf)) continue;
      await fs.writeFile(dest, buf);
      return key;
    } catch {
      /* next source */
    }
  }
  return null;
}

const got = (await Promise.all(Object.entries(manifest.files).map(([k, urls]) => grab(k, urls)))).filter(Boolean);
await fs.writeFile(`${DIR}/index.json`, JSON.stringify(got));
console.log(`[voice] ${got.length}/${Object.keys(manifest.files).length} clips${got.length ? ': ' + got.join(', ') : ''}`);
