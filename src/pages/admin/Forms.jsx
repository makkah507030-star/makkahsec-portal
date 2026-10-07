// src/pages/admin/Forms.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import DateField, { TimeField, rangeDays, formatBoth } from "../../components/DateField.jsx";
import FormReport, { ReportPrintArea } from "../../components/FormReport.jsx";
import FormSheet, { PrintArea, SHEET_PX, CERT_THEMES, sheetLandscape, isGuestCert } from "../../components/FormSheet.jsx";
import { RATING_LEVELS, gradeTone, itemPoints, officialLabel, rubricScore, weightedRating } from "../../lib/rubric.js";
import Loader from "../../components/Loader.jsx";
import { ReplyFilesList } from "../../components/ReplyFiles.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { canUseTemplate } from "../../lib/formRoles";
import { sendPush } from "../../lib/pushSend.js";
import { useUsageCounts } from "../../lib/usage.js";
import UsageBadge from "../../components/UsageBadge.jsx";
import { fmtDate } from "../../lib/dates";

/* =====================================================================
   النماذج والشهادات — الإصدار والأرشيف والاعتماد.
   ما يظهر لكل مستخدم تحدّده سياسات قاعدة البيانات، لا الواجهة.
   ===================================================================== */

const CAT_LABEL = { certificate: "شهادات", official: "رسمية", administrative: "إدارية" };

/* أقسام المدرسة — يُصنَّف كل نموذج تحت قسمه المُصدِر */
export const DEPARTMENTS = [
  { key: "school_admin",    label: "الإدارة المدرسية" },
  { key: "academic",        label: "الشؤون التعليمية" },
  { key: "school_affairs",  label: "الشؤون المدرسية" },
  { key: "student_affairs", label: "شؤون الطلاب" },
  { key: "guidance",        label: "التوجيه الطلابي" },
  { key: "activity",        label: "النشاط الطلابي" },
  { key: "health",          label: "الموجه الصحي" },
  { key: "gifted",          label: "الموهوبين" },
  { key: "globe",           label: "برنامج جلوب البيئي العالمي" },
  { key: "sport",           label: "مكة سبورت" },
];
const DEPT_LABEL = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d.label]));
const STATUS_CHIP = {
  issued:   { t: "صادر",            c: "bg-present/10 text-present" },
  pending:  { t: "بانتظار الاعتماد", c: "bg-warning/10 text-warning" },
  approved: { t: "معتمد",           c: "bg-present/10 text-present" },
  rejected: { t: "مُعاد للتعديل",    c: "bg-absent/10 text-absent" },
  awaiting_reply: { t: "بانتظار رد المستفيد", c: "bg-warning/10 text-warning" },
  replied:  { t: "وصل الرد",         c: "bg-mint-tint text-mint-deep" },
  draft:    { t: "مسودة",            c: "bg-canvas text-muted" },
};

const hijriYear = () => {
  try {
    const s = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(new Date());
    return parseInt(String(s).replace(/\D/g, ""), 10);
  } catch { return new Date().getFullYear() - 579; }
};

