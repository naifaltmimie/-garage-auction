import { useEffect, useMemo, useRef, useState } from 'react';
import { vibrate } from '../../lib/util';
import { GarageCard } from '../components/Garage';
import { ActionBar } from '../components/kit/ActionBar';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { Paddle } from '../components/Plate';
import { TireLoader } from '../components/TireLoader';
import type { RoomView } from '../useRoom';

/** A tapped number moves on to the next garage after this long, so the choice is seen first. */
const ADVANCE_MS = 400;
const KEYS = Array.from({ length: 10 }, (_, k) => k + 1);

/** كم تعطي هالكراج: one garage at a time, ten keys in a sticky block, a tap moves on. Nobody rates his own garage,
 *  and a garage with no cars is skipped with its reason. */
export function Voting({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const active = core.players.filter((p) => !p.spectator);
  const owned = (id: string) => sales.some((s) => s.buyer === id);
  const others = active.filter((p) => p.id !== room.myId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const targets = useMemo(() => others.filter((p) => owned(p.id)), [others.map((p) => p.id).join(), sales.length]);
  const skipped = others.filter((p) => !owned(p.id));
  const [i, setI] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>({});
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const amVoter = active.some((p) => p.id === room.myId);
  const done = room.myVote;
  const waiting = active.filter((p) => !core.voted.includes(p.id));

  if (!amVoter || done) {
    const all = waiting.length === 0;
    return (
      <main className="shell e-page e-voting is-wait">
        {done ? (
          <ScreenTitle caption="محد بيدري وش عطيت">تقييمك وصل</ScreenTitle>
        ) : (
          <ScreenTitle caption="الربح هنا من القيم اللي انكشفت بعد كل بيعة. التقييم السري يخلص بعد شوي.">الشباب يقيّمون الكراجات</ScreenTitle>
        )}
        <TireLoader size={72} className="e-vote-loader" label={all ? 'الكل قيّم، النتيجة جاية' : undefined} />
        {!all && (
          <section className="e-left" aria-label="باقي يقيّمون">
            <h2 className="e-left-h">
              باقي يقيّمون <span className="print ltr">{waiting.length}</span>
            </h2>
            <ul>
              {waiting.map((p) => (
                <li key={p.id}>
                  <Paddle n={p.paddle} me={p.id === room.myId} />
                  <span className="e-left-name">{p.name}</span>
                  {!p.online && <small>طالع من الصالة</small>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {room.host && !all && (
          <ActionBar label="النتيجة" line="إذا طوّلوا، تقدر تعلن النتيجة بتقييم اللي قيّموا">
            <button className="btn btn-ghost btn-block" onClick={room.host.finish}>
              اعرض النتيجة الحين
            </button>
          </ActionBar>
        )}
      </main>
    );
  }

  const t = targets[i] as (typeof targets)[number] | undefined;
  const val = t ? scores[t.id] : undefined;
  const last = i >= targets.length - 1;
  const send = () => room.act({ t: 'vote', scores });
  const pick = (n: number) => {
    if (!t) return;
    vibrate(8);
    setScores((s) => ({ ...s, [t.id]: n }));
    window.clearTimeout(timer.current);
    if (!last) timer.current = window.setTimeout(() => setI((k) => Math.min(k + 1, targets.length - 1)), ADVANCE_MS);
  };
  const back = () => {
    window.clearTimeout(timer.current);
    setI((k) => Math.max(0, k - 1));
  };
  const next = () => {
    window.clearTimeout(timer.current);
    if (last) send();
    else setI(i + 1);
  };

  return (
    <main className="shell e-page e-voting">
      <ScreenTitle caption="تقييم سري، محد يشوف تقييمك">كم تعطي هالكراج؟</ScreenTitle>
      {skipped.length > 0 && (
        <ul className="e-skips">
          {skipped.map((p) => (
            <li key={p.id}>{p.name} ما شرى شي، ما يحتاج تقييم</li>
          ))}
        </ul>
      )}
      {t ? (
        <div className="e-vote-garage" key={t.id}>
          <p className="e-vote-step" aria-live="polite">
            كراج <span className="print ltr">{i + 1}</span> من <span className="print ltr">{targets.length}</span>
          </p>
          <GarageCard p={t} sales={sales} slots={core.settings.garage} compact />
        </div>
      ) : (
        <p className="e-vote-none">محد غيرك شرى شي الليلة، أرسل وتطلع النتيجة.</p>
      )}
      <ActionBar label="تقييمك" className="e-vote-bar">
        {t && (
          <>
            <div className="e-keys rate" role="radiogroup" aria-label={`تقييم كراج ${t.name} من 1 إلى 10`}>
              {KEYS.map((n) => (
                <button key={n} type="button" className={`e-key${val === n ? ' is-on' : ''}`} role="radio" aria-checked={val === n} onClick={() => pick(n)}>
                  {n}
                </button>
              ))}
            </div>
            <p className="e-anchors" aria-hidden="true">
              <span>
                <b className="print">1</b> ما عجبني
              </span>
              <span>
                <b className="print">10</b> كراج الليلة
              </span>
            </p>
          </>
        )}
        <div className="e-vote-go">
          {i > 0 && (
            <button type="button" className="btn btn-quiet e-back" onClick={back}>
              اللي قبل
            </button>
          )}
          <button type="button" className="btn btn-primary e-go" disabled={!!t && !val} onClick={next}>
            {last ? 'أرسل التقييم' : 'التالي'}
          </button>
        </div>
      </ActionBar>
    </main>
  );
}
