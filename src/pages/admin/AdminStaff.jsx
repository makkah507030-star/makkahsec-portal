import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  useSession, ADMIN_ROLE_LABEL, ASSIGNABLE_ROLES, PERMISSIONS,
} from "../../lib/session.jsx";

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

export default function AdminStaff() {
  const { isSuper } = useSession();
  const [tab, setTab] = useState("members");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الإدارة المدرسية</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أعضاء الإدارة وأدوارهم، وصلاحيات كل دور.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tab on={tab === "members"} onClick={() => setTab("members")}>الأعضاء</Tab>
        {isSuper && (
          <Tab on={tab === "perms"} onClick={() => setTab("perms")}>الصلاحيات</Tab>
        )}
      </div>

      {tab === "members" && <Members />}
      {tab === "perms" && isSuper && <RolePermissions />}
    </div>
  );
}

/* ===================== الأعضاء ===================== */

function Members() {
  const [list, setList] = useState(null);
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
    const roleMap = {};
    if (ids.length) {
      const { data: rs } = await supabase
        .from("admin_roles")
        .select("user_id, role_type")
        .in("user_id", ids);
      (rs ?? []).forEach((r) => { (roleMap[r.user_id] ??= []).push(r.role_type); });
    }
    setList((admins ?? []).map((a) => ({ ...a, roles: roleMap[a.id] ?? [] })));
  };

  useEffect(() => { load(); }, []);

  const toggleRole = (k) =>
    setRoles((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const canSubmit =
    fullName.trim().length >= 3 &&
    /^\d{10}$/.test(nationalId.trim()) &&
    roles.size > 0;

  const submit = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-admin-account", {
        body: {
          full_name: fullName.trim(),
          national_id: nationalId.trim(),
          admin_roles: Array.from(roles),
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg({ ok: true, text: `حُفظ حساب ${data.full_name}.` });
      setFullName(""); setNationalId(""); setRoles(new Set());
      await load();
    } catch (e) {
      setMsg({ ok: false, text: await describeEdgeError(e) });
    } finally {
      setSaving(false);
    }
  };

  // تعديل أدوار عضو قائم
  const editRoles = async (u, newRoles) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("create-admin-account", {
      body: {
        full_name: u.full_name ?? u.username,
        national_id: u.username,
        admin_roles: newRoles,
      },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (error || data?.error) {
      alert("تعذّر التعديل: " + (data?.error ?? await describeEdgeError(error)));
      return;
    }
    await load();
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">إضافة عضو إدارة</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">الاسم الكامل</label>
            <input className="field mt-1" value={fullName}
                   onChange={(e) => setFullName(e.target.value)}
                   placeholder="مثال: محمد أحمد الحارثي" />
          </div>
          <div>
            <label className="text-xs text-muted">رقم الهوية</label>
            <input className="field num mt-1" inputMode="numeric" maxLength={10}
                   value={nationalId}
                   onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))}
                   placeholder="10 أرقام" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">الأدوار الإدارية</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ASSIGNABLE_ROLES.map((k) => (
              <button key={k} type="button" onClick={() => toggleRole(k)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  roles.has(k) ? "bg-mint-deep text-white"
                               : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {ADMIN_ROLE_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <button className="btn-primary" disabled={!canSubmit || saving} onClick={submit}>
          {saving ? "جارٍ الحفظ…" : "حفظ الحساب"}
        </button>

        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          الأعضاء الحاليون {list && <span className="num text-muted">({list.length})</span>}
        </h2>

        {!list && <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>}
        {list?.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">لا توجد حسابات إدارية بعد.</p>
        )}

        <div className="divide-y divide-line">
          {list?.map((a) => (
            <MemberRow key={a.id} member={a} onSave={editRoles} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberRow({ member, onSave }) {
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState(new Set(member.roles));
  const [busy, setBusy] = useState(false);

  const toggle = (k) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const save = async () => {
    if (sel.size === 0) { alert("اختر دورًا واحدًا على الأقل."); return; }
    setBusy(true);
    await onSave(member, Array.from(sel));
    setBusy(false);
    setEditing(false);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {member.full_name ?? member.username}
          </p>
          <p className="num text-right text-xs text-muted">{member.username}</p>
        </div>

        {!editing && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {member.roles.map((r) => (
                <span key={r} className="chip bg-mint-light text-mint-deep">
                  {ADMIN_ROLE_LABEL[r] ?? r}
                </span>
              ))}
              {!member.is_active && (
                <span className="chip bg-absent/10 text-absent">معطّل</span>
              )}
            </div>
            <button onClick={() => { setSel(new Set(member.roles)); setEditing(true); }}
                    className="shrink-0 text-xs font-medium text-mint-deep hover:underline">
              تعديل الأدوار
            </button>
          </>
        )}
      </div>

      {editing && (
        <div className="mt-3 rounded-sm2 bg-mint-tint/60 p-3">
          <div className="flex flex-wrap gap-2">
            {ASSIGNABLE_ROLES.map((k) => (
              <button key={k} type="button" onClick={() => toggle(k)}
                className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
                  sel.has(k) ? "bg-mint-deep text-white"
                             : "border border-line bg-white text-muted"}`}>
                {ADMIN_ROLE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== الصلاحيات ===================== */

const EDITABLE_ROLES = ASSIGNABLE_ROLES.filter(
  (r) => r !== "principal" && r !== "tech_support"
);

function RolePermissions() {
  const [map, setMap] = useState(null); // role -> Set(permissions)
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("role_permissions").select("role_type, permission");
    const m = {};
    EDITABLE_ROLES.forEach((r) => { m[r] = new Set(); });
    (data ?? []).forEach((r) => {
      (m[r.role_type] ??= new Set()).add(r.permission);
    });
    setMap(m);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (role, perm) => {
    const has = map[role]?.has(perm);
    setSaving(`${role}:${perm}`);
    setMsg(null);

    const { error } = has
      ? await supabase.from("role_permissions").delete()
          .eq("role_type", role).eq("permission", perm)
      : await supabase.from("role_permissions")
          .insert({ role_type: role, permission: perm });

    setSaving(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }

    setMap((prev) => {
      const n = { ...prev };
      const s = new Set(n[role]);
      has ? s.delete(perm) : s.add(perm);
      n[role] = s;
      return n;
    });
  };

  if (!map) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        مدير المدرسة والدعم الفني يملكان صلاحية كاملة دائمًا، ولا يظهران هنا.
      </p>

      {msg && !msg.ok && (
        <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{msg.text}</p>
      )}

      {EDITABLE_ROLES.map((role) => (
        <section key={role} className="card p-4">
          <h3 className="text-sm font-bold text-ink">{ADMIN_ROLE_LABEL[role]}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERMISSIONS.map((p) => {
              const on = map[role]?.has(p.key);
              const busy = saving === `${role}:${p.key}`;
              return (
                <button key={p.key} onClick={() => toggle(role, p.key)} disabled={busy}
                  title={p.desc}
                  className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    on ? "bg-mint-deep text-white"
                       : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tab({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white"
           : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
