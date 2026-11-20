// «كيف نلعب»: one title and one ruled list of the five steps of a night. Each step is a short title in the voice
// and one sentence, and beside it the real thing it talks about, drawn small from the kit: the invitation slip,
// the car's plate, the price tag, the stamp on the receipt, the wheel. The one action sits in the sticky bar.
// Styles: src/styles/s-home.css.
import type { ReactNode } from 'react';
import { sound } from '../../audio/sound';
import { loadMarket } from '../../data/market';
import { go } from '../App';
import { Icon } from '../components/Bits';
import { CarPlate } from '../components/Plate';
import { Wheel } from '../components/Wheel';
import { PriceTag } from '../components/kit/PriceTag';
import { Receipt } from '../components/kit/Receipt';
import { ScreenTitle } from '../components/kit/ScreenTitle';
import { Stamp } from '../components/kit/Stamp';

export { HowToLines } from '../components/kit/HowToLines';

type Step = { title: string; body: string; thing: ReactNode };

const STEPS: Step[] = [
  {
    title: 'واحد يفتح الصالة',
    body: 'يحدد الميزانية ويرسل الكود للشباب، وجواله يشغّل المزاد فخلّه مفتوح.',
    thing: (
      <span className="hm-slip" aria-hidden="true">
        <span className="hm-slip-k">كود الصالة</span>
        <span className="hm-slip-code ltr">K7Q2PM</span>
      </span>
    ),
  },
  {
    title: 'عاين السيارة',
    body: 'كل سيارة بصورها وتقرير فحصها، وركّز على ملاحظات الفاحص.',
    thing: <CarPlate plate={{ ar: 'ح ط ب', en: 'J T B', num: '4821', kind: 'private', format: 'us' }} size="sm" />,
  },
  {
    title: 'سُم عليها',
    body: '«زاود» يرفع السوم، وبعض السيارات تجي بظرف مختوم أو مغطاة أو سعرها ينزل.',
    thing: <PriceTag compact state="live" amount={48000} />,
  },
  {
    title: 'رست عليك',
    body: 'تدفع السوم مع السعي، وبعدها تنكشف قيمتها: يا لقطة يا انقصّ عليك.',
    thing: (
      <span className="hm-paid" aria-hidden="true">
        <span className="hm-paid-in">
          <Receipt no={3} rows={[{ label: 'السوم', amount: 48000 }, { label: 'السعي', amount: 1200 }]} total={49200} />
          <Stamp kind="sold" className="hm-paid-stamp" />
        </span>
      </span>
    ),
  },
  {
    title: 'التقييم السري',
    body: 'آخر الليل كل واحد يقيّم كراجات الباقين، والنتيجة تجمع التقييم مع ربحك.',
    thing: <Wheel size={84} />,
  },
];

export function HowTo() {
  return (
    <div className="hm-how">
      <main className="hm-how-main">
        <button className="hm-chalk hm-how-back" onClick={() => go('/')}>
          <Icon name="back" size={18} />
          رجوع
        </button>
        <ScreenTitle>كيف نلعب</ScreenTitle>
        <ol className="hm-steps">
          {STEPS.map((s) => (
            <li key={s.title} className="hm-step">
              <div className="hm-step-txt">
                <h2 className="hm-step-t">{s.title}</h2>
                <p className="hm-step-b">{s.body}</p>
              </div>
              <div className="hm-step-thing" aria-hidden="true">{s.thing}</div>
            </li>
          ))}
        </ol>
      </main>
      <div className="hm-bar hm-how-bar">
        <div className="hm-bar-in">
          <button
            className="btn btn-primary btn-block hm-open"
            onClick={() => {
              sound.unlock();
              loadMarket().catch(() => {});
              go('/new');
            }}
          >
            افتح مزاد جديد
          </button>
        </div>
      </div>
    </div>
  );
}
