import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { arDigits, carsN, money, signed } from '../../lib/util';
import { go } from '../App';
import { NightAwards } from '../components/Awards';
import { GarageCard } from '../components/Garage';
import { TireLoader } from '../components/TireLoader';
import type { RoomView } from '../useRoom';

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(to * e));
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, ms]);
  return <>{arDigits(v)}</>;
}

export function Results({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const res = room.snap.hist?.results;
  const sales = room.snap.hist?.sales ?? [];
  const rows = res?.rows ?? [];
  // reveal from last place up to the champion
  const [shown, setShown] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (shown >= rows.length) return;
    const t = setTimeout(() => {
      setShown((s) => s + 1);
      if (shown + 1 === rows.length) sound.gavel(2);
      else sound.tock();
    }, shown === 0 ? 900 : 1500);
    return () => clearTimeout(t);
  }, [shown, rows.length]);
  if (!res)
    return (
      <div className="center-screen">
        <TireLoader label="نجمع النقاط…" />
      </div>
    );
  const nameOf = (id: string) => core.players.find((p) => p.id === id);
  const visible = rows.slice(rows.length - shown);
  const revealing = shown < rows.length;
  const champRow = visible.find((r) => r.rank === 1);
  const champ = champRow ? nameOf(champRow.id) : undefined;
  return (
    <main className="shell results-page" style={{ maxWidth: 900 }}>
      <div className="stack" style={{ gap: 16 }}>
        <header className="rs-head">
          <h1 className="t-display">نتيجة المزاد</h1>
          <p className="mute">
            {core.settings.roomName}، النقاط: <span className="ltr">{Math.round(core.settings.ratingWeight * 100)}%</span> من تقييم الشباب و<span className="ltr">{Math.round((1 - core.settings.ratingWeight) * 100)}%</span> من الشطارة بالشراء
          </p>
        </header>
        {revealing && (
          <div className="rs-next" role="status">
            <span>{shown === 0 ? 'نعلن الترتيب من الأخير…' : rows.length - shown === 1 ? 'باقي البطل…' : 'اللي بعده…'}</span>
            <button className="btn btn-quiet rs-skip" onClick={() => setShown(rows.length)}>
              اعرض الكل
            </button>
          </div>
        )}
        {champRow && champ && (
          <button className="rs-champion" onClick={() => setOpen(open === champRow.id ? null : champRow.id)}>
            <i className="rs-flag" aria-hidden />
            <span className="rs-champ-k">بطل الليلة{champ.id === room.myId && <em className="rs-you">أنت</em>}</span>
            <b className="rs-champ-name">{champ.name}</b>
            <span className="rs-champ-score">
              <span className="t-money ltr">
                <CountUp to={champRow.total} ms={1400} />
              </span>
              <small>نقطة</small>
            </span>
          </button>
        )}
        <ol className="rs-list">
          {visible
            .filter((r) => r.rank !== 1)
            .map((r) => {
              const p = nameOf(r.id);
              if (!p) return null;
              return (
                <li key={r.id}>
                  <button className="rs-row" onClick={() => setOpen(open === r.id ? null : r.id)}>
                    <span className="rs-plate ltr">{r.rank}</span>
                    <span className="rs-body">
                      <b className="rs-name">
                        {p.name}
                        {p.id === room.myId && <em className="rs-you">أنت</em>}
                      </b>
                      <span className="rs-meta">
                        {carsN(r.cars)}، دفع <span className="ltr">{money(r.paid)}</span>،{' '}
                        <span className={r.profit >= 0 ? 'gain' : 'loss'}>
                          <span className="ltr">{r.profit >= 0 ? signed(r.profit) : `-${money(-r.profit)}`}</span>
                        </span>
                        {r.ratingAvg != null && <>، تقييم <span className="ltr">{r.ratingAvg.toFixed(1)}</span></>}
                      </span>
                      {r.awards.length > 0 && (
                        <span className="rs-tags">
                          {r.awards.slice(0, 2).map((a) => (
                            <span key={a} className="rs-tag">{a}</span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="rs-score">
                      <span className="t-money ltr">
                        <CountUp to={r.total} ms={800} />
                      </span>
                      <small>نقطة</small>
                    </span>
                  </button>
                </li>
              );
            })}
        </ol>
        {open && nameOf(open) && <GarageCard p={nameOf(open)!} sales={sales} slots={core.settings.garage} me={open === room.myId} />}
        {/* the night's awards as a ceremony (derived on this phone, includes the host's titles), «سجلي» save and «شارك كراجك» */}
        <NightAwards room={room} ready={shown >= rows.length} />
        <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
          {room.host && (
            <button className="btn btn-primary" onClick={room.host.rematch}>
              مزاد ثاني بنفس الشباب
            </button>
          )}
          <button className="btn btn-quiet" onClick={() => go('/')}>
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    </main>
  );
}
