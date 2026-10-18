// src/pages/StudentDropouts.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { GRADE_NAMES } from "../lib/schoolTime";
import { fmtDate, fmtDateTime } from "../lib/dates";
import { countAr } from "../lib/arabicCount.js";
import { byName } from "../lib/sortAr.js";
import { useNotice } from "../lib/useNotice.js";
import { confirmDanger } from "../lib/danger";
import { refreshNavBadges } from "../lib/navBadges.js";
import Loader from "../components/Loader.jsx";
import PrintPortal from "../components/PrintPortal.jsx";
import { printThen } from "../lib/print.js";
import moeLogo from "../assets/moe-logo.png";
import logoIcon from "../assets/icon-mint.png";
import { signatureByName, useSignatureByName } from "../lib/userSignatures.js";
import { STUDENT_DEPUTY_NAME } from "../lib/signers.js";

/* =====================================================================
   الطلاب المنقطعون (supabase/student_dropouts_1.sql و _2.sql):
   • المعلم يبلّغ عن طالب من فصوله المسندة ببطاقة جاهزة للسبب وملاحظة.
   • وكيل شؤون الطلاب (ومعه المدير والدعم الفني) يستكمل الإجراء: طي القيد
     وإلغاء التفعيل من السجلات، أو رد البلاغ إن كان الطالب منتظمًا.
   • المطوي قيده يظهر في «الطلاب المنقطعون» ويمكن إعادته إن عاد للدراسة.
   ===================================================================== */

const MANAGERS = ["principal", "deputy_students", "tech_support"];

// البطاقات الجاهزة: تختار السبب وتملأ الملاحظة بصيغة قابلة للتعديل
const REASONS = {
  absent5: { label: "منقطع أكثر من 5 أيام متصلة", icon: "⏳",
    text: "انقطع الطالب عن الدراسة أكثر من خمسة أيام متصلة دون عذر، ويُحال لوكيل شؤون الطلاب لاستكمال الإجراء." },
  travel: { label: "سافر للخارج", icon: "✈️",
    text: "سافر الطالب خارج المملكة وانقطع عن الدراسة، ويُحال لوكيل شؤون الطلاب لطي قيده وإلغاء تفعيله من السجلات." },
  transfer: { label: "انتقل لمدرسة أخرى", icon: "🏫",
    text: "أفاد الطالب أو ولي أمره بانتقاله لمدرسة أخرى ولم يعد يحضر، ويُحال لوكيل شؤون الطلاب لاستكمال الإجراء." },
  other: { label: "سبب آخر", icon: "📝", text: "" },
};

// عبارة رد البلاغ الموحّدة: بطاقة جاهزة للوكيل حين يرد البلاغ لتوحيد الإجراء
const DISMISS_TEXT = "الطالب منتظم ولديه غيابات جاري دراسة حالته";

const STATUS = {
  reported:  { label: "بانتظار إجراء الوكيل", tone: "bg-warning-light text-warning" },
  withdrawn: { label: "مطوي القيد", tone: "bg-absent/10 text-absent" },
  dismissed: { label: "رُدّ البلاغ — منتظم", tone: "bg-canvas text-muted" },
  returned:  { label: "عاد للدراسة", tone: "bg-present/10 text-present" },
};

const classLabel = (r) => `${GRADE_NAMES[r.grade] ?? ""} · فصل ${r.class_no ?? ""}`;

