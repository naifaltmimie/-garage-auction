import { useEffect, useState } from 'react';
import { money, signed } from '../../lib/util';
import type { RoomView } from '../useRoom';
import { Portal, useSheet } from './Bits';
import { LOGO } from './Logo';

// «شارك كراجك»: the night's garage drawn as a 1080×1350 poster on a canvas, dressed like the game:
// rubber black, a strip of tread top and bottom, the price-tag logo, rim gold only for the night's champion.
// Text only (Haraj photos would taint the canvas), Arabic drawn right-to-left with the page font.
// The logo and the tyre are same-origin / data: SVGs; if a browser still refuses them, it's drawn again without.

const W = 1080;
const H = 1350;
const PAD = 80;
const FONT = "'IBM Plex Sans Arabic', system-ui, sans-serif";
const C = {
  bg0: '#0b0c0d',
  bg1: '#1a1b1e',
  card: '#1d1e22',
  card2: '#141518',
  line: '#2b2d32',
  ink: '#f2f2f4',
  ink2: '#c6c8ce',
  mute: '#8d9098',
  dim: '#5d6068',
  red: '#e5262d',
  redHi: '#ff4a4f',
  gold: '#e8b955',
  goldHi: '#f6cf74',
  goldLine: 'rgba(232, 185, 85, .55)',
  goldHair: 'rgba(232, 185, 85, .22)',
  gain: '#55d892',
  loss: '#ff6b6f',
};

// the theme's tread (theme.css --tex-tread), drawn a size up for the poster
const TREAD = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="36" viewBox="0 0 40 24"><path d="M-2 3 L20 13 L42 3" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="5.5" stroke-linejoin="miter"/><path d="M-2 -.6 L20 9.4 L42 -.6" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="1.1"/></svg>`;

export interface PosterData {
  room: string;
  date: string;
  player: string;
  rank: number;
  players: number;
  cars: { name: string; trim: string; year: number; paid: number; value: number }[];
  paid: number;
  value: number;
  profit: number;
  badges: string[];
}

function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, max: number, min = 24): number {
  let s = size;
  for (; s > min; s -= 2) {
    ctx.font = `${weight} ${s}px ${FONT}`;
    if (ctx.measureText(text).width <= max) break;
  }
  ctx.font = `${weight} ${s}px ${FONT}`;
  return s;
}

function clip(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trim()}…`;
}

function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size: number; weight?: number; color: string; align?: CanvasTextAlign; dir?: CanvasDirection }) {
  ctx.font = `${o.weight ?? 500} ${o.size}px ${FONT}`;
  ctx.fillStyle = o.color;
  ctx.direction = o.dir ?? 'rtl';
  ctx.textAlign = o.align ?? 'right';
  ctx.fillText(s, x, y);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const svgData = (s: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;

function img(src: string): Promise<HTMLImageElement | null> {
  return new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = src;
  });
}

/** An SVG file given a pixel size of its own, so every browser will draw it on a canvas. */
async function sized(url: string, w: number, h: number): Promise<HTMLImageElement | null> {
  try {
    const s = await (await fetch(url)).text();
    return await img(svgData(s.replace('<svg ', `<svg width="${w}" height="${h}" `)));
  } catch {
    return null;
  }
}

