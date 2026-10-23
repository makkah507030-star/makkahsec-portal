import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { activeYear, elementColor, loadAutoCounts, loadPerfReference } from "../lib/performance.js";

/* =====================================================================
   بطاقات «الشاهد» للإجراءات التي تُحتسب شاهدًا آليًا في ملف الأداء الوظيفي
   (perf_auto_counts): رقم العنصر والبند واسمه مختصرًا بلون العنصر، وبالضغط يظهر
   اسماهما كاملين ورصيد المعلم في البند. للمعلمين فقط.
   تضع الصفحة <EvidenceTags items> بجانب إجرائها كما كانت، لكنها لا تُرسم هناك:
   تُسجَّل بنودها، ويجمعها <EvidenceDock> (في Layout) في صندوق واحد ثابت آخر الصفحة،
   فلا تتبعثر البطاقات بين أجزاء الصفحة، وتتغير مع حالتها (علاجية أو إثرائية…).
   ===================================================================== */

// أسماء مختصرة للبطاقة؛ الاسم الكامل من perf_items عند الضغط
const SHORT = {
  e03_01: "التواصل الفعال مع أولياء الأمور",
  e03_02: "إرسال تقارير مستويات الطلاب",
  e03_06: "تفعيل سجل المتابعة",
  e05_02: "تقديم إفادة سريعة فور ملاحظة الأداء",
  e05_04: "استخدام التقنية لتقديم الإفادة",
  e05_05: "تحديد المهارات المفقودة",
  e05_06: "وضع خطة علاجية",
  e05_07: "وضع خطة إثرائية",
  e05_10: "التحفيز والتكريم",
  e06_04: "تنفيذ الخطة العلاجية",
  e06_05: "تنفيذ الخطة الإثرائية",
  e07_06: "تفعيل الاختبارات الإلكترونية",
  e10_01: "تحليل نتائج التقييم وإعداد التقارير",
  e10_02: "تحديد نقاط القوة والضعف",
  e10_03: "إشراك الطلاب في نتائجهم",
  e11_01: "تطبيق التقويم القبلي (التشخيصي)",
  e11_02: "تنوع مصادر التقويم",
  e11_03: "تنوع أساليب التقويم",
  e11_04: "تقديم التغذية الراجعة",
  e11_05: "تطبيق التقويم التكويني والبنائي",
  e11_07: "بناء الاختبارات وفق معايير الاختبار الجيد",
};

// e11_01 → { el: 11, no: 1 }
const parts = (key) => {
  const [, el, no] = key.match(/^e(\d+)_(\d+)$/) ?? [];
  return { el: Number(el), no: Number(no) };
};

let countsCache = null;   // رصيد المعلم يُجلب مرة واحدة لكل جلسة صفحة
const loadMyCounts = (uid) => {
  if (!countsCache) {
    countsCache = activeYear()
      .then((year) => loadAutoCounts(uid, year))
      .then((m) => m[uid] ?? {}, () => { countsCache = null; return {}; });
  }
  return countsCache;
};

/* سجلّ البنود المعروضة الآن: لكل EvidenceTags مُثبَّتة بنودها، ويُرسم اتحادها في EvidenceDock */
const registry = new Map();
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

export default function EvidenceTags({ items }) {
  const key = (items ?? []).join(",");
  useEffect(() => {
    const id = Symbol("evidence");
    registry.set(id, key ? key.split(",") : []);
    emit();
    return () => { registry.delete(id); emit(); };
  }, [key]);
  return null;
}

/* صندوق شواهد الصفحة: آخر كل صفحة فيها إجراء يُحتسب شاهدًا */
export function EvidenceDock() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => listeners.delete(f);
  }, []);
  const items = [...new Set([...registry.values()].flat())].sort();
  return <EvidenceBoxView items={items} />;
}

function EvidenceBoxView({ items }) {
  const { isTeacher, session } = useSession();
  const [open, setOpen] = useState(null);
  const [ref, setRef] = useState(null);
  const [counts, setCounts] = useState(null);
  const uid = session?.user?.id;

  // تأثيران منفصلان: لو اجتمعا لألغى وصولُ المرجع جلبَ الرصيد فيبقى «…»
  useEffect(() => {
    if (!open || ref) return undefined;
    let live = true;
    loadPerfReference().then((els) => { if (live) setRef(els); }, () => {});
    return () => { live = false; };
  }, [open, ref]);
  useEffect(() => {
    if (!open || counts || !uid) return undefined;
    let live = true;
    loadMyCounts(uid).then((m) => { if (live) setCounts(m); });
    return () => { live = false; };
  }, [open, counts, uid]);

  const keys = (items ?? []).filter((k) => SHORT[k]);
  if (!isTeacher || keys.length === 0) return null;

  const el = open && ref?.find((e) => e.key === open.slice(0, 3));
  const it = el?.items.find((i) => i.key === open);
  const cnt = open && counts ? counts[open]?.cnt ?? 0 : null;
  const color = open && elementColor(open.slice(0, 3));

  return (
    <section className="no-print mx-auto mt-6 max-w-5xl rounded-card border border-mint-light bg-mint-tint/40 px-4 py-3">
      <p className="text-sm font-bold text-mint-deep">شواهد ملف الأداء الوظيفي في هذه الصفحة</p>
      <p className="mb-2 text-[11px] text-muted">تُحتسب لك تلقائيًا بعد تنفيذ إجراءاتها. اضغط البطاقة لتفاصيل البند ورصيدك فيه.</p>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) => {
          const p = parts(k);
          return (
            <button key={k} type="button" onClick={() => setOpen(open === k ? null : k)}
                    title="يُحتسب شاهدًا في ملف أدائك — اضغط للتفاصيل"
                    className={`inline-flex max-w-full items-center gap-1.5 rounded-pill py-0.5 pl-2.5 pr-1 text-[11.5px] leading-relaxed text-white transition-opacity hover:opacity-90 ${
                      open === k ? "ring-2 ring-offset-1" : ""}`}
                    style={{ background: elementColor(k.slice(0, 3)), "--tw-ring-color": elementColor(k.slice(0, 3)) }}>
              <span className="num shrink-0 rounded-pill bg-white/25 px-1.5 font-bold">{p.el}-{p.no}</span>
              <span className="truncate">{SHORT[k]}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className="mt-2 rounded-sm2 border border-line bg-white px-3 py-2.5 text-[12.5px] leading-relaxed">
          <p className="font-bold" style={{ color }}>يُحتسب شاهدًا تلقائيًا في ملف أدائك</p>
          <p className="text-ink">العنصر <span className="num">{parts(open).el}</span>: {el?.title ?? "…"}</p>
          <p className="text-ink">البند <span className="num">{parts(open).no}</span>: {it?.title ?? SHORT[open]}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {cnt == null ? "…" : <>رصيدك الحالي في هذا البند: <span className="num">{cnt}</span></>}
            {" · "}
            <Link to="/my-performance" className="underline" style={{ color }}>عرض الشواهد</Link>
          </p>
        </div>
      )}
    </section>
  );
}