export default function StudentDropouts() {
  const { adminRoles, effectiveRole } = useSession();
  const isManager = effectiveRole === "admin" && (adminRoles ?? []).some((r) => MANAGERS.includes(r));
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("student_dropouts")
      .select("*").order("reported_at", { ascending: false }).limit(500);
    if (error) { setMissing(true); setList([]); return; }
    setList(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const by = (s) => (list ?? []).filter((r) => r.status === s);
  const tabs = isManager
    ? [
        { key: "new", label: "بلاغات جديدة", n: by("reported").length },
        { key: "out", label: "الطلاب المنقطعون", n: by("withdrawn").length },
        { key: "report", label: "إبلاغ عن طالب" },
        { key: "log", label: "السجل" },
      ]
    : [
        { key: "report", label: "إبلاغ عن طالب" },
        { key: "mine", label: "بلاغاتي", n: (list ?? []).length },
      ];
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : tabs[0].key;
  const after = () => { load(); refreshNavBadges(true); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">{isManager ? "الطلاب المنقطعون" : "الإبلاغ عن طالب منقطع"}</h1>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">
          {isManager
            ? "بلاغات المعلمين عن الطلاب المنقطعين: اطوِ قيد الطالب وألغِ تفعيله من السجلات، أو رُدّ البلاغ إن كان منتظمًا. ويمكن إعادة المطوي قيده إن عاد للدراسة."
            : "اختر الطالب من فصولك وبطاقة السبب، وأضف ملاحظتك؛ يصل البلاغ لوكيل شؤون الطلاب ليستكمل الإجراء."}
        </p>
      </div>

      {missing && (
        <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">
          نفّذ الملفين supabase/student_dropouts_1.sql ثم _2.sql في قاعدة البيانات مرة واحدة لتفعيل الصفحة.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setParams({ tab: t.key })}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
            {t.label}{t.n > 0 && <span className="num mr-1.5 opacity-80">({t.n})</span>}
          </button>
        ))}
      </div>

      {tab === "report" && <ReportForm isManager={isManager} onDone={() => { after(); setParams({ tab: isManager ? "new" : "mine" }); }} />}
      {tab !== "report" && list === null && <Loader />}
      {tab === "new" && list && <Cards rows={by("reported")} manage onChange={after}
        empty="لا بلاغات جديدة." />}
      {tab === "out" && list && <Cards rows={by("withdrawn")} manage onChange={after} search
        empty="لا يوجد طلاب مطوية قيودهم." />}
      {tab === "log" && list && <Cards rows={(list ?? []).filter((r) => ["dismissed", "returned"].includes(r.status))}
        search empty="لا شيء في السجل بعد." />}
      {tab === "mine" && list && <Cards rows={list} empty="لم تبلّغ عن أي طالب بعد." />}
    </div>
  );
}

/* ---------------- نموذج البلاغ: الفصل ← الطالب ← بطاقة السبب والملاحظة ---------------- */

