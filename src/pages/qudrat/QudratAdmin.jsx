// src/pages/qudrat/QudratAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import { byName } from "../../lib/sortAr.js";
import Loader from "../../components/Loader.jsx";
import { SECS, SKILLS } from "../../qudrat-content/index.js";
import { pctOf } from "./shared.jsx";

/* =====================================================================
   لوحة متابعة مركز التدريب (القدرات) — للمدير ووكيل الشؤون التعليمية
   والدعم الفني: عدد المتدربين ونشاطهم، ومستوى المدرسة في كل مهارة (الأضعف
   أولًا)، وجدول المتدربين بنسبة صوابهم وآخر نشاط ونتائج المحاكاة وموعد
   الاختبار، وأسئلة الطلاب بانتظار الرد (qudrat_4.sql).
   ===================================================================== */

const SORTS = { last: "آخر نشاط", answers: "الأكثر تدريبًا", pct: "الأعلى صوابًا", low: "الأقل صوابًا", name: "الاسم" };

export default function QudratAdmin() {
  const [st, setSt] = useState(null);
  const [sk, setSk] = useState([]);
  const [openAsks, setOpenAsks] = useState(0);
  const [err, setErr] = useState("");
  const [grade, setGrade] = useState("all");
  const [sort, setSort] = useState("last");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data, error }, { data: s }, { count }] = await Promise.all([
        supabase.rpc("qudrat_admin_students"),
        supabase.rpc("qudrat_admin_skills"),
        supabase.from("qudrat_asks").select("id", { count: "exact", head: true }).is("replied_at", null),
      ]);
      if (error) setErr(/qudrat_admin/.test(error.message) ? "اللوحة غير مفعّلة بعد: يلزم تشغيل ملف supabase/qudrat_4.sql." : error.message);
      setSt(data ?? []); setSk(s ?? []); setOpenAsks(count ?? 0);
    })();
  }, []);

  const list = useMemo(() => {
    const t = q.trim();
    const l = (st ?? []).filter((r) => (grade === "all" || String(r.grade) === grade) && (!t || (r.full_name ?? "").includes(t)))
      .map((r) => ({ ...r, pct: pctOf(r.correct, r.answers) }));
    const cmp = { last: (a, b) => String(b.last_at).localeCompare(String(a.last_at)), answers: (a, b) => b.answers - a.answers,
                  pct: (a, b) => b.pct - a.pct, low: (a, b) => a.pct - b.pct, name: byName() }[sort];
    return l.sort(cmp);
  }, [st, grade, sort, q]);

  if (st === null) return <Loader />;
  const total = st.reduce((n, r) => n + r.answers, 0);
  const right = st.reduce((n, r) => n + r.correct, 0);
  const week = Date.now() - 7 * 864e5;
  const active = st.filter((r) => new Date(r.last_at).getTime() >= week).length;
  const mocks = st.reduce((n, r) => n + r.mocks, 0);
  const grades = [...new Set(st.map((r) => r.grade).filter(Boolean))].sort();
  const skills = sk.filter((r) => SKILLS[r.skill]).map((r) => ({ ...r, pct: pctOf(r.correct, r.answers) })).sort((a, b) => a.pct - b.pct);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to="/qudrat" className="text-xs font-semibold text-mint-deep">مركز التدريب</Link>
          <h1 className="text-lg font-bold text-ink">متابعة التدريب على القدرات</h1>
          <p className="mt-1 text-sm text-muted">نشاط الطلاب في مركز التدريب ومستوى المدرسة في كل مهارة.</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Link to="/qudrat/report" className="btn-primary">تقرير المتابعة الشهري</Link>
        <Link to="/qudrat/asks" className="btn-ghost">أسئلة الطلاب {openAsks > 0 && <span className="chip bg-absent text-white num">{openAsks}</span>}</Link>
        </div>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[["متدربًا", st.length, "text-ink"], ["نشطون هذا الأسبوع", active, "text-mint-deep"], ["إجابة", total, "text-ink"],
          ["نسبة الصواب", total ? `${pctOf(right, total)}%` : "—", "text-present"], ["اختبارًا محاكيًا", mocks, "text-excused"]].map(([t, v, c]) => (
          <div key={t} className="card px-3 py-3 text-center">
            <p className={`num text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-[11.5px] text-muted">{t}</p>
          </div>
        ))}
      </div>

      {skills.length > 0 && (
        <section className="card px-4 py-3.5">
          <p className="text-sm font-bold text-ink">مستوى المدرسة في كل مهارة <span className="font-normal text-muted">(الأضعف أولًا)</span></p>
          <div className="mt-2.5 space-y-2">
            {skills.map((r) => (
              <div key={r.skill} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-ink">{SKILLS[r.skill].t}</span>
                <span className={`chip w-14 justify-center ${SECS[r.sec]?.bg} ${SECS[r.sec]?.c}`}>{SECS[r.sec]?.t}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                  <div className={`h-full rounded-full ${r.pct >= 65 ? "bg-present" : r.pct >= 45 ? "bg-late" : "bg-absent"}`} style={{ width: `${r.pct}%` }} />
                </div>
                <span className="num w-10 shrink-0 text-left font-semibold text-ink">{r.pct}%</span>
                <span className="hidden w-24 shrink-0 text-left text-xs text-muted sm:block"><span className="num">{r.users}</span> طالبًا</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="all">كل الصفوف</option>
            {grades.map((g) => <option key={g} value={String(g)}>الصف {g}</option>)}
          </select>
          <select className="field w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <input className="field max-w-xs flex-1" placeholder="ابحث باسم الطالب…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!list.length ? (
          <p className="card px-4 py-8 text-center text-sm text-muted">{st.length ? "لا نتائج بهذه التصفية." : "لم يتدرب أحد بعد."}</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-canvas text-xs text-muted">
                <tr>{["الطالب", "الصف والفصل", "الإجابات", "الصواب", "آخر نشاط", "المحاكاة", "موعد الاختبار", "أسئلته"].map((h) => <th key={h} className="px-3 py-2 text-right font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {list.map((r) => (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2 font-semibold text-ink">{r.full_name ?? "حساب غير طالب"}</td>
                    <td className="px-3 py-2 text-muted">{r.grade ? <>الصف <span className="num">{r.grade}</span> · فصل <span className="num">{r.class_no}</span></> : "—"}</td>
                    <td className="num px-3 py-2">{r.answers}</td>
                    <td className={`num px-3 py-2 font-semibold ${r.pct >= 65 ? "text-present" : r.pct >= 45 ? "text-late" : "text-absent"}`}>{r.pct}%</td>
                    <td className="num px-3 py-2 text-muted">{fmtHijri(r.last_at)}</td>
                    <td className="px-3 py-2 text-muted">{r.mocks ? <>آخرها <span className="num">{r.last_mock}%</span> · أفضلها <span className="num">{r.best_mock}%</span></> : "—"}</td>
                    <td className="num px-3 py-2 text-muted">{r.exam_date ? fmtHijri(r.exam_date) : "—"}</td>
                    <td className="num px-3 py-2 text-muted">{r.asks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
