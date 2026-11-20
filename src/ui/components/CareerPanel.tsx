import { useState } from 'react';
import { BADGES, loadCareer, totals } from '../../lib/career';
import { money } from '../../lib/util';
import { Delta } from './Garage';
import { Rows } from './kit/Rows';
import { Portal, useSheet } from './Bits';

/** «سجلي»: this phone's record across nights as ruled rows, then the badges (earned in chalk, the rest with how to
 *  earn them), then the last nights. */
/** The day a badge was first earned, as «20 نوفمبر»; nothing when the record has no real date. */
function earnedOn(at: number | undefined): string {
  if (!at || at < 1e11) return '';
  try {
    return new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long' }).format(new Date(at));
  } catch {
    return '';
  }
}

export function CareerPanel({ onClose }: { onClose: () => void }) {
  const [c] = useState(loadCareer);
  const t = totals(c);
  const ref = useSheet<HTMLDivElement>(onClose);
  const last = [...c.nights].reverse().slice(0, 5);
  const got = BADGES.filter((b) => !!c.badges[b.key]);
  const todo = BADGES.filter((b) => !c.badges[b.key]);
  const nf = (n: number) => <span className="ltr">{money(n)}</span>;
  return (
    <Portal>
      <div className="e-cr-back" role="dialog" aria-modal="true" aria-label="سجلي" onClick={onClose}>
        <div className="e-cr" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
          <header className="e-cr-head">
            <h2 className="e-cr-title">سجلي</h2>
            <button className="btn btn-quiet e-cr-close" onClick={onClose}>
              سكّر
            </button>
          </header>
          {t.nights === 0 ? (
            <p className="e-cr-empty">ما خلّصت مزاد للحين. أول ليلة تكمّلها للنتيجة تنحسب لك هنا.</p>
          ) : (
            <Rows
              className="e-cr-rows"
              items={[
                { k: 'ليالي', v: nf(t.nights), print: true },
                { k: 'طلعت الأول', v: nf(t.wins), print: true },
                { k: 'سيارات شريتها', v: nf(t.cars), print: true },
                { k: 'صرفت', v: nf(t.paid), print: true },
                { k: t.profit >= 0 ? 'صافي ربحك' : 'صافي خسارتك', v: <Delta v={t.profit} />, print: true },
                ...(t.best
                  ? [
                      {
                        k: 'أحسن شروة',
                        v: (
                          <span className="e-cr-best">
                            <span className="e-cr-best-car">
                              {t.best.name} <span className="ltr">{t.best.year}</span>
                            </span>
                            <Delta v={t.best.profit} />
                          </span>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
          <h3 className="e-cr-sub">
            الشارات <span className="print ltr">{got.length}/{BADGES.length}</span>
          </h3>
          {got.length > 0 && (
            <ul className="e-cr-stickers" aria-label="شاراتك">
              {got.map((b, i) => (
                <li key={b.key} className={`e-sticker${i % 2 ? ' is-tilt' : ''}`}>
                  <b>{b.title}</b>
                  {earnedOn(c.badges[b.key]) && <small>{earnedOn(c.badges[b.key])}</small>}
                </li>
              ))}
            </ul>
          )}
          {todo.length > 0 && (
            <ul className="e-cr-todo" aria-label="باقي الشارات">
              {todo.map((b) => (
                <li key={b.key}>
                  <span className="e-sticker is-empty">{b.title}</span>
                  <small>{b.how}</small>
                </li>
              ))}
            </ul>
          )}
          {last.length > 0 && (
            <>
              <h3 className="e-cr-sub">آخر لياليك</h3>
              <ul className="e-cr-nights">
                {last.map((n) => (
                  <li key={n.key}>
                    <span className="e-cr-night">
                      <b>{n.room || 'مزاد'}</b>
                      <small>
                        {n.players > 1 ? (
                          <>
                            المركز <span className="ltr">{n.rank}</span> من <span className="ltr">{n.players}</span> ·{' '}
                          </>
                        ) : null}
                        {n.cars === 0 ? 'ولا سيارة' : n.cars === 1 ? 'سيارة وحدة' : n.cars === 2 ? 'سيارتين' : <><span className="ltr">{n.cars}</span> سيارات</>}
                      </small>
                    </span>
                    <Delta v={n.profit} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Portal>
  );
}
