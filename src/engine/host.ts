// The host's device runs the auction. Every rule lives here: who may bid, when the hammer
// falls, what a car was really worth, and how the night is scored. Players only send intents.
import { Rng } from '../lib/rng';
import { money } from '../lib/util';
import { AUCTIONEER, ROASTS, fill } from './lines';
import { buildDeck } from './lotgen';
import {
  CLOSE_GRACE_MS, DROP_FACTOR, MAX_DROPS, SPEEDS, dealScore, extensionFor, feesOf, increment, lotsFor,
  minNextBid, roundToStep, verdictOf,
} from './rules';
import type {
  Award, BidState, Callout, CalloutKey, CarModel, Core, FinalResults, Hist, LogEntry, LotFull, LotPub,
  Phase, PlayerPub, ResultRow, Sale, Settings, Timer, Verdict,
} from './types';

export interface HostPlayer extends PlayerPub {
  sec: string;
  lastSeen: number;
}

interface SealedBid {
  by: string;
  amount: number;
  at: number;
}

export interface HostState {
  v: 2;
  code: string;
  seed: number;
  createdAt: number;
  settings: Settings;
  phase: Phase;
  players: HostPlayer[];
  hostId: string;
  deck: LotFull[];
  idx: number;
  bid: BidState | null;
  opening: number;
  drops: number;
  reserveMet: boolean;
  ext: number;
  bidOpenedAt: number;
  lastChance: boolean;
  approvalAccept: boolean;
  timer: Timer | null;
  paused: boolean;
  /** paused because the host's phone left the page */
  away?: boolean;
  callout: Callout | null;
  log: LogEntry[];
  calls: number;
  soldStage: number;
  sealed: SealedBid[];
  sales: Sale[];
  relists: number;
  votes: Record<string, Record<string, number>>;
  voters: string[];
  results: FinalResults | null;
  startedAt: number;
  revCore: number;
  revLot: number;
  revHist: number;
  cid: number;
  lid: number;
  nextPaddle: number;
}

export type Nack = 'late' | 'low' | 'cash' | 'full' | 'self' | 'phase' | 'spectator' | 'unknown' | 'auth' | 'room_full';

export interface Changes {
  core?: boolean;
  lot?: boolean;
  hist?: boolean;
}

const PLATE_LETTERS: [string, string][] = [
  ['ا', 'A'], ['ب', 'B'], ['ح', 'J'], ['د', 'D'], ['ر', 'R'], ['س', 'S'], ['ص', 'X'], ['ط', 'T'], ['ع', 'E'],
  ['ق', 'G'], ['ك', 'K'], ['ل', 'L'], ['م', 'Z'], ['ن', 'N'], ['هـ', 'H'], ['و', 'U'], ['ى', 'V'],
];
const NAME_TO_PLATE: Record<string, number> = {
  'ا': 0, 'أ': 0, 'إ': 0, 'آ': 0, 'ب': 1, 'ح': 2, 'ج': 2, 'د': 3, 'ذ': 3, 'ر': 4, 'ز': 4, 'س': 5, 'ش': 5, 'ص': 6, 'ض': 6,
  'ط': 7, 'ظ': 7, 'ع': 8, 'غ': 8, 'ق': 9, 'ك': 10, 'ل': 11, 'م': 12, 'ن': 13, 'ه': 14, 'ة': 14, 'و': 15, 'ي': 16, 'ى': 16,
};

export function plateFor(name: string, rng: Rng): [string, string] {
  const idx: number[] = [];
  for (const ch of name.replace(/\s+/g, '')) {
    const i = NAME_TO_PLATE[ch];
    if (i !== undefined && !idx.includes(i)) idx.push(i);
    if (idx.length === 3) break;
  }
  while (idx.length < 3) idx.push(rng.int(0, PLATE_LETTERS.length - 1));
  const ar = idx.map((i) => PLATE_LETTERS[i][0]).join(' ');
  const en = idx.map((i) => PLATE_LETTERS[i][1]).reverse().join(' ');
  return [ar, en];
}

// The auctioneer never says the same line twice in a row: each kind of call remembers its last few lines.
const recentLines = new Map<CalloutKey, string[]>();
function pickLine(rng: Rng, key: CalloutKey, vars: Record<string, string>): string {
  const pool = AUCTIONEER[key] ?? [''];
  const recent = recentLines.get(key) ?? [];
  const fresh = pool.filter((x) => !recent.includes(x));
  const line = rng.pick(fresh.length ? fresh : pool);
  const keep = Math.max(0, Math.min(pool.length - 1, Math.ceil(pool.length / 2), 5));
  recentLines.set(key, [line, ...recent].slice(0, keep));
  return fill(line, vars);
}

