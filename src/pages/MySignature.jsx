// src/pages/MySignature.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import Loader from "../components/Loader.jsx";
import { useNotice } from "../lib/useNotice.js";
import SignatureCleaner from "../components/SignatureCleaner.jsx";

/* =====================================================================
   توقيعي — يرفع كل مستخدم توقيعه ويستبدله أو يحذفه.
   الملف في مخزن خاص، لا يُقرأ برابط مباشر، وسياسات القاعدة تمنع
   أي شخص من الرفع أو القراءة باسم غيره.
   قبل الرفع تُنظَّف الصورة: خط أسود عريض على خلفية شفافة.
   ===================================================================== */

const MAX_KB = 500;           // حد الملف بعد التحسين
const MAX_INPUT_MB = 15;      // صور الجوال الأصلية قد تكون كبيرة

export default function MySignature() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;
  const fileRef = useRef(null);
  const [path, setPath] = useState(null);
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState(null);   // الصورة المختارة قبل التحسين

  const load = async () => {
    const { data } = await supabase.from("user_signatures")
      .select("path").eq("user_id", uid).maybeSingle();
    setPath(data?.path ?? null);
    if (data?.path) {
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(data.path, 600);
      setUrl(s?.signedUrl ?? null);
    } else setUrl(null);
    setLoading(false);
  };

  useEffect(() => { if (uid) load(); }, [uid]);

  const pick = (file) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setMsg({ ok: false, text: "الصيغ المقبولة: PNG أو JPG أو WEBP." }); return;
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
      setMsg({ ok: false, text: `حجم الصورة يتجاوز ${MAX_INPUT_MB} ميغابايت.` }); return;
    }
    setMsg(null);
    setRaw(file);
  };

  const upload = async (file) => {
    if (file.size > MAX_KB * 1024) {
      setMsg({ ok: false, text: `حجم التوقيع بعد التحسين يتجاوز ${MAX_KB} كيلوبايت. اقتصّ الصورة حول التوقيع وأعد المحاولة.` });
      setRaw(null); return;
    }
    setBusy(true); setMsg(null);
    const key = `signatures/${uid}/signature.png`;

    const { error: ue } = await supabase.storage.from("form-assets")
      .upload(key, file, { upsert: true, contentType: "image/png" });
    if (ue) { setBusy(false); setMsg({ ok: false, text: `تعذّر الرفع: ${ue.message}` }); return; }

    const { error: de } = await supabase.from("user_signatures")
      .upsert({ user_id: uid, path: key, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setBusy(false);
    setRaw(null);
    if (de) { setMsg({ ok: false, text: de.message }); return; }
    // التوقيع القديم بصيغة أخرى لم يعد مستخدمًا
    if (path && path !== key) await supabase.storage.from("form-assets").remove([path]);
    setMsg({ ok: true, text: "حُفظ توقيعك." });
    load();
  };

  const remove = async () => {
    setBusy(true); setMsg(null);
    if (path) await supabase.storage.from("form-assets").remove([path]);
    await supabase.from("user_signatures").delete().eq("user_id", uid);
    setBusy(false);
    setMsg({ ok: true, text: "حُذف توقيعك." });
    load();
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">توقيعي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          يُدرج توقيعك تلقائيًا في النماذج التي تصدرها باسمك.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-28 w-56 shrink-0 place-items-center rounded-card border border-dashed border-line bg-paper">
            {url
              ? <img src={url} alt="توقيعي" className="max-h-24 max-w-52 object-contain" />
              : <span className="text-xs text-faint">لا يوجد توقيع</span>}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              {profile?.full_name ?? profile?.username ?? ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? "جارٍ…" : path ? "استبدال التوقيع" : "رفع التوقيع"}
              </button>
              {path && (
                <button onClick={remove} disabled={busy}
                        className="rounded-sm2 border border-absent/40 px-4 py-2 text-sm text-absent hover:bg-absent/5">
                  حذف
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                   onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        </div>

        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}
      </section>

      {raw && (
        <SignatureCleaner file={raw} busy={busy} onSave={upload} onCancel={() => setRaw(null)} />
      )}

      <section className="card p-4">
        <h2 className="text-sm font-semibold text-ink">كيف تحصل على صورة توقيع نظيفة</h2>
        <ol className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
          <li>وقّع بقلم أسود أو أزرق على ورقة بيضاء خالية من السطور.</li>
          <li>صوّرها في إضاءة جيدة، واجعل التوقيع يملأ معظم الصورة.</li>
          <li>ترفعها كما هي، والبوابة تزيل الخلفية وتحوّل الخط إلى أسود عريض تلقائيًا، وتعرض لك النتيجة قبل الحفظ.</li>
        </ol>
        <p className="mt-3 rounded-sm2 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
          توقيعك أمانة. أي صورة توقيع يمكن نسخها، لذلك لا تشاركها خارج البوابة،
          واستبدلها فورًا إن شككت في وصولها لغيرك.
        </p>
      </section>
    </div>
  );
}
