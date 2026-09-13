import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ADMIN_ROLE_LABEL } from "../../lib/session.jsx";

const ROLE_KEYS = Object.keys(ADMIN_ROLE_LABEL);

export default function AdminStaff() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [roles, setRoles] = useState(new Set());

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data: admins } = await supabase
      .from("users")
      .select("id, username, full_name, is_active")
      .eq("role", "admin")
      .order("full_name");

    const ids = (admins ?? []).map((a) => a.id);
    let roleMap = {};
    if (ids.length) {
      const { data: rs } = await supabase
        .from("admin_roles")
        .select("user_id, role_type")
        .in("user_id", ids);
      (rs ?? []).forEach((r) => {
        (roleMap[r.user_id] ??= []).push(r.role_type);
      });
    }

    setList(
      (admins ?? []).map((a) => ({ ...a, roles: roleMap[a.id] ?? [] }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleRole = (k) => {
    setRoles((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const canSubmit =
    fullName.trim().length >= 3 &&
    /^\d{10}$/.test(nationalId.trim()) &&
    roles.size > 0;

  const submit = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke(
        "create-admin-account",
        {
          body: {
            full_name: fullName.trim(),
            national_id: nationalId.trim(),
            admin_roles: Array.from(roles),
          },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg({ ok: true, text: `أُنشئ حساب ${data.full_name} بنجاح.` });
      setFullName("");
      setNationalId("");
      setRoles(new Set());
      await load();
    } catch (e) {
      setMsg({ ok: false, text: e.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">حسابات الإدارة</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اسم المستخدم وكلمة المرور الأولية هما رقم الهوية، ويُطلب تغييرها عند أول دخول.
        </p>
      </div>

      {/* نموذج الإضافة */}
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold">إضافة عضو إدارة</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">الاسم الكامل</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: محمد أحمد الحارثي"
              className="mt-1 w-full rounded-sm2 border border-line px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted">رقم الهوية</label>
            <input
              type="text"
              inputMode="numeric"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
              maxLength={10}
              placeholder="10 أرقام"
              className="num mt-1 w-full rounded-sm2 border border-line px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">الأدوار الإدارية</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROLE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleRole(k)}
                className={`rounded-sm2 border px-3 py-1.5 text-sm transition-colors ${
                  roles.has(k)
                    ? "border-mint-deep bg-mint-deep text-white"
                    : "border-line text-muted"
                }`}
              >
                {ADMIN_ROLE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-primary"
          disabled={!canSubmit || saving}
          onClick={submit}
        >
          {saving ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
        </button>

        {msg && (
          <p
            className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>

      {/* القائمة الحالية */}
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">
            الأعضاء الحاليون{" "}
            <span className="num text-muted">({list.length})</span>
          </h2>
        </div>

        {loading ? (
          <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">لا توجد حسابات إدارية بعد.</p>
        ) : (
          <div className="divide-y divide-line">
            {list.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {a.full_name ?? a.username}
                  </p>
                  <p className="num text-xs text-muted">{a.username}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.roles.map((r) => (
                    <span key={r} className="chip bg-mint-light text-mint-deep">
                      {ADMIN_ROLE_LABEL[r] ?? r}
                    </span>
                  ))}
                  {!a.is_active && (
                    <span className="chip bg-absent/10 text-absent">معطّل</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