export class HostEngine {
  st: HostState;
  private rng: Rng;
  private catalogue: CarModel[];

  constructor(st: HostState, catalogue: CarModel[]) {
    this.st = st;
    this.catalogue = catalogue;
    this.rng = new Rng((st.seed ^ Math.imul(st.revCore + 7, 2654435761)) >>> 0);
  }

  static create(
    opts: { code: string; hostId: string; hostSec: string; hostName: string; settings: Settings; now: number },
    catalogue: CarModel[],
  ): HostEngine {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const rng = new Rng(seed);
    const host: HostPlayer = {
      id: opts.hostId, sec: opts.hostSec, name: opts.hostName.trim().slice(0, 18) || 'المضيف', paddle: 1,
      plate: plateFor(opts.hostName, rng), host: true, cash: opts.settings.budget, garage: [], online: true,
      spectator: false, bids: 0, lastSeen: opts.now,
    };
    const st: HostState = {
      v: 2, code: opts.code, seed, createdAt: opts.now, settings: opts.settings, phase: 'lobby',
      players: [host], hostId: opts.hostId, deck: [], idx: -1, bid: null, opening: 0, drops: 0,
      reserveMet: false, ext: 0, bidOpenedAt: 0, lastChance: false, approvalAccept: false, timer: null,
      paused: false, callout: null, log: [], calls: 0, soldStage: 0, sealed: [], sales: [], relists: 0,
      votes: {}, voters: [], results: null, startedAt: 0, revCore: 1, revLot: 1, revHist: 1, cid: 0, lid: 0,
      nextPaddle: 2,
    };
    return new HostEngine(st, catalogue);
  }

  // ------------------------------------------------------------------ helpers

  private get speed() {
    return SPEEDS[this.st.settings.speed];
  }
  private player(id: string | null | undefined) {
    return id ? this.st.players.find((p) => p.id === id) : undefined;
  }
  private active() {
    return this.st.players.filter((p) => !p.spectator);
  }
  get lot(): LotFull | null {
    return this.st.idx >= 0 ? this.st.deck[this.st.idx] ?? null : null;
  }
  /** A verdict line nobody heard earlier tonight (until the pool runs out). */
  private freshRoast(v: Verdict): string {
    const pool = ROASTS[v];
    const used = new Set(this.st.sales.map((x) => x.roast));
    const fresh = pool.filter((x) => !used.has(x));
    return this.rng.pick(fresh.length ? fresh : pool);
  }
  private say(key: CalloutKey, now: number, vars: Record<string, string> = {}) {
    this.st.cid += 1;
    this.st.callout = { id: this.st.cid, key, text: pickLine(this.rng, key, vars), at: now };
  }
  private setTimer(kind: Phase, now: number, ms: number) {
    this.st.timer = { kind, endsAt: now + ms, total: ms };
  }
  private nameOf(id: string | null | undefined) {
    return this.player(id)?.name || '—';
  }
  /** Total the buyer would pay for this hammer price on the current lot. */
  totalFor(amount: number): number {
    const lot = this.lot;
    return lot ? feesOf(amount, lot.fee).total : amount;
  }
  private canAfford(p: HostPlayer, amount: number) {
    return this.totalFor(amount) <= p.cash;
  }
  private hasRoom(p: HostPlayer) {
    return p.garage.length < this.st.settings.garage;
  }
  private eligible(amount: number) {
    return this.active().filter((p) => this.hasRoom(p) && this.canAfford(p, amount));
  }

  // ------------------------------------------------------------------ joining

  join(pid: string, sec: string, name: string, now: number): { ok: boolean; reason?: Nack; spectator?: boolean; changes: Changes } {
    const clean = name.trim().slice(0, 18) || 'لاعب';
    const ex = this.player(pid);
    if (ex) {
      if (ex.sec !== sec) return { ok: false, reason: 'auth', changes: {} };
      ex.lastSeen = now;
      ex.online = true;
      if (this.st.phase === 'lobby' && ex.name !== clean && !ex.host) {
        ex.name = clean;
        ex.plate = plateFor(clean, this.rng);
      }
      return { ok: true, spectator: ex.spectator, changes: { core: true } };
    }
    const lobby = this.st.phase === 'lobby';
    const full = this.active().length >= this.st.settings.maxPlayers;
    const spectator = !lobby || full;
    const p: HostPlayer = {
      id: pid, sec, name: clean, paddle: spectator ? 0 : this.st.nextPaddle++, plate: plateFor(clean, this.rng),
      host: false, cash: this.st.settings.budget, garage: [], online: true, spectator, bids: 0, lastSeen: now,
    };
    this.st.players.push(p);
    return { ok: true, spectator, reason: full && lobby ? 'room_full' : undefined, changes: { core: true } };
  }

