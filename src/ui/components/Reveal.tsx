// The hammer falls. The sale sheet answers, in this order: what happened (the stamp on the car), who got it and for
// how much (the paddle, one line, the final price tag), was it a good buy (the market value counting up, the
// difference, the verdict word), and, for the buyer only, what he paid (the receipt). The real listings the value
// came from close it. The stage clock lives in ../saleStage; nothing prints a number before its stage.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { VERDICT_LABEL } from '../../engine/rules';
import type { Comp, Core, PlayerPub, Sale } from '../../engine/types';
import { bidsN, km, money, signed } from '../../lib/util';
import { saleShown, useSaleStage, type SaleStage } from '../saleStage';
import { countRender } from './Console';
import { photoSrc } from './Gallery';
import { PriceTag } from './kit/PriceTag';
import { Receipt, type ReceiptRow } from './kit/Receipt';
import { RollNumber } from './kit/RollNumber';
import { Rows } from './kit/Rows';
import { Stamp, type StampKind } from './kit/Stamp';
import { Paddle } from './Plate';
import { Silhouette } from './Silhouette';
import { TireLoader } from './TireLoader';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The car's photo, the cover lifting off a covered car, and the stamp pressed on it once. */
function Photo({ sale, stamp, uncover }: { sale: Sale; stamp: { kind: StampKind; sub: string } | null; uncover: boolean }) {
  const photo = sale.car.photos?.[0];
  return (
    <div className={`srv-photo${stamp?.kind === 'unsold' ? ' is-unsold' : ''}`}>
      {photo ? (
        <img src={photoSrc(photo)} alt="" referrerPolicy="no-referrer" decoding="async" />
      ) : (
        <div className="srv-studio">
          <Silhouette body={sale.car.body} color={sale.car.colorHex} />
        </div>
      )}
      {uncover && <div className="srv-cover" aria-hidden />}
      {/* once stamped, the photo gives up most of its colour so the ink reads on any car, a red one included */}
      {stamp && <div className="srv-mute" aria-hidden />}
      {stamp && (
        <div className="srv-stamp">
          <Stamp kind={stamp.kind} sub={stamp.sub} />
        </div>
      )}
    </div>
  );
}

/** Who got it: the paddle, one line in Voice, how it went in Text, and the hammer on the final tag. */
function Buyer({ sale, buyer, mine }: { sale: Sale; buyer: PlayerPub | undefined; mine: boolean }) {
  const how = sale.approved
    ? 'صاحبها قال على البركة'
    : sale.kind === 'dutch'
      ? 'قال أبيها قبل الكل'
      : sale.sealedBids?.length
        ? sale.sealedBids.length === 1
          ? 'الظرف الوحيد'
          : `أعلى ظرف من ${sale.sealedBids.length}`
        : `بعد ${bidsN(sale.bids)}`;
  return (
    <div className={`srv-buyer${mine ? ' is-mine' : ''}`}>
      <div className="srv-who">
        {buyer && <Paddle n={buyer.paddle} me={mine} />}
        <div className="srv-who-t">
          <p className="srv-who-line">{mine ? 'مبروك، صارت لك' : `راحت لـ ${buyer?.name ?? 'واحد طلع'}`}</p>
          <p className="srv-who-how">{how}</p>
        </div>
      </div>
      <PriceTag state="final" label="رست على" amount={sale.hammer} compact mine={mine} className={`srv-tag${sale.hammer >= 1_000_000 ? ' is-wide' : ''}`} />
    </div>
  );
}

/** The value: blank while announced, then it counts up once (an odometer of a few eased steps); later changes
 *  (the surprise) roll straight to the new number. Reduced motion prints it finished. */
function CountRoll({ target }: { target: number }) {
  const [v, setV] = useState(() => (reduced() ? target : Math.round(target * 0.2)));
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || reduced()) {
      setV(target);
      counted.current = true;
      return;
    }
    counted.current = true;
    const steps = [0.38, 0.66, 0.84, 0.94, 1];
    const ids = steps.map((k, i) => window.setTimeout(() => setV(k === 1 ? target : Math.round(target * k)), 60 + i * 160));
    return () => ids.forEach(clearTimeout);
  }, [target]);
  return <RollNumber value={v} className="srv-value-n" />;
}

