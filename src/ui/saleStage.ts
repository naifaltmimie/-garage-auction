// The reveal's clock: which stage of the hammer moment a sale is at, read from the host's sold timer, and the one
// rule for what any screen may show of that sale at that stage (so the reveal and the players sheet never disagree).
//
// Stages, counted from the start of the sold phase (after the lead-in of a sealed or covered car):
//   -1  lead-in: the envelopes open one by one (sealed), or the cover comes off (covered)
//    0  the stamp slams; the buyer and the hammer price
//    1  «سعرها الصدق بالسوق» is announced, its number still blank
//    2  the value counts up, the difference and the verdict; the buyer's receipt prints
//    3  settled: the surprise (if any) lands and the value becomes final
import { VERDICT_LABEL, saleLeadInMs } from '../engine/rules';
import type { Core, Sale, Verdict } from '../engine/types';
import { useClockValue } from './components/DutchConsole';

export type SaleStage = -1 | 0 | 1 | 2 | 3;

/** The stage at which a sale's numbers are final; any sale that is not the one being revealed is at this stage. */
export const SALE_SETTLED: SaleStage = 3;

/** How long the lead-in lasts before the stamp, by the kind of sale (ms). The engine owns the numbers. */
export function saleLeadIn(sale: Pick<Sale, 'kind' | 'sealedBids'>): number {
  return saleLeadInMs(sale.kind, !!sale.sealedBids?.length);
}

/** The stage for `elapsed` ms since the sold phase began. */
export function saleStageAt(sale: Pick<Sale, 'kind' | 'sealedBids'>, elapsed: number): SaleStage {
  const e = elapsed - saleLeadIn(sale);
  return e < 0 ? -1 : e < 1300 ? 0 : e < 2700 ? 1 : e < 5200 ? 2 : 3;
}

/** The live stage of the sale on the block. Redraws only when the stage changes, never on the clock's ticks.
 *  A paused room shows the sale settled. */
export function useSaleStage(core: Core, sale: Pick<Sale, 'kind' | 'sealedBids'>, offset: number): SaleStage {
  const t = core.timer;
  const lead = saleLeadIn(sale);
  return useClockValue(
    offset,
    10,
    (now) => {
      if (core.paused) return SALE_SETTLED;
      const start = t ? t.endsAt - t.total : now;
      return saleStageAt(sale, Math.max(0, now - start));
    },
    [t, core.paused, lead],
  );
}

export type SaleShown = {
  /** the market value a screen may print now; null while it is still secret (before stage 2) */
  value: number | null;
  /** the buyer's gain (+) or loss (−) on that value, after everything he paid; null while secret */
  profit: number | null;
  /** true once the number is final (the surprise, if any, has landed) */
  settled: boolean;
};

/** What a screen may show of a sale at a stage. Before stage 2 nothing; at stage 2 the value before the
 *  surprise; from stage 3 the final value. A sale without a surprise is settled as soon as it is shown. */
export function saleShown(sale: Pick<Sale, 'value' | 'paid' | 'surprise'>, stage: SaleStage): SaleShown {
  if (stage < 2) return { value: null, profit: null, settled: false };
  const settled = stage >= 3 || !sale.surprise;
  const value = settled ? sale.value : sale.value - (sale.surprise?.delta ?? 0);
  return { value, profit: value - sale.paid, settled };
}

/** The verdict as it is said beside the difference, on the phone and on the big screen: the word, and who it is
 *  said of. Before the number is final the word is only «ربح» or «خسارة». A verdict that carries its own pronoun
 *  («انقصّ عليه», «غالية عليه») takes no name after it, and to the buyer himself it is said to his face
 *  («انقصّ عليك»); the others take «لك» / «لـ فهد». `mine` is false on a screen that belongs to nobody. */
export function verdictSaid(verdict: Verdict, shown: SaleShown, mine: boolean, buyerName: string): { word: string; who: string } {
  const up = (shown.profit ?? 0) >= 0;
  const who = mine ? (up ? 'لك' : 'عليك') : up ? `لـ ${buyerName}` : `على ${buyerName}`;
  if (!shown.settled) return { word: up ? 'ربح' : 'خسارة', who };
  if (verdict === 'robbed') return { word: mine ? 'انقصّ عليك' : 'انقصّ عليه', who: '' };
  if (verdict === 'over') return { word: mine ? 'غالية عليك' : 'غالية عليه', who: '' };
  return { word: VERDICT_LABEL[verdict], who };
}
