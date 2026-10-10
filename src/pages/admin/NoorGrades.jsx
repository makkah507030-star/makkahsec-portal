import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate, fmtHijri } from "../../lib/dates";
import { GRADE_NAMES, todayISO } from "../../lib/schoolTime";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import Loader from "../../components/Loader.jsx";
import { countAr } from "../../lib/arabicCount.js";

/* =====================================================================
   متابعة رصد درجات الفترات في نظام نور — لوكيل الشؤون التعليمية والدعم الفني
   والمدير (supabase/noor_grades_1.sql و noor_grades_2.sql).
   • الاختبارات من «جداول الاختبارات» لكل فصل ومادة (الفترتان، دون النهائي)،
     في جدول لكل صف كما في كشف متابعة نور: المواد ومعلموها (من الجدول الدراسي)
     في الصفوف، والفصول في الأعمدة، ونسبة الرصد لكل مادة وللصف (الجزئي نصف).
   • الحالة لكل فصل: تم الرصد، أو رصد جزئي (لم يكتمل الفصل)، أو لم يرصد.
     يدخلها الوكيل أو الدعم الفني يدويًا بعد مراجعة نور، ولا إجراء على المعلم.
   • لون الخانة للحالة (أخضر تم، أزرق جزئي، وردي لم يرصد)، ورقمها الأيام منذ
     الاختبار بلون المهلة: حتى يومين أخضر، ومن 3 إلى 5 برتقالي، وبعدها أحمر متأخر.
   ===================================================================== */

// ألوان الحالة كما في كشف المتابعة المعتاد: أخضر تم، وأزرق جزئي، ووردي لم يرصد
const STATUS = {
  done:    { t: "تم الرصد", on: "bg-mint-deep text-white",  cell: "bg-mint-light", hex: "#CCF2DB" },
  partial: { t: "رصد جزئي", on: "bg-excused text-white",    cell: "bg-[#D6E4F5]", hex: "#D6E4F5" },
  none:    { t: "لم يرصد",  on: "bg-danger text-white",     cell: "bg-danger-light", hex: "#FBEBEB" },
};
// لون رقم الأيام داخل الخانة غير المكتملة بحسب المهلة
const DAYS_TONE = { green: "text-mint-deep", orange: "text-warning", late: "text-danger" };

// الفرق بالأيام بين تاريخين بصيغة YYYY-MM-DD
const dayNo = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysBetween = (a, b) => dayNo(b) - dayNo(a);
const weekday = (iso) => new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/** مهلة الصف: أيام منذ الاختبار ولونها (لما لم يكتمل رصده) */
function timing(r, today) {
  if (!r.exam_date) return { key: "nodate", t: "بلا تاريخ", c: "bg-canvas text-muted" };
  const d = daysBetween(r.exam_date, today);
  if (d < 0) return { key: "soon", d, t: `لم يحن · بعد ${countAr(-d, "day", { acc: true })}`, c: "bg-canvas text-muted" };
  const since = d === 0 ? "اليوم" : d === 1 ? "أمس" : `منذ ${countAr(d, "day", { acc: true })}`;
  if (d <= 2) return { key: "green", d, t: since, c: "bg-mint-light text-mint-deep" };
  if (d <= 5) return { key: "orange", d, t: since, c: "bg-warning-light text-warning" };
  return { key: "late", d, t: `متأخر · ${since}`, c: "bg-danger-light text-danger" };
}

