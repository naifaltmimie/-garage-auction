import { Fragment, memo, useMemo, useRef, useState } from 'react';
import { MODE_LABEL, PANEL_LABEL, SELLER_LABEL, STATUS_LABEL, chassisCard, damageLine } from '../../engine/lotgen';
import { gradeWord } from '../../engine/realism';
import type { CarPub, Cond, LotPub, PanelId } from '../../engine/types';
import { money } from '../../lib/util';
import { DamageMap, Legend, PanelList, StatusKey } from './DamageMap';
import { Gallery } from './Gallery';
import { Facts, type Fact } from './kit/Facts';
import { Mark, Pairs, type Pair } from './kit/Pairs';
import { CarPlate } from './Plate';

export const DRIVE_AR = { FWD: 'دفع أمامي', RWD: 'دفع خلفي', AWD: 'دفع كلي', '4WD': 'دفع رباعي' } as const;
export const FUEL_AR = { petrol: 'بنزين', diesel: 'ديزل', hybrid: 'هايبرد', ev: 'كهرباء' } as const;

export function transAr(t: string): string {
  const m = /^(\d+)\s*(AT|MT|DCT|DSG)$/i.exec(t.trim());
  if (m) return `${m[2].toUpperCase() === 'MT' ? 'عادي' : 'أوتوماتيك'} ${m[1]} سرعات`;
  if (/cvt/i.test(t)) return 'أوتوماتيك CVT';
  if (/^AT$/i.test(t)) return 'أوتوماتيك';
  if (/^MT$/i.test(t)) return 'عادي';
  return t;
}

const COND_LABEL: Record<Cond, string> = { ok: 'سليم', minor: 'ملاحظة', major: 'عطل', unknown: 'ما انفحص' };

function mechOf(c: CarPub) {
  const chassis: Cond = c.mech.chassis === 'ok' ? 'ok' : c.mech.chassis === 'unknown' ? 'unknown' : 'major';
  const airbags: Cond = c.mech.airbags === 'ok' ? 'ok' : c.mech.airbags === 'unknown' ? 'unknown' : 'major';
  const ac: Cond = c.mech.ac === 'cold' ? 'ok' : c.mech.ac === 'unknown' ? 'unknown' : c.mech.ac === 'weak' ? 'minor' : 'major';
  return { chassis, airbags, ac };
}

const SCAN_LABEL = {
  clean: 'ما فيه أعطال مسجلة',
  stored: 'أعطال قديمة مخزنة، مو نشطة',
  active: 'أعطال نشطة، لمبة المكينة شغالة',
  cleared: 'الأعطال ممسوحة قريب والحساسات مو جاهزة',
  none: 'ما انفحص بالكمبيوتر',
} as const;

export function bodyAr(b: CarPub['body']): string {
  return { sedan: 'سيدان', suv: 'جيب', pickup: 'ونيت', coupe: 'كوبيه', hatch: 'هاتشباك', van: 'فان', convertible: 'مكشوفة', wagon: 'ستيشن' }[b] ?? 'سيارة';
}

export function specParts(car: Pick<CarPub, 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'>): string[] {
  return [car.engine, car.hp ? `${car.hp} حصان` : null, DRIVE_AR[car.drive], transAr(car.trans), car.fuel === 'petrol' ? null : FUEL_AR[car.fuel]].filter(Boolean) as string[];
}

/** Spec bits mix Latin ("6.2L V8") and Arabic: each one is isolated so the line reads right to left. */
function SpecLine({ car }: { car: Pick<CarPub, 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'> }) {
  const parts = specParts(car);
  return (
    <span className="spec-line">
      {parts.map((x, i) => (
        <Fragment key={i}>
          <span>
            <bdi dir="rtl">{x}</bdi>
            {i < parts.length - 1 ? '،' : ''}
          </span>
          {/* the gap sits between the pieces, where the line may break */}
          {i < parts.length - 1 ? ' ' : ''}
        </Fragment>
      ))}
    </span>
  );
}

function gradeTone(g: number | null): 'good' | 'mid' | 'bad' {
  return g == null ? 'mid' : g >= 3.8 ? 'good' : g >= 2.5 ? 'mid' : 'bad';
}

/** A printed number inside a line of text: Barlow, Latin digits, isolated left to right. */
function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={className ? `print ltr ${className}` : 'print ltr'}>{children}</span>;
}

