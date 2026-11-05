import { useState } from 'react';
import { useSheet } from './Bits';
import { LogoMark } from './Logo';
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
  { title: 'هوية جديدة', body: 'شعار «بطاقة السعر» وألوان الليل: فحمي وأحمر وذهبي، وصفحة السيارة بمعرض صور تكبّره بلمسة.' },
  { title: 'أسرع وأسلس', body: 'اللعبة تفتح عند اللاعب بثلث الحجم، السوم يحس فوري، وزر الرجوع ما يطلّعك من الصالة بالغلط.' },
];

/** Whether this phone hasn't seen the current release notes yet. */
export function hasNews() {
  return store.get<string>(SEEN_KEY, '') !== RELEASE;
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
    window.setTimeout(onClose, 220);
  };
  const ref = useSheet<HTMLElement>(close);
  return (
    <div className={`news-scrim ${closing ? 'out' : ''}`} onClick={close}>
      <section
        ref={ref}
        tabIndex={-1}
        className="news-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="news-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="news-grip" aria-hidden />
        <header className="news-head">
          <span className="news-seal news-tag" aria-hidden>
            <LogoMark size={40} />
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
