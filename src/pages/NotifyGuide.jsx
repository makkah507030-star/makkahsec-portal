import logoIcon from "../assets/icon-mint.png";

// صفحة إرشاد تفعيل إشعارات الجوال — تُربط من قسم الإشعارات ومن أماكن أخرى
const IOS = [
  "افتح makkahsec.com في متصفّح Safari",
  "اضغط زر المشاركة (المربّع والسهم للأعلى)",
  "اختر «إضافة إلى الشاشة الرئيسية»",
  "افتح البوابة من الأيقونة الجديدة (لا من Safari)",
  "من الصفحة الرئيسية اضغط «تفعيل الإشعارات» واسمح بالإذن",
];
const ANDROID = [
  "افتح makkahsec.com في متصفّح Chrome",
  "اضغط قائمة النقاط الثلاث (⋮) بأعلى المتصفّح",
  "اختر «إضافة إلى الشاشة الرئيسية» / «تثبيت التطبيق»",
  "من الصفحة الرئيسية اضغط «تفعيل الإشعارات» واسمح بالإذن",
];

function Steps({ title, sub, items }) {
  return (
    <section className="rounded-card border border-line bg-white p-5">
      <div className="mb-4">
        <p className="text-base font-bold text-mint-deep">{title}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
      <ol className="space-y-3">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-deep text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-0.5 text-sm leading-relaxed text-ink">{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function NotifyGuide() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="rounded-card border border-[#CCF2DB] bg-mint-tint px-5 py-6 text-center">
        <img src={logoIcon} alt="" className="mx-auto h-12 w-12 object-contain" />
        <h1 className="mt-3 text-xl font-bold text-mint-deep">تفعيل إشعارات الجوال</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          فعّل الخدمة لتصلك تعاميم وإشعارات البوابة على شاشة جوالك مباشرة — حتى والبوابة
          مغلقة. لا حاجة لتحميل تطبيق من المتجر.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Steps title="آيفون / آيباد" sub="عبر متصفّح Safari · يتطلب iOS 16.4 فأحدث" items={IOS} />
        <Steps title="أندرويد" sub="عبر متصفّح Chrome" items={ANDROID} />
      </div>

      <section className="rounded-card border border-[#F0D9A0] bg-[#FFF7E6] px-5 py-4">
        <p className="text-sm font-bold text-[#7a5a12]">ملاحظات مهمة</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#7a5a12]">
          <li>• على الآيفون: لا تظهر الإشعارات إلا بعد فتح البوابة من الأيقونة المثبّتة (لا من Safari).</li>
          <li>• عند ظهور طلب الإذن، اختر «السماح».</li>
          <li>• نفس طريقة التثبيت مفيدة أيضًا مع نظام نور ومنصة مدرستي.</li>
        </ul>
      </section>
    </div>
  );
}
