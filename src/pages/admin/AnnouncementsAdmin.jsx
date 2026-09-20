import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";
import { ANNOUNCEMENT_COLORS, colorMeta } from "../../components/AnnouncementModal.jsx";

const ROLES = [
  { key: "admin",    label: "الإدارة" },
  { key: "teacher",  label: "المعلمون" },
  { key: "student",  label: "الطلاب" },
  { key: "guardian", label: "أولياء الأمور" },
];

// "2026-09-18T14:30" محليًا — لحقل datetime-local
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function AnnouncementsAdmin() {
  const [tab, setTab] = useState("send");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">رسالة الدخول (صندوق منبثق)</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          رسالة تظهر عند دخول الفئة المحددة للبوابة خلال الفترة الزمنية المحددة — تُستخدم للمناسبات والرسائل الهامة.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tab on={tab === "send"} onClick={() => setTab("send")}>رسالة جديدة</Tab>
        <Tab on={tab === "log"}  onClick={() => setTab("log")}>الرسائل المُرسلة</Tab>
      </div>

      {tab === "send" && <ComposeForm onSent={() => setTab("log")} />}
      {tab === "log"  && <BannerLog />}
    </div>
  );
}

/* ===================== إنشاء رسالة ===================== */

function ComposeForm({ onSent }) {
  const { profile } = useSession();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState("mint");
  const [roles, setRoles] = useState(new Set(ROLES.map((r) => r.key)));
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalInput(d);
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  const toggleRole = (k) =>
    setRoles((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const canSend = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (roles.size === 0) return false;
    if (!startsAt || !endsAt) return false;
    if (new Date(endsAt) <= new Date(startsAt)) return false;
    return true;
  }, [title, roles, startsAt, endsAt]);

  const send = async () => {
    setSending(true);
    setMsg(null);

    const { error } = await supabase.from("announcement_banners").insert({
      title: title.trim(),
      body: body.trim() || null,
      color,
      target_roles: Array.from(roles),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      created_by: profile?.id ?? null,
    });

    setSending(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }

    setMsg({ ok: true, text: "تم نشر الرسالة." });
    setTitle(""); setBody("");
    onSent?.();
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4">
        <div>
          <label className="text-xs text-muted">عنوان الرسالة</label>
          <input className="field mt-1" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="مثال: إجازة اليوم الوطني" />
        </div>

        <div>
          <label className="text-xs text-muted">نص الرسالة (اختياري)</label>
          <textarea className="field mt-1" rows={4} value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="تفاصيل إضافية تظهر داخل الصندوق" />
        </div>

        <div>
          <label className="text-xs text-muted">لون الصندوق</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ANNOUNCEMENT_COLORS.map((c) => (
              <button key={c.key} type="button" onClick={() => setColor(c.key)}
                className={`flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                  color === c.key ? "border-ink bg-canvas" : "border-line bg-white hover:bg-canvas"}`}>
                <span className={`h-3.5 w-3.5 rounded-full ${c.dot}`} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">تظهر لمن؟</h2>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((r) => (
            <button key={r.key} onClick={() => toggleRole(r.key)}
              className={pill(roles.has(r.key))}>{r.label}</button>
          ))}
        </div>
        {roles.size === ROLES.length && (
          <p className="text-xs text-muted">تظهر حاليًا لجميع الفئات.</p>
        )}
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">فترة الظهور</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">تبدأ من</label>
            <input type="datetime-local" className="field mt-1" value={startsAt}
                   onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">تنتهي عند</label>
            <input type="datetime-local" className="field mt-1" value={endsAt}
                   onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
      </section>

      {msg && (
        <p className={`rounded-card px-4 py-3 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      <button className="btn-primary" onClick={send} disabled={!canSend || sending}>
        {sending ? "جارٍ النشر…" : "نشر الرسالة"}
      </button>
    </div>
  );
}

/* ===================== السجل ===================== */

function BannerLog() {
  const [rows, setRows] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("announcement_banners")
      .select("id, title, body, color, target_roles, starts_at, ends_at, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (b) => {
    await supabase.from("announcement_banners")
      .update({ is_active: !b.is_active }).eq("id", b.id);
    await load();
  };

  const remove = async (id) => {
    if (!confirm("حذف هذه الرسالة نهائيًا؟")) return;
    await supabase.from("announcement_banners").delete().eq("id", id);
    await load();
  };

  const statusOf = (b) => {
    if (!b.is_active) return { label: "مُعطّلة", tone: "bg-gray-tint text-muted" };
    const now = new Date();
    if (now < new Date(b.starts_at)) return { label: "لم تبدأ بعد", tone: "bg-late/10 text-late" };
    if (now > new Date(b.ends_at)) return { label: "انتهت", tone: "bg-gray-tint text-muted" };
    return { label: "نشطة الآن", tone: "bg-present/10 text-present" };
  };

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (!rows.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا رسائل</p>
        <p className="mt-1.5 text-sm text-muted">لم تُنشر رسائل دخول بعد.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((b) => {
        const meta = colorMeta(b.color);
        const status = statusOf(b);
        const roles = b.target_roles?.length
          ? b.target_roles.map((r) => ROLES.find((x) => x.key === r)?.label ?? r).join("، ")
          : "الجميع";
        return (
          <article key={b.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-3 w-3 shrink-0 rounded-full ${meta.dot}`} />
              <span className={`chip ${status.tone}`}>{status.label}</span>
              <span className="ms-auto text-xs text-faint">{fmtDateTime(b.created_at)}</span>
            </div>

            <p className="mt-2.5 text-sm font-semibold text-ink">{b.title}</p>
            {b.body && <p className="mt-1 text-xs leading-relaxed text-muted">{b.body}</p>}

            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span>الفئة: {roles}</span>
              <span className="num">من {fmtDateTime(b.starts_at)}</span>
              <span className="num">إلى {fmtDateTime(b.ends_at)}</span>
            </div>

            <div className="mt-3 flex gap-3">
              <button onClick={() => toggleActive(b)}
                className="text-xs font-medium text-ink hover:underline">
                {b.is_active ? "تعطيل الآن" : "تفعيل"}
              </button>
              <button onClick={() => remove(b.id)}
                className="text-xs font-medium text-absent hover:underline">
                حذف
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

/* ===================== عناصر ===================== */

const pill = (on) =>
  `rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

function Tab({ on, onClick, children }) {
  return <button onClick={onClick} className={pill(on)}>{children}</button>;
}
