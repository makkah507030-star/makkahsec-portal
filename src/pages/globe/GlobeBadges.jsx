// src/pages/globe/GlobeBadges.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { useNotice } from "../../lib/useNotice.js";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import Loader from "../../components/Loader.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { ALL_PROTOCOLS, HONOR_ROLL_URL } from "../../lib/globe.js";
import { pill } from "./shared.jsx";
import { badgesPages } from "./GlobeBadgesDoc.jsx";

/* =====================================================================
   إنجازات البرنامج وأوسمته (supabase/globe_3.sql ← globe_badges): تُدخل يدويًا
   من لوحة شرف العلوم في GLOBE، لكل عام أرباعه الأربعة، ولكل ربع عدد الأوسمة
   والمجالات التي نالها البرنامج فيها. وتقريرها PDF بهوية البوابة.
   ===================================================================== */

const QUARTERS = [1, 2, 3, 4];
const Q_T = { 1: "الربع الأول", 2: "الربع الثاني", 3: "الربع الثالث", 4: "الربع الرابع" };
const setup = (e) => (/globe_badges|schema cache|relation/i.test(e?.message ?? "")
  ? "الأوسمة تحتاج تشغيل ملف supabase/globe_3.sql مرة واحدة في Supabase ← SQL Editor." : e?.message);

