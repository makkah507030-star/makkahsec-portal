import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/dates";
import { printReport, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const CAT_LABEL = { bug: "مشكلة تقنية", suggestion: "اقتراح", data: "خطأ بيانات", other: "أخرى" };
const CAT_ORDER = ["bug", "suggestion", "data", "other"];
const CAT_BAR   = { bug: "bg-absent", suggestion: "bg-mint-deep", data: "bg-late", other: "bg-muted" };

const STATUS_LABEL = { new: "جديدة", in_progress: "قيد المعالجة", done: "تمت" };
const STATUS_ORDER = ["new", "in_progress", "done"];
const STATUS_BAR   = { new: "bg-warning", in_progress: "bg-late", done: "bg-present" };

const ROLE_ORDER = ["معلم", "طالب", "ولي أمر", "إداري", "أخرى"];
const ROLE_BAR    = "bg-mint-deep";

function Bar({ label, count, total, colorClass }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="num">{count} ({pct}٪)</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-pill bg-gray-tint">
        <div className={`h-full rounded-pill ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, cls }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${cls ?? "text-ink"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

export default function SupportReport() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const stats = useMemo(() => {
    const total = rows?.length ?? 0;
    const byCat = {}, byStatus = {}, byRole = {};
    (rows ?? []).forEach((r) => {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      const role = r.role_label || "أخرى";
      byRole[role] = (byRole[role] ?? 0) + 1;
    });
    return { total, byCat, byStatus, byRole };
  }, [rows]);

  const handlePrint = () => {
    const catRows = CAT_ORDER.filter((k) => stats.byCat[k]).map((k, i) => [i + 1, CAT_LABEL[k], stats.byCat[k]]);
    const statusRows = STATUS_ORDER.filter((k) => stats.byStatus[k]).map((k, i) => [i + 1, STATUS_LABEL[k], stats.byStatus[k]]);
    const roleRows = Object.entries(stats.byRole).map(([k, v], i) => [i + 1, k, v]);
    const ticketRows = (rows ?? []).map((r, i) => [
      i + 1,
      fmtDateTime(r.created_at),
      CAT_LABEL[r.category] ?? r.category,
      r.role_label || "—",
      STATUS_LABEL[r.status] ?? r.status,
      r.national_id || "—",
      r.name || "—",
      (r.message || "").slice(0, 70),
    ]);

    printReport({
      title: "تقرير متابعة الدعم الفني — مركز الدعم والمساندة",
      subtitle: `إجمالي التذاكر: ${stats.total}`,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      sections: [
        { title: "التوزيع حسب نوع المشكلة", subtitle: `${stats.total} تذكرة`, headers: ["م", "النوع", "العدد"], rows: catRows },
        { title: "التوزيع حسب الحالة", headers: ["م", "الحالة", "العدد"], rows: statusRows },
        { title: "التوزيع حسب الصفة", headers: ["م", "الصفة", "العدد"], rows: roleRows },
        {
          title: "سجل التذاكر",
          subtitle: `${rows?.length ?? 0} تذكرة`,
          headers: ["م", "التاريخ", "النوع", "الصفة", "الحالة", "رقم الهوية", "الاسم", "الطلب"],
          rows: ticketRows,
        },
      ],
      signatures: [{ title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    });
  };

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">تقرير ومتابعة الدعم</h1>
          <p className="mt-1 text-sm text-muted">
            لوحة متابعة شاملة لتذاكر مركز الدعم والمساندة، قابلة للطباعة PDF.
          </p>
        </div>
        <button onClick={handlePrint} className="btn-primary shrink-0">
          طباعة التقرير PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="إجمالي التذاكر" value={stats.total} />
        <StatTile label="جديدة" value={stats.byStatus.new ?? 0} cls="text-warning" />
        <StatTile label="قيد المعالجة" value={stats.byStatus.in_progress ?? 0} cls="text-late" />
        <StatTile label="مغلقة" value={stats.byStatus.done ?? 0} cls="text-present" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">حسب نوع المشكلة</p>
          <div className="space-y-2.5">
            {CAT_ORDER.map((k) => (
              <Bar key={k} label={CAT_LABEL[k]} count={stats.byCat[k] ?? 0} total={stats.total} colorClass={CAT_BAR[k]} />
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">حسب الحالة</p>
          <div className="space-y-2.5">
            {STATUS_ORDER.map((k) => (
              <Bar key={k} label={STATUS_LABEL[k]} count={stats.byStatus[k] ?? 0} total={stats.total} colorClass={STATUS_BAR[k]} />
            ))}
          </div>
        </div>

        <div className="card space-y-3 p-4 lg:col-span-2">
          <p className="text-sm font-bold text-ink">حسب صفة مقدّم الطلب</p>
          <div className="space-y-2.5">
            {ROLE_ORDER.filter((r) => stats.byRole[r]).map((r) => (
              <Bar key={r} label={r} count={stats.byRole[r] ?? 0} total={stats.total} colorClass={ROLE_BAR} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