  seen(pid: string, sec: string, now: number): boolean {
    const p = this.player(pid);
    if (!p || p.sec !== sec) return false;
    p.lastSeen = now;
    if (!p.online) p.online = true;
    return true;
  }

  leave(pid: string, sec: string): Changes {
    const p = this.player(pid);
    if (!p || p.sec !== sec) return {};
    if (this.st.phase === 'lobby' && !p.host) this.st.players = this.st.players.filter((x) => x.id !== pid);
    else p.lastSeen = 0;
    return { core: true };
  }

  /** Let a latecomer (or someone benched) into the bidding with their wallet as it stands. */
  admit(pid: string): Changes {
    const p = this.player(pid);
    if (!p || p.host || !p.spectator) return {};
    if (['showcase', 'voting', 'results'].includes(this.st.phase)) return {};
    if (this.active().length >= this.st.settings.maxPlayers) return {};
    p.spectator = false;
    if (!p.paddle) p.paddle = this.st.nextPaddle++;
    return { core: true };
  }

  kick(pid: string): Changes {
    const p = this.player(pid);
    if (!p || p.host) return {};
    if (this.st.phase === 'lobby') {
      this.st.players = this.st.players.filter((x) => x.id !== pid);
      return { core: true };
    }
    p.spectator = true;
    if (this.st.bid?.by === pid) {
      const prev = [...this.st.log].reverse().find((l) => l.by !== pid && !this.player(l.by)?.spectator);
      this.st.bid = prev ? { amount: prev.amount, by: prev.by, at: prev.at, count: this.st.bid.count } : null;
    }
    this.st.sealed = this.st.sealed.filter((s) => s.by !== pid);
    this.st.voters = this.st.voters.filter((v) => v !== pid);
    return { core: true };
  }

  setSettings(patch: Partial<Settings>): Changes {
    if (this.st.phase !== 'lobby') return {};
    this.st.settings = { ...this.st.settings, ...patch };
    for (const p of this.st.players) p.cash = this.st.settings.budget;
    return { core: true };
  }

  // ------------------------------------------------------------------ flow

  start(now: number, seen: Map<string, number> | Set<string> = new Map()): Changes {
    if (this.st.phase !== 'lobby') return {};
    const n = this.active().length;
    // the deck holds as many lots as the market can fill with ads nobody here has seen
    this.st.deck = buildDeck(this.st.seed, this.st.settings, this.catalogue, n, lotsFor(this.st.settings, n), seen);
    this.st.idx = -1;
    this.st.sales = [];
    this.st.relists = 0;
    this.st.results = null;
    this.st.startedAt = now;
    for (const p of this.st.players) {
      p.cash = this.st.settings.budget;
      p.garage = [];
      p.bids = 0;
    }
    this.st.phase = 'intro';
    this.setTimer('intro', now, this.speed.intro);
    this.say('hall_open', now);
    return { core: true, lot: true, hist: true };
  }

  private startLot(i: number, now: number): Changes {
    const lot = this.st.deck[i];
    if (!lot) return this.endAuction(now);
    const st = this.st;
    st.idx = i;
    st.phase = 'preview';
    st.bid = null;
    st.opening = lot.opening;
    st.drops = 0;
    st.reserveMet = false;
    st.ext = 0;
    st.lastChance = false;
    st.log = [];
    st.calls = 0;
    st.soldStage = 0;
    st.sealed = [];
    this.setTimer('preview', now, this.speed.preview + (lot.kind === 'sealed' ? 2000 : 0));
    const last = i === st.deck.length - 1;
    if (lot.relist > 0) this.say('relist', now);
    else if (last) this.say('last_lot', now);
    else if (lot.kind === 'covered') this.say('covered', now);
    else if (lot.kind === 'sealed') this.say('sealed', now);
    else this.say('lot_intro', now, { city: lot.carFull.city });
    return { core: true, lot: true };
  }

