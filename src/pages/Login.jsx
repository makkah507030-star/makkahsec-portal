import { useState } from "react";
import { supabase, idToEmail, isConfigured } from "../lib/supabase";

export default function Login() {
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setBusy(false);
    }
    // النجاح: onAuthStateChange يتكفّل بالتوجيه
  };

  if (!isConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl2 bg-brand text-xl font-bold text-white">
            م
          </div>
          <h1 className="text-xl font-bold leading-snug">
            بوابة مكة الثانوية الرقمية
          </h1>
        </div>

        <form onSubmit={submit} className="card p-5">
          <div className="mb-4">
            <label className="label" htmlFor="nid">رقم الهوية</label>
            <input
              id="nid"
              className="field num"
              inputMode="numeric"
              autoComplete="username"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              required
            />
          </div>

          <div className="mb-5">
            <label className="label" htmlFor="pw">كلمة المرور</label>
            <input
              id="pw"
              type="password"
              className="field"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-absent/10 px-3 py-2 text-sm text-absent">
              {error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "جارٍ الدخول…" : "دخول"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted">
          نسيت كلمة المرور؟ راجع إدارة المدرسة لإعادة تعيينها.
        </p>
      </div>
    </div>
  );
}
