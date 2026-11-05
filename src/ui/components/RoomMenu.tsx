import { useEffect, useState } from 'react';
import { goHome, useBack } from '../App';
import type { RoomView } from '../useRoom';
import { Icon } from './Bits';

export type MenuStep = 'menu' | 'leave' | 'skip' | 'end';

const AUCTION_OFF = ['lobby', 'showcase', 'voting', 'results'];
const PAUSABLE = ['preview', 'bidding', 'sealed', 'sold', 'unsold', 'intro', 'dutch'];
const SKIPPABLE = ['preview', 'bidding', 'sealed', 'dutch'];

/** The room's one way in to leaving and to the host's controls. Destructive steps ask first. */
export function RoomMenu({ room, start, onClose, onPlayers }: { room: RoomView; start: MenuStep; onClose: () => void; onPlayers: () => void }) {
  const core = room.snap.core!;
  const [step, setStep] = useState<MenuStep>(start);
  // back from a confirm returns to the menu it came from; back from the menu closes it
  useBack(true, () => (step !== 'menu' && start === 'menu' ? setStep('menu') : onClose()));
  const host = room.host;
  const ph = core.phase;
  const auction = !AUCTION_OFF.includes(ph);
  const canPause = !!core.timer && PAUSABLE.includes(ph);
  const canSkip = SKIPPABLE.includes(ph);
  const cancel = () => (start === 'menu' ? setStep('menu') : onClose());
  // a confirm whose action the phase no longer allows (the lot closed meanwhile) falls back quietly
  useEffect(() => {
    if ((step === 'skip' && !canSkip) || (step === 'end' && !auction)) setStep(start === step ? 'menu' : start);
  }, [step, canSkip, auction, start]);

  const leave = () => {
    if (host && auction) host.hold();
    onClose();
    goHome();
  };

  let body: React.ReactNode;
  if (step === 'leave') {
    const text = host
      ? ph === 'lobby'
        ? 'الصالة تبقى مفتوحة واللاعبين ينتظرونك. ترجع لها من الرئيسية.'
        : auction
          ? 'المزاد يوقف عند الكل لين ترجع، وتكمّل من نفس اللحظة. ترجع له من الرئيسية.'
          : ph === 'results'
            ? 'النتايج تبقى عند الكل، وترجع لها من الرئيسية.'
            : 'الكل ينتظرك تكمّل، وترجع للصالة من الرئيسية.'
      : ph === 'lobby'
        ? 'تقدر ترجع تدخل بنفس الكود متى ما بغيت.'
        : 'فلوسك وكراجك محفوظة، وترجع لها من الرئيسية متى ما بغيت.';
    body = (
      <Confirm title={host ? 'تطلع وأنت المضيف؟' : 'تطلع من الصالة؟'} text={text}>
        <button className="btn btn-primary btn-block rm-go" onClick={leave}>
          {host && auction ? 'وقّف المزاد واطلع' : 'اطلع'}
        </button>
        {host && auction && (
          <button className="btn btn-ghost btn-block rm-danger" onClick={() => setStep('end')}>
            أنهِ المزاد للكل
          </button>
        )}
        <button className="btn btn-quiet btn-block" onClick={cancel}>خلني</button>
      </Confirm>
    );
  } else if (step === 'skip') {
    body = (
      <Confirm title="تشيل هالسيارة؟" text="تنشال بدون بيع، وننتقل للي بعدها.">
        <button
          className="btn btn-primary btn-block rm-danger-solid"
          onClick={() => {
            host?.skip();
            onClose();
          }}
        >
          إيه، شيلها
        </button>
        <button className="btn btn-quiet btn-block" onClick={cancel}>لا، خلها</button>
      </Confirm>
    );
  } else if (step === 'end') {
    body = (
      <Confirm title="تنهي المزاد للكل؟" text="يوقف البيع عند الكل وننتقل للكراجات والنتايج. ما فيه رجعة.">
        <button
          className="btn btn-primary btn-block rm-danger-solid"
          onClick={() => {
            host?.endNow();
            onClose();
          }}
        >
          أنهِ المزاد
        </button>
        <button className="btn btn-quiet btn-block" onClick={() => (start === 'menu' ? setStep('menu') : setStep(start))}>لا، كمّل</button>
      </Confirm>
    );
  } else {
    body = (
      <>
        <div className="rm-head">
          <h3>الصالة</h3>
          <span className="code rm-code ltr">{room.code}</span>
        </div>
        {host && auction && (
          <section className="rm-group" aria-label="تحكم المضيف">
            <div className="t-label">تحكم المضيف</div>
            {canPause &&
              (core.paused ? (
                <button className="rm-row on" onClick={() => { host.resume(); onClose(); }}>
                  <span className="rm-ic"><Icon name="gavel" size={18} /></span>
                  <span className="rm-tx"><b>كمّل المزاد</b><small>الساعة ترجع تمشي عند الكل</small></span>
                </button>
              ) : (
                <button className="rm-row" onClick={() => { host.pause(); onClose(); }}>
                  <span className="rm-ic"><Icon name="pause" size={18} /></span>
                  <span className="rm-tx"><b>وقّف مؤقت</b><small>الساعة توقف عند الكل لين تكمّل</small></span>
                </button>
              ))}
            {canSkip && (
              <button className="rm-row" onClick={() => setStep('skip')}>
                <span className="rm-ic"><Icon name="back" size={18} /></span>
                <span className="rm-tx"><b>شيل السيارة</b><small>تنشال بدون بيع</small></span>
              </button>
            )}
            <button className="rm-row danger" onClick={() => setStep('end')}>
              <span className="rm-ic"><Icon name="close" size={18} /></span>
              <span className="rm-tx"><b>أنهِ المزاد للكل</b><small>ننتقل للكراجات والنتايج</small></span>
            </button>
          </section>
        )}
        <section className="rm-group">
          <button className="rm-row" onClick={() => { onClose(); onPlayers(); }}>
            <span className="rm-ic"><Icon name="users" size={18} /></span>
            <span className="rm-tx">
              <b>{host ? 'اللاعبين والكراجات' : 'الكراجات والترتيب'}</b>
              <small>{host ? 'تشوف كراج كل واحد، وتطلّع اللي تبي' : 'وش شرى كل واحد ووين وصل'}</small>
            </span>
          </button>
        </section>
        <button className="btn btn-ghost btn-block rm-leave" onClick={() => setStep('leave')}>
          اطلع من الصالة
        </button>
        <button className="btn btn-quiet btn-block" onClick={onClose}>سكّر</button>
      </>
    );
  }

  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer rm-sheet" role="dialog" aria-modal="true" aria-label="قائمة الصالة">
        {body}
      </div>
    </>
  );
}

