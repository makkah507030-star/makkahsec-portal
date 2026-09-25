import { useEffect, useMemo, useState } from "react";
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

/* =====================================================================
   لوحة الصلاحيات — مصفوفة: الأدوار أعمدة، والصلاحيات صفوف.
   أدوات التسريع: تحديد صف أو عمود كاملًا، ونسخ صلاحيات دور لآخر،
   وقوالب جاهزة لكل نوع دور، وبحث يصفّي الصلاحيات.
   وفي الجوال: دور واحد وقائمة صلاحياته، فالمصفوفة لا تصلح لشاشة ضيقة.
   ===================================================================== */

// قوالب جاهزة: ما يحتاجه كل نوع دور عادةً
const PRESETS = [
  { key: "deputy",    label: "وكيل",
    perms: ["students", "records", "reports", "home_stats", "permissions",
            "schedules", "calendar", "notifications", "login_log"] },
  { key: "counselor", label: "موجه طلابي",
    perms: ["students", "reports", "permissions", "notifications", "feedback"] },
  { key: "clerk",     label: "مساعد إداري",
    perms: ["students", "records", "permissions", "schedules"] },
  { key: "lab",       label: "محضّر",
    perms: ["students", "schedules"] },
  { key: "activity",  label: "رائد نشاط",
    perms: ["students", "news", "notifications", "guides"] },
  { key: "media",     label: "إعلامي",
    perms: ["news", "guides"] },
];

