// Shared data contract between the host engine, the network layer and the UI.
// Everything in Core / LotPub / Hist is broadcast to every player.
// Anything ending in "Full" or "Secret" stays on the host's device.

export type Tier = 'junk' | 'daily' | 'family' | 'work' | 'luxury' | 'sport' | 'exotic' | 'classic';
export type Body = 'sedan' | 'suv' | 'pickup' | 'coupe' | 'hatch' | 'van' | 'convertible' | 'wagon';
export type Fuel = 'petrol' | 'diesel' | 'hybrid' | 'ev';
export type Drive = 'FWD' | 'RWD' | 'AWD' | '4WD';

/** One researched market entry: make + model + trim + model year, priced clean / typical km / Saudi spec. */
export interface CarModel {
  id: string;
  makeAr: string;
  makeEn: string;
  modelAr: string;
  modelEn: string;
  nick?: string;
  gen?: string;
  year: number;
  trim: string;
  trimAr?: string;
  body: Body;
  engine: string;
  hp?: number;
  fuel: Fuel;
  drive: Drive;
  trans: string;
  spec: string;
  km: number;
  value: number;
  range?: [number, number];
  newPrice?: number | null;
  tier: Tier;
  pop: 'high' | 'medium' | 'low';
  issues: string[];
  perks: string[];
  colors: string[];
  doors?: 2 | 4;
  cab?: 'single' | 'double';
  est?: boolean;
  /** Real listings this entry was priced from: [price, km, city, source, year]. */
  comps?: Comp[];
}

export type Comp = [number, number | null, string | null, string, number | null];

// Body panels as they appear on a Saudi inspection sheet (top view, front at the top).
export type PanelId =
  | 'fb' | 'hood' | 'roof' | 'trunk' | 'rb'
  | 'lff' | 'lfd' | 'lrd' | 'lrq'
  | 'rff' | 'rfd' | 'rrd' | 'rrq';

export type PanelStatus = 'ok' | 'spot' | 'paint' | 'dent' | 'replaced' | 'damaged' | 'unknown';
export type Cond = 'ok' | 'minor' | 'major' | 'unknown';

export interface Mech {
  engine: Cond;
  gearbox: Cond;
  chassis: 'ok' | 'repaired' | 'damaged' | 'unknown';
  airbags: 'ok' | 'deployed' | 'unknown';
  ac: 'cold' | 'weak' | 'broken' | 'unknown';
  susp: Cond;
}

export type SaleMode = 'inspected' | 'asis';
export type Seller = 'owner' | 'showroom' | 'rental' | 'company' | 'gov' | 'insurance';
export type LotKind = 'open' | 'covered' | 'sealed';

/** A Saudi private plate: Arabic letters/digits over Latin. Some are special and worth real money. */
export interface PlatePub {
  ar: string; // 'ح ط ب'
  en: string; // 'J T B'
  num: string; // '4821'
  special?: { tier: 'rare' | 'top' | 'special' | 'nice'; label: string; value: number };
}

export interface CarPub {
  modelId: string;
  makeAr: string;
  makeEn: string;
  modelAr: string;
  modelEn: string;
  nick?: string;
  trim: string;
  trimAr?: string;
  year: number;
  body: Body;
  engine: string;
  hp?: number;
  fuel: Fuel;
  drive: Drive;
  trans: string;
  tier: Tier;
  doors: 2 | 4;
  km: number;
  kmTag?: 'low' | 'high';
  spec: string;
  specKind: 'saudi' | 'gcc' | 'us' | 'us_salvage' | 'ca' | 'eu' | 'jp';
  color: string;
  colorHex: string;
  interior: string;
  city: string;
  owners: number;
  service: 'dealer' | 'workshop' | 'none';
  najm: number;
  istimara: 'valid' | 'expired';
  mvpi: 'valid' | 'expired';
  mvpiUntil?: string;
  insurance: 'comp' | 'tpl' | 'none';
  fines: number;
  panels: Partial<Record<PanelId, PanelStatus>>;
  mech: Mech;
  tires: number;
  extras: string[];
  warranty?: string;
  runs: 'drive' | 'starts' | 'dead';
  keys: 1 | 2;
  microns: Partial<Record<PanelId, number | null>>;
  scan: { status: 'clean' | 'stored' | 'active' | 'cleared' | 'none'; codes: [string, string][] };
  history: string[];
  inspector: string[];
  regType: string;
  plate: PlatePub;
  /** Real ad photos for this exact model (first = cover). */
  photos?: string[];
  /** Where the photos came from (ad title / link), shown small under the gallery. */
  adTitle?: string;
  adUrl?: string;
}

export interface FeeRule {
  pct: number;
  vat: boolean;
  transfer: number;
  label: string;
}

export interface LotPub {
  id: string;
  no: number;
  kind: LotKind;
  reserve: boolean;
  relist: number;
  fee: FeeRule;
  grade: number | null;
  mode: SaleMode;
  seller: Seller;
  car: CarPub | null;
  cover?: { body: Body; yearFrom: number; yearTo: number; hints: string[]; photo?: string };
  title: string;
  notes: string[];
  estimate: [number, number] | null;
  opening: number;
}

