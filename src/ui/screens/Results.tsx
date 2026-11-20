import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import type { ResultRow } from '../../engine/types';
import { go } from '../App';
import { AwardStage, AwardsList, useNightAwards } from '../components/Awards';
import { Icon } from '../components/Bits';
import { GarageCard } from '../components/Garage';
import { ActionBar } from '../components/kit/ActionBar';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { Paddle } from '../components/Plate';
import { useShareGarage } from '../components/ShareGarage';
import { TireLoader } from '../components/TireLoader';
import type { RoomView } from '../useRoom';

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A button that appears where another stood ignores taps for a beat, so a thumb meant for the old one cannot land on it. */
const SETTLE_MS = 600;

/** The score climbing to its total once, when the row lands; keyed on the total only, so snapshots never restart it. */
function CountUp({ to, ms = 900 }: { to: number; ms?: number }) {
  const [v, setV] = useState(() => (still() ? to : 0));
  const raf = useRef(0);
  useEffect(() => {
    if (still()) {
      setV(to);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, ms]);
  return <>{v}</>;
}

/** How the total was made (S2-13): the rating's share and the buying's share, summing to the total.
 *  Each half keeps to one line; a narrow row breaks at the dot between them. */
function HowLine({ r, w }: { r: ResultRow; w: number }) {
  if (r.ratingScore == null)
    return (
      <small className="e-rank-how">
        <span>{r.cars === 0 ? 'ما شرى شي، ما له تقييم' : 'ما وصله تقييم'}</span> ·{' '}
        <span>
          من الشطارة <span className="ltr">{r.total}</span>
        </span>
      </small>
    );
  const a = Math.round(w * r.ratingScore);
  // the two parts of the total, said as parts: «من التقييم 28 (5.5 من 10) · من الشطارة 7»
  return (
    <small className="e-rank-how">
      <span>
        من التقييم <span className="ltr">{a}</span> (<span className="ltr">{r.ratingAvg}</span> من 10)
      </span>{' '}
      ·{' '}
      <span>
        من الشطارة <span className="ltr">{r.total - a}</span>
      </span>
    </small>
  );
}

function useSettled(key: unknown) {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    setOk(false);
    const t = window.setTimeout(() => setOk(true), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [key]);
  return ok;
}

/** نتيجة المزاد: the ranks revealed from the last up to the winner, then the awards, then share and play again. */
export function Results({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const res = room.snap.hist?.results;
  const sales = room.snap.hist?.sales ?? [];
  const rows = res?.rows ?? [];
  const w = core.settings.ratingWeight;
  // the ranks land from the last place up to the champion
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (shown >= rows.length) return;
    const t = setTimeout(
      () => {
        setShown((s) => s + 1);
        if (shown + 1 === rows.length) sound.gavel(2);
        else sound.tock();
      },
      shown === 0 ? 900 : 1500,
    );
    return () => clearTimeout(t);
  }, [shown, rows.length]);
  const ready = rows.length > 0 && shown >= rows.length;
  const aw = useNightAwards(room, ready);
  const share = useShareGarage(room, aw.badges);
  const phase = !ready ? 'ranks' : aw.running ? 'show' : 'done';
  const settled = useSettled(phase);

  // the newest rank in view while they land
  const listRef = useRef<HTMLOListElement>(null);
  const champRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!shown) return;
    const el = shown >= rows.length ? champRef.current : listRef.current?.querySelector<HTMLElement>(`[data-rank="${rows.length - shown + 1}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' });
  }, [shown, rows.length]);

  if (!res)
    return (
      <main className="shell e-page e-results">
        <TireLoader label="نجمع النقاط…" />
      </main>
    );
  const nameOf = (id: string) => core.players.find((p) => p.id === id);
  const champRow = rows[0];
  const champ = champRow ? nameOf(champRow.id) : undefined;
  const champIn = ready && !!champ;
  const tie = rows[1] && rows[1].total === champRow?.total ? nameOf(rows[1].id) : undefined;
  const spectator = room.spectator || !rows.some((r) => r.id === room.myId);

  return (
    <main className="shell e-page e-results">
      <ScreenTitle caption={w === 0.5 ? 'النقاط نص من تقييم الشباب ونص من الشطارة بالشراء' : `النقاط ${Math.round(w * 100)}% من تقييم الشباب و${Math.round((1 - w) * 100)}% من الشطارة بالشراء`}>
        نتيجة المزاد
      </ScreenTitle>

      <section ref={champRef} className={`e-champ${champIn ? ' is-in' : ''}`} aria-live="polite" aria-label="بطل الليلة">
        {champIn && champ ? (
          <>
            <div className="e-champ-who">
              <p className={`e-champ-name${champ.name.length > 16 ? ' is-long' : champ.name.length > 10 ? ' is-mid' : ''}`}>{champ.name}</p>
              <p className="e-champ-k">
                بطل الليلة
                {champ.id === room.myId && <span className="e-you is-dark">أنت</span>}
              </p>
              {tie && <p className="e-champ-tie">تعادل مع {tie.name} بالنقاط، والربح حسمها</p>}
            </div>
            <p className="e-champ-score">
              <b className="print ltr">
                <CountUp to={champRow.total} ms={1400} />
              </b>
              <small>نقطة</small>
            </p>
          </>
        ) : (
          <p className="e-champ-wait">نعلن الترتيب من الأخير، والبطل آخر واحد</p>
        )}
      </section>

      <ol className="e-ranks" ref={listRef} aria-label="الترتيب">
        {rows.map((r) => {
          const p = nameOf(r.id);
          if (!p) return null;
          const inn = r.rank > rows.length - shown;
          const isOpen = open === r.id;
          return (
            <li key={r.id} data-rank={r.rank} className={`e-rank${inn ? ' is-in' : ''}${r.id === room.myId ? ' is-mine' : ''}`}>
              {inn ? (
                <button type="button" className="e-rank-row" aria-expanded={isOpen} aria-label={`${p.name}، ${r.total} نقطة، ${isOpen ? 'سكّر كراجه' : 'افتح كراجه'}`} onClick={() => setOpen(isOpen ? null : r.id)}>
                  <span className="e-rank-n print ltr">{r.rank}</span>
                  <Paddle n={p.paddle} me={p.id === room.myId} />
                  <span className="e-rank-t">
                    <span className="e-rank-name">
                      {p.name}
                      {p.id === room.myId && <span className="e-you">أنت</span>}
                    </span>
                    <HowLine r={r} w={w} />
                  </span>
                  <span className="e-rank-total">
                    <b className="print ltr">
                      <CountUp to={r.total} ms={800} />
                    </b>
                    <small>نقطة</small>
                  </span>
                  <Icon name={isOpen ? 'minus' : 'plus'} size={16} className="e-rank-ic" />
                </button>
              ) : (
                <div className="e-rank-row is-hidden" aria-hidden="true">
                  <span className="e-rank-n print ltr">{r.rank}</span>
                  <span className="e-rank-hide" />
                </div>
              )}
              {inn && isOpen && (
                <div className="e-rank-garage">
                  <GarageCard p={p} sales={sales} slots={core.settings.garage} me={p.id === room.myId} heading={false} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <AwardsList aw={aw} myId={room.myId} spectator={spectator} />
      <AwardStage aw={aw} myId={room.myId} />
      {share.dialog}

      <ActionBar label="بعد النتيجة" className="e-res-bar">
        {phase === 'ranks' && (
          <button type="button" className="btn btn-ghost btn-block" onClick={() => setShown(rows.length)}>
            اعرض الكل
          </button>
        )}
        {phase === 'show' && (
          <button type="button" className="btn btn-ghost btn-block" onClick={aw.skip}>
            تخطي الجوايز
          </button>
        )}
        {phase === 'done' && (
          <>
            {room.host ? (
              <button type="button" className="btn btn-primary btn-block e-go" onClick={() => settled && room.host!.rematch()}>
                مزاد ثاني بنفس الشباب
              </button>
            ) : !spectator ? (
              <button type="button" className="btn btn-primary btn-block e-go" disabled={share.busy || !share.can} onClick={() => settled && share.make()}>
                {share.busy ? 'نجهز الصورة…' : 'شارك كراجك'}
              </button>
            ) : null}
            <div className="e-res-more">
              {room.host && !spectator && (
                <button type="button" className="btn btn-ghost" disabled={share.busy || !share.can} onClick={share.make}>
                  {share.busy ? 'نجهز الصورة…' : 'شارك كراجك'}
                </button>
              )}
              <button type="button" className={spectator && !room.host ? 'btn btn-ghost btn-block' : 'btn btn-quiet'} onClick={() => go('/')}>
                الصفحة الرئيسية
              </button>
            </div>
          </>
        )}
      </ActionBar>
    </main>
  );
}
