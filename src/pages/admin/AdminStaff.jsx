import { useEffect, useMemo, useState } from "react";
import { describeEdgeError } from "../../lib/edgeError.js";
import { supabase } from "../../lib/supabase";
import {
  useSession, ADMIN_ROLE_LABEL, ASSIGNABLE_ROLES, PERMISSIONS,
  CUSTOM_SLOTS, EXTERNAL_ROLES, loadCustomRoles,
} from "../../lib/session.jsx";
import Loader from "../../components/Loader.jsx";
import { ADMIN_GROUPS } from "../../components/Layout.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import DangerZone from "../../components/DangerZone.jsx";
import { SIGNERS, loadSigners } from "../../lib/signers.js";
import { byName } from "../../lib/sortAr.js";


export default function AdminStaff() {
  const { isSuper } = useSession();
  const [tab, setTab] = useState("members");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الإدارة المدرسية</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أعضاء الإدارة وأدوارهم، وصلاحيات كل دور، وأسماء الموقّعين في التقارير.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tab on={tab === "members"} onClick={() => setTab("members")}>الأعضاء</Tab>
        {isSuper && (
          <Tab on={tab === "custom"} onClick={() => setTab("custom")}>الأدوار المخصّصة</Tab>
        )}
        {isSuper && (
          <Tab on={tab === "perms"} onClick={() => setTab("perms")}>الصلاحيات</Tab>
        )}
        {isSuper && (
          <Tab on={tab === "signers"} onClick={() => setTab("signers")}>أسماء الموقّعين</Tab>
        )}
      </div>

      {tab === "members" && <Members />}
      {tab === "custom" && isSuper && <CustomRoles onOpenMembers={() => setTab("members")} />}
      {tab === "perms" && isSuper && <RolePermissions />}
      {tab === "signers" && isSuper && <Signers />}
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
  const [msg, setMsg] = useNotice(null);

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
    setList((admins ?? []).map((a) => ({ ...a, roles: roleMap[a.id] ?? [] })).sort(byName()));
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
                {ADMIN_ROLE_LABEL[k]}{EXTERNAL_ROLES.has(k) && " · من خارج المدرسة"}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-faint">
            لإسناد مهمة لشخص من خارج المدرسة (مثل القائد الكشفي) أضف دورها من تبويب «الأدوار المخصّصة» ثم اختره هنا.
          </p>
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

        {!list && <Loader />}
        {list?.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">لا توجد حسابات إدارية بعد.</p>
        )}

        <div className="divide-y divide-line">
          {list?.map((a) => (
            <MemberRow key={a.id} member={a} onSave={editRoles} onReload={load} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MemberRow({ member, onSave, onReload }) {
  const { session } = useSession();
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
    const ok = await confirmDanger({
      title: `تغيير أدوار ${member.full_name ?? member.username}`,
      impact: [
        `الأدوار الجديدة: ${Array.from(sel).map((k) => ADMIN_ROLE_LABEL[k]).join("، ")}.`,
        "تتغيّر الصفحات والصلاحيات المتاحة لهذا الحساب، وما يصدره من نماذج باسم الدور.",
      ],
      confirmLabel: "حفظ الأدوار",
    });
    if (!ok) return;
    setBusy(true);
    await onSave(member, Array.from(sel));
    setBusy(false);
    setEditing(false);
  };

  // تفعيل الحساب أو تعطيله (admin_set_active في supabase/custom_roles_2.sql)
  const setActive = async (on) => {
    if (!on && !(await confirmDanger({
      title: `تعطيل حساب ${member.full_name ?? member.username}`,
      impact: ["لا يستطيع الدخول إلى البوابة حتى يُعاد تفعيله.", "تبقى أدواره وبياناته كما هي."],
      confirmLabel: "تعطيل الحساب",
    }))) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_active", { p_user: member.id, p_active: on });
    setBusy(false);
    if (error) {
      alert(/admin_set_active/.test(error.message)
        ? "التفعيل يحتاج تنفيذ ملف supabase/custom_roles_2.sql في قاعدة البيانات مرة واحدة."
        : "تعذّر: " + error.message);
      return;
    }
    await onReload();
  };
  const self = member.id === session?.user?.id;

  return (
    <div className={`px-4 py-3 ${member.is_active ? "" : "bg-canvas/60"}`}>
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
                  {ADMIN_ROLE_LABEL[r] ?? r}{EXTERNAL_ROLES.has(r) && " · من خارج المدرسة"}
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
            {!self && (
              <button onClick={() => setActive(!member.is_active)} disabled={busy}
                      className={`shrink-0 text-xs font-medium hover:underline ${member.is_active ? "text-absent" : "text-present"}`}>
                {member.is_active ? "تعطيل" : "تفعيل"}
              </button>
            )}
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
                {ADMIN_ROLE_LABEL[k]}{EXTERNAL_ROLES.has(k) && " · من خارج المدرسة"}
              </button>
            ))}
          </div>
          <DangerZone className="mt-3 p-2" note="يغيّر صلاحيات هذا الحساب في البوابة">
            <div className="flex gap-2">
              <button className="btn-primary" onClick={save} disabled={busy}>
                {busy ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button className="btn-ghost" onClick={() => setEditing(false)}>إلغاء</button>
            </div>
          </DangerZone>
        </div>
      )}
    </div>
  );
}

