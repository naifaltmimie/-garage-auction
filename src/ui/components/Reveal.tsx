import { useEffect, useState } from 'react';
import { VERDICT_LABEL } from '../../engine/rules';
import type { Comp, Core, Sale } from '../../engine/types';
import { km, money, signed } from '../../lib/util';
import { useNow } from '../useRoom';
import { photoSrc } from './Gallery';
import { CarTitle } from './LotSheet';
import { CarPlate, Paddle } from './Plate';
import { Silhouette } from './Silhouette';

function useCount(target: number, run: boolean, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) {
      setV(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(target * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function Hero({ sale, stamp, grey }: { sale: Sale; stamp: string; grey?: boolean }) {
  const photo = sale.car.photos?.[0];
  return (
    <div className={`rv-hero ${grey ? 'grey' : ''}`}>
      {photo ? <img src={photoSrc(photo)} alt="" referrerPolicy="no-referrer" /> : <div className="rv-studio"><Silhouette body={sale.car.body} color={sale.car.colorHex} /></div>}
      <div className="rv-stamp">
        <span>{stamp}</span>
        <small className="ltr">LOT {String(sale.no).padStart(2, '0')}</small>
      </div>
    </div>
  );
}

const VERDICT_TONE: Record<Sale['verdict'], string> = { steal: 'good', good: 'good', fair: 'flat', over: 'bad', robbed: 'bad' };

export function SoldReveal({ core, sale, myId, offset }: { core: Core; sale: Sale; myId: string; offset: number }) {
  const now = useNow(offset, 10);
  const t = core.timer;
  const start = t ? t.endsAt - t.total : now;
  const el = core.paused ? 99_999 : Math.max(0, now - start);
  const sealed = !!sale.sealedBids?.length;
  const shift = sealed ? 2400 : 0;
  const stage = el < shift ? -1 : el < shift + 1300 ? 0 : el < shift + 2700 ? 1 : el < shift + 5200 ? 2 : 3;
  const buyer = core.players.find((p) => p.id === sale.buyer);
  const mine = sale.buyer === myId;
  const before = sale.value - (sale.surprise?.delta ?? 0);
  const shownValue = stage >= 3 || !sale.surprise ? sale.value : before;
  const counted = useCount(shownValue, stage >= 2);
  const profitShown = shownValue - sale.paid;
  const tone = stage >= 3 || !sale.surprise ? VERDICT_TONE[sale.verdict] : profitShown >= 0 ? 'good' : 'bad';
  const [hidden, setHidden] = useState(false);
  const plateVal = sale.car.plate.special?.value ?? 0;

  if (hidden) {
    return (
      <button className="btn btn-dark rv-back" onClick={() => setHidden(false)}>
        رجّع النتيجة
      </button>
    );
  }
  return (
    <div className="overlay" role="dialog" aria-label="نتيجة اللوت">
      <div className="reveal">
        {sealed && (
          <div className="rv-sec">
            <h4>فتح الظروف</h4>
            <ul className="envelopes">
              {sale.sealedBids!.map((b, i) => (
                <li key={b.by} className={i === 0 ? 'win' : ''} style={{ animationDelay: `${i * 0.35}s` }}>
                  <span>{b.by === myId ? 'أنت' : core.players.find((p) => p.id === b.by)?.name}</span>
                  <b className="ltr">{money(b.amount)}</b>
                </li>
              ))}
            </ul>
          </div>
        )}

        {stage >= 0 && (
          <>
            <Hero sale={sale} stamp="بيعت" />
            <div className="rv-buyer">
              {buyer && <Paddle n={buyer.paddle} me={mine} />}
              <div>
                <b>{mine ? 'مبروك، صارت لك' : `على ${buyer?.name ?? ''}`}</b>
                <small>{sale.approved ? 'صاحبها قال على البركة' : `${sale.bids} سوم`}</small>
              </div>
              <div className="rv-hammer">
                <small>سعر الرسو</small>
                <b className="t-money">{money(sale.hammer)}</b>
              </div>
            </div>
          </>
        )}

        {stage >= 1 && sale.kind === 'covered' && (
          <div className="rv-sec">
            <h4>تحت الغطا طلعت</h4>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <CarTitle car={sale.car} compact />
              <CarPlate plate={sale.car.plate} size="sm" />
            </div>
            <div className="mute small">{km(sale.car.km)}، {sale.car.spec}</div>
          </div>
        )}

        {stage >= 1 && (
          <div className="rv-sec slip">
            <h4>
              <span>كشف التسوية</span>
              <span className="ltr mute">#{String(sale.no).padStart(4, '0')}</span>
            </h4>
            <dl>
              <dt>سعر الرسو</dt>
              <dd>{money(sale.hammer)}</dd>
              {sale.fee > 0 && (
                <>
                  <dt>السعي</dt>
                  <dd>{money(sale.fee)}</dd>
                </>
              )}
              {sale.vat > 0 && (
                <>
                  <dt>ضريبة القيمة المضافة 15% على السعي</dt>
                  <dd>{money(sale.vat)}</dd>
                </>
              )}
              {sale.transfer > 0 && (
                <>
                  <dt>رسوم نقل الملكية</dt>
                  <dd>{money(sale.transfer)}</dd>
                </>
              )}
              <dt className="total">الإجمالي</dt>
              <dd className="total">{money(sale.paid)}</dd>
            </dl>
          </div>
        )}

        {stage >= 2 && (
          <div className={`rv-truth tone-${tone}`}>
            <small>القيمة الحقيقية بالسوق</small>
            <b className="t-money">{money(counted)}</b>
            {plateVal > 0 && <span className="mute small">منها اللوحة {money(plateVal)}</span>}
            <span className={`verdict tone-${tone}`}>
              {stage >= 3 || !sale.surprise ? VERDICT_LABEL[sale.verdict] : profitShown >= 0 ? 'ربح' : 'خسارة'}
              <b className="ltr">{signed(profitShown)}</b>
            </span>
            {(stage >= 3 || !sale.surprise) && <div className="roast">{sale.roast}</div>}
          </div>
        )}

        {stage >= 3 && sale.surprise && (
          <div className={`surprise ${sale.surprise.good ? 'good' : 'bad'}`}>
            <small>{sale.surprise.good ? 'مفاجأة حلوة' : 'مفاجأة بعد البيع'}</small>
            <p>{sale.surprise.text}</p>
            <b className="ltr">{signed(sale.surprise.delta)}</b>
          </div>
        )}

        {stage >= 2 && <Comps comps={sale.comps} />}

        <button className="btn btn-ghost btn-block" onClick={() => setHidden(true)}>
          رجوع للتقرير
        </button>
      </div>
    </div>
  );
}

/** The real listings this model was priced from — proof the number isn't made up. */
export function Comps({ comps }: { comps?: Comp[] }) {
  if (!comps?.length) return null;
  return (
    <div className="rv-sec comps">
      <h4>
        <span>إعلانات حقيقية لنفس السيارة</span>
      </h4>
      <ul>
        {comps.slice(0, 3).map((c, i) => (
          <li key={i}>
            <span>{[c[3], c[2], c[4], c[1] ? km(c[1]) : null].filter(Boolean).join('، ')}</span>
            <b className="ltr">{money(c[0])}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UnsoldReveal({ core, sale }: { core: Core; sale: Sale }) {
  const who = core.players.find((p) => p.id === sale.highBy)?.name;
  const line =
    sale.outcome === 'reserve'
      ? `ما وصلت الحد. أعلى سوم ${money(sale.highBid ?? 0)}${who ? ` عند ${who}` : ''}`
      : sale.outcome === 'declined'
        ? `صاحبها قال يفتح الله. وقفت على ${money(sale.highBid ?? 0)}`
        : sale.outcome === 'nobody'
          ? 'ما أحد يقدر عليها، ترجع للمعرض'
          : 'ما أحد سام عليها';
  return (
    <div className="overlay" role="dialog" aria-label="ما بيعت">
      <div className="reveal">
        <Hero sale={sale} stamp="ما بيعت" grey />
        <div className="rv-sec">
          <p className="rv-line">{line}</p>
          <p className="mute small" style={{ margin: 0 }}>
            القيمة كانت حول <b className="ltr">{money(sale.base)}</b>، ورجعت لصاحبها
          </p>
        </div>
      </div>
    </div>
  );
}

export function ApprovalReveal({ core }: { core: Core }) {
  const who = core.players.find((p) => p.id === core.bid?.by)?.name;
  return (
    <div className="overlay" role="dialog" aria-label="بانتظار موافقة البائع">
      <div className="reveal thinking">
        <div className="rv-think">
          <span className="dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <b>صاحب السيارة يفكّر</b>
        </div>
        <p className="rv-line">
          السوم وقف على <b className="ltr">{money(core.bid?.amount ?? 0)}</b> عند {who}
        </p>
        <p className="mute small" style={{ margin: 0 }}>ما وصل الحد، يا يقول على البركة يا يفتح الله</p>
      </div>
    </div>
  );
}
