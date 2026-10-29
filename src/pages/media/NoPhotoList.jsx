// src/pages/media/NoPhotoList.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   قائمة «لا يُصوَّر» في استوديو الوسائط (supabase/media_2.sql): طلاب كل فصل بحالة موافقة
   أوليائهم على التصوير هذا العام. لا يُصوَّر إلا الموافَق عليه؛ ومن لم يردّ وليّه كمن رفض.
   member: لعضو المركز الإعلامي (media_3.sql)، من لا يُصوَّر وحده بلا أعداد ولا بيانات أولياء الأمور.
   ===================================================================== */

const STATUS = {
  denied:  { t: "رفض وليّ الأمر", c: "bg-absent/10 text-absent" },
  none:    { t: "لم يردّ بعد",    c: "bg-late/10 text-late" },
  allowed: { t: "موافق",          c: "bg-present/10 text-present" },
};
const GRADES = [[1, "الأول"], [2, "الثاني"], [3, "الثالث"]];
const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;

export default function NoPhotoList({ member = false }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [grade, setGrade] = useState(0);
  const [view, setView] = useState("no");        // no: لا يُصوَّر، allowed: الموافقون
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.rpc("media_no_photo").then(({ data, error }) => {
      if (error) setErr(/media_no_photo|schema cache|function/i.test(error.message) ? "القائمة تحتاج تشغيل supabase/media_2.sql مرة واحدة في Supabase ← SQL Editor." : error.message);
      setRows(data ?? []);
    });
  }, []);

  const n = useMemo(() => {
    const c = { allowed: 0, denied: 0, none: 0 };
    (rows ?? []).forEach((r) => { c[r.status] += 1; });
    return c;
  }, [rows]);
  const classes = useMemo(() => {
    const m = new Map();
    (rows ?? []).filter((r) => (!grade || r.grade === grade) && (view === "no" ? r.status !== "allowed" : r.status === "allowed")
      && (!q.trim() || r.full_name?.includes(q.trim())))
      .sort((a, b) => a.grade - b.grade || a.class_no - b.class_no || (a.status === "denied" ? -1 : 1) - (b.status === "denied" ? -1 : 1)
        || a.full_name.localeCompare(b.full_name, "ar"))
      .forEach((r) => { const k = `${r.grade}/${r.class_no}`; m.set(k, [...(m.get(k) ?? []), r]); });
    return [...m];
  }, [rows, grade, view, q]);

  if (!rows) return <Loader />;
  const total = rows.length || 1;

  return (
    <div className="space-y-3">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!member && <p className="text-sm text-muted">لا يُصوَّر إلا من وافق وليّ أمره هذا العام. يسأل حساب ولي الأمر عن الموافقة في صفحته الرئيسة، ويستطيع تغييرها متى شاء.</p>}
      {!member && <div className="grid grid-cols-3 gap-2">
        {["allowed", "denied", "none"].map((k) => (
          <div key={k} className="card px-3 py-2.5 text-center">
            <p className="num text-xl font-bold text-ink">{n[k]}</p>
            <p className="text-[11px] text-muted">{STATUS[k].t} · <span className="num">{Math.round((n[k] * 100) / total)}%</span></p>
          </div>
        ))}
      </div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {!member && <>
          <button className={pill(view === "no")} onClick={() => setView("no")}>لا يُصوَّر ({n.denied + n.none})</button>
          <button className={pill(view === "allowed")} onClick={() => setView("allowed")}>الموافقون ({n.allowed})</button>
          <span className="mx-1 w-px self-stretch bg-line" />
        </>}
        <button className={pill(!grade)} onClick={() => setGrade(0)}>كل الصفوف</button>
        {GRADES.map(([g, t]) => <button key={g} className={pill(grade === g)} onClick={() => setGrade(g)}>{t}</button>)}
        <input className="field ms-auto w-40 py-1 text-sm" value={q} placeholder="بحث بالاسم" onChange={(e) => setQ(e.target.value)} />
      </div>
      {classes.length ? classes.map(([k, list]) => (
        <section key={k} className="card overflow-hidden">
          <p className="border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink">فصل <span className="num">{k}</span>
            <span className="num ms-2 text-xs font-normal text-muted">({list.length})</span></p>
          {list.map((r) => (
            <div key={r.student_id} className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm last:border-0">
              <span className="min-w-0 flex-1 truncate text-ink">{r.full_name}</span>
              {r.updated_at && <span className="hidden text-[11px] text-faint sm:inline">{r.by_name} · {fmtDate(r.updated_at)}</span>}
              <span className={`chip shrink-0 ${STATUS[r.status].c}`}>{STATUS[r.status].t}</span>
            </div>
          ))}
        </section>
      )) : <p className="card px-4 py-8 text-center text-sm text-muted">لا طلاب في هذا العرض.</p>}
    </div>
  );
}
