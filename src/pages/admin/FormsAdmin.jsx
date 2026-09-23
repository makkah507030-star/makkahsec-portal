// src/pages/admin/FormsAdmin.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";

/* =====================================================================
   إدارة النماذج — للدعم الفني ومدير المدرسة:
   الصلاحيات لكل نموذج، والاعتماد، والتوقيع المطبوع، وختم المدرسة.
   ===================================================================== */

const ROLES = [
  { key: "principal",    label: "مدير المدرسة" },
  { key: "tech_support", label: "الدعم الفني" },
  { key: "admin",        label: "الإدارة" },
  { key: "teacher",      label: "المعلمون" },
];

const SIGN_SOURCE = [
  { key: "none",      label: "بلا توقيع" },
  { key: "issuer",    label: "توقيع المُصدِر" },
  { key: "principal", label: "توقيع المدير" },
  { key: "both",      label: "التوقيعان معًا" },
];

const CAT = { certificate: "شهادة", official: "رسمي", administrative: "إداري" };

const CATEGORIES = [
  { key: "certificate",    label: "شهادة",     orientation: "landscape" },
  { key: "official",       label: "خطاب رسمي", orientation: "portrait" },
  { key: "administrative", label: "نموذج إداري", orientation: "portrait" },
];

// المستفيد من الشهادة — يحدّد شكل حقل الاسم
const RECIPIENTS = [
  { key: "student", label: "طالب (يُختار من الفصول)" },
  { key: "staff",   label: "منسوب (يُختار من قائمة المدرسة)" },
  { key: "text",    label: "اسم يُكتب يدويًا" },
];

const FIELD_TYPES = [
  { key: "text",     label: "سطر نص" },
  { key: "textarea", label: "فقرة" },
  { key: "date",     label: "تاريخ" },
  { key: "number",   label: "رقم" },
];

// يبني حقول النموذج تلقائيًا بحسب تصنيفه
function buildFields(category, recipient, custom) {
  if (category === "certificate") {
    const who =
      recipient === "student" ? { name: "recipient", label: "الطالب", type: "student", required: true }
      : recipient === "staff" ? { name: "recipient", label: "المنسوب", type: "staff", required: true }
      : { name: "recipient", label: "الاسم", type: "text", required: true };
    const out = [
      { name: "theme", label: "قالب الشهادة", type: "theme", required: false, default: "classic" },
      who,
    ];
    if (recipient === "staff") {
      out.push({ name: "job", label: "المسمّى الوظيفي", type: "text", required: false });
    }
    out.push(
      { name: "reason", label: "سبب التكريم", type: "textarea", required: true },
      { name: "closing", label: "خاتمة الشهادة", type: "text", required: false,
        default: "مع تمنياتنا له بالتوفيق والسداد" },
      { name: "date", label: "التاريخ", type: "date", required: true },
    );
    return out;
  }

  if (category === "official") {
    return [
      { name: "number", label: "الرقم", type: "text", required: false },
      { name: "date", label: "التاريخ", type: "date", required: true },
      { name: "audience", label: "الموجَّه إليهم", type: "text", required: true },
      { name: "title", label: "الموضوع", type: "text", required: true },
      { name: "body", label: "النص", type: "textarea", required: true },
      { name: "alert", label: "تنبيه مهم", type: "textarea", required: false },
      { name: "action", label: "المطلوب", type: "textarea", required: false },
    ];
  }

  // إداري: الحقول التي يكتبها المستخدم
  return (custom ?? [])
    .filter((f) => f.label.trim())
    .map((f, i) => ({
      name: `f${i + 1}`,
      label: f.label.trim(),
      type: f.type,
      required: !!f.required,
    }));
}

const slugKey = (title) =>
  "tpl_" +
  (title.trim().replace(/\s+/g, "_").replace(/[^\u0600-\u06FF\w_]/g, "").slice(0, 24) || "form") +
  "_" + Math.random().toString(36).slice(2, 6);

