import { useEffect, useMemo, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Core, FinalResults, Sale } from '../../engine/types';
import { badgeOf, badgesOfNight, recordNight } from '../../lib/career';
import { money, signed } from '../../lib/util';
import { Portal } from './Bits';
import { Facts } from './kit/Facts';
import type { RoomView } from '../useRoom';

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
  /** importance: lower reads first when the ceremony is trimmed */
  pri?: number;
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
    add({ key: 'whale1', title: 'الحوت', who: big.buyer!, name: '', line: `أغلى سيارة رست بالليلة: ${carName(big)} ${big.car.year}`, figure: money(big.paid), figureLabel: 'دفع' }, 3, 7);
  }
  if (buyers.size >= 2) {
    const most = uniqueTop(rows.filter((r) => r.cars >= 2), (r) => r.cars);
    if (most) add({ key: 'dealer', title: 'شيخ الشريطية', who: most.id, name: '', line: 'أكثر واحد شال سيارات', figure: String(most.cars), figureLabel: 'سيارات' }, 7, 2);
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
  if (champ && nameOf(champ.who)) out.push({ key: 'champion', title: champ.title, who: champ.who, name: nameOf(champ.who), line: 'أعلى نقاط من الشطارة وتقييم الشباب', figure: champ.detail.replace(/[^\d,]/g, ''), figureLabel: 'نقطة', grand: true, pri: 0, ord: 99 });
  return out.map(({ ord: _o, ...a }) => a);
}

/** The first award waits this long after the champion lands, so his moment is his own. */
const FIRST_MS = 2600;

export interface NightAwardsState {
  items: AwardItem[];
  /** the awards the ceremony opens one by one (five at most, the champion last) */
  stage: AwardItem[];
  /** the awards that only go to the list */
  rest: AwardItem[];
  /** 0 before the first envelope, 1..total during it, total + 1 after */
  step: number;
  total: number;
  running: boolean;
  over: boolean;
  skip: () => void;
  next: () => void;
  /** this player's titles and badges tonight */
  badges: string[];
  fresh: string[];
  saved: boolean;
}

/** The night's awards, the ceremony's clock, and tonight saved to «سجلي» on this phone (once per room and night). */
export function useNightAwards(room: RoomView, ready: boolean): NightAwardsState {
  const core = room.snap.core!;
  const res = room.snap.hist?.results ?? null;
  const sales = room.snap.hist?.sales ?? [];
  // keyed on the results and sales only, so the core's frequent snapshots never restart the show
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const items = useMemo(() => (res ? computeAwards(core, sales, res) : []), [res?.at, res?.awards.length, sales.length, core.players.length]);
  const stage = useMemo(() => {
    if (items.length <= 5) return items;
    const top = new Set([...items].sort((a, b) => (a.pri ?? 0) - (b.pri ?? 0)).slice(0, 5).map((a) => a.key));
    return items.filter((a) => top.has(a.key));
  }, [items]);
  const rest = useMemo(() => items.filter((a) => !stage.includes(a)), [items, stage]);
  const total = stage.length;
  const meRow = res?.rows.find((r) => r.id === room.myId) ?? null;
  const nightKey = `${room.code}:${core.startedAt || res?.at || 0}`;

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

  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const over = skipped || step > total || (ready && total === 0);
  useEffect(() => {
    if (!ready || over || total === 0) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? FIRST_MS : stage[step - 1]?.grand ? 2400 : 1600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, over, step, total]);
  useEffect(() => {
    if (!ready || skipped || step < 1 || step > total) return;
    try {
      if (stage[step - 1]?.grand) sound.gavel(2);
      else sound.tock();
    } catch {
      /* sound is optional */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready, skipped, total]);

  const myTitles = items.filter((a) => a.who === room.myId).map((a) => a.title);
  const freshTitles = (night?.fresh ?? []).map((k) => badgeOf(k)?.title).filter((x): x is string => !!x);
  const badges = [...new Set([...myTitles, ...(night?.badges ?? []).map((k) => badgeOf(k)?.title).filter((x): x is string => !!x)])];
  return {
    items,
    stage,
    rest,
    step,
    total,
    running: ready && !over && total > 0,
    over: ready && over,
    skip: () => setSkipped(true),
    next: () => setStep((s) => Math.min(total + 1, s + 1)),
    badges,
    fresh: freshTitles,
    saved: !!night?.saved,
  };
}

/** One award filling the screen (from the first envelope on; the champion keeps the screen until then): its name in the voice, who won it, the figure in print, one line of why.
 *  A tap anywhere opens the next envelope. */
export function AwardStage({ aw, myId }: { aw: NightAwardsState; myId: string }) {
  const cur = aw.step >= 1 && aw.step <= aw.total ? aw.stage[aw.step - 1] : null;
  if (!aw.running || !cur) return null;
  return (
    <Portal>
      <div className="e-stage" aria-live="polite">
        <button type="button" className="e-stage-tap" onClick={aw.next} aria-label={aw.step >= aw.total ? 'خلّصنا' : 'الجائزة الجاية'} />
        <div className={`e-stage-aw${cur.grand ? ' is-grand' : ''}`} key={cur.key}>
          <h2 className="e-stage-title">{cur.title}</h2>
          <p className="e-stage-name">
            {cur.name}
            {cur.who === myId && <span className="e-you">أنت</span>}
          </p>
          {cur.figure && (
            <p className={`e-stage-fig${cur.tone === 'gain' ? ' is-up' : ''}`}>
              <b className="print ltr">{cur.figure}</b>
              <small>{cur.figureLabel}</small>
            </p>
          )}
          <p className="e-stage-line">{cur.line}</p>
          <p className="e-stage-count">
            الجائزة <span className="print ltr">{aw.step}</span> من <span className="print ltr">{aw.total}</span>
          </p>
        </div>
      </div>
    </Portal>
  );
}

/** The night's awards as one ruled list, then this player's badges and the «سجلي» note. */
export function AwardsList({ aw, myId, spectator }: { aw: NightAwardsState; myId: string; spectator: boolean }) {
  if (!aw.over) return null;
  const all = [...aw.stage, ...aw.rest];
  return (
    <section className="e-awards" aria-label="جوايز الليلة">
      <h2 className="e-sec-h">جوايز الليلة</h2>
      {all.length === 0 ? (
        <p className="e-awards-empty">ما انباعت سيارات تكفي لجوايز هالليلة.</p>
      ) : (
        <ul className="e-aw-list">
          {all.map((a) => (
            <li key={a.key} className={`e-aw${a.who === myId ? ' is-mine' : ''}`}>
              <div className="e-aw-t">
                <b className="e-aw-title">{a.title}</b>
                <span className="e-aw-name">
                  {a.name}
                  {a.who === myId && <span className="e-you">أنت</span>}
                </span>
              </div>
              {a.figure && (
                <span className="e-aw-fig">
                  <b className={`print ltr${a.tone === 'gain' ? ' is-up' : ''}`}>{a.figure}</b>
                  <small>{a.figureLabel}</small>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!spectator && aw.badges.length > 0 && (
        <div className="e-badges">
          <h3 className="e-badges-h">شاراتك الليلة</h3>
          <Facts items={aw.badges.map((b) => (aw.fresh.includes(b) ? { t: `${b} (جديدة)`, tone: 'good' as const } : b))} />
        </div>
      )}
      {!spectator && aw.saved && <p className="e-saved">انحفظت الليلة في «سجلي» على هالجوال</p>}
    </section>
  );
}
