// src/pages/admin/AiUsageReport.jsx
/* =====================================================================
   تقرير المساعد الذكي — للدعم الفني وحده (supabase/ai_assistant_1.sql).
   لكل معلم في الشهر: طلبات توليد الأسئلة، وعدد الأسئلة، والتكلفة التقريبية بالدولار،
   وآخر طلب؛ مع تعديل الحد الشهري للمعلم. التكلفة لا تظهر في أي صفحة أخرى.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";

// بداية الشهر بتوقيت مكة (+03:00) قبل k أشهر
const monthStart = (k) => {
  const now = new Date(Date.now() + 3 * 3600e3);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1) - 3 * 3600e3);
};
const MONTHS = [0, 1, 2].map((k) => ({
  k, from: monthStart(k), to: monthStart(k - 1),
  label: k === 0 ? "هذا الشهر" : k === 1 ? "الشهر الماضي" : monthStart(k).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric" }),
}));
const usd = (v) => `${Number(v || 0).toFixed(2)}$`;

export default function AiUsageReport() {
  const [m, setM] = useState(0);
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [limit, setLimit] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "ai_monthly_limit").maybeSingle()
      .then(({ data }) => setLimit(data?.value ?? "10"));
  }, []);
  useEffect(() => {
    setRows(null);
    const { from, to } = MONTHS[m];
    supabase.rpc("ai_usage_report", { p_from: from.toISOString(), p_to: to.toISOString() }).then(({ data, error }) => {
      if (error) setErr(/ai_usage_report/.test(error.message) ? "التقرير يحتاج تشغيل supabase/ai_assistant_1.sql." : error.message);
      setRows(data ?? []);
    });
  }, [m]);

  const sum = useMemo(() => (rows ?? []).reduce((a, r) => ({ req: a.req + r.requests, qs: a.qs + r.questions, cost: a.cost + Number(r.cost_usd || 0) }),
    { req: 0, qs: 0, cost: 0 }), [rows]);

  const saveLimit = async () => {
    setSaved("");
    const { error } = await supabase.rpc("ai_set_limit", { p_limit: Number(limit) });
    setSaved(error ? error.message : "حُفظ الحد ✓");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">تقرير المساعد الذكي</h1>
        <p className="mt-0.5 text-sm text-muted">توليد أسئلة الاختبارات: الاستخدام والتكلفة التقريبية لكل معلم. للدعم الفني وحده.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-card border border-line bg-paper p-1">
          {MONTHS.map((x) => (
            <button key={x.k} type="button" onClick={() => setM(x.k)}
              className={`rounded-pill px-4 py-1.5 text-[13px] ${m === x.k ? "bg-mint-deep font-semibold text-white" : "text-muted"}`}>{x.label}</button>
          ))}
        </div>
        <div className="mr-auto flex items-center gap-2 text-sm">
          <span className="text-muted">الحد الشهري لكل معلم</span>
          <input type="number" min={0} max={500} className="field num w-20 py-1.5" value={limit} onChange={(e) => { setLimit(e.target.value); setSaved(""); }} />
          <button type="button" className="btn-ghost py-1.5 text-sm" onClick={saveLimit}>حفظ</button>
          {saved && <span className={`text-xs ${saved.endsWith("✓") ? "text-present" : "text-absent"}`}>{saved}</span>}
        </div>
      </div>

      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!rows ? <Loader compact /> : (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {[["المعلمون المستخدمون", rows.length], ["الطلبات", sum.req], ["الأسئلة المولّدة", sum.qs], ["التكلفة التقريبية", usd(sum.cost)]].map(([k, v]) => (
              <div key={k} className="card p-3 text-center"><p className="num text-2xl font-bold text-ink">{v}</p><p className="text-xs text-muted">{k}</p></div>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line bg-canvas text-right text-xs text-muted">
                <th className="p-2">المعلم</th><th className="p-2 text-center">الطلبات</th><th className="p-2 text-center">الأسئلة</th>
                <th className="p-2 text-center">التكلفة</th><th className="p-2 text-center">متوسط الطلب</th><th className="p-2">آخر طلب</th></tr></thead>
              <tbody className="divide-y divide-line/50">
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="p-2 font-semibold text-ink">{r.name ?? "—"}</td>
                    <td className={`num p-2 text-center ${Number(limit) && r.requests >= Number(limit) ? "font-bold text-absent" : ""}`}>{r.requests}</td>
                    <td className="num p-2 text-center">{r.questions}</td>
                    <td className="num p-2 text-center font-bold text-mint-deep">{usd(r.cost_usd)}</td>
                    <td className="num p-2 text-center text-muted">{usd(Number(r.cost_usd || 0) / Math.max(1, r.requests))}</td>
                    <td className="num whitespace-nowrap p-2 text-xs text-muted">{r.last_at ? fmtDateTime(r.last_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="p-6 text-center text-sm text-muted">لا طلبات في هذه الفترة.</p>}
          </div>
          <p className="text-[11px] leading-relaxed text-faint">
            التكلفة تقدير بأسعار النموذج وقت الطلب، والفاتورة الدقيقة في لوحة Anthropic ← Usage. الأحمر: معلم بلغ الحد الشهري.
          </p>
        </>
      )}
    </div>
  );
}
