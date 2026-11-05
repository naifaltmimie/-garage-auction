import { useEffect, useState } from 'react';
import { store } from '../../lib/util';

/** Bumped with each release that has something worth announcing; a phone sees each one once. */
const RELEASE = '2026-11-05';
const SEEN_KEY = 'mzk:news';

const ITEMS: { title: string; body: string }[] = [
  { title: 'المزاد الهولندي', body: 'السعر يبدأ فوق وينزل، وأول واحد يقول «أبيها» ياخذها. تأخرت؟ راحت عليك.' },
  { title: 'شاشة العرض', body: 'افتح المزاد على التلفزيون أو اللابتوب للمجلس كله، والشباب يسومون من جوالاتهم.' },
  { title: 'ردود فعل على الهواء', body: 'لقطة، غالية، يا سلام… تطير على شاشات الكل، والجوال يهتز لما أحد يزاود عليك.' },
  { title: 'جوائز الليلة وسجلّك', body: 'صفقة الليلة وأغلى غلطة والحوت، وسجلّك من ليلة لليلة محفوظ في جوالك.' },
  { title: 'شارك كراجك', body: 'صورة مرتبة لكراجك ولقطاتك، جاهزة ترسلها للقروب.' },
  { title: 'شكل أفخم', body: 'حركات أنعم وتفاصيل أدق بكل شاشة، من المعاينة لين المطرقة.' },
];

/** Whether this phone hasn't seen the current release notes yet. */
export function hasNews() {
  return store.get<string>(SEEN_KEY, '') !== RELEASE;
}

export function WhatsNew({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!open) return;
    setClosing(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  function close() {
    store.set(SEEN_KEY, RELEASE);
    setClosing(true);
    window.setTimeout(onClose, 220);
  }
  return (
    <div className={`news-scrim ${closing ? 'out' : ''}`} onClick={close}>
      <section
        className="news-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="news-grip" aria-hidden />
        <header className="news-head">
          <span className="news-seal" aria-hidden>
            <svg viewBox="0 0 48 48" width="44" height="44">
              <circle cx="24" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
              <path d="M15 27l10-10 4 4-10 10zM27 15l4-4 6 6-4 4zM21 33h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <span className="news-kicker">إصدار جديد</span>
            <h2 id="news-title">الجديد في الصالة</h2>
          </div>
        </header>
        <ol className="news-list">
          {ITEMS.map((it, i) => (
            <li key={it.title} style={{ ['--i' as string]: i }}>
              <span className="news-num ltr">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <b>{it.title}</b>
                <small>{it.body}</small>
              </span>
            </li>
          ))}
        </ol>
        <footer className="news-foot">
          <button className="btn btn-primary btn-block" onClick={close}>
            يلا نلعب
          </button>
          <a className="news-classic" href="/classic/" onClick={() => store.set(SEEN_KEY, RELEASE)}>
            تبي النسخة القديمة؟ موجودة هنا
          </a>
        </footer>
      </section>
    </div>
  );
}
