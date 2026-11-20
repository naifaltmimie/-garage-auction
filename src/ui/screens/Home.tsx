// Home: the yard at night. The sign hangs from the top of the screen on a chalk string tied through the hole in
// its red tag and swings once when the page opens; under it the one line; the real wheel stands on the floor in
// the start corner; the actions sit in a sticky block at the bottom. Styles: src/styles/s-home.css.
import { useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import { loadMarket } from '../../data/market';
import { loadCareer } from '../../lib/career';
import { isCode, normalizeCode, store } from '../../lib/util';
import { go } from '../App';
import { CareerPanel } from '../components/CareerPanel';
import { LOGO } from '../components/Logo';
import { WhatsNew, hasNews } from '../components/WhatsNew';

/** A room this phone was in during the last ten hours, to go back to. */
function recentRoom() {
  const last = store.get<{ code: string; at: number; host: boolean } | null>('mzk:last', null);
  return last && Date.now() - last.at < 1000 * 60 * 60 * 10 ? last : null;
}

export function Home() {
  const [news, setNews] = useState(hasNews);
  const [career, setCareer] = useState(false);
  const recent = recentRoom();
  return (
    <div className="hm">
      <WhatsNew open={news} onClose={() => setNews(false)} />
      {career && <CareerPanel onClose={() => setCareer(false)} />}

      <div className="hm-yard">
        <Sign />
        <div className="hm-line">
          <p className="hm-tagline">مزاد سيارات على أصوله</p>
          <p className="hm-sub">
            <span>سُم على سيارات حقيقية مع الشباب،</span> <span>واطلع بأقوى كراج.</span>
          </p>
        </div>
        {/* the floor: the wheel stands in the end corner, its face turned into the screen, in a pool of lamp
            light on the asphalt with its own contact shadow; every box is laid out before the picture arrives */}
        <div className="hm-floor" aria-hidden="true">
          <div className="hm-stand">
            <i className="hm-pool" />
            <i className="hm-contact" />
          <img
            className="hm-wheel"
            src="/brand/wheel/hero-960.webp"
            srcSet="/brand/wheel/hero-960.webp 960w, /brand/wheel/hero-1200.webp 1200w"
            sizes="(min-width: 600px) 300px, 62vw"
            width={960}
            height={960}
            alt=""
            loading="lazy"
            decoding="async"
            {...({ fetchpriority: 'low' } as object)}
            draggable={false}
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          </div>
        </div>
      </div>

      <div className="hm-bar">
        <div className="hm-bar-in">
          {recent && (
            <button className="hm-back" onClick={() => go(`/r/${recent.code}`)}>
              <span>ارجع لصالة</span>
              <span className="hm-back-code ltr">{recent.code}</span>
            </button>
          )}
          <button
            className="btn btn-primary btn-block hm-open"
            onClick={() => {
              sound.unlock();
              // the host deals from the full market: start fetching it now
              loadMarket().catch(() => {});
              go('/new');
            }}
          >
            افتح مزاد جديد
          </button>
          <JoinByCode />
          <div className="hm-chalks">
            <button className="hm-chalk" onClick={() => setCareer(true)}>
              سجلي
              <Nights />
            </button>
            <button className="hm-chalk" onClick={() => go('/rules')}>
              كيف نلعب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sign: the logo hung on a string from the top of the screen. The string is fixed; the logo swings about
 *  the hole once on load. The strands are drawn in the logo's own units (its viewBox), so they stay on the hole
 *  at every size. */
function Sign() {
  return (
    <div className="hm-sign">
      <h1 className="hm-sign-h">
        <span className="hm-logo-box">
          <i className="hm-string" aria-hidden="true" />
          {/* the strand that goes behind the tag: seen only between the knot and the tag's top edge */}
          <svg className="hm-strand hm-strand-back" viewBox="-9 0 224 196.2" aria-hidden="true">
            <path d="M67.6 -11 L76 6" />
          </svg>
          <img className="hm-logo" src={LOGO.stack} width={224} height={196} alt="مزاد الكراج" draggable={false} />
          {/* the strand in front: out of the hole, over the tag's corner, to the knot */}
          <svg className="hm-strand hm-strand-front" viewBox="-9 0 224 196.2" aria-hidden="true">
            <path d="M62.1 43.9 L67.6 -11" />
            <circle className="hm-knot" cx="67.6" cy="-11" r="2.6" />
          </svg>
        </span>
      </h1>
    </div>
  );
}

/** How many nights are in this phone's record, after «سجلي»; nothing when there are none. */
function Nights() {
  const [n] = useState(() => loadCareer().nights.length);
  if (n < 1) return null;
  return (
    <small className="hm-chalk-n">
      {n === 1 ? 'ليلة وحدة' : n === 2 ? 'ليلتين' : <><span className="ltr">{n}</span> {n <= 10 ? 'ليالي' : 'ليلة'}</>}
    </small>
  );
}

/** «عندي كود صالة», which opens the six-character code field in the same place, with the join button beside it.
 *  A wrong length says so under the field instead of a dead button. */
function JoinByCode() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const clean = normalizeCode(code);
  if (!open) {
    return (
      <button className="btn btn-ghost btn-block hm-code-open" onClick={() => setOpen(true)} aria-expanded="false">
        عندي كود صالة
      </button>
    );
  }
  return (
    <form
      className="hm-join"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!isCode(clean)) {
          setErr(clean.length === 0 ? 'اكتب كود الصالة، ست خانات' : `الكود ست خانات، كتبت ${clean.length}`);
          input.current?.focus();
          return;
        }
        sound.unlock();
        go(`/r/${clean}`);
      }}
    >
      <div className="hm-join-row">
        <input
          ref={input}
          className={`hm-code${err ? ' is-bad' : ''}`}
          placeholder="K7Q2PM"
          value={clean}
          autoFocus
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={6}
          dir="ltr"
          aria-label="كود الصالة"
          aria-invalid={err ? true : undefined}
          aria-describedby="hm-join-msg"
          onChange={(e) => {
            setCode(e.target.value);
            if (err) setErr('');
          }}
        />
        <button className="btn hm-join-go">ادخل</button>
      </div>
      <p id="hm-join-msg" className={`hm-join-msg${err ? ' is-bad' : ''}`} aria-live="assertive">
        {err || 'الكود عند اللي فتح الصالة'}
      </p>
    </form>
  );
}
