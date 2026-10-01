// src/pages/BehaviorFormView.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { useNotice } from "../lib/useNotice.js";
import Loader from "../components/Loader.jsx";
import BehaviorSheet, { FORM_KINDS, weekday } from "../components/BehaviorSheet.jsx";
import { ReferralPrintArea } from "../components/ReferralSheet.jsx";
import { loadStamp } from "./BehaviorForms.jsx";

/* =====================================================================
   نموذج السلوك لصاحبه: الطالب يتعهد، وولي الأمر يقرّ بالاطّلاع على التعهد
   أو يرد على الدعوة (الحضور في الموعد أو طلب تغييره خلال الأسبوع).
   ===================================================================== */
export default function BehaviorFormView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const [f, setF] = useState(null);
  const [error, setError] = useState("");
  const [stamp, setStamp] = useState(null);
  const [isGuardian, setIsGuardian] = useState(false);
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState("attend");
  const [newDate, setNewDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);

  const load = async () => {
    const { data, error: e } = await supabase.from("behavior_forms").select("*").eq("id", id).maybeSingle();
    if (e || !data) { setError("النموذج غير موجود أو لا تملك صلاحية عرضه."); return; }
    setF(data);
    if (uid) {
      const { data: g } = await supabase.from("guardians").select("id").eq("user_id", uid).maybeSingle();
      if (g) {
        const { data: link } = await supabase.from("guardian_student").select("student_id")
          .eq("guardian_id", g.id).eq("student_id", data.student_id).maybeSingle();
        setIsGuardian(Boolean(link));
      }
    }
  };
  useEffect(() => { load(); loadStamp().then(setStamp); }, [id, uid]);

  useLayoutEffect(() => {
    const fit = () => { const w = box.current?.clientWidth ?? 0; if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794))); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [f]);

  const ack = async () => {
    if (f.kind === "invite" && isGuardian && choice === "reschedule" && !newDate) return;
    setBusy(true);
    const reply = f.kind === "invite" && isGuardian ? { choice, date: choice === "reschedule" ? newDate : null } : null;
    const { error: e } = await supabase.rpc("behavior_form_ack", { p_id: f.id, p_note: note.trim() || null, p_reply: reply });
    setBusy(false);
    if (e) { setMsg({ ok: false, text: `تعذّر الحفظ: ${e.message}` }); return; }
    setMsg({ ok: true, text: "شكرًا لك، وصل ردّك للمدرسة." });
    load();
  };

  if (error) return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold text-ink">تعذّر عرض النموذج</p>
      <p className="mt-1.5 text-sm text-muted">{error}</p>
      <button onClick={() => navigate("/")} className="mt-4 rounded-pill border border-line px-4 py-1.5 text-sm text-muted">العودة للرئيسية</button>
    </div>
  );
  if (!f) return <Loader />;

  const k = FORM_KINDS[f.kind];
  const isStudent = effectiveRole === "student";
  const studentTurn = isStudent && f.kind === "pledge" && !f.student_ack_at;
  const guardianTurn = isGuardian && !f.guardian_ack_at;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">{k.title} — {f.student_name}</h1>
          <p className="num mt-0.5 text-xs text-faint">{f.serial}</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
      </div>

      {(studentTurn || guardianTurn) && (
        <section className="no-print card space-y-3 p-4">
          {studentTurn && (
            <p className="text-sm leading-relaxed text-ink">
              اطّلع على التعهد أدناه، ثم أكّد تعهّدك بعدم تكرار أي مشكلة سلوكية مستقبلًا.
            </p>
          )}
          {guardianTurn && f.kind === "notice" && (
            <p className="text-sm leading-relaxed text-ink">اطّلع على الإشعار والإجراءات المقررة أدناه، ثم أكّد اطّلاعك واكتب ملاحظتك إن رغبت.</p>
          )}
          {guardianTurn && f.kind === "pledge" && (
            <p className="text-sm leading-relaxed text-ink">اطّلع على تعهد ابنكم أدناه، ثم أكّد اطّلاعك واكتب ملاحظتك إن رغبت.</p>
          )}
          {guardianTurn && f.kind === "invite" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink">ردّك على الدعوة</p>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="radio" className="mt-1" checked={choice === "attend"} onChange={() => setChoice("attend")} />
                أُقرّ بالعلم، وسأحضر في الموعد المحدد.
              </label>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="radio" className="mt-1" checked={choice === "reschedule"} onChange={() => setChoice("reschedule")} />
                أُقرّ بالعلم، وأرغب بتغيير الموعد (خلال نفس الأسبوع).
              </label>
              {choice === "reschedule" && (
                <div className="flex items-center gap-2 pr-6">
                  <input type="date" className="field" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  {newDate && <span className="text-xs text-muted">{weekday(newDate)}</span>}
                </div>
              )}
            </div>
          )}
          {guardianTurn && (
            <textarea rows={3} className="field w-full" value={note} placeholder="ملاحظتك (اختياري)"
                      onChange={(e) => setNote(e.target.value)} />
          )}
          <button className="btn-primary w-full" disabled={busy || (guardianTurn && f.kind === "invite" && choice === "reschedule" && !newDate)}
                  onClick={ack}>
            {busy ? "جارٍ الإرسال…" : studentTurn ? "أتعهد بذلك" : f.kind === "invite" ? "إرسال الرد" : "أُقرّ بالاطّلاع"}
          </button>
        </section>
      )}

      {msg && (
        <p className={`no-print rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
      )}
      {!studentTurn && !guardianTurn && (isStudent || isGuardian) && (
        <p className="no-print rounded-card bg-present/10 px-4 py-3 text-sm text-present">وصل ردّك، وهو محفوظ في النموذج.</p>
      )}

      <div ref={box} className="no-print overflow-hidden rounded-card border border-line bg-white">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: 794, height: 1123 * scale }}>
          <BehaviorSheet f={f} stampUrl={stamp} />
        </div>
      </div>
      <div className="hidden print:block">
        <ReferralPrintArea><BehaviorSheet f={f} stampUrl={stamp} /></ReferralPrintArea>
      </div>
    </div>
  );
}
