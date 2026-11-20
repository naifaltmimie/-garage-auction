// «الحساب» as a thermal receipt: white paper coming out of a dark printer slit, black print, dashed rules,
// a torn zigzag bottom. It feeds out of the slit once when it mounts; remount it to print again.
// The serrated edge (a conic-gradient tooth repeated along a mask) and the feed out of a slot are ported from
// "Kokonut UI Receipt Printer" (kokonutUI, MIT) on 21st.dev, as plain CSS with no physics.
import { money } from '../../../lib/util';

export type ReceiptRow = { label: string; amount: number | string };

export function Receipt({
  no,
  rows,
  total,
  note,
  className,
}: {
  no: number;
  rows: ReceiptRow[];
  total: number | string;
  note?: string;
  className?: string;
}) {
  const fmt = (v: number | string) => (typeof v === 'number' ? money(v) : v);
  return (
    <div className={`rcpt${className ? ` ${className}` : ''}`}>
      <div className="rcpt-slit" aria-hidden />
      <div className="rcpt-feed">
        <div className="rcpt-paper">
          <div className="rcpt-head">
            <span className="rcpt-title">الحساب</span>
            <span className="rcpt-no">#{String(no).padStart(4, '0')}</span>
          </div>
          <dl className="rcpt-rows">
            {rows.map((r, i) => (
              <div className="rcpt-row" key={i}>
                <dt>{r.label}</dt>
                <dd>{fmt(r.amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="rcpt-total">
            <span>الإجمالي</span>
            <span className="rcpt-total-n">{fmt(total)}</span>
          </div>
          {note && <p className="rcpt-note">{note}</p>}
        </div>
      </div>
    </div>
  );
}
