// The car's file on #/kit: the real LotSheet in every state it must survive, built from lots the engine dealt
// (sheetSamples.ts) with the hard cases pushed further. `?sheet=<state>#/kit` shows one state alone, at phone
// width, under a stand-in top bar, for screenshots.
import type { CarPub, LotPub, PanelId, PanelStatus } from '../../../engine/types';
import { LotSheet } from '../LotSheet';
import { SAMPLE_LOTS as S } from './sheetSamples';

type State = { label: string; lot: LotPub; revealed?: CarPub; reserveMet?: boolean };

const car = (l: LotPub, c: Partial<CarPub>): LotPub => ({ ...l, car: { ...l.car!, ...c } });

const AD_600 =
  'السلام عليكم، يوكن دينالي 2025 ممشى 16 ألف بس، السيارة نظيفة جداً ما عليها أي ملاحظة، صيانتها كلها بالوكالة وآخر صيانة قبل شهرين. ' +
  'الرش بس صدام قدام وصدام ورا من خدوش مواقف، والباقي كله وكالة. الكفرات جديدة والبطارية جديدة. ' +
  'فيها كل الإضافات: سقف بانوراما، كاميرا 360، شاشات خلفية، تبريد وتدفئة للكراسي، دعاسات كهربائية، ركن تلقائي. ' +
  'البيع لعدم الحاجة، السوم يبدأ من 330 ألف والحد 360 ألف، الجادين فقط، الفحص في أي مركز تبيه على حسابك. ' +
  'ما أرد على الرسائل، اتصال فقط بعد العصر. المكان الرياض حي الملقا، والنقل على المشتري.';

const DAMAGED_PANELS: Partial<Record<PanelId, PanelStatus>> = {
  fb: 'damaged', hood: 'replaced', lff: 'replaced', rff: 'dent', lfd: 'paint', lrd: 'spot', rb: 'paint', trunk: 'unknown',
  roof: 'ok', lrq: 'paint', rfd: 'ok', rrd: 'spot', rrq: 'ok',
};

export const SHEET_STATES: Record<string, State> = {
  clean: { label: 'نظيفة', lot: S.clean },
  damaged: {
    label: 'مصدومة',
    lot: {
      ...car(S.yukon, {
        panels: DAMAGED_PANELS,
        microns: { fb: null, hood: 412, lff: 388, rff: 265, lfd: 210, lrd: 160, rb: 231, lrq: 198, rrd: 155 },
        specKind: 'us_salvage',
        spec: 'وارد أمريكا، سلفج',
        najm: 3,
        mech: { engine: 'minor', gearbox: 'ok', chassis: 'repaired', airbags: 'deployed', ac: 'weak', susp: 'minor' },
        scan: { status: 'active', codes: [['P0301', ''], ['B0012', ''], ['U0151', '']] },
        inspector: [
          'الصدام الأمامي مصدوم والقوايم الأمامية فيها أثر شد',
          'الكبوت والرفرف اليسار مغيّرين بقطع تجارية',
          'الإيرباقات الأمامية مفتوحة ومغيّرة، الطبلون فيه أثر فك',
          'لمبة المكينة شغالة ورجفة على السلندر الأول',
          'المكيف يبرد متأخر، يبي فريون أو كمبروسر',
        ],
      }),
      grade: 2.1,
      reserve: true,
    },
  },
  asis: { label: 'على الحالة', lot: S.asis },
  ad600: { label: 'إعلان طويل', lot: { ...S.yukon, notes: [AD_600] } },
  ad20: { label: 'إعلان قصير', lot: { ...S.staria, notes: ['نظيفة ومكيفها ثلج'], estimate: null } },
  nophotos: { label: 'بدون صور', lot: car(S.clean, { photos: [] }) },
  longname: {
    label: 'اسم طويل',
    lot: car(S.yukon, { modelAr: 'لاندكروزر جي اكس ار تيربو', trim: '', trimAr: undefined, makeAr: 'تويوتا', nick: undefined }),
  },
  exotic: {
    label: 'لوحة نادرة',
    lot: car(S.sf90, {
      plate: { ar: 'ع', en: 'E', num: '7', kind: 'private', format: 'us', special: { tier: 'rare', label: 'حرف ورقم', note: 'حرف واحد ورقم واحد', value: 2_500_000 } } as CarPub['plate'],
    }),
  },
  pickup: { label: 'ونيت نقل', lot: car(S.datsun, { plate: { ...S.datsun.car!.plate, kind: 'transport' } as CarPub['plate'], regType: 'نقل خاص' }) },
  taxi: {
    label: 'أجرة',
    lot: car(S.staria, {
      plate: { ar: 'ق ل ك', en: 'G L K', num: '5190', kind: 'taxi', format: 'us' } as CarPub['plate'],
      regType: 'أجرة عامة',
      story: {
        owner: 'كانت ليموزين عند مكتب أجرة',
        use: 'أغلب ممشاها مشاوير زباين، وقوف وطلوع طول اليوم',
        why: 'المكتب يبدّل سياراته القديمة',
        quirks: ['عداد الأجرة مفكوك وأثر براغيه باقي في الطبلون', 'الكرسي الخلفي اليمين ماسح أكثر من غيره'],
      },
    }),
  },
  longplate: {
    label: 'لوحة طويلة',
    lot: car(S.eclass, { modelAr: 'إي كلاس كوبيه كابريوليه', trim: 'AMG Line Night', trimAr: undefined }),
  },
  covered: { label: 'تحت الغطا', lot: S.covered },
  revealed: { label: 'بعد الغطا', lot: { ...S.covered }, revealed: S.coveredCar.car! },
};

export function sheetStateFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('sheet');
  } catch {
    return null;
  }
}

/** One state alone, as the auction screen holds it, under a stand-in top bar. */
export function KitSheetSolo({ id }: { id: string }) {
  const st = SHEET_STATES[id] ?? SHEET_STATES.clean;
  return (
    <>
      <div className="ksh-top" aria-hidden="true" />
      <main className="auction ksh-solo">
        <div className="lot-wrap">
          <LotSheet lot={st.lot} total={10} reserveMet={!!st.reserveMet} opening={st.lot.opening} revealed={st.revealed ?? null} />
        </div>
      </main>
    </>
  );
}

/** The kit's index of the sheet's states: each opens alone. */
export function KitSheet() {
  return (
    <ul className="ksh-list">
      {Object.entries(SHEET_STATES).map(([k, s]) => (
        <li key={k}>
          <a href={`?sheet=${k}#/kit`}>{s.label}</a>
        </li>
      ))}
    </ul>
  );
}
