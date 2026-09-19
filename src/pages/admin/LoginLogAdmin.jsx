import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/dates";
import { printReport, PRINCIPAL_NAME, TECH_SUPPORT_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const ROLE_LABEL = { student: "طالب", teacher: "معلم", guardian: "ولي أمر", admin: "إداري" };
const ROLE_ORDER = ["student", "teacher", "guardian", "admin", "unknown"];
const ROLE_HEX = { student: "#3E6350", teacher: "#3F6B99", guardian: "#9A7B22", admin: "#6B6B6B", unknown: "#A23B3B" };

// فئات التصفية الرئيسية — نوع العملية × الحالة
const CATEGORIES = [
  { key: "all",     label: "الكل" },
  { key: "success",  label: "دخول ناجح" },
  { key: "failed",   label: "دخول فاشل" },
  { key: "logout",   label: "تسجيل خروج" },
];

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

function StatTile({ label, value, cls }) {
  return (
    <div className="card p-4 text-center">
      <p className={`text-2xl font-bold ${cls ?? "text-ink"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function Badge({ ok }) {
  return ok ? (
    <span className="chip bg-present/15 text-present">ناجحة</span>
  ) : (
    <span className="chip bg-absent/15 text-absent">فاشلة</span>
  );
}

export default function LoginLogAdmin() {
  const [rows, setRows] = useState(null);
  const [users, setUsers] = useState({}); // national_id -> { full_name, role }
  const [category, setCategory] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: log } = await supabase
        .from("login_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      setRows(log ?? []);

      const ids = [...new Set((log ?? []).map((r) => r.national_id).filter(Boolean))];
      if (ids.length) {
        const { data: u } = await supabase
          .from("users")
          .select("username, full_name, role")
          .in("username", ids);
        const map = {};
        (u ?? []).forEach((r) => { map[r.username] = { full_name: r.full_name, role: r.role }; });
        setUsers(map);
      }
    })();
  }, []);

  const enriched = useMemo(() => {
    return (rows ?? []).map((r) => {
      const u = users[r.national_id];
      return {
        ...r,
        full_name: u?.full_name ?? "",
        role: u?.role ?? "unknown",
      };
    });
  }, [rows, users]);

  const filtered = useMemo(() => {
    return enriched.filter((r) => {
      if (category === "success" && !(r.event_type === "login" && r.success)) return false;
      if (category === "failed" && !(r.event_type === "login" && !r.success)) return false;
      if (category === "logout" && r.event_type !== "logout") return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (q.trim()) {
        const needle = q.trim();
        if (!r.national_id?.includes(needle) && !(r.full_name || "").includes(needle)) return false;
      }
      return true;
    });
  }, [enriched, category, roleFilter, q]);

  const stats = useMemo(() => {
    const total = enriched.length;
    const success = enriched.filter((r) => r.event_type === "login" && r.success).length;
    const failed = enriched.filter((r) => r.event_type === "login" && !r.success).length;
    const logouts = enriched.filter((r) => r.event_type === "logout").length;
    const byRole = {};
    enriched.forEach((r) => { byRole[r.role] = (byRole[r.role] ?? 0) + 1; });
    return { total, success, failed, logouts, byRole };
  }, [enriched]);

  const handlePrint = () => {
    const tableRows = filtered.map((r, i) => [
      i + 1,
      fmtDateTime(r.created_at),
      r.national_id || "—",
      r.full_name || "—",
      ROLE_LABEL[r.role] ?? "غير معروف",
      r.event_type === "logout" ? "خروج" : "دخول",
      r.success ? "ناجحة" : "فاشلة",
      r.reason || "—",
    ]);

    const overviewHtml =
      statTilesHtml([
        { value: stats.total, label: "إجمالي العمليات" },
        { value: stats.success, label: "دخول ناجح" },
        { value: stats.failed, label: "دخول فاشل" },
        { value: stats.logouts, label: "عمليات خروج" },
      ]) +
      chartHeadingHtml("التوزيع حسب فئة المستخدم") +
      barChartHtml(
        ROLE_ORDER.filter((k) => stats.byRole[k]).map((k) => ({
          label: ROLE_LABEL[k] ?? "غير معروف", count: stats.byRole[k], color: ROLE_HEX[k],
        }))
      );

    printReport({
      title: "سجل تسجيل الدخول والخروج",
      subtitle: `${filtered.length} عملية${category !== "all" ? " — " + (CATEGORIES.find((c) => c.key === category)?.label ?? "") : ""}`,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      landscape: true,
      sections: [
        { title: "نظرة عامة وإحصائيات", subtitle: `حتى ${fmtDateTime(new Date())}`, html: overviewHtml },
        {
          title: "سجل العمليات",
          subtitle: `${filtered.length} عملية`,
          headers: ["م", "التاريخ والوقت", "رقم الهوية", "الاسم", "الفئة", "العملية", "الحالة", "السبب"],
          rows: tableRows,
        },
      ],
      signatures: [
        { title: "الدعم الفني للبوابة", name: TECH_SUPPORT_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    });
  };

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">سجل الدخول والخروج</h1>
          <p className="mt-1 text-sm text-muted">
            متابعة عمليات تسجيل الدخول والخروج بالوقت والتاريخ وحالة المحاولة — آخر 1000 عملية.
          </p>
        </div>
        <button onClick={handlePrint} className="btn-primary shrink-0">
          طباعة التقرير PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="إجمالي العمليات" value={stats.total} />
        <StatTile label="دخول ناجح" value={stats.success} cls="text-present" />
        <StatTile label="دخول فاشل" value={stats.failed} cls="text-absent" />
        <StatTile label="عمليات خروج" value={stats.logouts} cls="text-muted" />
      </div>

      {/* الفئات والفلاتر */}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={
                "rounded-full border px-4 py-1.5 text-xs font-medium " +
                (category === c.key
                  ? "border-mint-deep bg-mint-deep text-white"
                  : "border-line bg-paper text-ink hover:bg-canvas")
              }
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">فئة المستخدم</label>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input">
              <option value="all">الكل</option>
              {ROLE_ORDER.map((k) => (
                <option key={k} value={k}>{ROLE_LABEL[k] ?? "غير معروف"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">بحث برقم الهوية أو الاسم</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="رقم الهوية أو الاسم" />
          </div>
        </div>
      </section>

      {/* القائمة */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">{filtered.length} عملية</h2>
        </div>
        <div className="divide-y divide-line">
          {filtered.slice(0, 300).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="w-36 shrink-0 text-xs text-muted">{fmtDateTime(r.created_at)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {r.full_name || "غير معروف"}
                </span>
                <span className="num block text-xs text-muted">{r.national_id}</span>
              </span>
              <span className="chip shrink-0 bg-gray-tint text-muted">{ROLE_LABEL[r.role] ?? "غير معروف"}</span>
              <span className="chip shrink-0 bg-mint-tint text-mint-deep">
                {r.event_type === "logout" ? "خروج" : "دخول"}
              </span>
              <Badge ok={r.success} />
              {!r.success && r.reason && (
                <span className="w-full text-xs text-absent sm:w-auto">{r.reason}</span>
              )}
            </div>
          ))}
          {!filtered.length && (
            <p className="px-4 py-8 text-center text-sm text-muted">لا توجد عمليات مطابقة.</p>
          )}
        </div>
      </section>
    </div>
  );
}
