// src/pages/media/MediaStudio.jsx
import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { confirmDanger } from "../../lib/danger";
import { AUDIENCE } from "../../lib/banners.js";
import { uploadMedia, MEDIA_BUCKET, MAX_VIDEO_MB } from "../../lib/media.js";
import Loader from "../../components/Loader.jsx";
import { useMedia, MediaGrid } from "./MediaGallery.jsx";
import MediaViewer from "./MediaViewer.jsx";

/* =====================================================================
   استوديو الوسائط (صلاحية «استوديو الوسائط»، supabase/media_1.sql): رفع صور المدرسة
   ومقاطعها إلى مخزن خاص بألبومها ولمن تظهر وفي أي صفوف، بعد الإقرار بموافقات التصوير،
   وإخفاؤها وحذفها. لا يصدر لأي ملف رابط عام؛ العرض داخل البوابة برابط موقّع قصير العمر.
   ===================================================================== */

const BLANK = { files: [], title: "", album: "", body: "", audience: ["student", "guardian", "staff"], grades: [], tracked: false, consent: false };
const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;

export default function MediaStudio() {
  const { profile } = useSession();
  const [reload, setReload] = useState(0);
  const { rows, err } = useMedia(reload);
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(null);         // نص التقدم
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(null);
  const albums = useMemo(() => [...new Set((rows ?? []).map((r) => r.album).filter(Boolean))], [rows]);
  if (!rows) return <Loader />;
  const toggle = (k, v) => setF((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const ok = f.files.length && f.title.trim() && f.consent && f.audience.length;

  const upload = async () => {
    setMsg(null);
    let n = 0;
    try {
      for (const [i, file] of f.files.entries()) {
        setBusy(`جارٍ رفع ${i + 1} من ${f.files.length}…`);
        const up = await uploadMedia(file);
        const { error } = await supabase.from("media_items").insert({
          ...up, title: f.files.length > 1 ? `${f.title.trim()} (${i + 1})` : f.title.trim(), album: f.album.trim() || null,
          body: f.body.trim() || null, audience: f.audience, grades: f.grades, tracked: f.tracked, consent: true, created_by_name: profile?.full_name ?? null });
        if (error) { await supabase.storage.from(MEDIA_BUCKET).remove([up.path, up.thumb].filter(Boolean)); throw error; }
        n += 1;
      }
      setMsg({ ok: true, t: `رُفعت ${n} مواد إلى المعرض.` });
      setF({ ...BLANK, album: f.album });
    } catch (e) { setMsg({ ok: false, t: `${n ? `رُفعت ${n} ثم ` : ""}تعذّر الرفع: ${e.message}` }); }
    setBusy(null); setReload((x) => x + 1);
  };
  const flip = async (r) => { await supabase.from("media_items").update({ published: !r.published }).eq("id", r.id); setReload((x) => x + 1); };
  const remove = async (r) => {
    if (!(await confirmDanger({ title: `حذف «${r.title}»`, impact: ["تُحذف المادة من المعرض ومن المخزن نهائيًا."], confirmLabel: "حذف" }))) return;
    await supabase.from("media_items").delete().eq("id", r.id);
    await supabase.storage.from(MEDIA_BUCKET).remove([r.path, r.thumb].filter(Boolean));
    setReload((x) => x + 1);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">استوديو الوسائط</h1>
        <p className="mt-1 text-sm text-muted">ارفع صور المدرسة ومقاطعها لتظهر في «معرض المدرسة» داخل الحسابات فقط. لا يصدر لأي ملف رابط عام، والرابط المنسوخ يتعطل بعد دقائق.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">رفع مواد جديدة</p>
        <label className="block rounded-sm2 border-2 border-dashed border-line px-4 py-5 text-center text-sm text-muted hover:bg-canvas">
          {f.files.length ? `${f.files.length} ملفات مختارة: ${f.files.map((x) => x.name).slice(0, 3).join("، ")}${f.files.length > 3 ? "…" : ""}`
            : `اختر صورًا (عدة صور معًا) أو مقطعًا (حتى ${MAX_VIDEO_MB} ميجا، ويُفضّل بدقة 720p)`}
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden"
                 onChange={(e) => setF({ ...f, files: [...(e.target.files ?? [])] })} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="field" value={f.title} maxLength={80} placeholder="العنوان (مثل: حفل اليوم الوطني)" onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="field" list="media-albums" value={f.album} maxLength={60} placeholder="الألبوم (مثل: اليوم الوطني 96)" onChange={(e) => setF({ ...f, album: e.target.value })} />
          <datalist id="media-albums">{albums.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
        <textarea className="field w-full" rows={2} value={f.body} maxLength={300} placeholder="وصف قصير (اختياري)" onChange={(e) => setF({ ...f, body: e.target.value })} />
        <div className="space-y-1.5">
          <p className="text-xs text-muted">تظهر لـ</p>
          <div className="flex flex-wrap gap-1.5">{AUDIENCE.map(([k, t]) => <button key={k} className={pill(f.audience.includes(k))} onClick={() => toggle("audience", k)}>{t}</button>)}</div>
          <div className="flex flex-wrap gap-1.5">
            <button className={pill(!f.grades.length)} onClick={() => setF({ ...f, grades: [] })}>كل الصفوف</button>
            {[[1, "الأول"], [2, "الثاني"], [3, "الثالث"]].map(([g, t]) => <button key={g} className={pill(f.grades.includes(g))} onClick={() => toggle("grades", g)}>{t}</button>)}
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={f.tracked} onChange={(e) => setF({ ...f, tracked: e.target.checked })} />
          <span>مادة حساسة: يظهر في زاويتها اسم المشاهد وفصله <span className="text-muted">(لتُعرف أي لقطة شاشة تسرّبت)</span></span>
        </label>
        <label className="flex items-start gap-2 rounded-sm2 bg-late/10 px-3 py-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />
          <span>أقرّ بأن التصوير تمّ بإذن إدارة المدرسة وبأجهزتها، وأن لكل طالب يظهر في المواد موافقة ولي أمره على التصوير لهذا العام، ولكل منسوب يظهر فيها موافقته.</span>
        </label>
        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
        <button className="btn-primary" disabled={!ok || !!busy} onClick={upload}>{busy ?? "رفع إلى المعرض"}</button>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink">المواد <span className="num text-muted">({rows.length})</span></p>
        {rows.length ? (
          <MediaGrid rows={rows} onOpen={setOpen} extra={(r) => (
            <div className="mt-1.5 flex items-center gap-2 text-[11px]">
              <button className="font-semibold text-mint-deep underline" onClick={() => flip(r)}>{r.published ? "إخفاء" : "نشر"}</button>
              <button className="text-absent" onClick={() => remove(r)}>حذف</button>
              {r.tracked && <span className="rounded-pill bg-late/15 px-1.5 text-late">حساسة</span>}
              <span className="ms-auto truncate text-faint">{r.created_by_name}</span>
            </div>
          )} />
        ) : <p className="card px-4 py-8 text-center text-sm text-muted">لا مواد بعد.</p>}
      </section>
      {open != null && rows[open] && <MediaViewer item={rows[open]} onClose={() => setOpen(null)}
        onPrev={open > 0 ? () => setOpen(open - 1) : null} onNext={open < rows.length - 1 ? () => setOpen(open + 1) : null} />}
    </div>
  );
}
