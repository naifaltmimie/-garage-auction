import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { arDigits, carsN, money, signed } from '../../lib/util';
import { go } from '../App';
import { NightAwards } from '../components/Awards';
import { GarageCard } from '../components/Garage';
import { Paddle } from '../components/Plate';
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
  return (
    <main className="shell results-page" style={{ maxWidth: 900 }}>
      <div className="stack" style={{ gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="t-label" style={{ color: 'var(--gold)' }}>{core.settings.roomName}</div>
          <h1 className="t-display" style={{ fontSize: 'clamp(42px, 12vw, 70px)', margin: '4px 0' }}>نتيجة المزاد</h1>
          <p className="mute" style={{ margin: 0 }}>
            النقاط: <span className="ltr">{Math.round(core.settings.ratingWeight * 100)}%</span> من تقييم الشباب، و<span className="ltr">{Math.round((1 - core.settings.ratingWeight) * 100)}%</span> من الشطارة بالشراء
          </p>
        </div>
        <div className="podium">
          {revealing && (
            <div className="rs-next" role="status">
              <i className="spinner rs-tire" aria-hidden />
              <span>{shown === 0 ? 'نعلن الترتيب من الأخير…' : rows.length - shown === 1 ? 'باقي البطل…' : 'اللي بعده…'}</span>
              <button className="btn btn-quiet rs-skip" onClick={() => setShown(rows.length)}>
                اعرض الكل
              </button>
            </div>
          )}
          {visible.map((r) => {
            const p = nameOf(r.id);
            if (!p) return null;
            const champ = r.rank === 1;
            return (
              <button key={r.id} className={`card result ${champ ? 'first' : ''}`} style={{ textAlign: 'start' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                {champ && <i className="rs-flag" aria-hidden />}
                <div className="rank">{arDigits(r.rank)}</div>
                <div style={{ minWidth: 0 }}>
                  {champ && <span className="rs-champ">بطل الليلة</span>}
                  <div className="row" style={{ gap: 8 }}>
                    <Paddle n={p.paddle} me={p.id === room.myId} />
                    <h3>{p.name}</h3>
                  </div>
                  <div className="meta">
                    <span>{carsN(r.cars)}</span>
                    <span>دفع <span className="ltr">{money(r.paid)}</span></span>
                    <span className={r.profit >= 0 ? 'gain' : 'loss'}>
                      {r.profit >= 0 ? 'ربح' : 'خسر'} <span className="ltr">{r.profit >= 0 ? signed(r.profit) : money(-r.profit)}</span>
                    </span>
                    <span>{r.ratingAvg == null ? 'بدون تقييم' : <>تقييم <span className="ltr">{arDigits(r.ratingAvg.toFixed(1))}</span> من 10</>}</span>
                  </div>
                  {r.awards.length > 0 && (
                    <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                      {r.awards.map((a) => (
                        <span key={a} className="chip chip-gold">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="score">
                  <span className="t-money ltr">
                    <CountUp to={r.total} ms={champ ? 1400 : 800} />
                  </span>
                  <small>نقطة</small>
                </div>
              </button>
            );
          })}
        </div>
        {open && nameOf(open) && <GarageCard p={nameOf(open)!} sales={sales} slots={core.settings.garage} me={open === room.myId} />}
        {/* the night's awards as a ceremony (derived on this phone, includes the host's titles), «سجلي» save and «شارك كراجك» */}
        <NightAwards room={room} ready={shown >= rows.length} />
        <div className="row wrap" style={{ justifyContent: 'center', marginTop: 6 }}>
          {room.host && (
            <button className="btn btn-primary" onClick={room.host.rematch}>
              مزاد ثاني بنفس الشباب
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => go('/')}>
            الصفحة الرئيسية
          </button>
        </div>
      </div>
    </main>
  );
}
