// src/pages/gifted/MawhibaTracker.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ROLE_PERSON_NAME } from "../../lib/session.jsx";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { cleanMobile } from "../../lib/importer";
import { byClassName } from "../../lib/sortAr.js";
import { printReport, escHtml as e, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { logos } from "../student-affairs/shared.jsx";
import Loader from "../../components/Loader.jsx";
import { MAWHIBA, STATUS, FLOW, PAY, reached, waText, span } from "../../lib/gifted.js";

/* =====================================================================
   متابعة مقياس موهبة لطلاب الأول الثانوي (supabase/gifted_1.sql): حالة كل طالب من
   التسجيل إلى النتيجة، والنسب لكل فصل، وتذكير الواتساب الجاهز بمرحلته للطالب
   وولي أمره، والتحديث الجماعي، وطباعة الكشف.
   ===================================================================== */

const localMobile = (m) => (m?.startsWith("966") ? "0" + m.slice(3) : m ?? "");
const daysTo = (iso) => Math.ceil((new Date(`${iso}T23:59:00`) - new Date()) / 864e5);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

const WA_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);
function Wa({ mobile, text, label }) {
  if (!mobile || !text) return null;
  return (
    <a href={`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 rounded-pill bg-[#25D366]/12 px-2.5 py-1 text-[11px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20">{WA_ICON}{label}</a>
  );
}

export default function MawhibaTracker() {
  const { profile } = useSession();
  const [year, setYear] = useState(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [cls, setCls] = useState("all");
  const [st, setSt] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(new Set());
  const [open, setOpen] = useState(null);         // الطالب المفتوح للتحديث
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data: s } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
    const y = s?.value ?? "";
    setYear(y);
    const [en, tr, mob] = await Promise.all([
      supabase.from("student_enrollment").select("student_id, students(full_name, national_id), classes!inner(grade, class_no, academic_year)")
        .eq("status", "active").eq("classes.grade", MAWHIBA.grade).eq("classes.academic_year", y),
      supabase.from("mawhiba_tracking").select("*").eq("academic_year", y),
      supabase.rpc("gifted_roster", { p_grade: MAWHIBA.grade }),
    ]);
    if (tr.error) setErr(/mawhiba|schema cache|relation/i.test(tr.error.message) ? "الصفحة تحتاج تشغيل supabase/gifted_1.sql مرة واحدة في Supabase ← SQL Editor." : tr.error.message);
    const T = Object.fromEntries((tr.data ?? []).map((r) => [r.student_id, r]));
    const G = Object.fromEntries((mob.data ?? []).map((r) => [r.student_id, r.mobile]));
    setRows((en.data ?? []).map((r) => ({
      id: r.student_id, name: r.students?.full_name ?? "—", full_name: r.students?.full_name ?? "", national_id: r.students?.national_id,
      grade: r.classes?.grade, class_no: r.classes?.class_no, guardian: G[r.student_id] ?? null,
      status: "none", ...(T[r.student_id] ?? {}),
    })).sort(byClassName()));
    setSel(new Set());
  };
  useEffect(() => { load(); }, []);

  const classes = useMemo(() => [...new Set((rows ?? []).map((r) => r.class_no))].sort((a, b) => a - b), [rows]);
  if (!rows) return <Loader />;

  const eligible = rows.filter((r) => r.status !== "prior");
  const statsOf = (list) => {
    const el = list.filter((r) => r.status !== "prior");
    return { total: list.length, el: el.length, reg: el.filter((r) => reached(r.status, "registered")).length,
             conf: el.filter((r) => reached(r.status, "confirmed")).length, test: el.filter((r) => reached(r.status, "tested")).length,
             gifted: el.filter((r) => r.status === "gifted").length };
  };
  const S = statsOf(rows);
  const shown = rows.filter((r) => (cls === "all" || r.class_no === Number(cls)) && (st === "all" || r.status === st)
    && (!q.trim() || r.full_name.includes(q.trim()) || (r.national_id ?? "").includes(q.trim())));
  const today = todayISO();
  const regLeft = daysTo(MAWHIBA.regTo);

  const save = async (ids, patch) => {
    setBusy(true); setErr("");
    const { error } = await supabase.from("mawhiba_tracking").upsert(ids.map((id) => {
      const cur = rows.find((r) => r.id === id);
      return { student_id: id, academic_year: year, status: cur.status, pay: cur.pay ?? null, test_date: cur.test_date ?? null,
               test_center: cur.test_center ?? null, score: cur.score ?? null, note: cur.note ?? null, student_mobile: cur.student_mobile ?? null,
               ...patch, updated_by_name: profile?.full_name ?? null, updated_at: new Date().toISOString() };
    }), { onConflict: "student_id,academic_year" });
    setBusy(false);
    if (error) { setErr(error.message); return false; }
    await load(); return true;
  };

  const print = () => {
    const body = rows.map((r, i) => `<tr><td>${i + 1}</td><td>${e(r.name)}</td><td>${e(r.class_no)}</td><td>${e(STATUS[r.status]?.t)}</td>
      <td>${e(r.pay ? PAY[r.pay] : "—")}</td><td>${e(r.test_date ? fmtDate(r.test_date + "T12:00:00") : "—")}</td><td>${e(r.score ?? "—")}</td></tr>`).join("");
    const html = `<table class="kv"><tr><th>البرنامج</th><td>البرنامج الوطني للكشف عن الموهوبين — النسخة ${e(MAWHIBA.edition)}</td></tr>
      <tr><th>الصف</th><td>الأول الثانوي (${e(S.total)} طالبًا، منهم ${e(S.total - S.el)} اختُبروا سابقًا)</td></tr>
      <tr><th>المؤشرات</th><td>سجّل ${e(S.reg)} (${pct(S.reg, S.el)}%) · أكّد ${e(S.conf)} · اختُبر ${e(S.test)} · موهوب ${e(S.gifted)}</td></tr></table>
      <table><thead><tr><th>م</th><th>الطالب</th><th>الفصل</th><th>الحالة</th><th>الرسوم</th><th>موعد المقياس</th><th>الدرجة</th></tr></thead><tbody>${body}</tbody></table>`;
    printReport({ title: "متابعة مقياس موهبة", sections: [{ title: "متابعة البرنامج الوطني للكشف عن الموهوبين", subtitle: "طلاب الأول الثانوي", html }],
      ...logos(), signatures: [{ title: "مسؤول برنامج الموهوبين", name: (ROLE_PERSON_NAME.gifted_program ?? "").replace(/^الأستاذ:\s*/, "") }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }] });
  };

  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {/* البرنامج ومواعيده */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-l from-[#F3ECFA] to-paper px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-ink">البرنامج الوطني للكشف عن الموهوبين · النسخة {MAWHIBA.edition}</p>
            <p className="text-xs text-muted">مقياس موهبة للقدرات العقلية المتعددة · المستوى الثالث (الأول الثانوي)، ويُدخل مرة واحدة في المستوى</p>
          </div>
          <a href={MAWHIBA.url} target="_blank" rel="noopener noreferrer" className="btn-ghost px-4 py-1.5 text-xs">منصة موهبة ←</a>
        </div>
        <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {[["التسجيل", span(MAWHIBA.regFrom, MAWHIBA.regTo),
              today > MAWHIBA.regTo ? "أُغلق التسجيل" : regLeft >= 0 ? `يغلق بعد ${regLeft} يومًا` : ""],
            ["تطبيق المقياس", span(MAWHIBA.testFrom, MAWHIBA.testTo), "حضوريًا في مراكز قياس"],
            ["الرسوم", `${MAWHIBA.fee} ريال`, "مجانًا للترشيح المدعوم"]].map(([t, v, s]) => (
            <div key={t} className="bg-paper px-4 py-2.5">
              <p className="text-[11px] text-muted">{t}</p>
              <p className="num text-[13px] font-semibold text-ink">{v}</p>
              {s && <p className={`text-[11px] ${t === "التسجيل" && regLeft <= 14 && today <= MAWHIBA.regTo ? "font-bold text-absent" : "text-faint"}`}>{s}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* المؤشرات */}
      <section className="card p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[["طلاب الأول الثانوي", S.total, `${S.el} مؤهل`], ["سجّلوا", S.reg, `${pct(S.reg, S.el)}%`], ["أكّدوا الحضور", S.conf, `${pct(S.conf, S.el)}%`],
            ["اختُبروا", S.test, `${pct(S.test, S.el)}%`], ["موهوبون", S.gifted, S.test ? `${pct(S.gifted, S.test)}% من المختبرين` : "—"]].map(([t, v, s]) => (
            <div key={t} className="rounded-sm2 bg-canvas px-3 py-2 text-center">
              <p className="num text-xl font-bold text-ink">{v}</p><p className="text-[11px] text-muted">{t}</p><p className="num text-[10.5px] text-faint">{s}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-canvas">
          {FLOW.map((k) => { const n = rows.filter((r) => r.status === k).length; return n ? <div key={k} title={`${STATUS[k].t}: ${n}`} style={{ width: `${pct(n, rows.length)}%`, background: STATUS[k].bar }} /> : null; })}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="text-right text-[11px] text-muted"><th className="p-1.5">الفصل</th><th className="p-1.5 text-center">الطلاب</th><th className="p-1.5 text-center">سجّلوا</th>
              <th className="p-1.5 text-center">أكّدوا</th><th className="p-1.5 text-center">اختُبروا</th><th className="p-1.5 text-center">موهوبون</th></tr></thead>
            <tbody className="divide-y divide-line/60">
              {classes.map((c) => { const s = statsOf(rows.filter((r) => r.class_no === c)); return (
                <tr key={c}><td className="p-1.5 font-semibold text-ink">الأول / {c}</td><td className="num p-1.5 text-center">{s.total}</td>
                  <td className={`num p-1.5 text-center font-bold ${pct(s.reg, s.el) >= 70 ? "text-present" : pct(s.reg, s.el) >= 40 ? "text-late" : "text-absent"}`}>{s.reg} <span className="text-[10px] font-normal text-muted">({pct(s.reg, s.el)}%)</span></td>
                  <td className="num p-1.5 text-center">{s.conf}</td><td className="num p-1.5 text-center">{s.test}</td><td className="num p-1.5 text-center">{s.gifted}</td></tr>
              ); })}
            </tbody>
          </table>
        </div>
      </section>

      {/* التصفية والتحديث الجماعي */}
      <section className="card space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <select className="field w-auto" value={cls} onChange={(x) => setCls(x.target.value)}>
            <option value="all">كل الفصول</option>{classes.map((c) => <option key={c} value={c}>الأول / {c}</option>)}
          </select>
          <input className="field min-w-0 flex-1" value={q} onChange={(x) => setQ(x.target.value)} placeholder="بحث بالاسم أو الهوية" />
          <button className="btn-ghost px-4 text-xs" onClick={print}>طباعة الكشف</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", ...FLOW].map((k) => {
            const n = k === "all" ? rows.length : rows.filter((r) => r.status === k).length;
            return (k === "all" || n > 0) && (
              <button key={k} onClick={() => setSt(k)} className={`rounded-pill px-3 py-1 text-xs font-medium ${st === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>
                {k === "all" ? "الكل" : STATUS[k].t} <span className="num">({n})</span></button>
            );
          })}
        </div>
        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-sm2 bg-mint-tint/50 px-3 py-2 text-xs">
            <span className="font-semibold text-ink">تحديد {sel.size}:</span>
            {["registered", "confirmed", "tested", "prior", "none"].map((k) => (
              <button key={k} disabled={busy} className="rounded-pill border border-line bg-white px-3 py-1 font-semibold text-ink" onClick={() => save([...sel], { status: k })}>{STATUS[k].t}</button>
            ))}
            <button className="text-muted underline" onClick={() => setSel(new Set())}>إلغاء</button>
          </div>
        )}
      </section>

      <section className="card divide-y divide-line">
        <label className="flex items-center gap-2 px-4 py-2 text-xs text-muted">
          <input type="checkbox" checked={shown.length > 0 && shown.every((r) => sel.has(r.id))}
                 onChange={(x) => setSel(x.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} />
          تحديد الظاهرين ({shown.length})
        </label>
        {shown.map((r) => (
          <div key={r.id} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.name} <span className="text-[11px] font-normal text-muted">· الأول / {r.class_no}</span></p>
                <p className="text-[11px] text-muted">
                  <span className={`chip ${STATUS[r.status].c}`}>{STATUS[r.status].t}</span>
                  {r.pay && <> · {PAY[r.pay]}</>}
                  {r.test_date && <> · <span className="num">{fmtDate(r.test_date + "T12:00:00")}</span>{r.test_center && ` · ${r.test_center}`}</>}
                  {r.score != null && <> · الدرجة <span className="num">{r.score}</span></>}
                </p>
              </div>
              <Wa mobile={r.student_mobile} text={waText(r, false)} label="الطالب" />
              <Wa mobile={r.guardian} text={waText(r, true)} label="ولي الأمر" />
              <button className="text-xs font-semibold text-mint-deep underline" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "إغلاق" : "تحديث"}</button>
            </div>
            {open === r.id && <Editor r={r} busy={busy} onSave={async (patch) => { if (await save([r.id], patch)) setOpen(null); }} />}
          </div>
        ))}
        {!shown.length && <p className="px-4 py-6 text-center text-sm text-muted">{rows.length ? "لا طلاب بهذه التصفية." : "لا طلاب في الأول الثانوي للعام الحالي."}</p>}
      </section>
    </div>
  );
}

