// src/pages/nominations/Nominations.jsx
/* =====================================================================
   الترشيحات — صفحة الإدارة: إعلانات التقديم للطلاب (اللجنة الإعلامية، الفريق الكشفي…).
   ينشئ الإعلان كل إداري ومن له دور إداري من المعلمين، ويدير كلٌّ إعلاناته، والمدير والدعم
   الفني يرون الكل (supabase/nominations_1..4.sql). تفاصيل الإعلان ومتقدموه في NomCall.jsx.
   ===================================================================== */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { callStatus, RULES, seatsText, branchesOf, lines } from "../../lib/nominations.js";
import Loader from "../../components/Loader.jsx";
import { Icon } from "../../components/Layout.jsx";
import NomCall from "./NomCall.jsx";
import { Banner } from "../../components/HomeBanners.jsx";
import { normalizeImage } from "../../lib/imageResize";
import { BANNER_BUCKET, BANNER_W, BANNER_H, checkBanner } from "../../lib/banners.js";

const day = (d) => (d ? fmtDate(d + "T12:00:00") : "—");
const DEFAULT_CRITERIA = [
  { id: "c1", name: "المظهر والانضباط", max: 10 },
  { id: "c2", name: "المهارة والخبرة", max: 10 },
  { id: "c3", name: "الحماس والالتزام", max: 10 },
];
const blank = () => ({
  title: "", unit: "", body: "", tasks: "", special_terms: "", grades: [1, 2, 3], seats: 10, reserve: 3,
  opens_on: todayISO(), closes_on: "", rules: {}, questions: [], criteria: DEFAULT_CRITERIA,
  interview_place: "", slot_minutes: 10, guardian_ok: false, link_scouts: false, published: false, branches: [],
  home_banner: true, banner_image: null, staff_lead: null,
});
const addDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
// قالب المركز الإعلامي: فروعه وشروطه وقيادته من المعلمين، ويعدّله صاحب الإعلان قبل النشر
const mediaTeam = () => ({
  ...blank(), title: "الانضمام إلى المركز الإعلامي", unit: "المركز الإعلامي", closes_on: addDays(14), guardian_ok: true,
  body: "يضم المركز الإعلامي فريقًا من الطلاب يوثّق فعاليات المدرسة وبرامجها بالصور والمقاطع والأخبار، وتُنشر أعماله في «معرض المدرسة» داخل حسابات البوابة فقط، ومنها برنامج «وجوه من مكة الثانوية».",
  tasks: ["تصوير الفعاليات والبرامج بأجهزة المدرسة وبإذن مسبق", "كتابة الأخبار والتعليقات القصيرة على المواد", "إعداد المقاطع القصيرة ومونتاجها",
    "إعداد حلقات «وجوه من مكة الثانوية»", "الالتزام بقائمة «لا يُصوَّر» قبل كل تصوير"].join("\n"),
  terms: ["أصوّر بأجهزة المدرسة فقط، ولا أصوّر بجوالي الشخصي", "لا أنشر أي صورة أو مقطع خارج البوابة",
    "لا أصوّر أحدًا في قائمة «لا يُصوَّر»", "أصوّر في الأماكن والأوقات المأذون بها فقط"],
  branches: [["التصوير الفوتوغرافي", 4], ["التصوير المرئي والمونتاج", 3], ["التحرير والكتابة", 3], ["التصميم", 2]]
    .map(([name, seats]) => ({ id: uid(), name, note: "", seats, reserve: 1 })),
  rules: { min_attend: 90, max_degree: 2 },
  questions: [{ id: uid(), q: "ما خبرتك في التصوير أو الكتابة أو التصميم؟", kind: "text", options: [] },
    { id: uid(), q: "هل لديك أعمال سابقة تستطيع عرضها في المقابلة؟", kind: "choice", options: ["نعم", "لا"] }],
  criteria: [{ id: "c1", name: "المهارة الفنية", max: 10 }, { id: "c2", name: "الأمانة والانضباط", max: 10 },
    { id: "c3", name: "العمل الجماعي", max: 10 }, { id: "c4", name: "الإبداع", max: 10 }],
  staff_lead: "مشرف المركز الإعلامي", link_media: true,
});
const uid = () => Math.random().toString(36).slice(2, 8);

