// Build-time QA for the auction's ad photos: CLIP zero-shot labels for every photo
// (exterior / interior / dashboard / odometer / engine / wheel / screenshot / paper / person / parts …)
// and a body-type guess for the first exterior. Results are printed to the build log.
import fs from 'node:fs';
import { pipeline, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;
const ads = JSON.parse(fs.readFileSync(new URL('./input.json', import.meta.url), 'utf8'));

const KINDS = [
  ['E', 'a photo of a car parked outside, the whole car seen from the outside'],
  ['E', 'a photo of the front of a car'],
  ['E', 'a photo of the side of a car'],
  ['E', 'a photo of the back of a car'],
  ['E', 'a photo of a pickup truck parked outside'],
  ['I', 'a photo of the seats inside a car'],
  ['D', 'a photo of a car dashboard and steering wheel'],
  ['O', 'a close-up photo of a car instrument cluster with the odometer'],
  ['N', 'a photo of a car engine under the open hood'],
  ['W', 'a close-up photo of a car wheel and tire'],
  ['T', 'a photo of the inside of a car trunk'],
  ['L', 'a close-up photo of a car headlight or taillight'],
  ['S', 'a screenshot or an advertisement graphic with text'],
  ['P', 'a photo of a paper document'],
  ['X', 'a photo of a person'],
  ['G', 'a photo of car spare parts on the floor'],
  ['K', 'a photo of car keys'],
];
const BODIES = [
  ['sedan', 'a photo of a sedan car'],
  ['suv', 'a photo of an SUV'],
  ['pickup', 'a photo of a pickup truck'],
  ['van', 'a photo of a van or a minibus'],
  ['coupe', 'a photo of a two-door sports coupe'],
  ['hatch', 'a photo of a small hatchback car'],
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
async function load(path) {
  for (const url of [`https://postcdn.haraj.com.sa/${path}-700.webp`, `https://mimg6cdn.haraj.com.sa/${path}`]) {
    for (let t = 0; t < 2; t++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/webp,image/*' } });
        if (!r.ok) break;
        const blob = await r.blob();
        if (blob.size < 2000) break;
        return await RawImage.fromBlob(blob);
      } catch {
        /* retry */
      }
    }
  }
  return null;
}

const t0 = Date.now();
const clf = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', { dtype: 'q8' });
console.log(`QA model ready in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${ads.length} ads`);

let done = 0;
const lines = [];
async function one(ad) {
  const imgs = await Promise.all(ad.i.map((p) => load(p)));
  const ok = imgs.map((im, k) => [im, k]).filter(([im]) => im);
  const codes = imgs.map(() => '?');
  const ext = imgs.map(() => '00');
  let body = '-';
  if (ok.length) {
    const res = await clf(ok.map(([im]) => im), KINDS.map((x) => x[1]), { hypothesis_template: '{}' });
    const all = ok.length === 1 ? [res] : res;
    all.forEach((rs, j) => {
      const k = ok[j][1];
      const score = {};
      for (const r of rs) {
        const code = KINDS.find((x) => x[1] === r.label)[0];
        score[code] = (score[code] ?? 0) + r.score;
      }
      codes[k] = Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
      ext[k] = String(Math.min(99, Math.round((score.E ?? 0) * 100))).padStart(2, '0');
    });
    const first = codes.indexOf('E');
    if (first >= 0) {
      const br = await clf(imgs[first], BODIES.map((x) => x[1]), { hypothesis_template: '{}' });
      const b = BODIES.find((x) => x[1] === br[0].label)[0];
      body = `${b}:${Math.round(br[0].score * 100)}@${first}`;
    }
  }
  const line = `R|${ad.k}|${ad.c}|${ad.b}|${body}|${codes.join('')}|${ext.join(',')}`;
  lines.push(line);
  console.log(line);
  done++;
}

const queue = [...ads];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const ad = queue.shift();
      try {
        await one(ad);
      } catch (e) {
        console.log(`R|${ad.k}|${ad.c}|${ad.b}|ERR|${String(e).slice(0, 120)}`);
      }
    }
  }),
);
console.log(`QA done ${done}/${ads.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/results.txt', lines.join('\n'));
