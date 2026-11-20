// The lobby: the host gathers the friends and starts; a player waits calmly and can't press anything by mistake.
// Host: the room's name, the invitation on paper (code, QR, copy, send), the big-screen row, the players as ruled
// rows, the conditions in one line with «عدّل», and the start button in a sticky bottom bar.
// Player: the room's name, the wait, the conditions, the players, the code with a share action, the game in three lines.
import { useEffect, useState } from 'react';
import { sound } from '../../audio/sound';
import { Icon, Portal, QR, useSheet } from '../components/Bits';
import { Facts, type Fact } from '../components/kit/Facts';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { Paddle } from '../components/Plate';
import { MarketPicker, SettingsFields, settingsFacts } from '../components/SettingsFields';
import { TireLoader } from '../components/TireLoader';
import type { PlayerPub as Player } from '../../engine/types';
import type { RoomView } from '../useRoom';
import { useBack } from '../App';
import { openTv } from './Tv';

/** A short "done" word that goes back after a moment (copied, sent). */
function useFlash(ms = 1800): [string | null, (k: string) => void] {
  const [k, setK] = useState<string | null>(null);
  useEffect(() => {
    if (!k) return;
    const t = setTimeout(() => setK(null), ms);
    return () => clearTimeout(t);
  }, [k, ms]);
  return [k, setK];
}

