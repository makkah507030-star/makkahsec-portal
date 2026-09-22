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

export default function FormsAdmin() {
  const { session } = useSession();
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState({});
  const [urls, setUrls] = useState({});
  const [msg, setMsg] = useState(null);
  const [principalName, setPrincipalName] = useState("");
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
