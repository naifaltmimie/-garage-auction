import { useMemo, useState } from 'react';
import type { Actions, Car, GameState, OwnedCar, Phase, Player } from './types';
import { color, font } from './tokens';
import AuctionScreen from './screens/AuctionScreen';
import LandingScreen from './screens/LandingScreen';
import LobbyScreen from './screens/LobbyScreen';
import ThemeScreen from './screens/ThemeScreen';
import VotingScreen from './screens/VotingScreen';
import ResultsScreen from './screens/ResultsScreen';

const CARS: Car[] = [
  { id: 'c-lc', nameAr: 'تويوتا لاندكروزر VXR 2024', nameEn: 'Toyota Land Cruiser VXR', year: 2024, tier: 'luxury', marketPriceSar: 445000, segment: 'SUV', powerHp: 409, seats: 7, comedyNoteAr: 'ممشى 480 ألف', imageUrl: '/cars/placeholder.svg' },
  { id: 'c-mustang', nameAr: 'فورد موستنج GT 2022', nameEn: 'Ford Mustang GT', year: 2022, tier: 'sport', marketPriceSar: 210000, segment: 'coupe', powerHp: 460, seats: 4, imageUrl: '/cars/placeholder.svg' },
  { id: 'c-tahoe', nameAr: 'شفروليه تاهو Z71 2021', nameEn: 'Chevrolet Tahoe Z71', year: 2021, tier: 'suv', marketPriceSar: 175000, segment: 'SUV', powerHp: 355, seats: 8 },
  { id: 'c-corolla', nameAr: 'تويوتا كورولا 2019', nameEn: 'Toyota Corolla', year: 2019, tier: 'daily', marketPriceSar: 52000, segment: 'sedan', powerHp: 139, seats: 5, comedyNoteAr: 'ريحة الليمون ما تطلع' },
  { id: 'c-caprice', nameAr: 'شفروليه كابرس 2006', nameEn: 'Chevrolet Caprice', year: 2006, tier: 'junk', marketPriceSar: 14000, segment: 'sedan', powerHp: 190, seats: 5, comedyNoteAr: 'الكندشن دفّاية' },
];

function owned(car: Car, paidSar: number, lotNo: number): OwnedCar { return { ...car, paidSar, lotNo }; }
const ME = 'p1';
function basePlayers(): Player[] { return [
  { id: 'p1', name: 'عبدالهادي', isHost: true, connected: true, budgetSar: 620000, garage: [owned(CARS[2], 130000, 3)], hasVoted: false },
  { id: 'p2', name: 'سلطان', isHost: false, connected: true, budgetSar: 410000, garage: [owned(CARS[1], 190000, 2)], hasVoted: false },
  { id: 'p3', name: 'نوف', isHost: false, connected: true, budgetSar: 0, garage: [], hasVoted: false },
  { id: 'p4', name: 'ماجد', isHost: false, connected: false, budgetSar: 305000, garage: [owned(CARS[3], 48000, 1)], hasVoted: false },
]; }
function eightPlayers(): Player[] { return [...basePlayers(), { id: 'p5', name: 'ريم', isHost: false, connected: true, budgetSar: 500000, garage: [], hasVoted: false }, { id: 'p6', name: 'فيصل', isHost: false, connected: true, budgetSar: 500000, garage: [], hasVoted: false }, { id: 'p7', name: 'دانة', isHost: false, connected: true, budgetSar: 500000, garage: [], hasVoted: false }, { id: 'p8', name: 'تركي', isHost: false, connected: true, budgetSar: 500000, garage: [], hasVoted: false }]; }
const BASE_SETTINGS: GameState['settings'] = { garageSize: 4, budgetSar: 700000, level: 'medium', bidWindowSec: 20, antiSnipeSec: 7, hideMarketPrice: false, allowSellBack: true };
function baseLog() { const t = Date.now(); return [{ ts: t - 2000, textAr: '🔨 سلطان زايد 190,000' }, { ts: t - 9000, textAr: '🔨 عبدالهادي زايد 130,000' }, { ts: t - 16000, textAr: 'بدأ اللوت 007' }, { ts: t - 40000, textAr: '🔨 ماجد أخذ كورولا 2019 بسعر 48,000' }]; }

