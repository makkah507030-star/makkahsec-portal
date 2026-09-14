import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";

const MIN_LEN = 8;

export default function ChangePassword() {
  const { profile, signOut, reload } = useSession();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sameAsUsername =
    pw1.length > 0 && profile?.username && pw1.trim() === profile.username;

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (pw1.length < MIN_LEN) {
      setError(`كلمة المرور يجب ألا تقل عن ${MIN_LEN} خانات.`);
      return;
    }
    if (sameAsUsername) {
      setError("لا يمكن أن تكون كلمة المرور مطابقة لرقم الهوية.");
      return;
    }
    if (pw1 !== pw2) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setBusy(true);

    const { error: pwErr } = await supabase.auth.updateUser({ password: pw1 });
    if (pwErr) {
      setBusy(false);
      setError("تعذّر تغيير كلمة المرور: " + pwErr.message);
      return;
    }

    const { error: flagErr } = await supabase.rpc("clear_must_change_pw");

    setBusy(false);

    if (flagErr) {
      setError("تم تغيير كلمة المرور، لكن تعذّر تحديث الحالة: " + flagErr.message);
      return;
    }

    await reload();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-tint p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <img src={logoIcon} alt="" className="mx-auto mb-4 h-14 w-14 object-contain" />
          <h1 className="text-xl font-bold leading-snug text-ink">
            تغيير كلمة المرور
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            لحماية حسابك، يجب تعيين كلمة مرور جديدة قبل متابعة الاستخدام.
          </p>
        </div>

        <form onSubmit={submit} className="card p-5">
          <div className="mb-4">
            <label className="label" htmlFor="pw1">كلمة المرور الجديدة</label>
            <input
              id="pw1"
              type="password"
              className="field"
              autoComplete="new-password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              required
            />
            <p className="mt-1.5 text-xs text-faint">
              {MIN_LEN} خانات فأكثر، ولا تطابق رقم الهوية.
            </p>
          </div>

          <div className="mb-5">
            <label className="label" htmlFor="pw2">تأكيد كلمة المرور</label>
            <input
              id="pw2"
              type="password"
              className="field"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="mb-4 rounded-sm2 bg-absent/10 px-3 py-2 text-sm leading-relaxed text-absent">
              {error}
            </p>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "جارٍ الحفظ…" : "حفظ ومتابعة"}
          </button>
        </form>

        <button
          onClick={signOut}
          className="mx-auto mt-4 block text-xs font-medium text-muted hover:text-ink"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
