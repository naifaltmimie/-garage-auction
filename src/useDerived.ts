import { useEffect, useMemo, useState } from 'react';
import type { GameState } from './types';

export interface Derived {
  me: GameState['players'][number] | undefined;
  isHost: boolean;
  garageSize: number;
  msLeft: number;
  pct: number;
  urgent: boolean;
  minNextBid: number;
  myGarageFull: boolean;
  canBid: boolean;
  affordable: (amount: number) => boolean;
  votedCount: number;
  allVoted: boolean;
  fullyRevealed: boolean;
}

export function useDerived(state: GameState, myId: string): Derived {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNowMs(Date.now()), 120);
    return () => clearInterval(i);
  }, []);

  const skew = useMemo(() => state.serverNowMs - Date.now(), [state.serverNowMs]);
  const lot = state.lot;

  const msLeft = lot ? Math.max(0, lot.endsAtMs - (nowMs + skew)) : 0;
  const pct = lot && lot.windowMs > 0 ? Math.max(0, Math.min(1, msLeft / lot.windowMs)) : 0;
  const urgent = !!lot && !lot.result && msLeft < 5000;

  const me = state.players.find((p) => p.id === myId);
  const isHost = state.hostId === myId;
  const garageSize = state.settings.garageSize;

  const minNextBid = lot ? (lot.topBidderId ? lot.topBidSar + 1 : 0) : 0;
  const myGarageFull = !!me && me.garage.length >= garageSize;
  const canBid = state.phase === 'auction' && !!lot && !lot.result && !!me && !myGarageFull;

  const affordable = (amount: number) => !!me && amount <= me.budgetSar;

  const votedCount = state.players.filter((p) => p.hasVoted).length;
  const allVoted = state.players.length > 0 && state.players.every((p) => p.hasVoted);
  const fullyRevealed = !!state.results && state.revealedCount >= state.results.length;

  return { me, isHost, garageSize, msLeft, pct, urgent, minNextBid, myGarageFull, canBid, affordable, votedCount, allVoted, fullyRevealed };
}
