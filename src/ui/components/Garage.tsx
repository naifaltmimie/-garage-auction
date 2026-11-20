import { useState } from 'react';
import type { PlayerPub, Sale } from '../../engine/types';
import { money } from '../../lib/util';
import { Photo } from './Gallery';
import { CarPlate, Paddle } from './Plate';
import { Silhouette } from './Silhouette';

/** A gain or a loss in Print: a gain is a small green figure, a loss stays chalk with a small red mark before it. */
export function Delta({ v, className }: { v: number; className?: string }) {
  const tone = v > 0 ? 'is-up' : v < 0 ? 'is-down' : 'is-even';
  return (
    <span className={`e-delta ${tone}${className ? ` ${className}` : ''}`}>
      {v < 0 && <i className="e-delta-mark" aria-hidden="true" />}
      <span className="ltr" aria-label={v > 0 ? `ربح ${money(v)}` : v < 0 ? `خسارة ${money(-v)}` : 'لا ربح ولا خسارة'}>
        {v > 0 ? `+${money(v)}` : v < 0 ? `−${money(-v)}` : '0'}
      </span>
    </span>
  );
}

/** The car's ad photo, or its drawn shape when the photo will not load. */
function CarThumb({ s }: { s: Sale }) {
  const ph = s.car.photos?.[0];
  const [dead, setDead] = useState(!ph);
  return (
    <span className="e-car-ph" aria-hidden="true">
      {dead || !ph ? <Silhouette body={s.car.body} color={s.car.colorHex} /> : <Photo u={ph} className="e-car-img" onDead={() => setDead(true)} />}
    </span>
  );
}

const emptyLine = (n: number) => (n === 1 ? 'موقف فاضي' : n === 2 ? 'موقفين فاضية' : `${n} مواقف فاضية`);

/** One player's garage as a group: his paddle and name as the heading, his cars as ruled rows, then the totals.
 *  `compact` drops the km and the special plate (the voting screen). `secretLot` is the car whose value the
 *  reveal has not announced yet: its value stays covered, and the garage's totals with it. */
export function GarageCard({
  p,
  sales,
  slots,
  me,
  secretLot,
  compact,
  heading = true,
}: {
  p: PlayerPub;
  sales: Sale[];
  slots: number;
  me?: boolean;
  secretLot?: string | null;
  compact?: boolean;
  heading?: boolean;
}) {
  const mine = sales.filter((s) => s.buyer === p.id);
  const paid = mine.reduce((a, s) => a + s.paid, 0);
  const value = mine.reduce((a, s) => a + s.value, 0);
  const profit = value - paid;
  const free = Math.max(0, slots - mine.length);
  const covered = (s: Sale) => !!secretLot && s.lotId === secretLot;
  const totalsCovered = mine.some(covered);
  return (
    <section className={`e-garage${compact ? ' is-compact' : ''}${me ? ' is-mine' : ''}`} aria-label={`كراج ${p.name}`}>
      {heading && (
        <header className="e-garage-head">
          <Paddle n={p.paddle} me={me} />
          <h3 className="e-garage-name">{p.name}</h3>
          {me && <span className="e-you">أنت</span>}
          <span className="e-garage-count print ltr" aria-label={`${mine.length} من ${slots} سيارات`}>
            {mine.length}/{slots}
          </span>
        </header>
      )}
      {mine.length > 0 && (
        <ul className="e-cars">
          {mine.map((s) => (
            <li className="e-car" key={s.lotId}>
              <CarThumb s={s} />
              <div className="e-car-body">
                <b className="e-car-model">
                  {/* the model and its trim as one name in its own direction («812 Superfast», «G63 AMG») */}
                  <bdi>
                    {s.car.modelAr} <span className="e-car-trim">{s.car.trim}</span>
                  </bdi>
                </b>
                <span className="e-car-sub">
                  <bdi>{s.car.makeAr}</bdi> · <span className="ltr">{s.car.year}</span>
                  {!compact && (
                    <>
                      {' '}
                      · <span className="ltr">{money(Math.round(s.car.km / 100) * 100)}</span> كم
                    </>
                  )}
                </span>
                <span className="e-car-nums">
                  <span className="e-num">
                    <small>دفع</small>
                    <b className="print ltr">{money(s.paid)}</b>
                  </span>
                  {!covered(s) && (
                    <span className="e-num">
                      <small>قيمتها</small>
                      <b className="print ltr">{money(s.value)}</b>
                    </span>
                  )}
                </span>
                {!compact && s.car.plate.special && (
                  <span className="e-car-plate">
                    <CarPlate plate={s.car.plate} size="sm" />
                  </span>
                )}
              </div>
              {!covered(s) && <Delta v={s.profit} className="e-car-delta" />}
            </li>
          ))}
        </ul>
      )}
      {free > 0 && <p className="e-garage-free">{mine.length === 0 ? 'ما شرى ولا سيارة' : emptyLine(free)}</p>}
      {mine.length > 0 && (
        <dl className="e-totals">
          <div>
            <dt>دفع</dt>
            <dd>
              <span className="print ltr">{money(paid)}</span>
            </dd>
          </div>
          {!totalsCovered && (
            <>
              <div>
                <dt>قيمتها</dt>
                <dd>
                  <span className="print ltr">{money(value)}</span>
                </dd>
              </div>
              <div>
                <dt>{profit >= 0 ? 'الربح' : 'الخسارة'}</dt>
                <dd>
                  <Delta v={profit} />
                </dd>
              </div>
            </>
          )}
        </dl>
      )}
    </section>
  );
}
