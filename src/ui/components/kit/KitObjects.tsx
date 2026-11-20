// The kit's objects section: the price tag, the stamp, the sticker, the receipt and the rolling number, in every
// state, with controls to see each one move.
import { useState } from 'react';
import { PriceTag } from './PriceTag';
import { Stamp } from './Stamp';
import { Sticker } from './Sticker';
import { Receipt } from './Receipt';
import { RollNumber } from './RollNumber';

const STEPS = [1000, 2500, 5000, 10000];

export function KitObjects() {
  const [bid, setBid] = useState(48500);
  const [step, setStep] = useState(0);
  const [slam, setSlam] = useState(0);
  const [print, setPrint] = useState(0);
  const [roll, setRoll] = useState(9_850);

  const raise = () => {
    setBid((b) => b + STEPS[step % STEPS.length]);
    setStep((s) => s + 1);
  };

  return (
    <section className="kobj" aria-labelledby="kobj-h">
      <h2 id="kobj-h" className="kobj-h">الأغراض</h2>

      <div className="kobj-sec">
        <h3 className="kobj-t">بطاقة السعر</h3>
        <p className="kobj-d">قبل أول سوم، ووقت السوم، ولما يكون السوم معك، وبعد ما يرسى.</p>
        <div className="kobj-stack">
          <PriceTag state="open" amount={30000} />
          <PriceTag state="live" amount={bid} who={{ no: 7, name: 'أبو فهد' }} />
          <PriceTag state="live" amount={1_250_000} who={{ no: 3, name: 'نايف' }} mine />
          <PriceTag state="final" amount={212_000} who={{ no: 12, name: 'عبدالرحمن الشمري' }} />
        </div>
        <div className="kobj-ctl">
          <button type="button" className="btn btn-ghost" onClick={raise}>
            زِد السوم
          </button>
        </div>
      </div>

      <div className="kobj-sec">
        <h3 className="kobj-t">الختم</h3>
        <p className="kobj-d">ينختم على صورة السيارة مرة وحدة.</p>
        <div className="kobj-photos" key={slam}>
          <div className="kobj-photo">
            <Stamp kind="sold" sub="سيارة رقم 3" />
          </div>
          <div className="kobj-photo">
            <Stamp kind="mine" sub="سيارة رقم 5" />
          </div>
          <div className="kobj-photo">
            <Stamp kind="unsold" />
          </div>
        </div>
        <div className="kobj-ctl">
          <button type="button" className="btn btn-ghost" onClick={() => setSlam((n) => n + 1)}>
            اختم مرة ثانية
          </button>
        </div>
      </div>

      <div className="kobj-sec">
        <h3 className="kobj-t">ملصق الرقم</h3>
        <div className="kobj-row kobj-glass">
          <Sticker no={3} />
          <Sticker no={7} of={10} />
        </div>
      </div>

      <div className="kobj-sec">
        <h3 className="kobj-t">الحساب</h3>
        <Receipt
          key={print}
          no={1}
          rows={[
            { label: 'سعر الرسو', amount: 212000 },
            { label: 'السعي', amount: 5300 },
            { label: 'ضريبة القيمة المضافة 15% على السعي', amount: 795 },
            { label: 'رسوم نقل الملكية', amount: 150 },
          ]}
          total={218245}
          note="مبروك، الله يهنيك فيها"
        />
        <div className="kobj-ctl">
          <button type="button" className="btn btn-ghost" onClick={() => setPrint((n) => n + 1)}>
            اطبع مرة ثانية
          </button>
        </div>
      </div>

      <div className="kobj-sec">
        <h3 className="kobj-t">الرقم اللي يدور</h3>
        <div className="kobj-roll">
          <RollNumber value={roll} />
        </div>
        <div className="kobj-ctl">
          <button type="button" className="btn btn-ghost" onClick={() => setRoll((v) => v + 137)}>
            زِد
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setRoll((v) => Math.max(0, v - 137))}>
            نقّص
          </button>
        </div>
      </div>
    </section>
  );
}
