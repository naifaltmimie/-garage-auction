import type { OwnedCar, Player } from '../types';
import { color, font, sar, tier as tierColor } from '../tokens';
import { Button, Money, Panel } from './atoms';

export function GarageCard({ player, size, isTop, isMe, hideMarket, allowSellBack, onSell }: { player: Player; size: number; isTop: boolean; isMe: boolean; hideMarket: boolean; allowSellBack: boolean; onSell: (i: number) => void }) {
  const spent = player.garage.reduce((s, c) => s + c.paidSar, 0);
  const slots = Array.from({ length: size }, (_, i) => player.garage[i]);
  return <Panel surface="inset" style={{ padding: 13, opacity: player.connected ? 1 : 0.45 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      {isMe && <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: color.brass, flex: '0 0 auto' }} />}
      <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 15, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{player.name}</span>
      {!player.connected && <Tag>منقطع</Tag>}
      {isTop && <Tag accent>الأعلى</Tag>}
      <div style={{ flex: 1 }} />
      <span style={{ fontFamily: font.num, fontSize: 12, color: color.mute, flex: '0 0 auto' }}>{player.garage.length}/{size}</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {slots.map((car, i) => car ? <FilledRow key={i} car={car} index={i} isMe={isMe} hideMarket={hideMarket} allowSellBack={allowSellBack} onSell={onSell} /> : <div key={i} style={{ border: `1px dashed ${color.line}`, borderRadius: 4, padding: '10px 12px', fontFamily: font.body, fontSize: 13, color: color.mute }}>موقف فاضي</div>)}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 11, paddingTop: 9, borderTop: `1px solid ${color.line}`, fontFamily: font.body, fontSize: 12, color: color.mute }}>
      <span>مصروف <Money muted>{sar(spent)}</Money></span>
      <span>باقي <Money>{sar(player.budgetSar)}</Money></span>
    </div>
  </Panel>;
}

function Tag({ children, accent }: { children: string; accent?: boolean }) {
  return <span style={{ fontFamily: font.body, fontSize: 11, fontWeight: 600, color: accent ? color.brass : color.mute, border: `1px solid ${accent ? color.brass : color.line}`, borderRadius: 999, padding: '2px 9px', lineHeight: 1.4, flex: '0 0 auto' }}>{children}</span>;
}

function FilledRow({ car, index, isMe, hideMarket, allowSellBack, onSell }: { car: OwnedCar; index: number; isMe: boolean; hideMarket: boolean; allowSellBack: boolean; onSell: (i: number) => void }) {
  return <div style={{ background: color.panel, borderRadius: 4, borderInlineStart: `3px solid ${tierColor[car.tier]}`, padding: '9px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: font.body, fontSize: 13, color: color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{car.nameAr}</div>
      <div style={{ marginTop: 3 }}><Money style={{ fontSize: 12 }}>{sar(car.paidSar)}</Money>{!hideMarket && <span style={{ fontFamily: font.body, fontSize: 11, color: color.mute, marginInlineStart: 8 }}>سوق <Money muted style={{ fontSize: 11 }}>{sar(car.marketPriceSar)}</Money></span>}</div>
    </div>
    {isMe && allowSellBack && <Button variant="segment" onClick={() => onSell(index)} style={{ minHeight: 34, padding: '0 11px', fontSize: 12.5, flex: '0 0 auto' }}>بيع</Button>}
  </div>;
}