const DEPARTMENTS = [
  { key: "school_admin",    label: "الإدارة المدرسية" },
  { key: "academic",        label: "الشؤون التعليمية" },
  { key: "school_affairs",  label: "الشؤون المدرسية" },
  { key: "student_affairs", label: "شؤون الطلاب" },
  { key: "guidance",        label: "التوجيه الطلابي" },
  { key: "activity",        label: "النشاط الطلابي" },
  { key: "health",          label: "الموجه الصحي" },
  { key: "gifted",          label: "الموهوبين" },
  { key: "globe",           label: "برنامج جلوب البيئي العالمي" },
  { key: "sport",           label: "مكة سبورت" },
];

export default function FormsAdmin() {
  const { session } = useSession();
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState({});
  const [urls, setUrls] = useState({});
  const [msg, setMsg] = useState(null);
  const [principalName, setPrincipalName] = useState("");
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState(null);   // بيانات النموذج الجديد
  const [loading, setLoading] = useState(true);
  const stampRef = useRef(null);
  const signRef = useRef(null);

  const load = async () => {
    const [{ data: t }, { data: a }] = await Promise.all([
      supabase.from("form_templates").select("*").order("sort_order"),
      supabase.from("school_assets").select("key, path, label"),
    ]);
    setPrincipalName((a ?? []).find((r) => r.key === "principal_signature")?.label ?? "");
    setRows(t ?? []);
    const m = Object.fromEntries((a ?? []).map((r) => [r.key, r.path]));
    setAssets(m);
    const u = {};
    for (const [k, p] of Object.entries(m)) {
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(p, 600);
      u[k] = s?.signedUrl ?? null;
    }
    setUrls(u);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const patch = async (row, changes) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...changes } : r)));
    const { error } = await supabase.from("form_templates")
      .update({ ...changes, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) { setMsg({ ok: false, text: error.message }); load(); }
    else setMsg({ ok: true, text: "حُفظ التعديل." });
  };

  const toggleRole = (row, role) => {
    const cur = row.allowed_roles ?? [];
    patch(row, { allowed_roles: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] });
  };

  const savePrincipalName = async () => {
    const { error } = await supabase.from("school_assets")
      .update({ label: principalName, updated_at: new Date().toISOString() })
      .eq("key", "principal_signature");
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "حُفظ اسم المدير." });
  };

  const savePresets = async (row, text) => {
    const arr = text.split("\n").map((x) => x.trim()).filter(Boolean);
    patch(row, { presets: arr });
  };

  const NEW = {
    title: "", description: "", department: "school_admin", category: "certificate",
    recipient: "student", allowed_roles: ["principal", "tech_support"],
    requires_approval: false, show_stamp: false, signature_source: "issuer",
    presets: "", custom: [{ label: "", type: "text", required: false }],
  };

  const startAdd = () => { setNf({ ...NEW }); setAdding(true); setMsg(null); };

  const createTemplate = async () => {
    if (nf.title.trim().length < 2) {
      setMsg({ ok: false, text: "اكتب عنوان النموذج." }); return;
    }
    const fields = buildFields(nf.category, nf.recipient, nf.custom);
    if (nf.category === "administrative" && fields.length === 0) {
      setMsg({ ok: false, text: "أضف حقلًا واحدًا على الأقل." }); return;
    }
    const orientation = CATEGORIES.find((c) => c.key === nf.category)?.orientation ?? "portrait";
    const { error } = await supabase.from("form_templates").insert({
      key: slugKey(nf.title),
      title: nf.title.trim(),
      description: nf.description.trim() || null,
      department: nf.department,
      category: nf.category,
      orientation,
      fields,
      presets: nf.presets.split("\n").map((x) => x.trim()).filter(Boolean),
      preset_field: "reason",
      allowed_roles: nf.allowed_roles,
      requires_approval: nf.requires_approval,
      show_stamp: nf.show_stamp,
      signature_source: nf.signature_source,
      is_active: true,
      sort_order: 100,
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setAdding(false); setNf(null);
    setMsg({ ok: true, text: "أُضيف النموذج." });
    load();
  };

  const removeTemplate = async (row) => {
    if (!window.confirm(`حذف «${row.title}» نهائيًا؟ لن يؤثر على المستندات الصادرة.`)) return;
    const { error } = await supabase.from("form_templates").delete().eq("id", row.id);
    setMsg(error
      ? { ok: false, text: `تعذّر الحذف: ${error.message} — يمكنك تعطيله بدل حذفه.` }
      : { ok: true, text: "حُذف النموذج." });
    load();
  };

  const uploadAsset = async (key, file) => {
    if (!file) return;
    if (file.size > 600 * 1024) { setMsg({ ok: false, text: "الحجم يتجاوز ٦٠٠ كيلوبايت." }); return; }
    const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `school/${key}.${ext}`;
    const { error: ue } = await supabase.storage.from("form-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (ue) { setMsg({ ok: false, text: `تعذّر الرفع: ${ue.message}` }); return; }
    const { error } = await supabase.from("school_assets")
      .upsert({ key, path, updated_at: new Date().toISOString(), updated_by: session.user.id },
              { onConflict: "key" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "حُفظ الملف." });
    load();
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">إدارة النماذج</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          حدّد لكل نموذج من يُصدره، وهل يحتاج اعتمادًا، وأي توقيع وختم يُطبع عليه.
        </p>
      </div>

      {!adding ? (
        <button className="btn-primary" onClick={startAdd}>إضافة نموذج جديد</button>
      ) : (
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">نموذج جديد</h2>
            <button onClick={() => { setAdding(false); setNf(null); }}
                    className="rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
              إلغاء
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">العنوان</label>
              <input className="field mt-1 w-full" value={nf.title}
                     placeholder="مثال: شهادة تميّز في النشاط"
                     onChange={(e) => setNf((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted">القسم</label>
              <select className="field mt-1 w-full" value={nf.department}
                      onChange={(e) => setNf((f) => ({ ...f, department: e.target.value }))}>
                {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted">وصف مختصر</label>
            <input className="field mt-1 w-full" value={nf.description}
                   placeholder="سطر يوضّح متى يُستعمل هذا النموذج"
                   onChange={(e) => setNf((f) => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">التصنيف</label>
              <select className="field mt-1 w-full" value={nf.category}
                      onChange={(e) => setNf((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            {nf.category === "certificate" && (
              <div>
                <label className="text-xs text-muted">المستفيد</label>
                <select className="field mt-1 w-full" value={nf.recipient}
                        onChange={(e) => setNf((f) => ({ ...f, recipient: e.target.value }))}>
                  {RECIPIENTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {nf.category === "administrative" && (
            <div>
              <p className="text-xs text-muted">حقول النموذج</p>
              <div className="mt-1.5 space-y-2">
                {nf.custom.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input className="field min-w-[180px] flex-1" value={c.label}
                           placeholder="اسم الحقل"
                           onChange={(e) => setNf((f) => {
                             const custom = [...f.custom];
                             custom[i] = { ...custom[i], label: e.target.value };
                             return { ...f, custom };
                           })} />
                    <select className="field" value={c.type}
                            onChange={(e) => setNf((f) => {
                              const custom = [...f.custom];
                              custom[i] = { ...custom[i], type: e.target.value };
                              return { ...f, custom };
                            })}>
                      {FIELD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={c.required}
                             onChange={(e) => setNf((f) => {
                               const custom = [...f.custom];
                               custom[i] = { ...custom[i], required: e.target.checked };
                               return { ...f, custom };
                             })} />
                      إلزامي
                    </label>
                    <button onClick={() => setNf((f) => ({
                              ...f, custom: f.custom.filter((_, x) => x !== i) }))}
                            className="rounded-pill border border-absent/40 px-2.5 py-1 text-xs text-absent">
                      حذف
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setNf((f) => ({
                        ...f, custom: [...f.custom, { label: "", type: "text", required: false }] }))}
                      className="mt-2 rounded-pill border border-line px-3 py-1 text-xs text-mint-deep hover:bg-canvas">
                إضافة حقل
              </button>
            </div>
          )}

          {nf.category === "certificate" && (
            <div>
              <label className="text-xs text-muted">صيغ جاهزة لسبب التكريم — صيغة في كل سطر</label>
              <textarea rows={3} className="field mt-1 w-full text-sm" value={nf.presets}
                        onChange={(e) => setNf((f) => ({ ...f, presets: e.target.value }))} />
            </div>
          )}

          <div>
            <p className="text-xs text-muted">من يُصدره</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ROLES.map((role) => {
                const on = nf.allowed_roles.includes(role.key);
                return (
                  <button key={role.key} type="button"
                    onClick={() => setNf((f) => ({
                      ...f,
                      allowed_roles: on
                        ? f.allowed_roles.filter((r) => r !== role.key)
                        : [...f.allowed_roles, role.key],
                    }))}
                    className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={nf.requires_approval}
                     onChange={(e) => setNf((f) => ({ ...f, requires_approval: e.target.checked }))} />
              يحتاج اعتماد المدير
            </label>
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={nf.show_stamp}
                     onChange={(e) => setNf((f) => ({ ...f, show_stamp: e.target.checked }))} />
              يحمل ختم المدرسة
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              التوقيع:
              <select className="field" value={nf.signature_source}
                      onChange={(e) => setNf((f) => ({ ...f, signature_source: e.target.value }))}>
                {SIGN_SOURCE.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </label>
          </div>

          <button className="btn-primary" onClick={createTemplate}>حفظ النموذج</button>
        </section>
      )}

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-ink">ختم المدرسة وتوقيع المدير</h2>
        <p className="mt-1 text-xs text-muted">
          يُدرجان تلقائيًا في النماذج التي تطلبهما، ولا يظهران على مستند غير معتمد.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[["stamp", "ختم المدرسة", stampRef], ["principal_signature", "توقيع المدير", signRef]].map(
            ([key, label, ref]) => (
              <div key={key} className="rounded-card border border-line p-3">
                <div className="grid h-24 place-items-center rounded-sm2 bg-canvas">
                  {urls[key]
                    ? <img src={urls[key]} alt={label} className="max-h-20 object-contain" />
                    : <span className="text-xs text-faint">غير مرفوع</span>}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-ink">{label}</span>
                  <button className="rounded-pill border border-line px-3 py-1 text-xs text-mint-deep hover:bg-canvas"
                          onClick={() => ref.current?.click()}>
                    {assets[key] ? "استبدال" : "رفع"}
                  </button>
                </div>
                <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                       onChange={(e) => { uploadAsset(key, e.target.files?.[0]); e.target.value = ""; }} />
              </div>
            ),
          )}
        </div>

        <div className="mt-3">
          <label className="text-xs text-muted">اسم المدير كما يُطبع تحت توقيعه</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input className="field min-w-[240px] flex-1" value={principalName}
                   onChange={(e) => setPrincipalName(e.target.value)} />
            <button className="btn-primary" onClick={savePrincipalName}>حفظ</button>
          </div>
        </div>
      </section>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => (
          <section key={r.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{r.title}</p>
                <p className="mt-0.5 text-xs text-muted">{r.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-mint-tint text-mint-deep">{CAT[r.category]}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={r.is_active}
                         onChange={(e) => patch(r, { is_active: e.target.checked })} />
                  مفعّل
                </label>
                <button onClick={() => removeTemplate(r)}
                        className="rounded-pill border border-absent/40 px-2.5 py-1 text-xs text-absent hover:bg-absent/5">
                  حذف
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted">من يُصدر هذا النموذج</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ROLES.map((role) => {
                  const on = (r.allowed_roles ?? []).includes(role.key);
                  return (
                    <button key={role.key} onClick={() => toggleRole(r, role.key)}
                      className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                      {role.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted">
                صيغ جاهزة تظهر للمُصدِر كبطاقات — صيغة في كل سطر
              </p>
              <textarea rows={4} className="field mt-1.5 w-full text-sm"
                        defaultValue={(r.presets ?? []).join("\n")}
                        placeholder="تقديرًا لتفوّقه الدراسي…"
                        onBlur={(e) => savePresets(r, e.target.value)} />
              <p className="mt-1 text-[11px] text-faint">
                تُحفظ تلقائيًا عند الخروج من الخانة، وتملأ حقل «{r.preset_field || "reason"}».
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={r.requires_approval}
                       onChange={(e) => patch(r, { requires_approval: e.target.checked })} />
                يحتاج اعتماد المدير
              </label>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={r.show_stamp}
                       onChange={(e) => patch(r, { show_stamp: e.target.checked })} />
                يحمل ختم المدرسة
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                القسم:
                <select className="field" value={r.department ?? "school_admin"}
                        onChange={(e) => patch(r, { department: e.target.value })}>
                  {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted">
                التوقيع:
                <select className="field" value={r.signature_source}
                        onChange={(e) => patch(r, { signature_source: e.target.value })}>
                  {SIGN_SOURCE.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
