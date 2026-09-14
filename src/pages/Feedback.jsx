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
            <p className="text-lg font-bold text-mint-deep">وصلتنا ملاحظتك</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              شكرًا لك. ملاحظاتك تساعدنا على تحسين البوابة قبل التشغيل الرسمي.
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
                إرسال ملاحظة أخرى
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">ملاحظاتك تهمّنا</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              البوابة في مرحلة تجريبية. إن واجهتك مشكلة أو لديك اقتراح، اكتبه هنا
              وسيصل مباشرة للدعم الفني.
            </p>

            <form onSubmit={submit} className="card mt-7 space-y-5 p-5">
              <div>
                <label className="label">نوع الملاحظة</label>
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
                <label className="label" htmlFor="msg">تفاصيل الملاحظة</label>
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
                {sending ? "جارٍ الإرسال…" : "إرسال الملاحظة"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