  private openBidding(now: number): Changes {
    const lot = this.lot;
    if (!lot) return {};
    if (!this.eligible(this.st.opening).length) {
      this.say('nobody_can', now);
      return this.closeUnsold(now, 'nobody');
    }
    this.st.bidOpenedAt = now;
    if (lot.kind === 'sealed') {
      this.st.phase = 'sealed';
      this.setTimer('sealed', now, this.speed.sealed);
      this.say('sealed', now);
    } else {
      this.st.phase = 'bidding';
      this.setTimer('bidding', now, this.speed.window);
      this.say('open_bid', now, { price: money(this.st.opening) });
    }
    return { core: true };
  }

  bid(pid: string, lotId: string, amount: number, now: number): { ok: boolean; reason?: Nack; changes: Changes } {
    const st = this.st;
    const p = this.player(pid);
    if (!p) return { ok: false, reason: 'unknown', changes: {} };
    if (p.spectator) return { ok: false, reason: 'spectator', changes: {} };
    const lot = this.lot;
    if (st.phase !== 'bidding' || !lot || lot.id !== lotId || st.paused) {
      return { ok: false, reason: ['sold', 'unsold', 'approval'].includes(st.phase) ? 'late' : 'phase', changes: {} };
    }
    if (st.timer && now > st.timer.endsAt + CLOSE_GRACE_MS) return { ok: false, reason: 'late', changes: {} };
    if (st.bid?.by === pid) return { ok: false, reason: 'self', changes: {} };
    if (!this.hasRoom(p)) return { ok: false, reason: 'full', changes: {} };
    const min = minNextBid(st.bid?.amount ?? null, st.opening);
    const amt = Math.round(amount);
    if (!Number.isFinite(amt) || amt < min) return { ok: false, reason: 'low', changes: {} };
    if (!this.canAfford(p, amt)) return { ok: false, reason: 'cash', changes: {} };

    const prev = st.bid;
    const jump = amt - (prev?.amount ?? st.opening);
    st.bid = { amount: amt, by: pid, at: now, count: (prev?.count ?? 0) + 1 };
    st.lid += 1;
    st.log = [...st.log, { id: st.lid, by: pid, amount: amt, at: now, jump }].slice(-16);
    p.bids += 1;
    st.calls = 0;

    // soft close: a bid in the closing seconds buys the room more time, less each round
    if (st.timer) {
      const left = st.timer.endsAt - now;
      const ext = extensionFor(this.speed.extend, this.speed.minExtend, st.ext);
      const capped = now - st.bidOpenedAt > this.speed.cap;
      if (left < ext && !capped) {
        st.timer = { kind: 'bidding', endsAt: now + ext, total: ext };
        st.ext += 1;
      } else if (capped && !st.lastChance) {
        st.lastChance = true;
      }
    }

    const vars = { name: p.name, price: money(amt), other: this.nameOf(prev?.by) };
    const justMet = !!(lot.reservePrice && !st.reserveMet && amt >= lot.reservePrice);
    if (justMet) st.reserveMet = true;
    const recent = new Set(st.log.slice(-4).map((l) => l.by));
    if (justMet) this.say('reserve_met', now, vars);
    else if (st.lastChance && st.callout?.key !== 'last_chance') this.say('last_chance', now, vars);
    else if (prev && jump >= increment(prev.amount) * 6) this.say('jump', now, vars);
    else if (recent.size >= 2 && st.log.length >= 4 && st.log.length % 3 === 1) this.say('war', now, vars);
    else this.say('who_more', now, vars);
    return { ok: true, changes: { core: true } };
  }

  seal(pid: string, lotId: string, amount: number, now: number): { ok: boolean; reason?: Nack; changes: Changes } {
    const st = this.st;
    const p = this.player(pid);
    if (!p) return { ok: false, reason: 'unknown', changes: {} };
    if (p.spectator) return { ok: false, reason: 'spectator', changes: {} };
    const lot = this.lot;
    if (st.phase !== 'sealed' || !lot || lot.id !== lotId || st.paused) return { ok: false, reason: 'phase', changes: {} };
    if (st.timer && now > st.timer.endsAt + CLOSE_GRACE_MS) return { ok: false, reason: 'late', changes: {} };
    if (!this.hasRoom(p)) return { ok: false, reason: 'full', changes: {} };
    const amt = Math.round(amount);
    if (!Number.isFinite(amt) || amt < st.opening) return { ok: false, reason: 'low', changes: {} };
    if (!this.canAfford(p, amt)) return { ok: false, reason: 'cash', changes: {} };
    const ex = st.sealed.find((s) => s.by === pid);
    if (ex) {
      ex.amount = amt;
      ex.at = now;
    } else {
      st.sealed.push({ by: pid, amount: amt, at: now });
      p.bids += 1;
    }
    return { ok: true, changes: { core: true } };
  }

