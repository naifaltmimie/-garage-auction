// Every auction setting in one place, each with its visible label and a one-line hint. Create's details section
// and the lobby's settings sheet both render this, so the two can never offer different things.
// Built from the kit's Field, Seg and Stepper; the switches are full-width labelled rows (44px and up).
import { useEffect, useMemo, useRef, useState } from 'react';
import { depthOf } from '../../data/depth';
import { MARKETS } from '../../engine/markets';
import { BUDGETS, DEFAULT_SETTINGS, GARAGE_SIZES, lotsFor } from '../../engine/rules';
import type { Mix, Settings, Speed } from '../../engine/types';
import { money } from '../../lib/util';
import { Icon } from './Bits';
import { Field, Seg, Stepper } from './kit/Field';

export type SetSettings = (p: Partial<Settings>) => void;

const SPEED_AR: Record<Speed, string> = { fast: 'سريع', normal: 'عادي', calm: 'هادي' };
const SPEEDS: Speed[] = ['fast', 'normal', 'calm'];
/** The three markets most nights start from; the rest sit under «أسواق ثانية». */
export const TOP_MARKETS: Mix[] = ['balanced', 'luxury', 'street'];
export const marketLabel = (id: Mix) => MARKETS.find((m) => m.id === id)?.label ?? 'متنوع';

const digits = (v: string) => v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '');

/** The settings said in plain words, one fact each, for the one-line summaries: «مرتاح 1,500,000 · كراج 4 · عادي». */
export function settingsFacts(s: Settings, opts: { market?: boolean } = {}): string[] {
  const b = BUDGETS.find((x) => x.amount === s.budget);
  const out: string[] = [];
  if (opts.market) out.push(marketLabel(s.mix));
  out.push(b ? `${b.label} ${money(s.budget)}` : `ميزانية ${money(s.budget)}`);
  out.push(`كراج ${s.garage}`);
  out.push(SPEED_AR[s.speed]);
  // only what differs from a normal night, so the line stays one line
  if (s.lots) out.push(`${s.lots} سيارة`);
  if (!s.estimate) out.push('بدون تقدير');
  if (!s.covered) out.push('بدون غطا');
  if (!s.sealed) out.push('بدون ظرف');
  if (s.dutch === false) out.push('بدون هولندي');
  if (!(s.fee > 0)) out.push('بدون سعي');
  if (s.ratingWeight !== DEFAULT_SETTINGS.ratingWeight) out.push(`التقييم ${Math.round(s.ratingWeight * 100)}%`);
  return out;
}

/** One market as a ruled row: name, what's in it, how many real ads. The chosen one carries the paper thumb. */
function MarketRow({ id, on, onPick, count }: { id: Mix; on: boolean; onPick: () => void; count: number }) {
  const m = MARKETS.find((x) => x.id === id)!;
  return (
    <button type="button" role="radio" aria-checked={on} className="sf-mk" onClick={onPick}>
      <span className="sf-mk-t">
        <b>{m.label}</b>
        <small>{m.note}</small>
      </span>
      <span className="sf-mk-n">
        <span className="ltr">{count.toLocaleString('en-US')}</span> سيارة
      </span>
      <span className="sf-mk-thumb" aria-hidden="true">
        {on && <Icon name="check" size={16} />}
      </span>
    </button>
  );
}