// تاريخ اليوم بالصيغة المعتمدة: الهجري - الميلادي (يوم/شهر/سنة، بلا هـ ولا م)
const todayBoth = () => {
  const n = new Date();
  return formatBoth(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
};

/* معاينة مصغّرة: تُقاس عرض الحاوية فتُصغَّر الورقة لتناسبها */
function SheetPreview({ landscape, children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      const sheet = landscape ? SHEET_PX.landscape : SHEET_PX.portrait;
      if (w) setScale(Math.min(1, Math.max(0.25, (w - 8) / sheet)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [landscape]);

  // ارتفاع المحتوى الفعلي — النموذج قد يكون أكثر من صفحة
  const inner = useRef(null);
  const [contentH, setContentH] = useState(landscape ? SHEET_PX.portrait : 1123);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight || (landscape ? SHEET_PX.portrait : 1123)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [landscape]);

  const h = contentH * scale + 16;
  return (
    <div ref={box} className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="min-w-0" style={{ height: h }}>
        <div className="w-0 min-w-0" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div ref={inner} style={{ width: landscape ? SHEET_PX.landscape : SHEET_PX.portrait }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* التعبئة التلقائية: يطابق حقول النموذج بما هو معروف في قاعدة البيانات
   اعتمادًا على تسمية الحقل، فيقلّ الإدخال اليدوي قدر الإمكان. */
const AUTO_MAP = [
  // بيانات وظيفية لا تُعرف من قاعدة البيانات — تُستثنى أولًا حتى لا تطابق «الوظيفة» فتُملأ بالمسمّى
  { keys: ["رقم الوظيفة", "المرتبة", "المستوى"], from: null },
  { keys: ["اسم الطالب", "اسم الموظف", "اسم المنسوب", "الاسم رباعي", "اسم المعلم", "الاسم"], from: "name" },
  { keys: ["السجل المدني", "رقم الهوية", "الإقامة", "رقم السجل"], from: "national_id" },
  { keys: ["الصف", "الفصل", "المرحلة"], from: "class_label" },
  { keys: ["جوال ولي الأمر", "هاتف ولي الأمر", "جوال"], from: "guardian_mobile" },
  { keys: ["ولي الأمر", "ولي أمر"], from: "guardian_name" },
  { keys: ["التخصص"], from: "specialization" },
  { keys: ["المسمّى", "المسمى", "العمل الحالي", "الوظيفة"], from: "job" },
];

function autoFill(fields, info, current, { overwrite = false } = {}) {
  const out = { ...current };
  (fields ?? []).forEach((f) => {
    if (["student", "staff", "theme", "table", "rubric"].includes(f.type)) return;
    // عند تبديل الشخص تُحدَّث بياناته المعروفة، وفيما عدا ذلك لا يُطمس ما كُتب
    if (!overwrite && String(out[f.name] ?? "").trim()) return;
    const label = f.label ?? "";
    const hit = AUTO_MAP.find((m) => m.keys.some((k) => label.includes(k)));
    const val = hit ? info[hit.from] : null;
    if (val) out[f.name] = val;
  });
  return out;
}

/* المستند الذي يُصدره صاحبه لنفسه لا يصدر مباشرة: يمرّ على اعتماد المدير
   أيًّا كان إعداد النموذج. يُعرف بحساب المستفيد، أو باسمه إن كُتب يدويًا. */
const normName = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const isSelfTarget = (target, recipient, uid, myName) =>
  (target && (target.uid ?? target.user_id) === uid) ||
  (normName(myName) !== "" && normName(recipient) === normName(myName));

// صيغة جاهزة: تستبدل النص، أو تُضاف سطرًا جديدًا في الحقول المعلَّمة presets_append
const pickPreset = (field, current, t) => {
  if (!field.presets_append) return t;
  const cur = String(current ?? "").trim();
  if (cur.split("\n").some((l) => l.replace(/^•\s*/, "").trim() === t)) return cur;
  return cur ? `${cur}\n• ${t}` : `• ${t}`;
};

// نماذج تقييم المعلمين: قائمة الموظفين تعرض المعلمين فقط (ومن يجمع التدريس
// مع عمل إداري معلمٌ أيضًا)، لا الإداريين الخالصين
const teachersOnly = (f, tpl) => !!f?.teachers_only || tpl?.key === "teacher_support_visit" ||
  (tpl?.fields ?? []).some((x) => x.type === "rubric");

// حقول الحصة المزارة: تُعبَّأ قوائمها من جدول المعلم المختار
const LESSON_TYPES = ["lesson_class", "lesson_subject", "lesson_period"];
const PERIOD_WORDS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"];
const DAY_WORDS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const periodText = (n) => `الحصة ${PERIOD_WORDS[n - 1] ?? n}`;

const signedUrl = async (path) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("form-assets").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
};

/* جدول بنود الأداء (rubric): لكل عنصر تقدير من ٥ وتحقق الشواهد وملاحظة،
   ودرجة القسم الموزونة تظهر فورًا. التعريف في src/lib/rubric.js */
function RubricInput({ field, value, onChange }) {
  const v = value ?? {};
  const sc = rubricScore(field, v);
  const set = (i, patch) => onChange({ ...v, [i]: { ...(v[i] ?? {}), ...patch } });
  const official = field.style === "official";
  const overall = (field.items ?? []).reduce((a, it, i) => a + (weightedRating(it, v[i]) ?? 0), 0);
  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm2 bg-mint-tint px-3 py-2 text-xs text-mint-deep">
        <span>{field.note}</span>
        <span className="font-bold">
          {official
            // النموذج المعتمد: مجموع التقديرات الموزونة من 5
            ? <>{sc.rated ? <>التقدير العام <span className="num">{overall.toFixed(2)}</span> من <span className="num">5</span></> : "التقدير العام من 5"}</>
            : <>{sc.rated ? <><span className="num">{sc.points}%</span> من </> : "من "}<span className="num">{sc.max}%</span></>}
          {" · "}قُدِّر <span className="num">{sc.rated}</span> من <span className="num">{sc.count}</span>
        </span>
      </div>
      {(field.items ?? []).map((it, i) => {
        const e = v[i] ?? {};
        const pts = itemPoints(it, e);
        if (it.levels) return (
          <div key={i} className="rounded-sm2 border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                <span className="num text-mint-deep">{it.no ?? i + 1}.</span> {it.title}
              </p>
              <span className="shrink-0 text-xs text-muted">
                {official
                  ? <>{pts != null ? <b style={{ color: gradeTone(e.score).fg }}>{officialLabel(e.score)} · <span className="num">{weightedRating(it, e).toFixed(2)}</span></b> : "—"}
                      {" · "}الوزن <span className="num">{it.weight}%</span></>
                  : <>{pts != null ? <b className="num text-mint-deep">{pts}</b> : "—"} من <span className="num">{it.weight}%</span></>}
              </span>
            </div>
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-semibold text-mint-deep">التفسير</summary>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">{it.text}</p>
              {it.bullets?.length > 0 && (
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed text-muted">
                  {it.bullets.map((b, k) => <li key={k}>{b}</li>)}
                </ul>
              )}
            </details>
            <p className="mt-2 text-[11px] text-muted">سلالم التقدير — اختر المستوى الذي ينطبق:</p>
            <div className="mt-1 space-y-1">
              {it.levels.map((txt, k) => {
                const lv = k + 1, on = Number(e.score) === lv;
                return (
                  <button key={k} type="button" onClick={() => set(i, { score: on ? null : lv })}
                    style={on ? { background: gradeTone(lv).bg, borderColor: gradeTone(lv).bd } : undefined}
                    className={`flex w-full items-start gap-2 rounded-sm2 border px-2.5 py-1.5 text-right text-[11.5px] leading-relaxed transition-colors ${
                      on ? "text-ink" : "border-line text-muted hover:bg-canvas"}`}>
                    <span style={on ? { background: gradeTone(lv).fg } : undefined}
                      className={`num mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      on ? "text-white" : "border border-line"}`}>{lv}</span>
                    <span className="whitespace-pre-line">{txt}</span>
                  </button>
                );
              })}
            </div>
            <textarea rows={2} className="field mt-2 w-full text-xs" placeholder="مجالات التطوير (اختياري)" value={e.note ?? ""}
                      onChange={(ev) => set(i, { note: ev.target.value })} />
          </div>
        );
        return (
          <div key={i} className="rounded-sm2 border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-ink">
                <span className="num text-mint-deep">{i + 1}.</span> {it.title}
              </p>
              <span className="shrink-0 text-xs text-muted">
                {official
                  ? <>{pts != null ? <b style={{ color: gradeTone(e.score).fg }}>{officialLabel(e.score)} · <span className="num">{weightedRating(it, e).toFixed(2)}</span></b> : "—"}
                      {" · "}الوزن <span className="num">{it.weight}%</span></>
                  : <>{pts != null ? <b className="num text-mint-deep">{pts}</b> : "—"} من <span className="num">{it.weight}%</span></>}
              </span>
            </div>
            {it.examples?.length > 0 && (
              <p className="mt-1 text-[11px] leading-relaxed text-faint">أمثلة: {it.examples.join("، ")}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-1">
              {RATING_LEVELS.map((l) => {
                const on = Number(e.score) === l.v;
                return (
                  <button key={l.v} type="button" onClick={() => set(i, { score: on ? null : l.v })}
                    className={`rounded-pill border px-2.5 py-1 text-[11.5px] transition-colors ${
                      on ? "border-mint-deep bg-mint-deep text-white" : "border-line text-muted hover:bg-canvas"}`}>
                    <span className="num font-bold">{l.v}</span> {l.label}
                  </button>
                );
              })}
            </div>

            {it.evidence?.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-muted">{field.evidence_label || "الشواهد"} — ضع علامة على ما تحقّق:</p>
                {it.evidence.map((ev, r) => {
                  const on = !!e.check?.[r];
                  return (
                    <label key={r} className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                      <input type="checkbox" className="accent-[#3E6350]" checked={on}
                             onChange={() => {
                               const check = [...(e.check ?? [])];
                               check[r] = !on;
                               set(i, { check });
                             }} />
                      {ev}
                    </label>
                  );
                })}
              </div>
            )}

            <input className="field mt-2 w-full text-xs" placeholder="ملاحظات (اختياري)" value={e.note ?? ""}
                   onChange={(ev) => set(i, { note: ev.target.value })} />
          </div>
        );
      })}
    </div>
  );
}

/* صيغ جاهزة لحقل بعينه — تُدار من «إدارة النماذج» وتُحفظ مع الحقل */
function FieldPresets({ field, onPick }) {
  const list = Array.isArray(field?.presets) ? field.presets : [];
  if (!list.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {field.presets_append && (
        <span className="w-full text-[11px] text-faint">اضغط البطاقة لإضافتها، ويمكن الجمع بين أكثر من بطاقة والتعديل بعدها.</span>
      )}
      {list.map((t, i) => (
        <button key={i} type="button" onClick={() => onPick(t)} title={t}
                className="max-w-full truncate rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1 text-[11.5px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
          {t.length > 42 ? t.slice(0, 42) + "…" : t}
        </button>
      ))}
    </div>
  );
}

/* الفصل والمادة والحصة في استمارات الزيارة — ثلاث قوائم من جدول المعلم المختار.
   اختيار الفصل يملأ المادة إن كانت واحدة، والحصة إن كان للمعلم حصة فيه اليوم.
   بلا جدول للمعلم تبقى الحقول نصًا يُكتب يدويًا. */
function LessonSelect({ field, fields, values, lessons, hasTeacher, onChange }) {
  const nameOf = (t) => (fields ?? []).find((x) => x.type === t)?.name;
  const [kClass, kSubject, kPeriod] = LESSON_TYPES.map(nameOf);
  const cls = kClass ? values[kClass] ?? "" : "";
  const subj = kSubject ? values[kSubject] ?? "" : "";
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  if (!hasTeacher) {
    return <select className="field mt-1 w-full" disabled><option>اختر المعلم أولًا</option></select>;
  }
  if (lessons == null) {
    return <select className="field mt-1 w-full" disabled><option>جارٍ تحميل جدول المعلم…</option></select>;
  }
  if (!lessons.length) {
    return (
      <>
        <input className="field mt-1 w-full" value={values[field.name] ?? ""}
               onChange={(e) => onChange({ [field.name]: e.target.value })} />
        <p className="mt-1 text-[11px] text-faint">لا جدول مسجّل لهذا المعلم — اكتبها يدويًا.</p>
      </>
    );
  }

  const today = new Date().getDay() + 1;   // الأحد = 1 كما في الجدول الدراسي
  const inClass = lessons.filter((l) => !cls || l.classLabel === cls);
  const inSubject = inClass.filter((l) => !subj || l.subject === subj);

  // حصة اليوم في الفصل (والمادة) المختارة، أو الحصة الوحيدة إن لم تتعدد
  const guessPeriod = (list) => {
    const t = list.filter((l) => l.dow === today);
    const ps = uniq((t.length ? t : list).map((l) => l.period));
    return ps.length === 1 ? periodText(ps[0]) : "";
  };

  if (field.type === "lesson_class") {
    return (
      <select className="field mt-1 w-full" value={cls}
              onChange={(e) => {
                const c = e.target.value;
                const list = lessons.filter((l) => l.classLabel === c);
                const subs = uniq(list.map((l) => l.subject));
                const s1 = subs.length === 1 ? subs[0] : "";
                const patch = { [field.name]: c };
                if (kSubject) patch[kSubject] = s1;
                if (kPeriod) patch[kPeriod] = guessPeriod(s1 ? list.filter((l) => l.subject === s1) : list);
                onChange(patch);
              }}>
        <option value="">اختر الفصل…</option>
        {uniq(lessons.map((l) => l.classLabel))
          .sort((a, b) => (parseInt(a.split("— ")[1], 10) || 0) - (parseInt(b.split("— ")[1], 10) || 0))
          .map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }

  if (field.type === "lesson_subject") {
    const subs = uniq(inClass.map((l) => l.subject));
    return (
      <select className="field mt-1 w-full" value={subj}
              onChange={(e) => {
                const s1 = e.target.value;
                const patch = { [field.name]: s1 };
                if (kPeriod) patch[kPeriod] = guessPeriod(inClass.filter((l) => !s1 || l.subject === s1));
                onChange(patch);
              }}>
        <option value="">اختر المادة…</option>
        {subs.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    );
  }

  // الحصة: حصص المعلم في الفصل والمادة بأيامها، وإلا الحصص السبع
  const periods = uniq(inSubject.map((l) => l.period)).sort((a, b) => a - b);
  const opts = (periods.length ? periods : [1, 2, 3, 4, 5, 6, 7]).map((n) => {
    const days = uniq(inSubject.filter((l) => l.period === n).sort((a, b) => a.dow - b.dow).map((l) => DAY_WORDS[l.dow - 1]));
    return { value: periodText(n), label: days.length ? `${periodText(n)} (${days.join("، ")})` : periodText(n) };
  });
  return (
    <select className="field mt-1 w-full" value={values[field.name] ?? ""}
            onChange={(e) => onChange({ [field.name]: e.target.value })}>
      <option value="">اختر الحصة…</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* view: "issue" صفحة النماذج والشهادات (الإصدار والأرشيف والتقارير)،
   و"review" صفحة «الاعتماد والمتابعة» (متابعة الإفادات واعتماد النماذج). */
export default function Forms({ view = "issue", openKey = null }) {
  const review = view === "review";
  const navigate = useNavigate();
  const { session, profile, adminRoles, isTeacher } = useSession();
  const isManager = (adminRoles ?? []).some((r) => r === "tech_support" || r === "principal");
  const isApprover = (adminRoles ?? []).includes("principal");
  const usage = useUsageCounts();

  const [tab, setTab] = useState(review ? "replies" : "issue");
  const [fQ, setFQ] = useState("");
  const [fTpl, setFTpl] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sel, setSel] = useState(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // الأحداث المرفوعة تقاريرها لمدير المدرسة وبانتظار اعتماده
  const [pendingEvents, setPendingEvents] = useState([]);
  // تبويبا المتابعة والاعتماد لصفحة «الاعتماد والمتابعة» وحدها، وتبويبات الإصدار لغيرها
  const REVIEW_TABS = ["replies", "approve", "events"];
  if (review !== REVIEW_TABS.includes(tab)) setTab(review ? "replies" : "issue");
  const switchTab = (k) => { setTab(k); setSel(new Set()); setFStatus(""); };
  const [dept, setDept] = useState("all");
  const [templates, setTemplates] = useState([]);
  // ما يحق لهذا الحساب إصداره بحسب «من يُصدره» في إدارة النماذج
  const usable = useMemo(() => templates.filter((t) => canUseTemplate(t, {
    adminRoles: adminRoles ?? [],
    isAdmin: profile?.role === "admin",
    isTeacher: isTeacher || profile?.role === "teacher",
  })), [templates, adminRoles, profile?.role, isTeacher]);
  const [loading, setLoading] = useState(true);

  const [picked, setPicked] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [issued, setIssued] = useState(null);      // المستند بعد الحفظ

  const [docs, setDocs] = useState([]);
  const [editing, setEditing] = useState(null);     // مستند مُعاد يجري تصحيحه
  const [returned, setReturned] = useState([]);     // ما أعاده المدير إليّ
  const [drafts, setDrafts] = useState([]);         // مسوداتي: نماذج حُفظت لتُكمَل لاحقًا
  const [draftDoc, setDraftDoc] = useState(null);   // المسودة المفتوحة الآن
  const [rejectFor, setRejectFor] = useState(null); // مستند بانتظار سبب الإعادة
  const [rejectNote, setRejectNote] = useState("");
  const [viewing, setViewing] = useState(null);    // { doc, template, urls }

  // أصول التوقيع والختم
  const [mySig, setMySig] = useState(null);
  const [assets, setAssets] = useState({});
  const [urls, setUrls] = useState({ sig: null, stamp: null, principal: null });

  // طلاب فصول المعلم
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);
  const [chosen, setChosen] = useState([]);      // مستفيدون متعددون: شهادة لكل واحد
  const [staff, setStaff] = useState([]);        // موظفو المدرسة: معلمون وإداريون
  const [staffQ, setStaffQ] = useState("");
  const [batch, setBatch] = useState([]);        // مستندات صدرت دفعة واحدة للطباعة
  const [lessons, setLessons] = useState(null);  // حصص المعلم المختار: [{ classLabel, subject, dow, period }]

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: sig }, { data: a }] = await Promise.all([
        supabase.from("form_templates")
          .select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_signatures").select("path").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("school_assets").select("key, path, label"),
      ]);
      setTemplates(t ?? []);
      setMySig(sig?.path ?? null);
      const am = Object.fromEntries((a ?? []).map((r) => [r.key, r.path]));
      am.principal_name = (a ?? []).find((r) => r.key === "principal_signature")?.label ?? "";
      setAssets(am);
      setUrls({
        sig: await signedUrl(sig?.path),
        stamp: await signedUrl(am.stamp),
        principal: await signedUrl(am.principal_signature),
      });
      setLoading(false);
      loadReturned();
      loadDrafts();
    })();
  }, [session]);

  // مسوداتي: ما حفظه المستخدم ليكمله لاحقًا (كاستمارة زيارة قُيّم جزء الصف منها)
  const loadDrafts = async () => {
    const { data } = await supabase.from("form_documents")
      .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
      .eq("created_by", session.user.id).eq("status", "draft")
      .order("created_at", { ascending: false });
    setDrafts(data ?? []);
  };

  // ما أعاده المدير لهذا المستخدم للتعديل
  const loadReturned = async () => {
    const { data } = await supabase.from("form_documents")
      .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
      .eq("created_by", session.user.id).eq("status", "rejected")
      .order("created_at", { ascending: false });
    setReturned(data ?? []);
  };

  // موظفو المدرسة لشهادات المعلمين والإداريين — الاسم والمسمّى الوظيفي
  useEffect(() => {
    (async () => {
      const needsStaff = (picked?.fields ?? []).some((f) => f.type === "staff");
      if (!needsStaff || staff.length) return;

      const [{ data: tch }, { data: usr }, { data: roles }] = await Promise.all([
        supabase.from("teachers").select("id, user_id, full_name, specialization, national_id").order("full_name"),
        supabase.from("users").select("id, full_name, username, role").eq("role", "admin"),
        supabase.from("admin_roles").select("user_id, role_type"),
      ]);

      // المسمّى الوظيفي من مسمّيات الأدوار المعتمدة في البوابة.
      // الدعم الفني صفة تقنية لا مسمّى وظيفيًا، فتُستبعد من المسمّى المطبوع.
      const jobBy = {};
      (roles ?? [])
        .filter((r) => r.role_type !== "tech_support")
        .forEach((r) => {
          const label = ADMIN_ROLE_LABEL[r.role_type] ?? r.role_type;
          jobBy[r.user_id] = jobBy[r.user_id]
            ? `${jobBy[r.user_id]} و${label}`
            : label;
        });

      // من له سجل في جدول المعلمين فمسمّاه «معلم» مهما أُسند إليه من أعمال
      const teacherUids = new Set((tch ?? []).map((t) => t.user_id).filter(Boolean));

      // الإداريون أولًا: من يجمع بين التدريس ودور إداري يظهر بمسمّاه الإداري
      const list = [
        ...(usr ?? []).map((u) => ({
          id: `u-${u.id}`,
          uid: u.id,
          full_name: u.full_name ?? u.username,
          // اسم الدخول في البوابة هو رقم الهوية
          national_id: /^\d{10}$/.test(u.username ?? "") ? u.username : "",
          // الوكلاء والموجهون ورواد النشاط متفرّغون من التدريس،
          // والمحضّرون والإداريون هذه وظيفتهم الأصلية — فالتخصص هو المسمّى.
          specialization: teacherUids.has(u.id) ? "" : (jobBy[u.id] ?? ""),
          // المعلم يبقى «معلم» ولو أُسند له عمل إداري، والإداري الخالص بصفته
          job: teacherUids.has(u.id) ? "معلم" : (jobBy[u.id] ?? "إداري بالمدرسة"),
        })),
        ...(tch ?? []).map((t) => ({
          id: `t-${t.id}`,
          uid: t.user_id ?? null,
          full_name: t.full_name,
          specialization: t.specialization ?? "",
          national_id: t.national_id ?? "",
          job: "معلم",
        })),
      ];

      // بيانات المعلم (التخصص والسجل المدني) تُنقل لبطاقته أيًّا كان مصدرها:
      // المطابقة بحساب المستخدم أولًا لأنها قاطعة، ثم بالاسم احتياطًا.
      const byUid = {}, byName = {};
      (tch ?? []).forEach((t) => {
        const extra = {
          specialization: t.specialization ?? "",
          national_id: t.national_id ?? "",
        };
        if (t.user_id) byUid[t.user_id] = extra;
        if (t.full_name) byName[t.full_name.trim()] = extra;
      });
      list.forEach((m) => {
        const extra = (m.uid && byUid[m.uid]) || byName[(m.full_name ?? "").trim()];
        if (extra) {
          if (!m.specialization && extra.specialization) m.specialization = extra.specialization;
          if (!m.national_id && extra.national_id) m.national_id = extra.national_id;
        }
      });

      const seen = new Set();
      setStaff(list.filter((x) => {
        const k = (x.full_name ?? "").trim();
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      }));
    })();
  }, [picked, staff.length]);

  // فصول المستخدم: المعلم يرى فصوله المسندة فقط، والإدارة ترى كل الفصول
  useEffect(() => {
    (async () => {
      const needsStudent = (picked?.fields ?? []).some((f) => f.type === "student");
      if (!needsStudent) return;

      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      const { data: me } = await supabase.from("teachers")
        .select("id").eq("user_id", session.user.id).maybeSingle();

      if (me) {
        const { data } = await supabase.from("schedule")
          .select("class_id, classes(class_no, grade)")
          .eq("teacher_id", me.id)
          .eq("academic_year", m.active_year ?? "")
          .eq("term", Number(m.active_term ?? 1));
        const uniq = {};
        (data ?? []).forEach((r) => { if (r.class_id) uniq[r.class_id] = r.classes; });
        setClasses(Object.entries(uniq).map(([id, c]) => ({ id, ...c })));
      } else if (isManager || (adminRoles ?? []).length) {
        const { data } = await supabase.from("classes").select("id, class_no, grade").order("class_no");
        setClasses(data ?? []);
      }
    })();
  }, [picked, session, adminRoles, isManager]);

  useEffect(() => {
    (async () => {
      if (!classId) { setStudents([]); return; }
      const { data } = await supabase.from("student_enrollment")
        .select("students(id, full_name, user_id, national_id)").eq("class_id", classId).eq("status", "active");
      setStudents((data ?? []).map((r) => r.students).filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    })();
  }, [classId]);

  const loadDocs = async () => {
    const { data } = await supabase.from("form_documents")
      .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
      .neq("status", "draft")
      .order("created_at", { ascending: false }).limit(200);
    setDocs(data ?? []);
  };
  // يُحمَّل عند فتح الصفحة ليُحتسب عدّاد الردود والاعتماد فورًا
  useEffect(() => { loadDocs(); }, [tab]);

  useEffect(() => {
    if (!review || !isManager) return;
    (async () => {
      const { data } = await supabase.from("school_events")
        .select("id, serial, title, event_date, category, organizer_name, report_submitted_at")
        .not("report_submitted_at", "is", null).neq("stage", "approved").is("cancelled_at", null)
        .order("report_submitted_at", { ascending: true });
      setPendingEvents(data ?? []);
    })();
  }, [review, isManager, tab]);

  // فتح مستند مُعاد لتصحيحه بنفس رقمه التسلسلي
  const startEdit = (d) => {
    const t = templates.find((x) => x.id === d.template_id) ?? d.form_templates;
    if (!t) { setMsg({ ok: false, text: "النموذج لم يعد متاحًا." }); return; }
    setEditing(d);
    setDraftDoc(null);
    setChosen([]); setBatch([]);
    setPicked({ ...t, id: d.template_id });
    setValues(d.data ?? {});
    setIssued(null); setMsg(null); setClassId("");
  };

  const start = (t) => {
    setPicked(t);
    setEditing(null);
    setDraftDoc(null);
    setIssued(null); setMsg(null); setClassId(""); setChosen([]); setBatch([]); setLessons(null);
    const init = {};
    (t.fields ?? []).forEach((f) => {
      if (f.type === "date") init[f.name] = todayBoth();
      // جدول البنود: قيمة فارغة تميّز المستند الجديد عن الصادر قبل إضافة البنود
      else if (f.type === "rubric" && !f.legacy) init[f.name] = {};
      // «@hijri_year»: العام الهجري الحالي، فلا يتقادم الافتراضي المحفوظ مع النموذج
      else if (f.default === "@hijri_year") init[f.name] = `${hijriYear()}`;
      else if (f.default) init[f.name] = f.default;
    });
    setValues(init);
  };

  const multi = chosen.length > 1;

  // حقول يملؤها المستفيد بنفسه — يُحجب عن المُصدِر
  const needsReply = (picked?.fields ?? []).some((f) => f.by_recipient);

  const missing = useMemo(() => {
    if (!picked) return [];
    return (picked.fields ?? []).filter((f) => {
      if (f.by_recipient || f.after_reply) return false;
      if (f.type === "table" || f.type === "duty_schedule" || f.type === "rubric") return false;
      if (f.type === "student" || f.type === "staff") return f.required && chosen.length === 0;
      return f.required && !String(values[f.name] ?? "").trim();
    });
  }, [picked, values, chosen]);

  // حصص المعلم في الفصل الدراسي الحالي: فصوله ومواده وحصصه
  const loadLessons = async (head, { keep = false, tpl = picked } = {}) => {
    setLessons(null);
    // عند فتح مسودة تبقى الحصة المختارة كما حُفظت
    if (!keep) ["lesson_class", "lesson_subject", "lesson_period"].forEach((t) => {
      const f = (tpl?.fields ?? []).find((x) => x.type === t);
      if (f) setValues((v) => ({ ...v, [f.name]: "" }));
    });
    let tid = head.id?.startsWith("t-") ? head.id.slice(2) : null;
    if (!tid && head.uid) {
      const { data } = await supabase.from("teachers").select("id").eq("user_id", head.uid).maybeSingle();
      tid = data?.id ?? null;
    }
    if (!tid) { setLessons([]); return; }
    const { data: st } = await supabase.from("settings")
      .select("key, value").in("key", ["active_year", "active_term"]);
    const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
    const { data } = await supabase.from("schedule")
      .select("day_of_week, period_no, classes(class_no, grade), subjects(name)")
      .eq("teacher_id", tid).eq("academic_year", m.active_year ?? "").eq("term", Number(m.active_term ?? 1));
    setLessons((data ?? []).filter((r) => r.classes).map((r) => ({
      classLabel: `${GRADE_NAMES[r.classes.grade] ?? ""} — ${r.classes.class_no}`,
      subject: r.subjects?.name ?? "",
      dow: r.day_of_week,
      period: r.period_no,
    })));
  };

  const toggleStaff = async (m) => {
    const already = chosen.some((x) => x.id === m.id);
    const next = already ? chosen.filter((x) => x.id !== m.id) : [...chosen, m];
    setChosen(next);

    const head = next[0];
    if (!head) { setValues((v) => ({ ...v, recipient: "", job: "" })); setLessons(null); return; }

    // المسمّى الوظيفي المطبوع: «معلم» لمن يحمل وظيفة التدريس،
    // والصفة الإدارية لمن هو إداري خالص. والتخصص له حقله المستقل.
    const jobValue = head.job ?? "";

    const info = {
      name: head.full_name,
      job: jobValue,
      specialization: head.specialization ?? "",
      national_id: head.national_id ?? "",
    };
    setValues((v) =>
      autoFill(picked?.fields, info,
               { ...v, recipient: head.full_name, job: jobValue },
               { overwrite: true }));

    // استمارات الزيارة: قوائم الفصل والمادة والحصة من جدول المعلم، ورقم الزيارة
    const fields = picked?.fields ?? [];
    if (fields.some((f) => LESSON_TYPES.includes(f.type))) loadLessons(head);
    const visitField = fields.find((f) => f.type === "visit_no");
    if (visitField) {
      const { count } = await supabase.from("form_documents")
        .select("id", { count: "exact", head: true })
        .eq("template_id", picked.id).eq("recipient", head.full_name)
        .eq("hijri_year", hijriYear()).neq("status", "rejected");
      setValues((v) => ({ ...v, [visitField.name]: String((count ?? 0) + 1) }));
    }

    // نموذج التكليف: يُملأ جدول الموظف في المناوبة والإشراف تلقائيًا
    const dutyField = (picked?.fields ?? []).find((f) => f.type === "duty_schedule");
    if (dutyField && head.uid) {
      const { data } = await supabase.rpc("my_duty_schedule", { p_user: head.uid });
      const fmt = (d) => {
        if (!d) return "";
        const x = new Date(d + "T00:00:00");
        const p = (n) => String(n).padStart(2, "0");
        return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
      };
      const rows = data ?? [];
      setValues((v) => ({
        ...v,
        [dutyField.name]: {
          duty: rows.filter((r) => r.kind === "duty").map((r) => ({
            day: r.day_label, date: fmt(r.duty_date),
            hijri: r.hijri_label ?? "", partner: r.partner ?? "",
          })),
          supervision: rows.filter((r) => r.kind === "supervision").map((r) => ({
            day: r.day_label,
            role: r.partner === "supervisor" ? "مشرف متابع" : "معلم مشرف",
          })),
        },
      }));
    }
  };

  // بيانات الطالب المعروفة في القاعدة — لتعبئة الحقول تلقائيًا
  const studentInfo = async (st) => {
    const info = { name: st.full_name, national_id: st.national_id ?? null };
    const [{ data: v }, { data: gs }] = await Promise.all([
      supabase.from("v_active_students").select("class_no, grade").eq("student_id", st.id).maybeSingle(),
      supabase.from("guardian_student").select("guardians(full_name, mobile)").eq("student_id", st.id),
    ]);
    if (v) {
      info.class_label = `${GRADE_NAMES[v.grade] ?? ""} — فصل ${v.class_no}`.trim();
    }
    const g = (gs ?? [])[0]?.guardians;
    if (g) { info.guardian_name = g.full_name; info.guardian_mobile = g.mobile; }
    return info;
  };

  const toggleStudent = async (st) => {
    const already = chosen.some((x) => x.id === st.id);
    const next = already ? chosen.filter((x) => x.id !== st.id) : [...chosen, st];
    setChosen(next);

    const head = next[0];
    if (!head) {
      setValues((v) => ({ ...v, student_id: null, recipient: "" }));
      return;
    }
    setValues((v) => ({ ...v, student_id: head.id, recipient: head.full_name }));

    // التعبئة التلقائية من بيانات أول طالب مختار
    try {
      const info = await studentInfo(head);
      setValues((v) => autoFill(picked?.fields, info,
                                { ...v, student_id: head.id, recipient: head.full_name },
                                { overwrite: true }));
    } catch { /* تبقى الحقول للإدخال اليدوي */ }
  };

  /* المسودة: يُحجز رقمها التسلسلي عند أول حفظ، ولا تُربط بحساب المستفيد حتى
     الإصدار — فلا يراها ولا يصله إشعار بها قبل اكتمالها. تُكمَل من «مسوداتي». */
  const saveDraft = async () => {
    if (!picked) return;
    if (chosen.length > 1) { setMsg({ ok: false, text: "المسودة لمستفيد واحد — اختر شخصًا واحدًا." }); return; }
    const head = chosen[0] ?? null;
    if (!head && !String(values.recipient ?? "").trim()) {
      setMsg({ ok: false, text: "اختر المستفيد أولًا ثم احفظ المسودة." });
      return;
    }
    setSaving(true); setMsg(null);
    const data = {
      ...values,
      ...(head ? { draft_target: { id: head.id, uid: head.uid ?? head.user_id ?? null, full_name: head.full_name,
                                   job: head.job ?? "", specialization: head.specialization ?? "",
                                   national_id: head.national_id ?? "" } } : {}),
    };
    const patch = { data, recipient: (head?.full_name ?? values.recipient) || null, student_id: values.student_id ?? null };
    let res;
    if (draftDoc) {
      res = await supabase.from("form_documents").update(patch).eq("id", draftDoc.id).select().single();
    } else {
      const year = hijriYear();
      const { data: serial, error: se } = await supabase
        .rpc("next_form_serial", { p_category: picked.category, p_hijri_year: year });
      if (se) { setSaving(false); setMsg({ ok: false, text: `تعذّر حجز الرقم: ${se.message}` }); return; }
      res = await supabase.from("form_documents").insert({
        ...patch, template_id: picked.id, serial, title: picked.title, status: "draft",
        hijri_year: year, created_by: session.user.id,
      }).select().single();
    }
    setSaving(false);
    if (res.error) { setMsg({ ok: false, text: `تعذّر حفظ المسودة: ${res.error.message}` }); return; }
    setDraftDoc(res.data);
    loadDrafts();
    setMsg({ ok: true, text: `حُفظت المسودة برقم ${res.data.serial} — أكملها لاحقًا من «مسوداتي» ثم أصدرها.` });
  };

  // فتح مسودة لإكمالها: بياناتها والمستفيد المختار وجدوله كما حُفظت
  const resumeDraft = (d) => {
    const t = templates.find((x) => x.id === d.template_id)
           ?? (d.form_templates ? { ...d.form_templates, id: d.template_id } : null);
    if (!t) { setMsg({ ok: false, text: "النموذج لم يعد متاحًا." }); return; }
    const { draft_target: target, ...rest } = d.data ?? {};
    setPicked(t);
    setEditing(null);
    setDraftDoc(d);
    setIssued(null); setMsg(null); setClassId(""); setBatch([]); setLessons(null);
    setValues(rest);
    setChosen(target ? [target] : []);
    if (target && (t.fields ?? []).some((f) => LESSON_TYPES.includes(f.type))) {
      loadLessons(target, { keep: true, tpl: t });
    }
  };

  const deleteDraft = async (d) => {
    if (!window.confirm(`حذف المسودة ${d.serial}${d.recipient ? ` (${d.recipient})` : ""}؟ لا يمكن التراجع.`)) return;
    const { error } = await supabase.from("form_documents").delete().eq("id", d.id);
    if (error) { setMsg({ ok: false, text: `تعذّر الحذف: ${error.message}` }); return; }
    if (draftDoc?.id === d.id) setDraftDoc(null);
    loadDrafts();
    setMsg({ ok: true, text: `حُذفت المسودة ${d.serial}.` });
  };

  const issue = async () => {
    if (!picked || missing.length) {
      setMsg({ ok: false, text: `أكمل الحقول المطلوبة: ${missing.map((f) => f.label).join("، ")}` });
      return;
    }
    if (draftDoc && chosen.length > 1) {
      setMsg({ ok: false, text: "المسودة لمستفيد واحد — أبقِ شخصًا واحدًا." });
      return;
    }

    // جدول بنود لم تُقدَّر كل عناصره: تنبيه قبل الإصدار (والمسودة بديل)
    const unrated = (picked.fields ?? []).filter((f) => f.type === "rubric" && !f.legacy)
      .reduce((a, f) => { const sc = rubricScore(f, values[f.name]); return a + (sc.count - sc.rated); }, 0);
    if (unrated && !window.confirm(
      `لم تُقدَّر ${unrated} من عناصر البنود.\nهل تصدر الاستمارة رغم ذلك؟\n\nيمكنك بدلًا من ذلك «حفظ مسودة» وإكمالها لاحقًا.`)) return;

    setSaving(true); setMsg(null);

    // تصحيح مستند مُعاد: نحتفظ برقمه التسلسلي ونعيده لقائمة الاعتماد
    if (editing) {
      const { data, error } = await supabase.from("form_documents")
        .update({
          data: values,
          recipient: values.recipient ?? null,
          student_id: values.student_id ?? null,
          status: "pending",
          decision_note: null,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", editing.id).select().single();
      setSaving(false);
      if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }
      setIssued(data);
      setEditing(null);
      loadReturned();
      setMsg({ ok: true, text: `أُعيد إرسال المستند ${data.serial} للاعتماد.` });
      return;
    }

    // إصدار مسودة: برقمها المحجوز وعامها، ويُحدَّث صفّها بدل إنشاء مستند جديد
    const year = draftDoc?.hijri_year ?? hijriYear();
    const { data: serial, error: se } = draftDoc
      ? { data: draftDoc.serial, error: null }
      : await supabase.rpc("next_form_serial", { p_category: picked.category, p_hijri_year: year });
    if (se) { setSaving(false); setMsg({ ok: false, text: `تعذّر إصدار الرقم: ${se.message}` }); return; }

    const usesIssuer = picked.signature_source === "issuer" || picked.signature_source === "both";
    // صفة المُصدِر كما تُطبع تحت توقيعه — مسمّاه الوظيفي الفعلي
    const roles = (adminRoles ?? []).filter((r) => r !== "admin");
    const issuerRole = roles.length
      ? roles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" و")
      : "المعلم";
    const row = {
      template_id: picked.id,
      serial,
      title: picked.title,
      recipient: values.recipient ?? null,
      student_id: values.student_id ?? null,
      data: values,
      status: needsReply ? "awaiting_reply"
            : picked.requires_approval ? "pending" : "issued",
      hijri_year: year,
      created_by: session.user.id,
      signature_path: usesIssuer ? mySig : null,
      signature_name: usesIssuer ? (profile?.full_name ?? profile?.username ?? "") : null,
      signature_role: usesIssuer ? issuerRole : null,
      stamp_path: picked.show_stamp ? (assets.stamp ?? null) : null,
    };

    // شهادة لكل طالب مختار، لكل واحدة رقمها التسلسلي
    const targets = chosen.length ? chosen : [null];
    const rows = [];
    for (let i = 0; i < targets.length; i++) {
      const st = targets[i];
      let sr = serial;
      if (i > 0) {
        const { data: more, error: me } = await supabase
          .rpc("next_form_serial", { p_category: picked.category, p_hijri_year: year });
        if (me) { setSaving(false); setMsg({ ok: false, text: me.message }); return; }
        sr = more;
      }
      const self = isSelfTarget(st, st ? st.full_name : row.recipient,
                                session.user.id, profile?.full_name);
      rows.push({
        ...row,
        ...(self ? { status: "pending" } : {}),
        recipient_user_id: st ? (st.uid ?? st.user_id ?? null) : null,
        serial: sr,
        recipient: st ? st.full_name : row.recipient,
        student_id: st && !/^[tu]-/.test(String(st.id)) ? st.id : row.student_id,
        data: { ...(st
          ? { ...values,
              recipient: st.full_name,
              ...(st.job ? { job: st.job } : {}),
              ...(/^[tu]-/.test(String(st.id)) ? {} : { student_id: st.id }) }
          : values), ...(self ? { self_issued: true } : {}) },
      });
    }

    const { data, error } = draftDoc
      ? await supabase.from("form_documents").update(rows[0]).eq("id", draftDoc.id).select()
      : await supabase.from("form_documents").insert(rows).select();
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }
    if (draftDoc) { setDraftDoc(null); loadDrafts(); }

    setIssued(data[0]);
    setBatch(data);

    // ما يحتاج إفادة يُرسل لصاحبه فورًا — كان يُكتفى بالحفظ فلا يعلم به المستفيد
    const toSend = data.filter((d) => d.status === "awaiting_reply");
    if (toSend.length) {
      const res = await Promise.all(toSend.map(notifyRecipient));
      const failed = toSend.filter((d, i) => !res[i].ok);
      loadDocs();
      if (failed.length) {
        const noAccount = failed.every((d) => !d.recipient_user_id);
        setMsg({
          ok: false,
          text: noAccount
            ? `حُفظ ${failed.map((d) => d.serial).join("، ")} لكن المستفيد غير مرتبط بحساب في البوابة، فلن يصله إشعار ولن يظهر عنده. اختر المستفيد من القائمة لا بكتابة اسمه.`
            : `حُفظ ${failed.map((d) => d.serial).join("، ")} لكن تعذّر إرسال الإشعار: ${res.find((r) => !r.ok).text} — أعد الإرسال من الأرشيف بزر «إرسال للمستفيد».`,
        });
        return;
      }
    }

    const selfCount = rows.filter((x) => x.status === "pending" && !picked.requires_approval).length;
    setMsg({
      ok: true,
      text: selfCount && !needsReply
        ? (data.length === selfCount
            ? `حُفظ برقم ${data[0].serial} — المستند باسمك، فلا يصدر إلا بعد اعتماد المدير.`
            : `صدرت ${data.length - selfCount} شهادة، والتي باسمك بانتظار اعتماد المدير.`)
        : needsReply
        ? `أُرسل ${data[0].serial} للمستفيد — سيصلك إشعار عند وصول ردّه.`
        : picked.requires_approval
        ? `حُفظ ${data.length > 1 ? `${data.length} مستندات` : `برقم ${data[0].serial}`} — بانتظار اعتماد المدير قبل الطباعة.`
        : data.length > 1
          ? `صدرت ${data.length} شهادات — اضغط طباعة لإخراجها دفعة واحدة.`
          : `صدر برقم ${data[0].serial}.`,
    });
  };

  const [decision, setDecision] = useState({});   // قرار الإدارة قبل الإغلاق
  const [report, setReport] = useState(null);    // تقرير نموذج مفتوح للطباعة
  const [rTpl, setRTpl] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  // اعتماد الرد أو إعادته للمستفيد بملاحظة
  const handleReply = async (d, action, note = null) => {
    const patch =
      action === "approve"
        ? { status: "issued", decision_note: null, data: { ...d.data, ...(decision[d.id] ?? {}) } }
        : { status: "awaiting_reply", decision_note: note };
    const { data: saved, error } = await supabase.from("form_documents")
      .update(patch).eq("id", d.id).select("id");
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    // RLS تُسقط التعديل غير المسموح بصمت (بلا خطأ) — نتحقق أن الصف تغيّر فعلًا
    if (!saved?.length) {
      setMsg({ ok: false, text: "لم يُحفظ القرار: حسابك لا يملك صلاحية تعديل هذا المستند. "
        + "الاعتماد لمُصدِره أو لمدير المدرسة أو للدعم الفني (بعد تنفيذ supabase/form_replies_managers.sql)." });
      loadDocs();
      return;
    }
    setRejectFor(null); setRejectNote("");
    setMsg({
      ok: true,
      text: action === "approve"
        ? `اعتُمد المستند ${d.serial} وأُغلق. يمكنك طباعته من الأرشيف.`
        : "أُعيد للمستفيد مع الملاحظة.",
    });
    loadDocs();
    if (action === "return") sendToRecipient({ ...d, status: "awaiting_reply" });
  };

  const decide = async (doc, status, note = null) => {
    const { data, error } = await supabase.from("form_documents")
      .update({
        status,
        decision_note: note,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", doc.id).select("id");
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (!data?.length) {
      setMsg({ ok: false, text: "لم يُحفظ القرار: حسابك لا يملك صلاحية اعتماد هذا المستند." });
      loadDocs();
      return;
    }
    setRejectFor(null); setRejectNote("");
    loadDocs();
  };

  // حذف مستند من الأرشيف — للدعم الفني ومدير المدرسة فقط
  const removeDoc = async (d) => {
    if (!window.confirm(`حذف المستند ${d.serial} نهائيًا من الأرشيف؟`)) return;
    const { error } = await supabase.from("form_documents").delete().eq("id", d.id);
    if (error) { setMsg({ ok: false, text: `تعذّر الحذف: ${error.message}` }); return; }
    setMsg({ ok: true, text: `حُذف المستند ${d.serial}.` });
    loadDocs(); loadReturned();
  };

  // إرسال المستند للمستفيد: إشعار داخل البوابة (جرس) وإشعار على الجوال
  const sendToRecipient = async (d) => {
    const r = await notifyRecipient(d);
    setMsg(r);
    if (r.ok) loadDocs();
  };

  /* إشعار المستفيد (داخل البوابة وعلى الجوال) — يعيد { ok, text } */
  const notifyRecipient = async (d) => {
    if (!d.recipient_user_id) {
      return { ok: false, text: "هذا المستند غير مرتبط بحساب مستفيد." };
    }
    if (!["issued", "approved", "awaiting_reply"].includes(d.status)) {
      return { ok: false, text: "لا يُرسل المستند قبل اعتماده." };
    }

    // المستفيد، ومعه أولياء أمره إن كان طالبًا
    const ids = new Set([d.recipient_user_id]);
    if (d.student_id) {
      const { data: gs } = await supabase
        .from("guardian_student")
        .select("guardians(user_id)")
        .eq("student_id", d.student_id);
      (gs ?? []).forEach((g) => { if (g.guardians?.user_id) ids.add(g.guardians.user_id); });
    }

    const { data: nid, error } = await supabase.rpc("send_notification", {
      p_title: d.title,
      p_body: d.status === "awaiting_reply"
        ? `وصلك ${d.title} برقم ${d.serial} ويحتاج ردّك. افتحه من البوابة واكتب إفادتك ثم أرسلها.`
        : (d.form_templates?.fields ?? []).some((f) => f.type === "rubric" || f.ack)
        ? `وصلك ${d.title} برقم ${d.serial}. افتحه من البوابة واطّلع عليه، ثم أكّد اطلاعك ووقّع.`
        : `صدر لك ${d.title}${d.recipient ? ` باسم ${d.recipient}` : ""} برقم ${d.serial}. يمكنك عرضه وطباعته من البوابة.`,
      p_kind: "general",
      p_link: `/doc/${d.id}`,
      p_roles: null,
      p_user_ids: Array.from(ids),
      p_grade: null,
      p_class_no: null,
      p_is_auto: false,
    });

    if (error) return { ok: false, text: `تعذّر الإرسال: ${error.message}` };
    if (!nid)  return { ok: false, text: "لا يوجد مستلمون مطابقون." };

    // إشعار الجوال
    try {
      await sendPush(nid);
    } catch { /* الإشعار داخل البوابة وصل على كل حال */ }

    await supabase.from("form_documents")
      .update({ sent_at: new Date().toISOString() }).eq("id", d.id);

    return { ok: true, text: `أُرسل إشعار المستند ${d.serial} للمستفيد.` };
  };

  // تقرير نموذج: مستنداته في المدى المحدّد مع أسماء مُصدِريها
  const buildReport = async () => {
    const tpl = templates.find((t) => t.id === rTpl);
    if (!tpl) { setMsg({ ok: false, text: "اختر النموذج أولًا." }); return; }

    let q = supabase.from("form_documents")
      .select("id, serial, recipient, status, created_at, created_by")
      .eq("template_id", tpl.id).neq("status", "draft")
      .order("created_at", { ascending: true });
    if (rFrom) q = q.gte("created_at", `${rFrom}T00:00:00`);
    if (rTo)   q = q.lte("created_at", `${rTo}T23:59:59`);

    const { data, error } = await q;
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (!data?.length) { setMsg({ ok: false, text: "لا مستندات في هذا النطاق." }); return; }

    const ids = [...new Set(data.map((d) => d.created_by).filter(Boolean))];
    const { data: us } = await supabase.from("users")
      .select("id, full_name, username").in("id", ids);
    const nameBy = Object.fromEntries((us ?? []).map((u) => [u.id, u.full_name ?? u.username]));

    // نموذج التكليف: يهمّ المدير من استلم ومن وقّع
    const isAssignment = tpl.key === "frm_duty_assignment";
    let ackBy = {};
    if (isAssignment) {
      const { data: acks } = await supabase.from("form_documents")
        .select("id, sent_at, reply_at, reply_signature_path, status")
        .in("id", data.map((d) => d.id));
      ackBy = Object.fromEntries((acks ?? []).map((a) => [a.id, a]));
    }

    setReport({
      title: tpl.title,
      dept: DEPT_LABEL[tpl.department ?? "school_admin"],
      ack: isAssignment,
      rows: data.map((d) => ({
        ...d,
        issuer_name: nameBy[d.created_by] ?? "—",
        ...(isAssignment ? {
          sent_at: ackBy[d.id]?.sent_at ?? null,
          reply_at: ackBy[d.id]?.reply_at ?? null,
          signed: Boolean(ackBy[d.id]?.reply_signature_path),
        } : {}),
      })),
      from: rFrom ? `${rFrom}T00:00:00` : null,
      to: rTo ? `${rTo}T00:00:00` : null,
    });
    setMsg(null);
  };

  const openDoc = async (d) => {
    setViewing({
      doc: { ...d, signature_source: d.form_templates?.signature_source },
      template: { ...d.form_templates, fields: d.form_templates?.fields ?? [] },
      sig: await signedUrl(d.signature_path),
      replySig: await signedUrl(d.reply_signature_path),
      stamp: await signedUrl(d.stamp_path),
      principal: await signedUrl(assets.principal_signature),
    });
  };

  const printNow = () => window.print();

  // مدخل مباشر لنموذج بعينه (مثل «قبول طالب» من القائمة الجانبية): يُفتح عند التحميل
  const opened = useRef(false);
  useEffect(() => {
    if (!openKey || opened.current || loading) return;
    opened.current = true;
    const t = usable.find((x) => x.key === openKey);
    if (t) start(t);
    else setMsg({ ok: false, text: "النموذج غير متاح بعد: يحتاج تنفيذ ملفه في قاعدة البيانات مرة واحدة." });
  }, [openKey, loading, usable]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loader />;

  /* ---------------- معاينة مستند من الأرشيف ---------------- */
  if (viewing) {
    const d = viewing.doc;
    const printable = d.status === "issued" || d.status === "approved";
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => setViewing(null)} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            رجوع
          </button>
          <div className="flex items-center gap-2">
            <span className={`chip ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
            {printable
              ? <button className="btn-primary" onClick={printNow}>طباعة</button>
              : <span className="text-xs text-muted">لا يُطبع قبل الاعتماد</span>}
          </div>
        </div>
        <div className="no-print">
          <SheetPreview landscape={sheetLandscape(viewing.template)}>
            <FormSheet template={viewing.template} values={d.data} doc={d}
                       sigUrl={printable ? viewing.sig : null}
                       stampUrl={printable ? viewing.stamp : null}
                       principalSigUrl={printable ? viewing.principal : null}
                       principalName={assets.principal_name}
                       // توقيع المستفيد على إفادته يظهر متى وقّع، قبل الاعتماد أيضًا
                       replySigUrl={viewing.replySig}
                       replySigName={d.reply_signature_name} />
          </SheetPreview>
        </div>

        {printable && (
          <div className="hidden print:block">
            <PrintArea landscape={sheetLandscape(viewing.template)}>
              <FormSheet template={viewing.template} values={d.data} doc={d}
                         sigUrl={viewing.sig} stampUrl={viewing.stamp}
                         principalSigUrl={viewing.principal}
                         principalName={assets.principal_name}
                         replySigUrl={viewing.replySig}
                         replySigName={d.reply_signature_name} />
            </PrintArea>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- تعبئة نموذج ---------------- */
  if (picked) {
    // المعاينة قبل الإصدار: اسم المُصدِر وصفته كما سيُطبعان
    const previewRoles = (adminRoles ?? []).filter((r) => r !== "admin");
    const d = issued ?? { serial: null, signature_name: profile?.full_name, signature_source: picked.signature_source,
                          signature_role: previewRoles.length ? previewRoles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" و") : "المعلم" };
    const selfNow = !issued && !editing && (chosen.length
      ? chosen.some((c) => isSelfTarget(c, c.full_name, session.user.id, profile?.full_name))
      : isSelfTarget(null, values.recipient, session.user.id, profile?.full_name));
    const needsApproval = picked.requires_approval || selfNow || issued?.status === "pending";
    const showSign = !needsApproval || issued?.status === "approved";
    const printable = batch.filter((b) => b.status === "issued" || b.status === "approved");
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">{picked.title}</h1>
            <p className="text-sm text-muted">{picked.description}</p>
          </div>
          <button onClick={() => setPicked(null)} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            رجوع للنماذج
          </button>
        </div>

        {/* منطقة الطباعة: مخفية على الشاشة، تظهر عند الطباعة فقط */}
        {printable.length > 0 && (
          <div className="hidden print:block">
            <PrintArea landscape={sheetLandscape(picked)}>
              {printable.map((b) => (
                <FormSheet key={b.id} template={picked} values={b.data} doc={b}
                           sigUrl={urls.sig}
                           stampUrl={picked.show_stamp ? urls.stamp : null}
                           principalSigUrl={urls.principal}
                           principalName={assets.principal_name} />
              ))}
            </PrintArea>
          </div>
        )}

        {editing?.decision_note && (
          <div className="no-print rounded-card border border-absent/30 bg-absent/5 px-4 py-3">
            <p className="text-sm font-semibold text-absent">أعاد المدير هذا النموذج للتعديل</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
              {editing.decision_note}
            </p>
            <p className="num mt-1 text-xs text-faint">رقم المستند: {editing.serial}</p>
          </div>
        )}

        <div className="no-print grid min-w-0 gap-4 lg:grid-cols-[320px,minmax(0,1fr)]">
          <section className="card min-w-0 space-y-3 p-4">
            {(picked.presets ?? []).length > 0 && (
              <div>
                <p className="text-xs text-muted">صيغ جاهزة — اضغط إحداها لتعبئة السبب</p>
                <div className="mt-1.5 space-y-1.5">
                  {picked.presets.map((t, i) => {
                    const field = picked.preset_field || "reason";
                    const on = values[field] === t;
                    return (
                      <button key={i} type="button"
                        onClick={() => setValues((v) => ({ ...v, [field]: t }))}
                        className={`w-full rounded-sm2 border px-3 py-2 text-right text-xs leading-relaxed transition-colors ${
                          on ? "border-mint-deep bg-mint-tint text-mint-deep"
                             : "border-line text-muted hover:bg-canvas"}`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(picked.fields ?? []).filter((f) => !f.by_recipient && !f.after_reply && !f.auto && !f.legacy).map((f) => (
              <div key={f.name}>
                <label className="text-xs text-muted">
                  {f.label}{f.required && <span className="text-absent"> *</span>}
                </label>

                {f.type === "rubric" ? (
                  <RubricInput field={f} value={values[f.name]}
                               onChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))} />
                ) : LESSON_TYPES.includes(f.type) ? (
                  <LessonSelect field={f} fields={picked.fields} values={values} lessons={lessons}
                                hasTeacher={chosen.length > 0}
                                onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />
                ) : f.type === "visit_no" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input className="field num w-24" inputMode="numeric" value={values[f.name] ?? ""}
                           onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value.replace(/\D/g, "") }))} />
                    <span className="text-[11px] text-faint">
                      {chosen.length ? "محسوب من زيارات المعلم هذا العام، ويمكن تعديله" : "يُحسب بعد اختيار المعلم"}
                    </span>
                  </div>
                ) : f.type === "theme" ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {CERT_THEMES.map((t) => {
                      const on = (values.theme || "classic") === t.key;
                      return (
                        <button key={t.key} type="button"
                          onClick={() => setValues((v) => ({ ...v, theme: t.key }))}
                          className={`rounded-sm2 border p-2 text-right transition-colors ${
                            on ? "border-mint-deep bg-mint-tint" : "border-line hover:bg-canvas"}`}>
                          <span className="flex items-center gap-2">
                            <span className="h-6 w-8 shrink-0 rounded-[3px] border-[1.5px]"
                                  style={{ borderColor: t.accent }}>
                              <span className="mx-auto mt-[7px] block h-[3px] w-4 rounded"
                                    style={{ background: t.accent, opacity: .5 }} />
                            </span>
                            <span className={`text-xs font-semibold ${on ? "text-mint-deep" : "text-ink"}`}>
                              {t.label}
                            </span>
                          </span>
                          <span className="mt-1 block text-[10.5px] leading-tight text-faint">{t.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : f.type === "duty_schedule" ? (
                  <p className="mt-1 rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                    يُدرج جدول الموظف في المناوبة والإشراف تلقائيًا بعد اختيار اسمه.
                    {values[f.name]?.duty && (
                      <> — <span className="num">{values[f.name].duty.length}</span> يوم مناوبة
                      و<span className="num">{values[f.name].supervision?.length ?? 0}</span> يوم إشراف.</>
                    )}
                  </p>
                ) : f.type === "table" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">عدد الصفوف الفارغة</span>
                    <input className="field num w-20" inputMode="numeric"
                           value={values[f.name]?.rows ?? f.rows ?? 10}
                           onChange={(e) => {
                             const n = Math.min(40, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1));
                             setValues((v) => ({ ...v, [f.name]: { ...(v[f.name] ?? {}), rows: n } }));
                           }} />
                    <span className="text-[11px] text-faint">تُطبع فارغة لتُملأ بخط اليد</span>
                  </div>
                ) : f.type === "staff" ? (
                  <div className="mt-1 space-y-2">
                    <input className="field w-full" value={staffQ} placeholder="ابحث بالاسم…"
                           onChange={(e) => setStaffQ(e.target.value)} />
                    {teachersOnly(f, picked) && (
                      <p className="text-[11px] text-faint">هذا النموذج لتقييم المعلمين — تظهر أسماء المعلمين فقط.</p>
                    )}
                    <div className="max-h-56 overflow-y-auto rounded-sm2 border border-line">
                      {staff
                        .filter((m) => !teachersOnly(f, picked) || m.job === "معلم")
                        .filter((m) => !staffQ.trim() || m.full_name.includes(staffQ.trim()))
                        .map((m) => {
                          const on = chosen.some((x) => x.id === m.id);
                          return (
                            <button key={m.id} type="button" onClick={() => toggleStaff(m)}
                              className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-right text-sm last:border-b-0 ${
                                on ? "bg-mint-tint text-mint-deep" : "text-ink hover:bg-canvas"}`}>
                              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] ${
                                on ? "border-mint-deep bg-mint-deep text-white" : "border-line"}`}>
                                {on ? "✓" : ""}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{m.full_name}</span>
                              <span className="shrink-0 text-[11px] text-faint">{m.job}</span>
                            </button>
                          );
                        })}
                      {staff.length === 0 && (
                        <p className="px-3 py-3 text-xs text-muted">جارٍ تحميل الموظفين…</p>
                      )}
                    </div>
                    {chosen.length > 1 && (
                      <p className="text-xs text-mint-deep">
                        اخترت <span className="num">{chosen.length}</span> — ستصدر شهادة لكل واحد
                        بمسمّاه الوظيفي، وتُطبع دفعة واحدة.
                      </p>
                    )}
                  </div>
                ) : f.type === "student" ? (
                  <div className="mt-1 space-y-2">
                    <select className="field w-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                      <option value="">اختر الفصل…</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>فصل {c.class_no}</option>
                      ))}
                    </select>

                    {classId && (
                      <div className="max-h-56 overflow-y-auto rounded-sm2 border border-line">
                        {students.map((st) => {
                          const on = chosen.some((x) => x.id === st.id);
                          return (
                            <button key={st.id} type="button" onClick={() => toggleStudent(st)}
                              className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-right text-sm last:border-b-0 ${
                                on ? "bg-mint-tint text-mint-deep" : "text-ink hover:bg-canvas"}`}>
                              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] ${
                                on ? "border-mint-deep bg-mint-deep text-white" : "border-line"}`}>
                                {on ? "✓" : ""}
                              </span>
                              <span className="truncate">{st.full_name}</span>
                            </button>
                          );
                        })}
                        {students.length === 0 && (
                          <p className="px-3 py-3 text-xs text-muted">لا طلاب في هذا الفصل.</p>
                        )}
                      </div>
                    )}

                    {chosen.length > 0 && (
                      <p className="text-xs text-mint-deep">
                        اخترت <span className="num">{chosen.length}</span> طالبًا — ستصدر شهادة لكل واحد،
                        وتُطبع كلها دفعة واحدة.
                      </p>
                    )}
                  </div>
                ) : f.type === "date" || f.type === "daterange" ? (
                  <div className="mt-1">
                    <DateField range={f.type === "daterange"}
                               value={values[f.name] ?? ""}
                               onChange={(val) => setValues((v) => {
                                 const next = { ...v, [f.name]: val };
                                 // أي حقل يطلب عدد الأيام يُحسب من المدى تلقائيًا
                                 if (f.type === "daterange") {
                                   const n = rangeDays(val);
                                   (picked.fields ?? []).forEach((g) => {
                                     if (/عدد (الأيام|أيام)|المدة المحسومة/.test(g.label ?? "")) {
                                       next[g.name] = n ? String(n) : "";
                                     }
                                   });
                                 }
                                 return next;
                               })} />
                  </div>
                ) : f.type === "time" || f.type === "timerange" ? (
                  <div className="mt-1">
                    <TimeField range={f.type === "timerange"}
                               value={values[f.name] ?? ""}
                               onChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))} />
                  </div>
                ) : f.type === "textarea" ? (
                  <>
                    <FieldPresets field={f}
                                  onPick={(t) => setValues((v) => ({ ...v, [f.name]: pickPreset(f, v[f.name], t) }))} />
                    <textarea rows={4} className="field mt-1 w-full" value={values[f.name] ?? ""}
                              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                  </>
                ) : (
                  <>
                    <FieldPresets field={f}
                                  onPick={(t) => setValues((v) => ({ ...v, [f.name]: pickPreset(f, v[f.name], t) }))} />
                    <input className="field mt-1 w-full" value={values[f.name] ?? ""}
                           onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                  </>
                )}
              </div>
            ))}

            {needsReply && (
              <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                هذا النموذج فيه حقول يملؤها المستفيد بنفسه. بعد الإصدار أرسله له من الأرشيف،
                ثم يعود إليك لاعتماده بعد ردّه.
              </p>
            )}

            {picked.signature_source !== "none" && !mySig &&
             (picked.signature_source === "issuer" || picked.signature_source === "both") && (
              <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
                لم ترفع توقيعك بعد. سيصدر المستند بلا توقيع — ارفعه من صفحة «توقيعي».
              </p>
            )}

            {draftDoc && !issued && (
              <p className="rounded-sm2 bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
                مسودة برقم <b className="num text-ink">{draftDoc.serial}</b> — لا تصل المستفيد ولا تُطبع حتى تُصدرها.
              </p>
            )}

            <button className="btn-primary w-full" onClick={issue} disabled={saving || !!issued}>
              {saving ? "جارٍ الحفظ…"
                : issued ? "تم"
                : editing ? "إعادة الإرسال للاعتماد"
                : needsApproval ? "إرسال للاعتماد" : "إصدار وحفظ"}
            </button>

            {/* المسودة: لما يُكمَل على مراحل، كاستمارة زيارة يُقيَّم جزء الصف منها أولًا */}
            {!issued && !editing && chosen.length <= 1 && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-mint-deep hover:bg-canvas"
                      onClick={saveDraft} disabled={saving}>
                {draftDoc ? "حفظ المسودة" : "حفظ مسودة وإكمالها لاحقًا"}
              </button>
            )}

            {selfNow && !picked.requires_approval && (
              <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
                المستند باسمك، فلا يصدر إلا بعد اعتماد المدير.
              </p>
            )}

            {issued && issued.status === "issued" && (sheetLandscape(picked) || isGuestCert(picked)) && (
              <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                في نافذة الطباعة: اجعل الاتجاه <b>{sheetLandscape(picked) ? "أفقيًا" : "عموديًا"}</b> والهوامش <b>بلا هوامش</b>،
                وفعّل <b>طباعة الخلفيات</b> ليظهر الشعاران بلونيهما.
              </p>
            )}

            {issued && printable.length > 0 && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-mint-deep hover:bg-canvas"
                      onClick={printNow}>
                {printable.length > 1 ? `طباعة ${printable.length} شهادات` : "طباعة"}
              </button>
            )}

            {issued && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-muted hover:bg-canvas"
                      onClick={() => start(picked)}>
                إصدار نموذج جديد
              </button>
            )}

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}
          </section>

          <section className="min-w-0 overflow-hidden">
            <p className="mb-1.5 text-xs text-muted">
              معاينة {batch.length > 1 ? `الشهادة الأولى من ${batch.length}` : "مصغّرة"} — الطباعة بالمقاس الأصلي
            </p>
            <SheetPreview landscape={sheetLandscape(picked)}>
              <FormSheet
                template={picked} values={values} doc={d}
                sigUrl={showSign ? urls.sig : null}
                stampUrl={showSign && picked.show_stamp ? urls.stamp : null}
                principalSigUrl={showSign ? urls.principal : null}
                principalName={assets.principal_name}
              />
            </SheetPreview>
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- القوائم ---------------- */
  const pending = docs.filter((d) => d.status === "pending");
  // ردود المستفيدين: المُصدِر يرى ما أصدره، والمدير والدعم الفني يرون الردود كلها
  const replies = docs.filter(
    (d) => (d.status === "replied" || d.status === "awaiting_reply") &&
           (d.created_by === session.user.id || isManager),
  );

  // فلترة قائمتي المتابعة والاعتماد: بحث، ونوع النموذج، والحالة
  const matchFilter = (d) => {
    const q = fQ.trim();
    if (fTpl && d.title !== fTpl) return false;
    if (fStatus && d.status !== fStatus) return false;
    return !q || [d.recipient, d.serial, d.title, d.signature_name]
      .some((v) => String(v ?? "").includes(q));
  };
  const shownReplies = replies.filter(matchFilter);
  const shownPending = pending.filter(matchFilter);
  // ما يُعتمد جماعيًا: الإفادات الواصلة، والمستندات بانتظار الاعتماد
  const selectable = tab === "replies"
    ? shownReplies.filter((d) => d.status === "replied")
    : shownPending;
  const chosenDocs = selectable.filter((d) => sel.has(d.id));
  const toggleSel = (id) => setSel((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // اعتماد المحدد دفعة واحدة — لكل مستند قرار الإدارة المكتوب له إن وُجد
  const bulkApprove = async () => {
    if (!chosenDocs.length) return;
    if (!confirm(`اعتماد ${chosenDocs.length} ${tab === "replies" ? "إفادة وإغلاقها" : "مستند"}؟`)) return;
    setBulkBusy(true); setMsg(null);
    let ok = 0;
    for (const d of chosenDocs) {
      const patch = tab === "replies"
        ? { status: "issued", decision_note: null, data: { ...d.data, ...(decision[d.id] ?? {}) } }
        : { status: "approved", decision_note: null, approved_by: session.user.id,
            approved_at: new Date().toISOString() };
      const { data } = await supabase.from("form_documents").update(patch).eq("id", d.id).select("id");
      if (data?.length) ok += 1;
    }
    setBulkBusy(false);
    setSel(new Set());
    const fail = chosenDocs.length - ok;
    setMsg({ ok: fail === 0, text: fail === 0
      ? `اعتُمد ${ok} ${tab === "replies" ? "وأُغلقت، وهي في الأرشيف" : "مستند"}.`
      : `اعتُمد ${ok}، وتعذّر ${fail} — حسابك لا يملك صلاحية اعتمادها.` });
    loadDocs();
  };

  const filterBar = (list) => {
    const titles = [...new Set(list.map((d) => d.title).filter(Boolean))].sort();
    return (
      <div className="card space-y-2.5 p-3">
        <div className="flex flex-wrap gap-2">
          <input className="field min-w-[160px] flex-1" placeholder="بحث بالاسم أو الرقم أو المُصدِر"
                 value={fQ} onChange={(e) => setFQ(e.target.value)} />
          <select className="field w-auto" value={fTpl} onChange={(e) => setFTpl(e.target.value)}>
            <option value="">كل النماذج</option>
            {titles.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {tab === "replies" && (
            <select className="field w-auto" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">كل الحالات</option>
              <option value="replied">وصلت الإفادة</option>
              <option value="awaiting_reply">بانتظار الإفادة</option>
            </select>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" disabled={!selectable.length}
                   checked={selectable.length > 0 && chosenDocs.length === selectable.length}
                   onChange={(e) => setSel(e.target.checked ? new Set(selectable.map((d) => d.id)) : new Set())} />
            تحديد الكل{selectable.length ? <span className="num"> ({selectable.length})</span> : ""}
          </label>
          <button className="btn-primary px-4 py-1.5 text-xs" disabled={!chosenDocs.length || bulkBusy}
                  onClick={bulkApprove}>
            {bulkBusy ? "جارٍ الاعتماد…" : `اعتماد المحدد (${chosenDocs.length})`}
          </button>
        </div>
        {tab === "replies" && (
          <p className="text-[11px] text-faint">
            يُحدَّد ما وصلت إفادته فقط. ويُحفظ مع كل مستند ما كتبته له في «قرار الإدارة» إن وُجد.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">{review ? "الاعتماد والمتابعة" : "النماذج والشهادات"}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {review
            ? "متابعة النماذج التي تنتظر إفادة أصحابها، واعتماد الإفادات أو إعادتها بملاحظة، واعتماد النماذج."
            : "اختر نموذجًا لتعبئته وطباعته. كل ما يصدر يُحفظ في الأرشيف برقم تسلسلي."}
        </p>
      </div>

      {!review && replies.filter((d) => d.status === "replied").length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
          <p className="text-sm text-mint-deep">
            <span className="font-semibold">
              وصلك <span className="num">{replies.filter((d) => d.status === "replied").length}</span> ردًّا
            </span>
            {" "}— راجعه لاعتماده أو إعادته بملاحظة.
          </p>
          <button onClick={() => navigate("/forms-review")}
                  className="shrink-0 rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white">
            عرضها
          </button>
        </div>
      )}

      {!review && returned.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-absent/30 bg-absent/5 px-4 py-3">
          <p className="text-sm text-absent">
            <span className="font-semibold">
              {returned.length === 1 ? "نموذج واحد أُعيد إليك للتعديل" : `${returned.length} نماذج أُعيدت إليك للتعديل`}
            </span>
            {" "}— صحّحها ثم أعد إرسالها للاعتماد.
          </p>
          <button onClick={() => setTab("returned")}
                  className="shrink-0 rounded-pill bg-absent px-4 py-1.5 text-xs font-semibold text-white">
            عرضها
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(review
          ? [["replies", `متابعة الإفادات (${replies.filter((d) => d.status === "replied").length})`],
             ...(isApprover ? [["approve", `اعتماد النماذج${pending.length ? ` (${pending.length})` : ""}`]] : []),
             // الأحداث: يعتمدها المدير، ويتابعها الدعم الفني
             ...(isManager ? [["events", `اعتماد الأحداث${pendingEvents.length ? ` (${pendingEvents.length})` : ""}`]] : [])]
          : [["issue", "إصدار نموذج"],
             ...(returned.length ? [["returned", `المُعادة إليّ (${returned.length})`]] : []),
             ["archive", "الأرشيف"],
             ["report", "التقارير"]])
          .map(([k, label]) => (
            <button key={k} onClick={() => switchTab(k)}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {label}
            </button>
          ))}
      </div>

      {tab === "issue" && (
        usable.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-semibold text-ink">لا نماذج متاحة لحسابك</p>
            <p className="mt-1.5 text-sm text-muted">راجع الدعم الفني لإتاحة النماذج المناسبة لدورك.</p>
          </div>
        ) : (
          <>
          {/* مسوداتي: نماذج حُفظت لتُكمَل ثم تُصدر */}
          {drafts.length > 0 && (
            <div className="card mb-3 overflow-hidden">
              <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                مسوداتي <span className="num text-muted">({drafts.length})</span>
                <span className="mr-2 text-xs font-normal text-faint">أكملها ثم أصدرها</span>
              </p>
              <div className="divide-y divide-line">
                {drafts.map((d) => {
                  const rubrics = (d.form_templates?.fields ?? []).filter((f) => f.type === "rubric" && !f.legacy);
                  return (
                    <div key={d.id} className="flex items-center gap-2 px-2 py-1 hover:bg-canvas">
                      <button onClick={() => resumeDraft(d)}
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2 text-right">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                          <p className="mt-0.5 text-xs text-faint">
                            <span className="num">{d.serial}</span>{d.recipient ? ` · ${d.recipient}` : ""}
                          </p>
                        </div>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {rubrics.map((f) => {
                            const sc = rubricScore(f, d.data?.[f.name]);
                            const done = sc.rated === sc.count;
                            return (
                              <span key={f.name} className={`chip ${done ? "bg-present/10 text-present" : "bg-warning/10 text-warning"}`}>
                                {f.label}: {done ? "✓" : <><span className="num">{sc.rated}</span> من <span className="num">{sc.count}</span></>}
                              </span>
                            );
                          })}
                          <span className="chip bg-mint-tint text-mint-deep">إكمال</span>
                        </span>
                      </button>
                      <button onClick={() => deleteDraft(d)} title="حذف المسودة"
                              className="shrink-0 rounded-pill border border-absent/40 px-2.5 py-1 text-xs text-absent hover:bg-absent/5">
                        حذف
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* أقسام المدرسة — تظهر الأقسام التي لها نماذج متاحة لهذا الحساب */}
          {(() => {
            const used = DEPARTMENTS.filter((dp) =>
              usable.some((t) => (t.department ?? "school_admin") === dp.key));
            if (used.length < 2) return null;
            return (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[{ key: "all", label: "الكل" }, ...used].map((dp) => (
                  <button key={dp.key} onClick={() => setDept(dp.key)}
                    className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      dept === dp.key ? "bg-mint-tint text-mint-deep"
                                      : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                    {dp.label}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-2">
            {usable
              .filter((t) => dept === "all" || (t.department ?? "school_admin") === dept)
              .map((t) => (
              <button key={t.id} onClick={() => start(t)}
                      className="card p-4 text-right transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{t.title}</p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <UsageBadge map={usage} category="form" itemKey={t.key} />
                    <span className="chip bg-mint-tint text-mint-deep">{CAT_LABEL[t.category]}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[11px] text-faint">
                  {DEPT_LABEL[t.department ?? "school_admin"]}
                </p>
                <p className="mt-1 text-sm text-muted">{t.description}</p>
                {t.requires_approval && (
                  <p className="mt-2 text-xs text-warning">يحتاج اعتماد المدير قبل الطباعة</p>
                )}
              </button>
            ))}
          </div>
          </>
        )
      )}

      {tab === "returned" && (
        <div className="space-y-3">
          {returned.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا نماذج مُعادة إليك.</p>
          )}
          {returned.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                  </p>
                </div>
                <button onClick={() => startEdit(d)} className="btn-primary px-4 py-1.5 text-xs">
                  تصحيح وإعادة إرسال
                </button>
              </div>
              {d.decision_note && (
                <p className="mt-2 whitespace-pre-line rounded-sm2 bg-absent/5 px-3 py-2 text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-absent">سبب الإعادة: </span>{d.decision_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "replies" && (
        <div className="space-y-3">
          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
          {replies.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا نماذج بانتظار رد.</p>
          )}
          {replies.length > 0 && filterBar(replies)}
          {replies.length > 0 && shownReplies.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا نتائج مطابقة للفلتر.</p>
          )}
          {shownReplies.map((d) => (
            <div key={d.id} className={`card space-y-2 p-4 ${sel.has(d.id) ? "ring-2 ring-mint-deep" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {d.status === "replied" && (
                    <input type="checkbox" className="mt-1.5" checked={sel.has(d.id)}
                           onChange={() => toggleSel(d.id)} aria-label="تحديد" />
                  )}
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                  </p>
                  {d.created_by !== session.user.id && d.signature_name && (
                    <p className="mt-0.5 text-[11px] text-faint">أصدرها: {d.signature_name}</p>
                  )}
                </div>
                </div>
                <span className={`chip shrink-0 ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
              </div>

              {/* ما كتبه المستفيد */}
              {(d.form_templates?.fields ?? []).filter((f) => f.by_recipient).map((f) => (
                <div key={f.name} className="rounded-sm2 bg-canvas px-3 py-2">
                  <p className="text-[11px] text-faint">{f.label}</p>
                  <p className="whitespace-pre-line text-sm text-ink">
                    {d.data?.[f.name] || "— لم يردّ بعد —"}
                  </p>
                </div>
              ))}

              {/* مرفقات الإفادة: تقرير طبي أو مستند عذر — تُفتح برابط مؤقت */}
              {d.data?.reply_files?.length > 0 && (
                <div className="rounded-sm2 bg-canvas px-3 py-2">
                  <ReplyFilesList files={d.data.reply_files} />
                </div>
              )}

              {rejectFor?.id === d.id ? (
                <div className="space-y-2 rounded-sm2 border border-absent/30 p-3">
                  <textarea rows={2} className="field w-full" value={rejectNote}
                            placeholder="اكتب ملاحظتك للمستفيد — سيقرأها كما هي."
                            onChange={(e) => setRejectNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary px-4 py-1.5 text-xs" disabled={!rejectNote.trim()}
                            onClick={() => handleReply(d, "return", rejectNote.trim())}>
                      إعادة للمستفيد
                    </button>
                    <button onClick={() => setRejectFor(null)}
                            className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted hover:bg-canvas">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                {/* قرار الإدارة وإغلاق المساءلة — يظهر بعد وصول الرد */}
                {d.status === "replied" &&
                 (d.form_templates?.fields ?? []).filter((f) => f.after_reply && !f.legacy).length > 0 && (
                  <div className="space-y-2 rounded-sm2 border border-[#CCF2DB] bg-mint-tint/40 p-3">
                    <p className="text-xs font-semibold text-mint-deep">قرار الإدارة</p>
                    {(d.form_templates?.fields ?? []).filter((f) => f.after_reply && !f.legacy).map((f) => (
                      <div key={f.name}>
                        <label className="text-[11px] text-muted">{f.label}</label>
                        {f.type === "textarea" ? (
                          <>
                            <FieldPresets field={f}
                              onPick={(t) => setDecision((x) => ({
                                ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: t } }))} />
                            <textarea rows={3} className="field mt-1 w-full"
                                      value={decision[d.id]?.[f.name] ?? d.data?.[f.name] ?? ""}
                                      onChange={(e) => setDecision((x) => ({
                                        ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: e.target.value } }))} />
                          </>
                        ) : (
                          <>
                            <FieldPresets field={f}
                              onPick={(t) => setDecision((x) => ({
                                ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: t } }))} />
                            <input className="field mt-1 w-full"
                                   value={decision[d.id]?.[f.name] ?? d.data?.[f.name] ?? ""}
                                   onChange={(e) => setDecision((x) => ({
                                     ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: e.target.value } }))} />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openDoc(d)}
                          className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas">
                    معاينة
                  </button>
                  <button onClick={() => { setRejectFor(d); setRejectNote(""); }}
                          className="rounded-pill border border-warning/40 px-3 py-1.5 text-xs text-warning hover:bg-warning/5">
                    ملاحظة وإعادة
                  </button>
                  <button onClick={() => removeDoc(d)}
                          className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs text-absent hover:bg-absent/5">
                    حذف
                  </button>
                  {d.status === "replied" && (
                    <button onClick={() => handleReply(d, "approve")} className="btn-primary px-4 py-1.5 text-xs">
                      {/مساءلة/.test(d.title ?? "") ? "اعتماد وإغلاق المساءلة" : "اعتماد وإغلاق النموذج"}
                    </button>
                  )}
                  {d.status === "awaiting_reply" && (
                    <button onClick={() => sendToRecipient(d)}
                            className="rounded-pill border border-mint-deep px-3 py-1.5 text-xs text-mint-deep hover:bg-mint-tint">
                      تذكير المستفيد
                    </button>
                  )}
                </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-3">
          <section className="card space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">تقرير نموذج</p>
              <p className="mt-0.5 text-xs text-muted">
                اختر النموذج والمدى الزمني، فيُبنى تقرير بغلاف رسمي وجدول جاهز للطباعة أو الحفظ PDF.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted">النموذج</label>
              <select className="field mt-1 w-full" value={rTpl} onChange={(e) => setRTpl(e.target.value)}>
                <option value="">اختر النموذج…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted">من تاريخ (اختياري)</label>
                <input type="date" className="field num mt-1 w-full" value={rFrom}
                       onChange={(e) => setRFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted">إلى تاريخ (اختياري)</label>
                <input type="date" className="field num mt-1 w-full" value={rTo}
                       onChange={(e) => setRTo(e.target.value)} />
              </div>
            </div>

            <button className="btn-primary w-full" onClick={buildReport}>بناء التقرير</button>

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${
                msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}
          </section>

          {report && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  <span className="num font-semibold text-ink">{report.rows.length}</span> مستندًا
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setReport(null)}
                          className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
                    إغلاق
                  </button>
                  <button className="btn-primary" onClick={printNow}>طباعة / حفظ PDF</button>
                </div>
              </div>

              <SheetPreview landscape={false}>
                <FormReport {...report} issuedBy={profile?.full_name ?? profile?.username ?? ""} />
              </SheetPreview>

              <div className="hidden print:block">
                <ReportPrintArea>
                  <FormReport {...report} issuedBy={profile?.full_name ?? profile?.username ?? ""} />
                </ReportPrintArea>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "archive" && (
        <>
          {msg && (
            <p className={`mb-3 rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
          <div className="card divide-y divide-line overflow-hidden">
            {docs.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا مستندات بعد.</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-2 py-1 hover:bg-canvas">
                <button onClick={() => openDoc(d)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2 text-right">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                    <p className="num mt-0.5 text-xs text-faint">
                      {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {/* إقرار المستفيد بالاطلاع — في نماذج البنود */}
                    {["issued", "approved"].includes(d.status) &&
                     (d.form_templates?.fields ?? []).some((f) => f.type === "rubric" || f.ack) && (
                      d.data?.ack_at
                        ? <span className="chip bg-present/10 text-present">✓ اطّلع المعلم</span>
                        : d.sent_at ? <span className="chip bg-warning/10 text-warning">بانتظار اطلاعه</span> : null
                    )}
                    <span className={`chip ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
                  </span>
                </button>
                {d.recipient_user_id && ["issued", "approved", "awaiting_reply"].includes(d.status) && (
                  <button onClick={() => sendToRecipient(d)}
                          title={d.sent_at ? "أُرسل سابقًا — يمكن إعادة الإرسال" : "إرسال إشعار للمستفيد"}
                          className={`shrink-0 rounded-pill border px-2.5 py-1 text-xs ${
                            d.sent_at
                              ? "border-line text-muted hover:bg-canvas"
                              : "border-mint-deep text-mint-deep hover:bg-mint-tint"}`}>
                    {d.sent_at ? "أُرسل" : "إرسال للمستفيد"}
                  </button>
                )}
                {isManager && (
                  <button onClick={() => removeDoc(d)} title="حذف من الأرشيف"
                          className="shrink-0 rounded-pill border border-absent/40 px-2.5 py-1 text-xs text-absent hover:bg-absent/5">
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "events" && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted">
            {isApprover
              ? "أحداث رفع منظّموها تقاريرها وتنتظر اعتمادك. افتح الحدث لمراجعة تقريره، ثم اعتمده أو أعده بملاحظة."
              : "أحداث رفع منظّموها تقاريرها وتنتظر اعتماد مدير المدرسة — للمتابعة، والاعتماد لمدير المدرسة."}
          </p>
          {pendingEvents.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا أحداث بانتظار الاعتماد.</p>
          )}
          {pendingEvents.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{e.title}</p>
                <p className="num mt-0.5 text-xs text-faint">
                  {e.serial} · {e.event_date}
                  {e.category ? ` · ${e.category}` : ""}
                  {e.organizer_name ? ` · ${e.organizer_name}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-faint">
                  رُفع التقرير {fmtDate(e.report_submitted_at)}
                </p>
              </div>
              <button onClick={() => navigate(`/events?open=${e.id}&step=approval`)}
                      className="btn-primary shrink-0 px-4 py-1.5 text-xs">
                {isApprover ? "فتح للاعتماد" : "فتح الحدث"}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "approve" && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا مستندات بانتظار الاعتماد.</p>
          )}
          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
          {pending.length > 0 && filterBar(pending)}
          {rejectFor && (
            <div className="card space-y-2 border-absent/30 p-4">
              <p className="text-sm font-semibold text-ink">
                سبب إعادة «{rejectFor.title}» إلى مُصدِره
              </p>
              <textarea rows={3} className="field w-full" value={rejectNote}
                        placeholder="اكتب ما يجب تصحيحه بوضوح — سيقرأه المُصدِر كما هو."
                        onChange={(e) => setRejectNote(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary px-4 py-1.5 text-xs"
                        disabled={!rejectNote.trim()}
                        onClick={() => decide(rejectFor, "rejected", rejectNote.trim())}>
                  إعادة للمُصدِر
                </button>
                <button onClick={() => setRejectFor(null)}
                        className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted hover:bg-canvas">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {shownPending.map((d) => (
            <div key={d.id} className={`card p-4 ${sel.has(d.id) ? "ring-2 ring-mint-deep" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                <input type="checkbox" className="mt-1.5" checked={sel.has(d.id)}
                       onChange={() => toggleSel(d.id)} aria-label="تحديد" />
                <div>
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                  </p>
                  {(d.data?.self_issued || (d.created_by && d.recipient_user_id === d.created_by)) && (
                    <p className="mt-1.5 inline-block rounded-pill bg-absent/10 px-2.5 py-0.5 text-[11px] font-semibold text-absent">
                      أصدره لنفسه
                    </p>
                  )}
                </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDoc(d)}
                          className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas">
                    معاينة
                  </button>
                  <button onClick={() => { setRejectFor(d); setRejectNote(""); }}
                          className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs text-absent hover:bg-absent/5">
                    إعادة للتعديل
                  </button>
                  <button onClick={() => decide(d, "approved")} className="btn-primary px-4 py-1.5 text-xs">
                    اعتماد
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
