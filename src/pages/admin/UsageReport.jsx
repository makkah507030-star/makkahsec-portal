// src/pages/admin/UsageReport.jsx
import { useEffect, useMemo, useState } from "react";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";
import { exportToExcel } from "../../lib/exportUtils";
import { fetchUsage, usageKey } from "../../lib/usage.js";
import { FORM_KINDS } from "../../components/BehaviorSheet.jsx";
import { TEMPLATES } from "../studio/templates";

/* =====================================================================
   إحصائية الاستخدام — للدعم الفني وحده.
   الأرقام من الدالة usage_report (supabase/usage_stats.sql)، وكل قائمة تُكمَّل
   بأسماء نماذجها المعروفة حتى يظهر ما لم يُستخدم أبدًا بصفر.
   ===================================================================== */

const PERIODS = [
  { key: "all", label: "كل الفترة", days: null },
  { key: "7", label: "آخر 7 أيام", days: 7 },
  { key: "30", label: "آخر 30 يومًا", days: 30 },
  { key: "90", label: "آخر 90 يومًا", days: 90 },
];

const sinceISO = (days) => { const d = new Date(); d.setDate(d.getDate() - days); d.setHours(0, 0, 0, 0); return d.toISOString(); };

const EMPTY = { uses: 0, users: 0, last_used: null, uses_30d: 0, prints: null };

function buildSections(rows) {
  const by = Object.fromEntries(rows.map((r) => [usageKey(r.category, r.item_key), r]));
  // العنوان من قائمة النماذج المعروفة، فيُكتب بعد صف العدّاد ليغلبه
  const pick = (cat, key, title) => {
    const r = by[usageKey(cat, key)] ?? EMPTY;
    return { ...EMPTY, ...r, cat, key, active: r.active ?? true, title };
  };
  return [
    { key: "form", title: "النماذج والشهادات", note: "من النماذج المُصدَرة (بأثر رجعي)", printsLabel: "طُبع",
      items: rows.filter((r) => r.category === "form").map((r) => pick("form", r.item_key, r.item_title ?? r.item_key)) },
    { key: "behavior", title: "نماذج السلوك والمواظبة", note: "من النماذج المُصدَرة (بأثر رجعي)",
      items: Object.entries(FORM_KINDS).map(([k, x]) => pick("behavior", k, x.title)) },
    { key: "student", title: "شؤون الطلاب", note: "الإحالة بأثر رجعي، والشهادة من تفعيل العداد", printsLabel: "طباعة",
      items: [pick("referral", "referral", "إحالة طالب"), pick("certificate", "student-certificate", "شهادة تعريف طالب منتظم")] },
    { key: "studio", title: "استوديو البوابة", note: "طباعة وتنزيل وحفظ — من تفعيل العداد", printsLabel: "طباعة وتنزيل",
      items: TEMPLATES.map((t) => pick("studio", t.key, t.title)) },
  ].map((s) => ({ ...s, items: [...s.items].sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title, "ar")) }));
}

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-4">
      <p className="num truncate text-2xl font-bold leading-none text-mint-deep">{value ?? "—"}</p>
      <p className="mt-1.5 text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-faint">{sub}</p>}
    </div>
  );
}

