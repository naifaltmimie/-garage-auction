import { useEffect, useState, type ReactNode } from 'react';
import { makeModel, money } from '../../lib/util';
import type { RoomView } from '../useRoom';
import { Portal, useSheet } from './Bits';
import { LOGO } from './Logo';

// «شارك كراجك»: the night's garage drawn as a 1080×1350 poster on a canvas, in the game's three type roles on rubber:
// Voice (Lalezar) for the player's name, Print (Barlow Condensed) for every figure, Text (Readex Pro) for the words.
// The logo is drawn as it is; red and paper appear only where the brand puts them (the logo's tag, the paddle).
// Car photos come through the same-origin image proxy so the canvas stays exportable; a photo that will not load
// leaves a plain rubber frame, and if the browser still refuses the export the poster is drawn again without art.

const W = 1080;
const H = 1350;
const PAD = 72;
const VOICE = "'Lalezar', 'Readex Pro Variable', sans-serif";
const PRINT = "'Barlow Condensed', 'Readex Pro Variable', sans-serif";
const TEXT = "'Readex Pro Variable', system-ui, sans-serif";
const C = {
  bg0: '#0b0c0d',
  bg1: '#17181b',
  frame: '#1d1e22',
  line: '#34363d',
  hair: '#26282d',
  ink: '#f2f2f4',
  ink2: '#c6c8ce',
  mute: '#8d9098',
  red: '#ff4a4f',
  gain: '#55d892',
  alloy: '#d5d8de',
  alloyHi: '#f6f7f9',
  paper: '#fbfbf8',
  paperInk: '#111111',
};

export interface PosterData {
  room: string;
  date: string;
  player: string;
  paddle: number;
  rank: number;
  players: number;
  cars: { name: string; trim: string; year: number; paid: number; value: number; photo?: string }[];
  paid: number;
  value: number;
  profit: number;
  badges: string[];
}

type Face = 'voice' | 'print' | 'text';
const FAMILY: Record<Face, string> = { voice: VOICE, print: PRINT, text: TEXT };
const font = (face: Face, size: number, weight = 400) => `${face === 'voice' ? 400 : weight} ${size}px ${FAMILY[face]}`;

function draw(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { face: Face; size: number; weight?: number; color: string; align?: CanvasTextAlign }) {
  ctx.font = font(o.face, o.size, o.weight);
  ctx.fillStyle = o.color;
  // Arabic shapes and runs right to left; figures run left to right
  ctx.direction = o.face === 'print' ? 'ltr' : 'rtl';
  ctx.textAlign = o.align ?? 'right';
  ctx.fillText(s, x, y);
}

function width(ctx: CanvasRenderingContext2D, s: string, face: Face, size: number, weight = 400) {
  ctx.font = font(face, size, weight);
  ctx.direction = face === 'print' ? 'ltr' : 'rtl';
  return ctx.measureText(s).width;
}

/** The largest size from `size` down to `min` at which the line fits `max`. */
function fit(ctx: CanvasRenderingContext2D, s: string, face: Face, size: number, max: number, min: number, weight = 400) {
  let z = size;
  while (z > min && width(ctx, s, face, z, weight) > max) z -= 2;
  return z;
}

function clip(ctx: CanvasRenderingContext2D, s: string, face: Face, size: number, max: number, weight = 400) {
  if (width(ctx, s, face, size, weight) <= max) return s;
  let t = s;
  while (t.length > 1 && width(ctx, `${t}…`, face, size, weight) > max) t = t.slice(0, -1);
  return `${t.trim()}…`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => ok(im.naturalWidth > 40 ? im : null);
    im.onerror = () => ok(null);
    im.src = src;
  });
}

