// The design kit (#/kit): the type roles, the icons and every shared object in every state, on the game's
// own background. It is the reference the screens are built from and reviewed against.
import { useState } from 'react';
import { ICON_NAMES, Icon } from '../components/Bits';
import { Facts } from '../components/kit/Facts';
import { Field, Seg, Stepper, Switch } from '../components/kit/Field';
import { HowToLines } from '../components/kit/HowToLines';
import { KitObjects } from '../components/kit/KitObjects';
import { KitPlates } from '../components/kit/KitPlates';
import { Rows } from '../components/kit/Rows';
import { ScreenTitle } from '../components/kit/ScreenTitle';

const VOICE = [
  ['voice-xl', '--t-voice-xl · 44', 'بيعت على نايف'],
  ['voice-l', '--t-voice-l · 34', 'الصالة مفتوحة'],
  ['voice-m', '--t-voice-m · 26', 'على السوم يا جماعة'],
  ['voice-s', '--t-voice-s · 22', 'افتح المزاد الحين'],
] as const;

const PRINT = [
  ['print-xxl', '--t-print-xxl · 68', '185,000'],
  ['print-xl', '--t-print-xl · 54', '0:09'],
  ['print-l', '--t-print-l · 32', '2,450,000'],
  ['print-m', '--t-print-m · 22', '1,250,000'],
  ['print-s', '--t-print-s · 16', '01/10 · 182,000'],
] as const;

const TEXT = [
  ['text-body', '--t-body · 17', 'تسوم وأنت ما تدري وش تحت الغطا، وأعلى سوم ياخذها.'],
  ['text-sub', '--t-sub · 15', 'نطاق سعر تقريبي على كل سيارة. طفّه للخبراء.'],
  ['text-cap', '--t-cap · 13', 'محد يشوف ظرفك لين تنفتح الظروف'],
] as const;

function Sec({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="kit-sec">
      <h2 className="kit-h">{title}</h2>
      {note && <p className="kit-note">{note}</p>}
      {children}
    </section>
  );
}

