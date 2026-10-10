import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { GRADE_NAMES, todayISO } from "../lib/schoolTime";
import { fmtDate } from "../lib/dates";
import { WARNING_STAGES, loadRangeStart, loadFingerprintPublic } from "../lib/officialAttendance";
import { printReport, PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import StudentPicker from "../components/StudentPicker.jsx";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import { Programs, Requests, MonthlyReport } from "./GuidanceMore.jsx";

/* =====================================================================
   التوجيه الطلابي (supabase/guidance_1.sql و guidance_2.sql).
   كل صف مرتبط بموجهه (counselor_1..3): يرى طلاب صفه وحالاتهم وحده،
   ويرى وكيل شؤون الطلاب ومدير المدرسة والدعم الفني الصفوف كلها.
   • الإنذار المبكر: طلاب الصف الذين يحتاجون تدخلًا، بحدود البوابة نفسها:
     الغياب الرسمي بمراحل الإنذارات (5 متابعة، 10، 15، 20)، والتأخر الصباحي
     ثلاث مرات فأكثر (المواقف الثلاثة في الإجراءات)، ومتوسط الاختبارات القصيرة
     أقل من 60٪ («يحتاج دعمًا» في دورة الاختبار) في مادتين فأكثر، والإحالات.
   • الحالات: سجل سري لكل حالة وجلساتها، وإغلاقها بنتيجتها، وطباعتها.
   • الخطة والبرامج، وطلبات المقابلة، والتقرير الشهري: GuidanceMore.jsx.
   ===================================================================== */

const WATCH_AT = 5;          // متابعة الغياب كما في «الإنذارات والمحاضر»
const LATE_AT = 3;           // التأخر الصباحي: الموقف الثالث
const LOW_SUBJECTS_AT = 2;   // مادتان فأكثر دون 60٪
const SOURCE = { warning: "الإنذار المبكر", referral: "إحالة", guardian: "طلب ولي الأمر", student: "طلب الطالب", teacher: "ملاحظة معلم", other: "أخرى" };
const KIND = { individual: "فردية", group: "جماعية", guardian: "مع ولي الأمر", teacher: "مع المعلم" };
const OUTCOME = { improved: "تحسّنت الحالة", referred: "أُحيلت لجهة مختصة", continuing: "مستمرة تُتابع لاحقًا" };

const absStage = (d) => [...WARNING_STAGES].reverse().find((s) => d >= s.days)?.label ?? (d >= WATCH_AT ? "متابعة" : null);
const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

// أسباب ظهور الطالب في الإنذار المبكر
function reasonsOf(r) {
  const out = [];
  const st = absStage(r.absent_days);
  if (st) out.push({ k: "absence", t: `غياب ${r.absent_days} أيام · ${st}`, c: "bg-absent/10 text-absent" });
  if (r.late_days >= LATE_AT) out.push({ k: "late", t: `تأخر صباحي ${r.late_days} مرات`, c: "bg-late/10 text-late" });
  if (r.low_subjects.length >= LOW_SUBJECTS_AT)
    out.push({ k: "study", t: `تعثر دراسي: ${r.low_subjects.join("، ")}`, c: "bg-excused/10 text-excused" });
  if (r.referrals > 0)
    out.push({ k: "behavior", t: `إحالات ${r.referrals}${r.max_degree ? ` · الدرجة ${r.max_degree}` : ""}`, c: "bg-warning-light text-warning" });
  return out;
}

export default function Guidance() {
  const { adminRoles, profile } = useSession();
  const seesAll = adminRoles.some((r) => ["principal", "deputy_students", "tech_support"].includes(r));
  const myGrades = [1, 2, 3].filter((g) => seesAll || adminRoles.includes(`counselor_${g}`));
  // ?tab=requests&grade=2 من صندوق «مهامي»
  const [params] = useSearchParams();
  const linkedGrade = Number(params.get("grade"));
  const [grade, setGrade] = useState(myGrades.includes(linkedGrade) ? linkedGrade : myGrades[0] ?? null);
  const [tab, setTab] = useState(["warn", "cases", "programs", "requests", "report"].includes(params.get("tab")) ? params.get("tab") : "warn");
  const [newCase, setNewCase] = useState(null);   // { student, title, details, source }
  const [openCase, setOpenCase] = useState(null); // معرّف الحالة
  const [tick, setTick] = useState(0);

  useEffect(() => { if (!grade && myGrades[0]) setGrade(myGrades[0]); }, [myGrades.join()]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!myGrades.length) return <p className="card px-4 py-6 text-sm text-muted">هذه الصفحة لموجهي الصفوف ووكيل شؤون الطلاب ومدير المدرسة والدعم الفني.</p>;

  if (openCase) return <CaseView id={openCase} me={profile?.full_name} onBack={() => { setOpenCase(null); setTick((t) => t + 1); }} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">التوجيه الطلابي</h1>
        <p className="mt-1 text-sm text-muted">
          {seesAll ? "حالات الصفوف كلها، كل صف لموجهه." : `صفك: ${GRADE_NAMES[grade] ?? ""}. ما تكتبه هنا سري، لا يطّلع عليه إلا أنت ووكيل شؤون الطلاب ومدير المدرسة والدعم الفني.`}
        </p>
      </div>

      {myGrades.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {myGrades.map((g) => <button key={g} className={pill(grade === g)} onClick={() => setGrade(g)}>{GRADE_NAMES[g]}</button>)}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "warn")} onClick={() => setTab("warn")}>الإنذار المبكر</button>
        <button className={pill(tab === "cases")} onClick={() => setTab("cases")}>الحالات</button>
        <button className={pill(tab === "programs")} onClick={() => setTab("programs")}>الخطة والبرامج</button>
        <button className={pill(tab === "requests")} onClick={() => setTab("requests")}>طلبات المقابلة</button>
        <button className={pill(tab === "report")} onClick={() => setTab("report")}>التقرير الشهري</button>
        <button className="btn-primary mr-auto px-4 py-1.5 text-xs" onClick={() => setNewCase({ source: "other" })}>+ حالة جديدة</button>
      </div>

      {newCase && (
        <NewCase init={newCase} grade={grade} me={profile?.full_name}
                 onClose={() => setNewCase(null)}
                 onSaved={(id) => { setNewCase(null); setOpenCase(id); }} />
      )}

      {tab === "warn"
        ? <EarlyWarning key={`${grade}-${tick}`} grade={grade}
                        onOpen={(r) => r.open_case ? setOpenCase(r.open_case) : setNewCase({
                          source: "warning",
                          student: { student_id: r.student_id, full_name: r.full_name, class_no: r.class_no, grade },
                          title: reasonsOf(r).map((x) => x.t.split(" · ")[0].split(":")[0]).join("، "),
                          details: reasonsOf(r).map((x) => `• ${x.t}`).join("\n"),
                        })} />
        : tab === "cases" ? <CasesList key={`${grade}-${tick}`} grade={grade} onOpen={setOpenCase} />
        : tab === "programs" ? <Programs key={grade} grade={grade} me={profile?.full_name} />
        : tab === "requests" ? <Requests key={grade} grade={grade} />
        : <MonthlyReport key={grade} grade={grade} me={profile?.full_name} />}
    </div>
  );
}

