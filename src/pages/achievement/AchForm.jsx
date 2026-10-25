// src/pages/achievement/AchForm.jsx
/* =====================================================================
   نموذج ملاحظة التحصيل الدراسي والخطة العلاجية (/ach-forms/:id) — src/lib/achForms.js.
   صفحة واحدة لكل الأطراف، وتظهر لكل طرف إجراءاته في مرحلته:
   • الموجه (ومعه الوكيل والمدير والدعم الفني): إرسال المسودة أو استبعادها، والتذكير، ومراجعة الرد.
   • المعلم: الاطلاع، ثم أسباب الضعف والخطة العلاجية لكل فصل.
   • وكيل الشؤون التعليمية: الاعتماد أو الإعادة.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate, fmtDateTime } from "../../lib/dates";
import { SEV, noticeTitle } from "../../lib/achievement";
import { FORM_STATUS, FLOW, REASONS, ACTIONS, isOverdue, setupMsg, isSetupErr } from "../../lib/achForms";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";

export function StatusChip({ f }) {
  const s = FORM_STATUS[f.status];
  return (
    <span className="chip text-[11px] font-semibold" style={{ background: s.bg, color: s.c }}>
      {s.t}{isOverdue(f) && " · تجاوز المهلة"}
    </span>
  );
}

export default function AchForm() {
  const { id } = useParams();
  const { profile, adminRoles = [] } = useSession();
  const [f, setF] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [printing, setPrinting] = useState(false);
  // رد المعلم
  const [picks, setPicks] = useState([]);
  const [other, setOther] = useState("");
  const [plans, setPlans] = useState({});

  const load = async () => {
    const { data, error } = await supabase.from("ach_forms").select("*").eq("id", id).maybeSingle();
    if (error) { setErr(isSetupErr(error) ? setupMsg : error.message); return; }
    if (!data) { setErr("النموذج غير موجود أو ليس لك صلاحية عليه."); return; }
    setF(data);
    setPicks(data.reasons?.picks ?? []); setOther(data.reasons?.other ?? "");
    setPlans(Object.fromEntries((data.classes ?? []).map((c) => [c.class_id, {
      actions: "", from: "", to: "", followup: "", students: c.students.map((s) => s.sid), ...(data.plans?.[c.class_id] ?? {}),
    }])));
  };
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const isTeacher = f && f.teacher_user === profile?.id;
  const canSend = f && adminRoles.some((r) => ["principal", "deputy_academic", "tech_support", `counselor_${f.grade}`].includes(r));
  const canDecide = adminRoles.some((r) => ["principal", "deputy_academic", "tech_support"].includes(r));
  const editable = isTeacher && ["sent", "returned"].includes(f?.status);

  useEffect(() => { if (isTeacher && !f.seen_at && ["sent", "returned"].includes(f.status)) supabase.rpc("ach_seen", { p_id: f.id }); }, [isTeacher, f?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, args, ok) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc(fn, { p_id: f.id, ...args });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: ok }); setNote(""); load();
  };

  const submitReply = () => {
    if (!picks.length && !other.trim()) { setMsg({ ok: false, text: "اختر سببًا واحدًا على الأقل أو اكتبه." }); return; }
    const missing = f.classes.find((c) => !plans[c.class_id]?.actions?.trim());
    if (missing) { setMsg({ ok: false, text: `اكتب الإجراءات العلاجية لفصل ${missing.class_no}.` }); return; }
    act("ach_reply", { p_reasons: { picks, other: other.trim() || null }, p_plans: plans }, "أُرسل ردك إلى الموجه الطلابي.");
  };

  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!f) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={isTeacher ? "/ach-forms" : "/achievement?tab=forms"} className="text-xs text-muted hover:underline">← نماذج ملاحظة التحصيل</Link>
        <button onClick={() => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 150); }}
                className="ms-auto rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep">طباعة النموذج</button>
      </div>

      <FormDoc f={f} />

      {/* رد المعلم: تحرير أو عرض */}
      {editable ? (
        <section className="card space-y-4 p-4">
          <div>
            <h2 className="text-sm font-bold text-ink">ردّك: أسباب الضعف والخطة العلاجية</h2>
            <p className="mt-1 text-[12px] text-muted">
              المهلة حتى <b className="num text-ink">{fmtDate(f.due_on)}</b>
              {f.status === "returned" && (f.review_note || f.deputy_note) && <> · <b className="text-warning">ملاحظة الإعادة:</b> {f.deputy_note || f.review_note}</>}
            </p>
          </div>
          <div>
            <p className="mb-2 text-[12.5px] font-semibold text-ink">أسباب الضعف</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setPicks((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r])}
                        className={`rounded-pill border px-3 py-1.5 text-xs ${picks.includes(r) ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted"}`}>
                  {picks.includes(r) ? "✓ " : ""}{r}
                </button>
              ))}
            </div>
            <textarea className="field mt-2 min-h-[64px] w-full text-sm" value={other} onChange={(e) => setOther(e.target.value)}
                      placeholder="أسباب أخرى أو توضيح (اختياري)" />
          </div>
          {f.classes.map((c) => {
            const p = plans[c.class_id] ?? {};
            const setP = (k, v) => setPlans((all) => ({ ...all, [c.class_id]: { ...all[c.class_id], [k]: v } }));
            return (
              <div key={c.class_id} className="space-y-2 rounded-card border border-line p-3">
                <p className="text-[13px] font-bold text-mint-deep">الخطة العلاجية · فصل {c.class_no}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIONS.map((a) => (
                    <button key={a} type="button" onClick={() => setP("actions", (p.actions ? p.actions.replace(/\s*$/, "") + "\n" : "") + "• " + a)}
                            className="rounded-pill border border-line bg-canvas px-2.5 py-1 text-[11px] text-muted hover:border-mint-light">+ {a}</button>
                  ))}
                </div>
                <textarea className="field min-h-[96px] w-full text-sm" value={p.actions ?? ""} onChange={(e) => setP("actions", e.target.value)}
                          placeholder="الإجراءات العلاجية (اضغط الاقتراحات أعلاه لإضافتها)" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-[11.5px] text-muted">من<input type="date" className="field mt-1 w-full" value={p.from ?? ""} onChange={(e) => setP("from", e.target.value)} /></label>
                  <label className="text-[11.5px] text-muted">إلى<input type="date" className="field mt-1 w-full" value={p.to ?? ""} onChange={(e) => setP("to", e.target.value)} /></label>
                  <label className="text-[11.5px] text-muted">المتابعة وقياس الأثر<input className="field mt-1 w-full" value={p.followup ?? ""} onChange={(e) => setP("followup", e.target.value)} placeholder="مثل: اختبار قصير بعد أسبوعين" /></label>
                </div>
                {c.students.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11.5px] text-muted">الطلاب المستهدفون (تصل نسخة الخطة لأولياء أمورهم بعد اعتماد الموجه)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.students.map((s) => {
                        const on = (p.students ?? []).includes(s.sid);
                        return (
                          <button key={s.sid} type="button" onClick={() => setP("students", on ? p.students.filter((x) => x !== s.sid) : [...(p.students ?? []), s.sid])}
                                  className={`rounded-pill border px-2.5 py-1 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint line-through"}`}>
                            {s.name.split(" ").slice(0, 3).join(" ")} <span className="num">{s.pct}%</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={submitReply} disabled={busy} className="w-full rounded-card bg-mint-deep py-2.5 text-sm font-semibold text-white">
            {busy ? "…" : "إرسال الرد للموجه الطلابي"}
          </button>
        </section>
      ) : f.replied_at ? <Reply f={f} /> : null}

      {/* إجراءات الموجه والوكيل */}
      {canSend && ["draft", "excluded"].includes(f.status) && (
        <ActionBox title={f.status === "excluded" ? "النموذج مستبعد — يمكن إرساله رغم ذلك" : "إرسال النموذج للمعلم"} note={note} setNote={setNote}
                   placeholder="ملاحظة للمعلم (اختياري)" busy={busy}
                   buttons={[
                     { t: "إرسال للمعلم", primary: true, on: () => act("ach_send", { p_note: note }, "أُرسل النموذج للمعلم بمهلة 5 أيام دراسية.") },
                     ...(f.status === "draft" ? [{ t: "استبعاد", on: () => act("ach_exclude", { p_reason: note }, "استُبعد النموذج."), hint: "اكتب سبب الاستبعاد في الخانة" }] : []),
                   ]} />
      )}
      {canSend && ["sent", "returned"].includes(f.status) && (
        <section className="card flex flex-wrap items-center gap-2 p-4">
          <p className="text-[12.5px] text-muted">
            {f.seen_at ? `اطّلع المعلم ${fmtDateTime(f.seen_at)}` : "لم يفتح المعلم النموذج بعد"} · المهلة {fmtDate(f.due_on)}
            {f.reminded_at && ` · آخر تذكير ${fmtDateTime(f.reminded_at)}`}
          </p>
          <button onClick={() => act("ach_remind", {}, "أُرسل التذكير للمعلم.")} disabled={busy}
                  className="ms-auto rounded-pill border border-line bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep">تذكير المعلم</button>
        </section>
      )}
      {canSend && f.status === "replied" && (
        <ActionBox title="مراجعة رد المعلم" note={note} setNote={setNote} placeholder="ملاحظتك (مطلوبة عند الإعادة)" busy={busy}
                   buttons={[
                     { t: "اعتماد ورفع للوكيل", primary: true, on: () => act("ach_review", { p_ok: true, p_note: note }, "رُفع النموذج للوكيل، ووصلت الخطة أولياء أمور الطلاب المستهدفين.") },
                     { t: "إعادة للمعلم للاستكمال", on: () => act("ach_review", { p_ok: false, p_note: note }, "أُعيد النموذج للمعلم.") },
                   ]} />
      )}
      {canDecide && f.status === "forwarded" && (
        <ActionBox title="قرار وكيل الشؤون التعليمية" note={note} setNote={setNote} placeholder="توجيه أو ملاحظة (مطلوبة عند الإعادة)" busy={busy}
                   buttons={[
                     { t: "اعتماد الخطة", primary: true, on: () => act("ach_decide", { p_ok: true, p_note: note }, "اعتُمدت الخطة.") },
                     { t: "إعادة للمعلم", on: () => act("ach_decide", { p_ok: false, p_note: note }, "أُعيد النموذج للمعلم.") },
                   ]} />
      )}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {/* سجل الإجراءات */}
      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink">سجل الإجراءات</h2>
        <ol className="space-y-1.5 border-s-2 border-line ps-3">
          {(f.log ?? []).map((e, i) => (
            <li key={i} className="text-[12px] text-muted">
              <b className="font-semibold text-ink">{e.action}</b> · {e.by} · <span className="num">{fmtDateTime(e.at)}</span>
              {e.note && <span className="block text-[11.5px]">«{e.note}»</span>}
            </li>
          ))}
        </ol>
      </section>

      {printing && (
        <PrintPortal id="ach-print" margin="12mm 12mm">
          <div dir="rtl" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 12 }}>
            <FormDoc f={f} print />
            {f.replied_at && <Reply f={f} print />}
          </div>
        </PrintPortal>
      )}
    </div>
  );
}