export type Scenario = 'landing' | 'lobby' | 'lobby2' | 'lobby8' | 'lobbyHell' | 'auction' | 'auctionNoBids' | 'auctionUrgent' | 'auctionMyFull' | 'auctionSold' | 'auctionPassed' | 'auctionHidden' | 'auctionLost' | 'theme' | 'vote' | 'voteSubmitted' | 'results' | 'resultsMid' | 'reconnecting';
const SCENARIO_LABELS: Record<Scenario, string> = { landing: 'Landing', lobby: 'Lobby (4 players)', lobby2: 'Lobby (2 players)', lobby8: 'Lobby (8 players)', lobbyHell: 'Lobby (hell budget)', auction: 'Auction (live, has bid)', auctionNoBids: 'Auction — no bids yet', auctionUrgent: 'Auction — urgent (<5s)', auctionMyFull: 'Auction — my garage full', auctionSold: 'Auction — sold', auctionPassed: 'Auction — passed (no bids)', auctionHidden: 'Auction — market price hidden', auctionLost: 'Auction — connection lost', theme: 'Theme reveal', vote: 'Voting', voteSubmitted: 'Voting — mine submitted', results: 'Results — full reveal', resultsMid: 'Results — mid reveal', reconnecting: 'Connection: reconnecting' };

function liveLot(no: number, carIndex: number, windowSec: number, msRemaining: number, withBid: boolean): NonNullable<GameState['lot']> {
  const now = Date.now(); const windowMs = windowSec * 1000;
  return { no, car: CARS[carIndex], topBidSar: withBid ? 190000 : 0, topBidderId: withBid ? 'p2' : null, topBidderName: withBid ? 'سلطان' : null, startedAtMs: now - (windowMs - msRemaining), endsAtMs: now + msRemaining, windowMs, bids: withBid ? [{ playerId: 'p2', playerName: 'سلطان', amountSar: 190000, atMs: now - 3200 }, { playerId: 'p1', playerName: 'عبدالهادي', amountSar: 165000, atMs: now - 9400 }, { playerId: 'p3', playerName: 'نوف', amountSar: 140000, atMs: now - 15100 }, { playerId: 'p2', playerName: 'سلطان', amountSar: 115000, atMs: now - 21800 }] : [], extendedAtMs: null, result: null };
}

function makeResults(): GameState['results'] {
  const rows = [
    { playerId: 'p1', name: 'عبدالهادي', score100: 88, spentSar: 340000, leftSar: 360000, garage: [owned(CARS[0], 210000, 5), owned(CARS[2], 130000, 3)] },
    { playerId: 'p2', name: 'سلطان', score100: 71, spentSar: 260000, leftSar: 240000, garage: [owned(CARS[1], 190000, 2), owned(CARS[3], 70000, 4)] },
    { playerId: 'p3', name: 'نوف', score100: 54, spentSar: 500000, leftSar: 0, garage: [owned(CARS[2], 175000, 6), owned(CARS[1], 205000, 7)] },
    { playerId: 'p4', name: 'ماجد', score100: 22, spentSar: 62000, leftSar: 243000, garage: [owned(CARS[4], 14000, 8), owned(CARS[3], 48000, 1)] },
  ];
  const voters = ['عبدالهادي', 'سلطان', 'نوف', 'ماجد'];
  return rows.map((r, i) => ({ ...r, rank: i + 1, votersCount: 3, breakdown: voters.filter((v) => v !== r.name).map((voterName, k) => ({ voterName, score: Math.max(1, Math.min(10, Math.round(r.score100 / 10) - k + 1)) })) }));
}

