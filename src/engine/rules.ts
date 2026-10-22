import type { Settings, Speed, Verdict } from './types';

// Bid ladder in SAR. Mirrors how Gulf auction houses step bids by price band
// (small steps for cheap cars, big steps once you are in luxury territory).
export function increment(price: number): number {
  if (price < 10_000) return 500;
  if (price < 50_000) return 1_000;
  if (price < 100_000) return 2_500;
  if (price < 250_000) return 5_000;
  if (price < 500_000) return 10_000;
  if (price < 1_000_000) return 25_000;
  if (price < 3_000_000) return 50_000;
  return 100_000;
}

export function roundToStep(v: number): number {
  const s = increment(v);
  return Math.max(s, Math.round(v / s) * s);
}

/** Smallest legal next bid given the current top bid (or the opening price when nobody has bid). */
export function minNextBid(top: number | null, opening: number): number {
  if (top == null) return opening;
  return top + increment(top);
}

export const SPEEDS: Record<Speed, {
  intro: number; preview: number; window: number; extend: number; minExtend: number; cap: number; drop: number;
  sealed: number; sold: number; soldSurprise: number; unsold: number; approval: number;
}> = {
  fast:   { intro: 4500, preview: 7000,  window: 12000, extend: 6000,  minExtend: 4000, cap: 50000, drop: 8000,  sealed: 16000, sold: 8500,  soldSurprise: 11000, unsold: 3600, approval: 3600 },
  normal: { intro: 5500, preview: 10000, window: 15000, extend: 8000,  minExtend: 5000, cap: 70000, drop: 10000, sealed: 20000, sold: 10000, soldSurprise: 13000, unsold: 4200, approval: 4000 },
  calm:   { intro: 6500, preview: 14000, window: 20000, extend: 10000, minExtend: 6000, cap: 90000, drop: 12000, sealed: 26000, sold: 12000, soldSurprise: 15000, unsold: 4800, approval: 4400 },
};

/** Soft close that tightens as a bidding war drags on (Copart drops 30s to 15s). */
export function extensionFor(base: number, min: number, extCount: number): number {
  return Math.max(min, base - 1000 * Math.floor(extCount / 3));
}

/** A bid that reaches the host this long after the clock hit zero still counts (network latency). */
export const CLOSE_GRACE_MS = 450;
export const MAX_DROPS = 2;
export const DROP_FACTOR = 0.85;

export const BUDGETS = [
  { key: 'modest', label: 'على قد الحال', amount: 300_000, note: 'حراج شعبي واقتصادي' },
  { key: 'okay', label: 'مستور', amount: 750_000, note: 'عائلي وشغل ولمسة فخامة' },
  { key: 'comfy', label: 'مرتاح', amount: 1_500_000, note: 'جموس ولاندات وألمانيات' },
  { key: 'whale', label: 'هامور', amount: 5_000_000, note: 'رولز وفيراري على الطاولة' },
] as const;

export const DEFAULT_SETTINGS: Settings = {
  roomName: '',
  budget: 1_500_000,
  garage: 4,
  maxPlayers: 8,
  lots: 0,
  speed: 'normal',
  mix: 'balanced',
  covered: true,
  sealed: true,
  estimate: true,
  fee: 2.5,
  ratingWeight: 0.5,
};

export function lotsFor(s: Settings, players: number): number {
  if (s.lots > 0) return s.lots;
  const n = Math.max(2, players);
  return Math.max(10, Math.min(36, Math.round(n * s.garage * 1.3)));
}

export const VAT = 0.15;
export const TRANSFER_FEE = 150;

/** السعي on the hammer price, VAT on the السعي, and the Absher ownership-transfer fee. */
export function feesOf(hammer: number, rule: { pct: number; vat: boolean; transfer: number }) {
  const fee = Math.round((hammer * rule.pct) / 100);
  const vat = rule.vat ? Math.round(fee * VAT) : 0;
  const transfer = hammer > 0 ? rule.transfer : 0;
  return { fee, vat, transfer, total: hammer + fee + vat + transfer };
}

export function verdictOf(profit: number, paid: number): Verdict {
  const p = paid > 0 ? profit / paid : 0;
  if (p >= 0.2) return 'steal';
  if (p >= 0.06) return 'good';
  if (p > -0.06) return 'fair';
  if (p > -0.2) return 'over';
  return 'robbed';
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  steal: 'لقطة',
  good: 'صفقة حلوة',
  fair: 'سعر سوق',
  over: 'غالية عليه',
  robbed: 'انقصّ عليه',
};

/** Deal score 0..100: break-even is 50; ±25% of the budget in profit maps to the ends. */
export function dealScore(profit: number, budget: number): number {
  const pct = budget > 0 ? (profit / budget) * 100 : 0;
  return Math.max(0, Math.min(100, Math.round(50 + pct * 2)));
}

export const RATING_MIN = 1;
export const RATING_MAX = 10;
