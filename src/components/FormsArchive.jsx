import { useMemo, useState } from "react";

/* =====================================================================
   أرشيف النماذج — بدل قائمة واحدة تطول كل يوم:
   بطاقات متابعة بما ينتظر إجراءً، وبحث وتصفية بالنموذج، وتجميع بالشهر
   الهجري أو بالنموذج في أقسام مطوية يُفتح أحدثها فقط.
   renderRow يرسم صف المستند كما هو في صفحة النماذج (فتح وإرسال وحذف)،
   وmore يجلب مستندات أقدم (يغيب حين لا يبقى أقدم).
   ===================================================================== */

const PAGE = 20;

const needsAck = (d) => (d.form_templates?.fields ?? []).some((f) => f.type === "rubric" || f.ack);
const sendable = (d) => d.recipient_user_id && ["issued", "approved", "awaiting_reply"].includes(d.status);

// ما ينتظر إجراءً — كل بطاقة مرشّح بنقرة
const FOLLOW = [
  { k: "unsent",  t: "لم يُرسل للمستفيد", c: "text-mint-deep",  test: (d) => sendable(d) && !d.sent_at },
  { k: "ack",     t: "بانتظار الاطلاع",   c: "text-warning",    test: (d) => ["issued", "approved"].includes(d.status) && needsAck(d) && d.sent_at && !d.data?.ack_at },
  { k: "reply",   t: "بانتظار رد المستفيد", c: "text-warning",  test: (d) => d.status === "awaiting_reply" },
  { k: "pending", t: "بانتظار الاعتماد",  c: "text-warning",    test: (d) => d.status === "pending" },
  { k: "rejected", t: "مُعاد للتعديل",    c: "text-absent",     test: (d) => d.status === "rejected" },
];

const monthFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { month: "long", year: "numeric", timeZone: "Asia/Riyadh" });
const dayKey = (v) => new Date(v).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });

// عنوان القسم الزمني: اليوم، أمس، ثم الشهر الهجري
function periodOf(created) {
  const k = dayKey(created);
  const today = dayKey(Date.now());
  const yest = dayKey(Date.now() - 864e5);
  const label = k === today ? "اليوم" : k === yest ? "أمس" : monthFmt.format(new Date(created)).replace(/\s*هـ$/, "");
  return { key: label, label };
}

export default function FormsArchive({ docs, renderRow, more }) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState("");
  const [follow, setFollow] = useState("");
  const [by, setBy] = useState("date");
  const [open, setOpen] = useState({});      // الأقسام المفتوحة يدويًا
  const [shown, setShown] = useState({});    // عدد الظاهر في كل قسم
  const [busy, setBusy] = useState(false);
  const docCount = docs.length;
  // ينتهي التحميل حين يصل عدد المستندات الجديد
  if (busy && docCount !== busy) setBusy(false);

  const counts = useMemo(() => Object.fromEntries(FOLLOW.map((f) => [f.k, docs.filter(f.test).length])), [docs]);
  const forms = useMemo(() => [...new Set(docs.map((d) => d.title).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ar")), [docs]);

  const list = useMemo(() => {
    const s = q.trim();
    const f = FOLLOW.find((x) => x.k === follow);
    return docs.filter((d) =>
      (!form || d.title === form) && (!f || f.test(d)) &&
      (!s || [d.title, d.serial, d.recipient].some((x) => x?.includes(s))));
  }, [docs, q, form, follow]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const d of list) {
      const g = by === "form" ? { key: d.title ?? "", label: d.title || "بدون عنوان" } : periodOf(d.created_at);
      if (!m.has(g.key)) m.set(g.key, { ...g, items: [] });
      m.get(g.key).items.push(d);
    }
    const arr = [...m.values()];
    // المستندات مرتبة من الأحدث، فالأقسام الزمنية تأتي بترتيبها؛ والنماذج: الأكثر عددًا أولًا
    return by === "form" ? arr.sort((a, b) => b.items.length - a.items.length) : arr;
  }, [list, by]);

  const filtering = !!(q.trim() || form || follow);
  // يُفتح القسم الأول وحده افتراضيًا، وكلها عند البحث أو التصفية
  const isOpen = (g, i) => open[g.key] ?? (filtering || i === 0);

  return (
    <div className="space-y-3">
      {/* بطاقات على الشاشة الواسعة، وأزرار صغيرة على الجوال */}
      <div className="flex flex-wrap gap-1.5 sm:grid sm:grid-cols-5 sm:gap-2">
        {FOLLOW.map((f) => (
          <button key={f.k} onClick={() => setFollow(follow === f.k ? "" : f.k)} disabled={!counts[f.k] && follow !== f.k}
            className={`flex items-center gap-1.5 rounded-pill border border-line bg-paper px-3 py-1.5 text-right transition-colors disabled:opacity-50
              sm:block sm:rounded-card sm:px-3 sm:py-2.5 sm:shadow-card ${follow === f.k ? "ring-2 ring-mint-deep" : "hover:bg-canvas"}`}>
            <b className={`num text-sm sm:block sm:text-xl ${counts[f.k] ? f.c : "text-faint"}`}>{counts[f.k]}</b>
            <span className="text-xs text-muted">{f.t}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالرقم أو المستفيد أو العنوان"
               className="field min-w-0 flex-1 basis-56" />
        <select value={form} onChange={(e) => setForm(e.target.value)} className="field w-auto max-w-[14rem]">
          <option value="">كل النماذج</option>
          {forms.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <div className="flex rounded-pill border border-line bg-white p-0.5 text-xs">
          {[["date", "حسب التاريخ"], ["form", "حسب النموذج"]].map(([k, t]) => (
            <button key={k} onClick={() => { setBy(k); setOpen({}); }}
              className={`rounded-pill px-3 py-1 ${by === k ? "bg-mint-deep text-white" : "text-muted"}`}>{t}</button>
          ))}
        </div>
        {filtering && (
          <button onClick={() => { setQ(""); setForm(""); setFollow(""); }} className="text-xs text-mint-deep underline">
            مسح التصفية ({list.length})
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <p className="card px-4 py-6 text-sm text-muted">{docs.length ? "لا نتائج مطابقة." : "لا مستندات بعد."}</p>
      )}

      {groups.map((g, i) => {
        const on = isOpen(g, i);
        const n = shown[g.key] ?? PAGE;
        return (
          <div key={g.key} className="card overflow-hidden">
            <button onClick={() => setOpen({ ...open, [g.key]: !on })}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-right hover:bg-canvas">
              <span className="text-sm font-semibold text-ink">{g.label}</span>
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="num rounded-pill bg-canvas px-2 py-0.5">{g.items.length}</span>
                <span className={`transition-transform ${on ? "rotate-90" : ""}`}>‹</span>
              </span>
            </button>
            {on && (
              <div className="divide-y divide-line border-t border-line">
                {g.items.slice(0, n).map(renderRow)}
                {g.items.length > n && (
                  <button onClick={() => setShown({ ...shown, [g.key]: n + PAGE })}
                          className="w-full py-2 text-xs text-mint-deep hover:bg-canvas">
                    عرض المزيد ({g.items.length - n})
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {more && (
        <button onClick={() => { setBusy(docCount); more(); }} disabled={!!busy}
                className="w-full rounded-sm2 border border-line bg-paper py-2.5 text-sm text-mint-deep hover:bg-canvas disabled:opacity-60">
          {busy ? "جارٍ التحميل…" : "تحميل الأقدم"}
        </button>
      )}
    </div>
  );
}
