import { memo, useLayoutEffect } from 'react';
import { marketOf } from '../../engine/markets';
import type { Core } from '../../engine/types';
import { carsN, money } from '../../lib/util';
import { timeLeft, useNow, type RoomView } from '../useRoom';
import { LOGO } from '../components/Logo';


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
        <div className="idn-seq">
          <img className="idn-logo idn-step" style={{ ['--d' as string]: 0 }} src={LOGO.stack} width={96} height={84} alt="" aria-hidden="true" draggable={false} />
          <h1 className="idn-call idn-step" style={{ ['--d' as string]: 0.6 }}>
            {core.callout?.text ?? 'حيّاكم في مزاد الكراج'}
          </h1>
          {/* the run sheet: one list, the label on the right and the value on the left */}
          <dl className="idn-sheet idn-step" style={{ ['--d' as string]: 1.4 }}>
            <div>
              <dt>السوق</dt>
              <dd>{market.label}</dd>
            </div>
            <div>
              <dt>السيارات</dt>
              <dd className="ltr">{core.lotsTotal}</dd>
            </div>
            <div>
              <dt>المزايدين</dt>
              <dd className="ltr">{bidders}</dd>
            </div>
            <div>
              <dt>ميزانية كل لاعب</dt>
              <dd className="ltr">{money(s.budget)}</dd>
            </div>
            <div>
              <dt>الكراج يشيل</dt>
              <dd>{carsN(s.garage)}</dd>
            </div>
          </dl>
          <IntroCount core={core} offset={room.offset} />
          <p className="idn-hint idn-step" style={{ ['--d' as string]: 3 }}>
            {s.dutch !== false ? 'فيه مزاد هولندي الليلة، السعر ينزل. ' : ''}اقرأ تقرير الفحص زين قبل تسوم.
          </p>
          {room.host && (
            <button className="btn btn-ghost btn-block idn-go idn-step" style={{ ['--d' as string]: 3 }} onClick={room.host.advance}>
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
/** the seconds left, as said: ثانية، ثانيتين، 3 ثواني، 11 ثانية */
const secs = (n: number) => (n === 1 ? 'ثانية' : n === 2 ? 'ثانيتين' : n <= 10 ? `${n} ثواني` : `${n} ثانية`);

const IntroCount = memo(function IntroCount({ core, offset }: { core: Core; offset: number }) {
  const now = useNow(offset, 8);
  const { ms } = timeLeft(core, now);
  const sec = Math.max(1, Math.ceil(ms / 1000));
  // the start lamps: one lights each second over the last five, like the grid before a race
  const lit = Math.max(0, Math.min(5, 6 - sec));
  return (
    <div className={`idn-count idn-step ${sec <= 1 ? 'final' : ''}`} style={{ ['--d' as string]: 2.2 }} role="timer" aria-label={`أول سيارة بعد ${secs(sec)}`}>
      <span className="idn-lights" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} className={i < lit ? 'on' : undefined} />
        ))}
      </span>
      <span key={sec} className="idn-count-n fx-count ltr">
        {sec}
      </span>
      <small>أول سيارة بعد {secs(sec)}</small>
    </div>
  );
});
