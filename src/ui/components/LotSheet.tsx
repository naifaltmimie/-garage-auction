import { useState } from 'react';
import { MODE_LABEL, SELLER_LABEL, chassisCard, damageLine } from '../../engine/lotgen';
import { gradeWord } from '../../engine/realism';
import type { CarPub, Cond, LotPub, PanelId } from '../../engine/types';
import { km, money } from '../../lib/util';
import { DamageMap, Legend, PanelList } from './DamageMap';
import { Gallery } from './Gallery';
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
  clean: 'لا توجد أعطال مسجلة',
  stored: 'أعطال مخزنة غير نشطة',
  active: 'أعطال نشطة، لمبة المكينة شغالة',
  cleared: 'الأكواد ممسوحة قريب والحساسات مو جاهزة',
  none: 'ما انفحص بالكمبيوتر',
} as const;

export function bodyAr(b: CarPub['body']): string {
  return { sedan: 'سيدان', suv: 'جيب', pickup: 'ونيت', coupe: 'كوبيه', hatch: 'هاتشباك', van: 'فان', convertible: 'مكشوفة', wagon: 'ستيشن' }[b] ?? 'سيارة';
}

export function specParts(car: Pick<CarPub, 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'>): string[] {
  return [car.engine, car.hp ? `${car.hp} حصان` : null, DRIVE_AR[car.drive], transAr(car.trans), car.fuel === 'petrol' ? null : FUEL_AR[car.fuel]].filter(Boolean) as string[];
}

export function specLine(car: Pick<CarPub, 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'>): string {
  return specParts(car).join('، ');
}

