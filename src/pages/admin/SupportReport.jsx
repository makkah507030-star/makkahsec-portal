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

// ألوان مطابقة لهوية الموقع — تُستخدم داخل الرسوم البيانية في نسخة الطباعة PDF
const CAT_HEX    = { bug: "#A23B3B", suggestion: "#3E6350", data: "#9A7B22", other: "#6B6B6B" };
const STATUS_HEX = { new: "#9A7B22", in_progress: "#3F6B99", done: "#4E7D66" };
const ROLE_HEX   = "#3E6350";

const barChartHtml = (items) => {
  const total = items.reduce((s, it) => s + it.count, 0) || 1;
  return `<div class="bar-chart">${items
    .map((it) => {
      const pct = Math.round((it.count / total) * 100);
      return `<div class="bar-row">
        <div class="bl"><span>${it.label}</span><span class="n">${it.count} (${pct}٪)</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${it.color}"></div></div>
      </div>`;
    })
    .join("")}</div>`;
};

const statTilesHtml = (tiles) =>
  `<div class="stat-tiles">${tiles
    .map((t) => `<div class="stat-tile"><p class="v">${t.value}</p><p class="l">${t.label}</p></div>`)
    .join("")}</div>`;

const chartHeadingHtml = (text) =>
  `<p style="margin:12px 0 6px;font-size:11.5px;font-weight:700;color:#3E6350;">${text}</p>`;

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

    const overviewHtml =
      statTilesHtml([
        { value: stats.total, label: "إجمالي التذاكر" },
        { value: stats.byStatus.new ?? 0, label: "جديدة" },
        { value: stats.byStatus.in_progress ?? 0, label: "قيد المعالجة" },
        { value: stats.byStatus.done ?? 0, label: "مغلقة" },
      ]) +
      chartHeadingHtml("التوزيع حسب نوع المشكلة") +
      barChartHtml(
        CAT_ORDER.filter((k) => stats.byCat[k]).map((k) => ({
          label: CAT_LABEL[k], count: stats.byCat[k], color: CAT_HEX[k],
        }))
      ) +
      chartHeadingHtml("التوزيع حسب الحالة") +
      barChartHtml(
        STATUS_ORDER.filter((k) => stats.byStatus[k]).map((k) => ({
          label: STATUS_LABEL[k], count: stats.byStatus[k], color: STATUS_HEX[k],
        }))
      ) +
      chartHeadingHtml("التوزيع حسب صفة مقدّم الطلب") +
      barChartHtml(
        ROLE_ORDER.filter((r) => stats.byRole[r]).map((r) => ({
          label: r, count: stats.byRole[r], color: ROLE_HEX,
        }))
      );

    printReport({
      title: "تقرير متابعة الدعم الفني — مركز الدعم والمساندة",
      subtitle: `إجمالي التذاكر: ${stats.total}`,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      sections: [
        { title: "نظرة عامة وإحصائيات", subtitle: `حتى ${fmtDateTime(new Date())}`, html: overviewHtml },
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
