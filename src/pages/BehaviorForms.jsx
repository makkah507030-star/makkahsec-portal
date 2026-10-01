// src/pages/BehaviorForms.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { todayISO } from "../lib/schoolTime";
import { fmtGreg } from "../lib/dates";
import { useNotice } from "../lib/useNotice.js";
import { notifyUsers } from "../lib/referrals";
import { degreeName, typeLabel } from "../lib/behavior";
import Loader from "../components/Loader.jsx";
import ViolationPicker from "../components/ViolationPicker.jsx";
import StudentPicker, { studentClassLabel } from "../components/StudentPicker.jsx";
import BehaviorSheet, { FORM_KINDS, EVIDENCE, MEET_WITH, weekday } from "../components/BehaviorSheet.jsx";
import { ReferralPrintArea } from "../components/ReferralSheet.jsx";

/* =====================================================================
   نماذج السلوك والمواظبة — على صيغ دليل السلوك والمواظبة 1447هـ:
   • تعهد سلوكي: يُرسل للطالب فيتعهد، ولولي أمره فيقرّ بالاطّلاع.
   • خطاب دعوة ولي الأمر: يرد ولي الأمر بالحضور أو بطلب تغيير الموعد.
   • سري: محضر ضبط واقعة: داخلي للإدارة، يُطبع للتوقيع.
   وإحالة الطالب للموجه الطلابي في صفحة «إحالة الطالب».
   ===================================================================== */

export const BEHAVIOR_STAFF = ["principal", "tech_support", "deputy_students", "counselor_1", "counselor_2", "counselor_3"];

const STATUS = {
  sent:     { t: "بانتظار الرد", c: "bg-warning/10 text-warning" },
  answered: { t: "وصل الرد",     c: "bg-present/10 text-present" },
  closed:   { t: "مُنتهٍ",        c: "bg-canvas text-muted" },
};

const PURPOSES = [
  "مناقشة مشكلة سلوكية بدرت من الطالب",
  "الاتفاق على خطة لتعديل سلوك الطالب",
  "مناقشة غياب الطالب ومواظبته",
  "مناقشة المستوى الدراسي للطالب",
];

const signedUrl = async (path) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("form-assets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
};

export async function loadStamp() {
  const { data } = await supabase.from("school_assets").select("path").eq("key", "stamp").maybeSingle();
  return signedUrl(data?.path);
}