function buildState(scenario: Scenario): GameState {
  const base: GameState = { code: 'M9K2', phase: 'lobby', hostId: ME, settings: { ...BASE_SETTINGS }, players: basePlayers(), lot: null, theme: null, results: null, revealedCount: 0, log: [], serverNowMs: Date.now(), connection: 'live' };
  switch (scenario) {
    case 'landing': return { ...base, phase: 'landing', players: [] };
    case 'lobby': return { ...base, phase: 'lobby' };
    case 'lobby2': return { ...base, phase: 'lobby', players: basePlayers().slice(0, 2) };
    case 'lobby8': return { ...base, phase: 'lobby', players: eightPlayers() };
    case 'lobbyHell': return { ...base, phase: 'lobby', settings: { ...BASE_SETTINGS, level: 'hell', budgetSar: 120000 } };
    case 'auction': return { ...base, phase: 'auction', lot: liveLot(7, 0, 20, 12400, true), log: baseLog() };
    case 'auctionNoBids': return { ...base, phase: 'auction', lot: liveLot(8, 0, 20, 15000, false), log: baseLog() };
    case 'auctionUrgent': return { ...base, phase: 'auction', lot: liveLot(7, 0, 20, 3800, true), log: baseLog() };
    case 'auctionMyFull': return { ...base, phase: 'auction', lot: liveLot(9, 1, 20, 11000, true), players: basePlayers().map((p) => p.id === ME ? { ...p, garage: [owned(CARS[2], 130000, 3), owned(CARS[0], 210000, 5), owned(CARS[3], 60000, 4), owned(CARS[4], 18000, 6)] } : p), log: baseLog() };
    case 'auctionLost': return { ...base, phase: 'auction', lot: liveLot(7, 0, 20, 8000, true), log: baseLog(), connection: 'lost' };
    case 'auctionSold': return { ...base, phase: 'auction', lot: { ...liveLot(7, 0, 20, 0, true), result: { winnerId: 'p2', winnerName: 'سلطان', amountSar: 190000 } }, log: baseLog() };
    case 'auctionPassed': return { ...base, phase: 'auction', lot: { ...liveLot(8, 4, 20, 0, false), result: { winnerId: null, winnerName: null, amountSar: 0 } }, log: baseLog() };
    case 'auctionHidden': return { ...base, phase: 'auction', settings: { ...BASE_SETTINGS, hideMarketPrice: true }, lot: liveLot(7, 0, 20, 3800, true), log: baseLog() };
    case 'theme': return { ...base, phase: 'theme', theme: { id: 't1', titleAr: 'أفخم كراج', descAr: 'مين جمّع أرقى تشكيلة سيارات؟ الفخامة تتكلم.' } };
    case 'vote': return { ...base, phase: 'vote', theme: { id: 't1', titleAr: 'أفخم كراج', descAr: 'مين جمّع أرقى تشكيلة سيارات؟ الفخامة تتكلم.' } };
    case 'voteSubmitted': return { ...base, phase: 'vote', theme: { id: 't1', titleAr: 'أفخم كراج', descAr: 'مين جمّع أرقى تشكيلة سيارات؟ الفخامة تتكلم.' }, players: basePlayers().map((p) => p.id === ME || p.id === 'p2' ? { ...p, hasVoted: true } : p) };
    case 'results': return { ...base, phase: 'results', results: makeResults(), revealedCount: 4, theme: { id: 't1', titleAr: 'أفخم كراج', descAr: 'مين جمّع أرقى تشكيلة سيارات؟' } };
    case 'resultsMid': return { ...base, phase: 'results', results: makeResults(), revealedCount: 2, theme: { id: 't1', titleAr: 'أفخم كراج', descAr: 'مين جمّع أرقى تشكيلة سيارات؟' } };
    case 'reconnecting': return { ...base, phase: 'auction', lot: liveLot(7, 0, 20, 8000, true), log: baseLog(), connection: 'reconnecting' };
  }
}

const ADVANCE: Record<Phase, Scenario> = { landing: 'lobby', lobby: 'auction', auction: 'theme', theme: 'vote', vote: 'results', results: 'landing' };

