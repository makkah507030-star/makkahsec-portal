// src/pages/accreditation/AccNational.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { ACC_BUCKET, DOMAIN_COLOR, INDICATORS, accUpload, bidi, levelOf, fmtPct } from "../../lib/accreditation.js";
import { NAT_TESTS, NAT_BANDS, NAT_PROPOSALS, loadNational, natSeries, signed } from "../../lib/accNational.js";
import AccViewer from "./AccViewer.jsx";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   الاختبارات الوطنية (supabase/acc_5.sql): بطاقة لكل اختبار بآخر عام: المتوسط والتغير، والتوزيع
   على المستويات، والمقارنة بالإدارة والمملكة، والترتيب، والمجالات الفرعية، وقياس التقدم عن خط
   الأساس (العام المعلَّم، 1447هـ) للمؤشرين المستحدثين، والأعوام السابقة تاريخ. يُدخل مشرف اللجنة كل عام مرة ويرفق ملف الهيئة، فيُرفع
   الملف شاهدًا للمؤشرين. وتحتها اقتراح تحديث برامج 3-1-1-1 إلى 3-1-1-4 يعتمده المشرف.
   ===================================================================== */

const C3 = DOMAIN_COLOR[3];
const dColor = (v) => (v == null ? "rgb(var(--c-muted))" : v > 0 ? "rgb(var(--c-present))" : v < 0 ? "rgb(var(--c-absent))" : "rgb(var(--c-muted))");

