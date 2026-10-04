// src/pages/studio/Identity.jsx
import { useRef, useState } from "react";
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import logoFull from "../../assets/logo-full-mint.png";
import { RegisterCover, Decor } from "./Sheets.jsx";
import Scaled from "./Scaled.jsx";
import { THEMES, academicYearLabel, downloadNode } from "./lib";
import { SOCIAL_FORMATS } from "./templates";

/* =====================================================================
   أرشيف الهوية البصرية — مرجع واحد لكل من يصمّم باسم المدرسة:
   الشعارات، والألوان، والخط، والنسخ الثلاث، وخلفيات جاهزة، وقواعد الاستخدام.
   ===================================================================== */

const pill = (on) =>
  `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

const LOGOS = [
  { src: iconMint, file: "شعار-البوابة-أخضر.png", title: "الرمز الأخضر", use: "على الخلفيات الفاتحة والأوراق المطبوعة.", bg: "bg-mint-tint" },
  { src: iconWhite, file: "شعار-البوابة-أبيض.png", title: "الرمز الأبيض", use: "على الخلفية الغامقة وفوق الصور.", bg: "bg-[#193326]" },
  { src: logoFull, file: "شعار-المدرسة-كامل.png", title: "الشعار الكامل", use: "مع اسم المدرسة وسنة التأسيس 1387 — للأغلفة واللوحات.", bg: "bg-white" },
];

const OFFICE = [
  { href: "/templates/report-template.docx", file: "قالب-تقرير-مدرسة-مكة-الثانوية.docx", ext: "W", bg: "bg-[#2B579A]",
    title: "قالب تقرير (Word)",
    desc: "غلاف، وفهرس يتحدّث تلقائيًا، وصفحات بالترويسة الرسمية، واسم التقرير في التذييل يتحدّث فور كتابته في الغلاف، مع ترقيم الصفحات." },
  { href: "/templates/presentation-template.pptx", file: "قالب-عرض-مدرسة-مكة-الثانوية.pptx", ext: "P", bg: "bg-[#C43E1C]",
    title: "قالب عرض (PowerPoint)",
    desc: "14 شريحة: غلاف، ومحتويات، وفاصل قسم، ونقاط، ومقارنة، وصورة ونص، وأرقام، ورسم بياني، وجدول، وخط زمني، وخطوات، واقتباس، وفريق العمل، وختام." },
];

const COLORS = [
  { hex: "#3E6350", name: "أخضر الهوية", use: "العناوين والأزرار والترويسة الرسمية", dark: true },
  { hex: "#89D7AD", name: "الأخضر", use: "الشارات والأرقام وعناصر التمييز" },
  { hex: "#CCF2DB", name: "الأخضر الفاتح", use: "الحدود والخلفيات الخفيفة" },
  { hex: "#193326", name: "أخضر الليل", use: "خلفية النسخة الغامقة", dark: true },
  { hex: "#F2FAF5", name: "الأبيض الأخضر", use: "خلفية النسخة الفاتحة" },
  { hex: "#B8912F", name: "الذهبي", use: "الخطوط الفاصلة والتفاصيل الرسمية", dark: true },
  { hex: "#1C3328", name: "حبر النص", use: "النصوص على الخلفيات الفاتحة", dark: true },
];

const RULES = {
  do: [
    "استخدم الرمز الأخضر على الفاتح، والأبيض على الغامق.",
    "اترك حول الشعار مسافة لا تقل عن نصف عرضه.",
    "اكتب الأرقام إنجليزية (1448) — أوضح في الطباعة.",
    "للطباعة: الفاتحة للملوّن، والرسمية للأبيض والأسود.",
    "للشاشة ووسائل التواصل: الغامقة.",
  ],
  dont: [
    "لا تمدّد الشعار ولا تضغطه ولا تُدِره.",
    "لا تغيّر ألوان الشعار أو تضف له ظلالًا وتأثيرات.",
    "لا تضع الشعار فوق صورة مزدحمة دون خلفية.",
    "لا تستخدم خطوطًا أخرى في العناوين.",
    "لا تجمع أكثر من لونين بارزين في التصميم الواحد.",
  ],
};

const SAMPLE = {
  title: "سجل الدرجات", sub: "الفصل الدراسي الأول", teacher: "أ. اسم المعلم", subject: "الرياضيات",
  classes: "الأول الثانوي (1 – 4)", year: academicYearLabel(),
};

function Section({ title, desc, children }) {
  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="font-bold text-ink">{title}</h2>
        {desc && <p className="mt-0.5 text-xs leading-relaxed text-muted">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Identity() {
  const [copied, setCopied] = useState(null);
  const [fmt, setFmt] = useState("screen");
  const [busy, setBusy] = useState(null);
  const refs = { dark: useRef(null), light: useRef(null) };

  const copy = async (hex) => {
    try { await navigator.clipboard.writeText(hex); } catch { /* المتصفح قد يمنع النسخ */ }
    setCopied(hex);
    setTimeout(() => setCopied((c) => (c === hex ? null : c)), 1500);
  };

  const FORMATS = { screen: { label: "شاشة 1920×1080", w: 1920, h: 1080 }, ...SOCIAL_FORMATS };
  const size = FORMATS[fmt];

  const downloadBg = async (theme) => {
    const node = refs[theme].current?.firstElementChild;
    if (!node) return;
    setBusy(theme);
    try {
      await downloadNode(node, `خلفية-${theme === "dark" ? "غامقة" : "فاتحة"}-${size.w}x${size.h}.png`, 1);
    } finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-card bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        هذا مرجع الهوية البصرية للمدرسة. كل ما في الاستوديو مبني عليه، وإن صمّمت خارجه
        — عرضًا أو منشورًا أو لافتة — فخذ منه الشعار والألوان والخلفيات ليبقى المظهر واحدًا.
      </p>

      <Section title="الشعارات" desc="اضغط «تنزيل» لحفظ الشعار بخلفية شفافة.">
        <div className="grid gap-3 sm:grid-cols-3">
          {LOGOS.map((l) => (
            <div key={l.file} className="overflow-hidden rounded-card border border-line">
              <div className={`flex h-36 items-center justify-center ${l.bg}`}>
                <img src={l.src} alt={l.title} className="max-h-24 max-w-[70%] object-contain" />
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{l.title}</p>
                  <p className="text-[11px] leading-relaxed text-muted">{l.use}</p>
                </div>
                <a href={l.src} download={l.file} className="btn-primary shrink-0 px-3 py-1.5 text-xs">تنزيل</a>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="قوالب Word وPowerPoint" desc="للتقارير والعروض خارج الاستوديو — بالخط والألوان والترويسة المعتمدة.">
        <div className="grid gap-3 sm:grid-cols-2">
          {OFFICE.map((o) => (
            <div key={o.href} className="flex items-start gap-3 rounded-card border border-line p-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-sm2 text-sm font-bold text-white ${o.bg}`}>{o.ext}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{o.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{o.desc}</p>
              </div>
              <a href={o.href} download={o.file} className="btn-primary shrink-0 px-3 py-1.5 text-xs">تنزيل</a>
            </div>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-faint">
          ثبّت خط IBM Plex Sans Arabic (مجاني من Google Fonts) ليظهر القالب كما صُمّم.
        </p>
      </Section>

      <Section title="الألوان" desc="اضغط على اللون لنسخ رمزه.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {COLORS.map((c) => (
            <button key={c.hex} onClick={() => copy(c.hex)}
              className="overflow-hidden rounded-card border border-line text-right transition-transform hover:-translate-y-0.5">
              <div className="flex h-20 items-end p-2" style={{ background: c.hex }}>
                <span className={`num text-[11px] font-semibold ${c.dark ? "text-white" : "text-mint-deep"}`} dir="ltr">
                  {copied === c.hex ? "✓ نُسخ" : c.hex}
                </span>
              </div>
              <div className="p-2">
                <p className="text-xs font-semibold text-ink">{c.name}</p>
                <p className="text-[10.5px] leading-snug text-muted">{c.use}</p>
              </div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="الخط" desc="IBM Plex Sans Arabic — خط واحد بثلاثة أوزان، مجاني ومتاح في Google Fonts.">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [700, "عريض 700", "للعناوين والأرقام"],
            [600, "متوسط 600", "للشارات والعناوين الفرعية"],
            [400, "عادي 400", "للنصوص والفقرات"],
          ].map(([w, name, use]) => (
            <div key={w} className="rounded-card border border-line p-4">
              <p className="text-3xl text-ink" style={{ fontWeight: w }}>مدرسة مكة</p>
              <p className="num mt-1 text-lg text-mint-deep" style={{ fontWeight: w }}>1448 – 1449</p>
              <p className="mt-2 text-xs font-semibold text-ink">{name}</p>
              <p className="text-[11px] text-muted">{use}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="النسخ الثلاث" desc="كل قالب في الاستوديو له هذه النسخ، واختر منها بحسب الاستخدام.">
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <div key={t.key} className="min-w-0">
              <div className="pointer-events-none">
                <Scaled w={794} h={1123}>
                  <RegisterCover theme={t.key} d={SAMPLE} />
                </Scaled>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{t.label}</p>
              <p className="text-[11px] leading-relaxed text-muted">{t.hint}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="خلفيات جاهزة" desc="خلفيات الهوية بلا نص — للعروض التقديمية وشاشات المدرسة والمنشورات التي تصمّمها بنفسك.">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(FORMATS).map(([k, f]) => (
            <button key={k} className={pill(fmt === k)} onClick={() => setFmt(k)}>{f.label}</button>
          ))}
        </div>
        <div className={`grid gap-3 ${size.w > size.h ? "sm:grid-cols-2" : "grid-cols-2 sm:max-w-md"}`}>
          {["dark", "light"].map((th) => (
            <div key={th} className="min-w-0">
              <div className="pointer-events-none">
                <Scaled w={size.w} h={size.h} innerRef={refs[th]}>
                  <div className={`stu stu-social stu-${th}`} style={{ width: size.w, height: size.h }}>
                    <Decor />
                  </div>
                </Scaled>
              </div>
              <button disabled={busy === th} onClick={() => downloadBg(th)}
                className="mt-2 w-full rounded-sm2 border border-line py-2 text-sm font-medium text-mint-deep hover:bg-canvas disabled:opacity-50">
                {busy === th ? "جارٍ التجهيز…" : `تنزيل الخلفية ${th === "dark" ? "الغامقة" : "الفاتحة"}`}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="قواعد الاستخدام">
        <div className="grid gap-3 sm:grid-cols-2">
          {[["do", "افعل", "text-present", "bg-present/10", "✓"], ["dont", "تجنّب", "text-absent", "bg-absent/10", "✕"]].map(
            ([k, label, color, bg, mark]) => (
              <div key={k} className="rounded-card border border-line p-3">
                <p className={`mb-2 text-sm font-bold ${color}`}>{label}</p>
                <ul className="space-y-1.5">
                  {RULES[k].map((r) => (
                    <li key={r} className="flex gap-2 text-xs leading-relaxed text-ink">
                      <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${bg} ${color}`}>{mark}</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </Section>
    </div>
  );
}
