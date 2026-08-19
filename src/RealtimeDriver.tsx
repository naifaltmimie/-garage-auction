import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Actions, Bid, GameState, Settings } from './types';
import { color, font } from './tokens';
import { isConfigured, ensureSession, supabase } from './lib/supabase';
import AuctionScreen from './screens/AuctionScreen';
import LandingScreen from './screens/LandingScreen';
import LobbyScreen from './screens/LobbyScreen';
import ThemeScreen from './screens/ThemeScreen';
import VotingScreen from './screens/VotingScreen';
import ResultsScreen from './screens/ResultsScreen';

const ROOM_KEY = 'mazad.room';
const POLL_MS = 4000;
const TICK_MS = 250;
const TICK_RPC_MS = 900;

const DEFAULT_SETTINGS: Settings = {
  garageSize: 4, budgetSar: 800000, level: 'medium', bidWindowSec: 20,
  antiSnipeSec: 7, hideMarketPrice: false, allowSellBack: true,
};

function landingState(): GameState {
  return {
    code: '', phase: 'landing', hostId: '', settings: DEFAULT_SETTINGS,
    players: [], lot: null, theme: null, results: null, revealedCount: 0,
    log: [], serverNowMs: Date.now(), connection: 'live',
  };
}

const BID_MESSAGE: Record<string, string> = {
  too_low: 'ما نقبلت — لازم أعلى من المزايدة الحالية',
  stale: 'أنت أصلاً صاحب أعلى مزايدة',
  broke: 'ما نقبلت — رصيدك ما يكفي',
  full: 'ما نقبلت — كراجك كامل',
  closed: 'ما نقبلت — اللوت خلص',
};

