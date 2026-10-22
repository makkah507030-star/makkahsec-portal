// src/pages/qudrat/QudratAsks.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { fmtHijri } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { CMP, SECS, SKILLS, loadBank } from "../../qudrat-content/index.js";
import { LETTERS, Stem } from "./shared.jsx";
import { VoicePlayer, VoiceRecorder, uploadVoice } from "../../components/Voice.jsx";

/* =====================================================================
   أسئلة الطلاب في مركز التدريب (القدرات): يرى المعلم ما وصله من طلاب فصوله
   (الكمي لمعلم الرياضيات، واللفظي لمعلم اللغة العربية)، ومعه السؤال الأصلي
   وإجابته وطريقة حله، فيرد ويصل الرد إلى الطالب بإشعار. والمدير ووكيل
   الشؤون التعليمية والدعم الفني يرون الكل، ومنه ما لم يُحدَّد له معلم.
   والرد نص أو تسجيل صوتي أو كلاهما (qudrat_5.sql).
   ===================================================================== */

export default function QudratAsks() {
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [bank, setBank] = useState({});
  const [tab, setTab] = useState("open");
  const [err, setErr] = useState("");

  const load = async () => {
    const [{ data, error }, official] = await Promise.all([
      supabase.from("qudrat_asks").select("*").order("created_at", { ascending: false }).limit(300),
      loadBank(),
    ]);
    if (error) setErr(/qudrat_asks/.test(error.message) ? "الخدمة غير مفعّلة بعد: يلزم تشغيل ملفي supabase/qudrat_3.sql و qudrat_4.sql." : error.message);
    setBank(Object.fromEntries(official.map((q) => [q.key, q])));
    const sids = [...new Set((data ?? []).map((r) => r.student_id).filter(Boolean))];
    const tids = [...new Set((data ?? []).map((r) => r.teacher_id).filter(Boolean))];
    const [{ data: ss }, { data: ts }] = await Promise.all([
      sids.length ? supabase.from("v_active_students").select("student_id, full_name, grade, class_no").in("student_id", sids).eq("status", "active") : { data: [] },
      tids.length ? supabase.from("teachers").select("id, full_name").in("id", tids) : { data: [] },
    ]);
    setNames({ s: Object.fromEntries((ss ?? []).map((s) => [s.student_id, s])), t: Object.fromEntries((ts ?? []).map((t) => [t.id, t.full_name])) });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  // الرد الصوتي وحده يترك النص فارغًا، فالعبرة بوقت الرد
  const list = useMemo(() => (rows ?? []).filter((r) => (tab === "open" ? !r.replied_at : !!r.replied_at)), [rows, tab]);
  if (rows === null) return <Loader />;
  const openN = rows.filter((r) => !r.replied_at).length;
  const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/qudrat" className="text-xs font-semibold text-mint-deep">مركز التدريب</Link>
        <h1 className="text-lg font-bold text-ink">أسئلة الطلاب</h1>
        <p className="mt-1 text-sm text-muted">ما سأل عنه طلابك في تدريب القدرات، مع السؤال الأصلي وطريقة حله. ردّك يصل إلى الطالب بإشعار.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex gap-1.5">
        <button className={pill(tab === "open")} onClick={() => setTab("open")}>بانتظار الرد <span className="num">({openN})</span></button>
        <button className={pill(tab === "done")} onClick={() => setTab("done")}>تم الرد <span className="num">({rows.length - openN})</span></button>
      </div>
      {!list.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">{tab === "open" ? "لا أسئلة بانتظار الرد." : "لا ردود بعد."}</p>
      ) : (
        <div className="space-y-3">
          {list.map((r) => <AskCard key={r.id} r={r} st={names.s?.[r.student_id]} teacher={names.t?.[r.teacher_id]} q={bank[r.qkey]}
                                     onReplied={(v) => setRows((l) => l.map((x) => (x.id === r.id ? { ...x, ...v, replied_at: new Date().toISOString() } : x)))} />)}
        </div>
      )}
    </div>
  );
}

function AskCard({ r, st, teacher, q, onReplied }) {
  const [show, setShow] = useState(false);
  const [text, setText] = useState("");
  const [voice, setVoice] = useState(null);   // { blob, secs, ext }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true); setErr("");
    try {
      const audio = voice ? await uploadVoice(r.id, voice) : null;
      const { error } = await supabase.rpc("qudrat_reply", { p_id: r.id, p_reply: text, p_audio: audio, p_secs: voice?.secs ?? null });
      if (error) throw new Error(/qudrat_reply/.test(error.message) && voice ? "الرد الصوتي غير مفعّل بعد: يلزم تشغيل ملف supabase/qudrat_5.sql." : error.message);
      onReplied({ reply: text.trim(), reply_audio: audio, reply_secs: voice?.secs ?? null });
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const opts = q ? (q.cmp ? CMP : q.o) : null;
  return (
    <section className="card space-y-2.5 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b className="text-ink">{st?.full_name ?? "حساب غير طالب"}</b>
        {st && <span className="text-xs text-muted">الصف <span className="num">{st.grade}</span> · فصل <span className="num">{st.class_no}</span></span>}
        <span className={`chip ${SECS[r.sec]?.bg} ${SECS[r.sec]?.c}`}>{SKILLS[r.skill]?.t ?? SECS[r.sec]?.t}</span>
        <span className="num mr-auto text-xs text-faint">{fmtHijri(r.created_at)}</span>
      </div>
      {!r.teacher_id && <p className="text-xs text-late">لم يُحدَّد له معلم (لا معلم للمادة في جدول فصله)، فيظهر للإدارة.</p>}
      {r.teacher_id && teacher && <p className="text-xs text-faint">المعلم: {teacher}</p>}
      {(q || r.q_text) && (
        <div className="rounded-sm2 bg-canvas px-3 py-2">
          <button className="flex w-full justify-between text-right text-xs font-semibold text-muted" onClick={() => setShow((x) => !x)}>
            <span className="line-clamp-1">السؤال: {q?.q ?? r.q_text}</span><span className="shrink-0 text-mint-deep">{show ? "إخفاء" : "عرض"}</span>
          </button>
          {show && q && (
            <div className="mt-2 space-y-2 text-sm">
              <Stem q={q} />
              <p><span className="text-muted">الإجابة الصحيحة: </span><b className="text-present">({LETTERS[q.a]}) {opts[q.a]}</b></p>
              {q.method && <p className="leading-loose text-ink"><b className="text-mint-deep">طريقة الحل في البنك: </b>{q.method}</p>}
            </div>
          )}
        </div>
      )}
      <p className="text-[15px] leading-relaxed text-ink">{r.body}</p>
      {r.replied_at ? (
        <div className="space-y-2 rounded-sm2 bg-mint-tint px-3 py-2 text-sm leading-relaxed text-ink">
          {r.reply && <p><b className="text-mint-deep">الرد: </b>{r.reply}</p>}
          {r.reply_audio && <VoicePlayer path={r.reply_audio} secs={r.reply_secs} />}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea className="field min-h-[4.5rem]" value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب شرحك للطالب، أو سجّله بصوتك، أو كليهما…" />
          <VoiceRecorder onChange={setVoice} disabled={busy} />
          {err && <p className="text-xs text-absent">{err}</p>}
          <button className="btn-primary" disabled={busy || (text.trim().length < 2 && !voice)} onClick={send}>{busy ? "جاري الإرسال…" : "أرسل الرد"}</button>
        </div>
      )}
    </section>
  );
}
