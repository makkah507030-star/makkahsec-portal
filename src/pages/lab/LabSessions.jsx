// src/pages/lab/LabSessions.jsx
// حصص الطلاب في المعمل: ينشئ المعلم ملف حصة لفصل ودرس فيُنزَّل ملف HTML يعمل على أجهزة
// المعمل دون إنترنت، ثم يمسح رموز الدرجات بكاميرا الجوال فتُرصد (computer_lab_7/8.sql).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { printReport } from "../../lib/exportUtils";
import { byName } from "../../lib/sortAr.js";
import { classText, isoOf, shortDate } from "../../lib/lab.js";
import { LESSONS, lessonById } from "../../lab-content/index.js";
import { buildLabFile, downloadText } from "./labFile.js";
import LabScanner from "./LabScanner.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const pc = (n) => (n == null ? "—" : `PC-${String(n).padStart(2, "0")}`);
const dateOf = (ts) => shortDate(isoOf(new Date(ts)));

export default function LabSessions({ lab, canCreate }) {
  const [list, setList] = useState(null);
  const [view, setView] = useState(null);      // null | "new" | { scan } | { results: session }
  const [, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("lab_sessions_list", { p_lab: lab });
    if (error) setMsg({ ok: false, text: "تعذّر تحميل الحصص: " + error.message });
    setList(data ?? []);
  }, [lab, setMsg]);
  useEffect(() => { load(); }, [load]);

  const download = async (file) => {
    try {
      const html = await buildLabFile(file);
      downloadText(html, `معمل-فصل-${file.class_no}-${lessonById(file.lesson)?.lesson.title ?? file.lesson}.html`);
    } catch (e) { setMsg({ ok: false, text: "تعذّر تجهيز الملف: " + e.message }); }
  };
  const redownload = async (s) => {
    const { data, error } = await supabase.rpc("lab_session_file", { p_session: s.id });
    if (error || !data) { setMsg({ ok: false, text: "تعذّر جلب بيانات الحصة: " + (error?.message ?? "") }); return; }
    download(data);
  };
  const remove = async (s) => {
    const ok = await confirmDanger({
      title: `حذف حصة ${s.lesson_title} لفصل ${s.class_no}؟`,
      impact: [`تُحذف درجات ${s.scanned} طالبًا رُصدت فيها`, "لا يُقبل بعدها مسح رموز هذا الملف"],
      level: "medium", confirmLabel: "حذف",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("lab_session_delete", { p_session: s.id });
    if (error) setMsg({ ok: false, text: "تعذّر الحذف: " + error.message }); else load();
  };

  if (view === "new") return <NewSession lab={lab} onCancel={() => setView(null)} onCreated={(f) => { download(f); setView(null); load(); }} />;
  if (view?.scan) return <ScanView onClose={() => { setView(null); load(); }} />;
  if (view?.results) return <Results session={view.results} onClose={() => { setView(null); load(); }} />;

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-ink">حصص الطلاب</p>
          <p className="text-xs text-muted">ملف يعمل على أجهزة المعمل دون إنترنت، ودرجات تُرصد بمسح رمز كل طالب.</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost py-2" onClick={() => setView({ scan: true })}>مسح الدرجات</button>
            <button type="button" className="btn-primary py-2" onClick={() => setView("new")}>ملف حصة جديد</button>
          </div>
        )}
      </div>
      {list === null ? <p className="text-sm text-muted">جارٍ التحميل…</p>
        : !list.length ? <p className="rounded-card bg-canvas px-3 py-4 text-center text-sm text-muted">لم تُنشأ حصص بعد.</p>
          : (
            <ul className="divide-y divide-line/60 rounded-card border border-line/60">
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="w-full sm:w-auto sm:flex-1">
                    <p className="text-sm font-semibold text-ink">{s.lesson_title} · {classText(s)}</p>
                    <p className="text-xs text-muted">
                      <bdi className="num">{dateOf(s.created_at)}</bdi>{s.teacher ? ` · ${s.teacher}` : ""} · رُصد <bdi className="num">{s.scanned}</bdi> من <bdi className="num">{s.students}</bdi>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setView({ results: s })}>النتائج</button>
                    <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => redownload(s)}>تنزيل الملف</button>
                    <button type="button" className="px-2 text-xs text-muted underline" onClick={() => remove(s)}>حذف</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
    </div>
  );
}

