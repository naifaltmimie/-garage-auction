export type Phase = 'landing' | 'lobby' | 'auction' | 'theme' | 'vote' | 'results';
export type Tier = 'luxury' | 'sport' | 'suv' | 'daily' | 'junk';
export type Level = 'easy' | 'medium' | 'hard' | 'hell';

export interface Car {
  id: string;
  nameAr: string;
  nameEn: string;
  year: number;
  tier: Tier;
  marketPriceSar: number;
  segment?: string;
  powerHp?: number;
  seats?: number;
  comedyNoteAr?: string;
  imageUrl?: string;
}

export interface OwnedCar extends Car {
  paidSar: number;
  lotNo: number;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  budgetSar: number;
  garage: OwnedCar[];
  hasVoted: boolean;
}

export interface Bid {
  playerId: string;
  playerName: string;
  amountSar: number;
  atMs: number;
}

export interface Lot {
  no: number;
  car: Car;
  topBidSar: number;
  topBidderId: string | null;
  topBidderName: string | null;
  startedAtMs: number;
  endsAtMs: number;
  windowMs: number;
  bids: Bid[];
  extendedAtMs?: number | null;
  result: null | { winnerId: string | null; winnerName: string | null; amountSar: number };
}

export interface Settings {
  garageSize: 3 | 4 | 5 | 6;
  budgetSar: number;
  level: Level;
  bidWindowSec: 10 | 15 | 20 | 30;
  antiSnipeSec: number;
  hideMarketPrice: boolean;
  allowSellBack: boolean;
}

export interface Theme {
  id: string;
  titleAr: string;
  descAr: string;
}

export interface ResultRow {
  playerId: string;
  name: string;
  rank: number;
  score100: number;
  votersCount: number;
  spentSar: number;
  leftSar: number;
  garage: OwnedCar[];
  breakdown?: { voterName: string; score: number }[];
}

export interface GameState {
  code: string;
  phase: Phase;
  hostId: string;
  settings: Settings;
  players: Player[];
  lot: Lot | null;
  theme: Theme | null;
  results: ResultRow[] | null;
  revealedCount: number;
  log: { ts: number; textAr: string }[];
  serverNowMs: number;
  connection: 'live' | 'reconnecting' | 'lost';
}

export interface Actions {
  createRoom(name: string): void;
  joinRoom(code: string, name: string): void;
  updateSettings(patch: Partial<Settings>): void;
  startAuction(): void;
  placeBid(amountSar: number): void;
  sellCar(garageIndex: number): void;
  startVoting(): void;
  submitVotes(scores: Record<string, number>): void;
  revealNext(): void;
  newRound(): void;
}

export interface ScreenProps {
  state: GameState;
  actions: Actions;
  myId: string;
}