  private closeSold(now: number, winner: string, hammer: number, extra: { sealedBids?: { by: string; amount: number }[]; approved?: boolean } = {}): Changes {
    const st = this.st;
    const lot = this.lot!;
    const buyer = this.player(winner)!;
    const f = feesOf(hammer, lot.fee);
    const raw = Math.max(1500, lot.base + (lot.surprise?.delta ?? 0));
    const value = raw >= 100_000 ? Math.round(raw / 500) * 500 : Math.round(raw / 100) * 100;
    const profit = value - f.total;
    const verdict = verdictOf(profit, f.total);
    buyer.cash -= f.total;
    buyer.garage = [...buyer.garage, lot.id];
    const sale: Sale = {
      lotId: lot.id, no: lot.no, kind: lot.kind, title: lot.title, car: lot.carFull, buyer: winner, hammer,
      fee: f.fee, vat: f.vat, transfer: f.transfer, paid: f.total, base: lot.base, value, surprise: lot.surprise,
      profit, verdict, roast: this.freshRoast(verdict), sealedBids: extra.sealedBids,
      bids: st.bid?.count ?? extra.sealedBids?.length ?? 1, outcome: 'sold', approved: extra.approved, comps: lot.comps,
    };
    st.sales = [...st.sales, sale];
    st.phase = 'sold';
    st.soldStage = 0;
    this.setTimer('sold', now, lot.surprise ? this.speed.soldSurprise : this.speed.sold);
    if (extra.sealedBids) this.say('envelopes', now);
    else if (extra.approved) this.say('accept', now, { buyer: buyer.name, price: money(hammer) });
    else this.say('sold', now, { buyer: buyer.name, price: money(hammer) });
    return { core: true, hist: true };
  }

  private closeUnsold(now: number, outcome: Sale['outcome']): Changes {
    const lot = this.lot!;
    const st = this.st;
    const high = st.bid;
    st.sales = [...st.sales, {
      lotId: lot.id, no: lot.no, kind: lot.kind, title: lot.title, car: lot.carFull, buyer: null, hammer: 0,
      fee: 0, vat: 0, transfer: 0, paid: 0, base: lot.base, value: lot.base, surprise: null, profit: 0,
      verdict: 'fair', roast: '', bids: high?.count ?? 0, highBid: high?.amount, highBy: high?.by ?? null, outcome,
      comps: lot.comps,
    }];
    // an unsold car leaves the hall for good: every lot in a night is a different car, shown once
    st.phase = 'unsold';
    this.setTimer('unsold', now, this.speed.unsold);
    if (outcome === 'declined') this.say('decline', now);
    else if (outcome !== 'nobody') this.say('unsold', now, { price: high ? money(high.amount) : '' });
    return { core: true, hist: true };
  }

  private afterLot(now: number): Changes {
    const next = this.st.idx + 1;
    const anyRoom = this.active().some((p) => this.hasRoom(p) && p.cash > 1000);
    if (next >= this.st.deck.length || !anyRoom) return this.endAuction(now);
    return this.startLot(next, now);
  }

  private endAuction(now: number): Changes {
    this.st.phase = 'showcase';
    this.st.timer = null;
    this.st.bid = null;
    this.say('auction_end', now);
    return { core: true, lot: true };
  }

