// The room's menu sheet, the room's status strip, and the bottom sheet both the menu and the players sheet sit in.
// Styles: src/styles/s-shell.css (prefix shl-).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { goHome, useBack } from '../App';
import type { RoomView } from '../useRoom';
import { Icon, Portal, useSheet } from './Bits';
import { ScreenTitle } from './kit/ScreenTitle';

export type MenuStep = 'menu' | 'leave' | 'skip' | 'end';

const AUCTION_OFF = ['lobby', 'showcase', 'voting', 'results'];
const PAUSABLE = ['preview', 'bidding', 'sealed', 'sold', 'unsold', 'intro', 'dutch'];
const SKIPPABLE = ['preview', 'bidding', 'sealed', 'dutch'];

/**
 * A bottom sheet over the room: a scrim that closes it on a tap, focus moved in and kept inside, Escape closes it.
 * The scrim keeps the `drawer-back` hook the room's back gesture looks for. `step` refocuses the sheet when its
 * content is swapped (a confirmation in place of the menu).
 */
export function ShellSheet({
  label,
  onClose,
  step,
  foot,
  children,
}: {
  label: string;
  onClose: () => void;
  step?: string;
  foot?: ReactNode;
  children: ReactNode;
}) {
  const ref = useSheet<HTMLDivElement>(onClose);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus({ preventScroll: true });
    ref.current?.querySelector('.shl-sheet-body')?.scrollTo(0, 0);
  }, [step, ref]);
  return (
    <Portal>
      <div className="drawer-back shl-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="shl-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="shl-sheet-body">{children}</div>
        {foot && <div className="shl-sheet-foot">{foot}</div>}
      </div>
    </Portal>
  );
}

/** One ruled menu row: an icon, the action, and one line of what it does. */
function MenuRow({ icon, title, line, onClick, quiet }: { icon: Parameters<typeof Icon>[0]['name']; title: string; line: string; onClick: () => void; quiet?: boolean }) {
  return (
    <li>
      <button type="button" className={`shl-row${quiet ? ' is-quiet' : ''}`} onClick={onClick}>
        <Icon name={icon} size={22} className="shl-row-ic" />
        <span className="shl-row-t">
          <b>{title}</b>
          <small>{line}</small>
        </span>
      </button>
    </li>
  );
}

/** The room's one way to leaving and to the host's controls. Destructive rows come last and ask first. */
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

  const close = (
    <button type="button" className="btn btn-quiet btn-block shl-close" onClick={onClose}>
      سكّر
    </button>
  );

  let body: ReactNode;
  let foot: ReactNode = close;
  if (step === 'leave') {
    const text = host
      ? ph === 'lobby'
        ? 'الصالة تبقى مفتوحة والشباب ينتظرونك. ترجع لها من الرئيسية.'
        : auction
          ? 'المزاد يوقف عند الكل لين ترجع، وتكمّل من نفس اللحظة. ترجع له من الرئيسية.'
          : ph === 'results'
            ? 'النتيجة تبقى عند الكل، وترجع لها من الرئيسية.'
            : 'الكل ينتظرك تكمّل، وترجع للصالة من الرئيسية.'
      : ph === 'lobby'
        ? 'تقدر ترجع تدخل بنفس الكود متى ما بغيت.'
        : 'فلوسك وكراجك محفوظة، وترجع لها من الرئيسية متى ما بغيت.';
    body = <Confirm title={host ? 'تطلع وأنت الدلال؟' : 'تطلع من الصالة؟'} text={text} />;
    foot = (
      <div className="shl-acts">
        <button type="button" className="btn btn-primary btn-block shl-go" onClick={leave}>
          {host && auction ? 'وقّف المزاد واطلع' : 'اطلع'}
        </button>
        {host && auction && (
          <button type="button" className="shl-chalk" onClick={() => setStep('end')}>
            خلّص المزاد للكل
          </button>
        )}
        <button type="button" className="btn btn-quiet btn-block shl-close" onClick={cancel}>
          خلني
        </button>
      </div>
    );
  } else if (step === 'skip') {
    body = <Confirm title="تشيل هالسيارة؟" text="تنشال بدون بيع، وننتقل للي بعدها." />;
    foot = (
      <div className="shl-acts">
        <button
          type="button"
          className="btn btn-primary btn-block shl-go"
          onClick={() => {
            host?.skip();
            onClose();
          }}
        >
          إيه، شيلها
        </button>
        <button type="button" className="btn btn-quiet btn-block shl-close" onClick={cancel}>
          لا، خلها
        </button>
      </div>
    );
  } else if (step === 'end') {
    body = <Confirm title="تخلّص المزاد للكل؟" text="يوقف البيع عند الكل وننتقل للكراجات والنتيجة. ما فيه رجعة." />;
    foot = (
      <div className="shl-acts">
        <button
          type="button"
          className="btn btn-primary btn-block shl-go"
          onClick={() => {
            host?.endNow();
            onClose();
          }}
        >
          إيه، خلّصه
        </button>
        <button type="button" className="btn btn-quiet btn-block shl-close" onClick={() => (start === 'menu' ? setStep('menu') : setStep(start))}>
          لا، كمّل
        </button>
      </div>
    );
  } else {
    const hostRows = !!host && auction;
    body = (
      <>
        <ScreenTitle as="h2" caption={<>كود الصالة <span className="shl-code ltr">{room.code}</span></>}>
          الصالة
        </ScreenTitle>
        <ul className="shl-rows">
          {hostRows &&
            canPause &&
            (core.paused ? (
              <MenuRow
                icon="play"
                title="كمّل المزاد"
                line="الساعة ترجع تمشي عند الكل"
                onClick={() => {
                  host.resume();
                  onClose();
                }}
              />
            ) : (
              <MenuRow
                icon="pause"
                title="وقّف مؤقت"
                line="الساعة توقف عند الكل لين تكمّل"
                onClick={() => {
                  host.pause();
                  onClose();
                }}
              />
            ))}
          <MenuRow
            icon="users"
            title={host ? 'اللاعبين والكراجات' : 'الكراجات والترتيب'}
            line={host ? 'تشوف كراج كل واحد، وتطلّع اللي تبي' : 'وش شرى كل واحد ووين وصل'}
            onClick={() => {
              onClose();
              onPlayers();
            }}
          />
        </ul>
        <ul className="shl-rows shl-rows-out" aria-label="نسألك قبل نسويها">
          {hostRows && canSkip && <MenuRow quiet icon="close" title="شيل السيارة" line="تنشال بدون بيع، ونروح للي بعدها" onClick={() => setStep('skip')} />}
          {hostRows && <MenuRow quiet icon="flag" title="خلّص المزاد للكل" line="ننتقل للكراجات والنتيجة" onClick={() => setStep('end')} />}
          <MenuRow
            quiet
            icon="exit"
            title="اطلع من الصالة"
            line={host ? (auction ? 'المزاد يوقف لين ترجع' : 'الصالة تبقى مفتوحة') : 'فلوسك وكراجك محفوظة'}
            onClick={() => setStep('leave')}
          />
        </ul>
      </>
    );
  }

  return (
    <ShellSheet label="قائمة الصالة" onClose={onClose} step={step} foot={foot}>
      {body}
    </ShellSheet>
  );
}

