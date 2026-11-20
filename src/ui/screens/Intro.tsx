// The night's opening («الصالة مليانة والسيارات جاهزة»): the room's name and the auctioneer's call in the voice, the
// night's terms as ruled rows with printed numbers, and the countdown as one large printed numeral, red only in its
// last three seconds. The one authored moment is the numeral changing. Styles: src/styles/s-shell.css (shl-).
import { memo, useLayoutEffect } from 'react';
import { marketOf } from '../../engine/markets';
import type { Core } from '../../engine/types';
import { money } from '../../lib/util';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { Rows } from '../components/kit/Rows';
import { timeLeft, useNow, type RoomView } from '../useRoom';

export function Intro({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const s = core.settings;
  const market = marketOf(s.mix);
  const bidders = core.players.filter((p) => !p.spectator).length;
  const host = core.players.find((p) => p.host);
  const name = s.roomName?.trim() || `مزاد ${host?.name ?? 'الليلة'}`;
  // the host taps «ابدأ» at the foot of the lobby: open the night from its first line
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <main className="shell narrow shl-intro">
      <ScreenTitle caption={<span className="shl-call">{core.callout?.text ?? 'حيّاكم في مزاد الكراج'}</span>}>{name}</ScreenTitle>
      <Rows
        className="shl-terms"
        items={[
          { k: 'السوق', v: market.label },
          { k: 'السيارات', v: core.lotsTotal, print: true },
          { k: 'المزايدين', v: bidders, print: true },
          { k: 'ميزانية كل واحد', v: money(s.budget), print: true },
          { k: 'الكراج يشيل', v: <>{s.garage === 1 ? 'سيارة وحدة' : s.garage === 2 ? 'سيارتين' : <><span className="shl-num ltr">{s.garage}</span> سيارات</>}</> },
        ]}
      />
      <IntroCount core={core} offset={room.offset} />
      <p className="shl-intro-hint">
        {s.dutch !== false ? 'فيه مزاد هولندي الليلة، السعر ينزل. ' : ''}اقرأ تقرير الفحص زين قبل تسوم.
      </p>
      {room.host && (
        <button type="button" className="shl-chalk shl-intro-go" onClick={room.host.advance}>
          ابدأ الحين
        </button>
      )}
    </main>
  );
}

/** the seconds left, as said: ثانية، ثانيتين، 3 ثواني، 11 ثانية */
const secs = (n: number) => (n === 1 ? 'ثانية' : n === 2 ? 'ثانيتين' : n <= 10 ? `${n} ثواني` : `${n} ثانية`);

/** The only piece that follows the clock: one printed numeral, keyed per second so each new one lands once. */
const IntroCount = memo(function IntroCount({ core, offset }: { core: Core; offset: number }) {
  const now = useNow(offset, 8);
  const { ms } = timeLeft(core, now);
  const sec = Math.max(1, Math.ceil(ms / 1000));
  return (
    <div className={`shl-count${sec <= 3 ? ' is-last' : ''}`} role="timer" aria-label={`أول سيارة بعد ${secs(sec)}`}>
      {/* the line leads into the numeral, which finishes the sentence: the count is said once */}
      <span className="shl-count-t" aria-hidden="true">
        أول سيارة بعد
      </span>
      <span className="shl-count-box" aria-hidden="true">
        <span key={sec} className="shl-count-n ltr">
          {sec}
        </span>
      </span>
    </div>
  );
});