  tick(now: number): Changes {
    const st = this.st;
    if (st.paused || !st.timer) return {};
    const left = st.timer.endsAt - now;
    switch (st.phase) {
      case 'intro':
        return left <= 0 ? this.startLot(0, now) : {};
      case 'preview':
        return left <= 0 ? this.openBidding(now) : {};
      case 'bidding': {
        const lot = this.lot!;
        if (st.bid) {
          const ext = st.timer.total;
          const marks = [ext * 0.72, ext * 0.47, ext * 0.22];
          if (st.calls < 3 && left <= marks[st.calls] && left > 0 && st.timer.total >= 3000) {
            st.calls += 1;
            this.say((['going_1', 'going_2', 'going_3'] as const)[st.calls - 1], now);
            return { core: true };
          }
          if (left > -CLOSE_GRACE_MS) return {};
          if (lot.reservePrice && st.bid.amount < lot.reservePrice) {
            if (st.bid.amount >= lot.reservePrice * 0.86) {
              const closeness = (st.bid.amount / lot.reservePrice - 0.86) / 0.14;
              st.approvalAccept = this.rng.chance(Math.max(0.15, Math.min(0.85, 0.2 + closeness * 0.65)));
              st.phase = 'approval';
              this.setTimer('approval', now, this.speed.approval);
              this.say('approval', now, { price: money(st.bid.amount) });
              return { core: true };
            }
            return this.closeUnsold(now, 'reserve');
          }
          return this.closeSold(now, st.bid.by!, st.bid.amount);
        }
        if (left > -CLOSE_GRACE_MS) return {};
        if (st.drops < MAX_DROPS) {
          const lower = roundToStep(st.opening * DROP_FACTOR);
          if (lower < st.opening && this.eligible(lower).length) {
            st.drops += 1;
            st.opening = lower;
            this.setTimer('bidding', now, this.speed.drop);
            this.say('no_bid', now, { price: money(lower) });
            return { core: true };
          }
        }
        return this.closeUnsold(now, 'no_bid');
      }
      case 'approval': {
        if (left > 0) return {};
        const b = st.bid!;
        const p = this.player(b.by);
        if (st.approvalAccept && p && !p.spectator && this.hasRoom(p) && this.canAfford(p, b.amount)) {
          return this.closeSold(now, b.by!, b.amount, { approved: true });
        }
        return this.closeUnsold(now, 'declined');
      }
      case 'sealed': {
        if (left > -CLOSE_GRACE_MS) return {};
        const bids = [...st.sealed].sort((a, b) => b.amount - a.amount || a.at - b.at);
        const valid = bids.filter((b) => {
          const p = this.player(b.by);
          return p && !p.spectator && this.hasRoom(p) && this.canAfford(p, b.amount);
        });
        if (!valid.length) return this.closeUnsold(now, 'no_bid');
        return this.closeSold(now, valid[0].by, valid[0].amount, { sealedBids: bids.map((b) => ({ by: b.by, amount: b.amount })) });
      }
      case 'sold': {
        const sale = st.sales[st.sales.length - 1];
        const elapsed = st.timer.total - left;
        if (sale && st.soldStage === 0 && elapsed > 3400) {
          st.soldStage = 1;
          if (sale.verdict === 'steal') {
            this.say('bargain', now, { buyer: this.nameOf(sale.buyer) });
            return { core: true };
          }
          if (sale.verdict === 'robbed') {
            this.say('robbed', now, { buyer: this.nameOf(sale.buyer) });
            return { core: true };
          }
        }
        if (sale?.surprise && st.soldStage === 1 && elapsed > 5400) {
          st.soldStage = 2;
          this.say('surprise', now);
          return { core: true };
        }
        return left <= 0 ? this.afterLot(now) : {};
      }
      case 'unsold':
        return left <= 0 ? this.afterLot(now) : {};
      default:
        return {};
    }
  }

  // ------------------------------------------------------------------ host controls

  /** `away`: the host's phone left the page (screen off / another app), so the clock holds for everyone. */
  pause(now: number, away = false): Changes {
    const st = this.st;
    if (st.paused || !st.timer || !['preview', 'bidding', 'sealed', 'sold', 'unsold', 'intro'].includes(st.phase)) return {};
    st.paused = true;
    st.away = away;
    st.timer = { ...st.timer, frozenLeft: Math.max(0, st.timer.endsAt - now) };
    return { core: true };
  }

  resume(now: number): Changes {
    const st = this.st;
    if (!st.paused || !st.timer) return {};
    st.paused = false;
    st.away = false;
    const floor = st.phase === 'bidding' && st.bid ? this.speed.minExtend : 2500;
    const left = Math.max(floor, st.timer.frozenLeft ?? 0);
    st.timer = { kind: st.timer.kind, endsAt: now + left, total: Math.max(left, st.timer.total) };
    st.calls = 0;
    return { core: true };
  }

  /** Skip ahead: preview -> open bidding, sold/unsold/intro -> next lot. */
  advance(now: number): Changes {
    const st = this.st;
    if (st.paused) return {};
    if (st.phase === 'preview') return this.openBidding(now);
    if (st.phase === 'intro') return this.startLot(0, now);
    if (st.phase === 'sold' || st.phase === 'unsold') return this.afterLot(now);
    return {};
  }

  /** Pull the current car off the block without a sale. */
  skipLot(now: number): Changes {
    if (!['preview', 'bidding', 'sealed'].includes(this.st.phase)) return {};
    this.st.paused = false;
    this.st.bid = null;
    return this.closeUnsold(now, 'nobody');
  }

