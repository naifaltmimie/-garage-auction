import { useState } from 'react';
import { sound } from '../../audio/sound';
import { loadMarket } from '../../data/market';
import { hijriToday, isCode, normalizeCode, store } from '../../lib/util';
import { go } from '../App';
import { CareerChip } from '../components/CareerPanel';
import { WhatsNew, hasNews } from '../components/WhatsNew';
import { LOGO } from '../components/Logo';

// two tyre tracks drifting across the hero, behind the logo (drawn once when Home opens)
const SKID_A = 'M -40 560 C 60 470, 120 360, 210 300 S 360 170, 450 40';
const SKID_B = 'M -10 600 C 90 505, 150 395, 240 335 S 390 205, 480 75';

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
        <div className="hero-bg" aria-hidden="true">
          <i className="hero-lamp" />
          <svg className="hero-skid" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id="skid-reveal" maskUnits="userSpaceOnUse">
                <path className="hero-skid-draw" d={SKID_A} />
                <path className="hero-skid-draw" d={SKID_B} />
              </mask>
            </defs>
            <g mask="url(#skid-reveal)">
              <path className="hero-skid-band" d={SKID_A} />
              <path className="hero-skid-tread" d={SKID_A} />
              <path className="hero-skid-band" d={SKID_B} />
              <path className="hero-skid-tread" d={SKID_B} />
            </g>
          </svg>
          <i className="hero-tread" />
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
        <p className="hero-sub">سيارات حقيقية من حراج بصورها وتقرير فحصها ولوحاتها. سُم مع الشباب، وابنِ أقوى كراج قبل ما تنزل المطرقة.</p>

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
              رجوع لصالة {recent.code}
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
                <b>التسوية.</b> تدفع سعر الرسو مع السعي وضريبته ورسوم نقل الملكية.
              </span>
            </li>
            <li>
              <span>
                <b>بعد المطرقة.</b> تنكشف القيمة الحقيقية: يا لقطة يا انقصّ عليك، ومرات تطلع مفاجأة.
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