function NewSession({ lab, onCancel, onCreated }) {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState(LESSONS[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { supabase.rpc("lab_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? [])); }, [lab]);
  const cls = classes?.find((c) => c.class_id === classId);

  const create = async () => {
    setBusy(true); setErr("");
    const lesson = lessonById(lessonId);
    const { data, error } = await supabase.rpc("lab_session_create",
      { p_lab: lab, p_class: classId, p_lesson: lessonId, p_title: lesson.lesson.title });
    setBusy(false);
    if (error) { setErr("تعذّر إنشاء الحصة: " + error.message); return; }
    onCreated(data);
  };

  return (
    <div className="card space-y-4 p-4">
      <p className="text-base font-bold text-ink">ملف حصة جديد</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ses-lesson">الدرس</label>
          <select id="ses-lesson" className="field" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            {LESSONS.map((l) => <option key={l.id} value={l.id}>{l.grade} · الدرس {l.lesson.no}: {l.lesson.title}{l.draft ? " (مسودة)" : ""}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ses-class">الفصل</label>
          <select id="ses-class" className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— اختر الفصل —</option>
            {(classes ?? []).map((c) => <option key={c.class_id} value={c.class_id}>{classText(c)} · {c.students} طالبًا</option>)}
          </select>
        </div>
      </div>
      {cls && cls.seated < cls.students && (
        <p className="rounded-card bg-warning-light px-3 py-2 text-xs text-late">
          وُزّع <bdi className="num">{cls.seated}</bdi> من <bdi className="num">{cls.students}</bdi> في خريطة الجلوس. غير الموزّع يختار اسمه من قائمة الفصل كاملة.
        </p>
      )}
      <ol className="list-decimal space-y-1 rounded-card bg-canvas py-3 pl-3 pr-8 text-xs leading-relaxed text-muted">
        <li>يُنزَّل ملف واحد للفصل، ويُنسخ إلى أجهزة المعمل (أو مجلد مشترك) ويُفتح بالمتصفح.</li>
        <li>يختار الطالب رقم جهازه واسمه، ويؤدّي الدرس دون إنترنت.</li>
        <li>في النهاية يعرض رمز درجته، فتمسحه من «مسح الدرجات».</li>
      </ol>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost py-2" onClick={onCancel}>إلغاء</button>
        <button type="button" className="btn-primary py-2" disabled={!classId || !lessonId || busy} onClick={create}>
          {busy ? "جارٍ التجهيز…" : "إنشاء وتنزيل الملف"}
        </button>
      </div>
    </div>
  );
}

function ScanView({ onClose }) {
  const [last, setLast] = useState(null);
  const [count, setCount] = useState(0);
  const record = useCallback(async (text) => {
    const { data, error } = await supabase.rpc("lab_result_record", { p_text: text });
    if (error) { setLast({ error: error.message }); return; }
    if (data.students.some((s) => s.new)) { setCount((n) => n + data.students.filter((s) => s.new).length); navigator.vibrate?.(60); }
    setLast(data);
  }, []);

  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">مسح الدرجات</p>
        <button type="button" className="btn-ghost py-2" onClick={onClose}>إنهاء</button>
      </div>
      <LabScanner onCode={record} />
      <p className="text-center text-xs text-muted">وجّه الكاميرا إلى رمز الدرجة على شاشة الطالب · رُصد في هذه الجلسة <bdi className="num font-bold text-ink">{count}</bdi></p>
      {last && <ScanResult r={last} />}
    </div>
  );
}

export function ScanResult({ r }) {
  if (r.error) return <p className="rounded-card bg-danger-light px-3 py-3 text-sm font-semibold text-absent">{r.error}</p>;
  const fresh = r.students.some((s) => s.new);
  return (
    <div className={`space-y-2 rounded-card p-3 ${fresh ? "bg-present/10" : "bg-warning-light"}`}>
      <p className={`text-sm font-bold ${fresh ? "text-present" : "text-late"}`}>
        {fresh ? "رُصدت الدرجة ✓" : "مرصودة من قبل — بقيت الدرجة الأولى"}
      </p>
      <p className="text-xs text-muted">{r.lesson} · فصل <bdi className="num">{r.class_no}</bdi> · الجهاز <bdi className="num">{pc(r.device)}</bdi></p>
      <ul className="space-y-1">
        {r.students.map((s) => (
          <li key={s.name} className="text-sm text-ink">
            {s.name}
            {s.map_seat != null && s.map_seat !== r.device && <span className="mr-2 text-xs text-late">(جهازه في الخريطة {pc(s.map_seat)})</span>}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink">
        الاختبار <bdi className="num font-bold">{r.quiz != null ? `${r.quiz}%` : "لم يؤدَّ"}</bdi> · الإتقان <bdi className="num font-bold">{r.mastery != null ? `${r.mastery}%` : "—"}</bdi> · المحطات <bdi className="num">{r.done}/{r.total}</bdi>
      </p>
    </div>
  );
}

function Results({ session, onClose }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useNotice(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("lab_session_results", { p_session: session.id });
    if (error) setMsg({ ok: false, text: "تعذّر تحميل النتائج: " + error.message });
    setRows((data ?? []).sort(byName()));
  }, [session.id, setMsg]);
  useEffect(() => { load(); }, [load]);

  const unrecord = async (r) => {
    const ok = await confirmDanger({ title: `حذف درجة ${r.full_name}؟`, impact: ["يمكن رصدها من جديد بمسح رمزه"], level: "medium", confirmLabel: "حذف" });
    if (!ok) return;
    const { error } = await supabase.rpc("lab_result_delete", { p_session: session.id, p_student: r.student_id });
    if (error) setMsg({ ok: false, text: "تعذّر الحذف: " + error.message }); else load();
  };
  const pctText = (v) => (v == null ? "—" : `${v}%`);
  const print = () => printReport({
    title: `نتائج ${session.lesson_title} — ${classText(session)}`,
    subtitle: `معمل الحاسب الآلي · ${dateOf(session.created_at)} · رُصد ${rows.filter((r) => r.scanned_at).length} من ${rows.length}`,
    headers: ["الطالب", "الجهاز", "الاختبار", "الإتقان", "المحطات"],
    rows: rows.map((r) => [r.full_name, r.device_seat ? pc(r.device_seat) : "—", r.scanned_at ? pctText(r.quiz) : "لم يُرصد",
      pctText(r.mastery), r.done != null ? `${r.done}/${r.total}` : "—"]),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    hideSignatures: true,
  });

  return (
    <div className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-bold text-ink">{session.lesson_title} · {classText(session)}</p>
          <p className="text-xs text-muted"><bdi className="num">{dateOf(session.created_at)}</bdi>{rows && <> · رُصد <bdi className="num">{rows.filter((r) => r.scanned_at).length}</bdi> من <bdi className="num">{rows.length}</bdi></>}</p>
        </div>
        <div className="flex gap-2">
          {rows?.length > 0 && <button type="button" className="btn-ghost py-2" onClick={print}>طباعة</button>}
          <button type="button" className="btn-ghost py-2" onClick={onClose}>رجوع</button>
        </div>
      </div>
      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}
      {rows === null ? <p className="text-sm text-muted">جارٍ التحميل…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm [&_td:not(:first-child)]:whitespace-nowrap">
            <thead>
              <tr className="bg-mint-tint text-xs text-mint-deep">
                {["الطالب", "الجهاز", "الاختبار", "الإتقان", "المحطات", ""].map((h, i) => <th key={i} className={`border border-line px-2 py-1.5 text-start font-bold ${i === 4 ? "hidden sm:table-cell" : ""}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const moved = r.scanned_at && r.map_seat != null && r.device_seat !== r.map_seat;
                return (
                  <tr key={r.student_id} className={r.scanned_at ? "" : "text-faint"}>
                    <td className="border border-line px-2 py-1.5 text-ink">{r.full_name}</td>
                    <td className="num border border-line px-2 py-1.5" title={moved ? `جهازه في الخريطة ${pc(r.map_seat)}` : undefined}>
                      {r.scanned_at ? pc(r.device_seat) : pc(r.map_seat)}{moved && <span className="text-late"> ⚠</span>}
                    </td>
                    <td className="num border border-line px-2 py-1.5 font-bold text-ink">{r.scanned_at ? pctText(r.quiz) : "لم يُرصد"}</td>
                    <td className="num border border-line px-2 py-1.5">{pctText(r.mastery)}</td>
                    <td className="num hidden border border-line px-2 py-1.5 sm:table-cell">{r.done != null ? `${r.done}/${r.total}` : "—"}</td>
                    <td className="border border-line px-2 py-1.5 text-center">
                      {r.scanned_at && <button type="button" title="حذف الدرجة لإعادة رصدها" className="px-1 text-muted hover:text-absent" onClick={() => unrecord(r)}>✕</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
