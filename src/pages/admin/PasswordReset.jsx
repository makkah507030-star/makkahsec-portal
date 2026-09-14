import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { ROLE_LABEL } from "../../lib/session.jsx";

export default function PasswordReset() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(null); // صف المستخدم
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) {
      setMsg({ ok: false, text: "اكتب ٣ أحرف أو أرقام على الأقل." });
      return;
    }
    setSearching(true);
    setMsg(null);
    setConfirming(null);

    const { data, error } = await supabase
      .from("users")
      .select("id, username, full_name, role, is_active, must_change_pw")
      .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
      .limit(25);

    setSearching(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setResults(data ?? []);
  };

  const reset = async (u) => {
    setBusy(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: u.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg({
        ok: true,
        text: `أُعيدت كلمة مرور ${data.full_name} إلى: ${data.username} — سيُطلب تغييرها عند أول دخول.`,
      });
      setConfirming(null);
      await search();
    } catch (e) {
      setMsg({ ok: false, text: e.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">استعادة كلمة المرور</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تُعاد كلمة المرور إلى اسم المستخدم نفسه (رقم الهوية أو الجوال)،
          ويُطلب من المستخدم تغييرها عند أول دخول.
        </p>
      </div>

      <section className="card p-4">
        <label className="text-xs text-muted">بحث بالاسم أو رقم الهوية / الجوال</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            className="field flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="مثال: 1012345678 أو أحمد"
          />
          <button className="btn-primary" onClick={search} disabled={searching}>
            {searching ? "جارٍ البحث…" : "بحث"}
          </button>
        </div>
      </section>

      {msg && (
        <p className={`rounded-card px-4 py-3 text-sm leading-relaxed ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {results && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            النتائج <span className="num text-muted">({results.length})</span>
          </h2>

          {results.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">لا نتائج مطابقة.</p>
          ) : (
            <div className="divide-y divide-line">
              {results.map((u) => (
                <div key={u.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {u.full_name ?? u.username}
                      </p>
                      <p className="num text-xs text-muted">{u.username}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <span className="chip bg-mint-tint text-mint-deep">
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                      {!u.is_active && (
                        <span className="chip bg-absent/10 text-absent">معطّل</span>
                      )}
                      {u.must_change_pw && (
                        <span className="chip bg-warning-light text-warning">
                          بانتظار تغيير كلمة المرور
                        </span>
                      )}
                    </div>

                    {confirming?.id !== u.id && (
                      <button
                        onClick={() => { setConfirming(u); setMsg(null); }}
                        className="shrink-0 rounded-sm2 border border-line px-3 py-1.5 text-xs font-medium text-muted hover:border-[#CCF2DB] hover:text-mint-deep"
                      >
                        إعادة تعيين
                      </button>
                    )}
                  </div>

                  {confirming?.id === u.id && (
                    <div className="mt-3 rounded-sm2 bg-warning-light/60 p-3">
                      <p className="text-sm leading-relaxed text-ink">
                        ستُعاد كلمة مرور <b>{u.full_name ?? u.username}</b> إلى{" "}
                        <b className="num">{u.username}</b>. هل تريد المتابعة؟
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button className="btn-primary" onClick={() => reset(u)} disabled={busy}>
                          {busy ? "جارٍ التنفيذ…" : "نعم، أعد التعيين"}
                        </button>
                        <button className="btn-ghost" onClick={() => setConfirming(null)}>
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