/** An SVG file given a pixel size of its own, so every browser will draw it on a canvas. */
async function sized(url: string, w: number, h: number): Promise<HTMLImageElement | null> {
  try {
    const s = await (await fetch(url)).text();
    return await img(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(s.replace('<svg ', `<svg width="${w}" height="${h}" `))}`);
  } catch {
    return null;
  }
}

/** A car's cover photo through the same-origin proxy (a direct Haraj image would taint the canvas). */
function photoUrl(u: string): string {
  if (u.startsWith('h:')) return `/api/img?u=${encodeURIComponent(`https://mimg6cdn.haraj.com.sa/${u.slice(2)}`)}`;
  return u;
}

function cover(ctx: CanvasRenderingContext2D, im: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const k = Math.max(w / im.naturalWidth, h / im.naturalHeight);
  const sw = w / k;
  const sh = h / k;
  ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

/** Waits for each of the three faces, with Arabic and Latin samples so every subset the poster uses is in. */
async function fontsReady() {
  const ar = 'مزاد الكراج كراج نايف';
  try {
    await Promise.all([
      document.fonts.load(font('voice', 80), ar),
      document.fonts.load(font('print', 60, 800), '0123456789,+−/'),
      document.fonts.load(font('print', 60, 700), '0123456789,+−/'),
      document.fonts.load(font('text', 40, 700), ar),
      document.fonts.load(font('text', 40, 500), ar),
    ]);
  } catch {
    /* falls back to the next family in the stack */
  }
}

/** A gain in green Print; a loss in chalk Print with a small red mark before it. Drawn from its left edge. */
function delta(ctx: CanvasRenderingContext2D, v: number, x: number, y: number, size: number) {
  const s = v > 0 ? `+${money(v)}` : v === 0 ? '0' : `−${money(-v)}`;
  if (v >= 0) {
    if (v === 0) {
      draw(ctx, s, x, y, { face: 'print', size, weight: 700, color: C.ink, align: 'left' });
      return width(ctx, s, 'print', size, 700);
    }
    draw(ctx, s, x, y, { face: 'print', size, weight: 700, color: C.gain, align: 'left' });
    return width(ctx, s, 'print', size, 700);
  }
  const r = Math.max(5, size * 0.14);
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(x + r, y - size * 0.34, r, 0, Math.PI * 2);
  ctx.fill();
  draw(ctx, s, x + r * 2 + 10, y, { face: 'print', size, weight: 700, color: C.ink, align: 'left' });
  return r * 2 + 10 + width(ctx, s, 'print', size, 700);
}

export async function drawPoster(d: PosterData, art = true): Promise<HTMLCanvasElement> {
  await fontsReady();
  const champ = d.rank === 1 && d.players > 1;
  const LOGO_H = 150;
  const LOGO_W = Math.round((LOGO_H * 224) / 196.2);
  const [logo, ...photos] = art
    ? await Promise.all([sized(LOGO.stack, LOGO_W * 2, LOGO_H * 2), ...d.cars.map((c) => (c.photo ? img(photoUrl(c.photo)) : Promise.resolve(null)))])
    : [null, ...d.cars.map(() => null)];

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  const R = W - PAD;
  const L = PAD;

  // rubber, a touch lighter where the light falls on the top
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(0.55, '#111214');
  g.addColorStop(1, C.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // the logo as it is, then the night
  if (logo) ctx.drawImage(logo, (W - LOGO_W) / 2, 56, LOGO_W, LOGO_H);
  else draw(ctx, 'مزاد الكراج', W / 2, 170, { face: 'voice', size: 84, color: C.ink, align: 'center' });
  const night = clip(ctx, [d.room, d.date].filter(Boolean).join('  ·  '), 'text', 26, W - PAD * 2, 500);
  draw(ctx, night, W / 2, 262, { face: 'text', size: 26, weight: 500, color: C.mute, align: 'center' });

  // the paddle (paper) and the name in the voice
  const nameMax = W - PAD * 2 - 120;
  const ns = fit(ctx, d.player, 'voice', 118, nameMax, 60);
  const nw = width(ctx, d.player, 'voice', ns);
  const PW = 84;
  const rowW = nw + 24 + PW;
  const nx = W / 2 + rowW / 2;
  const ny = 392;
  draw(ctx, d.player, nx, ny, { face: 'voice', size: ns, color: champ ? C.alloyHi : C.ink });
  const px = nx - nw - 24 - PW;
  const py = ny - ns * 0.5 - PW / 2 + 4;
  rr(ctx, px, py, PW, PW, PW / 2);
  ctx.fillStyle = champ ? C.alloy : C.paper;
  ctx.fill();
  draw(ctx, String(d.paddle).padStart(2, '0'), px + PW / 2, py + PW / 2 + 15, { face: 'print', size: 42, weight: 800, color: C.paperInk, align: 'center' });
  const where = d.players > 1 ? (champ ? `بطل الليلة، الأول من ${d.players}` : `المركز ${d.rank} من ${d.players}`) : 'مزاد لحاله';
  draw(ctx, where, W / 2, ny + 74, { face: 'text', size: 32, weight: 700, color: champ ? C.alloy : C.ink2, align: 'center' });

  // the cars as ruled rows: photo, model, what he paid, what it is worth
  const top = 500;
  const bottom = 1004;
  ctx.fillStyle = C.line;
  ctx.fillRect(L, top, W - PAD * 2, 3);
  const n = d.cars.length;
  if (!n) {
    draw(ctx, 'طلع من الليلة بلا سيارة، وفلوسه بجيبه', W / 2, (top + bottom) / 2 + 14, { face: 'text', size: 36, weight: 500, color: C.mute, align: 'center' });
  }
  const rowH = n ? Math.min(n <= 2 ? 196 : 168, (bottom - top) / n) : 0;
  const y0 = top + (n ? Math.max(0, (bottom - top - rowH * n) / 2) : 0);
  const big = rowH >= 180 ? 1.12 : rowH >= 150 ? 1 : rowH >= 120 ? 0.86 : 0.72;
  d.cars.forEach((c, i) => {
    const y = y0 + i * rowH;
    const ph = rowH - 32;
    const pw = Math.round(ph * 1.42);
    const pyy = y + 16;
    // photo at the row's start
    ctx.save();
    rr(ctx, R - pw, pyy, pw, ph, 12);
    ctx.fillStyle = C.frame;
    ctx.fill();
    ctx.clip();
    const im = photos[i];
    if (im) cover(ctx, im, R - pw, pyy, pw, ph);
    ctx.restore();
    // model and its line
    const tx = R - pw - 28;
    const leftCol = 300;
    const tmax = tx - (L + leftCol) - 16;
    const ms = Math.round(40 * big);
    draw(ctx, clip(ctx, c.name, 'text', ms, tmax, 700), tx, pyy + ph * 0.42, { face: 'text', size: ms, weight: 700, color: C.ink });
    const sub = [c.trim, String(c.year)].filter(Boolean).join('  ·  ');
    draw(ctx, clip(ctx, sub, 'text', Math.round(26 * big), tmax, 500), tx, pyy + ph * 0.42 + Math.round(44 * big), { face: 'text', size: Math.round(26 * big), weight: 500, color: C.mute });
    // figures at the row's end: what he paid, then the value and the gain
    const ps = Math.round(52 * big);
    const paidY = pyy + ph * 0.46;
    draw(ctx, money(c.paid), L, paidY, { face: 'print', size: ps, weight: 800, color: C.ink, align: 'left' });
    const pwid = width(ctx, money(c.paid), 'print', ps, 800);
    draw(ctx, 'دفع', L + pwid + 14, paidY, { face: 'text', size: Math.round(24 * big), weight: 500, color: C.mute, align: 'left' });
    const vy = paidY + Math.round(44 * big);
    const vs = Math.round(32 * big);
    const dw = delta(ctx, c.value - c.paid, L, vy, vs);
    draw(ctx, money(c.value), L + dw + 18, vy, { face: 'print', size: vs, weight: 700, color: C.ink2, align: 'left' });
    const vw = width(ctx, money(c.value), 'print', vs, 700);
    draw(ctx, 'قيمتها', L + dw + 18 + vw + 12, vy, { face: 'text', size: Math.round(22 * big), weight: 500, color: C.mute, align: 'left' });
    // the hairline under the row
    ctx.fillStyle = C.hair;
    ctx.fillRect(L, y + rowH - 1, W - PAD * 2, 2);
  });

  // the three totals on one ruled band
  const ty = 1022;
  ctx.fillStyle = C.line;
  ctx.fillRect(L, ty, W - PAD * 2, 3);
  const cw = (W - PAD * 2) / 3;
  const cols: [string, number, 'plain' | 'delta'][] = [
    ['دفع', d.paid, 'plain'],
    ['قيمة الكراج', d.value, 'plain'],
    [d.profit >= 0 ? 'الربح' : 'الخسارة', d.profit, 'delta'],
  ];
  cols.forEach(([label, v, kind], i) => {
    const cx = R - cw * i - cw / 2;
    draw(ctx, label, cx, ty + 54, { face: 'text', size: 26, weight: 500, color: C.mute, align: 'center' });
    const s = kind === 'delta' ? (v > 0 ? `+${money(v)}` : v === 0 ? '0' : `−${money(-v)}`) : money(v);
    const z = fit(ctx, s, 'print', 64, cw - 40, 36, 800);
    if (kind === 'delta') {
      const w = width(ctx, s, 'print', z, 700) + (v < 0 ? z * 0.28 + 10 : 0);
      delta(ctx, v, cx - w / 2, ty + 124, z);
    } else {
      draw(ctx, s, cx, ty + 124, { face: 'print', size: z, weight: 800, color: C.ink, align: 'center' });
    }
  });
  ctx.fillStyle = C.hair;
  ctx.fillRect(L, ty + 160, W - PAD * 2, 2);

  // the awards he won, as words
  const aw = [...new Set(d.badges)];
  if (aw.length) {
    const s = clip(ctx, aw.join('  ·  '), 'text', 32, W - PAD * 2, 700);
    draw(ctx, s, W / 2, ty + 218, { face: 'text', size: 32, weight: 700, color: champ ? C.alloy : C.ink, align: 'center' });
  }

  // the address
  draw(ctx, 'garage-auction.vercel.app', L, H - 44, { face: 'print', size: 30, weight: 700, color: C.mute, align: 'left' });
  draw(ctx, 'سيارات حقيقية من السوق السعودي', R, H - 44, { face: 'text', size: 24, weight: 500, color: C.mute });
  return cv;
}

function dateAr(): string {
  try {
    return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function posterFor(room: RoomView, badges: string[]): PosterData | null {
  const core = room.snap.core;
  const res = room.snap.hist?.results;
  if (!core || !res) return null;
  const me = core.players.find((p) => p.id === room.myId);
  const row = res.rows.find((r) => r.id === room.myId);
  if (!me || !row) return null;
  const mine = (room.snap.hist?.sales ?? []).filter((s) => s.buyer === me.id && s.outcome === 'sold');
  return {
    room: core.settings.roomName,
    date: dateAr(),
    player: me.name,
    paddle: me.paddle,
    rank: row.rank,
    players: res.rows.length,
    cars: mine.map((s) => ({ name: makeModel(s.car.makeAr, s.car.modelAr), trim: s.car.trimAr || s.car.trim, year: s.car.year, paid: s.paid, value: s.value, photo: s.car.photos?.[0] })),
    paid: row.paid,
    value: row.value,
    profit: row.profit,
    badges,
  };
}

/** «شارك كراجك»: makes the poster on demand and holds its preview dialog («شارك الصورة», «حمّلها»). */
export function useShareGarage(room: RoomView, badges: string[]): { make: () => void; busy: boolean; can: boolean; dialog: ReactNode } {
  const [busy, setBusy] = useState(false);
  const [im, setIm] = useState<{ url: string; blob: Blob } | null>(null);
  useEffect(
    () => () => {
      if (im) URL.revokeObjectURL(im.url);
    },
    [im],
  );
  const can = !!posterFor(room, badges);

  const make = async () => {
    const d = posterFor(room, badges);
    if (!d || busy) return;
    setBusy(true);
    try {
      const toBlob = (cv: HTMLCanvasElement) => new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
      let blob: Blob | null = null;
      try {
        blob = await toBlob(await drawPoster(d));
      } catch {
        blob = await toBlob(await drawPoster(d, false));
      }
      if (blob) setIm({ url: URL.createObjectURL(blob), blob });
      else room.toast('ما قدرنا نجهز الصورة، جرّب مرة ثانية', 'bad');
    } catch {
      room.toast('ما قدرنا نجهز الصورة، جرّب مرة ثانية', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!im) return;
    const a = document.createElement('a');
    a.href = im.url;
    a.download = 'kraji-mazad.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    if (!im) return;
    try {
      const file = new File([im.blob], 'kraji-mazad.png', { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'كراجي في مزاد الكراج' });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    download();
  };

  return { make, busy, can, dialog: im ? <SharePreview url={im.url} onShare={share} onSave={download} onClose={() => setIm(null)} /> : null };
}

function SharePreview({ url, onShare, onSave, onClose }: { url: string; onShare: () => void; onSave: () => void; onClose: () => void }) {
  const ref = useSheet<HTMLDivElement>(onClose);
  return (
    <Portal>
      <div className="e-share-back" role="dialog" aria-modal="true" aria-label="صورة كراجك" onClick={onClose}>
        <div className="e-share" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <img className="e-share-img" src={url} alt="صورة كراجك الليلة" width={1080} height={1350} />
          <div className="e-share-btns">
            <button className="btn btn-primary e-go" onClick={onShare}>
              شارك الصورة
            </button>
            <div className="e-share-row">
              <button className="btn btn-ghost" onClick={onSave}>
                حمّلها
              </button>
              <button className="btn btn-quiet" onClick={onClose}>
                سكّر
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
