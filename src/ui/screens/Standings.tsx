import { carsN, money, signed } from '../../lib/util';
import { GarageCard } from '../components/Garage';
import { Paddle } from '../components/Plate';
import type { RoomView } from '../useRoom';
import { useState } from 'react';

export function Standings({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const rows = core.players
    .filter((p) => !p.spectator)
    .map((p) => {
      const mine = sales.filter((s) => s.buyer === p.id);
      const profit = mine.reduce((a, s) => a + s.profit, 0);
      return { p, cars: mine.length, profit };
    })
    .sort((a, b) => b.profit - a.profit);
  const sel = rows.find((r) => r.p.id === open);
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="الكراجات">
        <h3>الكراجات الحين</h3>
        {sel ? (
          <div className="stack">
            <GarageCard p={sel.p} sales={sales} slots={core.settings.garage} me={sel.p.id === room.myId} />
            <button className="btn btn-quiet" onClick={() => setOpen(null)}>رجوع للترتيب</button>
          </div>
        ) : (
          <div>
            {rows.map(({ p, cars, profit }) => (
              <button key={p.id} className="standing" style={{ width: '100%', textAlign: 'start' }} onClick={() => setOpen(p.id)}>
                <Paddle n={p.paddle} me={p.id === room.myId} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>
                    {p.name} {p.id === room.myId && <span className="mute" style={{ fontSize: 13 }}>(أنت)</span>}
                    {!p.online && <span className="mute" style={{ fontSize: 12 }}>، مقطوع</span>}
                  </div>
                  <div className="mute" style={{ fontSize: 13, fontWeight: 700 }}>
                    {carsN(cars)}، رصيد {money(p.cash)}
                  </div>
                </div>
                <span className={`t-money ltr ${profit >= 0 ? 'gain' : 'loss'}`}>{signed(profit)}</span>
              </button>
            ))}
            {core.players.filter((p) => p.spectator).length > 0 && (
              <div className="stack" style={{ gap: 6, marginTop: 12 }}>
                <div className="t-label">يتفرجون</div>
                {core.players
                  .filter((p) => p.spectator)
                  .map((p) => (
                    <div key={p.id} className="row between" style={{ padding: '6px 2px' }}>
                      <span style={{ fontWeight: 700 }}>
                        {p.name} {p.id === room.myId && <span className="mute" style={{ fontSize: 13 }}>(أنت)</span>}
                      </span>
                      {room.host && !['showcase', 'voting', 'results'].includes(core.phase) && (
                        <button className="btn btn-ghost" onClick={() => room.host!.admit(p.id)}>
                          دخّله المزاد
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
            <p className="mute" style={{ fontSize: 13, marginTop: 10 }}>الربح هنا من القيم اللي انكشفت بعد كل بيعة. التقييم السري يجي بالأخير.</p>
          </div>
        )}
        <button className="btn btn-quiet btn-block" onClick={onClose}>سكّر</button>
        {room.host && !['lobby', 'showcase', 'voting', 'results'].includes(core.phase) && (
          <button className="btn btn-ghost btn-block" style={{ marginTop: 6 }} onClick={() => { room.host!.endNow(); onClose(); }}>
            أنهِ المزاد الحين
          </button>
        )}
      </div>
    </>
  );
}
