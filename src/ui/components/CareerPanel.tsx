import { useEffect, useState } from 'react';
import { BADGES, loadCareer, totals } from '../../lib/career';
import { money, signed } from '../../lib/util';

/** «سجلي»: a small chip on the front page that opens this phone's career. */
export function CareerChip() {
  const [open, setOpen] = useState(false);
  const [nights, setNights] = useState(() => loadCareer().nights.length);
  return (
    <>
      <button className="cr-chip" onClick={() => setOpen(true)}>
        <span>سجلي</span>
        {nights > 0 && (
          <small>
            <span className="ltr">{nights}</span> {nights === 1 ? 'ليلة' : nights === 2 ? 'ليلتين' : 'ليالي'}
          </small>
        )}
      </button>
      {open && (
        <CareerPanel
          onClose={() => {
            setOpen(false);
            setNights(loadCareer().nights.length);
          }}
        />
      )}
    </>
  );
}

export function CareerPanel({ onClose }: { onClose: () => void }) {
  const [c] = useState(loadCareer);
  const t = totals(c);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const last = [...c.nights].reverse().slice(0, 5);
  return (
    <div className="sg-back" role="dialog" aria-modal="true" aria-label="سجلي" onClick={onClose}>
      <div className="cr-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="cr-head">
          <div>
            <span className="aw-kicker">على هالجوال</span>
            <h2>سجلي</h2>
          </div>
          <button className="btn btn-quiet" onClick={onClose} aria-label="سكّر">
            سكّر
          </button>
        </header>
        {t.nights === 0 ? (
          <p className="cr-empty">ما خلّصت مزاد للحين. أول ليلة تكمّلها للنتيجة تنحسب لك هنا.</p>
        ) : (
          <>
            <dl className="cr-grid">
              <div>
                <dt>ليالي</dt>
                <dd className="t-money">{t.nights}</dd>
              </div>
              <div>
                <dt>المركز الأول</dt>
                <dd className="t-money">{t.wins}</dd>
              </div>
              <div>
                <dt>سيارات</dt>
                <dd className="t-money">{t.cars}</dd>
              </div>
              <div>
                <dt>صرفت</dt>
                <dd className="t-money">{money(t.paid)}</dd>
              </div>
              <div className="wide">
                <dt>{t.profit >= 0 ? 'صافي ربحك' : 'صافي خسارتك'}</dt>
                <dd className={`t-money ${t.profit >= 0 ? 'gain' : 'loss'}`}>{signed(t.profit)}</dd>
              </div>
            </dl>
            {t.best && (
              <div className="cr-best">
                <span className="aw-kicker">أحسن صفقة لك</span>
                <b>
                  {t.best.name} <span className="ltr">{t.best.year}</span>
                </b>
                <small>
                  دفعت <span className="ltr">{money(t.best.paid)}</span> وقيمتها <span className="ltr">{money(t.best.value)}</span>،
                  ربحت <span className="ltr gain">{signed(t.best.profit)}</span>
                </small>
              </div>
            )}
          </>
        )}
        <h3 className="cr-sub">الشارات</h3>
        <ul className="cr-badges">
          {BADGES.map((b) => {
            const got = !!c.badges[b.key];
            return (
              <li key={b.key} className={got ? 'got' : ''}>
                <b>{b.title}</b>
                <small>{got ? 'حصّلتها' : b.how}</small>
              </li>
            );
          })}
        </ul>
        {last.length > 0 && (
          <>
            <h3 className="cr-sub">آخر لياليك</h3>
            <ul className="cr-nights">
              {last.map((n) => (
                <li key={n.key}>
                  <span className="grow">
                    <b>{n.room}</b>
                    <small>
                      {n.players > 1 ? <>المركز <span className="ltr">{n.rank}</span> من <span className="ltr">{n.players}</span>، </> : null}
                      <span className="ltr">{n.cars}</span> سيارات
                    </small>
                  </span>
                  <span className={`t-money ${n.profit >= 0 ? 'gain' : 'loss'}`}>{signed(n.profit)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
