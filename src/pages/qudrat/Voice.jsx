// src/pages/qudrat/Voice.jsx
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/* =====================================================================
   الرد الصوتي في مركز التدريب (القدرات): المعلم يسجّل شرحه من المتصفح
   (الحاسب أو الجوال) ويسمعه قبل الإرسال، والطالب يسمعه تحت سؤاله.
   التسجيل في المخزن الخاص qudrat-voice/<رقم السؤال>/ (qudrat_5.sql).
   ===================================================================== */

export const VOICE_BUCKET = "qudrat-voice";
const MAX_SECS = 180;   // ثلاث دقائق تكفي لشرح سؤال
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// webm في Chrome وAndroid، وmp4 في Safari وiPhone
const pickType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"]
  .find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? "";

/* المسجّل: يعيد { blob, secs, ext } عبر onChange، أو null عند الحذف */
export function VoiceRecorder({ onChange, disabled }) {
  const [state, setState] = useState("idle");   // idle | rec | done
  const [secs, setSecs] = useState(0);
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState("");
  const rec = useRef(null), timer = useRef(null), t0 = useRef(0);

  useEffect(() => () => { clearInterval(timer.current); rec.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const start = async () => {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return setErr("المتصفح لا يدعم التسجيل. جرّب Chrome أو Safari حديثًا.");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return setErr("لم يُسمح بالميكروفون. اسمح للبوابة باستخدامه من إعدادات المتصفح ثم أعد المحاولة."); }
    const type = pickType();
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      clearInterval(timer.current);
      const mime = mr.mimeType || type || "audio/webm";
      const blob = new Blob(chunks, { type: mime });
      const s = Math.max(1, Math.round((Date.now() - t0.current) / 1000));
      setUrl(URL.createObjectURL(blob)); setSecs(s); setState("done");
      onChange({ blob, secs: s, ext: mime.includes("mp4") || mime.includes("aac") ? "m4a" : "webm" });
    };
    rec.current = mr; t0.current = Date.now(); setSecs(0); setState("rec");
    mr.start();
    timer.current = setInterval(() => {
      const s = Math.round((Date.now() - t0.current) / 1000);
      setSecs(s);
      if (s >= MAX_SECS && mr.state === "recording") mr.stop();
    }, 500);
  };
  const stop = () => rec.current?.state === "recording" && rec.current.stop();
  const clear = () => { setState("idle"); setUrl(null); setSecs(0); onChange(null); };

  return (
    <div className="space-y-1.5">
      {state === "idle" && (
        <button type="button" disabled={disabled} onClick={start}
                className="flex items-center gap-2 rounded-pill border border-mint-deep/40 bg-mint-tint px-3.5 py-1.5 text-sm font-semibold text-mint-deep hover:bg-mint-tint/70">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM19 11a7 7 0 0 1-14 0M12 18v3" /></svg>
          سجّل ردًا صوتيًا
        </button>
      )}
      {state === "rec" && (
        <div className="flex items-center gap-3 rounded-sm2 bg-absent/10 px-3 py-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-absent" />
          <span className="text-sm font-semibold text-absent">جارٍ التسجيل <span className="num">{mmss(secs)}</span> من <span className="num">{mmss(MAX_SECS)}</span></span>
          <button type="button" className="chip mr-auto bg-absent text-white" onClick={stop}>إيقاف</button>
        </div>
      )}
      {state === "done" && url && (
        <div className="flex flex-wrap items-center gap-2">
          <audio src={url} controls className="h-10 max-w-full flex-1" />
          <button type="button" className="chip bg-canvas text-muted" disabled={disabled} onClick={clear}>حذف وإعادة التسجيل</button>
        </div>
      )}
      {err && <p className="text-xs text-absent">{err}</p>}
    </div>
  );
}

/* رفع التسجيل في مجلد السؤال، ويعيد مساره */
export async function uploadVoice(askId, { blob, ext }) {
  const path = `${askId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(/bucket/i.test(error.message) ? "الرد الصوتي غير مفعّل بعد: يلزم تشغيل ملف supabase/qudrat_5.sql." : error.message);
  return path;
}

/* المشغّل: رابط مؤقت للتسجيل الخاص */
export function VoicePlayer({ path, secs }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    supabase.storage.from(VOICE_BUCKET).createSignedUrl(path, 3600)
      .then(({ data, error }) => { if (live) { setUrl(data?.signedUrl ?? null); setErr(!!error); } });
    return () => { live = false; };
  }, [path]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-mint-deep">🎙️ رد صوتي{secs ? <> · <span className="num">{mmss(secs)}</span></> : null}</span>
      {url ? <audio src={url} controls preload="metadata" className="h-10 max-w-full flex-1" />
        : <span className="text-xs text-muted">{err ? "تعذّر تحميل التسجيل." : "جارٍ التحميل…"}</span>}
    </div>
  );
}
