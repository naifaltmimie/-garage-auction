import { useEffect, useState } from 'react';
import { sound } from '../../audio/sound';
import { arDigits, carsN, money, signed } from '../../lib/util';
import { go } from '../App';
import { GarageCard } from '../components/Garage';
import { Paddle } from '../components/Plate';
import type { RoomView } from '../useRoom';

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
    }, shown === 0 ? 900 : 1600);
    return () => clearTimeout(t);
  }, [shown, rows.length]);
  if (!res) return <div className="center-screen"><div className="spinner" /></div>;
  const nameOf = (id: string) => core.players.find((p) => p.id === id);
  const visible = rows.slice(rows.length - shown);
  return (
    <main className="shell" style={{ maxWidth: 900 }}>
      <div className="stack" style={{ gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="t-label" style={{ color: 'var(--gold)' }}>{core.settings.roomName}</div>
          <h1 className="t-display" style={{ fontSize: 'clamp(42px, 12vw, 70px)', margin: '4px 0' }}>نتيجة المزاد</h1>
          <p className="mute" style={{ margin: 0 }}>
            النقاط: <span className="ltr">{Math.round(core.settings.ratingWeight * 100)}%</span> من تقييم الشباب، و<span className="ltr">{Math.round((1 - core.settings.ratingWeight) * 100)}%</span> من الشطارة بالشراء
          </p>
        </div>
        <div className="podium">
          {visible.map((r) => {
            const p = nameOf(r.id);
            if (!p) return null;
            return (
              <button key={r.id} className={`card result ${r.rank === 1 ? 'first' : ''}`} style={{ textAlign: 'start' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <div className="rank">{arDigits(r.rank)}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <Paddle n={p.paddle} me={p.id === room.myId} />
                    <h3>{p.name}</h3>
                  </div>
                  <div className="meta">
                    <span>{carsN(r.cars)}</span>
                    <span>دفع {money(r.paid)}</span>
                    <span className={r.profit >= 0 ? 'gain' : 'loss'}>ربح <span className="ltr">{signed(r.profit)}</span></span>
                    <span>تقييم {r.ratingAvg == null ? '—' : arDigits(r.ratingAvg.toFixed(1))} من 10</span>
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
                  <span className="t-money">{arDigits(r.total)}</span>
                  <small>نقطة</small>
                </div>
              </button>
            );
          })}
        </div>
        {open && nameOf(open) && <GarageCard p={nameOf(open)!} sales={sales} slots={core.settings.garage} me={open === room.myId} />}
        {shown >= rows.length && res.awards.length > 0 && (
          <>
            <h2 className="t-title" style={{ margin: '8px 0 0', fontSize: 28 }}>ألقاب الليلة</h2>
            <div className="awards">
              {res.awards.map((a, i) => (
                <div key={a.key} className="card award" style={{ animationDelay: `${i * 0.12}s` }}>
                  <span className="t-display">{a.title}</span>
                  <b>{nameOf(a.who)?.name}</b>
                  <small>{a.detail}</small>
                </div>
              ))}
            </div>
          </>
        )}
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
