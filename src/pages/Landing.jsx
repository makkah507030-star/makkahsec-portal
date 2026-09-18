import { Link, useNavigate } from "react-router-dom";
import logoFull from "../assets/logo-full-mint.png";
import logoIcon from "../assets/icon-mint.png";
import CalendarTimeline from "../components/CalendarTimeline.jsx";
import NewsSlider from "../components/NewsSlider.jsx";
import TrialBanner from "../components/TrialBanner.jsx";
import ExamCountdown from "../components/ExamCountdown.jsx";

const SECTIONS = [
  {
    title: "الإدارة المدرسية",
    body: "متابعة الحضور والاستئذان، إدارة الطلاب والحسابات، واستخراج التقارير الرسمية.",
  },
  {
    title: "المعلمون",
    body: "تحضير الحصص من الجوال، والاطلاع على جدولك اليومي وحالات الاستئذان.",
  },
  {
    title: "الطلاب",
    body: "متابعة الجدول الدراسي وسجل الحضور والغياب أولًا بأول.",
  },
  {
    title: "أولياء الأمور",
    body: "الاطلاع على حضور أبنائكم وإشعارات المدرسة فور صدورها.",
  },
  {
    title: "أدلة الاستخدام",
    body: "أدلة إرشادية بصيغة PDF لكل فئة، تشرح الخدمات وطريقة الاستفادة منها.",
    to: "/guides",
  },
  {
    title: "الدعم الفني",
    body: "تذاكر الدعم لحل المشكلات التقنية بسرعة ووضوح.",
  },
];

const LINKS = [
  { name: "وزارة التعليم", url: "https://moe.gov.sa" },
  { name: "منصة مدرستي", url: "https://schools.madrasati.sa" },
  { name: "نظام نور", url: "https://noor.moe.gov.sa" },
  { name: "بوابة التعليم", url: "https://edugate.moe.gov.sa/" },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      <TrialBanner />

      {/* شريط علوي — نقطة الدخول الوحيدة للبوابة، ثابت طوال الصفحة */}
      <header className="sticky top-0 z-10 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-9 w-9 object-contain" />
            <div className="leading-tight">
              <p className="text-sm font-bold text-ink">بوابة مكة الثانوية الرقمية</p>
              <p className="text-xs text-muted">مدرسة مكة الثانوية</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="rounded-pill bg-mint-deep px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6AA786]"
          >
            الدخول للبوابة
          </button>
        </div>
      </header>

      {/* الواجهة */}
      <section className="relative overflow-hidden bg-mint-tint">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-28 -top-24 h-[26rem] w-[26rem] rounded-full bg-white/70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-32 h-72 w-72 rounded-full bg-[#CCF2DB]/60"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:py-20">
          <div>
            <p className="text-sm font-semibold text-[#6AA786]">
              العام الدراسي <span className="num">1448–1449</span>هـ
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-[1.35] text-ink md:text-[2.6rem]">
              كل ما تحتاجه المدرسة
              <br />
              في بوابة واحدة
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
              بوابة إلكترونية لمجتمع مدرسة مكة الثانوية — الكادر التعليمي والإداري
              وأولياء الأمور والطلاب — لمتابعة الحضور والجداول والتقارير في مكان واحد.
            </p>

            {/* بلا زر دخول مكرّر هنا — الزر الوحيد ثابت في الشريط العلوي */}
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#sections"
                className="rounded-pill border border-[#CCF2DB] bg-white px-7 py-3 text-sm font-semibold text-mint-deep transition-colors hover:bg-mint-tint"
              >
                تعرّف على الأقسام
              </a>
            </div>
          </div>

          <div className="hidden justify-self-center md:block">
            <img src={logoFull} alt="مدرسة مكة الثانوية" className="w-72" />
          </div>
        </div>
      </section>

      {/* العد التنازلي للاختبارات النهائية */}
      <div className="mx-auto max-w-6xl px-5 pt-10">
        <ExamCountdown />
      </div>

      {/* أخبار المدرسة */}
      <NewsSlider />

      {/* التقويم الدراسي */}
      <CalendarTimeline />

      {/* الأقسام */}
      <section id="sections" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-xl font-bold text-ink">أقسام البوابة</h2>
        <p className="mt-1.5 text-sm text-muted">
          لكل فئة في المدرسة واجهتها الخاصة بعد الدخول للبوابة.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            s.to ? (
              <Link
                key={s.title}
                to={s.to}
                className="rounded-card border border-line bg-white p-5 transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40"
              >
                <h3 className="text-sm font-bold text-mint-deep">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                <span className="mt-3 inline-block text-xs font-semibold text-[#6AA786]">
                  تصفّح الأدلة ←
                </span>
              </Link>
            ) : (
              <article
                key={s.title}
                className="rounded-card border border-line bg-white p-5 transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40"
              >
                <h3 className="text-sm font-bold text-mint-deep">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </article>
            )
          ))}
        </div>
      </section>

      {/* روابط رسمية */}
      <section className="bg-gray-tint">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <h2 className="text-xl font-bold text-ink">مواقع ذات صلة</h2>
          <p className="mt-1.5 text-sm text-muted">
            روابط المنصات الرسمية التابعة لوزارة التعليم.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LINKS.map((l) => (
              <a
                key={l.name}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-card border border-line bg-white px-5 py-4 text-sm font-medium text-ink transition-colors hover:border-[#CCF2DB] hover:text-mint-deep"
              >
                {l.name}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* مدير المدرسة */}
      <section className="bg-white px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-card border border-[#CCF2DB] bg-mint-tint px-6 py-7 text-center">
            <p className="text-xs font-medium text-[#6AA786]">مدير المدرسة</p>
            <p className="mt-2 text-lg font-bold text-mint-deep">
              عبدالله بن حسن سلمان الفيفي
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-muted">
          <p>مدرسة مكة الثانوية — بوابة إلكترونية داخلية.</p>
          <p>مكة المكرمة — المملكة العربية السعودية</p>
        </div>
        <div className="border-t border-line px-5 py-3 text-center text-[11px] text-faint">
          جميع الحقوق محفوظة{" "}
          <bdi dir="ltr" className="num">
            © 2026
          </bdi>{" "}
          لمدرسة مكة الثانوية | تم التصميم والتطوير بواسطة محمد بن حسن
          الحازمي / محضر معمل حاسب آلي
        </div>
      </footer>
    </div>
  );
}