export default function AccNational({ me, year, plans }) {
  const { profile } = useSession();
  const [msg, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);       // صف يُعدَّل أو { test } جديد
  const [view, setView] = useState(null);
  const load = () => loadNational().then(({ rows: r, error }) => {
    setErr(error ? (/acc_national|schema cache|does not exist/.test(error.message) ? "تحتاج تشغيل supabase/acc_5.sql في Supabase ← SQL Editor." : error.message) : "");
    setRows(r);
  });
  useEffect(() => { load(); }, []);
  if (!rows) return <Loader />;

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        بطاقات القدرات والتحصيلي من هيئة تقويم التعليم والتدريب: تُدخل أرقام كل عام مرة واحدة ويُرفق ملف الهيئة، فتظهر في لوحة الأداء
        وتقرير مجال نواتج التعلم، ويُقاس بها تقدم المؤشرين المستحدثين <b className="num text-ink">3-1-1-3</b> و<b className="num text-ink">3-1-1-4</b> قياسًا على عام خط الأساس (1447هـ ما لم يُغيَّر)، وتظهر الأعوام السابقة تاريخًا بفرق كل عام عن سابقه.
      </p>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}
      {form ? <NatForm row={form} year={year} by={profile?.full_name} setMsg={setMsg} onDone={(ok) => { setForm(null); if (ok) load(); }} /> : <>
        {me.coord && !err && <div className="flex flex-wrap gap-2">{Object.entries(NAT_TESTS).map(([k, t]) => (
          <button key={k} className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep" onClick={() => setForm({ test: k })}>+ بطاقة {t.t} لعام جديد</button>))}</div>}
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.keys(NAT_TESTS).map((k) => <NatCard key={k} test={k} series={natSeries(rows, k)} me={me} onEdit={setForm} onView={setView} />)}
        </div>
        {!err && <Proposals me={me} plans={plans} by={profile?.full_name} setMsg={setMsg} />}
      </>}
      {view && <AccViewer ev={view} color={C3} onClose={() => setView(null)} />}
    </div>
  );
}

/* بطاقة اختبار: آخر عام، وتحته جدول الأعوام إن تعددت */
export function NatCard({ test, series, me, onEdit, onView, compact }) {
  const T = NAT_TESTS[test];
  const [pick, setPick] = useState(null);
  const r = series.find((x) => x.academic_year === pick) ?? series[series.length - 1];
  if (!r) return (
    <section className="card p-5 text-sm text-muted"><b className="block text-ink">{T.full}</b>لم تُدخل بطاقة بعد.</section>
  );
  const cmp = [["المدرسة", r.school_avg ?? r.avg, C3], ["الإدارة", r.district_avg, "#7C8796"], ["المملكة", r.kingdom_avg, "#A9B1BC"]].filter((x) => x[1] != null);
  const lo = Math.floor(Math.min(...cmp.map((x) => x[1])) - 3), hi = Math.ceil(Math.max(...cmp.map((x) => x[1])) + 1);
  const w = (v) => `${Math.max(4, ((v - lo) / (hi - lo)) * 100)}%`;
  const base = series.find((x) => x.isBase);

  return (
    <section className="card overflow-hidden" style={{ borderTop: `4px solid ${C3}` }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="flex-1 text-sm font-bold text-ink">{T.full}</h2>
        {series.length > 1 && series.map((x) => (
          <button key={x.academic_year} onClick={() => setPick(x.academic_year)} className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold ${x === r ? "text-white" : "border border-line text-muted"}`} style={x === r ? { background: C3 } : undefined}><span className="num">{x.academic_year}</span>هـ</button>))}
        {series.length === 1 && <span className="text-xs font-semibold" style={{ color: C3 }}><span className="num">{r.academic_year}</span>هـ</span>}
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Fig v={r.avg} t="متوسط الدرجات" c={C3} big />
          {r.change_pct != null || r.dPrev == null ? <Fig v={r.change_pct == null ? "—" : `${signed(r.change_pct)}%`} t="التغير عن العام السابق" c={dColor(r.change_pct)} />
            : <Fig v={signed(r.dPrev)} t="عن العام السابق (نقطة)" c={dColor(r.dPrev)} />}
          <Fig v={r.takers ?? "—"} t="المختبرون" />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">التوزيع على المستويات</p>
          <div className="flex h-7 overflow-hidden rounded-sm2 text-[11px] font-bold text-white">
            {NAT_BANDS.map((b) => r[b.k] ? <span key={b.k} className="num grid place-items-center" style={{ width: `${r[b.k]}%`, background: b.c }}>{r[b.k]}%</span> : null)}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] text-muted">
            {NAT_BANDS.map((b) => <span key={b.k}><i className="me-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: b.c }} />{b.t} ({b.s})</span>)}
          </div>
        </div>

        {cmp.length > 1 && <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">المتوسط مقارنةً بالإدارة والمملكة</p>
          <div className="space-y-1">{cmp.map(([t, v, c]) => (
            <div key={t} className="flex items-center gap-2 text-xs"><span className="w-14 text-muted">{t}</span>
              <span className="relative h-4 flex-1 rounded-pill bg-canvas"><span className="absolute inset-y-0 start-0 rounded-pill" style={{ width: w(v), background: c }} /></span>
              <b className="num w-12 text-end text-ink">{v}</b></div>))}</div>
        </div>}

        {(r.kingdom_above != null || r.district_above != null) && <div className="grid gap-2 sm:grid-cols-2">
          {[["المملكة", r.kingdom_above, r.kingdom_rank, r.kingdom_total], ["الإدارة", r.district_above, r.district_rank, r.district_total]].filter((x) => x[1] != null).map(([t, a, k, n]) => (
            <div key={t} className="rounded-sm2 bg-canvas px-3 py-2"><p className="text-[11px] text-muted">الترتيب في {t}</p>
              <p className="text-sm text-ink">أعلى من <b className="num" style={{ color: C3 }}>{a}%</b> من المدارس</p>
              {k && <p className="text-[10.5px] text-faint"><span className="num">{k}</span> من <span className="num">{n}</span></p>}</div>))}
        </div>}

        {r.subs?.length > 0 && <div>
          <p className="mb-1.5 text-xs font-semibold text-ink">المجالات الفرعية {r.subs_estimated && <span className="font-normal text-faint">— تقديرية من أطوال الأشرطة في البطاقة</span>}</p>
          <div className="space-y-1">{[...r.subs].sort((a, b) => a.v - b.v).map((s, i) => (
            <div key={s.t} className="flex items-center gap-2 text-xs"><span className="w-20 text-muted">{s.t}</span>
              <span className="h-3 flex-1 rounded-pill bg-canvas"><span className="block h-full rounded-pill" style={{ width: `${s.v}%`, background: i === 0 && r.subs.length > 2 ? "rgb(var(--c-absent))" : C3 }} /></span>
              <b className="num w-12 text-end text-ink">{r.subs_estimated ? "≈" : ""}{s.v}</b></div>))}</div>
        </div>}

        <div className="rounded-sm2 px-3 py-2 text-xs" style={{ background: `${C3}12`, color: C3 }}>
          <b className="num">{T.growth}</b> {INDICATORS[T.growth].replace("يحقق المتعلمون ", "")}{" "}
          {r.isBase ? <>هذا العام <b>خط الأساس</b>: المتوسط <b className="num">{r.avg}</b>{r.high_pct != null && <>، والمرتفع <b className="num">{r.high_pct}%</b>، ودون 65 <b className="num">{r.low_pct ?? "—"}%</b></>}{r.dPrev != null && <>، وعن العام السابق <b className="num" style={{ color: dColor(r.dPrev) }}>{signed(r.dPrev)}</b></>}.</>
            : r.beforeBase ? <>عام سابق لخط الأساس ({base.academic_year}هـ){r.dPrev != null && <>، والمتوسط عن العام الذي قبله <b className="num" style={{ color: dColor(r.dPrev) }}>{signed(r.dPrev)}</b></>}.</>
            : <>المتوسط <b className="num" style={{ color: dColor(r.dBase) }}>{signed(r.dBase)}</b> عن خط الأساس ({base.academic_year}هـ: <span className="num">{base.avg}</span>)، و<b className="num" style={{ color: dColor(r.dPrev) }}>{signed(r.dPrev)}</b> عن العام السابق
              {r.dHigh != null && <>، والمرتفع <b className="num" style={{ color: dColor(r.dHigh) }}>{signed(r.dHigh)}</b>، ودون 65 <b className="num" style={{ color: dColor(r.dLow == null ? null : -r.dLow) }}>{signed(r.dLow)}</b> نقطة</>}.</>}
        </div>

        {series.length > 1 && <Trend series={series} />}
        {!compact && series.length > 1 && <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-xs">
          <thead className="bg-canvas text-muted"><tr>{["العام", "المتوسط", "عن السابق", "عن خط الأساس", "مرتفع", "دون 65"].map((h) => <th key={h} className="px-2 py-1.5 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{series.map((x) => (
            <tr key={x.id}><td className="px-2 py-1.5"><span className="num">{x.academic_year}</span>{x.isBase && <span className="text-faint"> (الأساس)</span>}</td><td className="num px-2 py-1.5 font-semibold">{x.avg}</td>
              <td className="num px-2 py-1.5" style={{ color: dColor(x.dPrev) }}>{signed(x.dPrev)}</td><td className="num px-2 py-1.5" style={{ color: dColor(x.dBase) }}>{signed(x.dBase)}</td>
              <td className="num px-2 py-1.5">{fmtPct(x.high_pct)}</td><td className="num px-2 py-1.5">{fmtPct(x.low_pct)}</td></tr>))}</tbody>
        </table></div>}

        {!compact && <div className="flex flex-wrap items-center gap-3 text-xs">
          {r.file_path ? <button className="font-semibold text-mint-deep" onClick={() => onView({ file_path: r.file_path, code: T.level, title: `بطاقة ${T.t} ${r.academic_year}هـ` })}>عرض بطاقة الهيئة</button>
            : <span className="text-faint">لم يُرفق ملف الهيئة بعد</span>}
          {me.coord && <button className="font-semibold text-mint-deep" onClick={() => onEdit(r)}>تعديل{r.file_path ? "" : " وإرفاق الملف"}</button>}
          {r.notes && <span className="basis-full text-faint">{bidi(r.notes)}</span>}
        </div>}
      </div>
    </section>
  );
}

/* المتوسط عبر الأعوام: عمود لكل عام، وخط الأساس بإطار */
function Trend({ series }) {
  const v = series.map((x) => x.avg).filter((a) => a != null);
  const lo = Math.floor(Math.min(...v) - 2), hi = Math.ceil(Math.max(...v) + 1);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink">المتوسط عبر الأعوام</p>
      <div className="flex h-28 items-end gap-2">{series.map((x) => (
        <div key={x.id} className="flex flex-1 flex-col items-center gap-1">
          <span className="num text-[10.5px] font-bold text-ink">{x.avg ?? "—"}</span>
          <span className="w-full max-w-12 rounded-t-sm2" style={{ height: `${x.avg == null ? 0 : Math.max(6, ((x.avg - lo) / (hi - lo)) * 72)}px`,
            background: x.isBase ? C3 : x.beforeBase ? "#C9CED6" : `${C3}AA`, outline: x.isBase ? `2px solid ${C3}` : undefined, outlineOffset: 2 }} />
          <span className="text-[10.5px] text-muted"><span className="num">{x.academic_year}</span>{x.isBase && " · الأساس"}</span>
        </div>))}</div>
    </div>
  );
}

function Fig({ v, t, c, big }) {
  return (
    <div className="rounded-sm2 bg-canvas px-2 py-2">
      <p className={`num font-bold leading-tight ${big ? "text-3xl" : "text-xl"}`} style={{ color: c ?? "rgb(var(--c-ink))" }}>{v ?? "—"}</p>
      <p className="text-[11px] text-muted">{t}</p>
    </div>
  );
}

const NUMS = [
  ["takers", "المختبرون"], ["avg", "متوسط الدرجات"], ["change_pct", "التغير عن العام السابق %"],
  ["high_pct", "مرتفع (75 فأكثر) %"], ["mid_pct", "متوسط (65–75) %"], ["low_pct", "منخفض ومنخفض جدًا (دون 65) %"],
  ["school_avg", "متوسط المدرسة في المقارنة"], ["district_avg", "متوسط الإدارة"], ["kingdom_avg", "متوسط المملكة"],
  ["kingdom_above", "أعلى من % من مدارس المملكة"], ["kingdom_rank", "الترتيب في المملكة"], ["kingdom_total", "من مدارس المملكة"],
  ["district_above", "أعلى من % من مدارس الإدارة"], ["district_rank", "الترتيب في الإدارة"], ["district_total", "من مدارس الإدارة"],
];
// عنوان شاهد البطاقة كما في الشواهد المطلوبة ببرامج الخطة المقترحة
const evTitles = (T, y, isBase) => [[T.level, `بطاقة ${T.t === "القدرات العامة" ? "القدرات" : T.t} ${y}هـ من الهيئة وتحليلها`],
  [T.growth, `بطاقة ${T.t === "القدرات العامة" ? "القدرات" : T.t} ${y}هـ ${isBase ? "(خط الأساس)" : "ومقارنتها بخط الأساس"}`]];

function NatForm({ row, year, by, setMsg, onDone }) {
  const T = NAT_TESTS[row.test];
  const isNew = !row.id;
  const [x, setX] = useState(() => ({ ...Object.fromEntries(NUMS.map(([k]) => [k, row[k] ?? ""])), academic_year: row.academic_year ?? year,
    subs: (row.subs ?? []).map((s) => `${s.t}: ${s.v}`).join("\n"), subs_estimated: row.subs_estimated ?? false, notes: row.notes ?? "", baseline: row.baseline ?? false }));
  const [file, setFile] = useState(null);
  const [asEv, setAsEv] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setX((o) => ({ ...o, [k]: e.target.value }));
  const num = (v) => (String(v).trim() === "" ? null : Number(String(v).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[%+،,\s]/g, "")));

  const save = async () => {
    if (!/^\d{4}$/.test(x.academic_year.trim())) { setMsg({ ok: false, text: "اكتب العام الدراسي بأربعة أرقام، مثل 1448." }); return; }
    const vals = Object.fromEntries(NUMS.map(([k]) => [k, num(x[k])]));
    if (Object.values(vals).some((v) => v != null && !Number.isFinite(v))) { setMsg({ ok: false, text: "بعض الحقول ليست أرقامًا." }); return; }
    if (vals.avg == null) { setMsg({ ok: false, text: "متوسط الدرجات مطلوب." }); return; }
    const subs = x.subs.split("\n").map((l) => l.split(/[:：]/)).filter((p) => p.length === 2 && p[0].trim() && Number.isFinite(num(p[1])))
      .map(([t, v]) => ({ t: t.trim(), v: num(v) }));
    setBusy(true);
    let file_path = row.file_path ?? null;
    if (file) {
      const up = await accUpload("reports/national", file);
      if (up.error) { setBusy(false); setMsg({ ok: false, text: up.error.message }); return; }
      file_path = up.path;
    }
    const payload = { ...vals, test: row.test, academic_year: x.academic_year.trim(), subs, subs_estimated: x.subs_estimated, baseline: x.baseline,
      notes: x.notes.trim() || null, file_path, updated_at: new Date().toISOString(), ...(isNew ? { created_by_name: by ?? null } : {}) };
    const q = isNew ? supabase.from("acc_national").insert(payload) : supabase.from("acc_national").update(payload).eq("id", row.id);
    const { error } = await q;
    // خط الأساس عام واحد لكل اختبار
    if (!error && x.baseline) await supabase.from("acc_national").update({ baseline: false }).eq("test", row.test).neq("academic_year", payload.academic_year);
    if (error) { setBusy(false); setMsg({ ok: false, text: /duplicate|unique/.test(error.message) ? `بطاقة ${T.t} لعام ${payload.academic_year} مُدخلة من قبل؛ عدّلها بدل إضافتها.` : error.message }); return; }
    if (file && row.file_path) supabase.storage.from(ACC_BUCKET).remove([row.file_path]);
    // رفع البطاقة شاهدًا لمؤشري الاختبار بنسخة لكل مؤشر، فحذف أحد الشاهدين لا يحذف ملف البطاقة
    let added = 0;
    if (file && asEv) {
      const { data: all } = await supabase.from("acc_national").select("academic_year, baseline").eq("test", row.test).order("academic_year");
      const first = (all ?? []).find((a) => a.baseline) ?? all?.[0];
      const { data: have } = await supabase.from("acc_evidence").select("code, title").in("code", [T.level, T.growth]);
      for (const [code, title] of evTitles(T, payload.academic_year, first?.academic_year === payload.academic_year)) {
        if ((have ?? []).some((e) => e.code === code && e.title.trim() === title)) continue;
        const up = await accUpload(code, file);
        if (up.error) continue;
        const { error: e2 } = await supabase.from("acc_evidence").insert({ code, academic_year: payload.academic_year, title, file_path: up.path, created_by_name: by ?? null });
        if (!e2) added++;
      }
    }
    setBusy(false);
    setMsg({ ok: true, text: `حُفظت بطاقة ${T.t} ${payload.academic_year}هـ${added ? `، ورُفعت شاهدًا لـ ${added === 2 ? "المؤشرين" : "مؤشر واحد"}` : ""}.` });
    onDone(true);
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف بطاقة ${T.t} ${row.academic_year}هـ`, impact: ["تُحذف أرقامها وملفها من القسم، وتبقى الشواهد المرفوعة منها."], confirmLabel: "حذف" }))) return;
    if (row.file_path) await supabase.storage.from(ACC_BUCKET).remove([row.file_path]);
    const { error } = await supabase.from("acc_national").delete().eq("id", row.id);
    if (error) setMsg({ ok: false, text: error.message }); else onDone(true);
  };

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-sm font-bold text-ink">{isNew ? "بطاقة جديدة" : "تعديل بطاقة"}: {T.full}</h2>
        <label className="text-[11.5px] text-muted">العام الدراسي <input className="field num ms-1 w-24 text-sm" dir="ltr" value={x.academic_year} onChange={set("academic_year")} /></label>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NUMS.map(([k, t]) => <label key={k} className="text-[11.5px] text-muted">{t}<input className="field num mt-1 w-full text-sm" dir="ltr" inputMode="decimal" value={x[k]} onChange={set(k)} /></label>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[11.5px] text-muted">المجالات الفرعية (سطر لكل مجال: المادة: الدرجة)
          <textarea className="field mt-1 h-28 w-full text-sm" value={x.subs} onChange={set("subs")} placeholder={"الرياضيات: 45\nالكيمياء: 46"} />
          <span className="mt-1 flex items-center gap-1.5"><input type="checkbox" checked={x.subs_estimated} onChange={(e) => setX({ ...x, subs_estimated: e.target.checked })} />القيم تقديرية من أطوال الأشرطة (البطاقة لا تكتب أرقامها)</span>
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={x.baseline} onChange={(e) => setX({ ...x, baseline: e.target.checked })} />
            هذا العام خط الأساس للمؤشر <span className="num">{T.growth}</span> (يُقاس التقدم بعده عليه)</label>
          <label className="block text-[11.5px] text-muted">ملاحظات<textarea className="field mt-1 h-16 w-full text-sm" value={x.notes} onChange={set("notes")} /></label>
          <label className="block text-[11.5px] text-muted">ملف بطاقة الهيئة (PDF أو صورة){row.file_path && " — يستبدل الملف الحالي"}
            <input type="file" accept=".pdf,image/*" className="mt-1 block text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          {file && <label className="flex items-center gap-1.5 text-[11.5px] text-ink"><input type="checkbox" checked={asEv} onChange={(e) => setAsEv(e.target.checked)} />
            رفعه شاهدًا للمؤشرين <span className="num">{T.level}</span> و<span className="num">{T.growth}</span></label>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={save}>{busy ? "…" : "حفظ"}</button>
        <button className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted" onClick={() => onDone(false)}>إلغاء</button>
        {!isNew && <button className="ms-auto text-xs text-absent" onClick={remove}>حذف البطاقة</button>}
      </div>
    </section>
  );
}

/* اقتراح تحديث برامج 3-1-1-1 إلى 3-1-1-4: البرنامج الحالي والمقترح، ويعتمده مشرف اللجنة */
function Proposals({ me, plans, by, setMsg }) {
  const plan = plans.find((p) => p.status === "active") ?? plans.find((p) => p.status === "draft");
  const [progs, setProgs] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const codes = Object.keys(NAT_PROPOSALS);
  const load = () => (plan ? supabase.from("acc_programs").select("*").eq("plan_id", plan.id).in("code", codes).then(({ data }) => setProgs(data ?? [])) : setProgs([]));
  useEffect(() => { load(); }, [plan?.id]);   // eslint-disable-line react-hooks/exhaustive-deps
  const by_ = useMemo(() => Object.fromEntries((progs ?? []).map((p) => [p.code, p])), [progs]);
  if (!progs) return null;

  const apply = async (code) => {
    const P = NAT_PROPOSALS[code], p = by_[code];
    if (!(await confirmDanger({ title: bidi(`اعتماد المقترح لبرنامج ${code}`), impact: ["يُستبدل اسم البرنامج وفريقه وبنوده وشواهده المطلوبة ومؤشر قياسه وتوصياته بالمقترح.", "تبقى نسبته الحالية والمستهدفة، وإنجاز البنود المتطابقة نصًا."], confirmLabel: "اعتماد" }))) return;
    setBusy(code);
    const old = new Map((p?.methods ?? []).map((m) => [m.t, m]));
    const body = { initiative: P.initiative, team: P.team, methods: P.methods.map((t) => old.get(t) ?? { t }), evidence: P.evidence,
      measure: P.measure, rec: P.rec, updated_by_name: by ?? null, updated_at: new Date().toISOString() };
    const { error } = p ? await supabase.from("acc_programs").update(body).eq("id", p.id)
      : await supabase.from("acc_programs").insert({ ...body, plan_id: plan.id, kind: "plan", code, target: 75, follow: "فريق التقويم الذاتي", sort: 10 + codes.indexOf(code) });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: bidi(`اعتُمد المقترح لبرنامج ${code}، ويُعدَّل متى شئتم من «خطة التحسين ← تعديل البرنامج».`) });
    load();
  };

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-bold text-ink">اقتراح تحديث برامج المؤشرات <span className="num">3-1-1-1</span> إلى <span className="num">3-1-1-4</span></h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
          البرامج الحالية موجهة إلى القراءة والرياضيات العامة، والمؤشرات تقيس التحصيلي والقدرات. المقترح مبني على بطاقات 1447هـ:
          أضعف مجالات التحصيلي الرياضيات ثم الكيمياء والفيزياء، ونحو 64% في التحصيلي و61% في القدرات دون 65.
          {!plan && " لا توجد خطة سارية أو مسودة لتحديثها."}
        </p>
      </div>
      <div className="divide-y divide-line/70">{codes.map((code) => {
        const P = NAT_PROPOSALS[code], p = by_[code], done = p?.initiative === P.initiative, on = open === code;
        return (
          <div key={code}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-start" onClick={() => setOpen(on ? null : code)}>
              <span className="num shrink-0 rounded-sm2 px-2 py-0.5 text-xs font-bold text-white" style={{ background: C3 }}>{code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-muted line-through decoration-faint">{!done && (p?.initiative ?? "لا برنامج له في الخطة")}</span>
                <span className="block text-sm font-semibold text-ink">{P.initiative}</span>
              </span>
              <span className={`shrink-0 rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${done ? "bg-present/10 text-present" : "bg-late/10 text-late"}`}>{done ? "معتمد" : "مقترح"}</span>
            </button>
            {on && <div className="space-y-3 border-t border-line/60 bg-canvas/40 px-4 py-3 text-sm">
              <p className="text-xs text-muted">الحالي <b className="num" style={{ color: levelOf(p?.current)?.c }}>{p?.current == null ? "مستحدث" : `${p.current}%`}</b> · المستهدف <b className="num text-ink">{fmtPct(p?.target ?? 75)}</b> · الفريق المقترح: {P.team.join("، ")}</p>
              <div><p className="mb-1 text-xs font-semibold text-mint-deep">البرامج وأساليب التنفيذ</p><ul className="list-disc space-y-0.5 ps-5 text-ink">{P.methods.map((m) => <li key={m}>{m}</li>)}</ul></div>
              <div><p className="mb-1 text-xs font-semibold text-mint-deep">الشواهد المطلوبة</p><ul className="list-disc space-y-0.5 ps-5 text-ink">{P.evidence.map((m) => <li key={m}>{m}</li>)}</ul></div>
              <div><p className="mb-1 text-xs font-semibold text-mint-deep">مؤشر القياس</p><p className="text-ink">{P.measure}</p></div>
              <div><p className="mb-1 text-xs font-semibold text-mint-deep">التوصيات</p><p className="leading-relaxed text-ink">{P.rec}</p></div>
              {me.coord && plan && !done && <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy === code} onClick={() => apply(code)}>{busy === code ? "…" : "اعتماد المقترح"}</button>}
            </div>}
          </div>
        );
      })}</div>
    </section>
  );
}
