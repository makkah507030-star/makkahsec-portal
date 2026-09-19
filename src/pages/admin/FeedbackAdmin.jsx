import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmtDateTime } from "../../lib/dates";
import ColorLegend from "../../components/ColorLegend.jsx";

const CAT_LABEL = {
  bug: "مشكلة تقنية",
  suggestion: "اقتراح",
  data: "خطأ بيانات",
  other: "أخرى",
};

const CAT_BAR = {
  bug: "bg-absent",
  suggestion: "bg-mint-deep",
  data: "bg-late",
  other: "bg-muted",
};

const STATUS = [
  { key: "new",         label: "جديدة",      cls: "bg-warning-light text-warning" },
  { key: "in_progress", label: "قيد المعالجة", cls: "bg-late/10 text-late" },
  { key: "done",        label: "تمت",         cls: "bg-present/10 text-present" },
];

export default function FeedbackAdmin() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const { data } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, new: 0, in_progress: 0, done: 0 };
    (rows ?? []).forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  // إحصائيات حسب نوع المشكلة — لرصد التصنيفات الأكثر تكرارًا
  const catStats = useMemo(() => {
    const total = rows?.length ?? 0;
    const c = { bug: 0, suggestion: 0, data: 0, other: 0 };
    (rows ?? []).forEach((r) => { c[r.category] = (c[r.category] ?? 0) + 1; });
    return Object.entries(c)
      .map(([key, count]) => ({
        key,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows ?? [] : (rows ?? []).filter((r) => r.status === filter)),
    [rows, filter]
  );

  const remove = async (id) => {
    if (!confirm("حذف هذه التذكرة نهائيًا؟")) return;
    await supabase.from("feedback").delete().eq("id", id);
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الدعم الفني</h1>
        <p className="mt-1 text-sm text-muted">
          طلبات الدعم الواردة عبر "مركز الدعم والمساندة" — رد، تابع، وأغلق كل طلب من صفحته.
        </p>
      </div>

      {/* إحصائيات حسب نوع المشكلة */}
      {rows && rows.length > 0 && (
        <div className="card space-y-3 p-4">
          <p className="text-sm font-bold text-ink">التصنيفات الأكثر ورودًا</p>
          <div className="space-y-2.5">
            {catStats.map((s) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{CAT_LABEL[s.key]}</span>
                  <span className="num">{s.count} ({s.pct}٪)</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-pill bg-gray-tint">
                  <div
                    className={`h-full rounded-pill ${CAT_BAR[s.key]}`}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Pill on={filter === "all"} onClick={() => setFilter("all")}>
          الكل <span className="num">({counts.all})</span>
        </Pill>
        {STATUS.map((s) => (
          <Pill key={s.key} on={filter === s.key} onClick={() => setFilter(s.key)}>
            {s.label} <span className="num">({counts[s.key] ?? 0})</span>
          </Pill>
        ))}
      </div>

      <ColorLegend
        items={[
          { chip: "bg-warning-light text-warning", sample: "جديدة", label: "لم تُراجع" },
          { chip: "bg-late/10 text-late", sample: "قيد المعالجة", label: "تحت العمل" },
          { chip: "bg-present/10 text-present", sample: "تمت", label: "مغلقة" },
        ]}
      />

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && filtered.length === 0 && (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا طلبات</p>
          <p className="mt-1 text-sm text-muted">لم تصل طلبات في هذا التصنيف.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((f) => {
          const st = STATUS.find((s) => s.key === f.status) ?? STATUS[0];
          return (
            <article key={f.id} className="card p-4">
              <Link to={`/ticket/${f.id}`} className="block">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-mint-tint text-mint-deep">
                    {CAT_LABEL[f.category] ?? f.category}
                  </span>
                  <span className={`chip ${st.cls}`}>{st.label}</span>
                  {f.role_label && (
                    <span className="chip bg-gray-tint text-muted">{f.role_label}</span>
                  )}
                  <span className="ms-auto text-xs text-faint">
                    {fmtDateTime(f.created_at)}
                  </span>
                </div>

                <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {f.message}
                </p>

                {(f.name || f.contact) && (
                  <p className="mt-3 text-xs text-muted">
                    {f.name}
                    {f.name && f.contact && " · "}
                    {f.contact && <span className="num">{f.contact}</span>}
                  </p>
                )}
              </Link>

              <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium">
                <Link to={`/ticket/${f.id}`} className="text-mint-deep hover:underline">
                  فتح المحادثة والرد
                </Link>
                <button onClick={() => remove(f.id)} className="text-absent hover:underline">
                  حذف
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