export default function RealtimeDriver() {
  const [myId, setMyId] = useState('');
  const [code, setCode] = useState<string | null>(() => {
    try { return localStorage.getItem(ROOM_KEY); } catch { return null; }
  });
  const [state, setState] = useState<GameState>(landingState);
  const [connection, setConnection] = useState<GameState['connection']>('live');
  const [fatal, setFatal] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const codeRef = useRef(code);
  codeRef.current = code;
  const lastTickRef = useRef(0);

  const rememberRoom = useCallback((next: string | null) => {
    try {
      if (next) localStorage.setItem(ROOM_KEY, next);
      else localStorage.removeItem(ROOM_KEY);
    } catch { /* private browsing — the session still works, just no reconnect */ }
    setCode(next);
  }, []);

  const pushLog = useCallback((textAr: string) => {
    setState((s) => ({ ...s, log: [{ ts: Date.now(), textAr }, ...s.log].slice(0, 12) }));
  }, []);

  useEffect(() => {
    if (!isConfigured) { setFatal('الاتصال بالخادم غير مهيأ'); return; }
    ensureSession()
      .then(setMyId)
      .catch(() => setFatal('ما قدرنا نبدأ جلسة — جرّب تحديث الصفحة'));
  }, []);

  const refresh = useCallback(async (roomCode: string) => {
    const { data, error } = await supabase.rpc('get_state', { p_code: roomCode });
    if (error) {
      if (/room not found|not a member/i.test(error.message)) {
        rememberRoom(null);
        setState(landingState());
      }
      return;
    }
    if (data) setState(data as GameState);
  }, [rememberRoom]);

  useEffect(() => {
    if (!myId || !code) return;
    void refresh(code);
    const id = setInterval(() => void refresh(code), POLL_MS);
    return () => clearInterval(id);
  }, [myId, code, refresh]);

  useEffect(() => {
    if (!myId || !code) return;

    const channel = supabase.channel(`room:${code}`, { config: { private: true } });

    channel.on('broadcast', { event: 'room' }, ({ payload }) => {
      const p = payload as Record<string, unknown>;

      if (p.type === 'bid') {
        setState((s) => {
          if (!s.lot || s.lot.no !== p.lotNo) return s;
          const bid: Bid = {
            playerId: String(p.topBidderId),
            playerName: String(p.topBidderName),
            amountSar: Number(p.topBidSar),
            atMs: Number(p.atMs),
          };
          const already = s.lot.bids.some(
            (b) => b.playerId === bid.playerId && b.amountSar === bid.amountSar,
          );
          return {
            ...s,
            serverNowMs: Number(p.serverNowMs) || s.serverNowMs,
            lot: {
              ...s.lot,
              topBidSar: bid.amountSar,
              topBidderId: bid.playerId,
              topBidderName: bid.playerName,
              endsAtMs: Number(p.endsAtMs),
              extendedAtMs: p.extendedAtMs == null ? s.lot.extendedAtMs : Number(p.extendedAtMs),
              bids: already ? s.lot.bids : [bid, ...s.lot.bids].slice(0, 8),
            },
          };
        });
        return;
      }

      void refresh(code);
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') { setConnection('live'); void refresh(code); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('reconnecting');
      else if (status === 'CLOSED') setConnection('lost');
    });

    return () => { void supabase.removeChannel(channel); };
  }, [myId, code, refresh]);

  useEffect(() => {
    const onWake = () => { if (!document.hidden && codeRef.current) void refresh(codeRef.current); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [refresh]);

  useEffect(() => {
    if (!myId || !code) return;
    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.phase !== 'auction' || !s.lot) return;

      const skew = s.serverNowMs - Date.now();
      const expired = Date.now() + skew >= s.lot.endsAtMs;
      const awaitingNextLot = s.lot.result != null;
      if (!expired && !awaitingNextLot) return;

      const now = Date.now();
      if (now - lastTickRef.current < TICK_RPC_MS) return;
      lastTickRef.current = now + Math.floor(Math.random() * 250);

      void supabase.rpc('settle_lot', { p_code: code });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [myId, code]);

  const call = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) { pushLog(error.message); return null; }
    return data;
  }, [pushLog]);

  const actions: Actions = useMemo(() => ({
    async createRoom(name) {
      const data = await call('create_room', { host_name: name });
      const next = (data as { code?: string } | null)?.code;
      if (next) { rememberRoom(next); await refresh(next); }
    },
    async joinRoom(roomCode, name) {
      const data = await call('join_room', { p_code: roomCode, p_name: name });
      const next = (data as { code?: string } | null)?.code;
      if (next) { rememberRoom(next); await refresh(next); }
    },
    updateSettings(patch) {
      const c = codeRef.current; if (!c) return;
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      void call('update_settings', { p_code: c, patch });
    },
    startAuction() {
      const c = codeRef.current; if (c) void call('start_auction', { p_code: c });
    },
    async placeBid(amountSar) {
      const c = codeRef.current; if (!c) return;
      const result = await call('place_bid', { p_code: c, amount: amountSar });
      if (typeof result === 'string' && result !== 'accepted') {
        pushLog(BID_MESSAGE[result] ?? 'ما نقبلت المزايدة');
        void refresh(c);
      }
    },
    sellCar(garageIndex) {
      const c = codeRef.current; if (c) void call('sell_car', { p_code: c, garage_index: garageIndex });
    },
    startVoting() {
      const c = codeRef.current; if (c) void call('start_voting', { p_code: c });
    },
    submitVotes(scores) {
      const c = codeRef.current; if (c) void call('submit_votes', { p_code: c, scores });
    },
    revealNext() {
      const c = codeRef.current; if (c) void call('reveal_next', { p_code: c });
    },
    async newRound() {
      const c = codeRef.current; if (c) await call('new_round', { p_code: c });
    },
  }), [call, pushLog, refresh, rememberRoom]);

  if (fatal) return <Notice text={fatal} />;
  if (!myId) return <Notice text="جاري التحضير…" />;

  const view: GameState = code ? { ...state, connection } : landingState();
  const props = { state: view, actions, myId };

  switch (view.phase) {
    case 'lobby':   return <LobbyScreen {...props} />;
    case 'auction': return <AuctionScreen {...props} />;
    case 'theme':   return <ThemeScreen {...props} />;
    case 'vote':    return <VotingScreen {...props} />;
    case 'results': return <ResultsScreen {...props} />;
    default:        return <LandingScreen {...props} />;
  }
}

function Notice({ text }: { text: string }) {
  return (
    <div style={{
      minHeight: '60vh', display: 'grid', placeItems: 'center', padding: 24,
      fontFamily: font.body, fontSize: 15, color: color.mute, textAlign: 'center',
    }}>
      {text}
    </div>
  );
}