export default function NoorGrades() {
  const { profile } = useSession();
  const [terms, setTerms] = useState(null);
  const [termId, setTermId] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [gradeF, setGradeF] = useState(0);   // 0 = كل الصفوف
  const [busy, setBusy] = useState(null);
  const [sel, setSel] = useState(null);      // الخانة المفتوحة تفاصيلها (slot_id)
  const today = todayISO();

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("exam_terms").select("*")
        .eq("academic_year", st?.value ?? "").in("kind", ["period1", "period2"]).order("kind");
      setTerms(data ?? []);
      // الفترة الافتراضية: أول فترة لم تنتهِ مهلة رصدها، وإلا الأخيرة
      const open = (data ?? []).find((t) => !t.grading_deadline || t.grading_deadline >= todayISO());
      setTermId((open ?? data?.[data.length - 1])?.id ?? null);
    })();
  }, []);

  const load = async (id) => {
    setRows(null); setErr("");
    const { data, error } = await supabase.rpc("noor_grade_board", { p_term: id });
    if (error) setErr(error.message?.includes("noor_grade_board")
      ? "المتابعة غير مفعّلة بعد في قاعدة البيانات: شغّل ملفي noor_grades_1.sql و noor_grades_2.sql."
      : error.message);
    setRows(data ?? []);
  };
  useEffect(() => { if (termId) load(termId); }, [termId]);

  const term = terms?.find((t) => t.id === termId);

  const setDeadline = async (v) => {
    const { error } = await supabase.from("exam_terms").update({ grading_deadline: v || null }).eq("id", termId);
    if (error) { alert(error.message); return; }
    setTerms((ts) => ts.map((t) => (t.id === termId ? { ...t, grading_deadline: v || null } : t)));
  };

  const setStatus = async (r, status) => {
    if ((r.status ?? "none") === status) return;
    let note = null;
    if (status === "partial") {
      note = window.prompt("ما الناقص في رصد هذا الفصل؟ (اختياري)", r.note ?? "");
      if (note === null) return;
    }
    setBusy(r.slot_id);
    const { error } = status === "none"
      ? await supabase.from("noor_grade_entries").delete().eq("exam_slot_id", r.slot_id)
      : await supabase.from("noor_grade_entries").upsert({
          exam_slot_id: r.slot_id, status, note: note?.trim() || null,
          updated_name: profile?.full_name ?? null, updated_at: new Date().toISOString(),
        });
    setBusy(null);
    if (error) { alert(error.message); return; }
    setRows((rs) => rs.map((x) => (x.slot_id === r.slot_id
      ? { ...x, status: status === "none" ? null : status, note: status === "partial" ? note?.trim() || null : null,
          updated_name: profile?.full_name ?? null, updated_at: new Date().toISOString() }
      : x)));
  };

  // الصفوف مع مهلتها، والملخص، والتجميع: الصف ← المادة × الفصول
  const all = useMemo(() => (rows ?? []).map((r) => ({ ...r, st: r.status ?? "none", tm: timing(r, today) })), [rows, today]);
  const due = all.filter((r) => r.tm.key !== "soon");   // ما حلّ موعد اختباره
  const pct = (list) => {
    const d = list.filter((r) => r.tm.key !== "soon");
    if (!d.length) return null;
    return Math.round((100 * d.reduce((a, r) => a + (r.st === "done" ? 1 : r.st === "partial" ? 0.5 : 0), 0)) / d.length);
  };
  const sum = {
    done: due.filter((r) => r.st === "done").length,
    partial: due.filter((r) => r.st === "partial").length,
    none: due.filter((r) => r.st === "none").length,
    late: due.filter((r) => r.st !== "done" && r.tm.key === "late").length,
  };
  // تصفية الحالة تُبهت ما لا يطابقها في الجدول ولا تحذفه
  const match = (r) => filter === "all" ? true
    : filter === "late" ? r.st !== "done" && r.tm.key === "late"
    : r.st === filter && r.tm.key !== "soon";

  const grades = useMemo(() => {
    const qq = q.trim();
    const byGrade = new Map();
    for (const r of all) {
      if (gradeF && r.grade !== gradeF) continue;
      const g = byGrade.get(r.grade) ?? { grade: r.grade, classes: new Set(), subjects: new Map() };
      g.classes.add(r.class_no);
      const sub = g.subjects.get(r.subject_name) ?? { name: r.subject_name ?? "—", cells: new Map(), list: [] };
      // اختباران للمادة في الفصل نفسه (أسبوعان): يُعرض الأقدم
      if (!sub.cells.has(r.class_no)) sub.cells.set(r.class_no, r);
      sub.list.push(r);
      g.subjects.set(r.subject_name, sub);
      byGrade.set(r.grade, g);
    }
    return [...byGrade.values()].sort((a, b) => a.grade - b.grade).map((g) => {
      const subjects = [...g.subjects.values()]
        .filter((sub) => !qq || sub.name.includes(qq) || sub.list.some((r) => (r.teacher_name ?? "").includes(qq)))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"))
        .map((sub) => ({
          ...sub, pct: pct(sub.list),
          teachers: [...new Set(sub.list.map((r) => r.teacher_name ?? "غير محدد"))],
        }));
      return { grade: g.grade, classes: [...g.classes].sort((a, b) => a - b), subjects,
               pct: pct(subjects.flatMap((s) => s.list)) };
    }).filter((g) => g.subjects.length);
  }, [all, gradeF, q]);

  const selRow = all.find((r) => r.slot_id === sel);
  const left = term?.grading_deadline ? daysBetween(today, term.grading_deadline) : null;
  const now = new Date();
  const stamp = `${weekday(today)} ${fmtHijri(today)} الساعة ${new Intl.DateTimeFormat("ar-SA", { hour: "numeric", minute: "2-digit", numberingSystem: "latn" }).format(now)}`;

  // الطباعة: جدول ملوّن لكل صف كما في الكشف المعتاد
  const print = () => {
    const td = "border:1px solid #bbb;padding:3px 4px;text-align:center;font-size:11px";
    const html = grades.map((g) => `
      <table style="width:100%;border-collapse:collapse;margin:0 0 6px">
        <thead>
          <tr><th colspan="${g.classes.length + 3}" style="${td};background:#1f3a2c;color:#fff;font-size:13px">${GRADE_NAMES[g.grade] ?? ""}</th></tr>
          <tr><th style="${td}">م</th><th style="${td};text-align:right">المادة والمعلمون</th>
            ${g.classes.map((c) => `<th style="${td};width:26px">${c}</th>`).join("")}<th style="${td}">نسبة الرصد</th></tr>
        </thead>
        <tbody>
          ${g.subjects.map((sub, i) => `<tr><td style="${td}">${i + 1}</td>
            <td style="${td};text-align:right"><b>${sub.name}</b><br><span style="color:#666;font-size:9px">${sub.teachers.join("، ")}</span></td>
            ${g.classes.map((c) => {
              const r = sub.cells.get(c);
              if (!r) return `<td style="${td}"></td>`;
              if (r.tm.key === "soon") return `<td style="${td};background:#f1f1f1;color:#999">—</td>`;
              return `<td style="${td};background:${STATUS[r.st].hex}">${r.st === "done" ? "" : r.tm.d ?? ""}</td>`;
            }).join("")}
            <td style="${td};font-weight:bold;color:#3E6350">${sub.pct ?? "—"}${sub.pct === null ? "" : "%"}</td></tr>`).join("")}
          <tr><td colspan="${g.classes.length + 2}" style="${td};background:#eee">النسبة الإجمالية للرصد حتى ${stamp}</td>
            <td style="${td};font-weight:bold">${g.pct ?? "—"}${g.pct === null ? "" : "%"}</td></tr>
        </tbody>
      </table>`).join("")
      + `<p style="font-size:11px;margin:4px 0">
          <span style="display:inline-block;width:14px;height:10px;background:${STATUS.none.hex};border:1px solid #bbb"></span> لم يتم الرصد &nbsp;
          <span style="display:inline-block;width:14px;height:10px;background:${STATUS.done.hex};border:1px solid #bbb"></span> تم الرصد &nbsp;
          <span style="display:inline-block;width:14px;height:10px;background:${STATUS.partial.hex};border:1px solid #bbb"></span> رصد جزئي &nbsp;
          · الرقم في الخانة: الأيام منذ الاختبار</p>`;
    printReport({
      title: `متابعة رصد درجات ${term?.title ?? ""} في نظام نور`,
      subtitle: `تم ${sum.done} · جزئي ${sum.partial} · لم يرصد ${sum.none} · متأخر ${sum.late}`
        + (term?.grading_deadline ? ` · نهاية الرصد ${weekday(term.grading_deadline)} ${fmtHijri(term.grading_deadline)}` : ""),
      sections: [{ html }],
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [{ title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    });
  };

  if (!terms) return <Loader />;

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
      {["none", "done", "partial"].map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-5 rounded-sm border border-line ${STATUS[k].cell}`} />{k === "none" ? "لم يتم الرصد" : STATUS[k].t}
        </span>
      ))}
      <span>· الرقم في الخانة: الأيام منذ الاختبار (<span className="text-mint-deep">حتى يومين</span>،{" "}
        <span className="text-warning">3–5</span>، <span className="text-danger">متأخر بعد 5</span>)</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">متابعة رصد الدرجات في نظام نور</h1>
        <p className="mt-0.5 text-sm text-muted">
          لكل صف جدول: المواد ومعلموها في الصفوف، والفصول في الأعمدة. اضغط خانة الفصل لتسجيل حالته بعد مراجعة نور.
        </p>
      </div>

      {!terms.length ? (
        <p className="card p-4 text-sm text-muted">لا توجد فترات اختبار للعام الدراسي النشط. أنشئها من «جداول الاختبارات».</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <button key={t.id} onClick={() => { setTermId(t.id); setSel(null); }}
                      className={`rounded-sm2 px-4 py-1.5 text-sm ${t.id === termId ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
                {t.title}
              </button>
            ))}
          </div>

          {term && (
            <section className="card flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted">نهاية فترة رصد الدرجات</p>
                {term.grading_deadline ? (
                  <p className="mt-0.5 font-bold text-ink">
                    {weekday(term.grading_deadline)} <span className="num">{fmtDate(term.grading_deadline)}</span>
                  </p>
                ) : <p className="mt-0.5 text-sm text-warning">لم يُحدَّد آخر يوم للرصد بعد.</p>}
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  تعديل:
                  <input type="date" className="field num w-44 py-1 text-sm" value={term.grading_deadline ?? ""}
                         onChange={(e) => setDeadline(e.target.value)} />
                </label>
              </div>
              {left !== null && (
                <div className={`rounded-card px-5 py-3 text-center ${left < 0 ? "bg-danger-light text-danger"
                  : left <= 3 ? "bg-warning-light text-warning" : "bg-mint-light text-mint-deep"}`}>
                  {left < 0 ? <p className="font-bold">انتهت مهلة الرصد</p>
                    : left === 0 ? <p className="font-bold">اليوم آخر يوم للرصد</p>
                    : <><p className="text-xs">باقي</p><p className="num text-3xl font-bold leading-none">{left}</p>
                      <p className="mt-1 text-xs">{left === 1 ? "يوم" : left === 2 ? "يومان" : left <= 10 ? "أيام" : "يومًا"}</p></>}
                </div>
              )}
            </section>
          )}

          {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
          {!rows ? <Loader /> : !err && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <div className="col-span-2 rounded-card bg-mint-deep px-3 py-2 text-center text-white sm:col-span-1">
                  <span className="num block text-2xl font-bold leading-tight">{pct(all) ?? "—"}{pct(all) === null ? "" : "%"}</span>
                  <span className="block text-xs">النسبة الإجمالية</span>
                </div>
                {[["done", "تم الرصد", "bg-mint-light text-mint-deep"], ["partial", "رصد جزئي", "bg-[#D6E4F5] text-excused"],
                  ["none", "لم يرصد", "bg-danger-light text-danger"], ["late", "متأخر", "bg-danger text-white"]].map(([k, t, c]) => (
                  <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
                          className={`rounded-card px-3 py-2 text-center ${c} ${filter === k ? "ring-2 ring-ink/40" : ""}`}>
                    <span className="num block text-2xl font-bold leading-tight">{sum[k]}</span>
                    <span className="block text-xs">{t}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                الأعداد بالفصول التي حلّ موعد اختبارها، والنسبة تحسب الرصد الجزئي نصفًا. اضغط عددًا لإبراز خاناته في الجداول.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <select className="field w-36 py-1 text-sm" value={gradeF} onChange={(e) => setGradeF(Number(e.target.value))}>
                  <option value={0}>كل الصفوف</option>
                  {[1, 2, 3].map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
                </select>
                <input className="field w-48 py-1 text-sm" placeholder="بحث بالمادة أو المعلم" value={q}
                       onChange={(e) => setQ(e.target.value)} />
                <div className="flex-1" />
                <button className="btn-ghost" onClick={print}>طباعة الكشف</button>
              </div>
              {legend}

              {!grades.length && <p className="card p-4 text-sm text-muted">لا نتائج.</p>}
              {grades.map((g) => (
                <section key={g.grade} className="card overflow-hidden">
                  <h2 className="bg-mint-deep px-4 py-2 text-center font-bold text-white">{GRADE_NAMES[g.grade] ?? `الصف ${g.grade}`}</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-canvas text-xs text-muted">
                          <th className="w-8 border border-line/60 px-1 py-1.5">م</th>
                          <th className="min-w-[11rem] border border-line/60 px-2 py-1.5 text-right">المادة والمعلمون</th>
                          {g.classes.map((c) => <th key={c} className="num w-9 border border-line/60 px-1 py-1.5">{c}</th>)}
                          <th className="w-16 border border-line/60 px-1 py-1.5">نسبة الرصد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.subjects.map((sub, i) => (
                          <tr key={sub.name}>
                            <td className="num border border-line/60 text-center text-xs text-muted">{i + 1}</td>
                            <td className="border border-line/60 px-2 py-1.5">
                              <p className="font-semibold text-ink">{sub.name}</p>
                              <p className="text-[11px] leading-snug text-muted">{sub.teachers.join("، ")}</p>
                            </td>
                            {g.classes.map((c) => {
                              const r = sub.cells.get(c);
                              if (!r) return <td key={c} className="border border-line/60" />;
                              const soon = r.tm.key === "soon";
                              return (
                                <td key={c} className="border border-line/60 p-0">
                                  <button onClick={() => setSel(sel === r.slot_id ? null : r.slot_id)}
                                          title={`${r.teacher_name ?? "معلم غير محدد"} · ${STATUS[r.st].t}${soon ? " · لم يحن" : ""}`}
                                          className={`num grid h-9 w-full place-items-center text-[11px] font-bold
                                            ${soon ? "bg-canvas text-faint" : `${STATUS[r.st].cell} ${DAYS_TONE[r.tm.key] ?? "text-muted"}`}
                                            ${sel === r.slot_id ? "ring-2 ring-inset ring-ink" : ""}
                                            ${match(r) ? "" : "opacity-25"}`}>
                                    {soon ? "—" : r.st === "done" ? "" : r.tm.d}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="num border border-line/60 text-center font-bold text-mint-deep">
                              {sub.pct === null ? "—" : `${sub.pct}%`}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-canvas text-xs">
                          <td colSpan={g.classes.length + 2} className="border border-line/60 px-2 py-1.5 text-center text-muted">
                            النسبة الإجمالية للرصد حتى {stamp}
                          </td>
                          <td className="num border border-line/60 text-center font-bold text-ink">{g.pct === null ? "—" : `${g.pct}%`}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {selRow && selRow.grade === g.grade && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-mint-tint px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{selRow.subject_name} · فصل <span className="num">{selRow.class_no}</span></p>
                        <p className="text-xs text-muted">
                          <span className={selRow.teacher_name ? "text-ink" : "text-warning"}>{selRow.teacher_name ?? "معلم غير محدد في الجدول"}</span>
                          {" · "}{selRow.exam_date ? <>اختبار {weekday(selRow.exam_date)} <span className="num">{fmtHijri(selRow.exam_date)}</span></> : "بلا تاريخ"}
                          {selRow.note && <> · <span className="text-warning">{selRow.note}</span></>}
                          {selRow.updated_name && <> · سجّله {selRow.updated_name}</>}
                        </p>
                      </div>
                      {selRow.st !== "done" && <span className={`chip ${selRow.tm.c}`}>{selRow.tm.t}</span>}
                      <div className="flex overflow-hidden rounded-sm2 border border-line">
                        {["none", "partial", "done"].map((k) => (
                          <button key={k} disabled={busy === selRow.slot_id} onClick={() => setStatus(selRow, k)}
                                  className={`px-2.5 py-1 text-xs ${selRow.st !== k ? "bg-paper text-muted hover:bg-canvas" : k === "none" && selRow.tm.key === "soon" ? "bg-canvas text-ink" : STATUS[k].on}`}>
                            {STATUS[k].t}
                          </button>
                        ))}
                      </div>
                      <button className="text-xs text-muted underline" onClick={() => setSel(null)}>إغلاق</button>
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
