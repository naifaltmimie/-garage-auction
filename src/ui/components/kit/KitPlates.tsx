// The kit's plates section: the Saudi plate in both sizes, every kind, the logo plates, distinguished plates and the
// player's miniature, on the game's own background.
import type { PlatePub } from '../../../engine/types';
import { CarPlate, MiniPlate, type PlateLook } from '../Plate';

type P = PlatePub & PlateLook;
const p = (ar: string, en: string, num: string, look: PlateLook = {}, special?: PlatePub['special']): P => ({ ar, en, num, special, ...look });

const base = p('ح ط ب', 'J T B', '4821');

const KINDS: { label: string; plate: P }[] = [
  { label: 'خصوصي', plate: p('ر س ع', 'R S E', '7315') },
  { label: 'نقل خاص', plate: p('ط ك ن', 'T K N', '2604', { kind: 'transport' }) },
  { label: 'أجرة', plate: p('ق ل ك', 'G L K', '5190', { kind: 'taxi' }) },
  { label: 'دبلوماسية', plate: p('د ب ل', 'D B L', '1043', { kind: 'diplomatic' }) },
  { label: 'مؤقتة', plate: p('م و ق', 'Z U G', '8827', { kind: 'temporary' }) },
];

const LOGOS: { label: string; plate: P }[] = [
  { label: 'بشعار: الشعار الوطني', plate: p('س ع د', 'S E D', '2030', { logo: 'emblem' }) },
  { label: 'بشعار: الحِجر', plate: p('ح ص ر', 'J X R', '1001', { logo: 'hegra' }) },
  { label: 'بشعار: الطريف', plate: p('د ر ع', 'D R E', '1744', { logo: 'diriyah' }) },
];

const DISTINGUISHED: { label: string; plate: P }[] = [
  { label: 'رقم واحد', plate: p('ا ا ا', 'A A A', '1', {}, { tier: 'legend', label: 'لوحة أسطورية', value: 4_000_000 }) },
  { label: 'كلمة ورقم', plate: p('ص ق ر', 'X G R', '7', {}, { tier: 'rare', label: 'صقر ٧', value: 900_000 }) },
  { label: 'حرفان ورقمان', plate: p('ب ب', 'B B', '55', {}, { tier: 'top', label: 'لوحة مميزة', value: 180_000 }) },
  { label: 'حرف ورقم', plate: p('ح', 'J', '5', {}, { tier: 'legend', label: 'حرف ورقم', value: 2_500_000 }) },
  { label: 'ثلاثة أرقام', plate: p('ر د م', 'R D Z', '777', {}, { tier: 'special', label: 'رقم مكرر', value: 60_000 }) },
];

export function KitPlates() {
  return (
    <section className="kpl" dir="rtl">
      <h2>اللوحات</h2>

      <h3>المقاس الأمريكي</h3>
      <div className="kpl-row">
        <figure>
          <CarPlate plate={base} size="lg" />
          <figcaption>كبير</figcaption>
        </figure>
        <figure>
          <CarPlate plate={base} size="md" />
          <figcaption>وسط</figcaption>
        </figure>
        <figure>
          <CarPlate plate={base} size="sm" />
          <figcaption>صغير</figcaption>
        </figure>
      </div>

      <h3>المقاس الطويل</h3>
      <div className="kpl-row">
        <figure>
          <CarPlate plate={{ ...base, format: 'eu' } as P} size="lg" />
          <figcaption>كبير</figcaption>
        </figure>
        <figure>
          <CarPlate plate={{ ...base, format: 'eu' } as P} size="md" />
          <figcaption>وسط</figcaption>
        </figure>
      </div>

      <h3>أنواع اللوحات</h3>
      <div className="kpl-row">
        {KINDS.map((k) => (
          <figure key={k.label}>
            <CarPlate plate={k.plate} size="md" />
            <figcaption>{k.label}</figcaption>
          </figure>
        ))}
      </div>

      <h3>لوحات بشعار</h3>
      <div className="kpl-row">
        {LOGOS.map((k) => (
          <figure key={k.label}>
            <CarPlate plate={k.plate} size="lg" />
            <figcaption>{k.label}</figcaption>
          </figure>
        ))}
        <figure>
          <CarPlate plate={{ ...LOGOS[1].plate, format: 'eu' } as P} size="md" />
          <figcaption>بشعار، المقاس الطويل</figcaption>
        </figure>
      </div>

      <h3>اللوحات المميزة</h3>
      <div className="kpl-row">
        {DISTINGUISHED.map((k) => (
          <figure key={k.label}>
            <CarPlate plate={k.plate} size="md" showValue />
            <figcaption>{k.label}</figcaption>
          </figure>
        ))}
      </div>

      <h3>أربعة أرقام وحرف عريض</h3>
      <div className="kpl-row">
        <figure>
          <CarPlate plate={p('ص ط ص', 'X T X', '9086')} size="lg" />
          <figcaption>ص ط ص</figcaption>
        </figure>
        <figure>
          <CarPlate plate={p('ص ط ص', 'X T X', '9086')} size="sm" />
          <figcaption>صغير</figcaption>
        </figure>
      </div>

      <h3>لوحة اللاعب</h3>
      <div className="kpl-row">
        <figure>
          <span className="kpl-name">
            <MiniPlate letters={['ن ا ى', 'V A N']} />
            نايف
          </span>
          <figcaption>بجانب الاسم</figcaption>
        </figure>
      </div>
    </section>
  );
}
