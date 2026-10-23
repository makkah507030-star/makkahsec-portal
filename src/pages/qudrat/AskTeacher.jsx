// src/pages/qudrat/AskTeacher.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import { SECS, SKILLS } from "../../qudrat-content/index.js";
import { VoicePlayer } from "../../components/Voice.jsx";

/* =====================================================================
   سؤال المعلم في مركز التدريب (القدرات): الطالب يسأل عن سؤال لم يفهم حله،
   فيصل إلى معلم مادته في فصله (الكمي لمعلم الرياضيات، واللفظي لمعلم اللغة
   العربية) بإشعار، ويعود الرد إليه بإشعار. التوجيه والرد في qudrat_3/4.sql.
   ===================================================================== */

/* زر «اسأل معلمك» تحت السؤال بعد حله */
export function AskButton({ q }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [state, setState] = useState("");   // "" | "busy" | "sent" | رسالة خطأ
  if (state === "sent") return <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">أُرسل سؤالك لمعلم {q.sec === "quant" ? "الرياضيات" : "اللغة العربية"}، وسيصلك إشعار برده.</p>;
  if (!open) return <button className="text-sm font-semibold text-mint-deep" onClick={() => setOpen(true)}>لم تفهم الحل؟ اسأل معلمك</button>;
  const send = async () => {
    if (body.trim().length < 2) return;
    setState("busy");
    const { error } = await supabase.from("qudrat_asks").insert({
      sec: q.sec, skill: q.skill, qkey: q.key, q_text: q.q.slice(0, 600), body: body.trim() });
    setState(error ? (/qudrat_asks/.test(error.message) ? "الخدمة غير مفعّلة بعد." : error.message) : "sent");
  };
  return (
    <div className="space-y-2 rounded-sm2 border border-line px-3 py-2.5">
      <p className="text-xs text-muted">يصل سؤالك إلى معلم {q.sec === "quant" ? "الرياضيات" : "اللغة العربية"} في فصلك مع نص السؤال.</p>
      <textarea className="field min-h-[4.5rem]" maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="ما الذي لم تفهمه؟ مثال: لم أفهم لماذا قسمنا على 12" />
      {state && state !== "busy" && <p className="text-xs text-absent">{state}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={state === "busy" || body.trim().length < 2} onClick={send}>{state === "busy" ? "جاري الإرسال…" : "أرسل"}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}

/* «أسئلتي للمعلمين» في رئيسية المركز، والردود الجديدة أولًا */
export function MyAsks({ uid }) {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    supabase.from("qudrat_asks").select("*").eq("student_user", uid).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setRows(data ?? []));
  }, [uid]);
  if (!rows?.length) return null;
  const fresh = rows.filter((r) => r.replied_at && !r.seen).length;
  const toggle = () => {
    setOpen((x) => !x);
    if (!open && fresh) { supabase.rpc("qudrat_seen"); setRows((l) => l.map((r) => ({ ...r, seen: r.seen || !!r.replied_at }))); }
  };
  return (
    <section className="card overflow-hidden">
      <button className="flex w-full items-center justify-between px-4 py-3 text-right" onClick={toggle}>
        <span className="font-bold text-ink">أسئلتي للمعلمين <span className="num text-sm font-normal text-muted">({rows.length})</span></span>
        {fresh > 0 ? <span className="chip bg-absent text-white">رد جديد <span className="num mr-1">{fresh}</span></span>
          : <span className="text-xs text-mint-deep">{open ? "إخفاء" : "عرض"}</span>}
      </button>
      {open && (
        <div className="divide-y divide-line/60 border-t border-line/60">
          {rows.map((r) => (
            <div key={r.id} className="space-y-1.5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className={`chip ${SECS[r.sec]?.bg} ${SECS[r.sec]?.c}`}>{SKILLS[r.skill]?.t ?? SECS[r.sec]?.t}</span>
                <span className="num">{fmtHijri(r.created_at)}</span>
              </div>
              {r.q_text && <p className="line-clamp-2 text-xs text-muted">السؤال: {r.q_text}</p>}
              <p className="text-ink">{r.body}</p>
              {r.replied_at ? (
                <div className="space-y-2 rounded-sm2 bg-mint-tint px-3 py-2 leading-relaxed text-ink">
                  {r.reply && <p><b className="text-mint-deep">رد المعلم: </b>{r.reply}</p>}
                  {r.reply_audio && <VoicePlayer path={r.reply_audio} secs={r.reply_secs} />}
                </div>
              ) : <p className="text-xs text-late">بانتظار رد المعلم</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