function Editor({ r, busy, onSave }) {
  const [f, setF] = useState({ status: r.status, pay: r.pay ?? "", test_date: r.test_date ?? "", test_center: r.test_center ?? "",
                               score: r.score ?? "", note: r.note ?? "", mobile: localMobile(r.student_mobile) });
  const [bad, setBad] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const late = ["confirmed", "tested", "gifted", "not_gifted"].includes(f.status);
  const submit = () => {
    const mobile = f.mobile.trim() ? cleanMobile(f.mobile.trim()) : null;
    if (f.mobile.trim() && !mobile) { setBad("رقم الجوال غير صحيح؛ اكتبه بصيغة 05XXXXXXXX."); return; }
    onSave({ status: f.status, pay: late ? f.pay || null : null, test_date: f.test_date || null, test_center: f.test_center.trim() || null,
             score: f.score === "" ? null : Number(f.score), note: f.note.trim() || null, student_mobile: mobile });
  };
  return (
    <div className="mt-2 space-y-2 rounded-sm2 border border-line bg-canvas p-3">
      <div className="flex flex-wrap gap-1.5">
        {FLOW.map((k) => (
          <button key={k} onClick={() => set("status", k)} className={`rounded-pill px-3 py-1 text-xs font-semibold ${f.status === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{STATUS[k].t}</button>
        ))}
      </div>
      {late && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(PAY).map(([k, t]) => (
            <button key={k} onClick={() => set("pay", f.pay === k ? "" : k)} className={`rounded-pill px-3 py-1 text-xs ${f.pay === k ? "bg-late text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-[11px] text-muted">موعد المقياس<input type="date" className="field num mt-0.5" value={f.test_date} min={MAWHIBA.testFrom} onChange={(x) => set("test_date", x.target.value)} /></label>
        <label className="text-[11px] text-muted sm:col-span-2">مركز قياس<input className="field mt-0.5" value={f.test_center} onChange={(x) => set("test_center", x.target.value)} placeholder="مثل: مركز قياس بمكة المكرمة" /></label>
        <label className="text-[11px] text-muted">الدرجة<input className="field num mt-0.5" inputMode="decimal" value={f.score} onChange={(x) => set("score", x.target.value.replace(/[^\d.]/g, ""))} /></label>
        <label className="text-[11px] text-muted">جوال الطالب<input className="field num mt-0.5" dir="ltr" inputMode="tel" value={f.mobile} placeholder="05XXXXXXXX" onChange={(x) => set("mobile", x.target.value)} /></label>
        <label className="text-[11px] text-muted sm:col-span-3">ملاحظة<input className="field mt-0.5" value={f.note} onChange={(x) => set("note", x.target.value)} placeholder="مثل: يحتاج مساعدة في السداد، أو تواصلنا مع ولي الأمر" /></label>
      </div>
      {bad && <p className="text-xs text-absent">{bad}</p>}
      <button className="btn-primary px-5 py-1.5 text-xs" disabled={busy} onClick={submit}>{busy ? "…" : "حفظ"}</button>
    </div>
  );
}
