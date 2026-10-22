import { useMemo, useState } from 'react';
import { arDigits } from '../../lib/util';
import { GarageCard } from '../components/Garage';
import type { RoomView } from '../useRoom';

export function Voting({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const active = core.players.filter((p) => !p.spectator);
  const targets = useMemo(() => active.filter((p) => p.id !== room.myId), [active, room.myId]);
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const amVoter = active.some((p) => p.id === room.myId);
  const done = room.myVote;
  const waiting = active.filter((p) => !core.voted.includes(p.id));

  if (!amVoter || done) {
    return (
      <main className="shell narrow">
        <div className="center-screen">
          <div className="stack" style={{ justifyItems: 'center', gap: 14 }}>
            <div className="t-display" style={{ fontSize: 44 }}>{done ? 'تقييمك وصل ✓' : 'التقييم السري'}</div>
            <p className="mute" style={{ margin: 0 }}>
              {waiting.length ? `باقي ${arDigits(waiting.length)} يقيّمون: ${waiting.map((p) => p.name).join('، ')}` : 'الكل قيّم، النتيجة جاية'}
            </p>
            <div className="progress-dots">
              {active.map((p) => (
                <i key={p.id} className={core.voted.includes(p.id) ? 'on' : ''} />
              ))}
            </div>
            {room.host && (
              <button className="btn btn-ghost" onClick={room.host.finish}>
                اعرض النتيجة الحين
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const t = targets[i];
  const val = t ? scores[t.id] : undefined;
  const last = i === targets.length - 1;
  return (
    <main className="shell narrow">
      <div className="stack" style={{ gap: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="t-label" style={{ color: 'var(--gold)' }}>التقييم السري، محد يشوف تقييمك</div>
          <h1 className="t-display" style={{ fontSize: 40, margin: '2px 0' }}>كم تعطي هالكراج؟</h1>
          <div className="progress-dots">
            {targets.map((p, k) => (
              <i key={p.id} className={k <= i ? 'on' : ''} />
            ))}
          </div>
        </div>
        {t && <GarageCard key={t.id} p={t} sales={sales} slots={core.settings.garage} />}
        <div className="rate" role="radiogroup" aria-label="التقييم من 1 إلى 10">
          {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
            <button key={n} role="radio" aria-checked={val === n} aria-pressed={val === n} onClick={() => t && setScores((s) => ({ ...s, [t.id]: n }))}>
              {arDigits(n)}
            </button>
          ))}
        </div>
        <small className="mute" style={{ textAlign: 'center' }}>قيّم على كيفك: السيارات نفسها، وكم دفع فيها، وشطارته بالمزاد</small>
        <div className="row">
          {i > 0 && (
            <button className="btn btn-ghost" onClick={() => setI(i - 1)}>
              اللي قبل
            </button>
          )}
          <button
            className="btn btn-primary grow"
            disabled={!val}
            onClick={() => {
              if (!last) setI(i + 1);
              else room.act({ t: 'vote', scores });
            }}
          >
            {last ? 'أرسل التقييم' : 'التالي'}
          </button>
        </div>
      </div>
    </main>
  );
}
