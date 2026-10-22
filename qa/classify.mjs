// Build-time photo QA for the auction's real ads (runs on Vercel, which can reach the Haraj CDN).
// CLIP ViT-B/16: one vision pass per photo, every question answered against pre-computed text embeddings.
// Per ad: what each photo shows (exterior first?), the car's colour, pickup cab, visible crash damage,
// body type, and how well the photos match the claimed model. Printed to the build log + dist/results.txt.
import fs from 'node:fs';
import { AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage, env } from '@huggingface/transformers';

env.allowLocalModels = false;
const ads = JSON.parse(fs.readFileSync(new URL('./input.json', import.meta.url), 'utf8'));
const MODELS = JSON.parse(fs.readFileSync(new URL('./models.json', import.meta.url), 'utf8'));

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
const COLORS = [
  ['w', 'a photo of a white car'], ['w', 'a photo of a pearl white car'], ['k', 'a photo of a black car'],
  ['s', 'a photo of a silver car'], ['g', 'a photo of a dark grey car'], ['r', 'a photo of a red car'],
  ['m', 'a photo of a maroon car'], ['b', 'a photo of a blue car'], ['n', 'a photo of a navy blue car'],
  ['e', 'a photo of a beige car'], ['c', 'a photo of a champagne gold car'], ['o', 'a photo of a brown car'],
  ['v', 'a photo of a green car'], ['y', 'a photo of a yellow car'], ['a', 'a photo of an orange car'],
];
const BODIES = [
  ['sedan', 'a photo of a sedan car'], ['suv', 'a photo of an SUV'], ['pickup', 'a photo of a pickup truck'],
  ['van', 'a photo of a van or a minibus'], ['coupe', 'a photo of a two-door sports coupe'], ['hatch', 'a photo of a small hatchback car'],
];
const CABS = [
  ['s', 'a photo of a single cab pickup truck with two doors and a long cargo bed'],
  ['d', 'a photo of a crew cab pickup truck with four doors'],
];
const DAMAGE = [
  ['1', 'a photo of a car with heavy crash damage'], ['1', 'a photo of a wrecked car'], ['1', 'a photo of a car with a smashed bumper'],
  ['0', 'a photo of a clean car in good condition'], ['0', 'a photo of a shiny car for sale'],
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
let M = 'Xenova/clip-vit-base-patch16';
let tokenizer, processor, textModel, visionModel;
try {
  tokenizer = await AutoTokenizer.from_pretrained(M);
  processor = await AutoProcessor.from_pretrained(M);
  textModel = await CLIPTextModelWithProjection.from_pretrained(M, { dtype: 'q8' });
  visionModel = await CLIPVisionModelWithProjection.from_pretrained(M, { dtype: 'q8' });
} catch (e) {
  console.log('QA patch16 failed, falling back:', String(e).slice(0, 200));
  M = 'Xenova/clip-vit-base-patch32';
  tokenizer = await AutoTokenizer.from_pretrained(M);
  processor = await AutoProcessor.from_pretrained(M);
  textModel = await CLIPTextModelWithProjection.from_pretrained(M, { dtype: 'q8' });
  visionModel = await CLIPVisionModelWithProjection.from_pretrained(M, { dtype: 'q8' });
}

function norm(v) {
  let s = 0;
  for (const x of v) s += x * x;
  s = Math.sqrt(s) || 1;
  return v.map((x) => x / s);
}
async function embedTexts(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 32) {
    const inp = tokenizer(texts.slice(i, i + 32), { padding: true, truncation: true });
    const { text_embeds } = await textModel(inp);
    const [n, d] = text_embeds.dims;
    for (let r = 0; r < n; r++) out.push(norm(Array.from(text_embeds.data.slice(r * d, (r + 1) * d))));
  }
  return out;
}
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
function softmaxGroup(img, embs) {
  const l = embs.map((t) => 100 * dot(img, t));
  const m = Math.max(...l);
  const e = l.map((x) => Math.exp(x - m));
  const z = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / z);
}
function score(img, group, embs) {
  const p = softmaxGroup(img, embs);
  const acc = {};
  group.forEach(([k], i) => (acc[k] = (acc[k] ?? 0) + p[i]));
  return acc;
}
const top = (acc) => Object.entries(acc).sort((a, b) => b[1] - a[1])[0];