/** The verdict: «سعرها الصدق بالسوق», the value, the surprise if one lands, the signed difference and the word. */
function Verdict({ sale, stage, mine, buyerName }: { sale: Sale; stage: SaleStage; mine: boolean; buyerName: string }) {
  const shown = saleShown(sale, stage);
  const plateVal = sale.car.plate.special?.value ?? 0;
  const up = (shown.profit ?? 0) >= 0;
  const word = shown.settled ? VERDICT_LABEL[sale.verdict] : up ? 'ربح' : 'خسارة';
  const s = stage >= 3 ? sale.surprise : null;
  return (
    <section className="srv-verdict" aria-label="لقطة ولا لا">
      <p className={`srv-verdict-k${stage >= 1 ? ' is-on' : ''}`}>سعرها الصدق بالسوق</p>
      <div className="srv-value">
        {shown.value === null ? (
          <span className="srv-value-blank" aria-hidden />
        ) : (
          <>
            <CountRoll target={shown.value} />
            <span className="srv-value-u">ريال</span>
          </>
        )}
      </div>
      {s && (
        <p className="srv-surprise">
          <span className={`srv-mark ${s.good ? 'up' : 'down'}`}>{signed(s.delta)}</span>
          <span>
            <b>{s.good ? 'مفاجأة حلوة: ' : 'مفاجأة شينة: '}</b>
            {s.text}
          </span>
        </p>
      )}
      {/* the difference and the word land when the count does (CSS delay), never before */}
      <div className="srv-word-row" aria-live="polite">
        {shown.profit !== null && (
          <>
            <span className="srv-word">{word}</span>
            <span className={`srv-mark ${up ? 'up' : 'down'}`}>{signed(shown.profit)}</span>
            <span className="srv-word-who">{mine ? (up ? 'لك' : 'عليك') : up ? `لـ ${buyerName}` : `على ${buyerName}`}</span>
          </>
        )}
      </div>
      {shown.settled && shown.value !== null && (sale.roast || plateVal > 0) && (
        <p className="srv-roast">
          {sale.roast}
          {/* a special plate is part of the value: said as its own remark, not run into the roast */}
          {plateVal > 0 && (
            <span className="srv-plateval">
              {sale.roast ? ' · ' : ''}اللوحة لحالها <span className="ltr">{money(plateVal)}</span>
            </span>
          )}
        </p>
      )}
    </section>
  );
}

/** The sealed lead-in: every envelope opened in a ruled list, highest first, mine marked. */
function Envelopes({ core, sale, myId }: { core: Core; sale: Sale; myId: string }) {
  const all = sale.sealedBids ?? [];
  // the top three, and mine if it is further down
  const list = all.filter((b, i) => i < 3 || b.by === myId);
  const rest = all.length - list.length;
  return (
    <section className="srv-env" aria-label="فتح الظروف">
      <p className="srv-h">فتح الظروف</p>
      <ol className="srv-env-l">
        {list.map((b, i) => {
          const me = b.by === myId;
          return (
            <li key={b.by} className={`${i === 0 ? 'is-top' : ''}${me ? ' is-me' : ''}`} style={{ animationDelay: `${i * 0.4}s` }}>
              <span className="srv-env-who">
                {me ? 'ظرفك' : core.players.find((p) => p.id === b.by)?.name ?? 'واحد طلع'}
                {i === 0 && <small>أعلى ظرف</small>}
              </span>
              <span className="srv-env-n">{money(b.amount)}</span>
            </li>
          );
        })}
      </ol>
      {rest > 0 && <p className="srv-env-more">{rest === 1 ? 'وظرف ثاني أقل' : `و${rest} ظروف ثانية أقل`}</p>}
    </section>
  );
}

/** What the buyer paid: the receipt prints for him; everyone else reads one line. */
function Paid({ sale, mine }: { sale: Sale; mine: boolean }) {
  if (!mine) {
    return (
      <p className="srv-paid">
        دفع <span className="ltr">{money(sale.paid)}</span> مع السعي والضريبة
      </p>
    );
  }
  const rows: ReceiptRow[] = [{ label: 'سعر الرسو', amount: sale.hammer }];
  if (sale.fee > 0) rows.push({ label: 'السعي', amount: sale.fee });
  if (sale.vat > 0) rows.push({ label: 'الضريبة 15% على السعي', amount: sale.vat });
  if (sale.transfer > 0) rows.push({ label: 'نقل الملكية', amount: sale.transfer });
  return <Receipt no={sale.no} rows={rows} total={sale.paid} className="srv-rcpt" />;
}

/** The real listings this model was priced from: proof the number isn't made up. */
export function Comps({ comps, adUrl }: { comps?: Comp[]; adUrl?: string }) {
  if (!comps?.length && !adUrl) return null;
  return (
    <section className="srv-comps" aria-label="إعلانات حقيقية">
      {!!comps?.length && (
        <>
          <p className="srv-h">إعلانات حقيقية لنفس السيارة</p>
          <Rows
            className="srv-rows"
            items={comps.slice(0, 3).map((c) => ({
              k: [c[3], c[2], c[4], c[1] ? km(c[1]) : null].filter(Boolean).join('، '),
              v: money(c[0]),
              print: true,
            }))}
          />
        </>
      )}
      {adUrl && (
        // the car on the block is a real one: after the hammer, anyone can open its Haraj ad
        <a className="srv-ad" href={adUrl} target="_blank" rel="noopener noreferrer">
          افتح إعلانها الأصلي في حراج
        </a>
      )}
    </section>
  );
}

