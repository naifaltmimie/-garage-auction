import { useEffect, useMemo, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Core, FinalResults, Sale } from '../../engine/types';
import { badgeOf, badgesOfNight, recordNight } from '../../lib/career';
import { money, signed } from '../../lib/util';
import type { RoomView } from '../useRoom';
import { ShareGarage } from './ShareGarage';

/** One award as the ceremony shows it. Derived on this phone from what the host published. */
export interface AwardItem {
  key: string;
  title: string;
  who: string;
  name: string;
  line: string;
  figure?: string;
  figureLabel?: string;
  tone?: 'gain' | 'loss';
  grand?: boolean;
}

const carName = (s: Sale) => `${s.car.makeAr} ${s.car.modelAr}`;

/** Only awards the night's data supports; the champion closes the show. */
export function computeAwards(core: Core, sales: Sale[], res: FinalResults): AwardItem[] {
  const nameOf = (id: string) => core.players.find((p) => p.id === id)?.name ?? '';
  const sold = sales.filter((s) => s.buyer && s.outcome === 'sold');
  const buyers = new Set(sold.map((s) => s.buyer!));
  const rows = res.rows;
  const host = new Map(res.awards.map((a) => [a.key, a]));
  const pool: (AwardItem & { pri: number; ord: number })[] = [];
  const add = (a: AwardItem, pri: number, ord: number) => {
    if (a.who && nameOf(a.who)) pool.push({ ...a, name: nameOf(a.who), pri, ord });
  };
  const uniqueTop = <T,>(xs: T[], f: (x: T) => number) => {
    const s = [...xs].sort((a, b) => f(b) - f(a));
    return s[0] && (s.length < 2 || f(s[0]) > f(s[1])) ? s[0] : null;
  };

  if (sold.length >= 2) {
    const cheap = [...sold].sort((a, b) => a.paid - b.paid)[0];
    add({ key: 'cheap', title: 'أبو لقطة', who: cheap.buyer!, name: '', line: `أرخص شروة بالليلة: ${carName(cheap)} ${cheap.car.year}`, figure: money(cheap.paid), figureLabel: 'دفع' }, 6, 1);
    const big = [...sold].sort((a, b) => b.paid - a.paid)[0];
    add({ key: 'whale1', title: 'الحوت', who: big.buyer!, name: '', line: `أغلى سيارة نزلت عليها المطرقة: ${carName(big)} ${big.car.year}`, figure: money(big.paid), figureLabel: 'دفع' }, 3, 7);
  }
  if (buyers.size >= 2) {
    const most = uniqueTop(rows.filter((r) => r.cars >= 2), (r) => r.cars);
    if (most) add({ key: 'dealer', title: 'الشريطي الذهبي', who: most.id, name: '', line: 'أكثر واحد شال سيارات', figure: String(most.cars), figureLabel: 'سيارات' }, 7, 2);
    const lux = uniqueTop(rows.filter((r) => r.cars > 0), (r) => r.value);
    if (lux) add({ key: 'luxury', title: 'ملك الفخامة', who: lux.id, name: '', line: 'أغلى كراج بالقيمة الحقيقية', figure: money(lux.value), figureLabel: 'قيمة الكراج' }, 4, 9);
  }
  const worst = [...sold].sort((a, b) => a.profit - b.profit)[0];
  if (worst && worst.profit < 0)
    add({ key: 'blunder', title: 'أغلى غلطة', who: worst.buyer!, name: '', line: `${carName(worst)} ${worst.car.year}: دفع ${money(worst.paid)} وقيمتها ${money(worst.value)}`, figure: money(-worst.profit), figureLabel: 'خسارة', tone: 'loss' }, 2, 6);
  const gems = sold.filter((s) => s.profit > 0 && s.paid > 0).sort((a, b) => b.value / b.paid - a.value / a.paid);
  if (gems[0]) {
    const g = gems[0];
    add({ key: 'deal', title: 'صفقة الليلة', who: g.buyer!, name: '', line: `${carName(g)} ${g.car.year}: دفع ${money(g.paid)} وقيمتها ${money(g.value)}`, figure: signed(g.profit), figureLabel: 'ربح', tone: 'gain' }, 1, 11);
  }
  // the host's titles that this list doesn't already cover
  const keep: [string, number, number][] = [['bargains', 5, 10], ['people', 5, 8], ['gambler', 8, 5], ['stubborn', 9, 3], ['saver', 9, 4], ['whale', 10, 7.5]];
  for (const [k, pri, ord] of keep) {
    const a = host.get(k);
    if (a) add({ key: `h_${k}`, title: a.title, who: a.who, name: '', line: a.detail }, pri, ord);
  }
  const champ = host.get('champion');
  const out = pool.sort((a, b) => a.pri - b.pri).slice(0, 8).sort((a, b) => a.ord - b.ord);
  if (champ && nameOf(champ.who)) out.push({ key: 'champion', title: champ.title, who: champ.who, name: nameOf(champ.who), line: 'أعلى نقاط بين الشطارة بالشراء وتقييم الشباب', figure: champ.detail.replace(/[^\d,]/g, ''), figureLabel: 'نقطة', grand: true, pri: 0, ord: 99 });
  return out.map(({ pri: _p, ord: _o, ...a }) => a);
}

