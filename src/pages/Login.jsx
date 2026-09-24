// src/pages/Login.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, idToEmail, isConfigured } from "../lib/supabase";
import logoIcon from "../assets/icon-mint.png";

/* =====================================================================
   صفحة الدخول — خلفية بنقش الهوية وبطاقة زجاجية.
   النقش مبنيّ بـ CSS خالص (بلا صور)، فلا يزيد حجم الصفحة ولا يبطئها.
   ===================================================================== */

/* حقول بلون الهوية النعناعي بدل الأزرق الافتراضي للمتصفح */
const FIELD =
  "mk-field h-11 rounded-sm2 border border-[#CCF2DB] bg-mint-tint px-3 text-[15px] text-ink " +
  "placeholder:text-faint focus:border-mint-deep focus:bg-white focus:outline-none " +
  "focus:ring-2 focus:ring-[#89D7AD]/45 transition-colors";

/* كروم يفرض خلفية زرقاء على الحقول المحفوظة (autofill) ويتجاهل background،
   والحيلة المعتمدة أن نملأها بظل داخلي بلون الهوية ونؤخّر انتقاله طويلًا. */
const AUTOFILL_FIX = `
  .mk-field:-webkit-autofill,
  .mk-field:-webkit-autofill:hover,
  .mk-field:-webkit-autofill:focus,
  .mk-field:-webkit-autofill:active {
    -webkit-box-shadow: 0 0 0 1000px #EDFAF2 inset !important;
    box-shadow: 0 0 0 1000px #EDFAF2 inset !important;
    -webkit-text-fill-color: #101010 !important;
    caret-color: #101010;
    transition: background-color 9999s ease-in-out 0s;
  }
  .mk-field:-webkit-autofill:focus {
    -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset !important;
    box-shadow: 0 0 0 1000px #FFFFFF inset !important;
  }
`;

