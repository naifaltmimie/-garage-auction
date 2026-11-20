// The players sheet: every bidder as a ruled row (rank, paddle, name, cars, what he has left, his revealed gain),
// a tap opens his garage in place. For the sale being revealed it shows exactly what the reveal shows at that
// moment (saleShown), and every older sale settled. Styles: src/styles/s-shell.css (prefix shl-).
import { useState } from 'react';
import type { Sale } from '../../engine/types';
import { money, signed } from '../../lib/util';
import { useBack } from '../App';
import { Icon } from '../components/Bits';
import { GarageCard } from '../components/Garage';
import { Paddle } from '../components/Plate';
import { ShellSheet } from '../components/RoomMenu';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { saleShown, useSaleStage, type SaleStage } from '../saleStage';
import type { RoomView } from '../useRoom';

const END = ['showcase', 'voting', 'results'];
/** stands in for the sale on the block when nothing is being revealed, so the stage hook always runs */
const NO_SALE = { kind: 'open' as const, sealedBids: undefined };

/**
 * The sales as this moment allows them to be seen. The sale on the block: before the stamp (stage -1) it is not
 * there at all and its price is still in the buyer's pocket; at stages 0 and 1 its value is a secret; at stage 2 it
 * carries the value before the surprise; from stage 3 it is final.
 */
function useShownSales(room: RoomView) {
  const core = room.snap.core!;
  const sales = room.snap.hist?.sales ?? [];
  const last = sales.length ? sales[sales.length - 1] : null;
  const lot = room.snap.lot;
  const onBlock = core.phase === 'sold' && last && last.buyer && lot && last.lotId === lot.id ? last : null;
  const stage: SaleStage = useSaleStage(core, onBlock ?? NO_SALE, room.offset);
  if (!onBlock || stage >= 3) return { sales, secret: null as Sale | null, hidden: null as Sale | null };
  if (stage < 0) return { sales: sales.slice(0, -1), secret: null, hidden: onBlock };
  if (stage < 2) return { sales, secret: onBlock, hidden: null };
  const shown = saleShown(onBlock, stage);
  const patched: Sale = { ...onBlock, value: shown.value!, profit: shown.profit!, surprise: null };
  return { sales: [...sales.slice(0, -1), patched], secret: null, hidden: null };
}

