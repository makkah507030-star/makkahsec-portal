// src/pages/admin/PeriodNoticesAdmin.jsx
/* =====================================================================
   إشعار الفترة من نور — تبويب في «نتائج الطلاب» (supabase/period_notices.sql).
   ١) تنبيه قبل الرفع: يُرفع بعد أن ينهي المعلمون الرصد في نور، وإلا فلا فائدة من الرفع.
   ٢) رفع ملف Excel كما صُدِّر من نور (ورقة لكل طالب) فيُطابق كل طالب برقم هويته.
   ٣) معاينة بالمقارنة مع آخر نشر: جديد / تغيّرت درجاته / بلا تغيير / غير مطابق.
   ٤) النشر: يُستبدل ما تغيّر فقط ويصل أصحابه إشعار، ويُسجَّل الرفع بتاريخه ومن رفعه.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { cleanIdentity } from "../../lib/importer";
import { fmtDateTime } from "../../lib/dates";
import { parseNoticeFile, noticeKey, noticeRow, noticeChanged } from "../../lib/periodNotice";
import { confirmDanger } from "../../lib/danger";
import { countAr } from "../../lib/arabicCount.js";
import Loader from "../../components/Loader.jsx";

const STATUS = {
  new: { t: "جديد", c: "bg-mint-tint text-mint-deep" },
  changed: { t: "تغيّرت درجاته", c: "bg-warning/10 text-warning" },
  same: { t: "بلا تغيير", c: "bg-canvas text-muted" },
  unmatched: { t: "غير مطابق", c: "bg-absent/10 text-absent" },
};
const setupMsg = "إشعار الفترة يحتاج تشغيل supabase/period_notices.sql في Supabase ← SQL Editor.";

export default function PeriodNoticesAdmin({ year, students }) {
  const [ready, setReady] = useState(false);       // أكّد اكتمال الرصد
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);    // [{ key, title, term, items, lastAt }]
  const [filter, setFilter] = useState("todo");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);            // { ok, text }
  const [summary, setSummary] = useState(null);    // المنشور مجمّعًا بالمفتاح
  const [logs, setLogs] = useState([]);

  const byNid = useMemo(() => {
    const m = new Map();
    students.forEach((s) => m.set(cleanIdentity(s.national_id), s));
    return m;
  }, [students]);

  const loadSummary = async () => {
    if (!year) return;
    const [{ data, error }, { data: lg }] = await Promise.all([
      supabase.from("period_notices").select("report_key, title, term, published, updated_at").eq("academic_year", year),
      supabase.from("period_notice_log").select("*").eq("academic_year", year).order("created_at", { ascending: false }).limit(15),
    ]);
    if (error) { setMsg({ ok: false, text: /period_notices/.test(error.message) ? setupMsg : error.message }); setSummary([]); return; }
    const g = new Map();
    (data ?? []).forEach((r) => {
      const x = g.get(r.report_key) ?? { key: r.report_key, title: r.title, term: r.term, count: 0, published: 0, last: null };
      x.count++; if (r.published) x.published++;
      if (!x.last || r.updated_at > x.last) x.last = r.updated_at;
      g.set(r.report_key, x);
    });
    setSummary([...g.values()].sort((a, b) => (b.last ?? "").localeCompare(a.last ?? "")));
    setLogs(lg ?? []);
  };
  useEffect(() => { loadSummary(); }, [year]);   // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file) => {
    setParsing(true); setMsg(null); setPreview(null);
    try {
      const { notices, skipped } = await parseNoticeFile(file);
      if (!notices.length) throw new Error("لم أجد في الملف أوراق «إشعار فترة». صدّره من نور بصيغة Excel كما هو.");
      const groups = new Map();
      notices.forEach((n) => {
        const k = noticeKey(n);
        if (!groups.has(k)) groups.set(k, { key: k, title: n.title, term: n.term, list: [] });
        groups.get(k).list.push(n);
      });
      const out = [];
      for (const g of groups.values()) {
        const { data: old, error } = await supabase.from("period_notices")
          .select("student_id, subjects, attendance, behavior_excellent, behavior_positive, updated_at")
          .eq("academic_year", year).eq("report_key", g.key);
        if (error) throw new Error(/period_notices/.test(error.message) ? setupMsg : error.message);
        const oldMap = new Map((old ?? []).map((r) => [r.student_id, r]));
        const lastAt = (old ?? []).reduce((a, r) => (!a || r.updated_at > a ? r.updated_at : a), null);
        const items = g.list.map((n) => {
          const st = byNid.get(n.nationalId);
          if (!st) return { n, status: "unmatched" };
          const row = noticeRow(n, st.id);
          const prev = oldMap.get(st.id);
          return { n, st, row, status: !prev ? "new" : noticeChanged(row, prev) ? "changed" : "same" };
        });
        out.push({ ...g, items, lastAt });
      }
      setPreview(out);
      setFilter("todo");
      if (skipped) setMsg({ ok: false, text: `تُركت ${countAr(skipped, "sheet")} ليست إشعار فترة.` });
    } catch (e) { setMsg({ ok: false, text: e.message ?? String(e) }); }
    setParsing(false);
  };

  const publish = async (g) => {
    const rows = g.items.filter((i) => i.status === "new" || i.status === "changed").map((i) => i.row);
    if (!rows.length) return;
    const ok = await confirmDanger({
      title: `نشر ${g.title}`,
      impact: [`يظهر لـ${countAr(rows.length, "student", { acc: true })} وأولياء أمورهم، ويصلهم إشعار «تحدّثت درجات ${g.title}».`,
        "من لم تتغيّر درجاته لا يصله شيء."],
      confirmLabel: "نشر",
    });
    if (!ok) return;
    setBusy(true); setMsg(null);
    const { data, error } = await supabase.rpc("period_notice_publish", { p_year: year, p_key: g.key, p_title: g.title, p_rows: rows });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: /period_notice/.test(error.message) ? setupMsg : error.message }); return; }
    setMsg({ ok: true, text: `نُشر ${g.title}: جديد ${data.added}، وتحدّث ${data.changed}.` });
    setPreview((p) => p.filter((x) => x.key !== g.key));
    loadSummary();
  };

  const setPublished = async (s, value) => {
    if (!value && !(await confirmDanger({ title: `إخفاء ${s.title}`, impact: ["يختفي عن كل الطلاب وأولياء الأمور حتى تعيد إظهاره."], confirmLabel: "إخفاء" }))) return;
    await supabase.from("period_notices").update({ published: value }).eq("academic_year", year).eq("report_key", s.key);
    loadSummary();
  };
  const remove = async (s) => {
    if (!(await confirmDanger({ title: `حذف ${s.title}`, level: "high", impact: [`يُحذف إشعار ${countAr(s.count, "student", { acc: true })} نهائيًا، وتحتاج إعادة رفع الملف لاسترجاعه.`], confirmLabel: "حذف" }))) return;
    await supabase.from("period_notices").delete().eq("academic_year", year).eq("report_key", s.key);
    loadSummary();
  };

  return (
    <div className="space-y-4">
      {msg && <p className={`rounded-sm2 px-4 py-2.5 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {/* الرفع */}
      <section className="card space-y-3 p-4">
        <div>
          <p className="text-sm font-bold text-ink">رفع إشعار الفترة من نور</p>
          <p className="text-xs leading-relaxed text-muted">من نور: التقارير ← إشعار الفترة ← كل الفصول ← تصدير Excel. يظهر للطالب وولي أمره ما اكتمل رصده فقط، ويمكنك إعادة الرفع كلما اكتمل رصد مواد أخرى.</p>
        </div>
        <label className={`flex items-start gap-2 rounded-sm2 border px-3 py-2.5 text-sm ${ready ? "border-mint-light bg-mint-tint/50 text-ink" : "border-warning/40 bg-warning/10 text-ink"}`}>
          <input type="checkbox" className="mt-1" checked={ready} onChange={(e) => setReady(e.target.checked)} />
          <span><b>قبل الرفع:</b> تأكدت أن المعلمين أنهوا رصد الدرجات في نور قبل التصدير. الرفع قبل اكتمال الرصد لا يضيف جديدًا للطلاب.</span>
        </label>
        <label className={`flex flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-4 py-7 text-center ${
          ready && !parsing ? "cursor-pointer border-line bg-canvas hover:border-mint-deep" : "cursor-not-allowed border-line/60 bg-canvas/50 opacity-60"}`}>
          <span className="text-sm font-semibold text-ink">{parsing ? "جارٍ قراءة الملف…" : "اختر ملف Excel المصدَّر من نور"}</span>
          <span className="text-xs text-muted">{ready ? "ورقة لكل طالب، ويُطابق كل طالب برقم هويته" : "أكّد اكتمال الرصد أولًا"}</span>
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={!ready || parsing}
                 onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); e.target.value = ""; }} />
        </label>
      </section>

      {/* المعاينة قبل النشر */}
      {preview?.map((g) => {
        const count = (s) => g.items.filter((i) => i.status === s).length;
        const todo = count("new") + count("changed");
        const shown = g.items.filter((i) => filter === "all" || (filter === "todo" ? i.status === "new" || i.status === "changed" : i.status === filter));
        return (
          <section key={g.key} className="card overflow-hidden">
            <div className="space-y-2 border-b border-line px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-ink">{g.title}</p>
                {g.term && <span className="chip bg-canvas text-muted">{g.term}</span>}
                <span className="text-xs text-muted">{countAr(g.items.length, "sheet")}</span>
                {g.lastAt && <span className="mr-auto text-[11px] text-muted">آخر نشر: <span className="num">{fmtDateTime(g.lastAt)}</span></span>}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {[["todo", `للنشر (${todo})`], ["new", `${STATUS.new.t} (${count("new")})`], ["changed", `${STATUS.changed.t} (${count("changed")})`],
                  ["same", `${STATUS.same.t} (${count("same")})`], ["unmatched", `${STATUS.unmatched.t} (${count("unmatched")})`], ["all", "الكل"]].map(([k, t]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`rounded-pill px-3 py-1 ${filter === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
                ))}
              </div>
            </div>
            {todo === 0 ? (
              <p className="px-4 py-5 text-sm text-muted">لا جديد منذ آخر نشر{g.lastAt ? ` في ${fmtDateTime(g.lastAt)}` : ""}: الدرجات في الملف هي المنشورة نفسها. انتظر اكتمال رصد مواد أخرى ثم صدّر الملف من جديد.</p>
            ) : null}
            <div className="max-h-96 divide-y divide-line overflow-y-auto">
              {shown.map((i, k) => (
                <div key={k} className="flex flex-wrap items-center gap-2 px-4 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{i.st?.full_name ?? i.n.name}
                    <span className="mr-2 text-[11px] text-muted">{i.n.gradeName} · فصل <span className="num">{i.n.classNo}</span></span></span>
                  <span className="text-[11px] text-muted">{countAr(i.n.subjects.length, "gradedSubject")}</span>
                  <span className={`chip ${STATUS[i.status].c}`}>{STATUS[i.status].t}</span>
                </div>
              ))}
              {shown.length === 0 && <p className="px-4 py-4 text-xs text-muted">لا شيء هنا.</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
              <button className="btn-primary" disabled={busy || todo === 0} onClick={() => publish(g)}>
                {busy ? "جارٍ النشر…" : `نشر ${countAr(todo, "notice", { acc: true })}`}</button>
              <button className="btn-ghost text-xs" onClick={() => setPreview((p) => p.filter((x) => x.key !== g.key))}>إلغاء</button>
              {count("unmatched") > 0 && <span className="text-[11px] text-absent">غير المطابَقين لا يُنشرون: تأكد من أرقام هوياتهم في البوابة.</span>}
            </div>
          </section>
        );
      })}

      {/* المنشور وسجل الرفع */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">الإشعارات المنشورة — <span className="num">{year}</span></h2>
        {!summary ? <Loader /> : summary.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">لم يُنشر إشعار فترة لهذا العام بعد.</p>
        ) : (
          <div className="divide-y divide-line">
            {summary.map((s) => (
              <div key={s.key} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-semibold text-ink">{s.title} <span className="text-xs font-normal text-muted">{s.term}</span></p>
                  <p className="text-[11px] text-muted">{countAr(s.count, "student")} · آخر تحديث <span className="num">{fmtDateTime(s.last)}</span></p>
                </div>
                <span className={`chip ${s.published === s.count ? "bg-success/10 text-success" : "bg-canvas text-muted"}`}>
                  {s.published === s.count ? "ظاهر للطلاب" : s.published ? "ظاهر جزئيًا" : "مخفي"}</span>
                <button className="btn-ghost text-xs" onClick={() => setPublished(s, s.published !== s.count)}>{s.published === s.count ? "إخفاء" : "إظهار"}</button>
                <button className="text-xs text-absent hover:underline" onClick={() => remove(s)}>حذف</button>
              </div>
            ))}
          </div>
        )}
        {logs.length > 0 && (
          <div className="border-t border-line bg-canvas/50 px-4 py-3">
            <p className="mb-1.5 text-xs font-semibold text-ink">سجل الرفع</p>
            <ul className="space-y-1 text-[11px] text-muted">
              {logs.map((l) => (
                <li key={l.id}><span className="num">{fmtDateTime(l.created_at)}</span> · {l.title} · {l.uploader_name ?? "—"} ·
                  جديد <span className="num">{l.added}</span> · تحدّث <span className="num">{l.changed}</span> من <span className="num">{l.students}</span></li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
