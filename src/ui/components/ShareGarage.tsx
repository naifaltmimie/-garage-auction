import { useEffect, useState } from 'react';
import { money, signed } from '../../lib/util';
import type { RoomView } from '../useRoom';

// «شارك كراجك»: the night's garage drawn as a 1080×1350 poster on a canvas.
// Text only (Haraj photos would taint the canvas), Arabic drawn right-to-left with the page font.

const W = 1080;
const H = 1350;
const PAD = 96;
const FONT = "'IBM Plex Sans Arabic', system-ui, sans-serif";
const C = {
  bg: '#05271c',
  bg2: '#031a13',
  cream: '#f3eee1',
  mute: '#9fb4a8',
  dim: '#6f877a',
  gold: '#d6ad52',
  goldLine: 'rgba(214, 173, 82, .55)',
  hair: 'rgba(214, 173, 82, .2)',
  gain: '#86d9ab',
  loss: '#f2a093',
};

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

function rule(ctx: CanvasRenderingContext2D, y: number, color = C.hair, x0 = PAD, x1 = W - PAD) {
  ctx.fillStyle = color;
  ctx.fillRect(x0, y, x1 - x0, 2);
}

export async function drawPoster(d: PosterData): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`500 40px ${FONT}`), document.fonts.load(`600 40px ${FONT}`)]);
  } catch {
    /* falls back to the system font */
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';

  // ground: deep green, a soft light from the top, a certificate double frame in gold
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.bg);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 40, W / 2, -120, 900);
  glow.addColorStop(0, 'rgba(214, 173, 82, .16)');
  glow.addColorStop(1, 'rgba(214, 173, 82, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = C.hair;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // masthead
  const R = W - PAD;
  txt(ctx, 'مزاد الكراج', R, 132, { size: 34, weight: 700, color: C.gold });
  txt(ctx, d.date, PAD, 132, { size: 26, weight: 500, color: C.mute, align: 'left' });
  rule(ctx, 160, C.goldLine);

  // who
  txt(ctx, 'كراج الليلة', R, 250, { size: 30, weight: 600, color: C.gold });
  const ns = fit(ctx, d.player, 700, 112, W - PAD * 2, 56);
  txt(ctx, d.player, R, 250 + ns + 6, { size: ns, weight: 700, color: C.cream });
  let y = 250 + ns + 70;
  const where = d.players > 1 ? `${d.room}  ·  المركز ${d.rank} من ${d.players}` : d.room;
  ctx.font = `500 30px ${FONT}`;
  txt(ctx, clip(ctx, where, W - PAD * 2), R, y, { size: 30, weight: 500, color: C.mute });
  y += 48;
  rule(ctx, y);

  // the cars: generous rows when the garage is small, the block centred in its space
  const top = y + 10;
  const bottom = 956;
  const n = Math.max(1, d.cars.length);
  const rowH = Math.min(168, (bottom - top) / n);
  const big = rowH >= 150 ? 46 : rowH >= 110 ? 40 : rowH >= 90 ? 34 : 28;
  const small = rowH >= 150 ? 28 : rowH >= 110 ? 26 : 22;
  const y00 = top + Math.max(0, (bottom - top - rowH * n) / 2);
  if (!d.cars.length) {
    txt(ctx, 'طلع من الليلة بلا سيارة، وفلوسه بجيبه', W / 2, top + (bottom - top) / 2, { size: 38, weight: 600, color: C.mute, align: 'center' });
  }
  d.cars.forEach((c, i) => {
    const y0 = y00 + i * rowH;
    const mid = y0 + rowH / 2;
    const profit = c.value - c.paid;
    const l2 = mid + small + 12;
    // number of the car in the garage, a quiet gold index
    txt(ctx, String(i + 1).padStart(2, '0'), R, y0 + 34, { size: 20, weight: 600, color: C.goldLine, dir: 'ltr' });
    // left block: paid, then value and the gain/loss
    txt(ctx, money(c.paid), PAD, mid, { size: big, weight: 700, color: C.cream, align: 'left', dir: 'ltr' });
    const lineB = signed(profit);
    txt(ctx, lineB, PAD, l2, { size: small, weight: 600, color: profit >= 0 ? C.gain : C.loss, align: 'left', dir: 'ltr' });
    ctx.font = `600 ${small}px ${FONT}`;
    const wB = ctx.measureText(lineB).width;
    txt(ctx, `القيمة ${money(c.value)}`, PAD + wB + 18, l2, { size: small, weight: 500, color: C.mute, align: 'left', dir: 'rtl' });
    // right block: the car
    ctx.font = `700 ${big}px ${FONT}`;
    txt(ctx, clip(ctx, c.name, 540), R - 52, mid, { size: big, weight: 700, color: C.cream });
    ctx.font = `500 ${small}px ${FONT}`;
    txt(ctx, clip(ctx, `${c.trim ? `${c.trim}  ·  ` : ''}${c.year}`, 500), R - 52, l2, { size: small, weight: 500, color: C.mute });
    if (i < d.cars.length - 1) rule(ctx, y0 + rowH - 1);
  });

  // the totals
  const ty = 980;
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD, ty, W - PAD * 2, 140);
  const cols = [
    { label: 'دفع', v: money(d.paid), color: C.cream },
    { label: 'قيمة الكراج', v: money(d.value), color: C.cream },
    { label: d.profit >= 0 ? 'الربح' : 'الخسارة', v: signed(d.profit), color: d.profit >= 0 ? C.gain : C.loss },
  ];
  const cw = (W - PAD * 2) / 3;
  cols.forEach((c, i) => {
    const cx = R - cw * i - cw / 2;
    txt(ctx, c.label, cx, ty + 52, { size: 24, weight: 600, color: C.mute, align: 'center' });
    const s = fit(ctx, c.v, 700, 44, cw - 28, 26);
    txt(ctx, c.v, cx, ty + 108, { size: s, weight: 700, color: c.color, align: 'center', dir: 'ltr' });
    if (i > 0) {
      ctx.fillStyle = C.hair;
      ctx.fillRect(R - cw * i, ty + 24, 2, 92);
    }
  });

  // the night's badges, one centred row of gold pills
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
    ctx.strokeStyle = C.goldLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx - w, by, w, 54, 27);
    else ctx.rect(bx - w, by, w, 54);
    ctx.stroke();
    txt(ctx, b, bx - w / 2, by + 36, { size: 26, weight: 600, color: C.gold, align: 'center' });
    bx -= w + 14;
  }

  // foot
  rule(ctx, H - 112, C.hair);
  txt(ctx, 'garage-auction.vercel.app', PAD, H - 78, { size: 22, weight: 500, color: C.dim, align: 'left', dir: 'ltr' });
  txt(ctx, 'سيارات حقيقية من السوق السعودي', R, H - 78, { size: 22, weight: 500, color: C.dim });
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
      const cv = await drawPoster(d);
      const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
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
        {busy ? 'نجهز الصورة…' : 'شارك كراجك'}
      </button>
      {img && (
        <div className="sg-back" role="dialog" aria-modal="true" aria-label="صورة كراجك" onClick={() => setImg(null)}>
          <div className="sg-sheet" onClick={(e) => e.stopPropagation()}>
            <img className="sg-img" src={img.url} alt="صورة كراجك الليلة" width={1080} height={1350} />
            <div className="sg-btns">
              <button className="btn btn-primary" onClick={share}>
                شارك الصورة
              </button>
              <button className="btn btn-ghost" onClick={download}>
                حمّلها
              </button>
              <button className="btn btn-quiet" onClick={() => setImg(null)}>
                سكّر
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
