import type { CSSProperties } from 'react';
import type { Bid, Car, Player, Tier } from '../types';
import { color, font, sar, tier as tierColor } from '../tokens';
import { TIER_AR, Money } from './atoms';

export function CarStage({ car, lotNo, hideMarketPrice }: { car: Car; lotNo: number; hideMarketPrice: boolean }) {
  return <div>
    <div style={{ position: 'relative', aspectRatio: '16 / 10', width: '100%', background: color.panel2, borderRadius: 6, overflow: 'hidden', border: `1px solid ${color.line}` }}>
      {car.imageUrl ? <img src={car.imageUrl} alt={car.nameAr} loading="eager" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
      <div style={{ position: 'absolute', inset: 0, zIndex: -1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontFamily: font.display, fontWeight: 900, fontSize: 'clamp(40px, 12vw, 76px)', lineHeight: 1, color: tierColor[car.tier], opacity: 0.16, userSelect: 'none' }}>{TIER_AR[car.tier]}</span></div>
      <span dir="ltr" style={{ position: 'absolute', insetInlineStart: 10, insetBlockStart: 10, fontFamily: font.num, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: color.text, background: 'rgba(13,17,23,.82)', border: `1px solid ${color.line}`, borderRadius: 4, padding: '4px 9px' }}>LOT {String(lotNo).padStart(3, '0')}</span>
    </div>
    <h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(28px, 7.5vw, 46px)', lineHeight: 1.18, margin: '16px 0 12px', color: color.text }}>{car.nameAr}</h1>
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 10 }}><TierChip t={car.tier} />{car.comedyNoteAr && <span style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>{car.comedyNoteAr}</span>}{!hideMarketPrice && <span style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>سعر السوق <Money muted>{sar(car.marketPriceSar)}</Money></span>}</div>
  </div>;
}

function TierChip({ t }: { t: Tier }) {
  const c = tierColor[t];
  return <span style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '4px 14px', lineHeight: 1 }}>{TIER_AR[t]}</span>;
}

export function BidLadder({ bids, myId }: { bids: Bid[]; myId: string }) {
  const rows = bids.slice(0, 4);
  if (!rows.length) return <p style={{ margin: 0, fontFamily: font.body, fontSize: 13, color: color.mute, textAlign: 'center' }}>ما بدأت المزايدة</p>;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{rows.map((b, i) => {
    const mine = b.playerId === myId; const lead = i === 0;
    return <div key={`${b.playerId}-${b.atMs}`} style={{ display: 'flex', alignItems: 'center', gap: 9, opacity: lead ? 1 : Math.max(0.32, 0.72 - i * 0.16), paddingInlineStart: i * 10, transition: 'opacity .2s' }}><Avatar name={b.playerName} accent={lead} /><span style={{ fontFamily: font.body, fontSize: lead ? 14 : 13, fontWeight: lead ? 700 : 500, color: lead ? color.text : color.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.playerName}{mine && <span style={{ color: color.brass, marginInlineStart: 5 }}>أنت</span>}</span><span style={{ flex: 1, height: 1, background: color.line, minWidth: 8 }} /><Money muted={!lead} style={{ fontSize: lead ? 16 : 13 }}>{sar(b.amountSar)}</Money></div>;
  })}</div>;
}

function Avatar({ name, accent }: { name: string; accent?: boolean }) {
  return <span aria-hidden style={{ flex: '0 0 auto', width: 24, height: 24, borderRadius: 999, display: 'grid', placeItems: 'center', fontFamily: font.body, fontSize: 12, fontWeight: 700, color: accent ? color.ink : color.mute, background: accent ? color.brass : 'transparent', border: `1px solid ${accent ? color.brass : color.line}` }}>{name.trim().charAt(0)}</span>;
}

export function OutbidBanner({ bids, myId, topBidderId }: { bids: Bid[]; myId: string; topBidderId: string | null }) {
  const iBid = bids.some((b) => b.playerId === myId);
  if (!iBid || topBidderId === myId || topBidderId == null) return null;
  return <div role="status" style={{ fontFamily: font.body, fontSize: 13, fontWeight: 700, color: color.red, border: `1px solid ${color.red}`, borderRadius: 4, padding: '8px 12px', textAlign: 'center', marginBottom: 10 }}>طلعوا عليك</div>;
}

export function BidderRail({ players, myId, garageSize, topBidSar, topBidderId }: { players: Player[]; myId: string; garageSize: number; topBidSar: number; topBidderId: string | null }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{players.map((p) => {
    const full = p.garage.length >= garageSize; const broke = p.budgetSar <= topBidSar; const out = full || broke; const lead = p.id === topBidderId; const label = full ? 'كراج كامل' : broke ? 'ما يكفي' : null;
    return <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: font.body, fontSize: 12, fontWeight: 500, color: lead ? color.brass : out ? color.mute : color.text, border: `1px solid ${lead ? color.brass : color.line}`, borderRadius: 999, padding: '4px 11px', opacity: out ? 0.5 : 1 }}>{p.name}{p.id === myId && <b style={{ color: color.brass, fontWeight: 700 }}>أنت</b>}{label && <span style={{ fontSize: 11, color: color.mute }}>· {label}</span>}</span>;
  })}</div>;
}

export function BudgetMeter({ me, garageSize }: { me: Player; garageSize: number }) {
  const slotsLeft = Math.max(0, garageSize - me.garage.length); const perSlot = slotsLeft > 0 ? Math.floor(me.budgetSar / slotsLeft) : 0; const spent = me.garage.reduce((s, c) => s + c.paidSar, 0); const total = spent + me.budgetSar; const usedPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  return <div><div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}><span style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>باقي <Money style={{ fontSize: 15 }}>{sar(me.budgetSar)}</Money></span><span style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>· {slotsLeft} {slotsLeft === 1 ? 'موقف' : 'مواقف'}</span><div style={{ flex: 1 }} />{slotsLeft > 0 && <span style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>للموقف الواحد <Money style={{ fontSize: 15 }}>{sar(perSlot)}</Money></span>}</div><div style={{ height: 4, background: color.panel2, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${usedPct}%`, background: color.brass, transition: 'width .4s ease' }} /></div></div>;
}

export function ExtensionPip({ extendedAtMs, seconds }: { extendedAtMs?: number | null; seconds: number }) {
  if (!extendedAtMs || Date.now() - extendedAtMs > 1600) return null;
  return <span key={extendedAtMs} dir="ltr" style={{ fontFamily: font.num, fontSize: 13, fontWeight: 600, color: color.green, border: `1px solid ${color.green}`, borderRadius: 999, padding: '2px 9px', animation: 'stamp 280ms cubic-bezier(.2,1.6,.4,1)' }}>+{seconds}s</span>;
}

export function GavelCadence({ msLeft, hasBid }: { msLeft: number; hasBid: boolean }) {
  if (!hasBid || msLeft > 3000 || msLeft <= 0) return null;
  const word = msLeft > 2000 ? 'وحدة' : msLeft > 1000 ? 'ثنتين' : 'ثلاثة';
  return <div key={word} style={{ fontFamily: font.display, fontWeight: 700, fontSize: 20, color: color.red, animation: 'stamp 240ms cubic-bezier(.2,1.6,.4,1)' }}>{word}…</div>;
}

export const sectionLabel: CSSProperties = { marginBottom: 10 };
