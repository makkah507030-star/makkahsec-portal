import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import ColorLegend from "../../components/ColorLegend.jsx";
import NewsCoverCard from "../../components/NewsCoverCard.jsx";

const empty = {
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  cover_url: "",
  cover_theme: "",
  video_url: "",
  is_published: false,
  is_featured: true,
};

// توليد slug عربي-صديق
const makeSlug = (t) =>
  t.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

export default function NewsAdmin() {
  const { profile, adminRoles } = useSession();
  const isTeacher = profile?.role === "teacher"; // مسودات فقط — لا نشر مباشر

  // الأدوار الإدارية التي يملكها هذا الحساب فعليًا — منها يختار بطاقة الغلاف
  const myRoles = adminRoles.filter((r) => ADMIN_ROLE_LABEL[r]);

  const [list, setList] = useState(null);
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // اختيار بطاقة غلاف افتراضية أول مرة يفتح فيها نموذج جديد
  useEffect(() => {
    if (!isTeacher && !form.id && !form.cover_theme && myRoles.length) {
      setForm((f) => ({ ...f, cover_theme: myRoles[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRoles.length]);

  const load = async () => {
    let query = supabase
      .from("news")
      .select("id, title, slug, cover_url, cover_theme, is_published, is_featured, published_at, created_at, created_by")
      .order("created_at", { ascending: false });

    // المعلم يرى مسوداته الخاصة فقط، لا أخبار المدرسة كاملة
    if (isTeacher) query = query.eq("created_by", profile.id);

    const { data } = await query;
    setList(data ?? []);
  };

  useEffect(() => { load(); }, [profile?.id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("news").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("news").getPublicUrl(path);
      set("cover_url", data.publicUrl);
    } catch (e) {
      setMsg({ ok: false, text: "تعذّر رفع الصورة: " + (e.message ?? e) });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (form.title.trim().length < 3) {
      setMsg({ ok: false, text: "العنوان مطلوب." });
      return;
    }
    setSaving(true);
    setMsg(null);

    // المعلم: تُحفظ دائمًا كمسودة بانتظار موافقة الإدارة، بغض النظر عن أي شيء
    const isPublished = isTeacher ? false : form.is_published;

    const payload = {
      title: form.title.trim(),
      slug: (form.slug.trim() || makeSlug(form.title)) || null,
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim() || null,
      cover_url: isTeacher ? (form.cover_url || null) : null,
      cover_theme: isTeacher ? null : (form.cover_theme || null),
      video_url: form.video_url.trim() || null,
      is_published: isPublished,
      is_featured: form.is_featured,
      published_at: isPublished ? new Date().toISOString() : null,
      created_by: profile?.id ?? null,
    };

    const { error } = form.id
      ? await supabase.from("news").update(payload).eq("id", form.id)
      : await supabase.from("news").insert(payload);

    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setMsg({
      ok: true,
      text: isTeacher
        ? "حُفظت كمسودة — بانتظار مراجعة الإدارة قبل النشر."
        : form.id ? "حُدّث الخبر." : "نُشر الخبر.",
    });
    setForm(empty);
    await load();
  };

  const edit = async (id) => {
    const { data } = await supabase.from("news").select("*").eq("id", id).maybeSingle();
    if (data) {
      setForm({ ...empty, ...data, slug: data.slug ?? "", excerpt: data.excerpt ?? "",
                body: data.body ?? "", cover_url: data.cover_url ?? "",
                cover_theme: data.cover_theme ?? "",
                video_url: data.video_url ?? "" });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const remove = async (id) => {
    if (!confirm("حذف هذا الخبر نهائيًا؟")) return;
    await supabase.from("news").delete().eq("id", id);
    await load();
  };

  const togglePublish = async (n) => {
    // المعلم لا يملك صلاحية النشر إطلاقًا — الزر لا يظهر له أصلاً،
    // لكن نتحقق هنا أيضًا كطبقة حماية إضافية
    if (isTeacher) return;
    await supabase.from("news").update({
      is_published: !n.is_published,
      published_at: !n.is_published ? new Date().toISOString() : null,
    }).eq("id", n.id);
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">
          {isTeacher ? "أخبار الأنشطة — مسوداتي" : "أخبار المدرسة"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {isTeacher
            ? "تُحفظ مساهماتك كمسودة، ولا تظهر للزوار إلا بعد مراجعة الإدارة ونشرها."
            : "الأخبار المنشورة والمميّزة تظهر في سلايدر الصفحة الرئيسية."}
        </p>
      </div>

      {/* النموذج */}
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">
          {form.id ? "تحرير خبر" : "خبر جديد"}
        </h2>

        <div>
          <label className="text-xs text-muted">العنوان</label>
          <input className="field mt-1" value={form.title}
                 onChange={(e) => set("title", e.target.value)}
                 placeholder="مثال: تكريم الطلاب المتفوقين" />
        </div>

        <div>
          <label className="text-xs text-muted">مقتطف قصير (يظهر في السلايدر)</label>
          <textarea className="field mt-1" rows={2} value={form.excerpt}
                    onChange={(e) => set("excerpt", e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted">نص الخبر</label>
          <textarea className="field mt-1" rows={8} value={form.body}
                    onChange={(e) => set("body", e.target.value)}
                    placeholder="اترك سطرًا فارغًا بين الفقرات." />
        </div>

        {isTeacher ? (
          <div>
            <label className="text-xs text-muted">صورة الغلاف</label>
            <input type="file" accept="image/*" className="mt-1 block w-full text-sm"
                   onChange={(e) => handleUpload(e.target.files?.[0])} />
            {uploading && <p className="mt-1 text-xs text-muted">جارٍ الرفع…</p>}
            {form.cover_url && (
              <div className="mt-3 flex items-center gap-3">
                <img src={form.cover_url} alt="" className="h-20 w-32 rounded-sm2 border border-line object-cover" />
                <button onClick={() => set("cover_url", "")}
                        className="text-xs font-medium text-absent hover:underline">
                  إزالة الصورة
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted">بطاقة الغلاف</label>
            <p className="mt-1 text-xs text-faint">
              بطاقة تلقائية بتدرّج لوني خاص باسم حسابك — تظهر بدلًا من صورة الغلاف.
            </p>
            {myRoles.length === 0 ? (
              <p className="mt-2 rounded-sm2 bg-warning-light px-3 py-2 text-xs text-warning">
                لا يوجد حساب إداري مرتبط بك بعد لاختيار بطاقة غلاف.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {myRoles.map((r) => (
                  <button key={r} type="button" onClick={() => set("cover_theme", r)}
                          className={`overflow-hidden rounded-sm2 ring-2 transition-shadow ${
                            form.cover_theme === r ? "ring-mint-deep" : "ring-transparent hover:ring-line"}`}>
                    <NewsCoverCard role={r} className="aspect-[16/9] w-full" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs text-muted">رابط فيديو يوتيوب (اختياري)</label>
          <input className="field mt-1" value={form.video_url}
                 onChange={(e) => set("video_url", e.target.value)}
                 placeholder="https://www.youtube.com/watch?v=..." dir="ltr" />
        </div>

        <div className="flex flex-wrap gap-5">
          {/* خيار النشر يظهر للإدارة فقط — المعلم دائمًا مسودة */}
          {!isTeacher && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_published}
                     onChange={(e) => set("is_published", e.target.checked)} />
              منشور
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_featured}
                   onChange={(e) => set("is_featured", e.target.checked)} />
            يظهر في السلايدر (بعد النشر)
          </label>
        </div>

        {isTeacher && (
          <p className="rounded-sm2 bg-warning-light px-3 py-2 text-xs leading-relaxed text-warning">
            ستُحفظ هذه المساهمة كمسودة، ولن تظهر للزوار إلا بعد مراجعتها ونشرها
            من إدارة المدرسة.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={save} disabled={saving || uploading}>
            {saving ? "جارٍ الحفظ…" : isTeacher ? "حفظ كمسودة" : form.id ? "حفظ التعديلات" : "نشر الخبر"}
          </button>
          {form.id && (
            <button className="btn-ghost" onClick={() => setForm(empty)}>إلغاء</button>
          )}
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
          { chip: "bg-present/10 text-present", sample: "منشور", label: "ظاهر للزوار" },
          { chip: "bg-warning-light text-warning", sample: "مسودة", label: "غير ظاهر" },
          { chip: "bg-mint-tint text-mint-deep", sample: "سلايدر", label: "يظهر في الواجهة" },
        ]}
      />

      {/* القائمة */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          {isTeacher ? "مسوداتي" : "كل الأخبار"} {list && <span className="num text-muted">({list.length})</span>}
        </h2>

        {!list && <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>}
        {list?.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted">
            {isTeacher ? "لم تُضف أي مساهمة بعد." : "لا توجد أخبار بعد."}
          </p>
        )}

        <div className="divide-y divide-line">
          {list?.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="h-12 w-20 shrink-0 overflow-hidden rounded-sm2 bg-mint-tint">
                {n.cover_theme ? (
                  <NewsCoverCard role={n.cover_theme} className="h-full w-full text-[10px]" />
                ) : n.cover_url ? (
                  <img src={n.cover_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{n.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className={`chip ${n.is_published
                    ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>
                    {n.is_published ? "منشور" : "مسودة"}
                  </span>
                  {n.is_featured && (
                    <span className="chip bg-mint-tint text-mint-deep">سلايدر</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-3 text-xs font-medium">
                {!isTeacher && (
                  <button onClick={() => togglePublish(n)} className="text-mint-deep hover:underline">
                    {n.is_published ? "إلغاء النشر" : "نشر"}
                  </button>
                )}
                <button onClick={() => edit(n.id)} className="text-muted hover:underline">
                  تحرير
                </button>
                <button onClick={() => remove(n.id)} className="text-absent hover:underline">
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