export default function GlobeBadges({ leader }) {
  const [rows, setRows] = useState(null);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(null);
  const [edit, setEdit] = useState(null);         // { quarter, badges, domains, note, add }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [report, setReport] = useState(false);

  const load = () => supabase.from("globe_badges").select("*").order("year", { ascending: false }).order("quarter")
    .then(({ data, error }) => {
      if (error) setMsg({ ok: false, text: setup(error) });
      const r = data ?? [];
      setRows(r);
      const ys = [...new Set(r.map((x) => x.year))].sort((a, b) => b - a);
      setYears((cur) => [...new Set([...ys, ...cur])].sort((a, b) => b - a));
      setYear((y) => y ?? ys[0] ?? new Date().getFullYear());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const of = (y, q) => (rows ?? []).find((r) => r.year === y && r.quarter === q);
  const yearTotal = (y) => (rows ?? []).filter((r) => r.year === y).reduce((a, r) => a + r.badges, 0);
  const allYears = [...new Set([...(years ?? []), year].filter(Boolean))].sort((a, b) => b - a);

  const [newYear, setNewYear] = useState(null);   // خانة إضافة عام
  const addYear = () => {
    const v = Number(newYear);
    if (!Number.isInteger(v) || v < 2000 || v > 2100) return;
    setYears((ys) => [...new Set([...ys, v])].sort((a, b) => b - a));
    setYear(v); setNewYear(null); setEdit(null);
  };

  const save = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("globe_badges").upsert({
      year, quarter: edit.quarter, badges: Math.max(0, Number(edit.badges) || 0),
      domains: edit.domains, note: edit.note.trim() || null, updated_at: new Date().toISOString(),
    }, { onConflict: "year,quarter" });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: setup(error) }); return; }
    setEdit(null); load();
  };

  const toggleDomain = (d) => setEdit((e) => ({ ...e, domains: e.domains.includes(d) ? e.domains.filter((x) => x !== d) : [...e.domains, d] }));

  if (report) return <BadgesReport rows={rows ?? []} leader={leader} onBack={() => setReport(false)} />;
  if (!rows) return <Loader />;
  const total = rows.reduce((a, r) => a + r.badges, 0);

  return (
    <div className="space-y-4">
      <a href={HONOR_ROLL_URL} target="_blank" rel="noopener noreferrer"
         className="card flex items-center gap-3 px-4 py-3 transition-colors hover:border-mint-light hover:bg-mint-tint/50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#B8912F]/12 text-[#B8912F]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="9" r="6" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" /></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">مصدر الأوسمة: لوحة شرف العلوم في GLOBE</span>
          <span className="block text-xs text-muted">صفحة تقدير مدرستنا في GLOBE Science Honor Roll — تُنقل منها الأوسمة يدويًا لكل ربع</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-mint-deep">فتح المصدر ←</span>
      </a>

      <div className="flex flex-wrap items-center gap-1.5">
        {allYears.map((y) => (
          <button key={y} className={pill(y === year)} onClick={() => { setYear(y); setEdit(null); }}>
            <span className="num">{y}</span> <span className="num opacity-75">({yearTotal(y)})</span>
          </button>
        ))}
        {newYear == null ? (
          <button className="rounded-pill border border-dashed border-mint-deep px-3 py-1.5 text-[12.5px] font-medium text-mint-deep"
                  onClick={() => setNewYear(String(new Date().getFullYear()))}>+ عام</button>
        ) : (
          <span className="flex items-center gap-1.5">
            <input type="number" className="field num !h-8 w-24 !py-0" min="2000" max="2100" value={newYear} autoFocus
                   aria-label="العام الميلادي" onChange={(e) => setNewYear(e.target.value)}
                   onKeyDown={(e) => { if (e.key === "Enter") addYear(); if (e.key === "Escape") setNewYear(null); }} />
            <button className="text-xs font-semibold text-mint-deep" onClick={addYear}>إضافة</button>
            <button className="text-xs text-muted" onClick={() => setNewYear(null)}>إلغاء</button>
          </span>
        )}
        <button className="btn-primary ms-auto px-4 py-1.5 text-sm" disabled={!total} onClick={() => setReport(true)}>تقرير الإنجازات PDF</button>
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {QUARTERS.map((q) => {
          const r = of(year, q);
          const on = edit?.quarter === q;
          return (
            <section key={q} className={`card p-4 ${on ? "ring-2 ring-mint-deep" : ""}`}>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink">{Q_T[q]} <span className="num text-muted">{year}</span></h3>
                {!on && <button className="ms-auto text-xs font-semibold text-mint-deep"
                  onClick={() => setEdit({ quarter: q, badges: r?.badges ?? 0, domains: r?.domains ?? [], note: r?.note ?? "", add: "" })}>
                  {r ? "تعديل" : "+ إدخال"}</button>}
              </div>
              {on ? (
                <div className="mt-3 space-y-3">
                  <label className="block text-xs text-muted">عدد الأوسمة
                    <input type="number" min="0" className="field num mt-1 w-32" value={edit.badges} onChange={(e) => setEdit({ ...edit, badges: e.target.value })} />
                  </label>
                  <div>
                    <p className="mb-1.5 text-xs text-muted">المجالات التي نال فيها البرنامج الأوسمة</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...new Set([...ALL_PROTOCOLS, ...edit.domains])].map((d) => (
                        <button key={d} type="button" className={pill(edit.domains.includes(d))} onClick={() => toggleDomain(d)}>{d}</button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input className="field flex-1" placeholder="مجال آخر" maxLength={60} value={edit.add}
                             onChange={(e) => setEdit({ ...edit, add: e.target.value })} />
                      <button className="btn-ghost px-3" disabled={!edit.add.trim()}
                              onClick={() => setEdit((e) => ({ ...e, domains: [...new Set([...e.domains, e.add.trim()])], add: "" }))}>إضافة</button>
                    </div>
                  </div>
                  <input className="field w-full" placeholder="ملاحظة (اختيارية)" maxLength={200} value={edit.note}
                         onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
                    <button className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
                  </div>
                </div>
              ) : r ? (
                <div className="mt-2">
                  <p className="num text-3xl font-bold text-[#B8912F]">{r.badges} <span className="text-sm font-medium text-muted">{r.badges === 1 ? "وسام" : "أوسمة"}</span></p>
                  {r.domains.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.domains.map((d) => <span key={d} className="chip bg-mint-tint text-mint-deep">{d}</span>)}
                    </div>
                  )}
                  {r.note && <p className="mt-2 text-xs text-muted">{r.note}</p>}
                </div>
              ) : <p className="mt-2 text-xs text-faint">لم يُدخل بعد.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BadgesReport({ rows, leader, onBack }) {
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({ leader: null, principal: null, stamp: null });
  useEffect(() => {
    let live = true;
    Promise.all([leader ? signatureByName(leader) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([l, p, s]) => { if (live) setSigs({ leader: l, principal: p?.url ?? null, stamp: s }); });
    return () => { live = false; };
  }, [leader]);
  const pages = useMemo(() => badgesPages({ rows, theme, leader, sigs, today: todayISO() }), [rows, theme, leader, sigs]);
  return (
    <ReportViewer id="globe-badges-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle="إنجازات برنامج جلوب وأوسمته"
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للأوسمة</button>} />
  );
}