export default function BehaviorForms() {
  const { session, profile, adminRoles } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];
  const allowed = roles.some((r) => BEHAVIOR_STAFF.includes(r));
  const [params, setParams] = useSearchParams();
  const kind = FORM_KINDS[params.get("kind")] ? params.get("kind") : null;
  const tab = params.get("tab") === "log" ? "log" : "new";
  const [msg, setMsg] = useNotice(null);
  const [rows, setRows] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("behavior_forms").select("*")
      .order("created_at", { ascending: false }).limit(300);
    setRows(error ? [] : data ?? []);
    if (error && /behavior_forms/.test(error.message))
      setMsg({ ok: false, text: "نفّذ ملف supabase/behavior_forms.sql أولًا من Supabase ← SQL Editor." });
  };
  useEffect(() => { if (allowed) load(); }, [allowed]);

  if (!allowed) return (
    <div className="card px-6 py-10 text-center text-sm text-muted">
      هذه الصفحة لوكيل شؤون الطلاب والموجهين الطلابيين والمدير.
    </div>
  );

  const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">نماذج السلوك والمواظبة</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          على صيغ دليل السلوك والمواظبة (الإجراءات الخاصة) 1447هـ — تُرسل للطالب وولي أمره عبر البوابة،
          وتُطبع بالختم وتوقيع المدير.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "new")} onClick={() => setParams({})}>نموذج جديد</button>
        <button className={pill(tab === "log")} onClick={() => setParams({ tab: "log" })}>
          السجل {rows?.length ? <span className="num">({rows.length})</span> : null}
        </button>
        <Link to="/referrals?tab=behavior" className={pill(false)}>إحالة للموجه الطلابي ←</Link>
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
      )}

      {tab === "new" && !kind && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(FORM_KINDS).map(([k, x]) => (
            <button key={k} onClick={() => setParams({ kind: k })}
                    className="card p-4 text-right transition-colors hover:border-mint-deep/40 hover:bg-mint-tint/30">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-bold text-ink">{x.title}</p>
                {x.secret && <span className="chip bg-absent/10 text-absent">سري</span>}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{x.hint}</p>
              <p className="mt-2 text-[11px] text-faint">نموذج ({x.n}) في الدليل</p>
            </button>
          ))}
        </div>
      )}

      {tab === "new" && kind && (
        <NewForm kind={kind} uid={uid} profile={profile} roles={roles}
                 onBack={() => setParams({})}
                 onDone={(t, row) => { setMsg(t); if (t.ok) { load(); setParams({ tab: "log" }); setViewing(row); } }} />
      )}

      {tab === "log" && <Log rows={rows} onOpen={setViewing} />}

      {viewing && <SheetModal f={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/* ------------------------------ نموذج جديد ------------------------------ */
function NewForm({ kind, uid, profile, roles, onBack, onDone }) {
  const k = FORM_KINDS[kind];
  const [student, setStudent] = useState(null);
  const [violation, setViolation] = useState(null);
  const [linkViolation, setLinkViolation] = useState(kind !== "invite");
  const [vDate, setVDate] = useState(todayISO());
  // الدعوة
  const [meetDate, setMeetDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [meetWith, setMeetWith] = useState(MEET_WITH[0]);
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  // المحضر
  const [evidence, setEvidence] = useState([]);
  const [evOther, setEvOther] = useState("");
  const [place, setPlace] = useState("");
  const [desc, setDesc] = useState("");
  const [witnesses, setWitnesses] = useState([{ name: profile?.full_name ?? "", job: ADMIN_ROLE_LABEL[roles[0]] ?? "", task: "" }]);
  const [busy, setBusy] = useState(false);

  const needViolation = kind !== "invite" || linkViolation;
  const ready = student && (!needViolation || violation) && (kind !== "invite" || (meetDate && purpose.trim()))
    && (kind !== "incident" || place.trim());

  const data = kind === "invite" ? { date: meetDate, time: time.trim(), meet_with: meetWith, purpose: purpose.trim() }
    : kind === "incident" ? { evidence, evidence_other: evOther.trim(), place: place.trim(), time: time.trim(),
                              description: desc.trim(), witnesses: witnesses.filter((w) => w.name.trim()) }
    : {};

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    const { data: sig } = await supabase.from("user_signatures").select("path").eq("user_id", uid).maybeSingle();
    const row = {
      kind, student_id: student.student_id, student_name: student.full_name,
      class_label: studentClassLabel(student), grade: student.grade ?? null,
      violation_degree: needViolation ? violation.degree : null,
      violation_type: needViolation ? violation.type : null,
      violation_text: needViolation ? violation.text : null,
      violation_date: needViolation && kind !== "invite" ? vDate : null,
      data, issued_by: uid, issued_name: profile?.full_name ?? "",
      issued_role: roles.map((r) => ADMIN_ROLE_LABEL[r]).filter(Boolean)[0] ?? "",
      issued_sig: sig?.path ?? null,
      status: kind === "incident" ? "closed" : "sent",
    };
    const { data: saved, error } = await supabase.from("behavior_forms").insert(row).select().single();
    if (!error && kind !== "incident") {
      // الطالب يُشعر بالتعهد فقط، وولي الأمر بالتعهد والدعوة
      const ids = new Set();
      if (kind === "pledge") {
        const { data: s } = await supabase.from("students").select("user_id").eq("id", student.student_id).maybeSingle();
        if (s?.user_id) ids.add(s.user_id);
      }
      const { data: gs } = await supabase.from("guardian_student").select("guardians(user_id)").eq("student_id", student.student_id);
      (gs ?? []).forEach((g) => g.guardians?.user_id && ids.add(g.guardians.user_id));
      await notifyUsers([...ids], k.title,
        kind === "pledge"
          ? `صدر تعهد سلوكي بشأن ${student.full_name} (${saved.serial}). افتحه للاطّلاع والإقرار.`
          : `دعوة لولي أمر الطالب ${student.full_name} لزيارة المدرسة (${saved.serial}). افتحها للاطّلاع والرد.`,
        `/behavior/${saved.id}`);
    }
    setBusy(false);
    onDone(error
      ? { ok: false, text: /behavior_forms/.test(error.message)
          ? "نفّذ ملف supabase/behavior_forms.sql أولًا من Supabase ← SQL Editor." : error.message }
      : { ok: true, text: kind === "incident" ? `حُفظ ${k.title} برقم ${saved.serial}. اطبعه للتوقيع.`
                                              : `صدر ${k.title} برقم ${saved.serial} وأُشعر ${kind === "pledge" ? "الطالب وولي أمره" : "ولي الأمر"}.` },
      saved);
  };

  const preview = student && ready ? {
    kind, serial: "", student_name: student.full_name, class_label: studentClassLabel(student),
    violation_degree: violation?.degree, violation_text: needViolation ? violation?.text : null, violation_date: vDate,
    data, issued_name: profile?.full_name, created_at: null,
  } : null;

  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">{k.title} {k.secret && <span className="chip mr-1 bg-absent/10 text-absent">سري</span>}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{k.hint}</p>
        </div>
        <button onClick={onBack} className="shrink-0 text-xs font-semibold text-mint-deep">→ النماذج</button>
      </div>

      <div>
        <label className="text-xs text-muted">الطالب</label>
        <div className="mt-1"><StudentPicker value={student} onChange={setStudent} /></div>
      </div>

      {kind === "invite" && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted">يوم الحضور</label>
              <input type="date" className="field mt-1 w-full" value={meetDate} onChange={(e) => setMeetDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted">الساعة (اختياري)</label>
              <input className="field mt-1 w-full" value={time} placeholder="مثال: 9:00 صباحًا" onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted">لمقابلة</label>
              <select className="field mt-1 w-full" value={meetWith} onChange={(e) => setMeetWith(e.target.value)}>
                {MEET_WITH.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">الهدف من الدعوة</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PURPOSES.map((t) => (
                <button key={t} type="button" onClick={() => setPurpose(t)}
                  className={`rounded-pill px-3 py-1 text-[11.5px] font-medium ${purpose === t
                    ? "bg-mint-deep text-white" : "border border-[#CCF2DB] bg-mint-tint text-mint-deep hover:bg-[#CCF2DB]"}`}>{t}</button>
              ))}
            </div>
            <textarea rows={2} className="field mt-1.5 w-full" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={linkViolation} onChange={(e) => setLinkViolation(e.target.checked)} />
            ربط الدعوة بمخالفة سلوكية (تُذكر في الخطاب)
          </label>
        </>
      )}

      {needViolation && (
        <div>
          <label className="text-xs text-muted">المخالفة السلوكية</label>
          <div className="mt-1.5"><ViolationPicker value={violation} onChange={setViolation} /></div>
          {violation && (
            <p className="mt-1.5 text-[11px] text-faint">الدرجة {degreeName(violation.degree)} · {typeLabel(violation.type)}</p>
          )}
        </div>
      )}

      {kind !== "invite" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">تاريخ المخالفة</label>
            <input type="date" className="field mt-1 w-full" value={vDate} onChange={(e) => setVDate(e.target.value)} />
          </div>
          {kind === "incident" && (
            <div>
              <label className="text-xs text-muted">وقت الضبط (اختياري)</label>
              <input className="field mt-1 w-full" value={time} placeholder="مثال: الفسحة — 10:15" onChange={(e) => setTime(e.target.value)} />
            </div>
          )}
        </div>
      )}

      {kind === "incident" && (
        <>
          <div>
            <label className="text-xs text-muted">نوع المشاهدة المضبوطة</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EVIDENCE.map((e) => {
                const on = evidence.includes(e);
                return (
                  <button key={e} type="button"
                    onClick={() => setEvidence((x) => (on ? x.filter((y) => y !== e) : [...x, e]))}
                    className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ${on
                      ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                    {on ? "✓ " : ""}{e}
                  </button>
                );
              })}
            </div>
            {evidence.includes("أخرى") && (
              <input className="field mt-1.5 w-full" value={evOther} placeholder="حدّد نوع المشاهدة" onChange={(e) => setEvOther(e.target.value)} />
            )}
          </div>
          <div>
            <label className="text-xs text-muted">مكان ضبط الواقعة</label>
            <input className="field mt-1 w-full" value={place} placeholder="مثال: ساحة المدرسة، دورات المياه، الفصل 203"
                   onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">وصف الواقعة (اختياري)</label>
            <textarea rows={3} className="field mt-1 w-full" value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">شهود الواقعة</label>
            <div className="mt-1.5 space-y-1.5">
              {witnesses.map((w, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
                  {["name", "job", "task"].map((f) => (
                    <input key={f} className="field min-w-0" value={w[f]}
                           placeholder={{ name: "الاسم", job: "الوظيفة", task: "العمل المسند إليه" }[f]}
                           onChange={(e) => setWitnesses((x) => x.map((y, j) => (j === i ? { ...y, [f]: e.target.value } : y)))} />
                  ))}
                  <button type="button" onClick={() => setWitnesses((x) => x.filter((_, j) => j !== i))}
                          className="px-2 text-sm text-absent" aria-label="حذف">✕</button>
                </div>
              ))}
              {witnesses.length < 7 && (
                <button type="button" onClick={() => setWitnesses((x) => [...x, { name: "", job: "", task: "" }])}
                        className="text-xs font-semibold text-mint-deep">+ إضافة شاهد</button>
              )}
            </div>
          </div>
        </>
      )}

      {preview && <MiniPreview f={preview} />}

      <button className="btn-primary w-full" disabled={!ready || busy} onClick={submit}>
        {busy ? "جارٍ الحفظ…" : kind === "incident" ? "حفظ المحضر" : `إصدار ${k.title} وإرساله`}
      </button>
    </section>
  );
}

