import { go } from '../App';

export function HowTo() {
  return (
    <main className="shell narrow">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn btn-quiet" onClick={() => go('/')}>رجوع</button>
        <span className="brandmark">
          مزاد <em>الكراج</em>
        </span>
      </div>
      <h1 className="section-title">كيف نلعب</h1>
      <ol className="howto" style={{ padding: 0, marginTop: 14 }}>
        <li className="card">
          <b>واحد يفتح الصالة</b>
          <span>يحدد الميزانية وكم سيارة يشيل الكراج، ويرسل الرابط أو الكود للشباب. جواله هو اللي يشغّل المزاد، فيخليه مفتوح.</span>
        </li>
        <li className="card">
          <b>المعاينة</b>
          <span>كل سيارة تطلع بتقرير فحص: الممشى، المواصفات، خريطة البودي بقراءة جهاز الطلاء، سجل نجم، فحص الكمبيوتر، وكلام المعلن. انتبه لملاحظات الفاحص.</span>
        </li>
        <li className="card">
          <b>السوم</b>
          <span>«زاود» يرفع السوم خطوة، أو تسوم بمبلغ حر. أي سوم بآخر الثواني يمدد الوقت. «عليها حد» يعني فيه سعر أدنى مخفي، و«بدون حد» تنباع بأي سعر.</span>
        </li>
        <li className="card">
          <b>البيعة</b>
          <span>تدفع السوم مع السعي وضريبته ونقل الملكية. بعدها تنكشف القيمة الحقيقية: يا لقطة يا انقصّ عليك، ومرات تطلع مفاجأة حلوة أو شينة.</span>
        </li>
        <li className="card">
          <b>لوتات خاصة</b>
          <span>«تحت الغطا» تسوم وأنت ما تدري وش السيارة. «الظرف المختوم» كل واحد يكتب سوم سري مرة وحدة، وأعلى ظرف ياخذها.</span>
        </li>
        <li className="card">
          <b>الكراجات والتقييم السري</b>
          <span>بالأخير كل واحد يقيّم كراجات الباقين من 1 إلى 10، ومحد يشوف تقييم أحد. النتيجة تجمع التقييم مع شطارتك بالشراء.</span>
        </li>
      </ol>
      <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => go('/new')}>
        افتح مزاد
      </button>
    </main>
  );
}