export default function Kit() {
  const [speed, setSpeed] = useState<'fast' | 'normal' | 'calm'>('normal');
  const [garage, setGarage] = useState(5);
  const [players, setPlayers] = useState(6);
  const [estimate, setEstimate] = useState(true);
  const [covered, setCovered] = useState(false);

  return (
    <main className="kit" dir="rtl">
      <ScreenTitle caption="الخطوط والأيقونات والقطع اللي تنبني منها كل شاشة في اللعبة">عدّة المزاد</ScreenTitle>

      <Sec title="ثلاثة أصوات" note="كل نص في اللعبة واحد من الثلاثة، وما فيه خط رابع.">
        <div className="kit-roles">
          <div className="kit-role">
            <b>الصوت · Lalezar</b>
            <p>عنوان الشاشة، كلمة الختم، صيحة الدلال، أسماء الجوائز، وزر الشاشة الأساسي. جمل قصيرة، ٢٢ وفوق، وزن واحد.</p>
          </div>
          <div className="kit-role">
            <b>المطبوع · Barlow Condensed</b>
            <p>كل رقم مطبوع على شي أو ينعد: السعر، المحفظة، العداد، الساعة، الملصق، الفاتورة، حروف اللوحة.</p>
          </div>
          <div className="kit-role">
            <b>النص · Readex Pro</b>
            <p>كل شي ينقرا كجملة، والعناوين الصغيرة، والأزرار الثانوية. الرقم داخل الجملة يبقى نص.</p>
          </div>
        </div>
        {VOICE.map(([c, k, t]) => (
          <div className="kit-spec" key={c}>
            <span className={c}>{t}</span>
            <small>{k}</small>
          </div>
        ))}
        {PRINT.map(([c, k, t]) => (
          <div className="kit-spec" key={c}>
            <span className={c}>{t}</span>
            <small>{k}</small>
          </div>
        ))}
        {TEXT.map(([c, k, t]) => (
          <div className="kit-spec" key={c}>
            <span className={c}>{t}</span>
            <small>{k}</small>
          </div>
        ))}
      </Sec>

      <Sec title="الأزرار" note="زر الشاشة الأساسي بالصوت والرقم عليه مطبوع، وباقي الأزرار بالنص العريض. يمين جاهز، ويسار مقفول.">
        <div className="kit-btns">
          <button className="btn btn-primary btn-block bid-main" type="button">
            <span className="bm-label">زاود</span>
            <span className="bm-amt">
              <b>185,000</b>
              <small>ريال</small>
            </span>
          </button>
          <div className="kit-btn-pair">
            <div>
              <button className="btn btn-primary" type="button">ابدأ</button>
            </div>
            <div>
              <button className="btn btn-primary" type="button" disabled>ابدأ</button>
            </div>
          </div>
          <div className="kit-btn-pair">
            <div>
              <button className="btn btn-gold" type="button">افتح الصالة</button>
            </div>
            <div>
              <button className="btn btn-gold" type="button" disabled>افتح الصالة</button>
            </div>
          </div>
          <div className="kit-btn-pair">
            <div>
              <button className="btn btn-ghost" type="button">
                <Icon name="share" />
                شارك كراجك
              </button>
            </div>
            <div>
              <button className="btn btn-ghost" type="button" disabled>
                <Icon name="share" />
                شارك كراجك
              </button>
            </div>
          </div>
          <div className="kit-btn-pair">
            <div>
              <button className="btn btn-dark" type="button">التالي</button>
            </div>
            <div>
              <button className="btn btn-danger" type="button">سكّر الصالة</button>
            </div>
          </div>
          <div className="kit-icon-btns">
            <button className="btn btn-quiet" type="button">عدّل</button>
            <button className="btn btn-quiet" type="button">
              <Icon name="list" />
              سجلي
            </button>
            <button className="iconbtn tb-btn" type="button" aria-label="الصوت">
              <Icon name="sound" />
            </button>
            <button className="iconbtn tb-btn" type="button" aria-label="اللاعبين">
              <Icon name="users" />
            </button>
            <button className="iconbtn tb-btn" type="button" aria-label="القائمة">
              <Icon name="list" />
            </button>
          </div>
        </div>
      </Sec>

      <Sec title="الأيقونات" note="عائلة واحدة: Phosphor بوزن عريض للأشرطة والأزرار، ومعبّاة للعلامات الصغيرة. الكفر مرسوم بنفس الوزن.">
        <ul className="kit-icons">
          {ICON_NAMES.map((n) => (
            <li key={n}>
              <Icon name={n} size={26} />
              <small>{n}</small>
            </li>
          ))}
        </ul>
        <div className="kit-icon-weights">
          <span>
            <Icon name="crown" size={16} weight="fill" />
            الأعلى
          </span>
          <span className="ok">
            <Icon name="check" size={16} weight="fill" />
            انفحصت
          </span>
          <span>
            <Icon name="timer" size={16} weight="fill" />
            آخر ثواني
          </span>
          <span>
            <Icon name="info" size={16} weight="fill" />
            وش يعني
          </span>
        </div>
      </Sec>

      <Sec title="العنوان والصفوف والحقائق" note="بدال الكروت: عنوان واحد للشاشة، صفوف مسطّرة، وحقائق بسطر واحد بدال الحبوب.">
        <div className="kit-stack">
          <ScreenTitle caption="الكود يوصلك لصالة نايف">الصالة</ScreenTitle>
          <Rows
            items={[
              { k: 'الميزانية', v: '2,000,000', print: true },
              { k: 'السيارات بالمزاد', v: '10', print: true },
              { k: 'سرعة المزاد', v: 'عادي' },
              { k: 'السعي والضريبة', v: 'سعي 2.5% وضريبة 15% عليه' },
            ]}
          />
          <Facts
            items={[
              'لاندكروزر 2019',
              '182,000 كم',
              { t: 'فحص سليم', tone: 'good' },
              { t: 'صدمة خفيفة قدام', tone: 'warn' },
              'تحت الغطا',
            ]}
          />
        </div>
      </Sec>

      <Sec title="الإعدادات" note="كل أداة لها اسم مكتوب. المسار غاطس بالمطاط، والمختار ورق أبيض بحبر أسود.">
        <Field label="سرعة المزاد" hint="كم ثانية يصبر الدلال قبل ما يدق">
          <Seg
            value={speed}
            onChange={setSpeed}
            options={[
              { v: 'fast', label: 'سريع' },
              { v: 'normal', label: 'عادي' },
              { v: 'calm', label: 'هادي' },
            ]}
          />
        </Field>
        <Field label="كم سيارة يشيل الكراج">
          <Seg
            print
            value={garage}
            onChange={setGarage}
            options={[3, 5, 7].map((n) => ({ v: n, label: n, aria: `${n} سيارات` }))}
          />
        </Field>
        <Field label="أقصى عدد لاعبين" hint="من ٢ إلى ١٠">
          <Stepper
            value={players}
            onDec={() => setPlayers((p) => Math.max(2, p - 1))}
            onInc={() => setPlayers((p) => Math.min(10, p + 1))}
            canDec={players > 2}
            canInc={players < 10}
          />
        </Field>
        <Field label="تقدير الدلال يظهر" hint="نطاق سعر تقريبي على كل سيارة. طفّه للخبراء">
          <Switch on={estimate} onChange={setEstimate} label="تقدير الدلال يظهر" />
        </Field>
        <Field label="سيارات تحت الغطا" hint="تسوم وأنت ما تدري وش تحت الغطا">
          <Switch on={covered} onChange={setCovered} label="سيارات تحت الغطا" />
        </Field>
      </Sec>

      <Sec title="كيف نلعب بثلاثة أسطر" note="HowToLines: لشاشة الدخول والصالة. صفوف مسطّرة ورقم مطبوع صغير، بلا دوائر.">
        <HowToLines />
      </Sec>

      <KitObjects />
      <KitPlates />
    </main>
  );
}