function UsageBar({ value, max, title }) {
  const pct = max ? Math.max(value ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2" title={title}>
      <div className="h-2 min-w-[80px] flex-1 overflow-hidden rounded-full bg-canvas">
        <div className="h-full rounded-full bg-mint-deep" style={{ width: `${pct}%` }} />
      </div>
      <span className="num w-10 shrink-0 text-left text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function Section({ s }) {
  const max = Math.max(0, ...s.items.map((i) => Number(i.uses)));
  const used = s.items.filter((i) => Number(i.uses) > 0).length;
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{s.title}</h2>
          <p className="text-[11px] text-faint">{s.note}</p>
        </div>
        <p className="text-xs text-muted">
          مُستخدَم <span className="num font-semibold text-ink">{used}</span> من <span className="num">{s.items.length}</span>
        </p>
      </div>
      {s.items.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">لا نماذج في هذه الفئة.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-canvas text-xs text-muted">
              <tr>
                <th className="px-4 py-2 text-right font-medium">النموذج</th>
                <th className="w-[34%] px-4 py-2 text-right font-medium">الاستخدام</th>
                <th className="px-3 py-2 text-center font-medium">آخر 30 يومًا</th>
                <th className="px-3 py-2 text-center font-medium">المستخدمون</th>
                {s.printsLabel && <th className="px-3 py-2 text-center font-medium">{s.printsLabel}</th>}
                <th className="px-4 py-2 text-right font-medium">آخر استخدام</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((i) => {
                const n = Number(i.uses);
                return (
                  <tr key={`${i.cat}:${i.key}`} className="border-t border-line/60">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={n ? "font-medium text-ink" : "text-muted"}>{i.title}</span>
                        {!n && <span className="chip bg-canvas text-faint">لم يُستخدم</span>}
                        {i.active === false && <span className="chip bg-warning/10 text-warning">معطّل</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <UsageBar value={n} max={max}
                                title={`${i.title}: ${n} استخدام، ${Number(i.users)} مستخدم`} />
                    </td>
                    <td className="num px-3 py-2.5 text-center text-muted">{Number(i.uses_30d)}</td>
                    <td className="num px-3 py-2.5 text-center text-muted">{Number(i.users)}</td>
                    {s.printsLabel && <td className="num px-3 py-2.5 text-center text-muted">{i.prints == null ? "—" : Number(i.prints)}</td>}
                    <td className="px-4 py-2.5 text-xs text-muted">{i.last_used ? fmtDateTime(i.last_used) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function UsageReport() {
  const [period, setPeriod] = useState("all");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const p = PERIODS.find((x) => x.key === period);
    fetchUsage({ from: p.days ? sinceISO(p.days) : null })
      .then((r) => { if (alive) setRows(r); })
      .catch((e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [period]);

  const sections = useMemo(() => (rows ? buildSections(rows) : []), [rows]);
  const all = sections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.title })));
  const total = all.reduce((a, i) => a + Number(i.uses), 0);
  const usedCount = all.filter((i) => Number(i.uses) > 0).length;
  const top = all.reduce((a, i) => (Number(i.uses) > Number(a?.uses ?? 0) ? i : a), null);

  const exportXlsx = () => exportToExcel(all.map((i) => ({
    "الفئة": i.section,
    "النموذج": i.title,
    "الاستخدام": Number(i.uses),
    "آخر 30 يومًا": Number(i.uses_30d),
    "المستخدمون": Number(i.users),
    "الطباعة والتنزيل": i.prints == null ? "" : Number(i.prints),
    "آخر استخدام": i.last_used ? fmtDateTime(i.last_used) : "",
  })), "إحصائية-الاستخدام", "الاستخدام");

  const missing = error && /usage_report|function|42883|PGRST202/i.test(`${error.message} ${error.code}`);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">إحصائية الاستخدام</h1>
            <span className="chip bg-mint-tint text-mint-deep">للدعم الفني فقط</span>
          </div>
          <p className="mt-1 text-sm text-muted">عدد مرات الاستخدام الفعلي لكل نموذج وقالب، لتقييم فعاليتها.</p>
        </div>
        <button className="btn-ghost shrink-0" disabled={!rows} onClick={exportXlsx}>تصدير Excel</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => { if (p.key !== period) { setRows(null); setError(null); setPeriod(p.key); } }}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                    period === p.key ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {p.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">
          {missing ? "العدّاد يحتاج تنفيذ ملف supabase/usage_stats.sql في قاعدة البيانات مرة واحدة." : `تعذّر تحميل التقرير: ${error.message}`}
        </p>
      ) : !rows ? (
        <Loader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="إجمالي الاستخدام" value={total} />
            <Stat label="نماذج مُستخدَمة" value={`${usedCount} / ${all.length}`} />
            <Stat label="لم تُستخدم" value={all.length - usedCount} />
            <Stat label="الأكثر استخدامًا" value={top ? Number(top.uses) : 0} sub={top?.title ?? "—"} />
          </div>

          {sections.map((s) => <Section key={s.key} s={s} />)}

          <p className="text-xs leading-relaxed text-faint">
            النماذج الرسمية ونماذج السلوك والإحالة تُحسب من سجلاتها المحفوظة منذ أول استخدام. قوالب الاستوديو
            وشهادة تعريف طالب منتظم لا تُحفظ عند طباعتها، فتُحسب من تاريخ تفعيل العداد: كل طباعة أو تنزيل،
            وأول حفظ للتصميم في «تصاميمي».
          </p>
        </>
      )}
    </div>
  );
}
