import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";

const CATEGORIES = [
  { key: "bug",        label: "مشكلة تقنية" },
  { key: "suggestion", label: "اقتراح تحسين" },
  { key: "data",       label: "خطأ في البيانات" },
  { key: "other",      label: "أخرى" },
];

const ROLES = ["معلم", "طالب", "ولي أمر", "إداري", "أخرى"];

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

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (message.trim().length < 10) {
      setError("اكتب وصفًا أوضح للملاحظة (١٠ أحرف على الأقل).");
      return;
    }

    setSending(true);

    const { error: err } = await supabase.from("feedback").insert({
      name: name.trim() || null,
      contact: contact.trim() || null,
      role_label: roleLabel || null,
      category,
      message: message.trim(),
      page_url: window.location.origin,
      user_id: profile?.id ?? null,
    });

    setSending(false);

    if (err) {
      setError("تعذّر الإرسال: " + err.message);
      return;
    }
    setDone(true);
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
        {done ? (
          <div className="card px-6 py-14 text-center">
            <p className="text-lg font-bold text-mint-deep">وصلنا طلبك</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              شكرًا لتواصلك. سيراجع الدعم الفني طلبك ويعود إليك في أقرب وقت.
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
            <h1 className="text-2xl font-bold text-ink">مركز الدعم والمساندة</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              تواصل مع الدعم الفني للبوابة لأي مشكلة تقنية أو استفسار أو اقتراح،
              وسيصل طلبك مباشرة لفريق الدعم.
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
