import { useState } from 'react';
import { sound } from '../../audio/sound';
import { CATALOGUE } from '../../data/catalogue';
import { marketDepth } from '../../engine/lotgen';
import { BUDGETS, GARAGE_SIZES, lotsFor } from '../../engine/rules';
import { MARKETS } from '../../engine/markets';
import type { Mix, Speed } from '../../engine/types';
import { carsN, money } from '../../lib/util';
import { Icon, QR } from '../components/Bits';
import { MiniPlate, Paddle } from '../components/Plate';
import type { RoomView } from '../useRoom';

const SPEED_AR: Record<Speed, string> = { fast: 'سريع', normal: 'عادي', calm: 'هادي' };
const MIX_AR = Object.fromEntries(MARKETS.map((x) => [x.id, x.label])) as Record<Mix, string>;

export function Lobby({ room }: { room: RoomView }) {
  const core = room.snap.core!;
  const s = core.settings;
  const link = `${location.origin}/#/r/${room.code}`;
  const [copied, setCopied] = useState(false);
  const [edit, setEdit] = useState(false);
  const active = core.players.filter((p) => !p.spectator);
  const host = core.players.find((p) => p.host);
  const msg = `🔨 ${s.roomName || 'مزاد الكراج'} فاتح الحين\nادخل الصالة وسُم معنا:\n${link}\nكود الصالة: ${room.code}`;

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
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <main className="shell" style={{ maxWidth: 980 }}>
      <div className="stack" style={{ gap: 14 }}>
        <div className="rise" style={{ textAlign: 'center', paddingTop: 4 }}>
          <span className="chip chip-green">
            <i className="dot" /> الصالة مفتوحة
          </span>
          <h1 className="section-title" style={{ fontSize: 'clamp(32px, 9vw, 46px)', marginTop: 8 }}>{s.roomName || 'مزاد الكراج'}</h1>
        </div>

        <div className="lobby-grid">
          <section className="card codebox">
            <div className="t-label">كود الصالة</div>
            <div className="code">{room.code}</div>
            <QR text={link} />
            <div className="share-row">
              <button className="btn btn-primary" onClick={share}>
                <Icon name="share" /> أرسل الرابط للشباب
              </button>
              <button className="btn btn-ghost" onClick={copy} aria-label="انسخ الرابط">
                <Icon name="copy" /> {copied ? 'تم' : 'نسخ'}
              </button>
            </div>
            <small className="mute">اللي جنبك يصوّر الكود، واللي بعيد ترسل له الرابط</small>
          </section>

          <div className="stack" style={{ gap: 14 }}>
            <section className="card card-pad">
              <div className="card-head">
                <h2>المزايدين</h2>
                <span className="chip">
                  <span className="ltr">
                    {active.length}/{s.maxPlayers}
                  </span>
                </span>
              </div>
              <div className="players">
                {core.players.map((p) => (
                  <div className="player-row" key={p.id}>
                    <Paddle n={p.paddle} me={p.id === room.myId} />
                    <div className="grow">
                      <div className="name">
                        {p.name} {p.id === room.myId && <span className="mute small">(أنت)</span>}
                      </div>
                      <div className="row" style={{ gap: 6, marginTop: 2 }}>
                        <MiniPlate letters={p.plate} />
                        {p.host && <span className="chip chip-gold">الدلال</span>}
                        {p.spectator && <span className="chip">متفرج</span>}
                      </div>
                    </div>
                    <span className={`netdot ${p.online ? '' : 'off'}`} title={p.online ? 'متصل' : 'غير متصل'} />
                    {room.host && !p.host && (
                      <button className="btn btn-quiet" style={{ color: 'var(--red)' }} onClick={() => room.host!.kick(p.id)} aria-label={`طلّع ${p.name}`}>
                        طلّع
                      </button>
                    )}
                  </div>
                ))}
                {active.length < 2 && <div className="empty-slot">بانتظار الشباب يدخلون…</div>}
              </div>
            </section>

            <section className="card card-pad">
              <div className="card-head">
                <h2>شروط المزاد</h2>
                {room.host && (
                  <button className="btn btn-quiet" onClick={() => setEdit(true)}>
                    عدّل
                  </button>
                )}
              </div>
              <dl className="settings-list">
                <div>
                  <dt>ميزانية كل لاعب</dt>
                  <dd className="t-money" style={{ fontSize: 19 }}>{money(s.budget)}</dd>
                </div>
                <div>
                  <dt>الكراج</dt>
                  <dd>{carsN(s.garage)}</dd>
                </div>
                <div>
                  <dt>السيارات بالمزاد</dt>
                  <dd>{carsN(Math.max(1, Math.min(lotsFor(s, active.length), marketDepth(s, CATALOGUE))))}</dd>
                </div>
                <div>
                  <dt>السرعة والسوق</dt>
                  <dd>
                    {SPEED_AR[s.speed]}، {MIX_AR[s.mix]}
                  </dd>
                </div>
                <div>
                  <dt>تقدير الدلال</dt>
                  <dd>{s.estimate ? 'يظهر' : 'مخفي'}</dd>
                </div>
                <div>
                  <dt>السعي</dt>
                  <dd>{s.fee > 0 ? <><span className="ltr">{s.fee}%</span> وضريبتها</> : 'بدون'}</dd>
                </div>
                <div>
                  <dt>أنواع اللوتات</dt>
                  <dd>{['علني', s.covered ? 'تحت الغطا' : null, s.sealed ? 'ظرف مختوم' : null].filter(Boolean).join('، ')}</dd>
                </div>
                <div>
                  <dt>النتيجة</dt>
                  <dd>
                    <span className="ltr">{Math.round(s.ratingWeight * 100)}%</span> تقييم، <span className="ltr">{Math.round((1 - s.ratingWeight) * 100)}%</span> شطارة
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        </div>

        {room.role === 'player' && !sound.prefs.voice && (
          <div className="card card-pad row between">
            <span className="mute" style={{ fontWeight: 700 }}>كل واحد ببيته؟ شغّل صوت الدلال على جوالك</span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                sound.unlock();
                sound.setPrefs({ voice: true });
              }}
            >
              شغّل الصوت
            </button>
          </div>
        )}

        {room.host ? (
          <div className="stack" style={{ gap: 6 }}>
            <button
              className="btn btn-gold btn-block"
              style={{ minHeight: 60, fontSize: 19 }}
              onClick={() => {
                sound.unlock();
                room.host!.start();
              }}
            >
              {active.length < 2 ? 'ابدأ تجربة لحالك' : 'ابدأ المزاد'}
            </button>
            <small className="mute" style={{ textAlign: 'center' }}>خل جوالك مفتوح على الصفحة، المزاد يمشي من عندك</small>
          </div>
        ) : (
          <div className="card card-pad" style={{ textAlign: 'center' }}>
            <div className="t-display" style={{ fontSize: 24 }}>بانتظار {host?.name ?? 'المضيف'} يبدأ المزاد</div>
            <small className="mute">جهّز نفسك، أول سيارة بتطلع أول ما يضغط ابدأ</small>
          </div>
        )}
      </div>

      {edit && room.host && <SettingsDrawer room={room} onClose={() => setEdit(false)} />}
    </main>
  );
}

