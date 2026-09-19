import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { fmtDateTime } from "../lib/dates";
import logoIcon from "../assets/icon-mint.png";

const CATEGORIES = [
  { key: "bug",        label: "مشكلة تقنية" },
  { key: "suggestion", label: "اقتراح تحسين" },
  { key: "data",       label: "خطأ في البيانات" },
  { key: "other",      label: "أخرى" },
];

const ROLES = ["معلم", "طالب", "ولي أمر", "إداري", "أخرى"];

const STATUS_META = {
  new:         { label: "جديدة",       cls: "bg-warning-light text-warning" },
  in_progress: { label: "قيد المعالجة", cls: "bg-late/10 text-late" },
  done:        { label: "تمت",         cls: "bg-present/10 text-present" },
};

export default function Feedback() {
  const { profile, session } = useSession();
  const standalone = !session; // الزائر غير المسجّل يرى ترويسة وخلفية خاصة

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const [tickets, setTickets] = useState(null);

  const loadTickets = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("feedback")
      .select("id, category, status, message, created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    setTickets(data ?? []);
  };

  useEffect(() => { loadTickets(); }, [profile?.id]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profile?.id) {
      setError("سجّل الدخول أولًا لإرسال طلب دعم.");
      return;
    }

    if (message.trim().length < 10) {
      setError("اكتب وصفًا أوضح للطلب (١٠ أحرف على الأقل).");
      return;
    }

    setSending(true);

    const { data: inserted, error: err } = await supabase
      .from("feedback")
      .insert({
        name: name.trim() || null,
        contact: contact.trim() || null,
        role_label: roleLabel || null,
        category,
        message: message.trim(),
        page_url: window.location.origin,
        user_id: profile.id,
      })
      .select("id")
      .single();

    setSending(false);

    if (err) {
      setError("تعذّر الإرسال: " + err.message);
      return;
    }

    // إشعار فريق الدعم بالطلب الجديد — عبر نظام الإشعارات الحالي في الموقع
    if (inserted?.id) {
      supabase
        .rpc("notify_ticket_support", {
          p_feedback_id: inserted.id,
          p_title: "طلب دعم جديد",
          p_body: message.trim().slice(0, 140),
          p_link: `/ticket/${inserted.id}`,
        })
        .then(() => {});
    }

    setDone(true);
    loadTickets();
  };

  return (
    <div className={standalone ? "min-h-screen bg-gray-tint" : ""}>
      {standalone && (
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-3.5">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-bold text-ink">بوابة مكة الثانوية</span>
          </Link>
          <Link
            to="/"
            className="rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
          >
            الرئيسية
          </Link>
        </div>
      </header>
      )}

      <main className={standalone ? "mx-auto max-w-2xl px-5 py-10" : "max-w-2xl"}>
        <h1 className="text-2xl font-bold text-ink">مركز الدعم والمساندة</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          تواصل مع الدعم الفني للبوابة لأي مشكلة تقنية أو استفسار أو اقتراح،
          وسيصلك الرد داخل الموقع عبر الإشعارات.
        </p>

        {/* بطاقة رابط دعم منصة مدرستي — موقع مستقل منفصل عن بوابة مكة */}
        <a
          href="https://makkah507030.netlify.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex items-center gap-4 rounded-card border border-line bg-white p-5 transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint-tint text-mint-deep">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10ZM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">الدعم الفني لمنصة مدرستي</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              بوابة دعم مستقلة خاصة بمشكلات منصة مدرستي — تذاكر دعم، متابعة الحالة، ومكتبة مصادر.
            </p>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-faint" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
        </a>

        {!session ? (
          <div className="card mt-6 px-6 py-12 text-center">
            <p className="font-semibold text-ink">يلزم تسجيل الدخول</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
              لإرسال طلب دعم ومتابعة الرد عليه بسهولة عبر الإشعارات، يلزم تسجيل
              الدخول إلى البوابة أولًا.
            </p>
            <Link to="/login" className="btn-primary mt-5 inline-block">
              تسجيل الدخول
            </Link>
          </div>
        ) : done ? (
          <div className="card mt-6 px-6 py-14 text-center">
            <p className="text-lg font-bold text-mint-deep">وصلنا طلبك</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              شكرًا لتواصلك. سيراجع الدعم الفني طلبك ويصلك إشعار داخل الموقع
              فور الرد.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link to="/" className="btn-primary">العودة للرئيسية</Link>
              <button
                className="btn-ghost"
                onClick={() => {
                  setDone(false);
                  setMessage("");
                  setCategory("bug");
                }}
              >
                إرسال طلب آخر
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* طلباتي — سجل تذاكر الدعم الخاصة بالمستخدم الحالي */}
            {tickets && tickets.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold text-ink">طلباتي السابقة</h2>
                <div className="mt-2.5 space-y-2">
                  {tickets.map((t) => {
                    const st = STATUS_META[t.status] ?? STATUS_META.new;
                    return (
                      <Link
                        key={t.id}
                        to={`/ticket/${t.id}`}
                        className="flex items-center gap-3 rounded-card border border-line bg-white p-3.5 transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40"
                      >
                        <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
                        <p className="min-w-0 flex-1 truncate text-sm text-ink">
                          {t.message}
                        </p>
                        <span className="shrink-0 text-xs text-faint">
                          {fmtDateTime(t.created_at)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={submit} className="card mt-6 space-y-5 p-5">
              <div>
                <label className="label">نوع الطلب</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                        category === c.key
                          ? "bg-mint-deep text-white"
                          : "border border-line bg-white text-muted hover:bg-canvas"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="msg">تفاصيل الطلب</label>
                <textarea
                  id="msg"
                  className="field mt-1"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="اشرح ما حدث بالتفصيل: في أي صفحة، وما الذي توقّعته، وما الذي ظهر فعلاً."
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="nm">الاسم (اختياري)</label>
                  <input
                    id="nm"
                    className="field mt-1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="ct">
                    جوال أو بريد للتواصل (اختياري)
                  </label>
                  <input
                    id="ct"
                    className="field mt-1"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="label">صفتك (اختياري)</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRoleLabel(roleLabel === r ? "" : r)}
                      className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                        roleLabel === r
                          ? "bg-[#6AA786] text-white"
                          : "border border-line bg-white text-muted hover:bg-canvas"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">
                  {error}
                </p>
              )}

              <button className="btn-primary w-full sm:w-auto" disabled={sending}>
                {sending ? "جارٍ الإرسال…" : "إرسال الطلب"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
