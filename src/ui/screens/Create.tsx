import { useState } from 'react';
import { sound } from '../../audio/sound';
import { BUDGETS, DEFAULT_SETTINGS } from '../../engine/rules';
import type { Mix, Settings, Speed } from '../../engine/types';
import { arDigits, money, roomCode, store } from '../../lib/util';
import { go } from '../App';
import { toNum } from '../components/Console';
import { createHostRoom } from '../useRoom';

function Toggle({ on, set, title, note }: { on: boolean; set: (v: boolean) => void; title: string; note: string }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={on} onClick={() => set(!on)}>
      <span>
        <b>{title}</b>
        <small>{note}</small>
      </span>
      <span className="switch" />
    </button>
  );
}

export function Create() {
  const [name, setName] = useState(() => store.get('mzk:name', ''));
  const [s, setS] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [custom, setCustom] = useState('');
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const preset = BUDGETS.find((b) => b.amount === s.budget);
  const ok = name.trim().length >= 2 && s.budget >= 50_000;

  const submit = () => {
    if (!ok) return;
    sound.unlock();
    const code = roomCode();
    createHostRoom(code, name.trim(), { ...s, roomName: s.roomName.trim() || `مزاد ${name.trim()}` });
    go(`/r/${code}`);
  };

  return (
    <main className="shell narrow">
      <div className="page-head">
        <button className="btn btn-quiet" onClick={() => go('/')}>رجوع</button>
        <span className="chip chip-green">صالة جديدة</span>
      </div>
      <form
        className="stack"
        style={{ gap: 18 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div>
          <h1 className="section-title">افتح الصالة</h1>
          <p className="section-sub">أنت الدلال والمضيف، وتسوم مع الشباب بعد.</p>
        </div>

        <section className="card form-card">
        <label className="field">
          <span>اسمك</span>
          <input className="input" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} placeholder="نايف" autoComplete="nickname" />
        </label>
        <label className="field">
          <span>اسم الصالة</span>
          <input className="input" value={s.roomName} maxLength={28} onChange={(e) => set('roomName', e.target.value)} placeholder={name ? `مزاد ${name}` : 'مزاد الليلة'} />
        </label>

        <div className="field">
          <span>ميزانية كل لاعب</span>
          <div className="budgets">
            {BUDGETS.map((b) => (
              <button type="button" key={b.key} className="budget" aria-pressed={s.budget === b.amount} onClick={() => { set('budget', b.amount); setCustom(''); }}>
                <b>{b.label}</b>
                <span className="t-money">{money(b.amount)}</span>
                <small>{b.note}</small>
              </button>
            ))}
          </div>
          <input
            className="input"
            inputMode="numeric"
            placeholder="مبلغ ثاني"
            value={custom}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d٠-٩]/g, '');
              setCustom(v);
              const n = toNum(v);
              if (n >= 50_000) set('budget', Math.min(50_000_000, n));
            }}
            style={{ direction: 'ltr', textAlign: 'center', fontWeight: 900, fontSize: 20 }}
          />
          {!preset && <small className="mute">ميزانية خاصة: {money(s.budget)} ريال</small>}
        </div>
        </section>

        <section className="card form-card">

        <div className="field">
          <span>كم سيارة يشيل الكراج</span>
          <div className="seg">
            {[3, 4, 5, 6].map((n) => (
              <button type="button" key={n} aria-pressed={s.garage === n} onClick={() => set('garage', n)} aria-label={`${n} سيارات`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="row between wrap">
          <div className="field">
            <span>أقصى عدد لاعبين</span>
            <div className="stepper">
              <button type="button" onClick={() => set('maxPlayers', Math.max(2, s.maxPlayers - 1))} aria-label="أقل">−</button>
              <output>{arDigits(s.maxPlayers)}</output>
              <button type="button" onClick={() => set('maxPlayers', Math.min(10, s.maxPlayers + 1))} aria-label="أكثر">+</button>
            </div>
          </div>
          <div className="field">
            <span>عدد السيارات بالمزاد</span>
            <div className="stepper">
              <button type="button" onClick={() => set('lots', s.lots <= 8 ? 0 : s.lots - 2)} aria-label="أقل">−</button>
              <output style={{ fontSize: s.lots ? 28 : 18 }}>{s.lots ? arDigits(s.lots) : 'تلقائي'}</output>
              <button type="button" onClick={() => set('lots', Math.min(40, (s.lots || 10) + 2))} aria-label="أكثر">+</button>
            </div>
          </div>
        </div>

        <div className="field">
          <span>سرعة المزاد</span>
          <div className="seg">
            {([['fast', 'سريع'], ['normal', 'عادي'], ['calm', 'هادي']] as [Speed, string][]).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={s.speed === k} onClick={() => set('speed', k)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>نوع السوق</span>
          <div className="seg">
            {([['balanced', 'متوازن'], ['luxury', 'فخامة'], ['street', 'حراج شعبي']] as [Mix, string][]).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={s.mix === k} onClick={() => set('mix', k)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        </section>

        <div className="stack" style={{ gap: 8 }}>
          <Toggle on={s.estimate} set={(v) => set('estimate', v)} title="تقدير الدلال يظهر" note="نطاق سعر تقريبي على كل سيارة. طفّه للخبراء" />
          <Toggle on={s.covered} set={(v) => set('covered', v)} title="سيارات تحت الغطا" note="تسوم وأنت ما تدري وش تحت الغطا" />
          <Toggle on={s.sealed} set={(v) => set('sealed', v)} title="الظرف المختوم" note="سوم سري مرة وحدة، وأعلى ظرف ياخذها" />
          <Toggle on={s.fee > 0} set={(v) => set('fee', v ? 2.5 : 0)} title="السعي والضريبة" note="سعي 2.5% + ضريبة 15% عليه + 150 نقل ملكية، مثل الحراج" />
        </div>

        <div className="card form-card">
        <div className="field">
          <span>وزن تقييم الشباب في النتيجة</span>
          <div className="seg">
            {[0.3, 0.5, 0.7].map((w) => (
              <button type="button" key={w} aria-pressed={s.ratingWeight === w} onClick={() => set('ratingWeight', w)}>
                <span className="ltr">{Math.round(w * 100)}%</span>
              </button>
            ))}
          </div>
          <small className="mute">الباقي على الشطارة: كم ربحت من السيارات اللي شريتها</small>
        </div>
        </div>

        <button className="btn btn-gold btn-block" style={{ minHeight: 58, fontSize: 19 }} disabled={!ok}>
          افتح الصالة
        </button>
      </form>
    </main>
  );
}
