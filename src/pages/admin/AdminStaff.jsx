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
   لوحة الصلاحيات — على نمط «صلاحيات المعلمين»:
   قائمة الأدوار على اليمين، ولوحة الدور المختار وحده على اليسار،
   وصلاحياته مجمّعة بأقسام البوابة. بلا مصفوفة ولا تمرير أفقي.
   ===================================================================== */

// تجميع الصلاحيات بأقسام البوابة
const PERM_GROUPS = [
  { title: "شؤون الطلاب",
    keys: ["students", "records", "results", "reports", "permissions", "home_stats"] },
  { title: "الشؤون التعليمية",
    keys: ["schedules", "import", "calendar"] },
  { title: "المحتوى والتواصل",
    keys: ["news", "guides", "notifications", "feedback"] },
  { title: "الحسابات والنظام",
    keys: ["accounts", "staff", "password_reset", "login_log"] },
];

// قوالب جاهزة لكل نوع دور
const PRESETS = [
  { key: "deputy",    label: "وكيل",
    perms: ["students", "records", "reports", "home_stats", "permissions",
            "schedules", "calendar", "notifications", "login_log"] },
  { key: "counselor", label: "موجه طلابي",
    perms: ["students", "reports", "permissions", "notifications", "feedback"] },
  { key: "clerk",     label: "مساعد إداري",
    perms: ["students", "records", "permissions", "schedules"] },
  { key: "lab",       label: "محضّر",      perms: ["students", "schedules"] },
  { key: "activity",  label: "رائد نشاط",  perms: ["students", "news", "notifications", "guides"] },
  { key: "media",     label: "إعلامي",     perms: ["news", "guides"] },
];

const permByKey = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p]));

