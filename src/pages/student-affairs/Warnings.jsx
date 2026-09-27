// الإنذارات والمحاضر: أيام الغياب الرسمي بدون عذر من الأيام المعتمدة
//   10 أيام ← إنذار أول + محضر
//   15 يومًا ← إنذار ثانٍ + محضر
//   20 يومًا ← تحويل لوكيل شؤون الطلاب + محضر تحويل لدراسة الحالة
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtGreg, fmtBoth } from "../../lib/dates";
import { printReport, exportStyledExcel, STUDENT_DEPUTY_NAME, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { WARNING_STAGES, loadTermStart, loadActiveTerm, isMissingTable } from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, GradePills, Note, Loading, Empty, SetupNotice, weekdayOf, daysWord,
} from "./shared.jsx";

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
  const [msg, setMsg] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    Promise.all([loadTermStart(todayISO()), loadActiveTerm()]).then(([d, t]) => {
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
    } catch (e) { setMsg(e.message ?? String(e)); }
  };

  const headers = ["م", "اسم الطالب", "الصف", "الفصل", "أيام الغياب بدون عذر", "الإجراء المستحق", "الصادر"];
  const table = () => list.map((s, i) => [
    i + 1, s.full_name, s.grade, s.class_no, s.days,
    s.due.map((k) => STAGE[k].label).join("، ") || "—",
    Object.values(s.done).map((w) => `${STAGE[w.stage].label} (${fmtGreg(w.issued_on)})`).join("، ") || "—",
  ]);
  const range = () => `${fmtGreg(from + "T00:00:00")} — ${fmtGreg(to + "T00:00:00")}`;

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

      {!marks ? <Loading /> : list.length === 0 ? (
        <Empty tone={view === "due" ? "good" : "gray"}>
          {view === "due" ? "لا إجراءات مستحقة حاليًا." : "لا طلاب مطابقون."}
        </Empty>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((s) => (
            <div key={s.student_id} className="px-4 py-3">
              <button onClick={() => setOpen(open === s.student_id ? null : s.student_id)}
                className="flex w-full items-center justify-between gap-3 text-right">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.full_name}</p>
                  <p className="text-xs text-muted">
                    صف <span className="num">{s.grade}</span> · فصل <span className="num">{s.class_no}</span>
                    {Object.values(s.done).map((w) => (
                      <span key={w.stage} className="text-present"> · ✓ {STAGE[w.stage].label}{w.source === "paper" ? " (ورقي)" : ""}</span>
                    ))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.due.length > 0 && <span className="chip bg-absent/10 text-absent">مستحق</span>}
                  <span className={`num chip ${s.days >= STAGE.warn2.days ? "bg-absent/10 text-absent"
                    : s.days >= STAGE.warn1.days ? "bg-late/10 text-late" : "bg-warning-light text-warning"}`}>
                    {daysWord(s.days)}
                  </span>
                </div>
              </button>

              {open === s.student_id && (
                <StudentActions s={s} from={from} to={to}
                  onIssue={(stage) => issueAndPrint(s, stage)}
                  onPaper={async (stage, date, note) => {
                    setMsg(null);
                    try { await record(s, stage, { source: "paper", issuedOn: date, note }); setTick((t) => t + 1); }
                    catch (e) { setMsg(e.message ?? String(e)); }
                  }}
                  onReprint={(w) => printMinutes(s, w.stage, { from, to, done: s.done, issuedOn: w.issued_on })} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StudentActions({ s, onIssue, onPaper, onReprint }) {
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
            <span key={d} className="num rounded-sm2 bg-white px-2 py-0.5 text-[11px] text-ink">
              {weekdayOf(d)} {fmtGreg(d + "T00:00:00")}
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

async function printMinutes(s, stage, { from, to, done, issuedOn }) {
  const { data: st } = await supabase.from("students").select("national_id").eq("id", s.student_id).maybeSingle();
  const nid = st?.national_id ?? "..................";
  const gradeName = GRADE_NAMES[s.grade] ?? `الصف ${s.grade}`;
  const when = `${weekdayOf(issuedOn)} ${fmtBoth(issuedOn + "T12:00:00")}`;
  const who = `الطالب / <b>${s.full_name}</b> — رقم الهوية (<span class="num">${nid}</span>) — ${gradeName} فصل (<span class="num">${s.class_no}</span>)`;
  const days = `<b>(<span class="num">${s.days}</span>) ${s.days >= 3 && s.days <= 10 ? "أيام" : "يومًا"}</b>`;
  const period = `خلال الفترة من ${fmtGreg(from + "T00:00:00")} إلى ${fmtGreg(to + "T00:00:00")}`;
  const prev = (k) => done?.[k] ? `بتاريخ ${fmtGreg(done[k].issued_on + "T12:00:00")}` : "";

  const dates = `
    <table style="margin-top:10px"><thead><tr><th>م</th><th>اليوم</th><th>التاريخ</th></tr></thead><tbody>
      ${s.dates.map((d, i) => `<tr><td>${i + 1}</td><td>${weekdayOf(d)}</td><td>${fmtBoth(d + "T12:00:00")}</td></tr>`).join("")}
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
  };

  const doc = DOCS[stage];
  await printReport({
    title: doc.title,
    subtitle: `العام الدراسي — ${fmtBoth(issuedOn + "T12:00:00")}`,
    sections: [{ title: doc.title, subtitle: `تاريخ المحضر: ${fmtBoth(issuedOn + "T12:00:00")}`, html: doc.body }],
    ...logos(),
    signatures: doc.signs,
  });
}
