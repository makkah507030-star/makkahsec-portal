// src/pages/lab/LabPerf.jsx
// تبويب «شواهد الأداء»: نموذج تقييم أداء محضر المختبر بعناصره الثلاثة عشر وأوزانها،
// ولكل عنصر تفسيره من الدليل، وما يخص معمل الحاسب منه، وشواهده الآلية من عمل المعمل في
// البوابة، وشواهد يرفعها المحضر، وسلّم التقدير بمستوياته الخمسة (src/lib/labPerf.js).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import { notify } from "../../lib/notice";
import { confirmDanger } from "../../lib/danger";
import { activeYear, uploadEvidenceFile, removeEvidenceFile, openEvidenceFile, ACCEPT } from "../../lib/performance.js";
import { LAB_PERF, autoMetric, lessonStats, loadLabStats } from "../../lib/labPerf.js";
import Loader from "../../components/Loader.jsx";

const KIND = {
  shared: { t: "عنصر مشترك", c: "#3E6350", bg: "#E4F3EA" },
  role: { t: "وفق الأدوار والمسؤوليات", c: "#5C5F66", bg: "#EEF0F1" },
};

export default function LabPerf({ onGo }) {
  const { session } = useSession();
  const uid = session?.user?.id;
  const [stats, setStats] = useState(null);
  const [ev, setEv] = useState(null);
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const L = useMemo(() => lessonStats(), []);

  const loadEv = async (y) => {
    const { data, error } = await supabase.from("lab_perf_evidence").select("*").eq("academic_year", y)
      .order("event_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) throw error;
    setEv(data ?? []);
  };
  useEffect(() => {
    (async () => {
      try {
        const y = await activeYear(); setYear(y);
        const [s] = await Promise.all([loadLabStats(), loadEv(y)]);
        setStats(s);
      } catch (e) {
        setErr(/lab_perf/.test(e.message ?? "") || e.code === "42P01" || e.code === "PGRST202"
          ? "شواهد الأداء تحتاج تشغيل الملف lab_perf_1.sql في Supabase." : e.message);
        setStats({}); setEv([]);
      }
    })();
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!stats || !ev) return <Loader />;

  const items = LAB_PERF.map((e) => {
    const auto = e.auto.map((k) => autoMetric(k, stats, L)).filter(Boolean);
    const mine = ev.filter((x) => x.element_key === e.key);
    return { ...e, autoList: auto, mine, ok: mine.length > 0 || auto.some((a) => a.v > 0) };
  });
  const covered = items.filter((x) => x.ok);
  const weight = covered.reduce((a, x) => a + x.w, 0);

  const head = [
    ["حصة نُفّذت", stats.bookings_done], ["عطلًا حُلّ", stats.tickets_resolved], ["جهازًا في السجل", stats.devices],
    ["معلمًا خدمه المعمل", stats.booking_teachers], ["طالبًا أقرّ بالسلامة", stats.acks], ["درسًا رقميًا", L.lessons],
  ];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-card border border-line bg-white shadow-card">
        <div className="p-4 text-white" style={{ background: "linear-gradient(135deg, #2F4F3F, #3E6350 55%, #5C8A70)" }}>
          <p className="text-[11px] opacity-80">الدليل الإرشادي لإدارة الأداء الوظيفي لشاغلي الوظائف التعليمية · الإصدار الثاني · نموذج 5</p>
          <h2 className="mt-1 text-lg font-bold">شواهد الأداء الوظيفي · محضر معمل الحاسب الآلي</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed opacity-90">ثلاثة عشر عنصرًا بأوزانها. الشواهد الآلية تُحسب من عملك في المعمل لحظة فتح الصفحة، وتُكمل بما ترفعه.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="h-2 min-w-[160px] flex-1 overflow-hidden rounded-pill bg-white/25"><div className="h-full rounded-pill bg-white" style={{ width: `${weight}%` }} /></div>
            <span className="text-sm font-bold"><span className="num">{covered.length}</span> من <span className="num">13</span> عنصرًا لها شواهد · <span className="num">{weight}%</span> من الوزن</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-line border-t border-line sm:grid-cols-6">
          {head.map(([t, v]) => (
            <div key={t} className="px-2 py-2.5 text-center"><b className="num block text-lg text-mint-deep">{Number(v ?? 0)}</b><span className="text-[11px] text-muted">{t}</span></div>))}
        </div>
      </section>
      {err && <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">{err}</p>}
      <div className="flex flex-wrap gap-2 text-[11px]">
        {Object.values(KIND).map((k) => <span key={k.t} className="rounded-pill px-2.5 py-0.5 font-semibold" style={{ background: k.bg, color: k.c }}>{k.t}</span>)}
        <span className="text-faint">الشواهد تخضع لتقدير المقيِّم، واكتمالها خطوة نحو التقدير العالي لا ضمان له.</span>
      </div>

      <div className="space-y-2">{items.map((e, i) => (
        <Element key={e.key} e={e} n={i + 1} open={open === e.key} onToggle={() => setOpen(open === e.key ? null : e.key)}
          uid={uid} year={year} disabled={!!err} onGo={onGo} reload={() => loadEv(year)} />
      ))}</div>
    </div>
  );
}

function Element({ e, n, open, onToggle, uid, year, disabled, onGo, reload }) {
  const k = KIND[e.kind];
  return (
    <section className="overflow-hidden rounded-card border border-line bg-white shadow-card" style={{ borderInlineStartWidth: 4, borderInlineStartColor: k.c }}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-start">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ background: k.bg, color: k.c }}><span className="num">{n}</span></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-ink">{e.t}</span>
          <span className="text-[11px] text-muted">من البوابة: <span className="num">{e.autoList.filter((a) => a.v > 0).length}</span> · مرفوعة: <span className="num">{e.mine.length}</span>{e.judge ? " · يقدّره المقيِّم" : ""}</span>
        </span>
        <span className="num shrink-0 rounded-pill bg-canvas px-2 py-0.5 text-[12px] font-bold text-ink">{e.w}%</span>
        <span className={`shrink-0 text-base ${e.ok ? "text-present" : "text-faint"}`}>{e.ok ? "✓" : "○"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-3 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="rounded-sm2 bg-canvas px-3 py-2 text-[12.5px] leading-relaxed text-ink"><b className="block text-[11px] text-muted">تفسير العنصر في الدليل</b>{e.def}</p>
            <p className="rounded-sm2 px-3 py-2 text-[12.5px] leading-relaxed text-ink" style={{ background: k.bg }}><b className="block text-[11px]" style={{ color: k.c }}>ما يخص معمل الحاسب</b>{e.lab}</p>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-bold text-mint-deep">الشواهد من البوابة</p>
            <div className="grid gap-2 sm:grid-cols-3">{e.autoList.map((a) => (
              <button key={a.t} onClick={() => onGo?.(a.tab)} className="rounded-sm2 border border-line bg-white px-3 py-2 text-start hover:border-mint-light">
                <b className={`num block text-xl ${a.v > 0 ? "text-mint-deep" : "text-faint"}`}>{a.v}</b>
                <span className="block text-[11.5px] text-ink">{a.t}</span>
                {a.sub && <span className="block text-[10.5px] text-muted">{a.sub}</span>}
              </button>))}</div>
          </div>
          <Uploads e={e} uid={uid} year={year} disabled={disabled} reload={reload} />
          <details className="rounded-sm2 border border-line">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-semibold text-muted">سلّم التقدير (من 1 إلى 5)</summary>
            <div className="grid gap-px bg-line sm:grid-cols-5">{e.ladder.map((t, j) => (
              <div key={j} className="bg-white p-2.5 text-[11.5px] leading-relaxed text-ink">
                <b className="num mb-1 inline-grid h-5 w-5 place-items-center rounded-full bg-mint-deep text-[10.5px] text-white">{j + 1}</b>
                <p>{t}</p></div>))}</div>
          </details>
        </div>
      )}
    </section>
  );
}

function Uploads({ e, uid, year, disabled, reload }) {
  const [x, setX] = useState({ title: "", date: "", note: "" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!x.title.trim()) { notify({ ok: false, text: "اكتب عنوان الشاهد." }); return; }
    setBusy(true);
    try {
      const f = file ? await uploadEvidenceFile(uid, file) : null;
      const { error } = await supabase.from("lab_perf_evidence").insert({ academic_year: year, element_key: e.key, title: x.title.trim(),
        note: x.note.trim() || null, event_date: x.date || null, file_path: f?.path ?? null, file_name: f?.name ?? null });
      if (error) { if (f) await removeEvidenceFile(f.path); throw error; }
      setX({ title: "", date: "", note: "" }); setFile(null); notify({ ok: true, text: "أُضيف الشاهد." }); reload();
    } catch (er) { notify({ ok: false, text: er.message }); }
    setBusy(false);
  };
  const del = async (r) => {
    if (!(await confirmDanger({ title: `حذف الشاهد «${r.title}»`, impact: ["يُحذف الشاهد ومرفقه نهائيًا."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("lab_perf_evidence").delete().eq("id", r.id);
    if (error) { notify({ ok: false, text: error.message }); return; }
    await removeEvidenceFile(r.file_path); reload();
  };
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-bold text-mint-deep">شواهد مرفوعة</p>
      {e.mine.length > 0 && <div className="mb-2 divide-y divide-line rounded-sm2 border border-line">{e.mine.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12.5px]">
          <span className="min-w-0 flex-1"><b className="text-ink">{r.title}</b>{r.event_date && <span className="text-[11px] text-muted"> · <span className="num">{fmtDate(r.event_date)}</span></span>}
            {r.note && <span className="block text-[11.5px] text-muted">{r.note}</span>}</span>
          {r.file_path && <button className="text-[11.5px] font-semibold text-mint-deep" onClick={() => openEvidenceFile(r.file_path)}>فتح المرفق</button>}
          {r.user_id === uid && <button className="text-[11.5px] text-absent" onClick={() => del(r)}>حذف</button>}
        </div>))}</div>}
      <p className="mb-1.5 text-[11px] text-faint">مقترح: {e.hint}</p>
      {!disabled && (
        <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
          <input className="field text-sm" value={x.title} onChange={(ev) => setX({ ...x, title: ev.target.value })} placeholder="عنوان الشاهد" />
          <input type="date" className="field text-sm" value={x.date} onChange={(ev) => setX({ ...x, date: ev.target.value })} />
          <input className="field text-sm" value={x.note} onChange={(ev) => setX({ ...x, note: ev.target.value })} placeholder="وصف مختصر (اختياري)" />
          <label className="field flex cursor-pointer items-center truncate text-[12px] text-muted">
            <input type="file" accept={ACCEPT} className="hidden" onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} />{file ? file.name : "إرفاق صورة أو PDF"}</label>
          <button className="btn-primary w-fit px-4 py-1.5 text-xs" disabled={busy} onClick={add}>{busy ? "…" : "+ إضافة الشاهد"}</button>
        </div>
      )}
    </div>
  );
}
