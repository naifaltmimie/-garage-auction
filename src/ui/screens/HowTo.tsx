import { go } from '../App';
import { LOGO } from '../components/Logo';

export function HowTo() {
  return (
    <main className="shell narrow howto-page">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn btn-quiet" onClick={() => go('/')}>رجوع</button>
        <img className="howto-logo" src={LOGO.row} width={102} height={34} alt="مزاد الكراج" draggable={false} />
      </div>
      <h1 className="section-title">كيف نلعب</h1>
      <ol className="howto" style={{ padding: 0, marginTop: 14 }}>
        <li className="card">
          <b>واحد يفتح الصالة</b>
          <span>يحدد الميزانية ويرسل الكود للشباب، وجواله يشغّل المزاد فيخليه مفتوح.</span>
        </li>
        <li className="card">
          <b>عاين السيارة</b>
          <span>كل سيارة بصورها وتقرير فحصها، وركّز على ملاحظات الفاحص.</span>
        </li>
        <li className="card">
          <b>سُم عليها</b>
          <span>«زاود» يرفع السوم، وبعض السيارات تجي بظرف مختوم أو تحت الغطا أو سعرها ينزل.</span>
        </li>
        <li className="card">
          <b>رست عليك</b>
          <span>تدفع السوم مع السعي، وبعدها تنكشف قيمتها: يا لقطة يا انقصّ عليك.</span>
        </li>
        <li className="card">
          <b>التقييم السري</b>
          <span>بالأخير كل واحد يقيّم كراجات الباقين، والنتيجة تجمع التقييم مع ربحك.</span>
        </li>
      </ol>
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => go('/new')}>
        افتح مزاد
      </button>
    </main>
  );
}