function RolePermissions() {
  const [map, setMap] = useState(null);          // role -> Set(permissions)
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState("");
  const [mobileRole, setMobileRole] = useState(EDITABLE_ROLES[0]);
  const [copyFrom, setCopyFrom] = useState("");

  const load = async () => {
    const { data } = await supabase.from("role_permissions").select("role_type, permission");
    const m = {};
    EDITABLE_ROLES.forEach((r) => { m[r] = new Set(); });
    (data ?? []).forEach((r) => { (m[r.role_type] ??= new Set()).add(r.permission); });
    setMap(m);
  };

  useEffect(() => { load(); }, []);

  const perms = useMemo(() => {
    const t = q.trim();
    return t ? PERMISSIONS.filter((p) => p.label.includes(t) || p.desc.includes(t)) : PERMISSIONS;
  }, [q]);

  // كتابة مجموعة صلاحيات لدور دفعة واحدة
  const writeRole = async (role, next) => {
    setSaving(role);
    setMsg(null);
    const cur = map[role] ?? new Set();
    const add = [...next].filter((p) => !cur.has(p));
    const del = [...cur].filter((p) => !next.has(p));

    if (del.length) {
      await supabase.from("role_permissions").delete()
        .eq("role_type", role).in("permission", del);
    }
    if (add.length) {
      await supabase.from("role_permissions")
        .insert(add.map((permission) => ({ role_type: role, permission })));
    }
    setMap((prev) => ({ ...prev, [role]: next }));
    setSaving(null);
  };

  const toggle = async (role, perm) => {
    const cur = new Set(map[role] ?? []);
    cur.has(perm) ? cur.delete(perm) : cur.add(perm);
    await writeRole(role, cur);
  };

  const toggleColumn = async (role) => {
    const cur = map[role] ?? new Set();
    const all = PERMISSIONS.every((p) => cur.has(p.key));
    await writeRole(role, all ? new Set() : new Set(PERMISSIONS.map((p) => p.key)));
  };

  const toggleRow = async (perm) => {
    const all = EDITABLE_ROLES.every((r) => map[r]?.has(perm));
    setSaving(perm);
    for (const r of EDITABLE_ROLES) {
      const cur = new Set(map[r] ?? []);
      all ? cur.delete(perm) : cur.add(perm);
      await writeRole(r, cur);
    }
    setSaving(null);
  };

  const applyPreset = async (role, preset) => {
    await writeRole(role, new Set(preset.perms));
    setMsg({ ok: true, text: `طُبّق قالب «${preset.label}» على ${ADMIN_ROLE_LABEL[role]}.` });
  };

  const copyTo = async (role) => {
    if (!copyFrom || copyFrom === role) return;
    await writeRole(role, new Set(map[copyFrom] ?? []));
    setMsg({ ok: true, text:
      `نُسخت صلاحيات ${ADMIN_ROLE_LABEL[copyFrom]} إلى ${ADMIN_ROLE_LABEL[role]}.` });
  };

  if (!map) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  const count = (r) => (map[r]?.size ?? 0);

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        مدير المدرسة والدعم الفني يملكان صلاحية كاملة دائمًا، ولا يظهران هنا.
        وكل تغيير يُحفظ فور الضغط.
      </p>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input className="field min-w-[180px] flex-1" type="search" value={q}
               placeholder="ابحث في الصلاحيات" onChange={(e) => setQ(e.target.value)} />
        <select className="field" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">نسخ صلاحيات من…</option>
          {EDITABLE_ROLES.map((r) => (
            <option key={r} value={r}>{ADMIN_ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
      </div>

      {/* ——— المصفوفة: المتصفح ——— */}
      <div className="hidden overflow-x-auto rounded-card border border-line bg-white lg:block">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky right-0 z-20 min-w-[190px] border-b border-l border-line bg-white p-2.5 text-right">
                <span className="text-[11px] font-bold text-faint">الصلاحية \ الدور</span>
              </th>
              {EDITABLE_ROLES.map((r) => (
                <th key={r} className="border-b border-line bg-canvas p-2 align-bottom">
                  <div className="mx-auto w-[92px]">
                    <p className="text-[11px] font-bold leading-tight text-ink">
                      {ADMIN_ROLE_LABEL[r] ?? r}
                    </p>
                    <p className="num mt-0.5 text-[10px] text-faint">{count(r)} صلاحية</p>
                    <button onClick={() => toggleColumn(r)} disabled={saving}
                            className="mt-1.5 w-full rounded-pill border border-line bg-white px-2 py-0.5 text-[10px] text-muted hover:border-mint-deep hover:text-mint-deep">
                      {PERMISSIONS.every((p) => map[r]?.has(p.key)) ? "إلغاء الكل" : "تحديد الكل"}
                    </button>
                    {copyFrom && copyFrom !== r && (
                      <button onClick={() => copyTo(r)} disabled={saving}
                              className="mt-1 w-full rounded-pill bg-mint-tint px-2 py-0.5 text-[10px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
                        لصق هنا
                      </button>
                    )}
                    <select className="mt-1 w-full rounded-sm2 border border-line bg-white px-1 py-0.5 text-[10px] text-muted"
                            value="" onChange={(e) => {
                              const pr = PRESETS.find((x) => x.key === e.target.value);
                              if (pr) applyPreset(r, pr);
                            }}>
                      <option value="">قالب…</option>
                      {PRESETS.map((pr) => (
                        <option key={pr.key} value={pr.key}>{pr.label}</option>
                      ))}
                    </select>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perms.map((p) => {
              const all = EDITABLE_ROLES.every((r) => map[r]?.has(p.key));
              return (
                <tr key={p.key} className="hover:bg-mint-tint/40">
                  <td className="sticky right-0 z-10 border-b border-l border-line bg-white p-2.5 text-right">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12.5px] font-semibold text-ink">{p.label}</p>
                        <p className="mt-0.5 text-[10.5px] leading-tight text-faint">{p.desc}</p>
                      </div>
                      <button onClick={() => toggleRow(p.key)} disabled={saving}
                              title={all ? "إلغاؤها من الجميع" : "منحها للجميع"}
                              className="shrink-0 rounded-pill border border-line px-2 py-0.5 text-[10px] text-muted hover:border-mint-deep hover:text-mint-deep">
                        {all ? "إلغاء" : "للجميع"}
                      </button>
                    </div>
                  </td>
                  {EDITABLE_ROLES.map((r) => {
                    const on = map[r]?.has(p.key);
                    return (
                      <td key={r} className="border-b border-line p-0 text-center">
                        <button onClick={() => toggle(r, p.key)} disabled={saving === r}
                          aria-label={`${p.label} — ${ADMIN_ROLE_LABEL[r]}`}
                          className={`grid h-11 w-full place-items-center transition-colors ${
                            on ? "bg-mint-deep/10 hover:bg-mint-deep/20" : "hover:bg-canvas"}`}>
                          <span className={`grid h-5 w-5 place-items-center rounded-[6px] border text-[11px] font-bold transition-colors ${
                            on ? "border-mint-deep bg-mint-deep text-white"
                               : "border-line bg-white text-transparent"}`}>
                            ✓
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ——— الجوال: دور واحد وقائمة صلاحياته ——— */}
      <div className="space-y-3 lg:hidden">
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {EDITABLE_ROLES.map((r) => (
            <button key={r} onClick={() => setMobileRole(r)}
              className={`shrink-0 rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                mobileRole === r ? "bg-mint-deep text-white"
                                 : "border border-line bg-white text-muted"}`}>
              {ADMIN_ROLE_LABEL[r] ?? r}
              <span className="num opacity-70"> ({count(r)})</span>
            </button>
          ))}
        </div>

        <div className="card p-3">
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => toggleColumn(mobileRole)} disabled={saving}
                    className="rounded-pill border border-line px-3 py-1 text-xs text-muted">
              {PERMISSIONS.every((p) => map[mobileRole]?.has(p.key)) ? "إلغاء الكل" : "تحديد الكل"}
            </button>
            {PRESETS.map((pr) => (
              <button key={pr.key} onClick={() => applyPreset(mobileRole, pr)} disabled={saving}
                      className="rounded-pill bg-mint-tint px-3 py-1 text-xs font-medium text-mint-deep">
                {pr.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card divide-y divide-line overflow-hidden">
          {perms.map((p) => {
            const on = map[mobileRole]?.has(p.key);
            return (
              <button key={p.key} onClick={() => toggle(mobileRole, p.key)} disabled={saving}
                      className="flex w-full items-center gap-3 px-4 py-3 text-right">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border text-[11px] font-bold ${
                  on ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-transparent"}`}>
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{p.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-tight text-faint">{p.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
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