/** The sheet itself, and the one way back to it once it is put away to see the car. */
function Sheet({ label, mine, full, live, children }: { label: string; mine?: boolean; full?: boolean; live: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) {
    return (
      <button type="button" className="btn btn-dark srv-back" onClick={() => setHidden(false)}>
        رجّع النتيجة
      </button>
    );
  }
  return (
    <div className={`overlay srv-overlay${mine ? ' fx-mine' : ''}`} role="dialog" aria-label={label}>
      <div className={`srv${full ? ' is-full' : ''}`}>
        <p className="srv-sr" role="status">
          {live}
        </p>
        {children}
        {/* the way out stays in reach: a bar stuck to the sheet's foot, with a slot kept for the reactions switch */}
        <div className="srv-bar">
          <button type="button" className="btn btn-ghost btn-block srv-see" onClick={() => setHidden(true)}>
            شوف السيارة
          </button>
        </div>
      </div>
    </div>
  );
}

export function SoldReveal({ core, sale, myId, offset }: { core: Core; sale: Sale; myId: string; offset: number }) {
  countRender('sold');
  const stage = useSaleStage(core, sale, offset);
  const buyer = core.players.find((p) => p.id === sale.buyer);
  const mine = sale.buyer === myId;
  const sealed = !!sale.sealedBids?.length;
  const name = buyer?.name ?? 'واحد طلع';
  const live =
    stage < 0
      ? sealed
        ? 'نفتح الظروف'
        : 'نشيل الغطا'
      : mine
        ? `بيعت لك على ${money(sale.hammer)}`
        : `بيعت على ${name} بـ ${money(sale.hammer)}`;

  return (
    <Sheet label="نتيجة السيارة" mine={mine} full live={live}>
      <Photo
        sale={sale}
        uncover={stage < 0 && sale.kind === 'covered'}
        stamp={stage >= 0 ? { kind: mine ? 'mine' : 'sold', sub: `سيارة رقم ${sale.no}` } : null}
      />
      {sale.kind === 'covered' && (
        <p className="srv-car">
          {stage < 0 ? 'نشيل الغطا…' : (
            <>
              طلعت <b>{sale.car.makeAr} {sale.car.modelAr}</b> <span className="ltr">{sale.car.year}</span>، {km(sale.car.km)}
            </>
          )}
        </p>
      )}
      {stage >= 0 && <Buyer sale={sale} buyer={buyer} mine={mine} />}
      {stage >= 0 && <Verdict sale={sale} stage={stage} mine={mine} buyerName={name} />}
      {stage >= 2 && <Paid sale={sale} mine={mine} />}
      {/* the envelopes hold the sheet while they open; once the stamp falls, the buyer, the verdict and the
          receipt go above them */}
      {sealed && <Envelopes core={core} sale={sale} myId={myId} />}
      {stage >= 2 && <Comps comps={sale.comps} adUrl={sale.car.adUrl} />}
    </Sheet>
  );
}

export function UnsoldReveal({ core, sale }: { core: Core; sale: Sale }) {
  const who = core.players.find((p) => p.id === sale.highBy)?.name;
  const why =
    sale.outcome === 'reserve'
      ? 'ما وصلت الحد'
      : sale.outcome === 'declined'
        ? 'صاحبها قال يفتح الله'
        : sale.outcome === 'nobody'
          ? 'ما أحد يقدر عليها'
          : 'ما أحد سام عليها';
  const high = sale.highBid ?? 0;
  const rows = [
    ...(high > 0 ? [{ k: who ? `أعلى سوم، عند ${who}` : 'أعلى سوم', v: money(high), print: true }] : []),
    { k: 'قيمتها حول', v: money(sale.base), print: true },
  ];
  return (
    <Sheet label="ما بيعت" live={`ما بيعت، ${why}`}>
      <Photo sale={sale} uncover={false} stamp={{ kind: 'unsold', sub: `سيارة رقم ${sale.no}` }} />
      <div className="srv-unsold">
        <p className="srv-why">{why}</p>
        <p className="srv-back-to">ترجع لصاحبها</p>
      </div>
      <Rows className="srv-rows" items={rows} />
    </Sheet>
  );
}

export function ApprovalReveal({ core }: { core: Core }) {
  const who = core.players.find((p) => p.id === core.bid?.by)?.name;
  return (
    <div className="overlay srv-overlay" role="dialog" aria-label="بانتظار موافقة صاحب السيارة">
      <div className="srv srv-wait">
        <TireLoader className="srv-wait-tire" size={46} />
        <p className="srv-wait-t" role="status">
          صاحب السيارة يفكّر
        </p>
        <PriceTag state="live" label={who ? `وقف السوم عند ${who}` : 'وقف السوم على'} amount={core.bid?.amount ?? 0} compact className="srv-tag" />
        <p className="srv-wait-sub">ما وصل الحد. يا يقول على البركة، يا يفتح الله</p>
      </div>
    </div>
  );
}
