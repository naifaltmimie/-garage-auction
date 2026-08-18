import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Lot, ScreenProps } from '../types';
import { color, font, sar } from '../tokens';
import { useDerived } from '../useDerived';
import { Button, ConnectionBanner, Eyebrow, Header, Money, Panel } from '../components/atoms';
import { Plate } from '../components/Plate';
import { GarageCard } from '../components/GarageCard';
import { BidLadder, BidderRail, BudgetMeter, CarStage, ExtensionPip, GavelCadence, OutbidBanner } from '../components/auction';

const QUICK = [5000, 25000, 100000];

export default function AuctionScreen({ state, actions, myId }: ScreenProps) {
  const d = useDerived(state, myId); const lot = state.lot; const [custom, setCustom] = useState('');
  const header = <Header code={state.code} budgetSar={d.me?.budgetSar} filled={d.me?.garage.length} size={d.garageSize} isHost={d.isHost} />;
  if (!lot) return <div style={wrap}>{header}<ConnectionBanner connection={state.connection} /><p style={{ margin: 0, textAlign: 'center', padding: 40, fontFamily: font.body, fontSize: 15, color: color.mute }}>بانتظار اللوت التالي…</p></div>;
  const sold = lot.result != null; const secondsText = (d.msLeft / 1000).toFixed(1); const parsed = Number(custom.replace(/[^\d]/g, '')); const customValid = custom !== '' && Number.isFinite(parsed) && parsed >= d.minNextBid && d.affordable(parsed);
  const submitCustom = () => { if (!customValid) return; actions.placeBid(parsed); setCustom(''); };
  return <div style={wrap}>{header}<ConnectionBanner connection={state.connection} />
    <Panel surface="lot" style={{ position: 'relative', overflow: 'hidden', marginBottom: 22 }}><div style={{ height: 4, width: '100%', background: color.line }}><div style={{ height: '100%', width: `${d.pct * 100}%`, background: d.urgent ? color.red : color.brass, transition: 'width .14s linear' }} /></div><div style={{ padding: '18px 18px 24px', textAlign: 'center' }}><CarStage car={lot.car} lotNo={lot.no} hideMarketPrice={state.settings.hideMarketPrice} /><div style={{ margin: '22px 0 14px' }}><Plate key={`${lot.topBidSar}-${lot.topBidderId}`} amountText={sar(lot.topBidSar)} bidderName={lot.topBidderName} /></div><div aria-live="off" style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span style={{ fontFamily: font.num, fontWeight: 600, fontSize: 34, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: d.urgent ? color.red : color.mute, transform: d.urgent ? 'scale(1.15)' : 'scale(1)', transition: 'transform .18s ease, color .18s ease' }}>{secondsText}</span><ExtensionPip extendedAtMs={lot.extendedAtMs} seconds={state.settings.antiSnipeSec} /></div><div style={{ height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GavelCadence msLeft={d.msLeft} hasBid={lot.topBidderId != null} /></div><div style={{ marginTop: 14, paddingTop: 16, borderTop: `1px solid ${color.line}`, textAlign: 'start' }}><BidLadder bids={lot.bids} myId={myId} /></div></div>{sold && <SoldOverlay result={lot.result!} />}</Panel>
    {!sold && <div style={{ marginBottom: 24 }}>{d.myGarageFull ? <p style={{ margin: 0, fontFamily: font.body, fontSize: 15, color: color.mute, lineHeight: 1.6 }}>كراجك كامل. تقدر تبيع سيارة بنصف سعرها لو تبي تعدّل.</p> : <><OutbidBanner bids={lot.bids} myId={myId} topBidderId={lot.topBidderId} />{d.me && <div style={{ marginBottom: 16 }}><BudgetMeter me={d.me} garageSize={d.garageSize} /></div>}<Eyebrow style={{ marginBottom: 10 }}>زاود</Eyebrow><div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{lot.topBidderId == null && <Button onClick={() => actions.placeBid(0)} disabled={!d.canBid} style={{ flex: '1 1 120px' }}>افتح بصفر</Button>}{QUICK.map((inc) => { const amount = lot.topBidSar + inc; return <Button key={inc} variant={inc === 100000 ? 'primary' : 'ghost'} onClick={() => actions.placeBid(amount)} disabled={!d.canBid || !d.affordable(amount)} style={{ flex: '1 1 104px', fontFamily: font.num, letterSpacing: '0.01em' }}>+{sar(inc)}</Button>; })}</div><div style={{ display: 'flex', gap: 8, marginTop: 8 }}><input inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, ''))} onKeyDown={(e) => e.key === 'Enter' && submitCustom()} placeholder="مبلغ مخصص" aria-label="مبلغ مزايدة مخصص" disabled={!d.canBid} style={inputStyle} /><Button variant="primary" onClick={submitCustom} disabled={!d.canBid || !customValid}>زاود</Button></div><p style={{ margin: '12px 0 16px', fontFamily: font.body, fontSize: 12.5, color: color.mute, lineHeight: 1.7 }}>أقل مزايدة مقبولة <Money muted>{sar(d.minNextBid)}</Money> · كل مزايدة تضيف {state.settings.antiSnipeSec} ثواني للعدّاد</p><Eyebrow style={{ marginBottom: 8 }}>مين باقي في اللوت</Eyebrow><BidderRail players={state.players} myId={myId} garageSize={d.garageSize} topBidSar={lot.topBidSar} topBidderId={lot.topBidderId} /></>}</div>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginBottom: 24 }}>{state.players.map((p) => <GarageCard key={p.id} player={p} size={d.garageSize} isTop={lot.topBidderId === p.id} isMe={p.id === myId} hideMarket={state.settings.hideMarketPrice} allowSellBack={state.settings.allowSellBack} onSell={actions.sellCar} />)}</div><Log entries={state.log} />
  </div>;
}

function SoldOverlay({ result }: { result: NonNullable<Lot['result']> }) {
  const passed = result.winnerId == null; const c = passed ? color.mute : color.green;
  return <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,17,23,.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}><div role="status" aria-live="assertive" style={{ animation: 'slam 340ms cubic-bezier(.2,1,.3,1) both', textAlign: 'center' }}><div style={{ fontFamily: font.display, fontWeight: 400, fontSize: 'clamp(44px, 14vw, 84px)', lineHeight: 1, color: c, border: `4px solid ${c}`, borderRadius: 8, padding: '8px 28px' }}>{passed ? 'ما نزلت' : 'بيعت'}</div>{!passed && <div style={{ marginTop: 14, fontFamily: font.body, fontSize: 15, color: color.text }}>{result.winnerName} — <Money>{sar(result.amountSar)}</Money></div>}</div></div>;
}

function Log({ entries }: { entries: { ts: number; textAr: string }[] }) {
  return <div><Eyebrow style={{ marginBottom: 9 }}>السجل</Eyebrow><div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{entries.length === 0 && <div style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>ما فيه حركة بعد</div>}{entries.slice(0, 9).map((e, i) => <div key={e.ts} style={{ fontFamily: font.body, fontSize: 13, color: i === 0 ? color.text : color.mute, opacity: Math.max(0.35, 1 - i * 0.09) }}>{e.textAr}</div>)}</div></div>;
}

const wrap: CSSProperties = { maxWidth: 900, margin: '0 auto', padding: '20px 16px 96px' };
const inputStyle: CSSProperties = { flex: 1, minWidth: 0, minHeight: 44, background: color.panel2, border: `1px solid ${color.line}`, borderRadius: 4, padding: '0 14px', fontFamily: font.body, fontSize: 15, color: color.text };
