import type { ScreenProps } from '../types';
import { color, font } from '../tokens';
import { Button, ConnectionBanner, Eyebrow, Header } from '../components/atoms';
import { useDerived } from '../useDerived';

export default function ThemeScreen({ state, actions, myId }: ScreenProps) {
  const d = useDerived(state, myId);
  return <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px 16px 60px' }}>
    <Header code={state.code} isHost={d.isHost} /><ConnectionBanner connection={state.connection} />
    <div style={{ textAlign: 'center', paddingTop: 18 }}><Eyebrow>الكراجات اكتملت — والفئة هي</Eyebrow>
      <div style={{ animation: 'flip 600ms cubic-bezier(.2,.9,.2,1) both', transformOrigin: 'top center', background: color.panel, border: `1px solid ${color.brass}`, borderRadius: 8, padding: '36px 22px', margin: '20px 0 24px', boxShadow: '0 18px 60px rgba(200,149,43,.14)' }}><h1 style={{ fontFamily: font.display, fontWeight: 700, fontSize: 'clamp(32px, 9vw, 54px)', lineHeight: 1.14, margin: 0, color: color.brassSoft }}>{state.theme?.titleAr}</h1><p style={{ margin: '14px 0 0', fontFamily: font.body, fontSize: 15, color: color.mute, lineHeight: 1.7 }}>{state.theme?.descAr}</p></div>
      <p style={{ fontFamily: font.body, fontSize: 14, color: color.mute, lineHeight: 1.8, maxWidth: 440, margin: '0 auto 24px' }}>كل واحد يعطي كل كراج ثاني درجة من ١٠ حسب هذي الفئة. ما تقدر تقيّم كراجك، والتقييمات مخفية لين ينكشف الترتيب.</p>
      {d.isHost ? <Button variant="primary" onClick={actions.startVoting} style={{ minWidth: 200 }}>ابدأ التقييم</Button> : <span style={{ fontFamily: font.body, fontSize: 14, color: color.mute }}>بانتظار المدير…</span>}
    </div>
  </div>;
}