/** Awards ceremony + this night saved to «سجلي» + «شارك كراجك». */
export function NightAwards({ room, ready }: { room: RoomView; ready: boolean }) {
  const core = room.snap.core!;
  const res = room.snap.hist?.results ?? null;
  const sales = room.snap.hist?.sales ?? [];
  // keyed on the results and sales only, so the core's frequent snapshots never restart the show
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => (res ? computeAwards(core, sales, res) : []), [res?.at, res?.awards.length, sales.length, core.players.length]);
  const total = items.length;
  const meRow = res?.rows.find((r) => r.id === room.myId) ?? null;
  const nightKey = `${room.code}:${core.startedAt || res?.at || 0}`;

  // save tonight to this phone's career, once per room + night
  const [night, setNight] = useState<{ badges: string[]; fresh: string[]; saved: boolean } | null>(null);
  useEffect(() => {
    if (!res || !meRow || room.spectator) return;
    try {
      const mine = sales.filter((s) => s.buyer === room.myId && s.outcome === 'sold');
      const best = [...mine].sort((a, b) => b.profit - a.profit)[0];
      const won = computeAwards(core, sales, res).filter((a) => a.who === room.myId).map((a) => a.title);
      if (mine.length >= 2 && mine.every((s) => s.profit >= 0)) won.push('__clean');
      const at = res.at || Date.now();
      const r = recordNight({
        key: nightKey,
        at,
        room: core.settings.roomName,
        rank: meRow.rank,
        players: res.rows.length,
        cars: meRow.cars,
        paid: meRow.paid,
        value: meRow.value,
        profit: meRow.profit,
        awards: won,
        best: best ? { name: carName(best), year: best.car.year, paid: best.paid, value: best.value, profit: best.profit } : null,
      });
      const rec = r.career.nights.find((n) => n.key === nightKey);
      setNight({ badges: badgesOfNight(r.career, rec?.at ?? at), fresh: r.fresh, saved: r.saved || !!rec });
    } catch {
      setNight(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nightKey, !!res, !!meRow]);

  // the ceremony: one envelope at a time, then the full list stays
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const over = skipped || step > total;
  useEffect(() => {
    if (!ready || over || total === 0) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 500 : items[step - 1]?.grand ? 3400 : 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, over, step, total]);
  useEffect(() => {
    if (!ready || skipped || step < 1 || step > total) return;
    try {
      if (items[step - 1]?.grand) sound.gavel(2);
      else sound.tock();
    } catch {
      /* sound is optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready, skipped, total]);

  if (!ready || !res) return null;
  const cur = !over && step >= 1 && step <= total ? items[step - 1] : null;
  const listed = over ? items : items.slice(0, Math.max(0, step - 1));
  const myTitles = items.filter((a) => a.who === room.myId).map((a) => a.title);
  const nightBadges = [...new Set([...myTitles, ...(night?.badges ?? []).map((k) => badgeOf(k)?.title).filter((x): x is string => !!x)])];

  return (
    <section className="aw" aria-label="جوائز الليلة">
      <header className="aw-head">
        <span className="aw-kicker">حفل الختام</span>
        <h2>جوائز الليلة</h2>
      </header>

      {total === 0 && <p className="aw-empty">ما انباعت سيارات تكفي لجوائز هالليلة.</p>}

      {!over && total > 0 && (
        <div className="aw-stage">
          <div className="aw-frame" aria-live="polite">
            {cur ? (
              <div className={`aw-card ${cur.grand ? 'grand' : ''}`} key={cur.key}>
                <span className="aw-count">
                  الجائزة <span className="ltr">{step}</span> من <span className="ltr">{total}</span>
                </span>
                <h3 className="aw-title">{cur.title}</h3>
                <i className="aw-rule" aria-hidden />
                <span className="aw-goes">تروح إلى</span>
                <b className="aw-name">
                  {cur.name}
                  {cur.who === room.myId && <em>أنت</em>}
                </b>
                {cur.figure && (
                  <span className={`aw-fig ${cur.tone ?? ''}`}>
                    <small>{cur.figureLabel}</small>
                    <span className="t-money">{cur.figure}</span>
                  </span>
                )}
                <p className="aw-line">{cur.line}</p>
              </div>
            ) : (
              <div className="aw-card aw-wait" key="wait">
                <span className="aw-count">الظرف الأول</span>
                <h3 className="aw-title">لحظة…</h3>
              </div>
            )}
          </div>
          <div className="aw-ctrl">
            <button className="btn btn-ghost" onClick={() => setStep((s) => Math.min(total + 1, s + 1))}>
              {step >= total ? 'خلّصنا' : 'الجائزة الجاية'}
            </button>
            <button className="btn btn-quiet" onClick={() => setSkipped(true)}>
              تخطَّ الحفل
            </button>
          </div>
        </div>
      )}

      {listed.length > 0 && (
        <ol className="aw-list">
          {listed.map((a, i) => (
            <li key={a.key} className={`aw-row ${a.grand ? 'grand' : ''} ${a.who === room.myId ? 'mine' : ''}`} style={{ animationDelay: over && skipped ? `${i * 0.05}s` : '0s' }}>
              <span className="aw-n ltr">{String(i + 1).padStart(2, '0')}</span>
              <div className="aw-row-body">
                <span className="aw-row-title">{a.title}</span>
                <b className="aw-row-name">
                  {a.name}
                  {a.who === room.myId && <em>أنت</em>}
                </b>
                <small>{a.line}</small>
              </div>
              {a.figure && (
                <span className={`aw-row-fig ${a.tone ?? ''}`}>
                  <small>{a.figureLabel}</small>
                  <span className="t-money">{a.figure}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {over && meRow && !room.spectator && (
        <div className="aw-mine">
          {nightBadges.length > 0 && (
            <div className="aw-badges">
              <span className="aw-badges-label">شاراتك الليلة</span>
              <div className="aw-badges-row">
                {nightBadges.map((b) => (
                  <span key={b} className={`aw-badge ${night?.fresh.some((k) => badgeOf(k)?.title === b) ? 'new' : ''}`}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <ShareGarage room={room} badges={nightBadges} />
          {night?.saved && <p className="aw-saved">انحفظت الليلة في «سجلي» على هالجوال</p>}
        </div>
      )}
    </section>
  );
}