function SettingsDrawer({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const s = room.snap.core!.settings;
  const set = room.host!.settings;
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="شروط المزاد">
        <h3>شروط المزاد</h3>
        <div className="stack">
          <div className="markets markets-compact" role="radiogroup" aria-label="سوق الليلة">
            {MARKETS.map((m) => (
              <button type="button" key={m.id} role="radio" className="market" aria-checked={s.mix === m.id} onClick={() => set({ mix: m.id, budget: m.budget })}>
                <b>{m.label}</b>
              </button>
            ))}
          </div>
          <div className="budgets">
            {BUDGETS.map((b) => (
              <button type="button" key={b.key} className="budget" aria-pressed={s.budget === b.amount} onClick={() => set({ budget: b.amount })}>
                <b>{b.label}</b>
                <span className="t-money">{money(b.amount)}</span>
              </button>
            ))}
          </div>
          <div className="seg">
            {GARAGE_SIZES.map((n) => (
              <button key={n} aria-pressed={s.garage === n} onClick={() => set({ garage: n })} aria-label={`كراج ${n} سيارات`}>
                {n}
              </button>
            ))}
          </div>
          <div className="seg">
            {(['fast', 'normal', 'calm'] as Speed[]).map((k) => (
              <button key={k} aria-pressed={s.speed === k} onClick={() => set({ speed: k })}>
                {SPEED_AR[k]}
              </button>
            ))}
          </div>
          <div className="seg">
            {[0, 12, 16, 20, 24, 30].map((n) => (
              <button key={n} aria-pressed={s.lots === n} onClick={() => set({ lots: n })}>
                {n ? n : 'تلقائي'}
              </button>
            ))}
          </div>
          <div className="seg">
            <button aria-pressed={s.estimate} onClick={() => set({ estimate: !s.estimate })}>التقدير {s.estimate ? 'يظهر' : 'مخفي'}</button>
            <button aria-pressed={s.covered} onClick={() => set({ covered: !s.covered })}>تحت الغطا</button>
            <button aria-pressed={s.sealed} onClick={() => set({ sealed: !s.sealed })}>ظرف مختوم</button>
            <button aria-pressed={s.fee > 0} onClick={() => set({ fee: s.fee > 0 ? 0 : 2.5 })}>السعي</button>
          </div>
          <button className="btn btn-primary btn-block" onClick={onClose}>تمام</button>
        </div>
      </div>
    </>
  );
}
