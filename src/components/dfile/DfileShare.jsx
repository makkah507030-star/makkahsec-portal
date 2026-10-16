import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "../../lib/supabase";
import { shrinkImage } from "../../lib/imageResize.js";
import { fmtDateTime } from "../../lib/dates.js";
import DfileCard from "./DfileCard.jsx";
import { DFILE_PHOTOS, dfileLink, loadVisits } from "../../lib/dfile.js";

/* =====================================================================
   «رابط ملفك» في لوحة المعلم: بطاقة الرمز، وصورة المعلم الاختيارية، وتنزيل
   البطاقة صورة للجوال، ونسخ الرابط ومشاركته، وسجل الزوار (يراه المعلم وحده).
   ===================================================================== */

/* الصورة كبيانات مضمّنة حتى تدخل في الصورة المنزّلة دون قيود المصدر */
async function photoData(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(DFILE_PHOTOS).download(path);
  if (!data) return null;
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(data); });
}

const dur = (s) => (s >= 60 ? `${Math.round(s / 60)} دقيقة` : s > 0 ? `${s} ثانية` : "أقل من دقيقة");

export default function DfileShare({ uid, s, d, onSave }) {
  const card = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [visits, setVisits] = useState(null);
  const link = dfileLink(s.code);

  useEffect(() => { photoData(s.photo_path).then(setPhoto); }, [s.photo_path]);
  useEffect(() => { loadVisits(uid).then(setVisits); }, [uid]);

  const upload = async (file) => {
    if (!file) return;
    setBusy("photo"); setMsg("");
    const img = await shrinkImage(file, 600, 0.86, { jpeg: true });
    const path = `${uid}/photo-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from(DFILE_PHOTOS).upload(path, img, { contentType: "image/jpeg" });
    if (error) { setMsg(error.message); setBusy(""); return; }
    if (s.photo_path) supabase.storage.from(DFILE_PHOTOS).remove([s.photo_path]);
    await onSave({ photo_path: path });
    setBusy("");
  };

  const removePhoto = async () => {
    if (s.photo_path) await supabase.storage.from(DFILE_PHOTOS).remove([s.photo_path]);
    await onSave({ photo_path: null });
  };

  // صورة بمقاس شاشة الجوال: البطاقة 288×512 ← 1080×1920
  const download = async () => {
    if (!card.current) return;
    setBusy("dl");
    try {
      const url = await toPng(card.current, { pixelRatio: 1080 / card.current.offsetWidth, cacheBust: true });
      const a = document.createElement("a");
      a.href = url; a.download = `makkahsec-${s.code}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { setMsg("تعذّر تنزيل البطاقة. جرّب مرة أخرى."); }
    setBusy("");
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setMsg("نُسخ الرابط."); } catch { setMsg(link); }
  };
  const share = () => {
    if (navigator.share) navigator.share({ title: `ملف المعلم الرقمي: ${d?.name ?? ""}`, url: link }).catch(() => {});
    else copy();
  };

  return (
    <div className="space-y-4">
      <DfileCard ref={card} name={d?.name} rank={s.rank} spec={d?.spec} code={s.code} color={s.color} photo={photo} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        <label className="btn-ghost cursor-pointer">
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          {busy === "photo" ? "جارٍ الرفع…" : s.photo_path ? "تغيير الصورة" : "رفع صورة"}
        </label>
        {s.photo_path && <button className="btn-ghost" onClick={removePhoto}>إزالة الصورة</button>}
      </div>
      <p className="text-center text-xs text-muted">صورتك اختيارية، وإن لم ترفعها تظهر أيقونة.</p>

      <p className="text-center font-mono text-sm text-ink" dir="ltr">{link.replace(/^https?:\/\//, "")}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <button className="btn-primary" onClick={download} disabled={busy === "dl"}>{busy === "dl" ? "جارٍ التجهيز…" : "تنزيل البطاقة"}</button>
        <button className="btn-ghost" onClick={copy}>نسخ الرابط</button>
        <button className="btn-ghost" onClick={share}>مشاركة</button>
      </div>
      {msg && <p className="text-center text-sm text-muted">{msg}</p>}
      <p className="text-sm leading-relaxed text-muted">
        رابط ثابت طوال العام: اطبع البطاقة أو أرسلها، ويرى الزائر الأقسام التي اخترتها. ملفك مفعّل، ويوقفه
        الدعم الفني فقط عند نقلك من المدرسة أو تقاعدك أو تحويلك إلى عمل إداري.
      </p>

      <div className="space-y-2 border-t border-line/60 pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-ink">من اطّلع على ملفك</p>
          <span className="chip border border-line bg-canvas text-muted">تراه أنت فقط</span>
        </div>
        {visits === null ? <p className="text-sm text-muted">جارٍ التحميل…</p>
          : visits.length === 0 ? <p className="text-sm text-muted">لا زيارات بعد.</p>
          : (
            <ul className="divide-y divide-line/60">
              {visits.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-tint font-bold text-mint-deep">
                    {(v.visitor_name || "ز").trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{[v.visitor_name || "زائر بلا اسم", v.visitor_org].filter(Boolean).join("، ")}</p>
                    <p className="text-xs text-muted">{fmtDateTime(v.started_at)}، {v.via === "qr" ? "مسح الرمز" : "الرابط"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{dur(v.seconds)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
