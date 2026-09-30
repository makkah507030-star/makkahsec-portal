// src/components/ReplyFiles.jsx
import { useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { shrinkImage } from "../lib/imageResize";

/* =====================================================================
   مرفقات الإفادة — يرفقها المستفيد مع ردّه على نموذج (مساءلة غياب…):
   تقرير طبي أو مستند عذر، PDF أو صورة.
   • تُحفظ في مخزن خاص reply-files بالمسار <معرّف المستند>/<اسم>،
     ولا يراها إلا صاحب المستند ومُصدِره وإدارة النماذج (سياسات
     supabase/reply_files.sql). لا رابط عام: تُفتح برابط مؤقت.
   • قائمتها في data.reply_files للمستند: [{ path, name, type, size }].
   ===================================================================== */

export const REPLY_BUCKET = "reply-files";
export const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

const isPdf = (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name ?? "");
const sizeLabel = (b) => b >= 1024 * 1024
  ? `${(b / 1024 / 1024).toFixed(1)} م.ب`
  : `${Math.max(1, Math.round(b / 1024))} ك.ب`;

/** يفتح المرفق في تبويب جديد برابط مؤقت. التبويب يُفتح قبل الانتظار
    حتى لا يحجبه متصفح الجوال (يجب أن يبقى ضمن نقرة المستخدم). */
export async function openReplyFile(path) {
  const win = window.open("", "_blank");
  const { data } = await supabase.storage.from(REPLY_BUCKET).createSignedUrl(path, 300);
  if (!data?.signedUrl) {
    if (win) win.close();
    alert("تعذّر فتح المرفق.");
    return;
  }
  if (win) win.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

function FileIcon({ pdf }) {
  return (
    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm2 text-[10px] font-bold ${
      pdf ? "bg-absent/10 text-absent" : "bg-mint-tint text-mint-deep"}`}>
      {pdf ? "PDF" : "صورة"}
    </span>
  );
}

/** قائمة للقراءة: للإدارة، ولصاحب المستند بعد إرسال إفادته */
export function ReplyFilesList({ files, title = "مرفقات الإفادة" }) {
  if (!files?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-ink">
        {title} <span className="num font-normal text-faint">({files.length})</span>
      </p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {files.map((f) => (
          <button key={f.path} type="button" onClick={() => openReplyFile(f.path)}
                  className="flex max-w-full items-center gap-2 rounded-sm2 border border-line bg-white px-2.5 py-1.5 text-right hover:bg-canvas">
            <FileIcon pdf={isPdf(f)} />
            <span className="min-w-0">
              <span className="block max-w-[14rem] truncate text-xs font-medium text-ink">{f.name}</span>
              <span className="num block text-[10.5px] text-faint">{sizeLabel(f.size ?? 0)} · اضغط للفتح</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** إرفاق وحذف قبل إرسال الإفادة — files/onChange تحفظهما صفحة المستند */
export function ReplyFilesEditor({ docId, files = [], onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const add = async (picked) => {
    setErr("");
    const room = MAX_FILES - files.length;
    if (room <= 0) { setErr(`الحد الأقصى ${MAX_FILES} مرفقات.`); return; }
    const list = Array.from(picked).slice(0, room);
    setBusy(true);
    const added = [];
    for (const orig of list) {
      const pdf = isPdf(orig);
      if (!pdf && !(orig.type || "").startsWith("image/")) {
        setErr(`«${orig.name}» ليس PDF ولا صورة.`); continue;
      }
      // الصور تُصغَّر (صور كاميرا الجوال كبيرة)، وPDF يُرفع كما هو
      const file = pdf ? orig : await shrinkImage(orig, 2000, 0.85);
      if (file.size > MAX_BYTES) {
        setErr(`«${orig.name}» أكبر من 5 م.ب.`); continue;
      }
      const ext = pdf ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = `${docId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(REPLY_BUCKET)
        .upload(path, file, { contentType: pdf ? "application/pdf" : file.type, upsert: false });
      if (error) { setErr(`تعذّر رفع «${orig.name}»: ${error.message}`); continue; }
      added.push({ path, name: orig.name || `مرفق.${ext}`, type: pdf ? "application/pdf" : file.type, size: file.size });
    }
    setBusy(false);
    if (added.length) onChange([...files, ...added]);
    if (input.current) input.current.value = "";
  };

  const remove = async (f) => {
    setErr("");
    const { error } = await supabase.storage.from(REPLY_BUCKET).remove([f.path]);
    if (error) { setErr(`تعذّر الحذف: ${error.message}`); return; }
    onChange(files.filter((x) => x.path !== f.path));
  };

  return (
    <div className="rounded-sm2 border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ink">مرفقات الإفادة <span className="font-normal text-faint">(اختياري)</span></p>
          <p className="mt-0.5 text-[11px] text-faint">
            تقرير طبي أو مستند عذر — PDF أو صورة، حتى {MAX_FILES} ملفات، 5 م.ب لكل ملف.
          </p>
        </div>
        {files.length < MAX_FILES && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
                  className="rounded-pill border border-mint-deep px-3 py-1.5 text-xs font-medium text-mint-deep hover:bg-mint-tint disabled:opacity-50">
            {busy ? "جارٍ الرفع…" : "إرفاق مستند"}
          </button>
        )}
        <input ref={input} type="file" accept={ACCEPT} multiple className="hidden"
               onChange={(e) => e.target.files?.length && add(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {files.map((f) => (
            <div key={f.path} className="flex items-center gap-2 rounded-sm2 bg-canvas px-2 py-1.5">
              <FileIcon pdf={isPdf(f)} />
              <button type="button" onClick={() => openReplyFile(f.path)} className="min-w-0 flex-1 text-right">
                <span className="block truncate text-xs font-medium text-ink">{f.name}</span>
                <span className="num block text-[10.5px] text-faint">{sizeLabel(f.size ?? 0)}</span>
              </button>
              <button type="button" onClick={() => remove(f)}
                      className="shrink-0 rounded-pill border border-absent/30 px-2.5 py-1 text-[11px] text-absent hover:bg-absent/5">
                حذف
              </button>
            </div>
          ))}
        </div>
      )}

      {err && <p className="mt-2 text-xs text-absent">{err}</p>}
    </div>
  );
}
