import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const TARGETS = [
  { key: "teachers",  label: "المعلمون",       login: "رقم الهوية" },
  { key: "students",  label: "الطلاب",         login: "رقم الهوية" },
  { key: "guardians", label: "أولياء الأمور",  login: "رقم الجوال" },
];

export default function Accounts() {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(null);

  const load = async () => {
    const [t, s, g] = await Promise.all([
      supabase.from("teachers").select("user_id", { count: "exact" }).eq("is_active", true),
      supabase.from("students").select("user_id", { count: "exact" }).eq("is_active", true),
      supabase.from("guardians").select("user_id", { count: "exact" }).eq("is_active", true),
    ]);
    const calc = (r) => {
      const rows = r.data ?? [];
      const withAcc = rows.filter((x) => x.user_id).length;
      return { total: rows.length, withAcc, missing: rows.length - withAcc };
    };
    setStats({ teachers: calc(t), students: calc(s), guardians: calc(g) });
  };

  useEffect(() => { load(); }, []);

  const run = async (target) => {
    setBusy(target);
    setError("");
    setResult(null);
    setConfirming(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-accounts", {
        body: { target },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({ target, ...data });
      await load();
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  if (!stats) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">الحسابات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          كلمة المرور الأولية هي اسم المستخدم نفسه، ويُطلب تغييرها عند أول دخول.
        </p>
      </div>

      {TARGETS.map((t) => {
        const st = stats[t.key];
        return (
          <section key={t.key} className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t.label}</h2>
                <p className="mt-0.5 text-xs text-muted">
                  اسم المستخدم: {t.login}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted">
                  الإجمالي <b className="num text-ink">{st.total}</b>
                </span>
                <span className="text-present">
                  له حساب <b className="num">{st.withAcc}</b>
                </span>
                <span className={st.missing ? "text-late" : "text-muted"}>
                  بلا حساب <b className="num">{st.missing}</b>
                </span>
              </div>
            </div>

            {confirming === t.key ? (
              <div className="mt-4 rounded-sm2 bg-late/5 p-3">
                <p className="text-sm leading-relaxed">
                  سيُنشأ <b className="num">{st.missing}</b> حسابًا لـ{t.label}.
                  العملية قد تستغرق دقيقة. هل تريد المتابعة؟
                </p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-primary" onClick={() => run(t.key)}>
                    نعم، أنشئ الحسابات
                  </button>
                  <button className="btn-ghost" onClick={() => setConfirming(null)}>
                    إلغاء
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="btn-primary mt-4"
                disabled={busy !== null || st.missing === 0}
                onClick={() => setConfirming(t.key)}
              >
                {busy === t.key
                  ? "جارٍ الإنشاء…"
                  : st.missing === 0
                  ? "كل الحسابات جاهزة"
                  : `إنشاء ${st.missing} حسابًا`}
              </button>
            )}
          </section>
        );
      })}

      {error && (
        <div className="card border-absent/30 bg-absent/5 p-4">
          <p className="text-sm leading-relaxed text-absent">{error}</p>
        </div>
      )}

      {result && (
        <div className="card border-present/30 bg-present/5 p-4">
          <p className="font-semibold text-present">
            أُنشئ <span className="num">{result.created}</span> حسابًا
          </p>
          {result.failed > 0 && (
            <>
              <p className="mt-1 text-sm text-absent">
                فشل <span className="num">{result.failed}</span> — راجعها:
              </p>
              <div className="mt-2 max-h-48 overflow-auto rounded-sm2 bg-white">
                {(result.failures ?? []).map((f, i) => (
                  <div key={i} className="border-b border-line px-3 py-2 last:border-0">
                    <p className="text-sm">{f.name}</p>
                    <p className="num text-right text-xs text-muted">{f.login} — {f.reason}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