/** Spec bits mix Latin ("6.2L V8") and Arabic: each one is isolated so the line reads right to left. */
function SpecLine({ car }: { car: Pick<CarPub, 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'> }) {
  const parts = specParts(car);
  return (
    <span className="spec-line">
      {parts.map((x, i) => (
        <span key={i}>
          <bdi dir="rtl">{x}</bdi>
          {i < parts.length - 1 ? '، ' : ''}
        </span>
      ))}
    </span>
  );
}

/** Make / model / trim / year block. */
export function CarTitle({ car, compact }: { car: Pick<CarPub, 'makeAr' | 'makeEn' | 'modelAr' | 'trim' | 'year' | 'nick' | 'engine' | 'hp' | 'drive' | 'trans' | 'fuel'>; compact?: boolean }) {
  return (
    <div className={`car-title ${compact ? 'compact' : ''}`}>
      <div className="car-make">
        <span>{car.makeAr}</span>
        {car.makeAr !== car.makeEn && <span className="en">{car.makeEn}</span>}
        {car.nick && <span className="nick">«{car.nick}»</span>}
      </div>
      <h2 className="car-name">
        {car.modelAr} {car.trim && <span className="trim">{car.trim}</span>}
      </h2>
      <div className="car-year">
        <b className="ltr">{car.year}</b>
        {!compact && <SpecLine car={car} />}
      </div>
    </div>
  );
}

function gradeTone(g: number | null) {
  return g == null ? 'mid' : g >= 3.8 ? 'good' : g >= 2.5 ? 'mid' : 'bad';
}

/** The six things people look at first. */
function KeyFacts({ car, lot, revealed }: { car: CarPub; lot: LotPub; revealed?: boolean }) {
  const g = revealed ? null : lot.grade;
  const dmg = damageLine(car);
  const items: { k: string; v: React.ReactNode; tone?: string }[] = [
    { k: 'الممشى', v: <>{km(car.km)}{car.kmTag && <small className={car.kmTag === 'low' ? 'gain' : 'loss'}> {car.kmTag === 'low' ? 'قليل' : 'عالي'}</small>}</> },
    { k: 'المواصفات', v: car.spec, tone: car.specKind === 'us_salvage' ? 'bad' : undefined },
    {
      k: 'تقييم الفحص',
      v: g == null ? (lot.mode === 'asis' ? 'على الحالة' : '—') : <>{g.toFixed(1)}<small> / 5 {gradeWord(g)}</small></>,
      tone: g == null ? undefined : gradeTone(g),
    },
    { k: 'الضرر', v: dmg, tone: dmg === 'بدون ضرر' ? 'good' : dmg.startsWith('صدمة') ? 'bad' : 'mid' },
    { k: 'اللون', v: <><span className="swatch" style={{ background: car.colorHex }} />{car.color}</> },
    { k: 'المدينة', v: car.city },
  ];
  return (
    <dl className="keyfacts">
      {items.map((it) => (
        <div key={it.k} className={it.tone ? `tone-${it.tone}` : ''}>
          <dt>{it.k}</dt>
          <dd>{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

type Tab = 'inspect' | 'records' | 'ad' | 'specs';

export function LotSheet({ lot, total, reserveMet, opening, revealed }: { lot: LotPub; total: number; reserveMet: boolean; opening: number; revealed?: CarPub | null }) {
  const [picked, setPicked] = useState<PanelId | null>(null);
  const [tab, setTab] = useState<Tab>('inspect');
  const car = revealed ?? lot.car;
  const covered = lot.kind === 'covered' && !revealed;

  const badges = (
    <>
      {lot.kind === 'covered' && <span className="g-kind">تحت الغطا</span>}
      {lot.kind === 'sealed' && <span className="g-kind">ظرف مختوم</span>}
      {lot.relist > 0 && <span className="g-kind gold">إعادة عرض</span>}
    </>
  );

  return (
    <article className="lot" key={lot.id} aria-label={`لوت ${lot.no}`}>
      {covered || !car ? (
        <Gallery photos={lot.cover?.photo ? [lot.cover.photo] : undefined} body={lot.cover?.body ?? 'sedan'} covered>
          {badges}
        </Gallery>
      ) : (
        <Gallery photos={car.photos} body={car.body} color={car.colorHex}>
          {badges}
        </Gallery>
      )}

      <div className="lot-card">
        <div className="lot-tags">
          <span className="chip">{SELLER_LABEL[lot.seller]}</span>
          <span className={`chip ${lot.mode === 'asis' ? 'chip-red' : 'chip-green'}`}>{lot.mode === 'asis' ? MODE_LABEL.asis : 'مفحوصة'}</span>
          {lot.kind === 'open' &&
            (lot.reserve ? (
              <span className={`chip ${reserveMet ? 'chip-green' : 'chip-amber'}`}>{reserveMet ? 'انفك الحد' : 'عليها حد'}</span>
            ) : (
              <span className="chip chip-gold">بدون حد</span>
            ))}
          {car?.plate.special && !covered && <span className="chip chip-gold">{car.plate.special.label}</span>}
        </div>

        {covered || !car ? (
          <div className="car-title">
            <div className="car-make">سيارة تحت الغطا</div>
            <h2 className="car-name">{lot.cover ? bodyAr(lot.cover.body) : 'سيارة'}</h2>
            <div className="car-year">
              <b className="ltr">{lot.cover ? `${lot.cover.yearFrom}–${lot.cover.yearTo}` : ''}</b>
              <span>الغطا ما ينشال إلا بعد ما تنزل المطرقة</span>
            </div>
            <div className="hints">
              {lot.cover?.hints.map((h) => (
                <span key={h} className="chip">{h}</span>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="lot-head">
              <CarTitle car={car} />
              <CarPlate plate={car.plate} size="sm" />
            </div>
            <KeyFacts car={car} lot={lot} revealed={!!revealed} />
          </>
        )}

        <div className="pricebar">
          <div>
            <small>تقدير الدلال</small>
            <b className="ltr">{lot.estimate ? `${money(lot.estimate[0])} – ${money(lot.estimate[1])}` : lot.kind === 'covered' ? 'محد يدري' : 'مخفي'}</b>
          </div>
          <div>
            <small>{lot.kind === 'sealed' ? 'أقل ظرف' : 'يفتح على'}</small>
            <b className="ltr">{money(opening || lot.opening)}</b>
          </div>
          <div className="fee">{lot.fee.pct > 0 ? `${lot.fee.label}، ونقل الملكية ${lot.fee.transfer} ريال` : 'بدون سعي'}</div>
        </div>
      </div>

      {car && !covered && (
        <div className="lot-tabs">
          <div className="tabs" role="tablist">
            {(
              [
                ['inspect', 'الفحص'],
                ['records', 'السجلات'],
                ['ad', 'كلام المعلن'],
                ['specs', 'المواصفات'],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
                {label}
                {k === 'ad' && lot.notes.length > 0 && <i className="tab-dot" />}
              </button>
            ))}
          </div>

          {tab === 'inspect' && (
            <div className="pane">
              <div className="verdicts">
                {(() => {
                  const g = revealed ? null : lot.grade;
                  return (
                    <div className={`vbox tone-${gradeTone(g)}`}>
                      <small>تقييم الحالة</small>
                      {g == null ? <b>{lot.mode === 'asis' ? 'ما انفحصت' : '—'}</b> : <b className="big ltr">{g.toFixed(1)}</b>}
                      {g != null && <small>{gradeWord(g)}</small>}
                    </div>
                  );
                })()}
                {(() => {
                  const c = chassisCard(car);
                  return (
                    <div className={`vbox tone-${c.tone === 'unknown' ? 'mid' : c.tone}`}>
                      <small>كرت الشاصي</small>
                      <b>{c.label}</b>
                    </div>
                  );
                })()}
                <div className={`vbox tone-${car.najm === 0 ? 'good' : car.najm === 1 ? 'mid' : 'bad'}`}>
                  <small>سجل نجم</small>
                  <b>{car.najm === 0 ? 'بدون حوادث' : car.najm === 1 ? 'حادث واحد' : `${car.najm} حوادث`}</b>
                </div>
              </div>

              <h4>خريطة البودي وجهاز الطلاء</h4>
              <div className="damage">
                <DamageMap car={car} onPick={(p) => setPicked((x) => (x === p ? null : p))} picked={picked} />
                <div className="stack" style={{ gap: 10, alignContent: 'start' }}>
                  <PanelList car={car} />
                  <Legend />
                </div>
              </div>

              <h4>الميكانيكا</h4>
              <div className="mech">
                {(
                  [
                    ['المكينة', car.mech.engine],
                    ['القير', car.mech.gearbox],
                    ['الشاصي', mechOf(car).chassis],
                    ['المكيف', mechOf(car).ac],
                    ['الإيرباقات', mechOf(car).airbags],
                    ['التعليق', car.mech.susp],
                  ] as [string, Cond][]
                ).map(([n, c]) => (
                  <div key={n} className={`mitem ${c}`}>
                    <i aria-hidden="true" />
                    <span>{n}</span>
                    <small>{COND_LABEL[c]}</small>
                  </div>
                ))}
              </div>

              {car.inspector.length > 0 && (
                <>
                  <h4>ملاحظات الفاحص</h4>
                  <ul className="notes">
                    {car.inspector.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {tab === 'records' && (
            <div className="pane">
              <ul className="records">
                <li className={car.scan.status === 'clean' ? '' : 'warn'}>
                  <b>فحص الكمبيوتر</b>
                  <span>
                    {SCAN_LABEL[car.scan.status]}
                    {car.scan.codes.length > 0 && <span className="ltr codes">{car.scan.codes.map((c) => c[0]).join(' ')}</span>}
                  </span>
                </li>
                {car.history.map((h) => {
                  const [k, ...rest] = h.split(':');
                  return (
                    <li key={h}>
                      <b>{rest.length ? k : 'سجل'}</b>
                      <span>{rest.length ? rest.join(':').trim() : h}</span>
                    </li>
                  );
                })}
              </ul>
              <dl className="table">
                {(
                  [
                    ['الملاك', car.owners === 1 ? 'المالك الأول' : car.owners === 2 ? 'مالكين' : `${car.owners} ملاك`],
                    ['الصيانة', car.service === 'dealer' ? 'وكالة' : car.service === 'workshop' ? 'ورش خارجية' : 'ما فيه سجل'],
                    ['الاستمارة', car.istimara === 'valid' ? 'سارية' : 'منتهية'],
                    ['الفحص الدوري', car.mvpi === 'valid' ? `ساري لين ${car.mvpiUntil ?? ''}` : 'منتهي'],
                    ['التأمين', car.insurance === 'comp' ? 'شامل' : car.insurance === 'tpl' ? 'ضد الغير' : 'بدون'],
                    ['المخالفات', car.fines > 0 ? `${money(car.fines)} ريال` : 'ما عليها'],
                    ['التسجيل', car.regType],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {tab === 'ad' && (
            <div className="pane">
              {lot.notes.length ? (
                <blockquote className="quote">
                  {lot.notes.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </blockquote>
              ) : (
                <p className="mute">المعلن ما كتب شي.</p>
              )}
              <p className="mute small">كلام المعلن على مسؤوليته، والفحص هو الحكم.</p>
            </div>
          )}

          {tab === 'specs' && (
            <div className="pane">
              <dl className="table">
                {(
                  [
                    ['المحرك', car.engine],
                    ['القوة', car.hp ? `${car.hp} حصان` : '—'],
                    ['الدفع', DRIVE_AR[car.drive]],
                    ['القير', transAr(car.trans)],
                    ['الوقود', FUEL_AR[car.fuel]],
                    ['الأبواب', `${car.doors}`],
                    ['الداخلية', car.interior],
                    ['المفاتيح', car.keys === 2 ? 'مفتاحين' : 'مفتاح واحد'],
                    ['الكفرات', `صنع ${car.tires}`],
                    ['التشغيل', car.runs === 'drive' ? 'تشتغل وتمشي' : car.runs === 'starts' ? 'تشتغل بس' : 'واقفة'],
                    ...(car.warranty ? [['الضمان', car.warranty.replace('ضمان وكالة ساري حتى ', 'وكالة لين ')]] : []),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
              {car.extras.length > 0 && (
                <div className="hints" style={{ marginTop: 12 }}>
                  {car.extras.map((e) => (
                    <span key={e} className="chip">{e}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