/* معاينة مصغّرة للورقة كما ستُطبع */
function MiniPreview({ f }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.4);
  useLayoutEffect(() => {
    const fit = () => { const w = box.current?.clientWidth ?? 0; if (w) setScale(Math.min(0.75, (w - 2) / 794)); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="overflow-hidden rounded-sm2 border border-line bg-white">
      <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: 794, height: 1123 * scale }}>
        <BehaviorSheet f={f} />
      </div>
    </div>
  );
}

/* --------------------------------- السجل --------------------------------- */
function Log({ rows, onOpen }) {
  const [kind, setKind] = useState("");
  const list = useMemo(() => (rows ?? []).filter((r) => !kind || r.kind === kind), [rows, kind]);
  if (!rows) return <Loader compact />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {[["", "الكل"], ...Object.entries(FORM_KINDS).map(([k, x]) => [k, x.short])].map(([k, t]) => (
          <button key={k} onClick={() => setKind(k)}
            className={`rounded-pill px-3 py-1 text-xs font-medium ${kind === k
              ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {t} <span className="num opacity-75">({(rows ?? []).filter((r) => !k || r.kind === k).length})</span>
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="card px-4 py-6 text-sm text-muted">لا نماذج بعد.</p>}
      {list.map((r) => {
        const st = STATUS[r.status] ?? { t: r.status, c: "" };
        const reply = r.kind === "invite" && r.guardian_reply?.choice;
        return (
          <div key={r.id} className="card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{FORM_KINDS[r.kind]?.short} — {r.student_name}</p>
                <p className="num mt-0.5 text-xs text-faint">
                  {r.serial} · {r.class_label}
                  {r.violation_degree ? ` · الدرجة ${degreeName(r.violation_degree)}` : ""}
                  {" · "}{r.issued_name}
                </p>
              </div>
              {r.kind !== "incident" && <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>}
              <button onClick={() => onOpen(r)}
                      className="shrink-0 rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">الملف</button>
            </div>
            {r.kind === "pledge" && (
              <p className="mt-1.5 text-xs text-muted">
                الطالب: {r.student_ack_at ? "تعهّد ✓" : "لم يتعهد بعد"} · ولي الأمر: {r.guardian_ack_at ? "أقرّ ✓" : "لم يطّلع بعد"}
              </p>
            )}
            {reply && (
              <p className="mt-1.5 text-xs font-medium text-present">
                رد ولي الأمر: {r.guardian_reply.choice === "attend" ? "سيحضر في الموعد المحدد"
                  : `يطلب تغيير الموعد${r.guardian_reply.date ? ` إلى يوم ${weekday(r.guardian_reply.date)} ${fmtGreg(r.guardian_reply.date)}` : ""}`}
              </p>
            )}
            {r.guardian_note && <p className="mt-1 text-xs text-muted">ملاحظة ولي الأمر: {r.guardian_note}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ عرض الملف ------------------------------ */
export function SheetModal({ f, onClose }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [stamp, setStamp] = useState(null);
  useEffect(() => { loadStamp().then(setStamp); }, []);
  useLayoutEffect(() => {
    const fit = () => { const w = box.current?.clientWidth ?? 0; if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794))); };
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-3 flex justify-between gap-2">
          <button onClick={onClose} className="rounded-pill bg-white px-4 py-1.5 text-sm font-medium text-muted">إغلاق</button>
          <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
        </div>
        <div ref={box} className="no-print overflow-hidden rounded-card bg-white">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: 794, height: 1123 * scale }}>
            <BehaviorSheet f={f} stampUrl={stamp} />
          </div>
        </div>
        <div className="hidden print:block">
          <ReferralPrintArea><BehaviorSheet f={f} stampUrl={stamp} /></ReferralPrintArea>
        </div>
      </div>
    </div>
  );
}