export function Lobby({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const s = core.settings;
  const link = `${location.origin}/#/r/${room.code}`;
  const [flash, setFlash] = useFlash();
  const [edit, setEdit] = useState(false);
  const [kickAsk, setKickAsk] = useState<string | null>(null);
  const active = core.players.filter((p) => !p.spectator);
  const host = core.players.find((p) => p.host);
  const isHost = !!room.host;
  const title = s.roomName.trim() || (host ? `مزاد ${host.name}` : 'مزاد الكراج');
  const msg = `${title} فاتح الحين\nادخل الصالة وسُم معنا:\n${link}\nكود الصالة: ${room.code}`;

  // someone removed or gone: drop a pending kick question about them
  useEffect(() => {
    if (kickAsk && !core.players.some((p) => p.id === kickAsk)) setKickAsk(null);
  }, [kickAsk, core.players]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'مزاد الكراج', text: msg });
        return;
      }
    } catch {
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setFlash('code');
    } catch {
      /* no clipboard: the code is on screen to read out */
    }
  };

  const players = (
    <section className="lby-sec" aria-labelledby="lby-pl-h">
      <div className="lby-sec-head">
        <h2 className="lby-h" id="lby-pl-h">
          المزايدين
        </h2>
        <span className="lby-count">
          <span className="ltr">{active.length}</span> من <span className="ltr">{s.maxPlayers}</span>
        </span>
      </div>
      <ul className="lby-players">
        {core.players.map((p) => (
          <PlayerRow
            key={p.id}
            p={p}
            me={p.id === room.myId}
            canKick={isHost && !p.host}
            asking={kickAsk === p.id}
            onAsk={() => setKickAsk(p.id)}
            onCancel={() => setKickAsk(null)}
            onKick={() => {
              setKickAsk(null);
              room.host!.kick(p.id);
            }}
          />
        ))}
      </ul>
      {active.length < 2 && (
        <p className="lby-empty" role="status">
          <b>ما دخل أحد للحين</b>
          <span>{isHost ? 'أرسل لهم الرابط، أو خلهم يصوّرون الكود' : 'أول ما يدخل أحد يطلع هنا'}</span>
        </p>
      )}
    </section>
  );

  const conditions = (
    <section className="lby-sec lby-cond" aria-labelledby="lby-cond-h">
      <div className="lby-sec-head">
        <h2 className="lby-h" id="lby-cond-h">
          شروط المزاد
        </h2>
        {isHost && (
          <button type="button" className="lby-chalk" onClick={() => setEdit(true)}>
            <Icon name="settings" size={18} />
            عدّل
          </button>
        )}
      </div>
      <div className="lby-cond-line" role={isHost ? undefined : 'status'} aria-live={isHost ? undefined : 'polite'}>
        <Facts items={settingsFacts(s, { market: true })} />
      </div>
    </section>
  );

  if (!isHost) {
    return (
      <main className="shell narrow lby lby-player">
        <ScreenTitle caption={host ? `${host.name} هو الدلال الليلة` : undefined}>{title}</ScreenTitle>
        <div className="lby-wait">
          <TireLoader size={64} label="ننتظر الدلال يبدأ" />
        </div>
        {conditions}
        {players}
        <section className="lby-sec codebox lby-coderow" aria-label="كود الصالة">
          <span className="lby-coderow-k">كود الصالة</span>
          <span className="code ltr">{room.code}</span>
          <button type="button" className="lby-chalk" onClick={share}>
            <Icon name="share" size={18} />
            أرسل الرابط
          </button>
        </section>
        {!sound.prefs.voice && <VoiceRow />}
        <section className="lby-sec" aria-labelledby="lby-how-h">
          <h2 className="lby-h" id="lby-how-h">
            اللعبة
          </h2>
          <ul className="lby-how">
            <li>
              <Icon name="gavel" size={20} />
              سُم بزر واحد
            </li>
            <li>
              <Icon name="car" size={20} />
              اللي ترسي عليه ياخذها
            </li>
            <li>
              <Icon name="trophy" size={20} />
              آخر الليل تقيّمون الكراجات
            </li>
          </ul>
        </section>
      </main>
    );
  }

  const n = active.length;
  const full = n >= s.maxPlayers;
  return (
    <main className="shell narrow lby lby-host">
      <ScreenTitle caption="خلّ جوالك مفتوح على الصفحة، المزاد يمشي من عندك">{title}</ScreenTitle>

      <section className="codebox lby-invite" aria-label="الدعوة">
        <div className="lby-paper">
          <div className="lby-paper-code">
            <span className="lby-paper-k">كود الصالة</span>
            <span className="code ltr">{room.code}</span>
            <span className="lby-paper-k">صوّر الباركود أو اكتب الكود</span>
          </div>
          <i className="lby-paper-cut" aria-hidden="true" />
          <QR text={link} size={104} />
        </div>
        <div className="lby-acts">
          <button type="button" className="lby-chalk" onClick={copyCode}>
            <Icon name={flash === 'code' ? 'check' : 'copy'} size={18} />
            <span aria-live="polite">{flash === 'code' ? 'انتسخ الكود' : 'انسخ الكود'}</span>
          </button>
          <button type="button" className="lby-chalk" onClick={share}>
            <Icon name="share" size={18} />
            أرسل الرابط
          </button>
        </div>
      </section>

      <button type="button" className="lby-row" onClick={() => openTv(room.code)}>
        <Icon name="tv" size={22} />
        <span className="lby-row-t">
          <b>افتح شاشة العرض</b>
          <small>على التلفزيون أو اللابتوب، الكل يشوف السوم</small>
        </span>
        <Icon name="arrow-left" size={18} className="lby-row-go" />
      </button>

      {players}
      {conditions}

      <div className="lby-bar">
        <div className="lby-bar-in">
          <p className="lby-bar-line" role="status">
            {n < 2 ? (
              'أنت لحالك بالصالة · جرّب قبل لا يدخلون'
            ) : (
              <>
                بالصالة <span className="ltr">{n}</span> · {full ? 'الصالة فلّت' : 'ننتظر أحد؟'}
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-gold btn-block lby-go"
            onClick={() => {
              sound.unlock();
              room.host!.start();
            }}
          >
            {n < 2 ? 'ابدأ تجربة لحالك' : 'ابدأ المزاد'}
          </button>
        </div>
      </div>

      {edit && <SettingsSheet room={room} onClose={() => setEdit(false)} />}
    </main>
  );
}

/** One bidder as a ruled row: paddle, name, the facts about him, and for the host a «طلّع» that asks first. */
function PlayerRow({
  p,
  me,
  canKick,
  asking,
  onAsk,
  onCancel,
  onKick,
}: {
  p: Player;
  me: boolean;
  canKick: boolean;
  asking: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onKick: () => void;
}) {
  const facts: Fact[] = [];
  if (me) facts.push('أنت');
  if (p.host) facts.push('الدلال');
  if (p.spectator) facts.push('متفرج');
  if (!p.online) facts.push({ t: 'مقطوع', tone: 'warn' });
  return (
    <li className={`lby-p ${asking ? 'is-asking' : ''}`}>
      <div className="lby-p-main">
        <Paddle n={p.paddle} me={me} />
        <div className="lby-p-t">
          <span className="lby-p-name">{p.name}</span>
          {facts.length > 0 && <Facts items={facts} className="lby-p-facts" />}
        </div>
        {canKick && !asking && (
          <button type="button" className="lby-chalk lby-kick" onClick={onAsk} aria-label={`طلّع ${p.name}`}>
            طلّع
          </button>
        )}
      </div>
      {asking && (
        <div className="lby-ask" role="alert">
          <span>تطلّع {p.name} من الصالة؟</span>
          <div className="lby-ask-acts">
            <button type="button" className="lby-chalk" onClick={onCancel}>
              لا، خله
            </button>
            <button type="button" className="lby-danger" onClick={onKick}>
              إيه، طلّعه
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** The player's own voice switch, for nights where everyone plays from home. */
function VoiceRow() {
  const [on, setOn] = useState(sound.prefs.voice);
  if (on) return null;
  return (
    <button
      type="button"
      className="lby-row"
      onClick={() => {
        sound.unlock();
        sound.setPrefs({ voice: true });
        setOn(true);
      }}
    >
      <Icon name="sound" size={22} />
      <span className="lby-row-t">
        <b>شغّل صوت الدلال</b>
        <small>كل واحد ببيته؟ تسمعه من جوالك</small>
      </span>
    </button>
  );
}

/** The host's settings sheet: the market and every setting, the same fields Create shows. Changes apply at once. */
function SettingsSheet({ room, onClose }: { room: RoomView; onClose: () => void }) {
  useBack(true, onClose);
  const ref = useSheet<HTMLDivElement>(onClose);
  const core = room.snap.core!;
  const s = core.settings;
  const set = room.host!.settings;
  const n = core.players.filter((p) => !p.spectator).length;
  return (
    <Portal>
      <div className="drawer-back lby-sheet-back" onClick={onClose} />
      <div ref={ref} className="lby-sheet" role="dialog" aria-modal="true" aria-labelledby="lby-sheet-h" tabIndex={-1}>
        <div className="lby-sheet-head">
          <ScreenTitle as="h2" caption="الشباب يشوفون أي تغيير على طول">
            <span id="lby-sheet-h">شروط المزاد</span>
          </ScreenTitle>
        </div>
        <div className="lby-sheet-body">
          <section className="lby-sec" aria-labelledby="lby-sheet-mk">
            <h3 className="lby-h" id="lby-sheet-mk">
              سوق الليلة
            </h3>
            <MarketPicker value={s.mix} set={set} />
          </section>
          <SettingsFields s={s} set={set} players={n} />
        </div>
        <div className="lby-sheet-foot">
          <button type="button" className="btn btn-primary btn-block lby-go" onClick={onClose}>
            تمام
          </button>
        </div>
      </div>
    </Portal>
  );
}
