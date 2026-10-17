import { useEffect, useRef, useState } from "react";
import { toBlob, toPng } from "html-to-image";
import { supabase } from "../../lib/supabase";
import { shrinkImage } from "../../lib/imageResize.js";
import { fmtDateTime } from "../../lib/dates.js";
import DfileCard from "./DfileCard.jsx";
import { DFILE_PHOTOS, SHARE_MSG, dfileLink, loadVisits } from "../../lib/dfile.js";

/* =====================================================================
   «رابط ملفك» في لوحة المعلم: بطاقة الرمز، وصورة المعلم الاختيارية، وتنزيل
   البطاقة صورة للجوال، ونسخ الرابط ومشاركته، والمشاركة عبر واتساب (صورة البطاقة
   والكلمة الترحيبية والرابط)، وسجل الزوار وملاحظاتهم (يراه المعلم وحده).
   ===================================================================== */

/* الصورة كبيانات مضمّنة حتى تدخل في الصورة المنزّلة دون قيود المصدر */
async function photoData(path) {
  if (!path) return null;
  const { data } = await supabase.storage.from(DFILE_PHOTOS).download(path);
  if (!data) return null;
  return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(data); });
}

const VIA = { qr: "مسح الرمز", wa: "واتساب", link: "الرابط" };
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

  // واتساب: الكلمة الترحيبية ثم الرابط (w=1 ليُعرف مصدر الزيارة) ثم اسم المعلم
  const [waMsg, setWaMsg] = useState(s.share_msg || SHARE_MSG);
  const waText = () => [waMsg.trim(), dfileLink(s.code, "wa"), d?.name ? `أ. ${d.name}` : ""].filter(Boolean).join("\n\n");
  const saveMsg = () => { const m = waMsg.trim(); if (m !== (s.share_msg || SHARE_MSG).trim()) onSave({ share_msg: m === SHARE_MSG.trim() ? null : m }); };
  const whatsapp = async () => {
    if (!card.current) return;
    setBusy("wa"); setMsg(""); saveMsg();
    const text = waText();
    try {
      const blob = await toBlob(card.current, { pixelRatio: 1080 / card.current.offsetWidth, cacheBust: true });
      const file = new File([blob], `makkahsec-${s.code}.png`, { type: "image/png" });
      // في الجوال: الصورة والنص معًا من قائمة المشاركة، ويُختار واتساب منها
      if (navigator.canShare?.({ files: [file] })) {
        // بعض التطبيقات تأخذ الصورة وتترك النص، فيُنسخ النص ليُلصق إن لزم
        try { await navigator.clipboard.writeText(text); } catch { /* النسخ اختياري */ }
        await navigator.share({ files: [file], text });
        setMsg("إن لم يظهر النص مع الصورة في واتساب فالصقه، فقد نُسخ.");
      } else {
        // في الحاسب: تُنزَّل البطاقة ويُفتح واتساب بالنص، ثم تُرفق الصورة يدويًا
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        setMsg("نُزّلت البطاقة، أرفقها في محادثة واتساب مع النص.");
      }
    } catch (e) {
      if (e?.name !== "AbortError") setMsg("تعذّرت المشاركة. جرّب مرة أخرى.");
    }
    setBusy("");
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

      <div className="space-y-2 rounded-card border border-line bg-canvas p-3">
        <p className="text-sm font-bold text-ink">المشاركة عبر واتساب</p>
        <p className="text-xs text-muted">تُرسل صورة البطاقة مع كلمتك والرابط، ويكتب الزائر ملاحظاته في سجل الزوار.</p>
        <textarea className="field min-h-28 text-sm" value={waMsg} maxLength={600} aria-label="الكلمة الترحيبية"
                  onChange={(e) => setWaMsg(e.target.value)} onBlur={saveMsg} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={whatsapp} disabled={busy === "wa"}
                  className="btn-primary" style={{ background: "#1FA855", borderColor: "#1FA855" }}>
            {busy === "wa" ? "جارٍ التجهيز…" : "مشاركة عبر واتساب"}
          </button>
          {waMsg.trim() !== SHARE_MSG.trim() && (
            <button type="button" className="text-xs text-muted underline" onClick={() => { setWaMsg(SHARE_MSG); onSave({ share_msg: null }); }}>
              الكلمة الافتراضية
            </button>
          )}
        </div>
      </div>
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
                <li key={v.id} className="flex items-start gap-3 py-2 text-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-tint font-bold text-mint-deep">
                    {(v.visitor_name || "ز").trim().charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-ink">{[v.visitor_name || "زائر بلا اسم", v.visitor_org].filter(Boolean).join("، ")}</p>
                    <p className="text-xs text-muted">{fmtDateTime(v.started_at)}، {VIA[v.via] ?? "الرابط"}</p>
                    {v.note && <p className="mt-1.5 whitespace-pre-line rounded-sm2 bg-mint-tint px-2.5 py-1.5 text-sm text-ink">{v.note}</p>}
                  </div>
                  <span className="shrink-0 self-start text-xs text-muted">{dur(v.seconds)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}
