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
   • الاختبارات من «جداول الاختبارات» لكل فصل ومادة (الفترتان، دون النهائي).
   • الحالة لكل فصل: تم الرصد، أو رصد جزئي (لم يكتمل الفصل)، أو لم يرصد.
     يدخلها الوكيل أو الدعم الفني يدويًا بعد مراجعة نور، ولا إجراء على المعلم.
   • لون المهلة لما لم يكتمل: حتى يومين من الاختبار أخضر، ومن 3 إلى 5 برتقالي،
     وبعدها أحمر متأخر. الأيام كلها تُحسب.
   ===================================================================== */

const STATUS = {
  done:    { t: "تم الرصد", on: "bg-mint-deep text-white" },
  partial: { t: "رصد جزئي", on: "bg-warning text-white" },
  none:    { t: "لم يرصد",  on: "bg-danger text-white" },
};

// الفرق بالأيام بين تاريخين بصيغة YYYY-MM-DD
const dayNo = (iso) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
const daysBetween = (a, b) => dayNo(b) - dayNo(a);
const weekday = (iso) => new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
const classLabel = (r) => `${GRADE_NAMES[r.grade] ?? ""} ${r.class_no}`.trim();

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

const FILTERS = [
  { k: "all", t: "الكل" }, { k: "none", t: "لم يرصد" }, { k: "partial", t: "رصد جزئي" },
  { k: "late", t: "متأخر" }, { k: "done", t: "تم الرصد" },
];