/* ===================== الأدوار المخصّصة ===================== */

/* =====================================================================
   أدوار يضيفها المدير أو الدعم الفني بلا برمجة (supabase/custom_roles_*.sql):
   اسم الدور، وهل هو لشخص من خارج المدرسة، وصلاحياته. يُحفظ في أول خانة
   فارغة من custom_1..custom_10، ثم يُسند لشخص من تبويب «الأعضاء».
   ===================================================================== */

// صلاحيات لا تُمنح لدور مخصّص: تمسّ الحسابات والنظام
const CUSTOM_BLOCKED = ["accounts", "staff", "password_reset", "import", "records"];
const CUSTOM_PERMS = PERMISSIONS.filter((p) => !CUSTOM_BLOCKED.includes(p.key));
const CUSTOM_PRESETS = [
  { label: "القائد الكشفي", external: true, perms: ["scouts", "students", "news", "notifications"],
    note: "القائد الكشفي الداعم للفريق الكشفي بالمدرسة" },
];
const BLANK = { slot: null, label: "", external: false, note: "", perms: new Set() };

function CustomRoles({ onOpenMembers }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);
  const [form, setForm] = useState(null);   // null = مغلق، وإلا BLANK أو دور قيد التعديل
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = async () => {
    const [{ data, error }, { data: perms }, { data: holders }] = await Promise.all([
      supabase.from("custom_roles").select("*").order("created_at"),
      supabase.from("role_permissions").select("role_type, permission").in("role_type", CUSTOM_SLOTS),
      supabase.from("admin_roles").select("role_type").in("role_type", CUSTOM_SLOTS),
    ]);
    if (error) { setMissing(true); setRows([]); return; }
    const p = {}; (perms ?? []).forEach((r) => (p[r.role_type] ??= new Set()).add(r.permission));
    const n = {}; (holders ?? []).forEach((r) => { n[r.role_type] = (n[r.role_type] ?? 0) + 1; });
    setRows((data ?? []).map((r) => ({ ...r, perms: p[r.role_type] ?? new Set(), n: n[r.role_type] ?? 0 })));
  };
  useEffect(() => { load(); }, []);

  const togglePerm = (k) => setForm((f) => {
    const s = new Set(f.perms); s.has(k) ? s.delete(k) : s.add(k);
    return { ...f, perms: s };
  });

  const save = async () => {
    const label = form.label.trim();
    if (label.length < 2) { setMsg({ ok: false, text: "اكتب اسم الدور." }); return; }
    if ((rows ?? []).some((r) => r.label === label && r.role_type !== form.slot)) {
      setMsg({ ok: false, text: "يوجد دور بهذا الاسم." }); return;
    }
    const slot = form.slot ?? CUSTOM_SLOTS.find((k) => !(rows ?? []).some((r) => r.role_type === k));
    if (!slot) { setMsg({ ok: false, text: "اكتملت الخانات العشر. احذف دورًا غير مُسند لإضافة غيره." }); return; }
    setBusy(true);
    const { error } = await supabase.from("custom_roles")
      .upsert({ role_type: slot, label, external: form.external, note: form.note.trim() || null });
    let e2 = null;
    if (!error) {
      ({ error: e2 } = await supabase.from("role_permissions").delete().eq("role_type", slot));
      if (!e2 && form.perms.size) {
        ({ error: e2 } = await supabase.from("role_permissions")
          .insert([...form.perms].map((permission) => ({ role_type: slot, permission }))));
      }
    }
    setBusy(false);
    if (error || e2) { setMsg({ ok: false, text: (error || e2).message }); return; }
    await loadCustomRoles();
    setMsg({ ok: true, text: form.slot ? `حُفظ دور «${label}».` : `أُضيف دور «${label}». أسنده الآن لصاحبه من تبويب «الأعضاء».` });
    setForm(null);
    load();
  };

  const remove = async (r) => {
    if (!(await confirmDanger({
      title: `حذف دور «${r.label}»`,
      impact: ["يُحذف الدور وصلاحياته، وتصبح خانته متاحة لدور آخر."],
      confirmLabel: "حذف الدور",
    }))) return;
    await supabase.from("role_permissions").delete().eq("role_type", r.role_type);
    const { error } = await supabase.from("custom_roles").delete().eq("role_type", r.role_type);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    await loadCustomRoles();
    load();
  };

  if (!rows) return <Loader />;
  if (missing) return (
    <div className="card px-6 py-10 text-center text-sm text-muted">
      الأدوار المخصّصة تحتاج تنفيذ الملفين supabase/custom_roles_1.sql ثم custom_roles_2.sql في قاعدة البيانات مرة واحدة.
    </div>
  );

  const pill = (on) => `rounded-pill px-3 py-1.5 text-xs font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink">الأدوار المخصّصة</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              أدوار خارج القائمة الثابتة، لمنسوب في المدرسة أو لشخص من خارجها مثل القائد الكشفي.
              أضف الدور وصلاحياته هنا، ثم أسنده لصاحبه وفعّل حسابه من تبويب «الأعضاء».
            </p>
          </div>
          {!form && (
            <button className="btn-primary shrink-0" onClick={() => setForm(BLANK)}
                    disabled={rows.length >= CUSTOM_SLOTS.length}>+ إضافة دور</button>
          )}
        </div>

        {form && (
          <div className="space-y-3 rounded-sm2 bg-mint-tint/50 p-3">
            {!form.slot && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted">قالب جاهز:</span>
                {CUSTOM_PRESETS.map((t) => (
                  <button key={t.label} type="button" className={pill(false)}
                          onClick={() => setForm({ ...form, label: t.label, external: t.external, note: t.note, perms: new Set(t.perms) })}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted">اسم الدور</label>
                <input className="field mt-1" value={form.label} maxLength={60}
                       onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="مثال: القائد الكشفي" />
              </div>
              <div>
                <label className="text-xs text-muted">وصف مختصر (اختياري)</label>
                <input className="field mt-1" value={form.note}
                       onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="مثال: الداعم للفريق الكشفي بالمدرسة" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.external} onChange={(e) => setForm({ ...form, external: e.target.checked })} />
              من خارج المدرسة
            </label>
            <div>
              <label className="text-xs text-muted">الصلاحيات</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {CUSTOM_PERMS.map((p) => (
                  <button key={p.key} type="button" title={p.desc} className={pill(form.perms.has(p.key))}
                          onClick={() => togglePerm(p.key)}>{p.label}</button>
                ))}
              </div>
              <p className="mt-1.5 text-[11.5px] text-faint">
                الأحداث والمناسبات وإصدار النماذج والشهادات متاحة لكل حساب إداري دون صلاحية.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ الدور"}</button>
              <button className="btn-ghost" onClick={() => setForm(null)}>إلغاء</button>
            </div>
          </div>
        )}

        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
            {msg.ok && !form && <button onClick={onOpenMembers} className="ms-2 font-semibold underline">الأعضاء</button>}
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        {rows.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا أدوار مخصّصة بعد.</p>}
        <div className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.role_type} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{r.label}</p>
                {r.external && <span className="chip bg-warning-light text-warning">من خارج المدرسة</span>}
                <span className="text-xs text-muted">{r.n ? `مُسند لـ ${r.n}` : "غير مُسند"}</span>
                <button className="ms-auto text-xs font-medium text-mint-deep hover:underline"
                        onClick={() => setForm({ slot: r.role_type, label: r.label, external: r.external, note: r.note ?? "", perms: new Set(r.perms) })}>
                  تعديل
                </button>
                {r.n === 0 && (
                  <button className="text-xs font-medium text-absent hover:underline" onClick={() => remove(r)}>حذف</button>
                )}
              </div>
              {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {[...r.perms].map((k) => <span key={k} className="chip bg-mint-light text-mint-deep">{permByKey[k]?.label ?? k}</span>)}
                {r.perms.size === 0 && <span className="text-[11.5px] text-faint">بلا صلاحيات إضافية</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ===================== الصلاحيات ===================== */

// دالة لا ثابت: الأدوار المخصّصة تُضاف إلى ASSIGNABLE_ROLES أثناء العمل
const editableRoles = () => ASSIGNABLE_ROLES.filter(
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
    keys: ["circulars", "banners", "news", "guides", "notifications", "feedback"] },
  { title: "النشاط",
    keys: ["scouts"] },
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
// كل صلاحية تظهر في لوحتها: ما لم يُذكر في الأقسام أعلاه يُجمع في «أخرى»
const PERM_SECTIONS = (() => {
  const listed = new Set(PERM_GROUPS.flatMap((g) => g.keys));
  const rest = PERMISSIONS.map((p) => p.key).filter((k) => !listed.has(k));
  return rest.length ? [...PERM_GROUPS, { title: "أخرى", keys: rest }] : PERM_GROUPS;
})();

/* ظهور صفحات القائمة لكل دور: «hide:/مسار» في role_permissions يُخفي الصفحة (والظهور هو الأصل).
   وما لا يتاح للدور أصلًا (لأدوار بعينها، أو يحتاج صلاحية غير ممنوحة) يُعرض معطّلًا بسببه. */
const HIDE = "hide:";
const isHide = (k) => k.startsWith(HIDE);
const NAV_SECTIONS = ADMIN_GROUPS.map((g) => ({ title: g.title ?? "عام", items: g.items.filter((i) => i.to !== "/") }))
  .filter((g) => g.items.length);
function navReason(i, role, sel) {
  if (i.techOnly) return "للدعم الفني فقط";
  if (i.manageForms) return "للمدير والدعم الفني";
  if (i.roles && !i.roles.includes(role)) return "لأدوار محددة فقط";
  if (i.hideForRoles?.includes(role)) return "لا يظهر لهذا الدور";
  if (i.perm && !sel.has(i.perm)) return `يحتاج صلاحية «${permByKey[i.perm]?.label ?? i.perm}»`;
  if (i.anyPerm && !i.anyPerm.some((p) => sel.has(p))) return `يحتاج صلاحية «${i.anyPerm.map((p) => permByKey[p]?.label ?? p).join("» أو «")}»`;
  return null;
}

function RolePermissions() {
  const [map, setMap] = useState(null);        // role -> Set(permissions)
  const [role, setRole] = useState(null);      // الدور المفتوح
  const [sel, setSel] = useState(new Set());   // صلاحياته قيد التحرير
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [copyFrom, setCopyFrom] = useState("");

  const load = async () => {
    const { data } = await supabase.from("role_permissions").select("role_type, permission");
    const m = {};
    editableRoles().forEach((r) => { m[r] = new Set(); });
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
    const cur = map[role] ?? new Set();
    const add = [...sel].filter((p) => !cur.has(p));
    const del = [...cur].filter((p) => !sel.has(p));
    const ok = await confirmDanger({
      title: `صلاحيات دور «${ADMIN_ROLE_LABEL[role] ?? role}»`,
      impact: [
        `تتغيّر صلاحيات كل من يحمل هذا الدور فورًا: تُضاف ${add.length} وتُزال ${del.length}.`,
        "إزالة صلاحية تُخفي صفحتها عنهم، وإضافتها تفتح لهم تعديل بياناتها.",
      ],
      confirmLabel: "حفظ الصلاحيات",
    });
    if (!ok) return;
    setSaving(true);
    setMsg(null);

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
    if (!t) return editableRoles();
    return editableRoles().filter((r) => (ADMIN_ROLE_LABEL[r] ?? r).includes(t));
  }, [q]);

  if (!map) return <Loader compact />;

  return (
    <div className="space-y-4">
      <p className="rounded-card border border-mint-light bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
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
                    {[...(map[r] ?? [])].filter((k) => !isHide(k)).length} صلاحية
                    {[...(map[r] ?? [])].some(isHide) && <> · {[...map[r]].filter(isHide).length} صفحة مخفية</>}
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
                    المحدّد: {[...sel].filter((k) => !isHide(k)).length} من {PERMISSIONS.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setSel(new Set([...PERMISSIONS.map((p) => p.key), ...[...sel].filter(isHide)]))}
                          className="rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
                    الكل
                  </button>
                  <button onClick={() => setSel(new Set([...sel].filter(isHide)))}
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
                    <button key={pr.key} onClick={() => setSel(new Set([...pr.perms, ...[...sel].filter(isHide)]))}
                            className="rounded-pill bg-white px-3 py-1 text-xs font-medium text-mint-deep ring-1 ring-mint-light hover:bg-mint-tint">
                      {pr.label}
                    </button>
                  ))}
                </div>

                <p className="mt-3 text-[11px] font-semibold text-faint">أو انسخ من دور آخر</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <select className="field flex-1" value={copyFrom}
                          onChange={(e) => setCopyFrom(e.target.value)}>
                    <option value="">اختر الدور…</option>
                    {editableRoles().filter((r) => r !== role).map((r) => (
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
              {PERM_SECTIONS.map((g) => {
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
                              on ? "border-mint-light bg-mint-tint/50" : "border-line"}`}>
                            <span className="min-w-0">
                              <span className="block text-sm text-ink">{p.label}</span>
                              <span className="block text-[11px] leading-tight text-faint">{p.desc}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className={`text-xs font-medium ${on ? "text-mint-deep" : "text-faint"}`}>
                                {on ? "نشطة" : "متوقفة"}
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

              {/* ظهور الصفحات: تحديد مخصص لكل صفحة في القائمة وبطاقات الأقسام */}
              <details className="rounded-card border border-line">
                <summary className="cursor-pointer list-none px-3.5 py-3">
                  <span className="text-sm font-bold text-ink">ظهور الصفحات في القائمة</span>
                  <span className="mr-2 num text-[11px] text-faint">({[...sel].filter(isHide).length} مخفية)</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    حدّد بدقة ما يظهر لهذا الدور من صفحات القائمة وبطاقات الأقسام وما لا يظهر، فوق الصلاحيات أعلاه.
                  </span>
                </summary>
                <div className="space-y-3 border-t border-line p-3">
                  {NAV_SECTIONS.map((g) => {
                    const open = g.items.filter((i) => !navReason(i, role, sel));
                    const allOn = open.every((i) => !sel.has(HIDE + i.to));
                    return (
                      <div key={g.title}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-faint">{g.title}</p>
                          {open.length > 0 && (
                            <button className="text-[11px] font-medium text-mint-deep hover:underline"
                                    onClick={() => setSel((prev) => { const n = new Set(prev); open.forEach((i) => (allOn ? n.add(HIDE + i.to) : n.delete(HIDE + i.to))); return n; })}>
                              {allOn ? "إخفاء القسم" : "إظهار القسم"}
                            </button>
                          )}
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {g.items.map((i) => {
                            const why = navReason(i, role, sel);
                            const on = !why && !sel.has(HIDE + i.to);
                            return (
                              <label key={i.to} className={`flex items-center justify-between gap-2 rounded-sm2 border px-3 py-2 ${
                                why ? "cursor-not-allowed border-line bg-canvas opacity-60" : on ? "cursor-pointer border-mint-light bg-mint-tint/40" : "cursor-pointer border-line"}`}>
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] text-ink">{i.label}</span>
                                  {why && <span className="block text-[10.5px] leading-tight text-faint">{why}</span>}
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  <span className={`text-[11px] ${on ? "text-mint-deep" : "text-faint"}`}>{why ? "غير متاحة" : on ? "تظهر" : "مخفية"}</span>
                                  <input type="checkbox" disabled={!!why} checked={on} onChange={() => toggle(HIDE + i.to)} />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] leading-relaxed text-faint">
                    الإخفاء يخص القائمة وبطاقات الأقسام. ومن يجمع أكثر من دور تظهر له الصفحة إن ظهرت لأحد أدواره.
                  </p>
                </div>
              </details>

              {msg && (
                <p className={`rounded-sm2 px-3 py-2 text-sm ${
                  msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                  {msg.text}
                </p>
              )}

              <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-line bg-white px-4 py-3">
              <DangerZone className="p-2" note="يغيّر صلاحيات كل من يحمل هذا الدور">
              <div className="flex items-center gap-2">
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
              </DangerZone>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ===================== أسماء الموقّعين ===================== */

function Signers() {
  const [names, setNames] = useState(null);
  const [saved, setSaved] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useNotice(null);

  useEffect(() => {
    loadSigners(true).then((m) => { setNames(m); setSaved(m); });
  }, []);

  const dirty = names && SIGNERS.some((s) => names[s.key].trim() !== saved[s.key]);
  const valid = names && SIGNERS.every((s) => names[s.key].trim().length >= 3);

  const save = async () => {
    const ok = await confirmDanger({
      title: "أسماء الموقّعين في التقارير",
      impact: ["تظهر الأسماء الجديدة فورًا في كل التقارير والشهادات المطبوعة من البوابة."],
      confirmLabel: "حفظ الأسماء",
    });
    if (!ok) return;
    setSaving(true);
    const rows = SIGNERS.map((s) => ({
      key: s.key, value: names[s.key].trim(), updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    const m = await loadSigners(true);
    setNames(m); setSaved(m);
    setMsg({ ok: true, text: "حُفظت الأسماء، وتظهر في التقارير المطبوعة من الآن." });
  };

  if (!names) return <Loader compact />;

  return (
    <section className="card space-y-4 p-4">
      <p className="text-sm leading-relaxed text-muted">
        الأسماء التي تظهر تحت التوقيعات في التقارير والجداول المطبوعة.
        اكتب الاسم كما يُراد طباعته.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SIGNERS.map((s) => (
          <label key={s.key} className="block">
            <span className="text-xs text-muted">{s.label}</span>
            <input className="field mt-1 w-full" value={names[s.key]}
                   onChange={(e) => setNames({ ...names, [s.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <DangerZone className="p-2" note="الأسماء تُطبع في كل تقارير البوابة وشهاداتها">
        <button className="btn-primary" onClick={save} disabled={saving || !dirty || !valid}>
          {saving ? "جارٍ الحفظ…" : dirty ? "حفظ الأسماء" : "لا تغييرات"}
        </button>
      </DangerZone>
      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}
    </section>
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