function Confirm({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="rm-confirm" key={title}>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="rm-actions">{children}</div>
    </div>
  );
}

/**
 * One calm line under the top bar for the room's state: reconnecting, host away, or paused.
 * Fixed, so it never pushes the page around; its own 1 Hz check notices a silent host.
 */
export function RoomStatus({ room }: { room: RoomView }) {
  const core = room.snap.core;
  const [, tick] = useState(0);
  useEffect(() => {
    if (room.role !== 'player') return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [room.role]);
  if (!core) return null;
  const player = room.role === 'player';
  const stale = player && room.net.lastHeard > 0 && Date.now() - room.net.lastHeard > 9000;
  const auction = !AUCTION_OFF.includes(core.phase);
  let tone: 'net' | 'pause' = 'pause';
  let text = '';
  let action: React.ReactNode = null;
  if (!room.net.connected) {
    tone = 'net';
    text = 'الاتصال انقطع، نرجع نتصل…';
  } else if (player && (room.net.hostGone || stale)) {
    tone = 'net';
    text = 'المضيف انقطع، ننتظره يرجع. خلك بالصفحة.';
  } else if (core.paused && auction) {
    text = core.away ? 'المضيف طلع من الصفحة، المزاد واقف لين يرجع' : 'المزاد واقف مؤقت';
    if (room.host)
      action = (
        <button className="rs-act" onClick={room.host.resume}>
          كمّل
        </button>
      );
  }
  if (!text) return null;
  return (
    <div className={`room-status ${tone}`} role="status" aria-live="polite">
      <span className="rs-pill">
        <i aria-hidden="true" />
        <span>{text}</span>
        {action}
      </span>
    </div>
  );
}