function ReportForm({ isManager, onDone }) {
  const { session } = useSession();
  const [classes, setClasses] = useState(null);
  const [cls, setCls] = useState(null);
  const [students, setStudents] = useState(null);
  const [student, setStudent] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      let list = [];
      if (isManager) {
        const { data } = await supabase.from("classes").select("id, class_no, grade").eq("academic_year", m.active_year ?? "");
        list = (data ?? []).map((c) => ({ class_id: c.id, class_no: c.class_no, grade: c.grade }));
      } else {
        const { data: t } = await supabase.from("teachers").select("id").eq("user_id", session?.user?.id).maybeSingle();
        if (t) {
          const { data: sch } = await supabase.from("schedule").select("class_id, classes(class_no, grade)")
            .eq("teacher_id", t.id).eq("academic_year", m.active_year ?? "").eq("term", Number(m.active_term ?? 1));
          const map = new Map();
          (sch ?? []).forEach((r) => map.set(r.class_id, { class_id: r.class_id, class_no: r.classes?.class_no ?? 0, grade: r.classes?.grade ?? 0 }));
          list = [...map.values()];
        }
      }
      setClasses(list.sort((a, b) => a.grade - b.grade || a.class_no - b.class_no));
    })();
  }, [isManager, session]);

  const pickClass = async (c) => {
    setCls(c); setStudent(null); setStudents(null);
    const { data, error } = await supabase.rpc("dropout_class_students", { p_class: c.class_id });
    if (error) { setMsg({ ok: false, text: error.message }); setStudents([]); return; }
    // الأطول غيابًا أولًا، ثم أبجديًا
    setStudents((data ?? []).sort((a, b) => (b.absent_days ?? 0) - (a.absent_days ?? 0) || byName()(a, b)));
  };

  const pickReason = (k) => { setReason(k); setNote(REASONS[k].text); };

  const submit = async () => {
    if (!student || !reason) return;
    if (reason === "other" && !note.trim()) { setMsg({ ok: false, text: "اكتب سبب الانقطاع في الملاحظة." }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("dropout_report", { p_student: student.student_id, p_reason: reason, p_note: note });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `أُرسل البلاغ عن ${student.full_name} لوكيل شؤون الطلاب.` });
    setStudent(null); setReason(""); setNote("");
    onDone?.();
  };

  if (classes === null) return <Loader />;
  if (!classes.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا توجد فصول مسندة</p>
        <p className="mt-1.5 text-sm text-muted">لم تُسند إليك حصص في الفصل الدراسي الحالي.</p>
      </div>
    );
  }

  return (
    <section className="card space-y-4 p-4">
      <div>
        <label className="text-xs text-muted">الفصل</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {classes.map((c) => (
            <button key={c.class_id} type="button" onClick={() => pickClass(c)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                cls?.class_id === c.class_id ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {GRADE_NAMES[c.grade] ?? ""} · فصل <span className="num">{c.class_no}</span>
            </button>
          ))}
        </div>
      </div>

      {cls && (
        <div>
          <label className="text-xs text-muted">الطالب <span className="text-faint">— بجانب كل طالب أيام غيابه الرسمي المتصلة حتى آخر يوم معتمد</span></label>
          {students === null ? <Loader /> : student ? (
            <div className="mt-1.5 flex items-center justify-between gap-2 rounded-sm2 border border-mint-light bg-mint-tint px-3 py-2">
              <p className="text-sm font-semibold text-ink">{student.full_name}
                <span className="mr-2 text-xs font-normal text-muted">{classLabel(cls)}</span>
                <Streak n={student.absent_days} /></p>
              <button type="button" onClick={() => setStudent(null)} className="text-xs font-semibold text-mint-deep">تغيير</button>
            </div>
          ) : (
            <div className="mt-1.5 max-h-72 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
              {students.length === 0 && <p className="px-3 py-3 text-xs text-muted">لا طلاب نشطون في هذا الفصل.</p>}
              {students.map((s) => (
                <button key={s.student_id} type="button" disabled={!!s.open_status}
                  onClick={() => { setStudent(s); if (!reason && s.absent_days >= 5) pickReason("absent5"); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right hover:bg-canvas disabled:opacity-50">
                  <span className="text-sm text-ink">{s.full_name}</span>
                  {s.open_status
                    ? <span className={`chip ${STATUS[s.open_status].tone}`}>{s.open_status === "reported" ? "سبق الإبلاغ عنه" : "مطوي القيد"}</span>
                    : <Streak n={s.absent_days} />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {student && (
        <>
          <div>
            <label className="text-xs text-muted">سبب الانقطاع — اختر البطاقة المناسبة</label>
            <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
              {Object.entries(REASONS).map(([k, r]) => (
                <button key={k} type="button" onClick={() => pickReason(k)}
                  className={`rounded-card border p-3 text-right transition-colors ${
                    reason === k ? "border-mint-deep bg-mint-tint" : "border-line bg-paper hover:bg-canvas"}`}>
                  <p className={`text-sm font-bold ${reason === k ? "text-mint-deep" : "text-ink"}`}>
                    <span className="ml-1.5">{r.icon}</span>{r.label}
                  </p>
                  {r.text && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{r.text}</p>}
                </button>
              ))}
            </div>
            {reason === "absent5" && (student.absent_days ?? 0) < 5 && (
              <p className="mt-1.5 text-[11.5px] text-warning">
                الغياب الرسمي المعتمد المتصل للطالب {countAr(student.absent_days ?? 0, "day")} — تأكد قبل الإرسال، أو وضّح في الملاحظة.
              </p>
            )}
          </div>

          {reason && (
            <div>
              <label className="text-xs text-muted">ملاحظة المعلم عن سبب الانقطاع</label>
              <textarea className="field mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="مثال: تواصلت مع ولي الأمر وأفاد بسفر الأسرة…" />
            </div>
          )}

          <button className="btn-primary" onClick={submit} disabled={!reason || busy}>
            {busy ? "جارٍ الإرسال…" : "إرسال البلاغ لوكيل شؤون الطلاب"}
          </button>
        </>
      )}
      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
      )}
    </section>
  );
}

function Streak({ n }) {
  const v = Number(n) || 0;
  if (!v) return <span className="text-[11px] text-faint">—</span>;
  return (
    <span className={`chip mr-2 ${v >= 5 ? "bg-absent/10 text-absent" : "bg-warning-light text-warning"}`}>
      غياب متصل {countAr(v, "day")}
    </span>
  );
}

/* ---------------- بطاقات البلاغات وإجراءات الوكيل ---------------- */

function Cards({ rows, manage = false, search = false, empty, onChange }) {
  const [q, setQ] = useState("");
  const [printing, setPrinting] = useState(null);
  const shown = useMemo(() => {
    const t = q.trim();
    return t ? rows.filter((r) => (r.student_name ?? "").includes(t) || (r.national_id ?? "").includes(t)) : rows;
  }, [rows, q]);
  // التوقيعان يُجلبان ويُحمَّلان قبل الطباعة حتى لا تخرج الورقة بلا صورتيهما
  const print = async (r) => {
    const urls = await Promise.all([signatureByName(r.reported_by_name), r.decided_at ? signatureByName(deputyOf(r)) : null]);
    await Promise.all(urls.filter(Boolean).map((u) => new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = u; })));
    setPrinting(r); setTimeout(() => printThen(() => setPrinting(null)), 150);
  };

  return (
    <div className="space-y-3">
      {search && rows.length > 0 && (
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو رقم الهوية" />
      )}
      {shown.length === 0 && <div className="card px-6 py-10 text-center text-sm text-muted">{empty}</div>}
      {shown.map((r) => <Card key={r.id} r={r} manage={manage} onChange={onChange} onPrint={() => print(r)} />)}
      {printing && <DropoutPrint r={printing} />}
    </div>
  );
}

function Card({ r, manage, onChange, onPrint }) {
  const [act, setAct] = useState(null);   // withdraw | dismiss | return
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const reason = REASONS[r.reason] ?? REASONS.other;

  const run = async () => {
    if (act === "withdraw" && !(await confirmDanger({
      title: `طي قيد ${r.student_name}`,
      impact: ["يُلغى تفعيل الطالب وتسجيله في فصله فيختفي من كشوف التحضير والتقارير.",
               "يُوقف حساب الطالب في البوابة.", "يمكن إعادته لاحقًا من «الطلاب المنقطعون»."],
      confirmLabel: "طي القيد",
    }))) return;
    setBusy(true);
    const { error } = act === "return"
      ? await supabase.rpc("dropout_return", { p_id: r.id, p_note: note })
      : await supabase.rpc("dropout_decide", { p_id: r.id, p_action: act, p_note: note });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: act === "withdraw" ? "طُوي قيد الطالب وأُلغي تفعيله." : act === "return" ? "أُعيد الطالب للدراسة وعاد لكشف فصله." : "رُدّ البلاغ." });
    setAct(null); setNote("");
    onChange?.();
  };

  const ACT = {
    withdraw: { label: "طي القيد وإلغاء التفعيل", btn: "btn-primary", ph: "إجراء الوكيل (اختياري): تواصل مع ولي الأمر، رقم خطاب…" },
    dismiss: { label: "رد البلاغ — الطالب منتظم", btn: "btn-ghost", ph: "سبب الرد (اختياري)" },
    return: { label: "إعادة الطالب للدراسة", btn: "btn-primary", ph: "ملاحظة العودة (اختياري): تاريخ العودة، خطاب…" },
  };
  const actions = !manage ? [] : r.status === "reported" ? ["withdraw", "dismiss"] : r.status === "withdrawn" ? ["return"] : [];

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-ink">{r.student_name}</p>
        {r.national_id && <span className="text-xs text-muted" dir="ltr">{r.national_id}</span>}
        <span className="text-xs text-muted">{classLabel(r)}</span>
        <span className={`chip ${STATUS[r.status]?.tone}`}>{STATUS[r.status]?.label}</span>
        <button onClick={onPrint} className="ms-auto text-xs font-semibold text-mint-deep">طباعة البطاقة</button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="chip bg-mint-tint text-mint-deep">{reason.icon} {reason.label}</span>
        {r.absent_days > 0 && <span className="chip bg-absent/10 text-absent">غياب متصل عند البلاغ {countAr(r.absent_days, "day")}</span>}
      </div>
      {r.note && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{r.note}</p>}
      <div className="mt-2 space-y-0.5 text-[11.5px] text-faint">
        <p>المبلّغ: {r.reported_by_name ?? "—"} · {fmtDateTime(r.reported_at)}</p>
        {r.decided_at && <p>{r.status === "dismissed" ? "رُدّ" : "طُوي القيد"}: {r.decided_by_name} · {fmtDateTime(r.decided_at)}{r.decision_note && ` — ${r.decision_note}`}</p>}
        {r.returned_at && <p>عاد للدراسة: {r.returned_by_name} · {fmtDateTime(r.returned_at)}{r.return_note && ` — ${r.return_note}`}</p>}
      </div>

      {actions.length > 0 && (
        <div className="mt-3 border-t border-line pt-3">
          {!act ? (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <button key={a} onClick={() => { setAct(a); setNote(a === "dismiss" ? DISMISS_TEXT : ""); }} className={ACT[a].btn}>{ACT[a].label}</button>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {act === "dismiss" && (
                <button type="button" onClick={() => setNote(DISMISS_TEXT)}
                  className={`chip ${note === DISMISS_TEXT ? "bg-mint-deep text-white" : "bg-mint-tint text-mint-deep"}`}>✅ {DISMISS_TEXT}</button>
              )}
              <textarea className="field" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ACT[act].ph} />
              <div className="flex flex-wrap gap-2">
                <button onClick={run} disabled={busy} className={ACT[act].btn}>{busy ? "جارٍ التنفيذ…" : ACT[act].label}</button>
                <button onClick={() => { setAct(null); setNote(""); }} className="btn-ghost">إلغاء</button>
              </div>
            </div>
          )}
          {msg && !msg.ok && <p className="mt-2 text-xs text-absent">{msg.text}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------------- بطاقة البلاغ المطبوعة لملف الطالب ---------------- */

const GOV = ["المملكة العربية السعودية", "وزارة التعليم", "الإدارة العامة للتعليم بمنطقة مكة المكرمة"];
const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const deputyOf = (r) => r.decided_by_name || STUDENT_DEPUTY_NAME;

function SignBox({ role, name, signed = true }) {
  const url = useSignatureByName(signed ? name : "", null);
  return (
    <div>
      <p className="font-semibold">{role}</p>
      <div className="mx-auto flex h-14 items-end justify-center">
        {url ? <img src={url} alt="" className="max-h-14 w-auto object-contain" /> : null}
      </div>
      <p className="mx-auto mt-1 w-48 border-t border-faint pt-1 font-semibold">{name || "—"}</p>
    </div>
  );
}

function DropoutPrint({ r }) {
  const reason = REASONS[r.reason] ?? REASONS.other;
  const row = (k, v) => (
    <tr>
      <td style={{ border: "1px solid #d8e4dc", padding: "7px 9px", background: "#EEF6F1", fontWeight: 600, width: "28%", ...INK }}>{k}</td>
      <td style={{ border: "1px solid #d8e4dc", padding: "7px 9px", whiteSpace: "pre-line", lineHeight: 1.8 }}>{v || "—"}</td>
    </tr>
  );
  return (
    <PrintPortal id="dropout-print" margin="14mm 14mm">
      <div dir="rtl" className="text-ink" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 13 }}>
        <div className="flex items-start justify-between gap-4">
          <div className="text-[11px] font-medium leading-[1.9]">
            {GOV.map((l) => <div key={l}>{l}</div>)}
            <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
          </div>
          <div className="flex items-center gap-4">
            <img src={moeLogo} alt="" className="h-10 w-auto" />
            <img src={logoIcon} alt="" className="h-10 w-auto" />
          </div>
        </div>
        <div className="mt-2.5 h-px w-full" style={{ background: "#3E6350", ...INK }} />
        <h1 className="mt-5 text-center text-[18px] font-bold text-mint-deep">بطاقة بلاغ عن طالب منقطع</h1>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <tbody>
            {row("اسم الطالب", r.student_name)}
            {row("رقم الهوية", r.national_id)}
            {row("الصف والفصل", classLabel(r))}
            {row("سبب الانقطاع", reason.label)}
            {row("أيام الغياب المتصلة عند البلاغ", r.absent_days ? countAr(r.absent_days, "day") : "")}
            {row("ملاحظة المعلم", r.note)}
            {row("المبلّغ وتاريخ البلاغ", `${r.reported_by_name ?? ""} — ${fmtDate(r.reported_at)}`)}
            {row("حالة البلاغ", STATUS[r.status]?.label)}
            {r.decided_at && row(r.status === "dismissed" ? "رد البلاغ" : "طي القيد وإلغاء التفعيل",
              `${r.decided_by_name ?? ""} — ${fmtDate(r.decided_at)}${r.decision_note ? `\n${r.decision_note}` : ""}`)}
            {r.returned_at && row("العودة للدراسة", `${r.returned_by_name ?? ""} — ${fmtDate(r.returned_at)}${r.return_note ? `\n${r.return_note}` : ""}`)}
          </tbody>
        </table>
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-[12.5px]">
          <SignBox role="المعلم المبلّغ" name={r.reported_by_name} />
          {/* توقيع الوكيل بعد أن يتخذ إجراءه، واسمه من «أسماء الموقّعين» قبل ذلك */}
          <SignBox role="وكيل شؤون الطلاب" name={deputyOf(r)} signed={!!r.decided_at} />
        </div>
        <p className="mt-10 text-center text-[10px] text-faint">صدر من بوابة مكة الثانوية الرقمية · makkahsec.com</p>
      </div>
    </PrintPortal>
  );
}