export default function Nominations() {
  const { id } = useParams();
  if (id) return <NomCall id={id} />;
  return <CallList />;
}

function CallList() {
  const [calls, setCalls] = useState(null);
  const [counts, setCounts] = useState({});
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);
  const load = async () => {
    const [c, n] = await Promise.all([
      supabase.from("nom_calls").select("*").order("created_at", { ascending: false }),
      supabase.rpc("nom_counts"),
    ]);
    if (c.error) setErr(/nom_calls/.test(c.error.message) ? "الصفحة تحتاج تشغيل supabase/nominations_1.sql إلى 4." : c.error.message);
    setCalls(c.data ?? []);
    setCounts(Object.fromEntries((n.data ?? []).map((r) => [r.call_id, r])));
  };
  useEffect(() => { load(); }, []);

  if (edit) return <CallEditor init={edit} onClose={(saved) => { setEdit(null); if (saved) load(); }} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الترشيحات</h1>
          <p className="text-sm text-muted">إعلانات التقديم للطلاب: الشروط والمقابلات والفرز وإعلان المقبولين.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-pill border border-line bg-white px-4 py-2 text-sm text-ink hover:bg-canvas" onClick={() => setEdit(mediaTeam())}>قالب: المركز الإعلامي</button>
          <button className="btn-primary" onClick={() => setEdit(blank())}>+ إعلان جديد</button>
        </div>
      </div>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!calls ? <Loader /> : !calls.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">لا إعلانات بعد. ابدأ بـ «إعلان جديد»، مثل الانضمام للجنة الإعلامية أو الفريق الكشفي.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {calls.map((c) => {
            const st = callStatus(c), n = counts[c.id] ?? {};
            return (
              <div key={c.id} className="card flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-mint-deep"><Icon name="megaphone" className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{c.title}</p>
                    <p className="text-xs text-muted">{c.unit || "—"} · {c.owner_name}</p>
                  </div>
                  <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[[seatsText(c.seats), "مقعد"], [n.total ?? 0, "متقدم"], [n.shortlisted ?? 0, "للمقابلة"], [n.accepted ?? 0, "مقبول"]].map(([v, l]) => (
                    <div key={l} className="rounded-sm2 bg-canvas py-1.5"><p className="num text-lg font-bold text-ink">{v}</p><p className="text-[11px] text-muted">{l}</p></div>
                  ))}
                </div>
                <p className="text-xs text-muted">التقديم <span className="num">{day(c.opens_on)}</span> — <span className="num">{day(c.closes_on)}</span>
                  {" · "}{c.grades.map((g) => GRADE_NAMES[g]?.replace(" الثانوي", "")).join("، ")}
                  {branchesOf(c).length > 0 && <> · <span className="num">{branchesOf(c).length}</span> فروع</>}</p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Link to={`/nominations/${c.id}`} className="btn-primary px-4 py-1.5 text-xs">المتقدمون والفرز</Link>
                  {!c.results_at && <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas" onClick={() => setEdit(c)}>تعديل</button>}
                  <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas"
                    onClick={() => setEdit({ ...c, id: undefined, title: `${c.title} (نسخة)`, published: false, results_at: null, cancelled_at: null, opens_on: todayISO(), closes_on: "", banner_image: null })}>نسخ</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ——— إنشاء الإعلان وتعديله ——— */
// عدد المقاعد، أو «مفتوحة» بلا حد (فيُغلق الاحتياط تلقائيًا)
function SeatsField({ seats, onChange }) {
  const open = seats == null;
  return (
    <div className="text-xs font-medium text-muted">
      <div className="flex items-center justify-between">عدد المقاعد
        <label className="flex items-center gap-1 font-normal text-ink">
          <input type="checkbox" checked={open} onChange={(e) => onChange(e.target.checked ? null : 10)} />مفتوحة
        </label>
      </div>
      {open ? <p className="field mt-1 flex items-center text-muted">بلا حد</p>
            : <input type="number" min="1" className="field mt-1" value={seats} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}

// خارج المكوّن حتى لا تُعاد الحقول فيفقد المؤشر مكانه أثناء الكتابة
const L = ({ t, children, hint }) => (
  <label className="block text-xs font-medium text-muted">{t}{children}{hint && <span className="mt-1 block text-[11px] font-normal text-faint">{hint}</span>}</label>
);

function CallEditor({ init, onClose }) {
  const { profile } = useSession();
  // الشروط الخاصة: شرط في كل سطر يقرّ به الطالب؛ والفروع بمقاعدها (nominations_5.sql)
  const [f, setF] = useState(() => ({ ...init, branches: branchesOf(init), terms: init.terms ?? lines(init.special_terms) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);       // صورة بطاقة الرئيسية قبل رفعها
  const [preview, setPreview] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setRule = (k, v) => setF((x) => ({ ...x, rules: { ...x.rules, [k]: v === "" ? undefined : Number(v) } }));
  const setQ = (i, k, v) => setF((x) => ({ ...x, questions: x.questions.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }));
  const setT = (i, v) => setF((x) => ({ ...x, terms: x.terms.map((t, j) => (j === i ? v : t)) }));
  const setB = (i, k, v) => setF((x) => ({ ...x, branches: x.branches.map((b, j) => (j === i ? { ...b, [k]: v } : b)) }));
  const setC = (i, k, v) => setF((x) => ({ ...x, criteria: x.criteria.map((q, j) => (j === i ? { ...q, [k]: v } : q)) }));

  const save = async (publish) => {
    if (!f.title.trim() || !f.closes_on) { setErr("اكتب عنوان الإعلان وآخر موعد للتقديم."); return; }
    if (f.closes_on < f.opens_on) { setErr("آخر موعد للتقديم قبل بدايته."); return; }
    if (!f.grades.length) { setErr("اختر صفًا واحدًا على الأقل."); return; }
    const branches = f.branches.filter((b) => b.name.trim()).map((b) => ({
      id: b.id, name: b.name.trim(), note: b.note?.trim() || undefined,
      seats: b.seats == null ? null : Math.max(1, Number(b.seats) || 1),
      reserve: b.seats == null ? 0 : Math.max(0, Number(b.reserve) || 0),
    }));
    // مع الفروع: مقاعد الإعلان مجموع مقاعد فروعه، ومفتوحة إن كان فيها فرع مفتوح
    const open = branches.length ? branches.some((b) => b.seats == null) : f.seats == null;
    const seats = open ? null : branches.length ? branches.reduce((a, b) => a + b.seats, 0) : Math.max(1, Number(f.seats) || 1);
    const reserve = open ? 0 : branches.length ? branches.reduce((a, b) => a + b.reserve, 0) : Number(f.reserve) || 0;
    setBusy(true); setErr("");
    // صورة بطاقة الرئيسية (nominations_6.sql): تُضبط على مقاس الإعلانات وتُرفع في home-banners/nom/
    let banner_image = f.home_banner ? f.banner_image ?? null : null;
    if (file && f.home_banner) {
      const img = await normalizeImage(file, BANNER_W, BANNER_H, 0.86);
      const path = `nom/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BANNER_BUCKET).upload(path, img, { contentType: "image/jpeg" });
      if (error) { setBusy(false); setErr(`تعذّر رفع صورة البطاقة: ${error.message}`); return; }
      banner_image = path;
    }
    const row = {
      title: f.title.trim(), unit: f.unit || null, body: f.body || null, tasks: f.tasks || null, special_terms: f.terms.map((t) => t.trim()).filter(Boolean).join("\n") || null,
      grades: f.grades, seats, reserve, branches, opens_on: f.opens_on, closes_on: f.closes_on,
      rules: Object.fromEntries(Object.entries(f.rules ?? {}).filter(([, v]) => v != null && !Number.isNaN(v))),
      questions: f.questions.filter((q) => q.q.trim()).map((q) => ({ ...q, options: q.kind === "choice" ? (q.options ?? []).filter(Boolean) : undefined })),
      criteria: f.criteria.filter((c) => c.name.trim()).map((c) => ({ ...c, max: Number(c.max) || 10 })),
      interview_place: f.interview_place || null, slot_minutes: Number(f.slot_minutes) || 10,
      guardian_ok: f.guardian_ok, link_scouts: f.link_scouts, published: publish ?? f.published,
      home_banner: !!f.home_banner, banner_image,
      // قيادة المعلمين (nominations_7.sql): لا يُرسل الحقل إلا عند استعماله، فلا يتعطل الحفظ قبل تشغيل الملف
      ...(f.staff_lead?.trim() || init.staff_lead ? { staff_lead: f.staff_lead?.trim() || null } : {}),
      ...(f.link_media || init.link_media ? { link_media: !!f.link_media } : {}),      // media_3.sql
    };
    const q = f.id ? supabase.from("nom_calls").update(row).eq("id", f.id)
      : supabase.from("nom_calls").insert({ ...row, owner_name: profile?.full_name ?? "" });
    const { error } = await q;
    setBusy(false);
    if (error) { setErr(error.message); return; }
    // الصورة القديمة تُحذف إن استُبدلت أو أُزيلت (init: ما كان محفوظًا)
    if (init.banner_image && init.banner_image !== banner_image && f.id) supabase.storage.from(BANNER_BUCKET).remove([init.banner_image]);
    onClose(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-ink">{f.id ? "تعديل الإعلان" : "إعلان جديد"}</h1>
        <button className="text-sm text-muted underline" onClick={() => onClose(false)}>رجوع</button>
      </div>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <L t="عنوان الإعلان"><input className="field mt-1" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="الانضمام للجنة الإعلامية" /></L>
        <L t="الجهة"><input className="field mt-1" value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="اللجنة الإعلامية / الفريق الكشفي / الإذاعة…" /></L>
        <div className="sm:col-span-2"><L t="وصف الدور"><textarea className="field mt-1 min-h-[70px]" value={f.body ?? ""} onChange={(e) => set("body", e.target.value)} /></L></div>
        <div className="sm:col-span-2"><L t="المهام والمطلوب من الطالب" hint="سطر لكل مهمة."><textarea className="field mt-1 min-h-[70px]" value={f.tasks ?? ""} onChange={(e) => set("tasks", e.target.value)} /></L></div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">شروطك الخاصة</p>
          <button type="button" className="text-xs text-mint-deep underline" onClick={() => set("terms", [...f.terms, ""])}>+ شرط</button></div>
        {!f.terms.length && <p className="text-xs text-faint">اختياري: شروط تضعها أنت، ويقرّ الطالب بكل شرط منها قبل التقديم، مثل: إجادة التصوير، أو الالتزام بالحضور بعد الدوام.</p>}
        {f.terms.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="num w-5 text-center text-xs text-faint">{i + 1}</span>
            <input className="field flex-1" value={t} onChange={(e) => setT(i, e.target.value)} placeholder="نص الشرط" />
            <button type="button" className="text-xs text-absent" onClick={() => set("terms", f.terms.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">المقاعد والمدة والفئة</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {f.branches.length ? (
            <p className="rounded-sm2 bg-canvas px-3 py-2 text-xs text-muted sm:col-span-2">المقاعد والاحتياط لكل فرع في قسم «فروع الإعلان».</p>
          ) : (
            <>
              <SeatsField seats={f.seats} onChange={(v) => setF((x) => ({ ...x, seats: v, reserve: v == null ? 0 : x.reserve }))} />
              <L t="الاحتياط" hint={f.seats == null ? "يُغلق تلقائيًا مع المقاعد المفتوحة" : null}>
                <input type="number" min="0" className="field mt-1" disabled={f.seats == null} value={f.seats == null ? 0 : f.reserve} onChange={(e) => set("reserve", e.target.value)} /></L>
            </>
          )}
          <L t="بداية التقديم"><input type="date" className="field mt-1" value={f.opens_on} onChange={(e) => set("opens_on", e.target.value)} /></L>
          <L t="آخر موعد للتقديم"><input type="date" className="field mt-1" value={f.closes_on ?? ""} onChange={(e) => set("closes_on", e.target.value)} /></L>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">الصفوف المستهدفة:
          {[1, 2, 3].map((g) => (
            <button key={g} type="button" onClick={() => set("grades", f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g].sort())}
              className={`rounded-pill px-3 py-1 text-xs font-semibold ${f.grades.includes(g) ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>{GRADE_NAMES[g]}</button>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">فروع الإعلان</p>
          <button type="button" className="text-xs text-mint-deep underline"
                  onClick={() => set("branches", [...f.branches, { id: uid(), name: "", note: "", seats: null, reserve: 0 }])}>+ فرع</button></div>
        {!f.branches.length && <p className="text-xs text-faint">اختياري: إن كان للإعلان فروع يختار الطالب واحدًا منها، مثل مسابقة القرآن الكريم: حفظ القرآن كاملًا، حفظ 10 أجزاء، حفظ 5 أجزاء. ولكل فرع مقاعده.</p>}
        {f.branches.map((b, i) => (
          <div key={b.id} className="grid gap-2 rounded-sm2 border border-line p-3 sm:grid-cols-4">
            <L t={`الفرع ${i + 1}`}><input className="field mt-1" value={b.name} onChange={(e) => setB(i, "name", e.target.value)} placeholder="حفظ 10 أجزاء" /></L>
            <SeatsField seats={b.seats} onChange={(v) => setF((x) => ({ ...x, branches: x.branches.map((y, j) => (j === i ? { ...y, seats: v, reserve: v == null ? 0 : y.reserve } : y)) }))} />
            <L t="الاحتياط" hint={b.seats == null ? "يُغلق مع المقاعد المفتوحة" : null}>
              <input type="number" min="0" className="field mt-1" disabled={b.seats == null} value={b.seats == null ? 0 : b.reserve ?? 0} onChange={(e) => setB(i, "reserve", e.target.value)} /></L>
            <div className="flex items-end"><button type="button" className="text-xs text-absent" onClick={() => set("branches", f.branches.filter((_, j) => j !== i))}>حذف الفرع</button></div>
            <input className="field sm:col-span-4" value={b.note ?? ""} onChange={(e) => setB(i, "note", e.target.value)} placeholder="وصف الفرع أو شرطه (اختياري)، مثل: من سورة البقرة إلى آخر سورة التوبة" />
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">شروط تتحقق منها البوابة تلقائيًا <span className="font-normal text-faint">(اتركها فارغة إن لم تلزم)</span></p>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(RULES).map(([k, r]) => (
            <L key={k} t={`${r.t}${r.unit ? ` (${r.unit})` : ""}`}>
              <input type="number" className="field mt-1" value={f.rules?.[k] ?? ""} onChange={(e) => setRule(k, e.target.value)} placeholder={k === "max_degree" ? "مثل 2" : "مثل 90"} />
            </L>
          ))}
        </div>
        <p className="text-[11px] text-faint">تُحسب من بيانات الفصل الدراسي الحالي، ولا يستطيع التقديم من لا تنطبق عليه.</p>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={f.guardian_ok} onChange={(e) => set("guardian_ok", e.target.checked)} /> يشترط موافقة ولي الأمر من حسابه</label>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={f.link_scouts} onChange={(e) => set("link_scouts", e.target.checked)} /> المقبولون يُضافون إلى الفريق الكشفي عند إعلان النتائج</label>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={!!f.link_media} onChange={(e) => set("link_media", e.target.checked)} /> المقبولون يُضافون إلى المركز الإعلامي بفرعهم عند إعلان النتائج</label>
      </section>

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">أسئلة التقديم</p>
          <button type="button" className="text-xs text-mint-deep underline" onClick={() => set("questions", [...f.questions, { id: uid(), q: "", kind: "text", options: [] }])}>+ سؤال</button></div>
        {!f.questions.length && <p className="text-xs text-faint">اختياري، مثل: ما مهاراتك؟ هل لديك خبرة سابقة؟</p>}
        {f.questions.map((q, i) => (
          <div key={q.id} className="grid gap-2 rounded-sm2 border border-line p-2 sm:grid-cols-[1fr_auto_auto]">
            <input className="field" value={q.q} onChange={(e) => setQ(i, "q", e.target.value)} placeholder="نص السؤال" />
            <select className="field" value={q.kind} onChange={(e) => setQ(i, "kind", e.target.value)}><option value="text">إجابة نصية</option><option value="choice">اختيار من متعدد</option></select>
            <button type="button" className="text-xs text-absent" onClick={() => set("questions", f.questions.filter((_, j) => j !== i))}>حذف</button>
            {q.kind === "choice" && <input className="field sm:col-span-3" value={(q.options ?? []).join("، ")} placeholder="الخيارات مفصولة بفاصلة: نعم، لا"
              onChange={(e) => setQ(i, "options", e.target.value.split(/[،,]/).map((s) => s.trim()))} />}
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={f.staff_lead != null} onChange={(e) => set("staff_lead", e.target.checked ? "قائد الفريق" : null)} />
          ترشّح المعلمين لقيادة الفريق
        </label>
        {f.staff_lead != null && (
          <div className="grid gap-2 sm:grid-cols-2">
            <L t="اسم دور القيادة"><input className="field mt-1" value={f.staff_lead} maxLength={60} onChange={(e) => set("staff_lead", e.target.value)} placeholder="مشرف المركز الإعلامي" /></L>
            <p className="self-end text-xs leading-relaxed text-faint">يظهر الإعلان في رئيسية المعلمين والإداريين بزر «أترشّح»، ويكتب المترشّح نبذة عن خبرته، وتختار أنت من تبويب «ترشّح المعلمين».</p>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">المقابلة</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <L t="مكان المقابلة"><input className="field mt-1" value={f.interview_place ?? ""} onChange={(e) => set("interview_place", e.target.value)} placeholder="مركز مصادر التعلم" /></L>
          <L t="مدة كل مقابلة (دقيقة)"><input type="number" min="1" className="field mt-1" value={f.slot_minutes} onChange={(e) => set("slot_minutes", e.target.value)} /></L>
        </div>
        <div className="flex items-center justify-between"><p className="text-xs font-medium text-muted">معايير التقييم</p>
          <button type="button" className="text-xs text-mint-deep underline" onClick={() => set("criteria", [...f.criteria, { id: uid(), name: "", max: 10 }])}>+ معيار</button></div>
        {f.criteria.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <input className="field flex-1" value={c.name} onChange={(e) => setC(i, "name", e.target.value)} placeholder="اسم المعيار" />
            <input type="number" min="1" className="field w-20" value={c.max} onChange={(e) => setC(i, "max", e.target.value)} title="الدرجة العظمى" />
            <button type="button" className="text-xs text-absent" onClick={() => set("criteria", f.criteria.filter((_, j) => j !== i))}>حذف</button>
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input type="checkbox" checked={!!f.home_banner} onChange={(e) => set("home_banner", e.target.checked)} />
          عرض بطاقة في رئيسية الطلاب وأولياء الأمور
        </label>
        {f.home_banner && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2 text-xs text-muted">
              <p className="leading-relaxed">تظهر البطاقة لصفوف الإعلان من بداية التقديم إلى آخر موعده، وزرها «قدّم الآن» يفتح «فرص المشاركة».
                وعند إعلان النتائج تصير «أُعلنت نتائج …» خمسة أيام، بلا أسماء.</p>
              <label className="block">صورة البطاقة (اختيارية)
                <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-xs"
                       onChange={async (e) => {
                         const x = e.target.files?.[0] ?? null; e.target.value = "";
                         if (!x) return;
                         const bad = await checkBanner(x);
                         if (bad) { setErr(bad); return; }
                         setErr(""); setFile(x); setPreview(URL.createObjectURL(x));
                       }} />
              </label>
              <p className="text-[11px] text-faint">المقاس: عرض <span className="num">{BANNER_W}</span> وارتفاع <span className="num">{BANNER_H}</span> بكسل، ولا تكتب العنوان داخل الصورة.</p>
              {(preview || f.banner_image) && (
                <button type="button" className="text-absent underline" onClick={() => { setFile(null); setPreview(null); set("banner_image", null); }}>إزالة الصورة</button>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-xs text-muted">معاينة كما تظهر في الرئيسية</p>
              <Banner preview b={{ kind: "opportunity", title: f.title || "عنوان الإعلان", body: (f.body ?? "").slice(0, 160),
                image_path: preview ? null : f.banner_image, image_url: preview ?? undefined, link: "/opportunities", link_label: "قدّم الآن" }} />
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>{f.published ? "حفظ" : "حفظ ونشر للطلاب"}</button>
        {!f.published && <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted hover:bg-canvas" disabled={busy} onClick={() => save(false)}>حفظ مسودة</button>}
        {f.id && f.published && !f.results_at && <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted hover:bg-canvas" disabled={busy} onClick={() => save(false)}>إخفاء عن الطلاب</button>}
      </div>
    </div>
  );
}