/** A label with a percentage in it («سعي 2.5% + ضريبة»): the number and its sign stay together, left to right. */
function isoPct(t: string): React.ReactNode {
  return t.split(/(\d[\d.,]*%)/).map((x, i) => (i % 2 ? <bdi key={i} dir="ltr">{x}</bdi> : x));
}

/** The make as people say it: the Arabic name, or the street name when the make is written in Latin (GMC → جمس). */
function makeSaid(car: Pick<CarPub, 'makeAr' | 'modelAr' | 'nick'>): string {
  const latin = !/[؀-ۿ]/.test(car.makeAr);
  return latin && car.nick && car.nick !== car.modelAr ? car.nick : car.makeAr;
}

/** The model and its trim, the way the sheet's title reads it («يوكن دينالي»). */
function modelSaid(car: Pick<CarPub, 'modelAr' | 'trim' | 'trimAr'>): string {
  const trim = car.trimAr || car.trim;
  return trim && !car.modelAr.includes(trim) ? `${car.modelAr} ${trim}` : car.modelAr;
}

/** The six things people look at first, as ruled pairs. */
function glance(car: CarPub, lot: LotPub, revealed: boolean): Pair[] {
  const g = revealed ? null : lot.grade;
  const dmg = damageLine(car);
  const approxKm = !!car.said && !car.said.includes('km');
  const typicalSpec = !!car.said && !car.said.includes('spec');
  return [
    {
      k: 'الممشى',
      v: (
        <>
          <P className="sh-num">{money(Math.round(car.km / 100) * 100)}</P> كم
          {approxKm ? <small> تقريباً</small> : car.kmTag ? <small> {car.kmTag === 'low' ? 'قليل' : 'عالي'}</small> : null}
        </>
      ),
      tone: !approxKm && car.kmTag === 'low' ? 'good' : !approxKm && car.kmTag === 'high' ? 'bad' : undefined,
    },
    {
      k: 'المواصفات',
      v: (
        <>
          {car.spec}
          {typicalSpec && <small> غالباً</small>}
        </>
      ),
      tone: car.specKind === 'us_salvage' ? 'bad' : undefined,
    },
    {
      k: 'درجة الفحص',
      v:
        g == null ? (
          lot.mode === 'asis' ? 'على الحالة' : 'ما انفحصت'
        ) : (
          <>
            <P className="sh-num">{g.toFixed(1)}</P> {gradeWord(g)}
          </>
        ),
      tone: g == null ? (lot.mode === 'asis' ? 'bad' : undefined) : gradeTone(g) === 'mid' ? undefined : (gradeTone(g) as 'good' | 'bad'),
    },
    { k: 'الضرر', v: dmg, tone: dmg === 'بدون ضرر' ? 'good' : dmg.startsWith('صدمة') ? 'bad' : undefined },
    {
      k: 'اللون',
      v: (
        <>
          <span className="sh-swatch" style={{ background: car.colorHex }} aria-hidden="true" />
          {car.color}
        </>
      ),
    },
    { k: 'المدينة', v: car.city },
  ];
}

type Tab = 'inspect' | 'records' | 'ad' | 'specs';

/** Synced state arrives as fresh objects on every message. While a value's content is unchanged this
 *  hands back the very same object, so the memoised parts below skip every bid and every clock tick. */
function useSame<T>(v: T): T {
  const s = useMemo(() => JSON.stringify(v ?? null), [v]);
  const r = useRef<{ s: string; v: T } | null>(null);
  if (!r.current || r.current.s !== s) r.current = { s, v };
  return r.current.v;
}

const LotGallery = memo(function LotGallery({ lot, car }: { lot: LotPub; car: CarPub | null }) {
  return car ? (
    <Gallery photos={car.photos} body={car.body} color={car.colorHex} />
  ) : (
    <Gallery photos={lot.cover?.photo ? [lot.cover.photo] : undefined} body={lot.cover?.body ?? 'sedan'} covered />
  );
});

