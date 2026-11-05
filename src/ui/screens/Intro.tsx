import { memo, useLayoutEffect, useState } from 'react';
import { marketOf } from '../../engine/markets';
import type { Core } from '../../engine/types';
import { carsN, money } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';
import { BackgroundPaths } from '../components/fx/BackgroundPaths';
import { LOGO } from '../components/Logo';

/** «مزايد / مزايدين» with the number shown on its own. */
const biddersWord = (n: number) => (n === 1 ? 'مزايد' : n === 2 ? 'مزايدَين' : n <= 10 ? 'مزايدين' : 'مزايد');
/** «سيارة / سيارتين / سيارات» with the number shown on its own. */
const carsWord = (n: number) => (n === 1 ? 'سيارة' : n === 2 ? 'سيارتين' : n <= 10 ? 'سيارات' : 'سيارة');

/**
 * The hall opening: a short title sequence before the first lot. The lines land one after another
 * (CSS delays, transform/opacity only), then hold on the night's real numbers while the host's
 * clock runs out. Only the countdown leaf re-renders on clock ticks.
 */
export function Intro({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const s = core.settings;
  const market = marketOf(s.mix);
  const bidders = core.players.filter((p) => !p.spectator).length;
  // the host taps «ابدأ» at the foot of the lobby: open the title sequence from its first line
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <main className="shell narrow">
      <div className="intro-screen fx-host idn-intro">
        <BackgroundPaths />
        <div className="idn-seq">
          <img className="idn-logo idn-step" style={{ ['--d' as string]: 0 }} src={LOGO.stack} width={156} height={137} alt="" aria-hidden="true" draggable={false} />
          <div className="idn-kicker idn-step" style={{ ['--d' as string]: 0.5 }}>
            {s.roomName}
          </div>
          <h1 className="idn-call idn-step" style={{ ['--d' as string]: 1 }}>
            {core.callout?.text ?? 'حيّاكم في مزاد الكراج'}
          </h1>
          <div className="idn-market idn-step" style={{ ['--d' as string]: 2 }}>
            <small>سوق الليلة</small>
            <b>{market.label}</b>
            <span>{market.note}</span>
          </div>
          <dl className="idn-ledger">
            <div className="idn-step" style={{ ['--d' as string]: 3 }}>
              <dt>{biddersWord(bidders)}</dt>
              <dd>{bidders}</dd>
            </div>
            <div className="idn-step" style={{ ['--d' as string]: 3.5 }}>
              <dt>{carsWord(core.lotsTotal)} بالمزاد</dt>
              <dd>{core.lotsTotal}</dd>
            </div>
            <div className="idn-step" style={{ ['--d' as string]: 4 }}>
              <dt>ريال لكل واحد</dt>
              <dd className="ltr">{money(s.budget)}</dd>
            </div>
            <div className="idn-step" style={{ ['--d' as string]: 4.5 }}>
              <dt>ريال بالصالة</dt>
              <dd className="ltr">{money(s.budget * Math.max(1, bidders))}</dd>
            </div>
          </dl>
          <p className="idn-rules idn-step" style={{ ['--d' as string]: 5 }}>
            الكراج يشيل {carsN(s.garage)}
            {s.dutch !== false && <> · فيه مزاد هولندي، السعر ينزل</>}
          </p>
          <IntroCount core={core} offset={room.offset} />
          <p className="idn-hint idn-step" style={{ ['--d' as string]: 6 }}>
            اقرأ تقرير الفحص زين وقت المعاينة. القيمة الحقيقية تنكشف بعد ما تنزل المطرقة، ومرات تطلع مفاجأة.
          </p>
          {room.host && (
            <button className="btn btn-ghost idn-step" style={{ ['--d' as string]: 6 }} onClick={room.host.advance}>
              ابدأ الحين
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * The only piece that follows the clock. The number is keyed per second (it clicks over like a
 * dial); the rail under it is one CSS animation started once with the time left at mount, and it
 * holds while the host pauses.
 */
const IntroCount = memo(function IntroCount({ core, offset }: { core: Core; offset: number }) {
  const now = useNow(offset, 8);
  const { ms } = timeLeft(core, now);
  const [total] = useState(() => Math.max(400, ms));
  const sec = Math.max(1, Math.ceil(ms / 1000));
  // the start lamps: one lights each second over the last five, like the grid before a race
  const lit = Math.max(0, Math.min(5, 6 - sec));
  return (
    <div className={`idn-count idn-step ${sec <= 1 ? 'final' : ''}`} style={{ ['--d' as string]: 5.5 }} role="timer" aria-label={`أول سيارة بعد ${sec} ثواني`}>
      <span className="idn-lights" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i < lit ? 'on' : undefined} />
        ))}
      </span>
      <small>أول سيارة بعد</small>
      <span key={sec} className="idn-count-n fx-count ltr">
        {sec}
      </span>
      <i className="idn-rail" aria-hidden="true">
        <i style={{ animationDuration: `${total}ms`, animationPlayState: core.paused ? 'paused' : 'running' }} />
      </i>
    </div>
  );
});