function RolePermissions() {
  const [map, setMap] = useState(null);        // role -> Set(permissions)
  const [role, setRole] = useState(null);      // الدور المفتوح
  const [sel, setSel] = useState(new Set());   // صلاحياته قيد التحرير
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copyFrom, setCopyFrom] = useState("");

  const load = async () => {
    const { data } = await supabase.from("role_permissions").select("role_type, permission");
    const m = {};
    EDITABLE_ROLES.forEach((r) => { m[r] = new Set(); });
    (data ?? []).forEach((r) => { (m[r.role_type] ??= new Set()).add(r.permission); });
    setMap(m);
    return m;
  };

  useEffect(() => { load(); }, []);

  const pick = (r) => {
    setRole(r);
    setSel(new Set(map?.[r] ?? []));
    setMsg(null);
    setCopyFrom("");
  };

  const toggle = (k) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const toggleGroup = (keys) => {
    const inGroup = keys.filter((k) => permByKey[k]);
    const all = inGroup.every((k) => sel.has(k));
    setSel((prev) => {
      const n = new Set(prev);
      inGroup.forEach((k) => (all ? n.delete(k) : n.add(k)));
      return n;
    });
  };

  const save = async () => {
    if (!role) return;
    setSaving(true);
    setMsg(null);
    const cur = map[role] ?? new Set();
    const add = [...sel].filter((p) => !cur.has(p));
    const del = [...cur].filter((p) => !sel.has(p));

    if (del.length) {
      const { error } = await supabase.from("role_permissions").delete()
        .eq("role_type", role).in("permission", del);
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    }
    if (add.length) {
      const { error } = await supabase.from("role_permissions")
        .insert(add.map((permission) => ({ role_type: role, permission })));
      if (error) { setMsg({ ok: false, text: error.message }); setSaving(false); return; }
    }

    setMap((prev) => ({ ...prev, [role]: new Set(sel) }));
    setSaving(false);
    setMsg({ ok: true, text: "حُفظت الصلاحيات." });
  };

  const dirty = useMemo(() => {
    if (!role || !map) return false;
    const cur = map[role] ?? new Set();
    return cur.size !== sel.size || [...sel].some((k) => !cur.has(k));
  }, [role, map, sel]);

  const filteredRoles = useMemo(() => {
    const t = q.trim();
    if (!t) return EDITABLE_ROLES;
    return EDITABLE_ROLES.filter((r) => (ADMIN_ROLE_LABEL[r] ?? r).includes(t));
  }, [q]);

  if (!map) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        اختر دورًا من القائمة، وحدّد صلاحياته، ثم احفظ.
        ومدير المدرسة والدعم الفني يملكان صلاحية كاملة دائمًا ولا يظهران هنا.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] lg:items-start">

        {/* ——— قائمة الأدوار ——— */}
        <section className="card overflow-hidden lg:sticky lg:top-20">
          <div className="border-b border-line p-3">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="فلترة بالدور" />
          </div>
          <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {filteredRoles.map((r) => (
              <button key={r} onClick={() => pick(r)}
                className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-right transition-colors ${
                  role === r ? "bg-mint-tint" : "hover:bg-canvas"}`}>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {ADMIN_ROLE_LABEL[r] ?? r}
                  </span>
                  <span className="num block text-[11px] text-faint">
                    {(map[r]?.size ?? 0)} صلاحية
                  </span>
                </span>
                {role === r && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-deep" />}
              </button>
            ))}
          </div>
        </section>

        {/* ——— لوحة الدور المختار ——— */}
        <section className="card min-h-[20rem] space-y-4 p-4">
          {!role ? (
            <p className="py-10 text-center text-sm text-muted">اختر دورًا من القائمة.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">{ADMIN_ROLE_LABEL[role] ?? role}</h2>
                  <p className="num text-xs text-muted">
                    المحدّد: {sel.size} من {PERMISSIONS.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setSel(new Set(PERMISSIONS.map((p) => p.key)))}
                          className="rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
                    الكل
                  </button>
                  <button onClick={() => setSel(new Set())}
                          className="rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
                    مسح
                  </button>
                </div>
              </div>

              {/* قوالب ونسخ */}
              <div className="rounded-sm2 bg-canvas p-3">
                <p className="text-[11px] font-semibold text-faint">قالب جاهز</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRESETS.map((pr) => (
                    <button key={pr.key} onClick={() => setSel(new Set(pr.perms))}
                            className="rounded-pill bg-white px-3 py-1 text-xs font-medium text-mint-deep ring-1 ring-[#CCF2DB] hover:bg-mint-tint">
                      {pr.label}
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-[11px] font-semibold text-faint">أو انسخ من دور آخر</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <select className="field flex-1" value={copyFrom}
                          onChange={(e) => setCopyFrom(e.target.value)}>
                    <option value="">اختر الدور…</option>
                    {EDITABLE_ROLES.filter((r) => r !== role).map((r) => (
                      <option key={r} value={r}>
                        {ADMIN_ROLE_LABEL[r] ?? r} ({map[r]?.size ?? 0})
                      </option>
                    ))}
                  </select>
                  <button disabled={!copyFrom}
                          onClick={() => setSel(new Set(map[copyFrom] ?? []))}
                          className="rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                    نسخ
                  </button>
                </div>
              </div>

              {/* الصلاحيات بأقسامها */}
              {PERM_GROUPS.map((g) => {
                const keys = g.keys.filter((k) => permByKey[k]);
                if (!keys.length) return null;
                const all = keys.every((k) => sel.has(k));
                return (
                  <div key={g.title}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-faint">{g.title}</p>
                      <button onClick={() => toggleGroup(keys)}
                              className="text-[11px] font-medium text-mint-deep hover:underline">
                        {all ? "إلغاء القسم" : "تحديد القسم"}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {keys.map((k) => {
                        const p = permByKey[k];
                        const on = sel.has(k);
                        return (
                          <label key={k}
                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-sm2 border px-3.5 py-2.5 transition-colors ${
                              on ? "border-[#CCF2DB] bg-mint-tint/50" : "border-line"}`}>
                            <span className="min-w-0">
                              <span className="block text-sm text-ink">{p.label}</span>
                              <span className="block text-[11px] leading-tight text-faint">{p.desc}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className={`text-xs font-medium ${on ? "text-mint-deep" : "text-faint"}`}>
                                {on ? "ممنوحة" : "معطَّلة"}
                              </span>
                              <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {msg && (
                <p className={`rounded-sm2 px-3 py-2 text-sm ${
                  msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                  {msg.text}
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-2 border-t border-line bg-white px-4 py-3">
                <button className="btn-primary flex-1" onClick={save} disabled={saving || !dirty}>
                  {saving ? "جارٍ الحفظ…" : dirty ? "حفظ الصلاحيات" : "لا تغييرات"}
                </button>
                {dirty && (
                  <button onClick={() => setSel(new Set(map[role] ?? []))}
                          className="rounded-pill border border-line px-4 py-2 text-sm text-muted">
                    تراجع
                  </button>
                )}
              </div>
            </>
          )}
        </section>
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