function Confirm({ title, text }: { title: string; text: string }) {
  return (
    <div className="shl-confirm" key={title}>
      <ScreenTitle as="h2" caption={text}>
        {title}
      </ScreenTitle>
    </div>
  );
}

/**
 * The room's status, one full-width strip directly under the top bar: reconnecting, the host gone, the host away,
 * or paused. It sits in the sticky head with the bar, so it never floats over content and the car sheet's sticky
 * tabs stop under it. The region stays mounted (empty when all is well) so a screen reader hears each change.
 * Its own 1 Hz check notices a silent host.
 */
export function RoomStatus({ room }: { room: RoomView }) {
  const core = room.snap.core;
  const [, tick] = useState(0);
  // the phone itself knows first when the network is gone; the socket can take a while to notice
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine !== false);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', f);
    window.addEventListener('offline', f);
    return () => {
      window.removeEventListener('online', f);
      window.removeEventListener('offline', f);
    };
  }, []);
  useEffect(() => {
    if (room.role !== 'player') return;
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, [room.role]);
  const player = room.role === 'player';
  const stale = player && room.net.lastHeard > 0 && Date.now() - room.net.lastHeard > 9000;
  const auction = !!core && !AUCTION_OFF.includes(core.phase);
  let kind: 'net' | 'host' | 'away' | 'pause' | null = null;
  let text = '';
  let action: ReactNode = null;
  if (core) {
    if (!room.net.connected || !online) {
      kind = 'net';
      text = 'مقطوع، نرجّع الخط…';
    } else if (player && (room.net.hostGone || stale)) {
      kind = 'host';
      text = 'الدلال انقطع، ننتظره يرجع. خلك بالصفحة.';
    } else if (core.paused && auction) {
      kind = core.away ? 'away' : 'pause';
      text = core.away ? 'الدلال طلع من الصفحة، المزاد واقف لين يرجع' : room.host ? 'وقّفت المزاد مؤقت' : 'المزاد واقف مؤقت، الدلال وقّفه';
      if (room.host)
        action = (
          <button type="button" className="shl-strip-act" onClick={room.host.resume}>
            كمّل
          </button>
        );
    }
  }
  return (
    <div className={kind ? `shl-strip is-${kind}` : 'shl-strip is-empty'} role="status" aria-live="polite">
      {kind && (
        <>
          {kind === 'net' || kind === 'host' ? (
            <Icon name="tire" size={18} className="shl-strip-ic is-turning" />
          ) : (
            <Icon name="pause" size={18} weight="fill" className="shl-strip-ic" />
          )}
          <span className="shl-strip-t">{text}</span>
          {action}
        </>
      )}
    </div>
  );
}