  endNow(now: number): Changes {
    if (['lobby', 'showcase', 'voting', 'results'].includes(this.st.phase)) return {};
    this.st.paused = false;
    return this.endAuction(now);
  }

  openVoting(now: number): Changes {
    const st = this.st;
    if (st.phase !== 'showcase') return {};
    const roster = this.active().map((p) => p.id);
    if (roster.length < 2) return this.finish(now);
    st.phase = 'voting';
    st.voters = roster;
    st.votes = {};
    st.timer = null;
    return { core: true };
  }

  vote(pid: string, scores: Record<string, number>, now: number): { ok: boolean; reason?: Nack; changes: Changes } {
    const st = this.st;
    if (st.phase !== 'voting' || !st.voters.includes(pid)) return { ok: false, reason: 'phase', changes: {} };
    const clean: Record<string, number> = {};
    for (const t of st.voters) {
      if (t === pid) continue;
      const v = Math.round(Number(scores[t]));
      if (v >= 1 && v <= 10) clean[t] = v;
    }
    st.votes[pid] = clean;
    const waiting = st.voters.filter((v) => !st.votes[v] && this.isOnline(v, now));
    if (!waiting.length) return { ok: true, changes: { core: true, ...this.finish(now) } };
    return { ok: true, changes: { core: true } };
  }

  private isOnline(id: string, now: number) {
    const p = this.player(id);
    return !!p && (p.host || now - p.lastSeen < 16_000);
  }

  finish(now: number): Changes {
    const st = this.st;
    if (st.phase !== 'voting' && st.phase !== 'showcase') return {};
    st.results = this.compute(now);
    st.phase = 'results';
    this.say('winner', now);
    return { core: true, hist: true };
  }

  rematch(now: number): Changes {
    const st = this.st;
    if (st.phase !== 'results' && st.phase !== 'showcase') return {};
    st.seed = (Math.random() * 2 ** 32) >>> 0;
    st.phase = 'lobby';
    st.deck = [];
    st.idx = -1;
    st.sales = [];
    st.results = null;
    st.votes = {};
    st.voters = [];
    st.timer = null;
    st.bid = null;
    st.log = [];
    st.callout = null;
    st.relists = 0;
    let paddle = 2;
    for (const p of st.players) {
      if (p.spectator && now - p.lastSeen < 16_000 && this.active().length < st.settings.maxPlayers) p.spectator = false;
      if (!p.host && !p.spectator) p.paddle = paddle++;
      p.cash = st.settings.budget;
      p.garage = [];
      p.bids = 0;
    }
    st.nextPaddle = paddle;
    return { core: true, lot: true, hist: true };
  }

  // ------------------------------------------------------------------ scoring

