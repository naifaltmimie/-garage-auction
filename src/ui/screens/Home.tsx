import { useState } from 'react';
import { sound } from '../../audio/sound';
import { loadMarket } from '../../data/market';
import { hijriToday, isCode, normalizeCode, store } from '../../lib/util';
import { go } from '../App';
import { CareerChip } from '../components/CareerPanel';
import { WhatsNew, hasNews } from '../components/WhatsNew';
import { LOGO } from '../components/Logo';

export function Home() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const last = store.get<{ code: string; at: number; host: boolean } | null>('mzk:last', null);
  const recent = last && Date.now() - last.at < 1000 * 60 * 60 * 10 ? last : null;
  const clean = normalizeCode(code);
  const [news, setNews] = useState(hasNews);
  return (
    <div className="home">
      <WhatsNew open={news} onClose={() => setNews(false)} />
      <section className="hero" aria-label="مزاد الكراج">
        {/* one composed picture: a studio floor under a soft top light, a faint tyre print across it,
            and the real wheel cropped by the bottom corner */}
        <div className="hero-bg" aria-hidden="true">
          <i className="hero-lamp" />
          <i className="hero-floor" />
          <img className="hero-track" src="/brand/wheel/track-512.webp" width={512} height={512} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />
          <img className="hero-wheel" src="/brand/wheel/hero-960.webp" width={960} height={960} alt="" draggable={false} decoding="async" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>

        <div className="hero-top">
          <span className="hero-date">{hijriToday()}</span>
          <button className="hero-how" onClick={() => go('/rules')}>
            كيف نلعب؟
          </button>
        </div>

        <h1 className="hero-title">
          <img className="hero-logo" src={LOGO.stack} width={300} height={263} alt="مزاد الكراج" draggable={false} />
        </h1>
        <p className="hero-line">مزاد سيارات على أصوله</p>
        <p className="hero-sub">سُم على سيارات حقيقية مع الشباب، واطلع بأقوى كراج.</p>

        <div className="hero-cta">
          <button
            className="btn btn-primary btn-block btn-hero"
            onClick={() => {
              sound.unlock();
              // the host deals from the full market: start fetching it now
              loadMarket().catch(() => {});
              go('/new');
            }}
          >
            افتح مزاد جديد
          </button>
          {!joining ? (
            <button className="btn btn-ghost btn-block" onClick={() => setJoining(true)}>
              عندي كود صالة
            </button>
          ) : (
            <form
              className="joinrow"
              onSubmit={(e) => {
                e.preventDefault();
                if (isCode(clean)) {
                  sound.unlock();
                  go(`/r/${clean}`);
                }
              }}
            >
              <input
                className="input"
                placeholder="K7Q2PM"
                value={clean}
                autoFocus
                autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value)}
                aria-label="كود الصالة"
              />
              <button className="btn btn-primary" disabled={!isCode(clean)}>
                ادخل
              </button>
            </form>
          )}
          {recent && (
            <button className="btn btn-quiet" onClick={() => go(`/r/${recent.code}`)}>
              ارجع لصالة {recent.code}
            </button>
          )}
          <CareerChip />
        </div>
      </section>

      <main className="shell narrow stack home-below" style={{ gap: 18, paddingTop: 8 }}>
        <section className="notice" aria-label="شروط المزاد">
          <header>
            <h2>شروط المزاد</h2>
            <span className="kicker">مزاد علني، على الحالة</span>
          </header>
          <ol>
            <li>
              <span>
                <b>المعاينة.</b> كل سيارة بصور إعلانها وتقرير فحص: خريطة البودي بقراءات جهاز الطلاء، سجل نجم، فحص الكمبيوتر، وكرت الشاصي.
              </span>
            </li>
            <li>
              <span>
                <b>السوم.</b> علني، وأي سوم بآخر الثواني يمدد الوقت. فيه سيارات عليها حد مخفي، وفيه سيارات بدون حد.
              </span>
            </li>
            <li>
              <span>
                <b>اللوحات.</b> بعض السيارات لوحتها مميزة، وقيمتها تنحسب لك.
              </span>
            </li>
            <li>
              <span>
                <b>الحساب.</b> تدفع سعر الرسو مع السعي وضريبته ورسوم نقل الملكية.
              </span>
            </li>
            <li>
              <span>
                <b>إذا رست.</b> تنكشف القيمة الحقيقية: يا لقطة يا انقصّ عليك، ومرات تطلع مفاجأة.
              </span>
            </li>
          </ol>
        </section>

        <nav className="foot foot-links" aria-label="روابط">
          <button className="btn btn-quiet" onClick={() => go('/rules')}>
            كيف نلعب؟
          </button>
          <button className="btn btn-quiet" onClick={() => setNews(true)}>
            الجديد
          </button>
          <a className="btn btn-quiet" href="/classic/">
            النسخة القديمة
          </a>
        </nav>
      </main>
    </div>
  );
}
