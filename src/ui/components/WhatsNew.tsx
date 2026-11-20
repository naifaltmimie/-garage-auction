// «وش الجديد»: a bottom sheet with what changed, newest release first, each release dated in a small Print line,
// and one «تمام». A phone sees each release once (stored under mzk:news). Styles: src/styles/s-home.css.
import { useState } from 'react';
import { REACTIONS } from '../../engine/reactions';
import { store } from '../../lib/util';
import { Portal, useSheet } from './Bits';
import { ScreenTitle } from './kit/ScreenTitle';

/** Bumped with each release that has something worth announcing; a phone sees each one once. */
const RELEASE = '2026-11-21';
const SEEN_KEY = 'mzk:news';

type Item = { title: string; body: string; reactions?: boolean };

/** Newest release first. */
const RELEASES: { date: string; items: Item[] }[] = [
  {
    date: RELEASE,
    items: [
      { title: 'شاشة السوم من جديد', body: 'السوم الحالي ومين ماسكه على بطاقة السعر، والحساب كامل تحت الزر.' },
      { title: 'لوحات سعودية حقيقية', body: 'بمقاسها الصح، العادية والطويلة: خصوصي ونقل خاص وأجرة.' },
      { title: 'شاشة العرض من جديد', body: 'افتحها على التلفزيون أو اللابتوب، والكل يتابع السوم والكراجات والنتيجة.' },
      { title: 'سوالف السيارات ما تتكرر', body: 'كل سيارة لها سالفتها، وما تنعاد عليك نفس السالفة.' },
      { title: 'ست تعليقات جديدة', body: 'ارمها على السيارة وقت السوم، ويشوفها كل اللي بالصالة.', reactions: true },
    ],
  },
];

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

/** An ISO date as the player says it: «20 نوفمبر». */
function dayMonth(iso: string) {
  const [, m, d] = iso.split('-').map(Number);
  return (
    <>
      <span className="ltr">{d}</span> {MONTHS[(m || 1) - 1]}
    </>
  );
}

/** Whether this phone hasn't seen the current release notes yet (dates are ISO, so they compare as text). */
export function hasNews() {
  return store.get<string>(SEEN_KEY, '') < RELEASE;
}

export function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <NewsSheet onClose={onClose} />;
}

function NewsSheet({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    store.set(SEEN_KEY, RELEASE);
    setClosing(true);
    window.setTimeout(onClose, 200);
  };
  const ref = useSheet<HTMLElement>(close);
  return (
    <Portal>
      <div className={`hm-news-scrim${closing ? ' is-out' : ''}`} onClick={close}>
        <section
          ref={ref}
          tabIndex={-1}
          className="hm-news"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hm-news-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hm-news-body">
            <div id="hm-news-title">
              <ScreenTitle as="h2">وش الجديد</ScreenTitle>
            </div>
            {RELEASES.map((r) => (
              <section key={r.date} className="hm-news-rel">
                <p className="hm-news-date">{dayMonth(r.date)}</p>
                <ul className="hm-news-list">
                  {r.items.map((it) => (
                    <li key={it.title}>
                      <b className="hm-news-t">{it.title}</b>
                      <span className="hm-news-b">{it.body}</span>
                      {it.reactions && (
                        <span className="hm-news-rx" aria-label={REACTIONS.map((x) => x.say).join('، ')}>
                          {REACTIONS.map((x) => (
                            <span key={x.k} aria-hidden="true">
                              {x.label}
                            </span>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <footer className="hm-news-foot">
            <button className="btn btn-primary btn-block hm-news-ok" onClick={close}>
              تمام
            </button>
          </footer>
        </section>
      </div>
    </Portal>
  );
}
