import type { PlayerPub, Sale } from '../../engine/types';
import { km, money, signed } from '../../lib/util';
import { photoSrc } from './Gallery';
import { CarPlate, MiniPlate, Paddle } from './Plate';
import { Silhouette } from './Silhouette';

/** One player's garage: the cars with their ad photo, what they paid, what they're worth. */
export function GarageCard({ p, sales, slots, me, hideValues }: { p: PlayerPub; sales: Sale[]; slots: number; me?: boolean; hideValues?: boolean }) {
  const mine = sales.filter((s) => s.buyer === p.id);
  const paid = mine.reduce((a, s) => a + s.paid, 0);
  const value = mine.reduce((a, s) => a + s.value, 0);
  const profit = value - paid;
  return (
    <article className="card garage">
      <header className="garage-head">
        <Paddle n={p.paddle} me={me} />
        <div className="grow">
          <h3>كراج {p.name}</h3>
          <div className="row" style={{ gap: 8 }}>
            <MiniPlate letters={p.plate} />
            <span className="mute small">
              {mine.length} من {slots} سيارات
            </span>
          </div>
        </div>
      </header>
      <div className="garage-cars">
        {mine.map((s) => {
          const ph = s.car.photos?.[0];
          return (
            <div className="gcar" key={s.lotId}>
              <div className="gcar-ph">
                {ph ? <img src={photoSrc(ph)} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Silhouette body={s.car.body} color={s.car.colorHex} />}
              </div>
              <div className="gcar-body">
                <b>
                  {s.car.modelAr} <span className="trim">{s.car.trim}</span>
                </b>
                <small>
                  {s.car.makeAr}، <span className="ltr">{s.car.year}</span>، {km(s.car.km)}
                </small>
                <div className="gcar-nums">
                  <span>
                    دفع <b className="ltr">{money(s.paid)}</b>
                  </span>
                  {!hideValues && <b className={`ltr ${s.profit >= 0 ? 'gain' : 'loss'}`}>{signed(s.profit)}</b>}
                </div>
              </div>
              {s.car.plate.special && (
                <div className="gcar-plate">
                  <CarPlate plate={s.car.plate} size="sm" />
                </div>
              )}
            </div>
          );
        })}
        {Array.from({ length: Math.max(0, slots - mine.length) }).map((_, i) => (
          <div className="gslot" key={`e${i}`}>
            موقف فاضي
          </div>
        ))}
      </div>
      <div className="totals">
        <div>
          <small>دفع</small>
          <b className="ltr">{money(paid)}</b>
        </div>
        <div>
          <small>قيمتها</small>
          <b className="ltr">{hideValues ? '—' : money(value)}</b>
        </div>
        <div>
          <small>الربح</small>
          <b className={`ltr ${hideValues ? '' : profit >= 0 ? 'gain' : 'loss'}`}>{hideValues ? '—' : signed(profit)}</b>
        </div>
      </div>
    </article>
  );
}