export default function NoorGrades() {
  const { profile } = useSession();
  const [terms, setTerms] = useState(null);
  const [termId, setTermId] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
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

  // الصفوف مع مهلتها، والملخص، والتجميع بالمعلم
  const all = useMemo(() => (rows ?? []).map((r) => ({ ...r, st: r.status ?? "none", tm: timing(r, today) })), [rows, today]);
  const due = all.filter((r) => r.tm.key !== "soon");   // ما حلّ موعد اختباره
  const sum = {
    done: due.filter((r) => r.st === "done").length,
    partial: due.filter((r) => r.st === "partial").length,
    none: due.filter((r) => r.st === "none").length,
    late: due.filter((r) => r.st !== "done" && r.tm.key === "late").length,
  };
  const shown = all.filter((r) => {
    if (q.trim() && !(r.teacher_name ?? "").includes(q.trim()) && !(r.subject_name ?? "").includes(q.trim())) return false;
    if (filter === "all") return true;
    if (filter === "late") return r.st !== "done" && r.tm.key === "late";
    return r.st === filter && r.tm.key !== "soon";
  });
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of shown) {
      const k = r.teacher_id ?? "—";
      const g = m.get(k) ?? { id: k, name: r.teacher_name ?? "معلم غير محدد في الجدول", list: [] };
      g.list.push(r);
      m.set(k, g);
    }
    const order = { late: 0, orange: 1, green: 2, nodate: 3, soon: 4 };
    for (const g of m.values()) {
      g.list.sort((a, b) => (a.subject_name ?? "").localeCompare(b.subject_name ?? "", "ar")
        || a.grade - b.grade || a.class_no - b.class_no);
      g.open = g.list.filter((r) => r.st !== "done" && r.tm.key !== "soon");
      g.rank = Math.min(...g.open.map((r) => order[r.tm.key] ?? 9), 9);
    }
    return [...m.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "ar"));
  }, [shown]);

  const left = term?.grading_deadline ? daysBetween(today, term.grading_deadline) : null;

  const print = () => {
    const late = groups.map((g) => ({ g, list: g.list.filter((r) => r.st !== "done" && r.tm.key !== "soon") }))
      .filter((x) => x.list.length);
    printReport({
      title: `متابعة رصد درجات ${term?.title ?? ""} في نظام نور`,
      subtitle: `تم ${sum.done} · جزئي ${sum.partial} · لم يرصد ${sum.none} · متأخر ${sum.late}`
        + (term?.grading_deadline ? ` · نهاية الرصد ${weekday(term.grading_deadline)} ${fmtHijri(term.grading_deadline)}` : ""),
      sections: late.map(({ g, list }) => ({
        title: g.name,
        headers: ["م", "المادة", "الفصل", "تاريخ الاختبار", "الحالة", "المهلة"],
        rows: list.map((r, i) => [i + 1, r.subject_name, classLabel(r), r.exam_date ? fmtHijri(r.exam_date) : "—",
          STATUS[r.st].t + (r.note ? ` (${r.note})` : ""), r.tm.t]),
      })),
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [{ title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      signOnLastPageOnly: true,
    });
  };

  if (!terms) return <Loader />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">متابعة رصد الدرجات في نظام نور</h1>
        <p className="mt-0.5 text-sm text-muted">
          اختبارات الفترتين من «جداول الاختبارات». راجع نور ثم سجّل حالة كل فصل: تم الرصد، أو رصد جزئي إن لم يكتمل الفصل.
        </p>
      </div>

      {!terms.length ? (
        <p className="card p-4 text-sm text-muted">لا توجد فترات اختبار للعام الدراسي النشط. أنشئها من «جداول الاختبارات».</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {terms.map((t) => (
              <button key={t.id} onClick={() => setTermId(t.id)}
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[["done", "تم الرصد", "bg-mint-light text-mint-deep"], ["partial", "رصد جزئي", "bg-warning-light text-warning"],
                  ["none", "لم يرصد", "bg-canvas text-ink"], ["late", "متأخر", "bg-danger-light text-danger"]].map(([k, t, c]) => (
                  <button key={k} onClick={() => setFilter(filter === k ? "all" : k)}
                          className={`rounded-card px-3 py-2 text-center ${c} ${filter === k ? "ring-2 ring-mint-deep/50" : ""}`}>
                    <span className="num block text-2xl font-bold leading-tight">{sum[k]}</span>
                    <span className="block text-xs">{t}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">
                العدد بالفصول التي حلّ موعد اختبارها. المهلة: <span className="text-mint-deep">حتى يومين</span> ·{" "}
                <span className="text-warning">من 3 إلى 5 أيام</span> · <span className="text-danger">بعد 5 أيام متأخر</span>.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {FILTERS.map((f) => (
                  <button key={f.k} onClick={() => setFilter(f.k)}
                          className={`rounded-sm2 px-3 py-1 text-sm ${filter === f.k ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
                    {f.t}
                  </button>
                ))}
                <input className="field w-48 py-1 text-sm" placeholder="بحث بالمعلم أو المادة" value={q}
                       onChange={(e) => setQ(e.target.value)} />
                <div className="flex-1" />
                <button className="btn-ghost" onClick={print}>طباعة كشف غير المكتمل</button>
              </div>

              {!groups.length && <p className="card p-4 text-sm text-muted">لا نتائج.</p>}
              {groups.map((g) => (
                <section key={g.id} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-bold text-ink">{g.name}</h2>
                    <p className="text-xs text-muted">
                      {g.open.length ? <>غير مكتمل <span className="num font-semibold text-ink">{g.open.length}</span> من <span className="num">{g.list.length}</span></>
                        : <span className="text-mint-deep">مكتمل</span>}
                    </p>
                  </div>
                  <div className="mt-3 divide-y divide-line/60 rounded-sm2 border border-line/60">
                    {g.list.map((r) => (
                      <div key={r.slot_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                          <p className="font-medium text-ink">{r.subject_name} · {classLabel(r)}</p>
                          <p className="text-xs text-muted">
                            {r.exam_date ? <>اختبار {weekday(r.exam_date)} <span className="num">{fmtHijri(r.exam_date)}</span></> : "بلا تاريخ"}
                            {r.note && <> · <span className="text-warning">{r.note}</span></>}
                            {r.updated_name && <> · سجّله {r.updated_name}</>}
                          </p>
                        </div>
                        {r.st !== "done" && <span className={`chip ${r.tm.c}`}>{r.tm.t}</span>}
                        <div className="flex-1 sm:hidden" />
                        <div className="flex overflow-hidden rounded-sm2 border border-line">
                          {["none", "partial", "done"].map((k) => (
                            <button key={k} disabled={busy === r.slot_id} onClick={() => setStatus(r, k)}
                                    className={`px-2.5 py-1 text-xs ${r.st !== k ? "bg-paper text-muted hover:bg-canvas" : k === "none" && r.tm.key === "soon" ? "bg-canvas text-ink" : STATUS[k].on}`}>
                              {STATUS[k].t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