export interface Surprise {
  key: string;
  text: string;
  delta: number;
  good: boolean;
}

export interface LotFull extends LotPub {
  carFull: CarPub;
  base: number;
  reservePrice: number | null;
  surprise: Surprise | null;
  tags: string[];
  /** Real market listings for this model (hidden until the hammer falls). */
  comps?: Comp[];
}

export type Verdict = 'steal' | 'good' | 'fair' | 'over' | 'robbed';

export interface Sale {
  lotId: string;
  no: number;
  kind: LotKind;
  title: string;
  car: CarPub;
  buyer: string | null;
  hammer: number;
  fee: number;
  vat: number;
  transfer: number;
  paid: number;
  base: number;
  value: number;
  surprise: Surprise | null;
  profit: number;
  verdict: Verdict;
  roast: string;
  sealedBids?: { by: string; amount: number }[];
  bids: number;
  highBid?: number;
  highBy?: string | null;
  outcome: 'sold' | 'no_bid' | 'reserve' | 'declined' | 'nobody';
  approved?: boolean;
  comps?: Comp[];
}

export interface PlayerPub {
  id: string;
  name: string;
  paddle: number;
  plate: [string, string];
  host: boolean;
  cash: number;
  garage: string[];
  online: boolean;
  spectator: boolean;
  bids: number;
}

export type Speed = 'fast' | 'normal' | 'calm';
export type Mix = 'balanced' | 'luxury' | 'street';

export interface Settings {
  roomName: string;
  budget: number;
  garage: number;
  maxPlayers: number;
  lots: number;
  speed: Speed;
  mix: Mix;
  covered: boolean;
  sealed: boolean;
  estimate: boolean;
  fee: number;
  ratingWeight: number;
}

export type Phase =
  | 'lobby' | 'intro' | 'preview' | 'bidding' | 'sealed' | 'approval'
  | 'sold' | 'unsold' | 'showcase' | 'voting' | 'results';

export interface Timer {
  kind: Phase;
  endsAt: number;
  total: number;
  frozenLeft?: number;
}

export interface BidState {
  amount: number;
  by: string | null;
  at: number;
  count: number;
}

export interface LogEntry {
  id: number;
  by: string;
  amount: number;
  at: number;
  jump: number;
}

export type CalloutKey =
  | 'hall_open' | 'lot_intro' | 'open_bid' | 'who_more' | 'war' | 'going_1' | 'going_2' | 'going_3'
  | 'sold' | 'no_bid' | 'unsold' | 'covered' | 'sealed' | 'envelopes' | 'bargain' | 'robbed'
  | 'surprise' | 'last_lot' | 'auction_end' | 'winner' | 'jump' | 'nobody_can'
  | 'reserve_met' | 'approval' | 'accept' | 'decline' | 'relist' | 'last_chance' | 'silence';

export interface Callout {
  id: number;
  key: CalloutKey;
  text: string;
  at: number;
}

export interface Core {
  v: 2;
  rev: number;
  hostNow: number;
  phase: Phase;
  settings: Settings;
  players: PlayerPub[];
  lotNo: number;
  lotsTotal: number;
  lotId: string | null;
  bid: BidState | null;
  opening: number;
  drops: number;
  reserveMet: boolean;
  ext: number;
  timer: Timer | null;
  paused: boolean;
  callout: Callout | null;
  log: LogEntry[];
  sealedCount: number;
  voted: string[];
  startedAt: number;
}

export interface ResultRow {
  id: string;
  rank: number;
  cars: number;
  paid: number;
  value: number;
  profit: number;
  cash: number;
  net: number;
  ratingAvg: number | null;
  ratingCount: number;
  dealScore: number;
  ratingScore: number | null;
  total: number;
  awards: string[];
}

export interface Award {
  key: string;
  title: string;
  who: string;
  detail: string;
}

export interface FinalResults {
  rows: ResultRow[];
  awards: Award[];
  at: number;
}

export interface Hist {
  rev: number;
  sales: Sale[];
  results: FinalResults | null;
}

// ---- player -> host -------------------------------------------------------

export type Action =
  | { t: 'hello'; name: string }
  | { t: 'ping'; c: number }
  | { t: 'bid'; lot: string; amount: number }
  | { t: 'seal'; lot: string; amount: number }
  | { t: 'vote'; scores: Record<string, number> }
  | { t: 'bye' };

export interface Envelope {
  pid: string;
  sec: string;
  mid: string;
  a: Action;
}

// ---- host -> one player ----------------------------------------------------

export type Private =
  | { t: 'pong'; c: number; h: number }
  | { t: 'nack'; mid: string; reason: string }
  | { t: 'ack'; mid: string; kind: 'seal' | 'vote' | 'bid' }
  | { t: 'welcome'; spectator: boolean; full?: boolean };