/** Who sells, how, and the floor, as one line of facts under the title. */
function saleFacts(lot: LotPub, reserveMet: boolean, covered: boolean): Fact[] {
  const out: Fact[] = [];
  if (lot.kind === 'sealed') out.push('ظرف مختوم');
  if (lot.kind === 'dutch') out.push('مزاد هولندي');
  if (lot.relist > 0) out.push('عرض ثاني');
  out.push(SELLER_LABEL[lot.seller]);
  if (!covered) out.push(lot.mode === 'asis' ? { t: MODE_LABEL.asis, tone: 'warn' } : { t: 'مفحوصة', tone: 'good' });
  if (lot.kind === 'open') out.push(lot.reserve ? (reserveMet ? { t: 'انفك الحد', tone: 'good' } : 'عليها حد') : 'بدون حد');
  return out;
}

const LotHead = memo(function LotHead({ lot, car, revealed, reserveMet }: { lot: LotPub; car: CarPub | null; revealed: boolean; reserveMet: boolean }) {
  if (!car) {
    const c = lot.cover;
    return (
      <header className="sh-head">
        <h2 className="sh-title">تحت الغطا</h2>
        <p className="sh-meta">
          {c ? bodyAr(c.body) : 'سيارة'}
          {c && (
            <>
              {' · '}
              <P className="sh-year">{c.yearFrom === c.yearTo ? c.yearFrom : `${c.yearFrom}–${c.yearTo}`}</P>
            </>
          )}
        </p>
        <Facts className="sh-facts" items={saleFacts(lot, reserveMet, true)} />
        <p className="sh-honest">ما نعرف عنها إلا اللي تحت، والغطا ما ينشال إلا بعد ما يرسي السوم.</p>
        {c && c.hints.length > 0 && (
          <ul className="sh-hints">
            {c.hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </header>
    );
  }
  const sp = car.plate.special;
  return (
    <>
      <header className="sh-head">
        {/* the name in its own direction: «812 GTS» keeps its order inside the Arabic page */}
        <h2 className="sh-title">
          <bdi>{modelSaid(car)}</bdi>
        </h2>
        <div className="sh-line">
          <p className="sh-meta">
            <span className="sh-mk">
              <span className="sh-make">{makeSaid(car)}</span>
              {' · '}
              <P className="sh-year">{car.year}</P>
            </span>
            <SpecLine car={car} />
          </p>
          <div className="sh-plate">
            <CarPlate plate={car.plate} size="sm" />
            {sp?.note && <small className="sh-plate-note">{sp.note}</small>}
          </div>
        </div>
        <Facts className="sh-facts" items={saleFacts(lot, reserveMet, false)} />
      </header>
      <Pairs className="sh-glance" items={glance(car, lot, revealed)} />
    </>
  );
});

/** The دلال's file, as people talk: three short sentences, then what the viewing turned up. */
const Story = memo(function Story({ car }: { car: CarPub }) {
  const s = car.story;
  if (!s) return null;
  const end = (t: string) => (/[.؟!]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
  const owner = /^عند\s/.test(s.owner) ? `كانت ${s.owner}` : s.owner;
  return (
    <section className="sh-sec" aria-labelledby="sh-story">
      <h3 className="sh-h" id="sh-story">سالفتها</h3>
      <div className="sh-story">
        <p>{end(owner)}</p>
        <p>{end(s.use)}</p>
        <p>
          <span className="sh-q">ليش تنباع؟</span> {end(s.why)}
        </p>
      </div>
      {s.quirks.length > 0 && (
        <>
          <h3 className="sh-h">شفنا بالمعاينة</h3>
          <ul className="sh-list">
            {s.quirks.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
});

export function LotSheet({ lot: lotIn, reserveMet, opening, revealed: revIn }: { lot: LotPub; total: number; reserveMet: boolean; opening: number; revealed?: CarPub | null }) {
  const lot = useSame(lotIn);
  const revealed = useSame(revIn ?? null);
  const car = revealed ?? lot.car;
  const covered = lot.kind === 'covered' && !revealed;
  const shown = covered || !car ? null : car;
  const est = lot.estimate;

  return (
    <article className="sh" key={lot.id} aria-label={`السيارة رقم ${lot.no}`}>
      <LotGallery lot={lot} car={shown} />

      <div className="sh-body">
        <LotHead lot={lot} car={shown} revealed={!!revealed} reserveMet={reserveMet} />

        <dl className="rows sh-price">
          <div className="rows-r">
            <dt>تقدير الدلال</dt>
            <dd>
              {est ? (
                <P className="sh-money">
                  {money(est[0])} – {money(est[1])}
                </P>
              ) : (
                <span className="sh-none">{lot.kind === 'covered' ? 'محد يدري' : 'مخفي'}</span>
              )}
            </dd>
          </div>
          <div className="rows-r">
            <dt>{lot.kind === 'sealed' ? 'أقل ظرف' : 'يفتح على'}</dt>
            <dd>
              <P className="sh-money">{money(opening || lot.opening)}</P> <span className="sh-unit">ريال</span>
            </dd>
          </div>
        </dl>
        <p className="sh-fee">{lot.fee.pct > 0 ? <>{isoPct(lot.fee.label)}، ونقل الملكية {money(lot.fee.transfer)} ريال</> : 'بدون سعي'}</p>

        {shown && <Story car={shown} />}
      </div>

      {shown && <LotTabs lot={lot} car={shown} revealed={!!revealed} />}
    </article>
  );
}

const TABS: [Tab, string][] = [
  ['inspect', 'الفحص'],
  ['records', 'السجلات'],
  ['ad', 'كلام المعلن'],
  ['specs', 'المواصفات'],
];

function condTone(c: Cond): 'good' | 'bad' | 'mid' | 'unknown' {
  return c === 'ok' ? 'good' : c === 'major' ? 'bad' : c === 'unknown' ? 'unknown' : 'mid';
}

/** A ruled row whose value may carry a small status mark. */
function MarkRow({ k, v, tone }: { k: string; v: React.ReactNode; tone?: 'good' | 'bad' | 'mid' | 'unknown' }) {
  return (
    <div className={`rows-r${tone === 'unknown' ? ' is-unknown' : ''}`}>
      <dt>{k}</dt>
      <dd>
        <Mark tone={tone} />
        {v}
      </dd>
    </div>
  );
}

const LotTabs = memo(function LotTabs({ lot, car, revealed }: { lot: LotPub; car: CarPub; revealed: boolean }) {
  const [picked, setPicked] = useState<PanelId | null>(null);
  const [tab, setTab] = useState<Tab>('inspect');
  const box = useRef<HTMLDivElement>(null);

  // when the tab bar is stuck under the top bar, the new section starts right under it, not half-way down the old one
  const pick = (k: Tab) => {
    if (k === tab) return;
    const el = box.current;
    const bar = el?.firstElementChild as HTMLElement | null | undefined;
    if (el && bar) {
      const stick = parseFloat(getComputedStyle(bar).top) || 0;
      const top = el.getBoundingClientRect().top;
      if (top < stick - 1) window.scrollTo({ top: window.scrollY + top - stick });
    }
    setTab(k);
  };
  // arrow keys walk the tabs, as a tablist should
  const keys = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = TABS[(i + step + TABS.length) % TABS.length][0];
    pick(n);
    (e.currentTarget.querySelector(`[data-tab="${n}"]`) as HTMLElement | null)?.focus();
  };

  const g = revealed ? null : lot.grade;
  const chassis = chassisCard(car);
  const mech = mechOf(car);
  const pickedSt = picked ? car.panels[picked] ?? 'ok' : null;

  return (
    <div className="sh-tabs" ref={box}>
      <div className="sh-tabbar" role="tablist" aria-label="ملف السيارة" onKeyDown={keys}>
        {TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`sh-tab-${k}`}
            data-tab={k}
            aria-selected={tab === k}
            aria-controls="sh-pane"
            tabIndex={tab === k ? 0 : -1}
            onClick={() => pick(k)}
          >
            <span>{label}</span>
            {k === 'ad' && lot.notes.length > 0 && <i className="sh-tabdot" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div className="sh-pane" id="sh-pane" role="tabpanel" aria-labelledby={`sh-tab-${tab}`}>
        {tab === 'inspect' && (
          <>
            <dl className="rows sh-rows">
              <MarkRow
                k="درجة الفحص"
                tone={g == null ? (lot.mode === 'asis' ? 'bad' : 'unknown') : gradeTone(g)}
                v={
                  g == null ? (
                    lot.mode === 'asis' ? 'ما انفحصت، تنباع على الحالة' : 'ما انفحصت'
                  ) : (
                    <>
                      <P className="sh-num">{g.toFixed(1)}</P>
                      <span className="sh-of"> من 5</span> {gradeWord(g)}
                    </>
                  )
                }
              />
              <MarkRow k="كرت الشاصي" tone={chassis.tone} v={chassis.label} />
              <MarkRow k="سجل نجم" tone={car.najm === 0 ? 'good' : car.najm === 1 ? 'mid' : 'bad'} v={car.najm === 0 ? 'بدون حوادث' : car.najm === 1 ? 'حادث واحد' : <><P>{car.najm}</P> حوادث</>} />
            </dl>

            <h4 className="sh-h">البودي وجهاز الطلاء</h4>
            <div className="sh-map">
              <DamageMap car={car} onPick={(p) => setPicked((x) => (x === p ? null : p))} picked={picked} />
              <div className="sh-map-side">
                <Legend car={car} />
                <p className="sh-picked" role="status">
                  {picked && pickedSt ? (
                    <>
                      <StatusKey s={pickedSt} />
                      {PANEL_LABEL[picked]}: {STATUS_LABEL[pickedSt]}
                    </>
                  ) : (
                    'اضغط على أي قطعة تشوف اسمها'
                  )}
                </p>
              </div>
            </div>
            <PanelList car={car} />

            <h4 className="sh-h">الميكانيكا</h4>
            <dl className="rows sh-rows">
              {(
                [
                  ['المكينة', car.mech.engine],
                  ['القير', car.mech.gearbox],
                  ['الشاصي', mech.chassis],
                  ['المكيف', mech.ac],
                  ['الإيرباقات', mech.airbags],
                  ['التعليق', car.mech.susp],
                ] as [string, Cond][]
              ).map(([n, c]) => (
                <MarkRow key={n} k={n} tone={condTone(c)} v={COND_LABEL[c]} />
              ))}
            </dl>

            {car.checks && car.checks.length > 0 && (
              <>
                <h4 className="sh-h">قراءات الفاحص</h4>
                <dl className="rows sh-rows">
                  {car.checks.map((r) => (
                    <MarkRow key={r.k} k={r.k} tone={r.tone} v={r.v} />
                  ))}
                </dl>
              </>
            )}

            {car.inspector.length > 0 && (
              <>
                <h4 className="sh-h">ملاحظات الفاحص</h4>
                <ul className="sh-list">
                  {car.inspector.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === 'records' && (
          <>
            <dl className="rows sh-rows">
              <MarkRow
                k="فحص الكمبيوتر"
                tone={car.scan.status === 'clean' ? 'good' : car.scan.status === 'active' ? 'bad' : car.scan.status === 'none' ? 'unknown' : 'mid'}
                v={
                  <>
                    {SCAN_LABEL[car.scan.status]}
                    {car.scan.codes.length > 0 && <span className="sh-codes print ltr">{car.scan.codes.map((c) => c[0]).join(' ')}</span>}
                  </>
                }
              />
            </dl>
            {car.history.length > 0 && (
              <>
                <h4 className="sh-h">السجل</h4>
                <ul className="sh-list sh-hist">
                  {car.history.map((h) => {
                    const [k, ...rest] = h.split(':');
                    return (
                      <li key={h}>
                        {rest.length ? (
                          <>
                            <b>{k}</b>
                            <span>{rest.join(':').trim()}</span>
                          </>
                        ) : (
                          <span>{h}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <h4 className="sh-h">الأوراق</h4>
            <dl className="rows sh-rows">
              <MarkRow k="الملاك" v={car.owners === 1 ? 'المالك الأول' : car.owners === 2 ? 'مالكين' : <><P>{car.owners}</P> ملاك</>} />
              <MarkRow k="الصيانة" tone={car.service === 'dealer' ? 'good' : car.service === 'none' ? 'bad' : undefined} v={car.service === 'dealer' ? 'وكالة' : car.service === 'workshop' ? 'ورش خارجية' : 'ما فيه سجل'} />
              <MarkRow k="الاستمارة" tone={car.istimara === 'valid' ? undefined : 'bad'} v={car.istimara === 'valid' ? 'سارية' : 'منتهية'} />
              <MarkRow k="الفحص الدوري" tone={car.mvpi === 'valid' ? undefined : 'bad'} v={car.mvpi === 'valid' ? `ساري لين ${car.mvpiUntil ?? ''}`.trim() : 'منتهي'} />
              <MarkRow k="التأمين" v={car.insurance === 'comp' ? 'شامل' : car.insurance === 'tpl' ? 'ضد الغير' : 'بدون'} />
              <MarkRow k="المخالفات" tone={car.fines > 0 ? 'bad' : undefined} v={car.fines > 0 ? <><P>{money(car.fines)}</P> ريال</> : 'ما عليها'} />
              <MarkRow k="التسجيل" v={car.regType} />
            </dl>
          </>
        )}

        {tab === 'ad' && (
          <>
            {car.adTitle && <h4 className="sh-adtitle" dir="auto">{car.adTitle}</h4>}
            {lot.notes.length ? (
              <blockquote className="sh-quote">
                {lot.notes.map((n) => (
                  <p key={n} dir="auto">{n}</p>
                ))}
              </blockquote>
            ) : (
              <p className="sh-plain">المعلن ما كتب شي.</p>
            )}
            <p className="sh-fine">كلام المعلن على مسؤوليته، والفحص هو الحكم.</p>
          </>
        )}

        {tab === 'specs' && <Specs car={car} />}
      </div>
    </div>
  );
});

function Specs({ car }: { car: CarPub }) {
  // a real ad's car: the details its ad states are plain; the model's usual spec is marked
  const said = car.said;
  const typical = (key: string) => !!said && !said.includes(key);
  const rows: [string, React.ReactNode, boolean][] = [
    ['المحرك', car.engine ? <bdi dir="ltr">{car.engine}</bdi> : '—', typical('engine') && !!car.engine],
    ['القوة', car.hp ? <><P>{car.hp}</P> حصان</> : '—', typical('hp') && !!car.hp],
    ['الدفع', DRIVE_AR[car.drive], typical('drive')],
    ['القير', transAr(car.trans), typical('trans')],
    ['الوقود', FUEL_AR[car.fuel], typical('fuel')],
    ['الأبواب', said && !said.includes('doors') ? 'حسب الصور' : <P>{car.doors}</P>, false],
    ['الداخلية', car.interior, false],
    ['المفاتيح', car.keys === 2 ? 'مفتاحين' : 'مفتاح واحد', false],
    ['الكفرات', <>صنع <P>{car.tires}</P></>, false],
    ['التشغيل', car.runs === 'drive' ? 'تشتغل وتمشي' : car.runs === 'starts' ? 'تشتغل بس' : 'واقفة', false],
    ...(car.warranty ? [['الضمان', car.warranty.replace('ضمان وكالة ساري حتى ', 'وكالة لين '), false] as [string, string, boolean]] : []),
  ];
  return (
    <>
      <dl className="rows sh-rows">
        {rows.map(([k, v, t]) => (
          <div key={k} className="rows-r">
            <dt>{k}</dt>
            <dd>
              {v}
              {t && <span className="sh-typ" aria-label="المعتاد للموديل">*</span>}
            </dd>
          </div>
        ))}
      </dl>
      {rows.some((r) => r[2]) && <p className="sh-fine">* المعتاد لهالموديل، الإعلان ما ذكره.</p>}
      {car.extras.length > 0 && (
        <>
          <h4 className="sh-h">الإضافات</h4>
          <Facts className="sh-extras" items={car.extras} />
        </>
      )}
    </>
  );
}