/** The theme's tyre drawing (--tex-tire), at a pixel size. */
async function tyre(size: number): Promise<HTMLImageElement | null> {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--tex-tire').trim();
    const m = v.match(/^url\((["']?)(data:image\/svg\+xml,.*)\1\)$/);
    if (!m) return null;
    const s = decodeURIComponent(m[2].slice('data:image/svg+xml,'.length));
    return await img(svgData(s.replace('<svg ', `<svg width="${size}" height="${size}" `)));
  } catch {
    return null;
  }
}

/** A bar of rubber with tread cut across it, like the game's top bars. */
function treadBar(ctx: CanvasRenderingContext2D, y: number, h: number, pat: CanvasPattern | null) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#26272c');
  g.addColorStop(0.55, '#191a1d');
  g.addColorStop(1, '#121315');
  ctx.fillStyle = g;
  ctx.fillRect(0, y, W, h);
  if (pat) {
    ctx.save();
    ctx.translate(0, y + h / 2 - 18);
    ctx.fillStyle = pat;
    ctx.fillRect(0, 18 - h / 2, W, h);
    ctx.restore();
  }
}

export async function drawPoster(d: PosterData, art = true): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`), document.fonts.load(`600 40px ${FONT}`)]);
  } catch {
    /* falls back to the system font */
  }
  const champ = d.rank === 1 && d.players > 1;
  const LOGO_H = 168;
  const LOGO_W = Math.round((LOGO_H * 224) / 196.2);
  const [logo, tread, wheel] = art ? await Promise.all([sized(LOGO.stack, LOGO_W * 2, LOGO_H * 2), img(svgData(TREAD)), tyre(1100)]) : [null, null, null];

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';
  const pat = tread ? ctx.createPattern(tread, 'repeat') : null;

  // ground: matte rubber, lit a touch from the top; a big tyre rolls in behind, barely there
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const lit = ctx.createRadialGradient(W / 2, 140, 20, W / 2, 140, 760);
  lit.addColorStop(0, champ ? 'rgba(232, 185, 85, .12)' : 'rgba(255, 255, 255, .05)');
  lit.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = lit;
  ctx.fillRect(0, 0, W, H);
  if (wheel) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.drawImage(wheel, -760, 560, 1100, 1100);
    ctx.restore();
  }

  // tread across the top, with the caliper-red line under it (gold for the champion)
  treadBar(ctx, 0, 64, pat);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 64, W, 2);
  ctx.fillStyle = champ ? C.gold : C.red;
  ctx.fillRect(0, 66, W, 5);

  // the price-tag logo, then the date
  const R = W - PAD;
  if (logo) {
    ctx.drawImage(logo, (W - LOGO_W) / 2, 98, LOGO_W, LOGO_H);
  } else {
    txt(ctx, 'مزاد الكراج', W / 2, 200, { size: 64, weight: 700, color: C.ink, align: 'center' });
  }
  txt(ctx, d.date, W / 2, 318, { size: 26, weight: 500, color: C.mute, align: 'center' });

  // who, and where they finished
  txt(ctx, champ ? 'بطل الليلة' : 'كراج الليلة', W / 2, 392, { size: 30, weight: 700, color: champ ? C.gold : C.redHi, align: 'center' });
  const ns = fit(ctx, d.player, 700, 104, W - PAD * 2, 56);
  txt(ctx, d.player, W / 2, 392 + ns + 2, { size: ns, weight: 700, color: champ ? C.goldHi : C.ink, align: 'center' });
  let y = 392 + ns + 34;
  {
    const where = d.players > 1 ? `المركز ${d.rank} من ${d.players}  ·  ${d.room}` : d.room;
    ctx.font = `600 28px ${FONT}`;
    const label = clip(ctx, where, W - PAD * 2 - 60);
    const w = ctx.measureText(label).width + 56;
    const x = (W - w) / 2;
    rr(ctx, x, y, w, 58, 29);
    if (champ) {
      const gg = ctx.createLinearGradient(0, y, 0, y + 58);
      gg.addColorStop(0, '#fbe39b');
      gg.addColorStop(0.45, '#efc463');
      gg.addColorStop(1, '#c68b2d');
      ctx.fillStyle = gg;
      ctx.fill();
    } else {
      ctx.fillStyle = C.card;
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    txt(ctx, label, W / 2, y + 39, { size: 28, weight: 600, color: champ ? '#2a1b00' : C.ink2, align: 'center' });
    y += 58;
  }

  // the cars: a card each, the block centred in its space
  const top = y + 30;
  const bottom = 968;
  const n = Math.max(1, d.cars.length);
  const gap = n > 4 ? 10 : 16;
  const rowH = Math.min(150, (bottom - top - gap * (n - 1)) / n);
  const big = rowH >= 120 ? 42 : rowH >= 96 ? 36 : rowH >= 76 ? 30 : 24;
  const small = rowH >= 120 ? 26 : rowH >= 96 ? 24 : rowH >= 76 ? 21 : 18;
  const y00 = top + Math.max(0, (bottom - top - (rowH * n + gap * (n - 1))) / 2);
  if (!d.cars.length) {
    txt(ctx, 'طلع من الليلة بلا سيارة، وفلوسه بجيبه', W / 2, top + (bottom - top) / 2, { size: 36, weight: 600, color: C.mute, align: 'center' });
  }
  d.cars.forEach((c, i) => {
    const y0 = y00 + i * (rowH + gap);
    const cg = ctx.createLinearGradient(0, y0, 0, y0 + rowH);
    cg.addColorStop(0, '#202126');
    cg.addColorStop(1, '#17181b');
    rr(ctx, PAD, y0, W - PAD * 2, rowH, 18);
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, .05)';
    ctx.fillRect(PAD + 18, y0 + 1, W - PAD * 2 - 36, 2);
    const mid = y0 + rowH / 2 + (rowH >= 76 ? -4 : 6);
    const l2 = mid + small + 10;
    const profit = c.value - c.paid;
    // its number in the garage
    txt(ctx, String(i + 1).padStart(2, '0'), R - 26, mid, { size: 22, weight: 700, color: C.redHi, dir: 'ltr' });
    // left: what he paid, then the gain or loss and the value
    txt(ctx, money(c.paid), PAD + 28, mid, { size: big, weight: 700, color: C.ink, align: 'left', dir: 'ltr' });
    if (rowH >= 76) {
      const lineB = signed(profit);
      txt(ctx, lineB, PAD + 28, l2, { size: small, weight: 600, color: profit >= 0 ? C.gain : C.loss, align: 'left', dir: 'ltr' });
      ctx.font = `600 ${small}px ${FONT}`;
      const wB = ctx.measureText(lineB).width;
      txt(ctx, `القيمة ${money(c.value)}`, PAD + 28 + wB + 16, l2, { size: small, weight: 500, color: C.mute, align: 'left', dir: 'rtl' });
    }
    // right: the car
    ctx.font = `700 ${big}px ${FONT}`;
    txt(ctx, clip(ctx, c.name, 470), R - 76, mid, { size: big, weight: 700, color: C.ink });
    if (rowH >= 76) {
      ctx.font = `500 ${small}px ${FONT}`;
      txt(ctx, clip(ctx, `${c.trim ? `${c.trim}  ·  ` : ''}${c.year}`, 430), R - 76, l2, { size: small, weight: 500, color: C.mute });
    }
  });

  // the totals, sunk into the rubber
  const ty = 994;
  rr(ctx, PAD, ty, W - PAD * 2, 132, 20);
  ctx.fillStyle = C.card2;
  ctx.fill();
  ctx.strokeStyle = champ ? C.goldLine : C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
  const cols = [
    { label: 'دفع', v: money(d.paid), color: C.ink },
    { label: 'قيمة الكراج', v: money(d.value), color: C.ink },
    { label: d.profit >= 0 ? 'الربح' : 'الخسارة', v: signed(d.profit), color: d.profit >= 0 ? C.gain : C.loss },
  ];
  const cw = (W - PAD * 2) / 3;
  cols.forEach((c, i) => {
    const cx = R - cw * i - cw / 2;
    txt(ctx, c.label, cx, ty + 48, { size: 24, weight: 600, color: C.mute, align: 'center' });
    const s = fit(ctx, c.v, 700, 44, cw - 28, 26);
    txt(ctx, c.v, cx, ty + 104, { size: s, weight: 700, color: c.color, align: 'center', dir: 'ltr' });
    if (i > 0) {
      ctx.fillStyle = C.line;
      ctx.fillRect(R - cw * i, ty + 22, 2, 88);
    }
  });

  // the night's badges: one centred row of rim-gold pills
  ctx.font = `600 26px ${FONT}`;
  const pills: { b: string; w: number }[] = [];
  let tw = 0;
  for (const b of [...new Set(d.badges)]) {
    const w = ctx.measureText(b).width + 44;
    if (tw + w + (pills.length ? 14 : 0) > W - PAD * 2) break;
    tw += w + (pills.length ? 14 : 0);
    pills.push({ b, w });
  }
  let bx = W / 2 + tw / 2;
  const by = 1150;
  for (const { b, w } of pills) {
    rr(ctx, bx - w, by, w, 54, 27);
    ctx.fillStyle = 'rgba(232, 185, 85, .1)';
    ctx.fill();
    ctx.strokeStyle = C.goldLine;
    ctx.lineWidth = 2;
    ctx.stroke();
    txt(ctx, b, bx - w / 2, by + 36, { size: 26, weight: 600, color: C.goldHi, align: 'center' });
    bx -= w + 14;
  }

  // foot: the address over a last strip of tread
  txt(ctx, 'garage-auction.vercel.app', PAD, H - 92, { size: 22, weight: 600, color: C.mute, align: 'left', dir: 'ltr' });
  txt(ctx, 'سيارات حقيقية من السوق السعودي', R, H - 92, { size: 22, weight: 500, color: C.mute });
  ctx.fillStyle = champ ? C.gold : C.red;
  ctx.fillRect(0, H - 54, W, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, H - 50, W, 2);
  treadBar(ctx, H - 48, 48, pat);
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
    rank: row.rank,
    players: res.rows.length,
    cars: mine.map((s) => ({ name: `${s.car.makeAr} ${s.car.modelAr}`, trim: s.car.trimAr || s.car.trim, year: s.car.year, paid: s.paid, value: s.value })),
    paid: row.paid,
    value: row.value,
    profit: row.profit,
    badges,
  };
}

/** The button, and a preview sheet with share / download. */
export function ShareGarage({ room, badges }: { room: RoomView; badges: string[] }) {
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<{ url: string; blob: Blob } | null>(null);
  useEffect(() => () => {
    if (img) URL.revokeObjectURL(img.url);
  }, [img]);

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
        // a browser that won't export a canvas with SVG on it: the same poster without the logo and the tyre
        blob = await toBlob(await drawPoster(d, false));
      }
      if (blob) setImg({ url: URL.createObjectURL(blob), blob });
      else room.toast('ما قدرنا نجهز الصورة، جرّب مرة ثانية', 'bad');
    } catch {
      room.toast('ما قدرنا نجهز الصورة، جرّب مرة ثانية', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!img) return;
    const a = document.createElement('a');
    a.href = img.url;
    a.download = 'kraji-mazad.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    if (!img) return;
    try {
      const file = new File([img.blob], 'kraji-mazad.png', { type: 'image/png' });
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

  return (
    <>
      <button className="btn btn-gold btn-block aw-share" onClick={make} disabled={busy}>
        {busy && <i className="spinner sg-spin" aria-hidden />}
        {busy ? 'نجهز الصورة…' : 'شارك كراجك'}
      </button>
      {img && <SharePreview url={img.url} onShare={share} onSave={download} onClose={() => setImg(null)} />}
    </>
  );
}

function SharePreview({ url, onShare, onSave, onClose }: { url: string; onShare: () => void; onSave: () => void; onClose: () => void }) {
  const ref = useSheet<HTMLDivElement>(onClose);
  return (
    <Portal>
      <div className="sg-back" role="dialog" aria-modal="true" aria-label="صورة كراجك" onClick={onClose}>
        <div className="sg-sheet" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <img className="sg-img" src={url} alt="صورة كراجك الليلة" width={1080} height={1350} />
          <div className="sg-btns">
            <button className="btn btn-primary" onClick={onShare}>
              شارك الصورة
            </button>
            <button className="btn btn-ghost" onClick={onSave}>
              حمّلها
            </button>
            <button className="btn btn-quiet" onClick={onClose}>
              سكّر
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