const E = {
  kinds: await embedTexts(KINDS.map((x) => x[1])),
  colors: await embedTexts(COLORS.map((x) => x[1])),
  bodies: await embedTexts(BODIES.map((x) => x[1])),
  cabs: await embedTexts(CABS.map((x) => x[1])),
  damage: await embedTexts(DAMAGE.map((x) => x[1])),
  models: await embedTexts(MODELS.map((n) => `a photo of a ${n}`)),
};
console.log(`QA ${M} ready in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${ads.length} ads, ${MODELS.length} model names`);

async function embedImages(imgs) {
  const out = [];
  for (let i = 0; i < imgs.length; i += 8) {
    const inp = await processor(imgs.slice(i, i + 8));
    const { image_embeds } = await visionModel(inp);
    const [n, d] = image_embeds.dims;
    for (let r = 0; r < n; r++) out.push(norm(Array.from(image_embeds.data.slice(r * d, (r + 1) * d))));
  }
  return out;
}
const avg = (vs) => norm(vs[0].map((_, i) => vs.reduce((s, v) => s + v[i], 0) / vs.length));

const lines = [];
let done = 0;
async function one(ad) {
  const imgs = await Promise.all(ad.i.map((p) => load(p)));
  const ok = imgs.map((im, k) => [im, k]).filter(([im]) => im);
  const codes = imgs.map(() => '?');
  if (!ok.length) {
    lines.push(`${ad.k} ${codes.join('')} - - - - - -`);
    return;
  }
  const embs = await embedImages(ok.map(([im]) => im));
  const byK = new Map();
  ok.forEach(([, k], j) => byK.set(k, embs[j]));
  for (const [k, v] of byK) codes[k] = top(score(v, KINDS, E.kinds))[0];
  const ext = [...byK.entries()].filter(([k]) => codes[k] === 'E').map(([, v]) => v);
  let color = '-', body = '-', cab = '-', dmg = '-', mrank = '-', mprob = '-';
  if (ext.length) {
    const main = avg(ext.slice(0, 2));
    const c = top(score(main, COLORS, E.colors));
    color = `${c[0]}${Math.min(9, Math.floor(c[1] * 10))}`;
    const b = top(score(avg(ext.slice(0, 3)), BODIES, E.bodies));
    body = `${b[0]}${Math.min(9, Math.floor(b[1] * 10))}`;
    if (ad.b === 'pickup' || b[0] === 'pickup') {
      const cb = top(score(avg(ext.slice(0, 3)), CABS, E.cabs));
      cab = `${cb[0]}${Math.min(9, Math.floor(cb[1] * 10))}`;
    }
    dmg = String(Math.min(9, Math.floor(Math.max(...ext.slice(0, 4).map((v) => score(v, DAMAGE, E.damage)['1'])) * 10)));
    const pm = softmaxGroup(avg(ext.slice(0, 3)), E.models);
    const want = MODELS.indexOf(ad.n);
    const order = pm.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
    const r = order.findIndex(([, i]) => i === want);
    mrank = String(Math.min(99, r + 1));
    mprob = `${Math.round(pm[want] * 100)}:${MODELS[order[0][1]].replace(/\s+/g, '_')}`;
  }
  const line = `${ad.k} ${codes.join('')} ${color} ${body} ${cab} ${dmg} ${mrank} ${mprob}`;
  lines.push(line);
  done++;
  if (done % 25 === 0) console.log(`QA ${done}/${ads.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

const queue = [...ads];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const ad = queue.shift();
      try {
        await one(ad);
      } catch (e) {
        lines.push(`${ad.k} ERR ${String(e).slice(0, 80).replace(/\s+/g, '_')}`);
      }
    }
  }),
);
console.log(`QA done ${done}/${ads.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/results.txt', lines.sort().join('\n'));
