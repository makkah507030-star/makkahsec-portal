import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import Loader from "../../components/Loader.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import DangerZone from "../../components/DangerZone.jsx";

// يستخرج رسالة الخطأ الفعلية من استجابة Supabase Edge Function
// (بدل الرسالة العامة "Edge Function returned a non-2xx status code")
async function describeEdgeError(e) {
  if (e?.context && typeof e.context.clone === "function") {
    try {
      const body = await e.context.clone().json();
      if (body?.error || body?.message) return body.error ?? body.message;
    } catch {
      try {
        const text = await e.context.clone().text();
        if (text) return text;
      } catch { /* تجاهل */ }
    }
  }
  return e?.message ?? String(e);
}

const TARGETS = [
  { key: "teachers",  label: "المعلمون",       login: "رقم الهوية" },
  { key: "students",  label: "الطلاب",         login: "رقم الهوية" },
  { key: "guardians", label: "أولياء الأمور",  login: "رقم الجوال" },
];

export default function Accounts() {
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useNotice("", "error");

  const load = async () => {
    // نستخدم عدّ "exact" مع head بدل جلب الصفوف — الطريقة السابقة كانت
    // محدودة بسقف Supabase الافتراضي (1000 صف)، فتُظهر أعدادًا خاطئة
    // "بلا حساب" متى تجاوز الإجمالي 1000.
    const one = async (table) => {
      const [tot, acc] = await Promise.all([
        supabase.from(table).select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from(table).select("id", { count: "exact", head: true }).eq("is_active", true).not("user_id", "is", null),
      ]);
      const total = tot.count ?? 0;
      const withAcc = acc.count ?? 0;
      return { total, withAcc, missing: Math.max(0, total - withAcc) };
    };
    const [teachers, students, guardians] = await Promise.all([
      one("teachers"), one("students"), one("guardians"),
    ]);
    setStats({ teachers, students, guardians });
  };

  useEffect(() => { load(); }, []);

  const run = async (target) => {
    setBusy(target);
    setError("");
    setResult(null);
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
      setError(await describeEdgeError(e));
    } finally {
      setBusy(null);
    }
  };

  if (!stats) return <Loader compact />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">الحسابات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          كلمة المرور الأولية هي اسم المستخدم نفسه، والرقم الأقصر من 6 خانات (طالب برقم مؤقت)
          يُكمَّل بأصفار من اليسار حتى 10 خانات (15660 ← 0000015660). ويُطلب تغييرها عند أول دخول.
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

            <DangerZone className="mt-4" note="ينشئ حسابات دخول حقيقية دفعة واحدة، ولا يمكن حذفها من هنا">
              <button
                className="btn-primary"
                disabled={busy !== null || st.missing === 0}
                onClick={async () => {
                  const ok = await confirmDanger({
                    level: "high",
                    title: `إنشاء حسابات ${t.label}`,
                    impact: [
                      `سيُنشأ ${st.missing} حسابًا جديدًا لـ${t.label}، وكلمة المرور الأولية هي اسم المستخدم نفسه.`,
                      "تصبح الحسابات قادرة على الدخول فورًا، ولا يمكن حذفها من هذه الصفحة.",
                      "العملية قد تستغرق دقيقة.",
                    ],
                    confirmLabel: "إنشاء الحسابات",
                  });
                  if (ok) run(t.key);
                }}
              >
                {busy === t.key
                  ? "جارٍ الإنشاء…"
                  : st.missing === 0
                  ? "كل الحسابات جاهزة"
                  : `إنشاء ${st.missing} حسابًا`}
              </button>
            </DangerZone>
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