export function Standings({ room, onClose }: { room: RoomView; onClose: () => void }) {
  const core = room.snap.core!;
  const { sales, secret, hidden } = useShownSales(room);
  const [open, setOpen] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  // back steps out: a confirm, then a garage, then the sheet
  useBack(true, () => (ask ? setAsk(false) : open ? setOpen(null) : onClose()));
  const slots = core.settings.garage;
  const ended = END.includes(core.phase);
  const rows = core.players
    .filter((p) => !p.spectator)
    .map((p) => {
      const mine = sales.filter((s) => s.buyer === p.id);
      const counted = mine.filter((s) => s !== secret);
      const profit = counted.reduce((a, s) => a + s.profit, 0);
      // before the stamp the buyer's money still reads as it was
      const cash = hidden && hidden.buyer === p.id ? p.cash + hidden.paid : p.cash;
      return { p, cars: mine.length, profit, cash, any: counted.length > 0, pending: !!secret && secret.buyer === p.id };
    })
    .sort((a, b) => b.profit - a.profit);
  const watchers = core.players.filter((p) => p.spectator);
  const sel = rows.find((r) => r.p.id === open);
  const anySold = sales.length > 0;

  const close = (
    <button type="button" className="btn btn-quiet btn-block shl-close" onClick={onClose}>
      سكّر
    </button>
  );

  if (sel) {
    const canKick = !!room.host && !sel.p.host && !ended;
    return (
      <ShellSheet label={`كراج ${sel.p.name}`} onClose={onClose} step={`g-${sel.p.id}`} foot={close}>
        <button
          type="button"
          className="shl-chalk shl-back"
          onClick={() => {
            setAsk(false);
            setOpen(null);
          }}
        >
          <Icon name="back" size={18} />
          رجوع للترتيب
        </button>
        <GarageCard p={sel.p} sales={sales} slots={slots} me={sel.p.id === room.myId} hideValues={!!secret && secret.buyer === sel.p.id} />
        {canKick &&
          (ask ? (
            <div className="shl-ask" role="group" aria-label={`تطلّع ${sel.p.name}؟`} ref={(el) => el?.scrollIntoView({ block: 'nearest' })}>
              <p>يصير {sel.p.name} متفرج، وتنشال سوماته وظروفه. فلوسه وكراجه تبقى مثل ما هي.</p>
              <div className="shl-ask-acts">
                <button
                  type="button"
                  className="btn btn-primary shl-go"
                  onClick={() => {
                    room.host!.kick(sel.p.id);
                    setAsk(false);
                    setOpen(null);
                  }}
                >
                  إيه، طلّعه
                </button>
                <button type="button" className="shl-chalk" onClick={() => setAsk(false)}>
                  لا
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="shl-chalk shl-kick" onClick={() => setAsk(true)}>
              طلّعه من المزاد
            </button>
          ))}
      </ShellSheet>
    );
  }

  return (
    <ShellSheet label="الكراجات" onClose={onClose} step="list" foot={close}>
      <ScreenTitle as="h2" caption={anySold ? 'الربح من القيم اللي انكشفت بعد كل بيعة. التقييم السري يجي بالأخير.' : 'للحين ما انباع شي. اضغط على أي واحد وتشوف كراجه.'}>
        الكراجات
      </ScreenTitle>
      <ol className="shl-board">
        {rows.map(({ p, cars, profit, cash, any, pending }, k) => {
          const you = p.id === room.myId;
          const facts = [you ? 'أنت' : null, p.host ? 'الدلال' : null, p.online ? null : 'مقطوع'].filter(Boolean) as string[];
          const tone = !any ? 'even' : profit > 0 ? 'gain' : profit < 0 ? 'loss' : 'even';
          return (
            <li key={p.id} className={`shl-p${you ? ' is-me' : ''}${p.online ? '' : ' is-off'}`}>
              <button
                type="button"
                className="shl-p-main"
                onClick={() => setOpen(p.id)}
                aria-label={`${k + 1}. ${p.name}${facts.length ? '، ' + facts.join('، ') : ''}، ${cars} من ${slots} سيارات، باقي له ${money(cash)}${pending ? '، قيمة سيارته الجديدة ما انكشفت للحين' : ''}${any ? `، ${profit >= 0 ? 'ربحان' : 'خسران'} ${money(Math.abs(profit))}` : ''}. افتح كراجه`}
              >
                <span className="shl-rank ltr" aria-hidden="true">
                  {k + 1}
                </span>
                <Paddle n={p.paddle} me={you} />
                <span className="shl-p-t" aria-hidden="true">
                  <span className="shl-p-name">{p.name}</span>
                  <span className="shl-p-facts">
                    <span className="shl-p-facts-in">
                    {facts.map((f) => (
                      <span key={f} className={f === 'مقطوع' ? 'shl-f is-off' : 'shl-f'}>
                        {f}
                      </span>
                    ))}
                    <span className="shl-f">
                      <span className="shl-num ltr">
                        {cars}/{slots}
                      </span>
                    </span>
                    <span className="shl-f">
                      باقي <span className="shl-num ltr">{money(cash)}</span>
                    </span>
                    </span>
                  </span>
                </span>
                <span className={`shl-gain is-${tone}`} aria-hidden="true">
                  {tone !== 'even' && <i className="shl-mark" />}
                  <span className="ltr">{pending && !any ? '—' : any ? signed(profit) : '0'}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {watchers.length > 0 && (
        <section className="shl-watch" aria-labelledby="shl-watch-h">
          <h3 className="shl-h" id="shl-watch-h">
            يتفرجون
          </h3>
          <ul className="shl-board">
            {watchers.map((p) => (
              <li key={p.id} className="shl-w">
                <span className="shl-p-name">
                  {p.name}
                  {p.id === room.myId && <span className="shl-f"> أنت</span>}
                  {!p.online && <span className="shl-f is-off"> مقطوع</span>}
                </span>
                {room.host && !ended && (
                  <button type="button" className="shl-chalk" onClick={() => room.host!.admit(p.id)}>
                    دخّله
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </ShellSheet>
  );
}