/* ------------------------------ الإنذار المبكر ------------------------------ */
function EarlyWarning({ grade, onOpen }) {
  const [rows, setRows] = useState(null);
  const [from, setFrom] = useState(null);
  const [fp, setFp] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let live = true;
    (async () => {
      const [start, f] = await Promise.all([loadRangeStart(todayISO()), loadFingerprintPublic()]);
      if (!live) return;
      setFrom(start); setFp(f);
      const lateFrom = f.on ? (f.since && f.since > start ? f.since : start) : null;
      const { data, error } = await supabase.rpc("guidance_early_warning", { p_grade: grade, p_from: start, p_late_from: lateFrom });
      if (!live) return;
      if (error) setErr(/guidance_early_warning|schema cache/i.test(error.message)
        ? "لم يُفعَّل التوجيه الطلابي بعد: يلزم تشغيل ملفي supabase/guidance_1.sql وguidance_2.sql." : error.message);
      setRows((data ?? []).map((r) => ({ ...r, reasons: reasonsOf(r) })).filter((r) => r.reasons.length || r.open_case));
    })();
    return () => { live = false; };
  }, [grade]);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, absence: 0, late: 0, study: 0, behavior: 0, open: 0 };
    (rows ?? []).forEach((r) => { r.reasons.forEach((x) => { c[x.k] += 1; }); if (r.open_case) c.open += 1; });
    return c;
  }, [rows]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;
  if (!rows) return <Loader />;

  const filters = [["all", "الكل"], ["absence", "الغياب"], ...(fp?.on ? [["late", "التأخر"]] : []), ["study", "التعثر الدراسي"], ["behavior", "السلوك"], ["open", "حالات مفتوحة"]];
  const shown = rows.filter((r) => filter === "all" || (filter === "open" ? r.open_case : r.reasons.some((x) => x.k === filter)));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {filters.map(([k, t]) => (
          <button key={k} onClick={() => setFilter(k)}
                  className={`rounded-card border px-2 py-2.5 text-center transition-colors ${filter === k ? "border-mint-deep bg-mint-tint" : "border-line bg-white hover:bg-canvas"}`}>
            <p className="num text-xl font-bold text-ink">{counts[k]}</p>
            <p className="text-[11px] text-muted">{t}</p>
          </button>
        ))}
      </div>
      <p className="text-[11.5px] leading-relaxed text-muted">
        منذ {from && fmtDate(from + "T00:00:00")} · الغياب الرسمي بدون عذر من <span className="num">{WATCH_AT}</span> أيام (والإنذارات عند{" "}
        {WARNING_STAGES.map((s) => s.days).join(" و")})
        {fp?.on ? <> · التأخر الصباحي <span className="num">{LATE_AT}</span> مرات فأكثر</> : " · التأخر الصباحي لا يُحتسب والبصمة مقفلة"}
        {" "}· متوسط الاختبارات القصيرة أقل من 60٪ في مادتين فأكثر · الإحالات في الفصل.
      </p>

      {shown.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">لا طلاب هنا — الحمد لله.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {shown.map((r) => (
            <div key={r.student_id} className="card flex flex-col gap-2 p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.full_name}</p>
                  <p className="text-[11px] text-muted">فصل <span className="num">{r.class_no}</span>{r.health ? " · لديه ملاحظة صحية" : ""}</p>
                </div>
                <button onClick={() => onOpen(r)}
                        className={`shrink-0 rounded-pill px-3 py-1 text-xs font-semibold ${r.open_case ? "border border-mint-deep text-mint-deep" : "bg-mint-deep text-white"}`}>
                  {r.open_case ? "عرض الحالة" : "فتح حالة"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.reasons.map((x) => <span key={x.k} className={`chip ${x.c}`}>{x.t}</span>)}
                {r.open_case && <span className="chip bg-mint-light text-mint-deep">حالة مفتوحة</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ حالة جديدة ------------------------------ */
function NewCase({ init, grade, me, onClose, onSaved }) {
  const [student, setStudent] = useState(init.student ?? null);
  const [source, setSource] = useState(init.source ?? "other");
  const [title, setTitle] = useState(init.title ?? "");
  const [details, setDetails] = useState(init.details ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!student || !title.trim()) { setErr("اختر الطالب واكتب المشكلة باختصار."); return; }
    setBusy(true); setErr("");
    const { data: st } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
    const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
    const { data, error } = await supabase.from("guidance_cases").insert({
      student_id: student.student_id, grade: student.grade ?? grade, source, title: title.trim(),
      details: details.trim() || null, opened_by_name: me ?? null,
      academic_year: m.active_year ?? null, term: Number(m.active_term ?? 1),
    }).select("id").single();
    setBusy(false);
    if (error) { setErr(/row-level|policy/i.test(error.message) ? "هذا الطالب ليس من صفك." : error.message); return; }
    onSaved(data.id);
  };

  return (
    <section className="card space-y-3 border-mint-deep/40 p-4">
      <p className="font-semibold text-ink">حالة إرشادية جديدة</p>
      <StudentPicker value={student} onChange={setStudent} />
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(SOURCE).map(([k, t]) => <button key={k} type="button" className={pill(source === k)} onClick={() => setSource(k)}>{t}</button>)}
      </div>
      <input className="field w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="المشكلة باختصار، مثل: غياب متكرر" />
      <textarea className="field w-full" rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="وصف الحالة وأسباب رصدها" />
      {err && <p className="text-xs text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "فتح الحالة"}</button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </div>
    </section>
  );
}

/* ------------------------------ قائمة الحالات ------------------------------ */
function CasesList({ grade, onOpen }) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("open");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("guidance_cases").select("id, title, source, status, outcome, opened_at, closed_at, students(full_name), guidance_sessions(count)")
      .eq("grade", grade).order("opened_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(/guidance_cases|schema cache/i.test(error.message) ? "لم يُفعَّل سجل الحالات بعد: يلزم تشغيل ملف supabase/guidance_1.sql." : error.message);
        setRows(data ?? []);
      });
  }, [grade]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;
  if (!rows) return <Loader />;
  const list = rows.filter((r) => r.status === status);
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <button className={pill(status === "open")} onClick={() => setStatus("open")}>مفتوحة <span className="num">({rows.filter((r) => r.status === "open").length})</span></button>
        <button className={pill(status === "closed")} onClick={() => setStatus("closed")}>مغلقة <span className="num">({rows.filter((r) => r.status === "closed").length})</span></button>
      </div>
      {list.length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">لا حالات.</p> : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((r) => (
            <button key={r.id} onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-canvas">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.students?.full_name ?? "—"}</p>
                <p className="truncate text-xs text-muted">{r.title} · {SOURCE[r.source]}</p>
              </div>
              <div className="shrink-0 text-left text-[11px] text-muted">
                <p className="num">{fmtDate(r.opened_at)}</p>
                <p>جلسات <span className="num">{r.guidance_sessions?.[0]?.count ?? 0}</span></p>
              </div>
              {r.outcome && <span className="chip shrink-0 bg-mint-light text-mint-deep">{OUTCOME[r.outcome]}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ الحالة وجلساتها ------------------------------ */
function CaseView({ id, me, onBack }) {
  const [c, setC] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ session_date: todayISO(), kind: "individual", summary: "", recommendation: "" });
  const [closing, setClosing] = useState(null);   // { outcome, close_note }
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data, error }, { data: s }] = await Promise.all([
      supabase.from("guidance_cases").select("*, students(full_name)").eq("id", id).maybeSingle(),
      supabase.from("guidance_sessions").select("*").eq("case_id", id).order("session_date").order("created_at"),
    ]);
    if (error) setErr(error.message);
    setC(data); setSessions(s ?? []);
  };
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const addSession = async () => {
    if (!f.summary.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("guidance_sessions").insert({
      case_id: id, session_date: f.session_date, kind: f.kind, summary: f.summary.trim(),
      recommendation: f.recommendation.trim() || null, created_by_name: me ?? null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setF({ session_date: todayISO(), kind: "individual", summary: "", recommendation: "" });
    load();
  };

  const setStatus = async (patch) => {
    setBusy(true);
    const { error } = await supabase.from("guidance_cases").update(patch).eq("id", id);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setClosing(null); load();
  };

  const print = () => printReport({
    title: "سجل حالة إرشادية",
    subtitle: `${c.students?.full_name ?? ""} · ${GRADE_NAMES[c.grade] ?? ""} · سري`,
    sections: [
      { title: "بيانات الحالة", headers: ["البيان", "التفاصيل"], rows: [
        ["المشكلة", c.title], ["مصدر الحالة", SOURCE[c.source]], ["تاريخ فتحها", fmtDate(c.opened_at)],
        ["وصف الحالة", c.details ?? "—"], ["الحالة", c.status === "open" ? "مفتوحة" : `مغلقة (${OUTCOME[c.outcome] ?? ""})`],
        ...(c.close_note ? [["ملاحظة الإغلاق", c.close_note]] : []),
      ] },
      { title: "الجلسات", headers: ["م", "التاريخ", "النوع", "ما تم", "التوصية"],
        rows: sessions.map((s, i) => [i + 1, fmtDate(s.session_date + "T00:00:00"), KIND[s.kind], s.summary, s.recommendation ?? "—"]) },
    ],
    signatures: [{ title: "الموجه الطلابي", name: c.opened_by_name ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    signOnLastPageOnly: true,
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  if (!c) return err ? <p className="text-sm text-absent">{err}</p> : <Loader />;
  const open = c.status === "open";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onBack} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">← التوجيه الطلابي</button>
        <button onClick={print} className="btn-ghost mr-auto px-4 py-1.5 text-xs">طباعة الحالة</button>
      </div>

      <section className="card space-y-2 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-ink">{c.students?.full_name}</p>
            <p className="text-sm text-muted">{c.title} · {SOURCE[c.source]} · فُتحت <span className="num">{fmtDate(c.opened_at)}</span></p>
          </div>
          <span className={`chip ${open ? "bg-warning-light text-warning" : "bg-mint-light text-mint-deep"}`}>{open ? "مفتوحة" : OUTCOME[c.outcome] ?? "مغلقة"}</span>
        </div>
        {c.details && <p className="whitespace-pre-line rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink">{c.details}</p>}
        {c.close_note && <p className="text-sm text-muted">ملاحظة الإغلاق: {c.close_note}</p>}
      </section>

      <section className="card p-4">
        <p className="font-semibold text-ink">الجلسات <span className="num text-sm font-normal text-muted">({sessions.length})</span></p>
        {sessions.length === 0 && <p className="mt-2 text-sm text-muted">لا جلسات بعد.</p>}
        <ol className="mt-2 space-y-2">
          {sessions.map((s, i) => (
            <li key={s.id} className="rounded-sm2 border border-line px-3 py-2">
              <p className="text-xs text-muted"><span className="num">{i + 1}</span> · <span className="num">{fmtDate(s.session_date + "T00:00:00")}</span> · {KIND[s.kind]}{s.created_by_name ? ` · ${s.created_by_name}` : ""}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{s.summary}</p>
              {s.recommendation && <p className="mt-1 text-sm text-mint-deep">التوصية: {s.recommendation}</p>}
            </li>
          ))}
        </ol>

        {open && (
          <div className="mt-3 space-y-2 rounded-sm2 bg-canvas p-3">
            <p className="text-sm font-semibold text-ink">جلسة جديدة</p>
            <div className="flex flex-wrap gap-2">
              <input type="date" className="field num" value={f.session_date} onChange={(e) => setF((x) => ({ ...x, session_date: e.target.value }))} />
              {Object.entries(KIND).map(([k, t]) => <button key={k} type="button" className={pill(f.kind === k)} onClick={() => setF((x) => ({ ...x, kind: k }))}>{t}</button>)}
            </div>
            <textarea className="field w-full" rows={3} value={f.summary} placeholder="ما تم في الجلسة"
                      onChange={(e) => setF((x) => ({ ...x, summary: e.target.value }))} />
            <input className="field w-full" value={f.recommendation} placeholder="التوصية (اختياري)"
                   onChange={(e) => setF((x) => ({ ...x, recommendation: e.target.value }))} />
            <button className="btn-primary" disabled={busy || !f.summary.trim()} onClick={addSession}>حفظ الجلسة</button>
          </div>
        )}
      </section>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {open ? (
        closing ? (
          <section className="card space-y-2 p-4">
            <p className="font-semibold text-ink">إغلاق الحالة</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(OUTCOME).map(([k, t]) => <button key={k} type="button" className={pill(closing.outcome === k)} onClick={() => setClosing((x) => ({ ...x, outcome: k }))}>{t}</button>)}
            </div>
            <textarea className="field w-full" rows={2} value={closing.close_note} placeholder="ملاحظة الإغلاق (اختياري)"
                      onChange={(e) => setClosing((x) => ({ ...x, close_note: e.target.value }))} />
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy || !closing.outcome}
                      onClick={() => setStatus({ status: "closed", outcome: closing.outcome, close_note: closing.close_note.trim() || null, closed_at: new Date().toISOString() })}>إغلاق</button>
              <button className="btn-ghost" onClick={() => setClosing(null)}>إلغاء</button>
            </div>
          </section>
        ) : (
          <button className="btn-ghost w-full" onClick={() => setClosing({ outcome: "", close_note: "" })}>إغلاق الحالة</button>
        )
      ) : (
        <button className="btn-ghost w-full" disabled={busy}
                onClick={() => setStatus({ status: "open", outcome: null, closed_at: null })}>إعادة فتح الحالة</button>
      )}
    </div>
  );
}
