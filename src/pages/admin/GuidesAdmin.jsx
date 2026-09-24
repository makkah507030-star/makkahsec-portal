import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { AUDIENCES, audienceLabel, fmtSize } from "../../lib/guidesMeta";
import ColorLegend from "../../components/ColorLegend.jsx";

// الصيغ المقبولة: ملف PDF أو صورة منشور تعريفي
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const isImage = (url = "") => /\.(png|jpe?g|webp)(\?|$)/i.test(url);

const empty = {
  id: null,
  title: "",
  description: "",
  audience: "general",
  file_url: "",
  file_name: "",
  file_size: null,
  is_published: true,
  sort_order: 0,
};

export default function GuidesAdmin() {
  const { profile } = useSession();
  const [list, setList] = useState(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("guides")
      .select("*")
      .order("audience")
      .order("sort_order");
    setList(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (file) => {
    if (!file) return;

    const pdf = file.type === "application/pdf";
    const img = IMAGE_TYPES.includes(file.type);
    if (!pdf && !img) {
      setMsg({ ok: false, text: "يُقبل ملف PDF أو صورة بصيغة PNG أو JPG أو WEBP." });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMsg({ ok: false, text: "حجم الملف يتجاوز ٨ ميجابايت. اضغطه ثم أعد الرفع." });
      return;
    }

    setUploading(true);
    setMsg(null);
    try {
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${Date.now()}-${safe}`;
      const { error } = await supabase.storage
        .from("guides")
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (error) throw error;

      const { data } = supabase.storage.from("guides").getPublicUrl(path);
      set("file_url", data.publicUrl);
      set("file_name", file.name);
      set("file_size", file.size);
      if (!form.title.trim()) set("title", file.name.replace(/\.(pdf|png|jpe?g|webp)$/i, ""));
    } catch (e) {
      setMsg({ ok: false, text: "تعذّر رفع الملف: " + (e.message ?? e) });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.title.trim().length < 3) {
      setMsg({ ok: false, text: "عنوان الدليل مطلوب." });
      return;
    }
    if (!form.file_url) {
      setMsg({ ok: false, text: "ارفع ملف الدليل أولًا." });
      return;
    }
    setSaving(true);
    setMsg(null);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      audience: form.audience,
      file_url: form.file_url,
      file_name: form.file_name || null,
      file_size: form.file_size || null,
      is_published: form.is_published,
      sort_order: Number(form.sort_order) || 0,
      created_by: profile?.id ?? null,
    };

    const { error } = form.id
      ? await supabase.from("guides").update(payload).eq("id", form.id)
      : await supabase.from("guides").insert(payload);

    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }

    setMsg({ ok: true, text: form.id ? "حُدّث الدليل." : "أُضيف الدليل." });
    setForm(empty);
    await load();
  };

  const edit = (g) => {
    setForm({ ...empty, ...g,
      description: g.description ?? "", file_name: g.file_name ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (g) => {
    if (!confirm(`حذف «${g.title}» نهائيًا؟`)) return;
    await supabase.from("guides").delete().eq("id", g.id);
    await load();
  };

  const togglePublish = async (g) => {
    await supabase.from("guides").update({ is_published: !g.is_published }).eq("id", g.id);
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">أدلة الاستخدام</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أدلة PDF ومنشورات تعريفية مصوّرة، تُعرض في صفحة الأدلة العامة مصنّفة حسب الفئة المستهدفة.
        </p>
      </div>

      {/* النموذج */}
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">
          {form.id ? "تحرير دليل" : "إضافة دليل جديد"}
        </h2>

        <div>
          <label className="text-xs text-muted">
            ملف الدليل — PDF أو صورة منشور (PNG / JPG / WEBP)
          </label>
          <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
                 className="mt-1 block w-full text-sm"
                 onChange={(e) => handleUpload(e.target.files?.[0])} />
          {uploading && <p className="mt-1 text-xs text-muted">جارٍ الرفع…</p>}
          {form.file_url && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm2 bg-mint-tint px-3 py-2">
              {isImage(form.file_url) && (
                <img src={form.file_url} alt=""
                     className="h-14 w-14 shrink-0 rounded-sm2 border border-[#CCF2DB] bg-white object-cover" />
              )}
              <span className="text-xs font-medium text-mint-deep">
                {form.file_name || "ملف مرفوع"}
              </span>
              <span className="chip bg-white text-mint-deep">
                {isImage(form.file_url) ? "صورة" : "PDF"}
              </span>
              {form.file_size ? (
                <span className="num text-xs text-muted">{fmtSize(form.file_size)}</span>
              ) : null}
              <a href={form.file_url} target="_blank" rel="noreferrer"
                 className="text-xs font-medium text-mint-deep hover:underline">معاينة</a>
              <button onClick={() => { set("file_url",""); set("file_name",""); set("file_size",null); }}
                      className="text-xs font-medium text-absent hover:underline">إزالة</button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">عنوان الدليل</label>
            <input className="field mt-1" value={form.title}
                   onChange={(e) => set("title", e.target.value)}
                   placeholder="مثال: دليل استخدام البوابة — المعلمون" />
          </div>
          <div>
            <label className="text-xs text-muted">ترتيب العرض</label>
            <input className="field num mt-1" inputMode="numeric" value={form.sort_order}
                   onChange={(e) => set("sort_order", e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted">وصف مختصر (اختياري)</label>
          <textarea className="field mt-1" rows={2} value={form.description}
                    onChange={(e) => set("description", e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted">
            الفئة المستهدفة — تحدد من يستطيع رؤية الدليل
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button key={a.key} type="button" onClick={() => set("audience", a.key)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  form.audience === a.key ? "bg-mint-deep text-white"
                                          : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm2 bg-gray-tint px-3 py-2.5 text-xs leading-relaxed text-muted">
          «عام» يظهر لجميع الزوار دون تسجيل دخول. وأي فئة أخرى لا يراها إلا
          أعضاؤها بعد تسجيل الدخول، والإدارة ترى جميع الأدلة.
        </div>

        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_published}
                   onChange={(e) => set("is_published", e.target.checked)} />
            منشور
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={save} disabled={saving || uploading}>
            {saving ? "جارٍ الحفظ…" : form.id ? "حفظ التعديلات" : "إضافة الدليل"}
          </button>
          {form.id && <button className="btn-ghost" onClick={() => setForm(empty)}>إلغاء</button>}
        </div>

        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}
      </section>

      <ColorLegend
        items={[
          { chip: "bg-present/10 text-present", sample: "منشور", label: "ظاهر في صفحة الأدلة" },
          { chip: "bg-warning-light text-warning", sample: "مسودة", label: "غير ظاهر" },
        ]}
      />

      {/* القائمة */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          الأدلة {list && <span className="num text-muted">({list.length})</span>}
        </h2>

        {!list && <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>}
        {list?.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">لم تُضف أدلة بعد.</p>
        )}

        <div className="divide-y divide-line">
          {list?.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {isImage(g.file_url) && (
                <img src={g.file_url} alt=""
                     className="h-12 w-12 shrink-0 rounded-sm2 border border-line object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{g.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {audienceLabel(g.audience)}
                  <span> · {isImage(g.file_url) ? "صورة" : "PDF"}</span>
                  {g.file_size ? <span className="num"> · {fmtSize(g.file_size)}</span> : null}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className={`chip ${g.is_published
                    ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>
                    {g.is_published ? "منشور" : "مسودة"}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 text-xs font-medium">
                <a href={g.file_url} target="_blank" rel="noreferrer"
                   className="text-mint-deep hover:underline">فتح</a>
                <button onClick={() => togglePublish(g)} className="text-mint-deep hover:underline">
                  {g.is_published ? "إلغاء النشر" : "نشر"}
                </button>
                <button onClick={() => edit(g)} className="text-muted hover:underline">تحرير</button>
                <button onClick={() => remove(g)} className="text-absent hover:underline">حذف</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