export default function Login() {
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // تسجيل محاولة الدخول (ناجحة أو فاشلة) في سجل الدخول والخروج — بلا
  // انتظار ولا تعطيل لتجربة الدخول لو فشل التسجيل نفسه لأي سبب
  const logAttempt = (success, reason) => {
    const nid = nationalId.trim();
    if (!nid) return;
    supabase
      .from("login_log")
      .insert({ national_id: nid, event_type: "login", success, reason: reason ?? null })
      .then(() => {}, () => {});
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: idToEmail(nationalId),
      password,
    });

    if (error) {
      setError("رقم الهوية أو كلمة المرور غير صحيحة.");
      logAttempt(false, "بيانات دخول غير صحيحة");
      setBusy(false);
    } else {
      logAttempt(true, null);
    }
    // النجاح: onAuthStateChange يتكفّل بالتوجيه
  };

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-tint p-6">
        <div className="card max-w-md p-6">
          <h1 className="mb-2 text-lg font-bold">الإعدادات ناقصة</h1>
          <p className="text-sm leading-relaxed text-muted">
            أنشئ ملفًا باسم <code className="num">.env</code> بجانب{" "}
            <code className="num">package.json</code> وضع فيه{" "}
            <code className="num">VITE_SUPABASE_URL</code> و{" "}
            <code className="num">VITE_SUPABASE_ANON_KEY</code>، ثم أعد تشغيل{" "}
            <code className="num">npm run dev</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <style dangerouslySetInnerHTML={{ __html: AUTOFILL_FIX }} />
      {/* ——— الخلفية: بيضاء بنقش الهوية الخفيف ——— */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg,#F4FBF7 0%,#FFFFFF 55%,#F7FCF9 100%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(#CCF2DB 1px, transparent 1px), linear-gradient(90deg,#CCF2DB 1px, transparent 1px)",
          backgroundSize: "46px 46px",
          maskImage: "radial-gradient(130% 85% at 50% 0%, #000 25%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(130% 85% at 50% 0%, #000 25%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg,#89D7AD 0 1.5px, transparent 1.5px 24px)," +
            "repeating-linear-gradient(-45deg,#89D7AD 0 1.5px, transparent 1.5px 24px)",
          maskImage: "radial-gradient(120% 70% at 50% 100%, #000 10%, transparent 65%)",
          WebkitMaskImage: "radial-gradient(120% 70% at 50% 100%, #000 10%, transparent 65%)",
        }}
      />
      <div className="pointer-events-none absolute -top-40 -right-32 h-[26rem] w-[26rem] rounded-full bg-[#89D7AD]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -left-28 h-[24rem] w-[24rem] rounded-full bg-[#CCF2DB]/40 blur-3xl" />

      {/* ——— المحتوى ——— */}
      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">

          {/* الترويسة */}
          <div className="mb-6 text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-mint-tint ring-1 ring-[#CCF2DB]">
              <img src={logoIcon} alt="" className="h-10 w-10 object-contain" />
            </span>
            <h1 className="text-[22px] font-bold leading-snug text-ink">
              بوابة مكة الثانوية الرقمية
            </h1>
            <p className="mt-1.5 text-sm text-muted">مدرسة مكة الثانوية</p>
          </div>

          {/* البطاقة */}
          <form onSubmit={submit}
                className="rounded-[20px] border border-[#DCEFE5] bg-white/85 p-6 shadow-[0_24px_60px_-34px_rgba(62,99,80,.55)] backdrop-blur-xl">

            <div className="mb-4">
              <label className="label" htmlFor="nid">رقم الهوية</label>
              <input
                id="nid"
                className={`${FIELD} num mt-1 w-full`}
                inputMode="numeric"
                autoComplete="username"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                required
              />
              <p className="mt-1 text-[11px] text-faint">
                ولي الأمر يدخل برقم جواله المسجّل بصيغة 9665xxxxxxx
              </p>
            </div>

            <div className="mb-5">
              <label className="label" htmlFor="pw">كلمة المرور</label>
              <div className="relative mt-1">
                <input
                  id="pw"
                  type={showPw ? "text" : "password"}
                  className={`${FIELD} w-full pl-11`}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                        aria-label={showPw ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-sm2 text-muted hover:bg-mint-tint hover:text-mint-deep">
                  {showPw ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor"
                         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.4 5.3A9.7 9.7 0 0 1 12 5c5 0 9 4.5 9 7 0 .9-.6 2.1-1.6 3.3M6.2 6.8C4 8.3 3 10.3 3 12c0 2.5 4 7 9 7 1.3 0 2.5-.3 3.6-.8" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor"
                         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" />
                      <circle cx="12" cy="12" r="2.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="mb-4 flex items-start gap-2 rounded-sm2 bg-absent/10 px-3 py-2.5 text-sm text-absent">
                <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-4 w-4 shrink-0"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" />
                </svg>
                {error}
              </p>
            )}

            <button className="btn-primary w-full" disabled={busy}>
              {busy ? "جارٍ الدخول…" : "دخول"}
            </button>

            {/* إرشاد الدخول لأول مرة */}
            <div className="mt-5 rounded-sm2 bg-mint-tint px-3.5 py-3">
              <p className="text-xs font-semibold text-mint-deep">الدخول لأول مرة</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-mint-deep/85">
                اكتب رقم الهوية في الخانتين معًا — أو رقم الجوال لولي الأمر —
                ثم ستُطلب منك كلمة مرور جديدة من ٨ خانات فأكثر.
              </p>
            </div>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
              نسيت كلمة المرور؟ راجع إدارة المدرسة لإعادة تعيينها.
            </p>
          </form>

          {/* نبذة وروابط سريعة */}
          <div className="mt-6 rounded-[18px] border border-[#E7EEEA] bg-white/70 px-5 py-4 backdrop-blur-md">
            <p className="text-center text-[12.5px] leading-relaxed text-muted">
              بوابة تجمع الحضور والجداول والنتائج والإشعارات والنماذج في مكان واحد،
              للطالب وولي الأمر والمعلم والإدارة.
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              {[["/news", "الأخبار"], ["/contact", "الدعم الفني"], ["/", "الرئيسية"]].map(([to, label]) => (
                <Link key={to} to={to}
                  className="rounded-pill border border-[#CCF2DB] bg-mint-tint px-4 py-1.5 text-xs font-semibold text-mint-deep transition-colors hover:bg-[#CCF2DB]">
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] text-faint" dir="ltr">
            makkahsec.com
          </p>
        </div>
      </div>
    </div>
  );
}