function ActionBox({ title, note, setNote, placeholder, buttons, busy }) {
  return (
    <section className="card space-y-2 p-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <textarea className="field min-h-[64px] w-full text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={placeholder} />
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button key={b.t} onClick={b.on} disabled={busy} title={b.hint}
                  className={b.primary ? "rounded-pill bg-mint-deep px-4 py-2 text-xs font-semibold text-white"
                                       : "rounded-pill border border-line bg-white px-4 py-2 text-xs font-semibold text-muted"}>
            {busy ? "…" : b.t}
          </button>
        ))}
      </div>
    </section>
  );
}

/* النموذج نفسه: الترويسة، والمراحل، وأرقام كل فصل وملاحظاته وطلابه المتعثرون */
export function FormDoc({ f, print }) {
  const step = f.status === "returned" ? 1 : f.status === "excluded" ? -1 : FLOW.indexOf(f.status);
  return (
    <section className={print ? "" : "card overflow-hidden"}>
      <div className={`flex items-start justify-between gap-4 ${print ? "" : "border-b border-line bg-mint-tint/40 px-4 py-3"}`}>
        <div className="text-[11px] leading-[1.8] text-ink">
          <div>المملكة العربية السعودية · وزارة التعليم</div>
          <div className="font-bold text-mint-deep">مدرسة مكة الثانوية · الشؤون التعليمية</div>
        </div>
        <div className="flex items-center gap-3">
          <img src={moeLogo} alt="" className="h-9 w-auto" />
          <img src={logoIcon} alt="" className="h-9 w-auto" />
        </div>
      </div>
      <div className={print ? "mt-4" : "p-4"}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[16px] font-bold text-mint-deep">نموذج ملاحظة التحصيل الدراسي والخطة العلاجية</h1>
          {!print && <StatusChip f={f} />}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-4">
          <Field k="المعلم" v={f.teacher_name} />
          <Field k="المادة" v={f.subject} />
          <Field k="الصف" v={GRADE_NAMES[f.grade]} />
          <Field k="الفترة" v={noticeTitle(f.report_key)} />
        </div>
        {!print && step >= 0 && (
          <ol className="mt-4 grid grid-cols-5 gap-1 text-center text-[10.5px]">
            {["إنشاء آلي", "إرسال الموجه", "رد المعلم", "مراجعة الموجه", "اعتماد الوكيل"].map((t, i) => (
              <li key={t} className={`rounded-sm2 px-1 py-1.5 ${i <= step ? "bg-mint-deep text-white" : "bg-canvas text-faint"}`}>{t}</li>
            ))}
          </ol>
        )}
        {f.status === "excluded" && <p className="mt-3 rounded-sm2 bg-absent/10 px-3 py-2 text-[12px] text-absent">مستبعد: {f.exclude_reason}</p>}
        {f.counselor_note && <p className="mt-3 rounded-sm2 bg-canvas px-3 py-2 text-[12px] text-ink"><b>ملاحظة الموجه ({f.sent_by_name}):</b> {f.counselor_note}</p>}

        {f.classes.map((c) => (
          <div key={c.class_id} className="mt-4 rounded-card border border-line" style={{ breakInside: "avoid" }}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-canvas/60 px-3 py-2 text-[12px]">
              <b className="text-[13px] text-ink">فصل {c.class_no}</b>
              <span>متوسط الاختبارات <b className="num">{c.stats.avg}%</b></span>
              <span>متوسط الصف في المادة <b className="num">{c.stats.gradeAvg ?? "—"}%</b></span>
              <span>دون 60% <b className="num">{c.stats.weakPct}%</b></span>
              <span>ممتاز <b className="num">{c.stats.exPct}%</b></span>
              <span className="text-muted">{c.stats.n} طالبًا</span>
            </div>
            <ul className="divide-y divide-line">
              {c.checks.map((k, i) => (
                <li key={i} className="px-3 py-2 text-[12px]">
                  <span className="font-semibold" style={{ color: SEV[k.sev].c }}>{k.sev === "critical" ? "●" : k.sev === "warning" ? "▲" : "◆"} {k.title}</span>
                  <span className="text-muted"> — {k.detail}</span>
                </li>
              ))}
            </ul>
            {c.students.length > 0 && (
              <div className="border-t border-line px-3 py-2">
                <p className="mb-1 text-[11.5px] font-semibold text-muted">الطلاب دون 60% في الاختبارات ({c.students.length})</p>
                <p className="text-[11.5px] leading-relaxed text-ink">
                  {c.students.map((s) => <span key={s.sid} className="me-3 inline-block">{s.name} <span className="num text-muted">({s.pct}%)</span></span>)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function Field({ k, v }) {
  return <p><span className="text-muted">{k}: </span><b className="text-ink">{v ?? "—"}</b></p>;
}

/* رد المعلم للعرض */
function Reply({ f, print }) {
  const picks = f.reasons?.picks ?? [];
  return (
    <section className={print ? "mt-4" : "card p-4"} style={{ breakInside: "avoid" }}>
      <h2 className="text-sm font-bold text-ink">رد المعلم <span className="num text-[11px] font-normal text-muted">· {fmtDateTime(f.replied_at)}</span></h2>
      <p className="mt-2 text-[12.5px] font-semibold text-ink">أسباب الضعف</p>
      <ul className="mt-1 list-inside list-disc text-[12.5px] text-ink">
        {picks.map((p) => <li key={p}>{p}</li>)}
        {f.reasons?.other && <li>{f.reasons.other}</li>}
      </ul>
      {f.classes.map((c) => {
        const p = f.plans?.[c.class_id];
        if (!p) return null;
        return (
          <div key={c.class_id} className="mt-3 rounded-sm2 bg-canvas px-3 py-2 text-[12.5px]">
            <p className="font-bold text-mint-deep">الخطة العلاجية · فصل {c.class_no}</p>
            <p className="mt-1 whitespace-pre-line text-ink">{p.actions}</p>
            <p className="mt-1 text-[11.5px] text-muted">
              {p.from && <>المدة: <span className="num">{fmtDate(p.from)}</span> – <span className="num">{fmtDate(p.to)}</span> · </>}
              {p.followup && <>المتابعة: {p.followup} · </>}
              الطلاب المستهدفون: <span className="num">{(p.students ?? []).length}</span>
            </p>
          </div>
        );
      })}
      {(f.review_note || f.forwarded_at) && (
        <p className="mt-3 text-[12px] text-muted">مراجعة الموجه: {f.forwarded_by_name ?? ""} {f.forwarded_at && <span className="num">{fmtDateTime(f.forwarded_at)}</span>}
          {f.review_note && <> · «{f.review_note}»</>}{f.guardians_notified != null && <> · وصلت الخطة {f.guardians_notified} من أولياء الأمور</>}</p>
      )}
      {f.decided_at && (
        <p className="mt-1 text-[12px] text-muted">قرار الوكيل: <b className="text-ink">{f.status === "approved" ? "معتمد" : "أُعيد"}</b> · {f.decided_by_name} <span className="num">{fmtDateTime(f.decided_at)}</span>
          {f.deputy_note && <> · «{f.deputy_note}»</>}</p>
      )}
      {print && (
        <div className="mt-8 grid grid-cols-3 gap-6 text-center text-[11.5px]">
          {[["المعلم", f.teacher_name], ["الموجه الطلابي", f.forwarded_by_name ?? f.sent_by_name], ["وكيل الشؤون التعليمية", f.decided_by_name]].map(([r, n]) => (
            <div key={r}><p className="font-bold text-mint-deep">{r}</p><p className="mt-1">{n || "...................."}</p><p className="mt-4 text-faint">التوقيع: ..............</p></div>
          ))}
        </div>
      )}
    </section>
  );
}

/* قائمة النماذج (/ach-forms): للمعلم نماذجه، ولغيره ما يراه */
export function AchFormsList() {
  const { profile } = useSession();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.from("ach_forms").select("id, report_key, grade, subject, teacher_name, teacher_user, status, due_on, classes, updated_at")
      .order("updated_at", { ascending: false })
      .then(({ data, error }) => { if (error) setErr(isSetupErr(error) ? setupMsg : error.message); setRows(data ?? []); });
  }, []);
  const mine = useMemo(() => (rows ?? []).filter((r) => r.teacher_user === profile?.id), [rows, profile]);
  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">نماذج ملاحظة التحصيل</h1>
        <p className="mt-1 text-sm text-muted">نماذج يرسلها الموجه الطلابي من مركز تحليل النتائج حين يرصد ضعفًا واضحًا في نتائج فصولك، لتكتب أسبابه والخطة العلاجية.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {mine.length === 0 && !err && <p className="card px-4 py-8 text-center text-sm text-muted">لا نماذج لك.</p>}
      <div className="space-y-2">
        {mine.map((r) => (
          <Link key={r.id} to={`/ach-forms/${r.id}`} className="card flex flex-wrap items-center gap-2 px-4 py-3 hover:border-mint-light">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{r.subject} · {GRADE_NAMES[r.grade]}</span>
              <span className="block text-[11.5px] text-muted">{noticeTitle(r.report_key)} · الفصول {r.classes.map((c) => c.class_no).join("، ")}
                {["sent", "returned"].includes(r.status) && <> · المهلة <span className="num">{fmtDate(r.due_on)}</span></>}</span>
            </span>
            <StatusChip f={r} />
          </Link>
        ))}
      </div>
    </div>
  );
}