export default function MockDriver() {
  const [scenario, setScenario] = useState<Scenario>('auction');
  const [state, setState] = useState<GameState>(() => buildState('auction'));
  const load = (s: Scenario) => { setScenario(s); setState(buildState(s)); };
  const actions: Actions = useMemo(() => ({
    createRoom(name) { console.log('[mock] createRoom', name); load('lobby'); },
    joinRoom(code, name) { console.log('[mock] joinRoom', code, name); load('lobby'); },
    updateSettings(patch) { setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })); },
    startAuction() { load('auction'); },
    placeBid(amount) { setState((s) => { if (!s.lot) return s; const me = s.players.find((p) => p.id === ME); return { ...s, lot: { ...s.lot, topBidSar: amount, topBidderId: ME, topBidderName: me?.name ?? null, endsAtMs: Date.now() + s.lot.windowMs, bids: [{ playerId: ME, playerName: me?.name ?? 'أنا', amountSar: amount, atMs: Date.now() }, ...s.lot.bids].slice(0, 8) }, log: [{ ts: Date.now(), textAr: `🔨 ${me?.name} زايد ${amount.toLocaleString('en-US')}` }, ...s.log].slice(0, 9) }; }); },
    sellCar(index) { setState((s) => ({ ...s, players: s.players.map((p) => p.id === ME ? { ...p, garage: p.garage.filter((_, i) => i !== index) } : p) })); },
    startVoting() { load('vote'); },
    submitVotes() { setState((s) => ({ ...s, players: s.players.map((p) => p.id === ME ? { ...p, hasVoted: true } : p) })); },
    revealNext() { setState((s) => ({ ...s, revealedCount: Math.min((s.results?.length ?? 0), s.revealedCount + 1) })); },
    newRound() { load('lobby'); },
  }), []);
  const advance = () => load(ADVANCE[state.phase]);
  const extend = () => setState((s) => s.lot && !s.lot.result ? { ...s, lot: { ...s.lot, endsAtMs: s.lot.endsAtMs + 6000, windowMs: s.lot.windowMs + 6000, extendedAtMs: Date.now() } } : s);
  const props = { state, actions, myId: ME };
  return <>{state.phase === 'landing' && <LandingScreen {...props} />}{state.phase === 'lobby' && <LobbyScreen {...props} />}{state.phase === 'auction' && <AuctionScreen {...props} />}{state.phase === 'theme' && <ThemeScreen {...props} />}{state.phase === 'vote' && <VotingScreen {...props} />}{state.phase === 'results' && <ResultsScreen {...props} />}<DevSwitcher scenario={scenario} onScenario={load} onAdvance={advance} onExtend={extend} phase={state.phase} /></>;
}

function DevSwitcher({ scenario, onScenario, onAdvance, onExtend, phase }: { scenario: Scenario; onScenario: (s: Scenario) => void; onAdvance: () => void; onExtend: () => void; phase: Phase }) {
  const [open, setOpen] = useState(true);
  const box: React.CSSProperties = { position: 'fixed', bottom: 12, left: 12, zIndex: 9999, display: 'flex', gap: 8, alignItems: 'center', background: color.panel, border: `1px solid ${color.line}`, borderRadius: 6, padding: 8, fontFamily: font.num, fontSize: 12, color: color.text, boxShadow: '0 6px 24px rgba(0,0,0,.5)' };
  if (!open) return <button style={{ ...box, cursor: 'pointer' }} onClick={() => setOpen(true)}>dev</button>;
  return <div style={box} dir="ltr"><select value={scenario} onChange={(e) => onScenario(e.target.value as Scenario)} style={{ background: color.panel2, color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, padding: '6px 8px', fontFamily: font.num, fontSize: 12 }}>{(Object.keys(SCENARIO_LABELS) as Scenario[]).map((s) => <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>)}</select><button onClick={onAdvance} style={{ background: color.brass, color: color.ink, border: 'none', borderRadius: 4, padding: '6px 10px', fontFamily: font.num, fontWeight: 600, cursor: 'pointer' }}>advance ▸ {phase}</button><button onClick={onExtend} style={{ background: color.panel2, color: color.text, border: `1px solid ${color.line}`, borderRadius: 4, padding: '6px 10px', fontFamily: font.num, cursor: 'pointer' }}>+6s snipe</button><button onClick={() => setOpen(false)} style={{ background: 'transparent', color: color.mute, border: `1px solid ${color.line}`, borderRadius: 4, padding: '6px 8px', cursor: 'pointer' }}>×</button></div>;
}
