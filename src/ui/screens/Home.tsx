import { useMemo, useState } from 'react';
import { sound } from '../../audio/sound';
import { CATALOGUE } from '../../data/catalogue';
import { PHOTOS } from '../../data/photos';
import { hijriToday, isCode, money, normalizeCode, store } from '../../lib/util';
import { go } from '../App';
import { photoSrc } from '../components/Gallery';
import { GavelMark } from './Room';

/** A few real cars from tonight's market, for the front page. */
function useShowroom(n = 8) {
  return useMemo(() => {
    const withPhotos = CATALOGUE.filter((m) => PHOTOS[m.id]?.some((a) => a.imgs.length));
    const pool = [...withPhotos].sort(() => Math.random() - 0.5);
    // a spread of tiers so the strip looks like a real hall
    const out: typeof pool = [];
    const seen = new Set<string>();
    for (const m of pool) {
      if (out.length >= n) break;
      if (seen.has(m.tier) && out.length < 5) continue;
      seen.add(m.tier);
      out.push(m);
    }
    for (const m of pool) if (out.length < n && !out.includes(m)) out.push(m);
    return out.map((m) => ({ m, img: PHOTOS[m.id]!.find((a) => a.imgs.length)!.imgs[0] }));
  }, [n]);
}

export function Home() {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const last = store.get<{ code: string; at: number; host: boolean } | null>('mzk:last', null);
  const recent = last && Date.now() - last.at < 1000 * 60 * 60 * 10 ? last : null;
  const clean = normalizeCode(code);
  const show = useShowroom();
  const star = show[0];
  return (
    <div className="home">
      <header className="apphead">
        <span className="brand">
          <GavelMark />
          <span className="brand-name">
            مزاد <b>الكراج</b>
          </span>
        </span>
        <span className="apphead-date">{hijriToday()}</span>
      </header>

      <section className="cover">
        {star ? <img src={photoSrc(star.img)} alt="" referrerPolicy="no-referrer" /> : <div className="cover-blank" />}
        <div className="cover-shade" />
        <div className="cover-text">
          <span className="cover-tag">الليلة في الصالة</span>
          {star ? (
            <>
              <b>
                {star.m.makeAr} {star.m.modelAr} <span className="ltr">{star.m.year}</span>
              </b>
              <small>
                سعرها بالسوق حول <span className="ltr">{money(star.m.value)}</span> ريال
              </small>
            </>
          ) : (
            <b>سيارات حقيقية من السوق السعودي</b>
          )}
        </div>
      </section>

      <main className="shell narrow stack" style={{ gap: 18, paddingTop: 18 }}>
        <section className="intro">
          <h1>مزاد سيارات على أصوله</h1>
          <p>سيارات من السوق السعودي بصور إعلاناتها وتقرير فحصها ولوحاتها. سُم عليها مع الشباب، وابنِ أقوى كراج قبل ما تنزل المطرقة.</p>
          <div className="cta">
            <button
              className="btn btn-primary btn-block"
              onClick={() => {
                sound.unlock();
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
          </div>
        </section>

        {show.length > 1 && (
          <section className="stack" style={{ gap: 10 }}>
            <div className="row between">
              <h2 className="t-title" style={{ margin: 0, fontSize: 20 }}>من سوق الليلة</h2>
              <span className="chip chip-green">صور إعلانات حقيقية</span>
            </div>
            <div className="strip">
              {show.slice(1).map(({ m, img }) => (
                <figure key={m.id}>
                  <img src={photoSrc(img)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <figcaption>
                    {m.makeAr} {m.modelAr} <span className="ltr">{m.year}</span>
                    <small>
                      حول <span className="ltr">{money(m.value)}</span> ريال
                    </small>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

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

        <p className="foot">
          <button className="btn btn-quiet" onClick={() => go('/rules')}>
            كيف نلعب؟
          </button>
        </p>
      </main>
    </div>
  );
}