/** The night's market: three large rows, and «أسواق ثانية» opening the full list. Picking one sets its budget. */
export function MarketPicker({ value, set }: { value: Mix; set: SetSettings }) {
  const inTop = TOP_MARKETS.includes(value);
  const [more, setMore] = useState(!inTop);
  const depth = useMemo(
    () => Object.fromEntries(MARKETS.map((m) => [m.id, depthOf({ mix: m.id, budget: m.budget })])) as Record<Mix, number>,
    [],
  );
  const pick = (id: Mix) => set({ mix: id, budget: MARKETS.find((m) => m.id === id)!.budget });
  const rest = MARKETS.filter((m) => !TOP_MARKETS.includes(m.id));
  return (
    <div className="sf-market" role="radiogroup" aria-label="سوق الليلة">
      {TOP_MARKETS.map((id) => (
        <MarketRow key={id} id={id} on={value === id} onPick={() => pick(id)} count={depth[id] ?? 0} />
      ))}
      <button type="button" className="sf-more" aria-expanded={more} onClick={() => setMore((x) => !x)}>
        <span>{more ? 'أخفِ الأسواق الثانية' : 'أسواق ثانية'}</span>
        {!more && <small>{rest.length} أسواق: سوبر كار، جموس، رياضي…</small>}
        <Icon name={more ? 'minus' : 'plus'} size={18} />
      </button>
      {more && (
        <div className="sf-market-rest">
          {rest.map((m) => (
            <MarketRow key={m.id} id={m.id} on={value === m.id} onPick={() => pick(m.id)} count={depth[m.id] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A switch as one labelled row: the words on the right, the switch and its state on the left. */
function SwitchRow({ on, set, label, hint }: { on: boolean; set: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button type="button" className="kit-switch sf-sw" role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span className="sf-sw-t">
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <span className="sf-sw-c">
        <span className="switch" aria-hidden="true" />
        <span className="sf-sw-s">{on ? 'شغّال' : 'طافي'}</span>
      </span>
    </button>
  );
}

/** The budget: the four presets, or any amount typed (50,000 and up), shown with its thousands as it's typed. */
function BudgetField({ budget, set }: { budget: number; set: SetSettings }) {
  const preset = BUDGETS.some((b) => b.amount === budget);
  const [custom, setCustom] = useState(preset ? '' : String(budget));
  const n = Number(custom || 0);
  const low = custom !== '' && n < 50_000;
  // the budget changed from elsewhere (a market picked, the host on another control): the typed amount gives way
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setCustom((c) => (c && Number(c) !== budget ? '' : c));
  }, [budget]);
  const chosen = preset && (custom === '' || n === budget) ? budget : -1;
  return (
    <Field label="ميزانية كل لاعب" hint="الفلوس اللي يدخل فيها كل واحد المزاد">
      <div className="sf-grid2">
        <Seg
          value={chosen}
          onChange={(v) => {
            setCustom('');
            set({ budget: v });
          }}
          options={BUDGETS.map((b) => ({
            v: b.amount as number,
            label: (
              <span className="sf-bud">
                <span>{b.label}</span>
                <span className="sf-bud-n ltr">{money(b.amount)}</span>
              </span>
            ),
          }))}
        />
      </div>
      <label className="sf-custom">
        <span className="sf-custom-l">أو اكتب مبلغ</span>
        <input
          className="sf-input sf-input-num"
          inputMode="numeric"
          enterKeyHint="done"
          autoComplete="off"
          dir="ltr"
          placeholder="مثلًا 2,000,000"
          aria-invalid={low}
          aria-describedby={low ? 'sf-budget-low' : undefined}
          value={custom ? Number(custom).toLocaleString('en-US') : ''}
          onChange={(e) => {
            const v = digits(e.target.value).slice(0, 8);
            setCustom(v);
            const x = Number(v || 0);
            if (x >= 50_000) set({ budget: Math.min(50_000_000, x) });
          }}
        />
      </label>
      {low && (
        <small id="sf-budget-low" className="sf-warn" role="alert">
          أقل مبلغ 50,000 ريال
        </small>
      )}
    </Field>
  );
}

/**
 * Every auction setting except the market (Create shows the market at the top; the lobby sheet puts the MarketPicker
 * above this). `players` is how many are in the room, for the «تلقائي» car count; leave it out before the room exists.
 */
export function SettingsFields({ s, set, players }: { s: Settings; set: SetSettings; players?: number }) {
  const autoN = Math.max(1, Math.min(lotsFor(s, players ?? 2), depthOf(s)));
  return (
    <div className="sf">
      <BudgetField budget={s.budget} set={set} />

      <Field label="الكراج يشيل" hint="كم سيارة يقدر يشتري كل لاعب">
        <div className="sf-tight">
          <Seg
            print
            value={s.garage}
            onChange={(v) => set({ garage: v })}
            options={GARAGE_SIZES.map((n) => ({ v: n as number, label: n, aria: `${n} سيارات` }))}
          />
        </div>
      </Field>

      <div className="sf-pair">
        <Field label="عدد السيارات" hint={s.lots ? 'بالمزاد كله' : players ? `تلقائي الحين: ${autoN}` : 'تلقائي على قد اللاعبين'}>
          <Stepper
            value={s.lots ? <span className="ltr">{s.lots}</span> : <span className="sf-auto">تلقائي</span>}
            canInc={s.lots < 40}
            canDec={s.lots > 0}
            onDec={() => set({ lots: s.lots <= 12 ? 0 : s.lots - 2 })}
            onInc={() => set({ lots: Math.min(40, (s.lots || 10) + 2) })}
          />
        </Field>
        <Field label="أقصى عدد لاعبين" hint="من 2 إلى 10">
          <Stepper
            value={<span className="ltr">{s.maxPlayers}</span>}
            canDec={s.maxPlayers > Math.max(2, players ?? 2)}
            canInc={s.maxPlayers < 10}
            onDec={() => set({ maxPlayers: Math.max(2, players ?? 2, s.maxPlayers - 1) })}
            onInc={() => set({ maxPlayers: Math.min(10, s.maxPlayers + 1) })}
          />
        </Field>
      </div>

      <Field label="سرعة المزاد" hint="كم يصبر الدلال قبل ما يدق">
        <Seg value={s.speed} onChange={(v) => set({ speed: v })} options={SPEEDS.map((k) => ({ v: k, label: SPEED_AR[k] }))} />
      </Field>

      <div className="sf-sws" role="group" aria-label="طرق البيع والحساب">
        <SwitchRow on={s.estimate} set={(v) => set({ estimate: v })} label="تقدير الدلال يظهر" hint="سعر تقريبي على كل سيارة، طفّه لو تبيها أصعب" />
        <SwitchRow on={s.covered} set={(v) => set({ covered: v })} label="سيارات تحت الغطا" hint="تسوم وأنت ما تدري وش تحت الغطا" />
        <SwitchRow on={s.sealed} set={(v) => set({ sealed: v })} label="الظرف المختوم" hint="سوم سري مرة وحدة، وأعلى ظرف ياخذها" />
        <SwitchRow
          on={s.dutch !== false}
          set={(v) => set({ dutch: v })}
          label="المزاد الهولندي"
          hint="السعر يبدأ عالي وينزل، وأول واحد يقول أبيها ياخذها"
        />
        <SwitchRow on={s.fee > 0} set={(v) => set({ fee: v ? 2.5 : 0 })} label="السعي والضريبة" hint="سعي 2.5% وضريبته و150 ريال نقل ملكية، مثل الحراج" />
      </div>

      <Field label="وزن تقييم الشباب بالنتيجة" hint="الباقي على الشطارة: كم ربحت من اللي شريته">
        <Seg
          print
          value={s.ratingWeight}
          onChange={(v) => set({ ratingWeight: v })}
          options={[0.3, 0.5, 0.7].map((w) => ({ v: w, label: <span className="ltr">{Math.round(w * 100)}%</span> }))}
        />
      </Field>
    </div>
  );
}
