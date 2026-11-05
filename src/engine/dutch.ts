// المزاد الهولندي: the price starts high and falls in fixed steps until someone says «أبيها».
// The schedule is part of the lot; the clock is the host's timer, so every phone derives the
// same live price from (timer.total - time left). Nobody counts down locally.
import { roundToStep } from './rules';
import type { DutchPlan, Speed, Timer } from './types';

/** Round SAR steps people actually say out loud. */
const LADDER = [100, 200, 250, 500, 1_000, 2_000, 2_500, 5_000, 10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000];
const EVERY: Record<Speed, number> = { fast: 700, normal: 800, calm: 950 };
/** The price sits on the floor this long before the car goes back unsold. */
export const DUTCH_HOLD = 2600;
const MIN_STEPS = 14;
const MAX_STEPS = 34;

function nearest(x: number): number {
  let i = 0;
  for (let j = 1; j < LADDER.length; j++) if (Math.abs(Math.log(LADDER[j] / x)) < Math.abs(Math.log(LADDER[i] / x))) i = j;
  return i;
}

/** Start ≈ 1.35× the estimate's top, floor ≈ 45% of its low, steps ≈ 2.5% of the start. */
export function dutchPlan(est: [number, number], speed: Speed): DutchPlan {
  const start = roundToStep(est[1] * 1.35);
  const floor0 = Math.max(500, roundToStep(est[0] * 0.45));
  let i = nearest(start * 0.025);
  const steps = (k: number) => Math.ceil((start - floor0) / LADDER[k]);
  while (steps(i) > MAX_STEPS && i < LADDER.length - 1) i++;
  while (steps(i) < MIN_STEPS && i > 0) i--;
  const step = LADDER[i];
  return { start, floor: Math.min(floor0, start - step), step, every: EVERY[speed] ?? 800 };
}

export function dutchSteps(p: DutchPlan): number {
  return Math.max(1, Math.ceil((p.start - p.floor) / p.step));
}

/** How long the dutch phase lasts: every step down, then a short hold on the floor. */
export function dutchDuration(p: DutchPlan): number {
  return dutchSteps(p) * p.every + DUTCH_HOLD;
}

/** Live price after `elapsed` ms of falling. */
export function dutchPriceAt(p: DutchPlan, elapsed: number): number {
  const n = Math.max(0, Math.floor(elapsed / p.every));
  return Math.max(p.floor, p.start - n * p.step);
}

/** ms since the price started falling, from the host's timer (msLeft already handles pauses). */
export function dutchElapsed(timer: Timer | null | undefined, msLeft: number): number {
  return timer ? Math.max(0, timer.total - msLeft) : 0;
}

/** 0 at the start price, 1 on the floor. */
export function dutchProgress(p: DutchPlan, price: number): number {
  return Math.max(0, Math.min(1, (p.start - price) / Math.max(1, p.start - p.floor)));
}