  private compute(now: number): FinalResults {
    const st = this.st;
    const w = st.settings.ratingWeight;
    const active = this.active();
    const rows: ResultRow[] = active.map((p) => {
      const mine = st.sales.filter((s) => s.buyer === p.id);
      const paid = mine.reduce((a, s) => a + s.paid, 0);
      const value = mine.reduce((a, s) => a + s.value, 0);
      const profit = value - paid;
      const got = Object.entries(st.votes)
        .filter(([voter]) => voter !== p.id)
        .map(([, sc]) => sc[p.id])
        .filter((x): x is number => typeof x === 'number');
      const ratingAvg = got.length ? got.reduce((a, b) => a + b, 0) / got.length : null;
      const ds = dealScore(profit, st.settings.budget);
      const rs = ratingAvg == null ? null : Math.round(ratingAvg * 10);
      const total = rs == null ? ds : Math.round(w * rs + (1 - w) * ds);
      return {
        id: p.id, rank: 0, cars: mine.length, paid, value, profit, cash: p.cash, net: p.cash + value,
        ratingAvg: ratingAvg == null ? null : Math.round(ratingAvg * 10) / 10, ratingCount: got.length,
        dealScore: ds, ratingScore: rs, total, awards: [],
      };
    });
    rows.sort((a, b) => b.total - a.total || b.profit - a.profit || b.value - a.value);
    rows.forEach((r, i) => (r.rank = i + 1));

    const awards: Award[] = [];
    const add = (key: string, title: string, who: string, detail: string) => {
      awards.push({ key, title, who, detail });
      rows.find((r) => r.id === who)?.awards.push(title);
    };
    if (rows[0]) add('champion', 'بطل المزاد', rows[0].id, `${rows[0].total} نقطة`);
    const byProfit = [...rows].sort((a, b) => b.profit - a.profit)[0];
    if (byProfit && byProfit.profit > 0) add('bargains', 'ملك اللقطات', byProfit.id, `ربح ${money(byProfit.profit)} ريال`);
    const sold = st.sales.filter((s) => s.buyer);
    const best = [...sold].sort((a, b) => b.profit - a.profit)[0];
    if (best && best.profit > 0) add('best_deal', 'صفقة الليلة', best.buyer!, `${best.title} ${best.car.year} بربح ${money(best.profit)}`);
    const worst = [...sold].sort((a, b) => a.profit - b.profit)[0];
    if (worst && worst.profit < 0) add('worst_deal', 'المنقصّ عليه', worst.buyer!, `${worst.title} ${worst.car.year} بخسارة ${money(-worst.profit)}`);
    const whale = [...rows].sort((a, b) => b.paid - a.paid)[0];
    if (whale && whale.paid > 0) add('whale', 'هامور الليلة', whale.id, `دفع ${money(whale.paid)} ريال`);
    const people = rows.filter((r) => r.ratingAvg != null).sort((a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0))[0];
    if (people) add('people', 'كراج الشعب', people.id, `تقييم ${people.ratingAvg} من 10`);
    const stubborn = [...active].sort((a, b) => b.bids - a.bids)[0];
    if (stubborn && stubborn.bids > 0) add('stubborn', 'العنيد', stubborn.id, `${stubborn.bids} سوم`);
    const covered = sold.filter((s) => s.kind === 'covered').sort((a, b) => b.profit - a.profit)[0];
    if (covered) add('gambler', covered.profit >= 0 ? 'صياد الغطا' : 'ضحية الغطا', covered.buyer!, `${covered.title} ${covered.car.year}`);
    const saver = [...rows].sort((a, b) => b.cash - a.cash)[0];
    if (saver && saver.cars > 0 && saver.cash > st.settings.budget * 0.4) add('saver', 'ماسك فلوسه', saver.id, `باقي معه ${money(saver.cash)}`);
    return { rows, awards, at: now };
  }

  // ------------------------------------------------------------------ projections

  core(now: number): Core {
    const st = this.st;
    const players: PlayerPub[] = st.players.map((p) => ({
      id: p.id, name: p.name, paddle: p.paddle, plate: p.plate, host: p.host, cash: p.cash, garage: p.garage,
      online: p.host ? true : now - p.lastSeen < 16_000, spectator: p.spectator, bids: p.bids,
    }));
    return {
      v: 2,
      rev: st.revCore,
      revLot: st.revLot,
      revHist: st.revHist,
      hostNow: now,
      phase: st.phase,
      settings: st.settings,
      players,
      lotNo: st.idx + 1,
      lotsTotal: st.deck.length || lotsFor(st.settings, this.active().length),
      lotId: this.lot?.id ?? null,
      bid: st.bid,
      opening: st.opening,
      drops: st.drops,
      reserveMet: st.reserveMet,
      ext: st.ext,
      timer: st.timer,
      paused: st.paused,
      away: st.paused && !!st.away,
      callout: st.callout,
      log: st.log,
      sealedCount: st.sealed.length,
      voted: Object.keys(st.votes),
      startedAt: st.startedAt,
    };
  }

  lotPub(): LotPub | null {
    const l = this.lot;
    if (!l) return null;
    const { carFull: _c, base: _b, surprise: _s, tags: _t, reservePrice: _r, comps: _m, ...pub } = l;
    void _c; void _b; void _s; void _t; void _r; void _m;
    // warm the phones' cache with the next two cars' first photos (never a covered car's)
    const ahead = this.st.deck
      .slice(this.st.idx + 1, this.st.idx + 3)
      .filter((x) => x.kind !== 'covered')
      .map((x) => x.car?.photos?.[0])
      .filter((x): x is string => !!x);
    return ahead.length ? { ...pub, ahead } : pub;
  }

  hist(): Hist {
    return { rev: this.st.revHist, sales: this.st.sales, results: this.st.results };
  }

  /** Bump revisions for whatever changed; returns true if anything did. */
  commit(ch: Changes): boolean {
    if (ch.core) this.st.revCore++;
    if (ch.lot) this.st.revLot++;
    if (ch.hist) this.st.revHist++;
    return !!(ch.core || ch.lot || ch.hist);
  }
}
