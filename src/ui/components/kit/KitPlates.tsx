// The kit's plates section: the Saudi plate in both sizes, the three kinds, distinguished plates and the player's
// miniature, on the game's own background. Every number here is invented.
import type { PlatePub } from '../../../engine/types';
import { CarPlate, MiniPlate, type PlateLook } from '../Plate';

type P = PlatePub & PlateLook;
const p = (ar: string, en: string, num: string, look: PlateLook = {}, special?: PlatePub['special']): P => ({ ar, en, num, special, ...look });

const base = p('ح ط ب', 'J T B', '4821');

const KINDS: { label: string; plate: P }[] = [
  { label: 'خصوصي', plate: p('ر س ع', 'R S E', '7315') },
  { label: 'نقل خاص', plate: p('ط ك ن', 'T K N', '2604', { kind: 'transport' }) },
  { label: 'أجرة', plate: p('ق ل ك', 'G L K', '5190', { kind: 'taxi' }) },
];

const DISTINGUISHED: { label: string; plate: P }[] = [
  { label: 'رقم واحد وثلاثة أحرف', plate: p('م م م', 'Z Z Z', '3', {}, { tier: 'legend', label: 'لوحة أسطورية', value: 4_000_000 }) },
  { label: 'رقمان وحرفان', plate: p('ب ب', 'B B', '44', {}, { tier: 'top', label: 'لوحة مميزة', value: 180_000 }) },
  { label: 'حرف ورقم', plate: p('ع', 'E', '8', {}, { tier: 'rare', label: 'حرف ورقم', value: 2_500_000 }) },
  { label: 'ثلاثة أرقام', plate: p('هـ ل ا', 'H L A', '222', {}, { tier: 'special', label: 'رقم مكرر', value: 60_000 }) },
];

export function KitPlates() {
  return (
    <section className="kpl" dir="rtl">
      <h2>اللوحات</h2>

      <h3>المقاس العادي</h3>
      <div className="kpl-row">
        {(['lg', 'md', 'sm'] as const).map((s) => (
          <figure key={s}>
            <CarPlate plate={base} size={s} />
            <figcaption>{s === 'lg' ? 'كبير' : s === 'md' ? 'وسط' : 'صغير'}</figcaption>
          </figure>
        ))}
      </div>

      <h3>المقاس الطويل</h3>
      <div className="kpl-row">
        {(['lg', 'md'] as const).map((s) => (
          <figure key={s}>
            <CarPlate plate={p('ق س ط', 'G S T', '730', { format: 'eu' })} size={s} />
            <figcaption>{s === 'lg' ? 'كبير' : 'وسط'}</figcaption>
          </figure>
        ))}
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

      <h3>اللوحات المميزة</h3>
      <div className="kpl-row">
        {DISTINGUISHED.map((k) => (
          <figure key={k.label}>
            <CarPlate plate={k.plate} size="md" showValue />
            <figcaption>{k.label}</figcaption>
          </figure>
        ))}
      </div>

      <h3>كل الحروف</h3>
      <div className="kpl-row">
        <CarPlate plate={p('ا ب ح', 'A B J', '1234')} size="md" />
        <CarPlate plate={p('د ر س', 'D R S', '5678')} size="md" />
        <CarPlate plate={p('ص ط ع', 'X T E', '9012')} size="md" />
        <CarPlate plate={p('ق ك ل', 'G K L', '3456')} size="md" />
        <CarPlate plate={p('م ن هـ', 'Z N H', '7890')} size="md" />
        <CarPlate plate={p('و ى ص', 'U V X', '6060')} size="md" />
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
