// src/pages/admin/AuditLog.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";
import { exportToExcel } from "../../lib/exportUtils";
import { ADMIN_ROLE_LABEL, ROLE_LABEL } from "../../lib/session.jsx";

/* =====================================================================
   سجل العمليات — كل إجراء أُكِّد في مناطق الخطر: من نفّذه ومتى وأين.
   المصدر جدول audit_log (supabase/audit_log.sql)، والقراءة للدعم الفني وحده.
   ===================================================================== */

const PERIODS = [
  { key: "1", label: "اليوم", days: 1 },
  { key: "7", label: "آخر 7 أيام", days: 7 },
  { key: "30", label: "آخر 30 يومًا", days: 30 },
  { key: "all", label: "الكل", days: null },
];
const LIMIT = 1000;

const PAGES = {
  "/import": "الاستيراد",
  "/schedule-import": "استيراد الجدول الذكي",
  "/results-admin": "نتائج الطلاب",
  "/notifications": "الإشعارات",
  "/notifications-review": "اعتماد الإشعارات",
  "/announcements": "رسالة الدخول",
  "/accounts": "الحسابات",
  "/student-affairs": "تقارير شؤون الطلاب",
  "/duty": "المناوبة والإشراف",
  "/season": "التوقيت الزمني",
  "/calendar-admin": "التقويم والإجازات",
  "/maintenance": "وضع الصيانة",
  "/staff": "الإدارة",
  "/teacher-permissions": "صلاحيات المعلمين",
  "/studio": "استوديو البوابة",
  "/forms-admin": "إدارة النماذج",
  "/exams-admin": "جداول الاختبارات",
};

const sinceISO = (days) => { const d = new Date(); d.setDate(d.getDate() - (days - 1)); d.setHours(0, 0, 0, 0); return d.toISOString(); };
const rolesText = (roles) => (roles ?? []).map((r) => ADMIN_ROLE_LABEL[r] ?? ROLE_LABEL[r] ?? r).join("، ");
const pageText = (path) => PAGES[path] ?? path ?? "—";

export default function AuditLog() {
  const [period, setPeriod] = useState("7");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("all");

  useEffect(() => {
    let alive = true;
    const p = PERIODS.find((x) => x.key === period);
    let query = supabase.from("audit_log")
      .select("id, user_name, user_roles, action, details, level, path, created_at")
      .order("created_at", { ascending: false }).limit(LIMIT);
    if (p.days) query = query.gte("created_at", sinceISO(p.days));
    query.then(({ data, error: e }) => {
      if (!alive) return;
      if (e) setError(e); else setRows(data ?? []);
    });
    return () => { alive = false; };
  }, [period]);

  const shown = useMemo(() => {
    const t = q.trim();
    return (rows ?? []).filter((r) =>
      (level === "all" || r.level === level) &&
      (!t || `${r.user_name ?? ""} ${r.action} ${pageText(r.path)}`.includes(t)));
  }, [rows, q, level]);
  const accounts = new Set(shown.map((r) => r.user_name)).size;

  const exportXlsx = () => exportToExcel(shown.map((r) => ({
    "الوقت": fmtDateTime(r.created_at),
    "الحساب": r.user_name ?? "",
    "الأدوار": rolesText(r.user_roles),
    "الإجراء": r.action,
    "المستوى": r.level === "high" ? "مشدد" : "عادي",
    "الصفحة": pageText(r.path),
    "التفاصيل": (r.details ?? []).join(" | "),
  })), "سجل-العمليات", "العمليات");

  const missing = error && /audit_log|relation|42P01|PGRST205/i.test(`${error.message} ${error.code}`);
  const pick = (k) => { if (k !== period) { setRows(null); setError(null); setPeriod(k); } };
  const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-ink">سجل العمليات</h1>
            <span className="chip bg-mint-tint text-mint-deep">للدعم الفني فقط</span>
          </div>
          <p className="mt-1 text-sm text-muted">كل إجراء حساس أُكِّد في مناطق الخطر: الحساب الذي نفّذه، ووقته، وأثره.</p>
        </div>
        <button className="btn-ghost shrink-0" disabled={!shown.length} onClick={exportXlsx}>تصدير Excel</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p) => <button key={p.key} onClick={() => pick(p.key)} className={pill(period === p.key)}>{p.label}</button>)}
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="field min-w-[220px] flex-1" value={q} onChange={(e) => setQ(e.target.value)}
               placeholder="ابحث باسم الحساب أو الإجراء أو الصفحة…" />
        <select className="field w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="all">كل المستويات</option>
          <option value="high">تأكيد مشدد</option>
          <option value="medium">تأكيد عادي</option>
        </select>
      </div>

      {error ? (
        <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">
          {missing ? "السجل يحتاج تنفيذ ملف supabase/audit_log.sql في قاعدة البيانات مرة واحدة." : `تعذّر تحميل السجل: ${error.message}`}
        </p>
      ) : !rows ? (
        <Loader />
      ) : (
        <>
          <p className="text-xs text-muted">
            <span className="num font-semibold text-ink">{shown.length}</span> عملية من
            {" "}<span className="num font-semibold text-ink">{accounts}</span> حساب
            {rows.length === LIMIT && <> — تُعرض أحدث <span className="num">{LIMIT}</span> عملية في الفترة، فضيّقها للأقدم.</>}
          </p>

          {shown.length === 0 ? (
            <p className="card px-4 py-6 text-center text-sm text-muted">لا عمليات في هذه الفترة.</p>
          ) : (
            <div className="space-y-2">
              {shown.map((r) => (
                <article key={r.id} className={`card border-r-4 p-3 ${r.level === "high" ? "border-r-absent" : "border-r-warning"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{r.action}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        <b className="text-ink">{r.user_name ?? "حساب غير معروف"}</b>
                        {r.user_roles?.length > 0 && <> · {rolesText(r.user_roles)}</>}
                        {" · "}{pageText(r.path)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className={`chip ${r.level === "high" ? "bg-absent/10 text-absent" : "bg-warning/10 text-warning"}`}>
                        {r.level === "high" ? "مشدد" : "عادي"}
                      </span>
                      <span className="text-xs text-muted">{fmtDateTime(r.created_at)}</span>
                    </div>
                  </div>
                  {r.details?.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-xs font-medium text-mint-deep">الأثر المعروض عند التأكيد</summary>
                      <ul className="mt-1.5 space-y-1 text-muted">
                        {r.details.map((t, i) => <li key={i} className="flex gap-2"><span>•</span><span>{t}</span></li>)}
                      </ul>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
