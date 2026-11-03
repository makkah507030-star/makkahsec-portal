// الإنذارات والمحاضر: أيام الغياب الرسمي بدون عذر من الأيام المعتمدة
//   10 أيام ← إنذار أول + محضر
//   15 يومًا ← إنذار ثانٍ + محضر
//   20 يومًا ← تحويل لوكيل شؤون الطلاب + محضر تحويل لدراسة الحالة
// ومن بلغ الإنذار الأول يُحوَّل للموجه الطلابي لدراسة حالته بإحالة (absence) ومحضر الوكيل،
// وتُطبع محاضر عدة طلاب محددين دفعة واحدة.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import StudentFileLink from "../../components/StudentFileLink.jsx";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { printReport, escHtml, exportStyledExcel, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { WARNING_STAGES, loadRangeStart, loadActiveTerm, isMissingTable } from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, GradePills, Note, Loading, Empty, SetupNotice, weekdayOf, daysWord,
} from "./shared.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { referToGradeCounselor, classLabelOf } from "../../lib/deputyReferral.js";
import { friendlyError } from "../../lib/friendlyError.js";

const STAGE = Object.fromEntries(WARNING_STAGES.map((s) => [s.key, s]));
const WATCH_AT = 5;

export default function Warnings() {
  const { session, profile } = useSession();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());
  const [term, setTerm] = useState(null);
  const [marks, setMarks] = useState(null);
  const [issued, setIssued] = useState([]);
  const [missing, setMissing] = useState(false);
  const [grade, setGrade] = useState(0);
  const [view, setView] = useState("due");
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useNotice(null, "error");
  const [tick, setTick] = useState(0);
  const [refs, setRefs] = useState({});          // student_id -> إحالة الغياب للموجه في الفترة
  const [sel, setSel] = useState(() => new Set());
  const [batchBusy, setBatchBusy] = useState(false);

  useEffect(() => {
    Promise.all([loadRangeStart(todayISO()), loadActiveTerm()]).then(([d, t]) => {
      setFrom(d ?? todayISO().slice(0, 8) + "01");
      setTerm(t);
    });
  }, []);

  useEffect(() => {
    if (!from || !term) return;
    (async () => {
      setMarks(null);
      try {
        const [m, w] = await Promise.all([
          fetchAllPaged(() =>
            supabase.from("official_day_marks")
              .select("student_id, attend_date, full_name, grade, class_no")
              .eq("status", "absent").gte("attend_date", from).lte("attend_date", to)
              .order("attend_date", { ascending: true }).order("student_id", { ascending: true })),
          supabase.from("absence_warnings").select("*")
            .eq("academic_year", term.year).eq("term", term.term)
            .order("issued_on", { ascending: true }),
        ]);
        if (w.error) throw w.error;
        setMarks(m); setIssued(w.data ?? []);
        // إحالات الغياب للموجه (قبل تشغيل absence_to_counselor.sql تبقى فارغة)
        const { data: rf } = await supabase.from("student_referrals")
          .select("id, student_id, serial, counselor_name, referral_date")
          .eq("kind", "absence").gte("referral_date", from).order("referral_date", { ascending: true });
        setRefs(Object.fromEntries((rf ?? []).map((r) => [r.student_id, r])));
      } catch (e) {
        if (isMissingTable(e)) setMissing(true);
        console.error("Warnings:", e); setMarks([]);
      }
    })();
  }, [from, to, term, tick]);

  const students = useMemo(() => {
    const by = new Map();
    (marks ?? []).forEach((r) => {
      const s = by.get(r.student_id) ?? {
        student_id: r.student_id, full_name: r.full_name, grade: r.grade, class_no: r.class_no, dates: [],
      };
      s.dates.push(r.attend_date);
      by.set(r.student_id, s);
    });
    const issuedBy = new Map();
    issued.forEach((w) => {
      const m = issuedBy.get(w.student_id) ?? {};
      m[w.stage] = w;
      issuedBy.set(w.student_id, m);
    });
    return [...by.values()].map((s) => {
      const days = s.dates.length;
      const done = issuedBy.get(s.student_id) ?? {};
      const due = WARNING_STAGES.filter((st) => days >= st.days && !done[st.key]).map((st) => st.key);
      return { ...s, days, done, due };
    }).sort((a, b) => b.days - a.days || a.full_name.localeCompare(b.full_name, "ar"));
  }, [marks, issued]);

  const list = useMemo(() => students
    .filter((s) => !grade || s.grade === grade)
    .filter((s) => view === "due" ? s.due.length > 0
      : view === "issued" ? Object.keys(s.done).length > 0
      : s.days >= WATCH_AT),
  [students, grade, view]);

  const counts = useMemo(() => ({
    due: students.filter((s) => s.due.length).length,
    warn1: students.filter((s) => s.days >= STAGE.warn1.days).length,
    warn2: students.filter((s) => s.days >= STAGE.warn2.days).length,
    transfer: students.filter((s) => s.days >= STAGE.transfer.days).length,
    watch: students.filter((s) => s.days >= WATCH_AT && s.days < STAGE.warn1.days).length,
  }), [students]);

  const record = async (s, stage, { source = "system", issuedOn = todayISO(), note = null } = {}) => {
    const { error } = await supabase.from("absence_warnings").insert({
      student_id: s.student_id, stage, days_count: s.days,
      academic_year: term.year, term: term.term,
      issued_on: issuedOn, source, note,
      issued_by: session?.user?.id ?? null, issued_by_name: profile?.full_name ?? null,
    });
    if (error) throw error;
  };

  const issueAndPrint = async (s, stage) => {
    setMsg(null);
    try {
      await record(s, stage);
      await printMinutes(s, stage, { from, to, done: s.done, issuedOn: todayISO() });
      setTick((t) => t + 1);
    } catch (e) { setMsg(friendlyError(e)); }
  };

  // التحويل للموجه الطلابي لدراسة الحالة: إحالة لموجه صف الطالب، ومحضر الوكيل يُطبع فورًا
  const toCounselor = async (s) => {
    setMsg(null);
    if (!(await confirmDanger({
      title: `تحويل ${s.full_name} للموجه الطلابي؟`,
      impact: ["تصل إحالة لموجه صف الطالب لدراسة حالته، ويتابعها من «الإحالات»", "يُطبع محضر التحويل بتوقيع وكيل شؤون الطلاب"],
      level: "medium", confirmLabel: "تحويل وطباعة المحضر",
    }))) return;
    try {
      const warns = Object.values(s.done).map((w) => `${STAGE[w.stage].label} (${fmtDate(w.issued_on + "T12:00:00")})`).join("، ");
      const { counselor } = await referToGradeCounselor({
        profile, kind: "absence", student: { id: s.student_id, name: s.full_name }, grade: s.grade, classNo: s.class_no, date: todayISO(),
        reason: `بلغ غياب الطالب ${daysWord(s.days)} بدون عذر خلال الفترة من ${fmtDate(from + "T00:00:00")} إلى ${fmtDate(to + "T00:00:00")}، ويُحال لدراسة حالته وأسباب غيابه.`,
        extra: { deputy_note: [warns && `الإنذارات الصادرة: ${warns}.`,
          `أيام الغياب: ${s.dates.map((d) => fmtDate(d + "T12:00:00")).join("، ")}.`].filter(Boolean).join("\n") },
        notify: { title: "إحالة طالب لدراسة حالته (الغياب)",
          body: `أحال إليك وكيل شؤون الطلاب الطالب ${s.full_name} (${classLabelOf(s.grade, s.class_no)}) لدراسة حالته بعد غيابه ${daysWord(s.days)} بدون عذر` },
      });
      await printMinutesMany([{ s, stage: "counselor", from, to, done: s.done, issuedOn: todayISO(), counselor: counselor.name }]);
      setTick((t) => t + 1);
    } catch (e) { setMsg(friendlyError(e)); }
  };

  /* ---------- الطباعة الجماعية للطلاب المحددين ---------- */
  const picked = list.filter((s) => sel.has(s.student_id));
  const pickedDue = picked.filter((s) => s.due.length);
  const pickedDone = picked.filter((s) => Object.keys(s.done).length || refs[s.student_id]);
  const toggleSel = (id) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = list.length > 0 && list.every((s) => sel.has(s.student_id));
  const toggleAll = () => setSel(allOn ? new Set() : new Set(list.map((s) => s.student_id)));

  // إصدار كل الإجراءات المستحقة للمحددين وطباعة محاضرها في ملف واحد
  const issueSelected = async () => {
    const n = pickedDue.reduce((a, s) => a + s.due.length, 0);
    if (!(await confirmDanger({
      title: `إصدار ${n} محضرًا لـ ${pickedDue.length} طالبًا؟`,
      impact: ["يُسجَّل كل إجراء مستحق صادرًا بتاريخ اليوم", "تُطبع المحاضر كلها في ملف واحد، محضر في كل صفحة"],
      level: "medium", confirmLabel: "إصدار وطباعة",
    }))) return;
    setBatchBusy(true); setMsg(null);
    const items = [];
    try {
      for (const s of pickedDue) {
        const done = { ...s.done };
        for (const k of WARNING_STAGES.map((x) => x.key).filter((k) => s.due.includes(k))) {
          await record(s, k);
          items.push({ s, stage: k, from, to, done: { ...done }, issuedOn: todayISO() });
          done[k] = { stage: k, issued_on: todayISO() };
        }
      }
    } catch (e) { setMsg(`توقف الإصدار: ${e.message ?? e}`); }
    if (items.length) await printMinutesMany(items);
    setBatchBusy(false); setSel(new Set()); setTick((t) => t + 1);
  };

  // إعادة طباعة آخر محضر صادر لكل محدد (ومحضر التحويل للموجه إن وُجد)
  const reprintSelected = async () => {
    setBatchBusy(true);
    const items = [];
    pickedDone.forEach((s) => {
      const last = [...WARNING_STAGES].reverse().find((x) => s.done[x.key]);
      if (last) items.push({ s, stage: last.key, from, to, done: s.done, issuedOn: s.done[last.key].issued_on });
      const r = refs[s.student_id];
      if (r) items.push({ s, stage: "counselor", from, to, done: s.done, issuedOn: r.referral_date, counselor: r.counselor_name });
    });
    if (items.length) await printMinutesMany(items);
    setBatchBusy(false);
  };

  const headers = ["م", "اسم الطالب", "الصف", "الفصل", "أيام الغياب بدون عذر", "الإجراء المستحق", "الصادر"];
  const table = () => list.map((s, i) => [
    i + 1, s.full_name, s.grade, s.class_no, s.days,
    s.due.map((k) => STAGE[k].label).join("، ") || "—",
    Object.values(s.done).map((w) => `${STAGE[w.stage].label} (${fmtDate(w.issued_on)})`).join("، ") || "—",
  ]);
  const range = () => `${fmtDate(from + "T00:00:00")} — ${fmtDate(to + "T00:00:00")}`;

  if (!from || !term) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateInput label="من" value={from} onChange={setFrom} />
        <DateInput label="إلى" value={to} onChange={setTo} />
      </div>

      <Note>
        تُعدّ أيام الغياب الرسمي <b>بدون عذر</b> من الأيام المعتمدة:
        {" "}<span className="num">{STAGE.warn1.days}</span> أيام ← إنذار أول مع محضر ·
        {" "}<span className="num">{STAGE.warn2.days}</span> يومًا ← إنذار ثانٍ مع محضر ·
        {" "}<span className="num">{STAGE.transfer.days}</span> يومًا ← تحويل لوكيل شؤون الطلاب مع محضر تحويل لدراسة الحالة.
        الإنذارات الصادرة ورقيًا سابقًا تُسجَّل بتاريخها حتى لا تُطلب مرة أخرى.
      </Note>
      {missing && <SetupNotice />}
      {msg && <p className="text-sm text-absent">{msg}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Fig value={counts.due} label="إجراء مستحق لم يصدر" tone="text-absent" />
        <Fig value={counts.warn1} label={`بلغوا ${STAGE.warn1.days} أيام`} tone="text-late" />
        <Fig value={counts.warn2} label={`بلغوا ${STAGE.warn2.days} يومًا`} tone="text-absent" />
        <Fig value={counts.transfer} label={`بلغوا ${STAGE.transfer.days} يومًا (تحويل)`} tone="text-absent" />
        <Fig value={counts.watch} label={`تحت المتابعة (${WATCH_AT}–${STAGE.warn1.days - 1})`} tone="text-warning" />
      </div>

      <GradePills grade={grade} setGrade={setGrade} />
      <div className="flex flex-wrap gap-1.5">
        <Pill on={view === "due"} onClick={() => setView("due")}>المستحقون <span className="num">({counts.due})</span></Pill>
        <Pill on={view === "watch"} onClick={() => setView("watch")}>كل من غاب {WATCH_AT} أيام فأكثر</Pill>
        <Pill on={view === "issued"} onClick={() => setView("issued")}>الصادرة</Pill>
      </div>

      <ExportBar disabled={!list.length}
        onPrint={() => printReport({ title: "كشف إنذارات الغياب", subtitle: range(), headers, rows: table(), ...logos(), signatures: SIGNS, landscape: true })}
        onExcel={() => exportStyledExcel({ title: "كشف إنذارات الغياب", subtitle: range(), headers, rows: table(), fileName: `إنذارات-الغياب-${from}_${to}`, sheetName: "الإنذارات", signatures: SIGNS })} />

      {list.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-paper px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="accent-mint-deep" checked={allOn} onChange={toggleAll} />
            تحديد الكل <span className="num text-muted">({list.length})</span>
          </label>
          {sel.size > 0 && <span className="text-xs text-muted">المحدد: <b className="num text-ink">{picked.length}</b></span>}
          <div className="ms-auto flex flex-wrap gap-2">
            <button onClick={issueSelected} disabled={batchBusy || !pickedDue.length}
              className="rounded-sm2 bg-mint-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
              إصدار المستحق وطباعته <span className="num">({pickedDue.length})</span>
            </button>
            <button onClick={reprintSelected} disabled={batchBusy || !pickedDone.length}
              className="rounded-sm2 border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-canvas disabled:opacity-40">
              طباعة آخر محضر صادر <span className="num">({pickedDone.length})</span>
            </button>
          </div>
        </div>
      )}

      {!marks ? <Loading /> : list.length === 0 ? (
        <Empty tone={view === "due" ? "good" : "gray"}>
          {view === "due" ? "لا إجراءات مستحقة حاليًا." : "لا طلاب مطابقون."}
        </Empty>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((s) => (
            <div key={s.student_id} className="flex items-start gap-3 px-4 py-3">
              <input type="checkbox" className="mt-1.5 accent-mint-deep" aria-label={`تحديد ${s.full_name}`}
                checked={sel.has(s.student_id)} onChange={() => toggleSel(s.student_id)} />
              <div className="min-w-0 flex-1">
              <button onClick={() => setOpen(open === s.student_id ? null : s.student_id)}
                className="flex w-full items-center justify-between gap-3 text-right">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.full_name}</p>
                  <p className="text-xs text-muted">
                    صف <span className="num">{s.grade}</span> · فصل <span className="num">{s.class_no}</span>
                    {Object.values(s.done).map((w) => (
                      <span key={w.stage} className="text-present"> · ✓ {STAGE[w.stage].label}{w.source === "paper" ? " (ورقي)" : ""}</span>
                    ))}
                    {refs[s.student_id] && <span className="text-mint-deep"> · ✓ محوَّل للموجه</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.due.length > 0 && <span className="chip bg-absent/10 text-absent">مستحق</span>}
                  <span className={`chip ${s.days >= STAGE.warn2.days ? "bg-absent/10 text-absent"
                    : s.days >= STAGE.warn1.days ? "bg-late/10 text-late" : "bg-warning-light text-warning"}`}>
                    {daysWord(s.days)}
                  </span>
                </div>
              </button>

              {open === s.student_id && <div className="mt-2"><StudentFileLink id={s.student_id} pill /></div>}
              {open === s.student_id && (
                <StudentActions s={s} from={from} to={to}
                  onIssue={(stage) => issueAndPrint(s, stage)}
                  onPaper={async (stage, date, note) => {
                    setMsg(null);
                    try { await record(s, stage, { source: "paper", issuedOn: date, note }); setTick((t) => t + 1); }
                    catch (e) { setMsg(friendlyError(e)); }
                  }}
                  onReprint={(w) => printMinutes(s, w.stage, { from, to, done: s.done, issuedOn: w.issued_on })}
                  referral={refs[s.student_id]}
                  canRefer={s.days >= STAGE.warn1.days || Object.keys(s.done).length > 0}
                  onRefer={() => toCounselor(s)}
                  onReprintRefer={(r) => printMinutes(s, "counselor", { from, to, done: s.done, issuedOn: r.referral_date, counselor: r.counselor_name })} />
              )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentActions({ s, onIssue, onPaper, onReprint, referral, canRefer, onRefer, onReprintRefer }) {
  const [paperStage, setPaperStage] = useState("warn1");
  const [paperDate, setPaperDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const wrap = (fn) => async (...a) => { setBusy(true); try { await fn(...a); } finally { setBusy(false); } };

  return (
    <div className="mt-3 space-y-3 rounded-sm2 bg-gray-tint p-3">
      <div>
        <p className="mb-1 text-xs font-semibold text-muted">أيام الغياب بدون عذر</p>
        <div className="flex flex-wrap gap-1">
          {s.dates.map((d) => (
            <span key={d} className="rounded-sm2 bg-white px-2 py-0.5 text-[11px] text-ink">
              {weekdayOf(d)} {fmtDate(d + "T00:00:00")}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {s.due.map((k) => (
          <button key={k} onClick={wrap(() => onIssue(k))} disabled={busy}
            className="rounded-sm2 bg-mint-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            إصدار {STAGE[k].doc} وطباعته
          </button>
        ))}
        {Object.values(s.done).map((w) => (
          <button key={w.stage} onClick={() => onReprint(w)}
            className="rounded-sm2 border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-canvas">
            إعادة طباعة {STAGE[w.stage].doc}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        {referral ? (
          <>
            <span className="chip bg-mint-tint text-mint-deep">✓ حُوِّل للموجه الطلابي {referral.counselor_name} · <span className="num">{referral.serial}</span></span>
            <button onClick={() => onReprintRefer(referral)}
              className="rounded-sm2 border border-line bg-white px-3 py-1.5 text-sm text-ink hover:bg-canvas">
              إعادة طباعة محضر التحويل للموجه
            </button>
          </>
        ) : (
          <>
            <button onClick={wrap(onRefer)} disabled={busy || !canRefer}
              className="rounded-sm2 border border-mint-deep bg-white px-3 py-1.5 text-sm font-semibold text-mint-deep hover:bg-mint-tint disabled:opacity-40">
              تحويل للموجه الطلابي لدراسة حالته
            </button>
            <span className="text-[11px] text-muted">
              {canRefer ? "إحالة لموجه صف الطالب مع محضر الوكيل" : `بعد بلوغ ${STAGE.warn1.days} أيام أو صدور إنذار`}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">تسجيل إجراء صدر ورقيًا سابقًا:</span>
        <select value={paperStage} onChange={(e) => setPaperStage(e.target.value)}
          className="rounded-sm2 border border-line bg-white px-2 py-1 text-sm">
          {WARNING_STAGES.filter((st) => !s.done[st.key]).map((st) => (
            <option key={st.key} value={st.key}>{st.label}</option>
          ))}
        </select>
        <input type="date" value={paperDate} onChange={(e) => setPaperDate(e.target.value)}
          className="rounded-sm2 border border-line bg-white px-2 py-1 text-sm" />
        <button onClick={wrap(() => onPaper(paperStage, paperDate, "صدر ورقيًا قبل النظام"))}
          disabled={busy || !WARNING_STAGES.some((st) => !s.done[st.key])}
          className="rounded-sm2 border border-mint-deep px-3 py-1 text-sm text-mint-deep hover:bg-mint-tint disabled:opacity-40">
          تسجيل
        </button>
      </div>
    </div>
  );
}

/* ============================ المحاضر ============================ */

async function printMinutes(s, stage, opts) {
  await printMinutesMany([{ s, stage, ...opts }]);
}

/** طباعة محاضر عدة طلاب أو مراحل في ملف واحد: محضر في كل صفحة بتوقيعاته */
async function printMinutesMany(items) {
  const ids = [...new Set(items.map((x) => x.s.student_id))];
  const { data } = await supabase.from("students").select("id, national_id").in("id", ids);
  const nids = Object.fromEntries((data ?? []).map((r) => [r.id, r.national_id]));
  const sections = items.map((x) => minutesSection(x.s, x.stage, { ...x, nid: nids[x.s.student_id] }));
  const one = sections.length === 1;
  await printReport({
    title: one ? sections[0].title : `محاضر الغياب — ${sections.length} محضرًا`,
    subtitle: one ? sections[0].subtitle : `طُبعت ${fmtDate(todayISO() + "T12:00:00")}`,
    sections,
    ...logos(),
    signatures: sections[0].signatures,
  });
}

function minutesSection(s, stage, { from, to, done, issuedOn, nid: rawNid, counselor }) {
  const nid = rawNid ?? "..................";
  const gradeName = GRADE_NAMES[s.grade] ?? `الصف ${s.grade}`;
  const when = `${weekdayOf(issuedOn)} ${fmtDate(issuedOn + "T12:00:00")}`;
  // المحضر HTML جاهز (sections.html): القيم من البيانات تُهرَّب
  const who = `الطالب / <b>${escHtml(s.full_name)}</b> — رقم الهوية (<span class="num">${escHtml(nid)}</span>) — ${escHtml(gradeName)} فصل (<span class="num">${escHtml(s.class_no)}</span>)`;
  const days = `<b>(<span class="num">${s.days}</span>) ${s.days >= 3 && s.days <= 10 ? "أيام" : "يومًا"}</b>`;
  const period = `خلال الفترة من ${fmtDate(from + "T00:00:00")} إلى ${fmtDate(to + "T00:00:00")}`;
  const prev = (k) => done?.[k] ? `بتاريخ ${fmtDate(done[k].issued_on + "T12:00:00")}` : "";
  const prevList = WARNING_STAGES.filter((x) => done?.[x.key]).map((x) => `${x.label} ${prev(x.key)}`).join("، ");

  const dates = `
    <table style="margin-top:10px"><thead><tr><th>م</th><th>اليوم</th><th>التاريخ</th></tr></thead><tbody>
      ${s.dates.map((d, i) => `<tr><td>${i + 1}</td><td>${weekdayOf(d)}</td><td>${fmtDate(d + "T12:00:00")}</td></tr>`).join("")}
    </tbody></table>`;

  const P = (t) => `<p style="font-size:14px;line-height:2.1;margin:8px 0;text-align:justify">${t}</p>`;
  const DOCS = {
    warn1: {
      title: "محضر إنذار أول — غياب بدون عذر",
      body: P(`إنه في يوم ${when}، وبناءً على سجلات الحضور والغياب الرسمية المعتمدة في المدرسة، فقد بلغ غياب ${who} ${days} بدون عذر ${period}.`)
        + P("وعليه تم استدعاء الطالب وإبلاغه بالإنذار الأول، وتوعيته بأهمية الانتظام في الحضور وبما يترتب على تكرار الغياب من إجراءات وفق قواعد السلوك والمواظبة، وأُخذ عليه التعهد بالانتظام، مع إشعار ولي أمره بذلك.")
        + dates,
      signs: [
        { title: "الطالب", name: s.full_name },
        { title: "ولي الأمر", name: ".............................." },
        { title: "الموجه الطلابي", name: ".............................." },
      ],
    },
    warn2: {
      title: "محضر إنذار ثانٍ — غياب بدون عذر",
      body: P(`إنه في يوم ${when}، وبناءً على سجلات الحضور والغياب الرسمية المعتمدة في المدرسة، فقد بلغ غياب ${who} ${days} بدون عذر ${period}${done?.warn1 ? `، وسبق إنذاره إنذارًا أول ${prev("warn1")}` : ""}.`)
        + P(`وعليه تم إبلاغ الطالب بالإنذار الثاني، واستدعاء ولي أمره وإطلاعه على غياب ابنه، وأُخذ عليهما التعهد بالانتظام، مع العلم بأن بلوغ الغياب (${STAGE.transfer.days}) يومًا يستوجب تحويل الطالب إلى وكيل شؤون الطلاب لدراسة حالته.`)
        + dates,
      signs: [
        { title: "الطالب", name: s.full_name },
        { title: "ولي الأمر", name: ".............................." },
        { title: "الموجه الطلابي", name: ".............................." },
      ],
    },
    transfer: {
      title: "محضر تحويل طالب إلى وكيل شؤون الطلاب لدراسة الحالة — الغياب",
      body: P(`إنه في يوم ${when}، نظرًا لبلوغ غياب ${who} ${days} بدون عذر ${period}${
        done?.warn1 ? `، وصدور الإنذار الأول ${prev("warn1")}` : ""}${done?.warn2 ? ` والإنذار الثاني ${prev("warn2")}` : "، وصدور الإنذار الثاني"}.`)
        + P("فقد تم تحويل الطالب إلى وكيل شؤون الطلاب لدراسة حالته وأسباب غيابه، واتخاذ ما يلزم وفق قواعد السلوك والمواظبة، مرفقًا به بيان أيام الغياب ومحاضر الإنذارات السابقة.")
        + dates,
      signs: [
        { title: "الموجه الطلابي", name: ".............................." },
        { title: "وكيل شؤون الطلاب (المستلم)", name: STUDENT_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    },
    counselor: {
      title: "محضر تحويل طالب إلى الموجه الطلابي لدراسة الحالة — الغياب",
      body: P(`إنه في يوم ${when}، وبناءً على سجلات الحضور والغياب الرسمية المعتمدة في المدرسة، فقد بلغ غياب ${who} ${days} بدون عذر ${period}${prevList ? `، وسبق صدور ${escHtml(prevList)}` : ""}.`)
        + P(`وعليه فقد قام وكيل شؤون الطلاب بتحويل الطالب إلى الموجه الطلابي${counselor ? ` / <b>${escHtml(counselor)}</b>` : ""} لدراسة حالته والوقوف على أسباب غيابه، واتخاذ الإجراءات الإرشادية والعلاجية المناسبة بالتنسيق مع ولي أمره، والإفادة بما يتم وفق قواعد السلوك والمواظبة، مرفقًا به بيان أيام الغياب.`)
        + dates,
      signs: [
        { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
        { title: "الموجه الطلابي (المستلم)", name: counselor || ".............................." },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
    },
  };

  const doc = DOCS[stage];
  return {
    title: doc.title,
    subtitle: `تاريخ المحضر: ${fmtDate(issuedOn + "T12:00:00")}`,
    html: doc.body,
    signatures: doc.signs,
  };
}
