// src/components/GuidanceThread.jsx
/* =====================================================================
   محادثة طلب مقابلة الموجه الطلابي (supabase/guidance_6.sql): رسائل نصية بين الموجه وصاحب
   الطلب، ورسالة صوتية للموجه وولي الأمر (الطالب نصًا). كل رسالة تصل الطرف الآخر إشعارًا.
   ===================================================================== */
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { VoiceRecorder, VoicePlayer, uploadVoice } from "./Voice.jsx";

export const GUIDANCE_VOICE = "guidance-voice";

/* side: طرف المستخدم (counselor | requester)؛ voice: هل يرسل رسالة صوتية؛ closed: الطلب مغلق */
export default function GuidanceThread({ requestId, side, voice, closed, onSent }) {
  const [rows, setRows] = useState(null);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(null);
  const [recKey, setRecKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef(null);

  const load = () => supabase.from("guidance_messages").select("id, side, sender_name, body, audio_path, audio_secs, created_at")
    .eq("request_id", requestId).order("created_at", { ascending: true })
    .then(({ data, error }) => { if (error) setErr(/guidance_messages/.test(error.message) ? "المحادثة تحتاج تشغيل supabase/guidance_6.sql." : error.message); setRows(data ?? []); });
  useEffect(() => { load(); }, [requestId]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [rows?.length]);

  const send = async () => {
    setBusy(true); setErr("");
    try {
      const audio = rec ? await uploadVoice(requestId, rec, GUIDANCE_VOICE) : null;
      const { error } = await supabase.from("guidance_messages").insert({
        request_id: requestId, body: text.trim() || null, audio_path: audio, audio_secs: rec?.secs ?? null,
      });
      if (error) throw error;
      setText(""); setRec(null); setRecKey((k) => k + 1);
      await load(); onSent?.();
    } catch (e) { setErr(e.message ?? String(e)); }
    setBusy(false);
  };

  if (!rows) return <p className="text-xs text-muted">جارٍ التحميل…</p>;
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <ul className="max-h-80 space-y-2 overflow-y-auto rounded-sm2 bg-canvas/60 p-2">
          {rows.map((m) => {
            const mine = m.side === side;
            return (
              <li key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] space-y-1 rounded-card px-3 py-2 text-sm ${mine ? "bg-mint-tint text-ink" : "border border-line bg-white text-ink"}`}>
                  <p className="text-[11px] font-semibold text-muted">{m.side === "counselor" ? "الموجه الطلابي" : m.sender_name ?? "صاحب الطلب"}
                    <span className="num mr-2 font-normal text-faint">{fmtDateTime(m.created_at)}</span></p>
                  {m.body && <p className="whitespace-pre-line leading-relaxed">{m.body}</p>}
                  {m.audio_path && <VoicePlayer path={m.audio_path} secs={m.audio_secs} bucket={GUIDANCE_VOICE} label="رسالة صوتية" />}
                </div>
              </li>
            );
          })}
          <li ref={end} />
        </ul>
      )}
      {closed ? <p className="text-xs text-muted">أُغلق هذا الطلب.</p> : (
        <div className="space-y-2">
          <textarea className="field w-full" rows={2} value={text} placeholder={side === "counselor" ? "اكتب ردك…" : "اكتب رسالتك…"}
                    onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-start gap-2">
            {voice && <div className="min-w-0 flex-1"><VoiceRecorder key={recKey} onChange={setRec} disabled={busy} label="سجّل رسالة صوتية" /></div>}
            <button type="button" className="btn-primary" disabled={busy || (!text.trim() && !rec)} onClick={send}>
              {busy ? "جارٍ الإرسال…" : "إرسال"}</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs text-absent">{err}</p>}
    </div>
  );
}
