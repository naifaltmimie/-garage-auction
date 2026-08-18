import { useState } from 'react';
import type { ScreenProps } from '../types';
import { color, font } from '../tokens';
import { Button, ConnectionBanner, Eyebrow, Header, Panel } from '../components/atoms';
import { GarageCard } from '../components/GarageCard';
import { useDerived } from '../useDerived';

export default function VotingScreen({ state, actions, myId }: ScreenProps) {
  const d = useDerived(state, myId);
  const [scores, setScores] = useState<Record<string, number>>({});
  const others = state.players.filter((p) => p.id !== myId);
  const submitted = d.me?.hasVoted ?? false;
  const complete = others.length > 0 && others.every((p) => scores[p.id] >= 1);
  return <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 60px' }}>
    <Header code={state.code} isHost={d.isHost} /><ConnectionBanner connection={state.connection} />
    <div style={{ position: 'sticky', top: 0, zIndex: 5, background: color.ink, padding: '10px 0 12px', marginBottom: 18, borderBottom: `1px solid ${color.line}`, textAlign: 'center' }}><Eyebrow>الفئة</Eyebrow><div style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(24px, 6vw, 34px)', lineHeight: 1.2, color: color.brassSoft, margin: '4px 0 2px' }}>{state.theme?.titleAr}</div><div style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>{state.theme?.descAr}</div></div>
    {submitted ? <Panel surface="inset" style={{ padding: 28, textAlign: 'center' }}><div style={{ fontFamily: font.body, fontSize: 17, fontWeight: 700, color: color.text, marginBottom: 6 }}>وصل تقييمك ✓</div><div style={{ fontFamily: font.body, fontSize: 13, color: color.mute }}>أرسلوا <span style={{ fontFamily: font.num, color: color.brass }}>{d.votedCount}</span> من <span style={{ fontFamily: font.num }}>{state.players.length}</span></div></Panel> : <div style={{ display: 'grid', gap: 22 }}>{others.map((p) => <div key={p.id}><GarageCard player={p} size={d.garageSize} isTop={false} isMe={false} hideMarket={state.settings.hideMarketPrice} allowSellBack={false} onSell={() => {}} /><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>{Array.from({ length: 10 }, (_, i) => i + 1).map((v) => { const on = scores[p.id] === v; return <button key={v} onClick={() => setScores((s) => ({ ...s, [p.id]: v }))} aria-label={`${p.name} — ${v} من ١٠`} aria-pressed={on} style={{ flex: '1 1 34px', minHeight: 44, fontFamily: font.num, fontSize: 15, fontWeight: 600, background: on ? color.brass : 'transparent', color: on ? color.ink : color.text, border: `1px solid ${on ? color.brass : color.line}`, borderRadius: 4, cursor: 'pointer', transition: 'background .12s, color .12s' }}>{v}</button>; })}</div></div>)}<Button variant="primary" disabled={!complete} onClick={() => actions.submitVotes(scores)} style={{ width: '100%', fontSize: 16 }}>{complete ? 'أرسل التقييم' : 'قيّم كل الكراجات أول'}</Button></div>}
    {d.isHost && <div style={{ marginTop: 24, textAlign: 'center' }}><Button variant="primary" disabled={!d.allVoted} onClick={actions.revealNext} style={{ minWidth: 200 }}>{d.allVoted ? 'اكشف الترتيب' : `بانتظار ${state.players.length - d.votedCount} تقييم`}</Button></div>}
  </div>;
}
