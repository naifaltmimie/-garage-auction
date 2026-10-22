import { arDigits, money } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';

export function Intro({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const now = useNow(room.offset, 8);
  const { ms } = timeLeft(core, now);
  const s = core.settings;
  return (
    <main className="shell narrow">
      <div className="intro-screen">
        <div className="stack" style={{ justifyItems: 'center', gap: 14 }}>
          <div className="t-label" style={{ color: 'var(--gold)' }}>{s.roomName}</div>
          <div className="t-display">{core.callout?.text ?? 'حيّاكم في مزاد الكراج'}</div>
          <div className="countdown">{arDigits(Math.max(1, Math.ceil(ms / 1000)))}</div>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <span className="chip chip-gold">كل واحد معه {money(s.budget)}</span>
            <span className="chip">الكراج {arDigits(s.garage)} سيارات</span>
            <span className="chip">{arDigits(core.lotsTotal)} سيارة بالمزاد</span>
          </div>
          <p className="mute" style={{ maxWidth: '36ch', margin: 0 }}>
            اقرأ تقرير الفحص زين وقت المعاينة. القيمة الحقيقية تنكشف بعد ما تنزل المطرقة، ومرات تطلع مفاجأة.
          </p>
          {room.host && (
            <button className="btn btn-ghost" onClick={room.host.advance}>
              ابدأ الحين
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
