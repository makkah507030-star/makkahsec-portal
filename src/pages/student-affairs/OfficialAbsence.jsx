// الغياب الرسمي: يُحسب بعد الحصة الثانية، ويعتمده الوكيل، ويحق له تصحيحه لاحقًا
import { useMemo, useState } from "react";
import { todayISO, STATUS } from "../../lib/schoolTime";
import { useSession } from "../../lib/session.jsx";
import { fmtGreg, fmtDateTime, fmtTime12 } from "../../lib/dates";
import { printReport, exportStyledExcel } from "../../lib/exportUtils";
import {
  approveDay, saveFinal, overrideMark, summarize, OFFICIAL_LABEL,
} from "../../lib/officialAttendance";
import {
  SIGNS, logos, Pill, Fig, DateInput, ExportBar, GradePills, Note, Loading, Empty,
  SetupNotice, useDay, pctText,
} from "./shared.jsx";
import { useNotice } from "../../lib/useNotice.js";

const TONE = {
  present: "bg-present/10 text-present",
  absent: "bg-absent/10 text-absent",
  excused: "bg-excused/10 text-excused",
  pending: "bg-warning-light text-warning",
};

export default function OfficialAbsence({ initialDate }) {
  const [date, setDate] = useState(initialDate ?? todayISO());
  const { live, approval, error, reload } = useDay(date);
  const [grade, setGrade] = useState(0);
  const [view, setView] = useState("absent");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [editing, setEditing] = useState(null);
  // تحويل الغياب إلى «بعذر» أو إعادته «بدون عذر»: الوكيل والمساعد الإداري 1 و 2 (والمدير والدعم الفني)
  const { hasAdminRole } = useSession();
  const canExcuse = hasAdminRole("deputy_students", "clerk", "clerk_2", "principal", "tech_support");
  const [picked, setPicked] = useState(() => new Set());   // المحدَّدون للتحويل دفعة واحدة

  const day = approval?.day ?? null;
  const markBy = useMemo(
    () => new Map((approval?.marks ?? []).map((m) => [m.student_id, m])),
    [approval]
  );

  // الحالة المعروضة: المعتمدة إن اعتُمد اليوم، وإلا المحسوبة مباشرة
  const rows = useMemo(() => {
    if (!live) return null;
    return live.rows.map((r) => {
      const m = markBy.get(r.student_id);
      const approved = day ? (m?.status ?? "present") : null;
      return {
        ...r,
        shown: approved ?? r.official,
        approved,
        manual: !!m?.manual,
        note: m?.note ?? null,
        editedBy: m?.edited_by_name ?? null,
        changed: day && !m?.manual && approved !== r.official,
      };
    });
  }, [live, markBy, day]);

  const sum = useMemo(() => (rows ? summarize(rows.map((r) => ({ ...r, official: r.shown }))) : null), [rows]);
  const liveSum = useMemo(() => (live ? summarize(live.rows) : null), [live]);
  const finalSum = useMemo(() => (live ? summarize(live.rows, "final") : null), [live]);
  const changed = rows?.filter((r) => r.changed).length ?? 0;
  const conflicts = rows?.filter((r) => r.shown === "absent" && r.punched).length ?? 0;

  const filtered = useMemo(() => {
    let list = rows ?? [];
    if (grade) list = list.filter((r) => r.grade === grade);
    if (view === "absent") list = list.filter((r) => r.shown === "absent");
    else if (view === "conflict") list = list.filter((r) => r.shown === "absent" && r.punched);
    else if (view === "changed") list = list.filter((r) => r.changed || r.manual);
    else list = list.filter((r) => r.shown === view);
    return list.slice().sort((a, b) =>
      a.grade - b.grade || a.class_no - b.class_no || a.full_name.localeCompare(b.full_name, "ar"));
  }, [rows, grade, view]);

  // من يقبل تحويل العذر في القائمة المعروضة
  const excusable = useMemo(
    () => (day && canExcuse ? filtered.slice(0, 400).filter((r) => r.shown === "absent" || r.shown === "excused") : []),
    [day, canExcuse, filtered]);
  const pickedRows = excusable.filter((r) => picked.has(r.student_id));
  const toExcuse = pickedRows.filter((r) => r.shown === "absent");
  const toAbsent = pickedRows.filter((r) => r.shown === "excused");
  const allPicked = excusable.length > 0 && pickedRows.length === excusable.length;
  const togglePick = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // تحويل المحدَّدين دفعة واحدة — طالبًا طالبًا، ويُذكر كم تمّ إن توقّف في منتصفه
  const bulk = async (list, status) => {
    if (!list.length) return;
    const word = status === "excused" ? "بعذر" : "بدون عذر";
    if (!window.confirm(`تحويل غياب ${list.length} طالبًا إلى «${word}»؟`)) return;
    setBusy(true); setMsg(null);
    let done = 0;
    try {
      for (const r of list) {
        await overrideMark(date, r, status, status === "excused" ? "غياب بعذر" : "غياب بدون عذر");
        done++;
      }
      setMsg({ ok: true, text: `حُوّل غياب ${done} طالبًا إلى «${word}».` });
    } catch (e) {
      setMsg({ ok: false, text: `حُوّل ${done} من ${list.length}، ثم تعذّر الباقي: ${e.message ?? e}` });
    } finally {
      setPicked(new Set());
      setBusy(false);
      reload();
    }
  };

  const run = async (fn, okText) => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, text: okText }); reload(); }
    catch (e) { setMsg({ ok: false, text: e.message ?? String(e) }); }
    finally { setBusy(false); }
  };

  const approve = () => {
    if (liveSum.pending > 0 &&
        !window.confirm(`لم يُحضَّر بعد ${liveSum.pending} طالبًا في الحصة الأولى أو الثانية. اعتماد اليوم الآن؟ (يمكن إعادة الاعتماد لاحقًا)`)) return;
    run(() => approveDay(date, live.rows), day ? "أُعيد اعتماد الغياب الرسمي." : "اعتُمد الغياب الرسمي لليوم.");
  };

  // كشف الجهات الرقابية: الغائبون رسميًا فقط
  const absentees = (rows ?? []).filter((r) => r.shown === "absent" && (!grade || r.grade === grade))
    .sort((a, b) => a.grade - b.grade || a.class_no - b.class_no || a.full_name.localeCompare(b.full_name, "ar"));
  const headers = ["م", "اسم الطالب", "الصف", "الفصل", "ملاحظة"];
  const table = () => absentees.map((r, i) => [
    i + 1, r.full_name, r.grade, r.class_no, r.punched ? "بصم ولم يحضر الحصتين" : "",
  ]);
  const subtitle = () => `${fmtGreg(date)} · غياب الحصتين الأولى والثانية · ${
    day ? `معتمد — نسبة الحضور ${pctText(sum.pct)}` : "غير معتمد بعد"}`;

  const printIt = () => printReport({
    title: "كشف الطلاب الغائبين رسميًا", subtitle: subtitle(),
    headers, rows: table(), ...logos(), signatures: SIGNS,
  });
  const excelIt = () => exportStyledExcel({
    title: "كشف الطلاب الغائبين رسميًا", subtitle: subtitle(),
    headers, rows: table(), fileName: `الغياب-الرسمي-${date}`, sheetName: "الغياب", signatures: SIGNS,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DateInput value={date} onChange={setDate} />
      </div>

      <Note>
        الغائب رسميًا: غائب عن الحصتين الأولى والثانية معًا.
        {live?.fingerprint && " من بصم صباحًا وغاب عن الحصتين يُحسب غائبًا ويظهر في «بصم ولم يحضر» للمتابعة."}
        {" "}يُعتمد الكشف
        والنسبة الرسمية <b>آليًا</b> بعد نهاية الحصة الثانية بعشر دقائق، وتُحفظ النسبة المكتملة آليًا
        بعد آخر حصة. يحق للوكيل تصحيح أي حالة أو إعادة الاعتماد في أي وقت.
        {" "}الغياب يُسجَّل <b>بدون عذر</b>، ويحوّله إلى «بعذر» وكيل شؤون الطلاب أو المساعد الإداري 1 و 2 بزر «بعذر» أمام الطالب.
      </Note>

      {approval?.missingTables && <SetupNotice />}
      {error && <Empty>تعذّر التحميل: {error}</Empty>}
      {!live && !error && <Loading />}

      {live && rows && (
        <>
          {live.orphans > 0 && (
            <Note tone="warn">
              يوجد <span className="num">{live.orphans}</span> سجل تحضير لهذا اليوم مرتبط بحصص لم تعد موجودة
              في الجدول (غالبًا بعد إعادة استيراد الجدول)، فلا تُحتسب — قد يظهر بسببها طلاب «لم يُحضَّروا».
            </Note>
          )}
          {/* حالة الاعتماد */}
          <section className="card space-y-3 p-4">
            {day ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-present">
                    ✓ معتمد {day.retroactive ? "(بأثر رجعي)" : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {day.approved_by_name ?? "—"} · {fmtDateTime(day.approved_at)}
                    {day.updated_at && <> · آخر تعديل: {day.updated_by_name ?? "—"} {fmtDateTime(day.updated_at)}</>}
                  </p>
                </div>
                {changed > 0 && (
                  <button onClick={approve} disabled={busy}
                    className="rounded-sm2 bg-warning px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    تغيّرت <span className="num">{changed}</span> حالة في التحضير — إعادة الاعتماد
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-warning">لم يُعتمد بعد — الأرقام مبدئية</p>
                  <p className="text-xs text-muted">يُعتمد آليًا بعد نهاية الحصة الثانية بعشر دقائق، أو اعتمده الآن يدويًا.</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {liveSum.pending > 0
                      ? <>لم يُحضَّر بعد <span className="num">{liveSum.pending}</span> طالبًا في الحصة الأولى أو الثانية.</>
                      : "اكتمل تحضير الحصتين — جاهز للاعتماد."}
                  </p>
                </div>
                {!approval?.missingTables && (
                  <button onClick={approve} disabled={busy || !live.hasData}
                    className="rounded-sm2 bg-mint-deep px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    اعتماد الغياب الرسمي
                  </button>
                )}
              </div>
            )}
            {msg && <p className={`text-sm ${msg.ok ? "text-present" : "text-absent"}`}>{msg.text}</p>}
          </section>

          {live.unmarked.length > 0 && <UnmarkedPeriods date={date} list={live.unmarked} />}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fig value={pctText(sum.pct)} label={day ? "نسبة الحضور الرسمية" : "نسبة الحضور (مبدئية)"} tone="text-mint-deep" />
            <Fig value={sum.absent} label="غائب رسميًا" tone="text-absent" />
            <Fig value={sum.excused} label="غائب بعذر" tone="text-excused" />
            {live.fingerprint
              ? <Fig value={conflicts} label="بصم ولم يحضر" tone="text-warning" />
              : <Fig value={sum.pending} label="لم يُحضَّر" tone="text-warning" />}
          </div>

          <GradePills grade={grade} setGrade={setGrade} />
          <div className="flex flex-wrap gap-1.5">
            <Pill on={view === "absent"} onClick={() => setView("absent")}>غائب <span className="num">({sum.absent})</span></Pill>
            {live.fingerprint && <Pill on={view === "conflict"} onClick={() => setView("conflict")}>بصم ولم يحضر <span className="num">({conflicts})</span></Pill>}
            <Pill on={view === "excused"} onClick={() => setView("excused")}>بعذر <span className="num">({sum.excused})</span></Pill>
            <Pill on={view === "pending"} onClick={() => setView("pending")}>لم يُحضَّر <span className="num">({sum.pending})</span></Pill>
            {day && <Pill on={view === "changed"} onClick={() => setView("changed")}>مصحَّح / متغيّر</Pill>}
            <Pill on={view === "present"} onClick={() => setView("present")}>حاضر <span className="num">({sum.present})</span></Pill>
          </div>

          <ExportBar disabled={!absentees.length} onPrint={printIt} onExcel={excelIt}
                     printLabel="كشف الغائبين — PDF" excelLabel="كشف الغائبين — Excel" />

          {excusable.length > 0 && (
            <div className="card flex flex-wrap items-center gap-2 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={allPicked} disabled={busy}
                  onChange={() => setPicked(allPicked ? new Set() : new Set(excusable.map((r) => r.student_id)))} />
                تحديد الكل <span className="num text-muted">({excusable.length})</span>
              </label>
              <span className="text-xs text-muted">
                المحدَّد: <span className="num">{pickedRows.length}</span>
              </span>
              <div className="ms-auto flex flex-wrap gap-2">
                <button disabled={busy || !toExcuse.length} onClick={() => bulk(toExcuse, "excused")}
                  className="rounded-sm2 bg-excused px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40">
                  تحويل إلى بعذر <span className="num">({toExcuse.length})</span>
                </button>
                <button disabled={busy || !toAbsent.length} onClick={() => bulk(toAbsent, "absent")}
                  className="rounded-sm2 border border-line px-3 py-1.5 text-sm text-muted hover:bg-canvas disabled:opacity-40">
                  إعادة بدون عذر <span className="num">({toAbsent.length})</span>
                </button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <Empty>لا نتائج مطابقة.</Empty>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {filtered.slice(0, 400).map((r) => (
                <div key={r.student_id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                    {excusable.includes(r) && (
                      <input type="checkbox" className="shrink-0" checked={picked.has(r.student_id)} disabled={busy}
                        onChange={() => togglePick(r.student_id)} aria-label={`تحديد ${r.full_name}`} />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{r.full_name}</p>
                      <p className="text-xs text-muted">
                        صف <span className="num">{r.grade}</span> · فصل <span className="num">{r.class_no}</span>
                        {" · "}ح١: {periodWord(r.periods[1])}
                        {" · "}ح٢: {periodWord(r.periods[2])}
                        {r.punched && <> · بصم <span className="num">{fmtTime12(r.punch)}</span></>}
                      </p>
                      {r.manual && (
                        <p className="mt-0.5 text-[11px] text-mint-deep">
                          صحّحه {r.editedBy ?? "الوكيل"}{r.note ? ` — ${r.note}` : ""}
                        </p>
                      )}
                      {r.changed && (
                        <p className="mt-0.5 text-[11px] text-warning">
                          التحضير الآن: {OFFICIAL_LABEL[r.official]} (يختلف عن المعتمد)
                        </p>
                      )}
                    </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`chip ${TONE[r.shown]}`}>{OFFICIAL_LABEL[r.shown]}</span>
                      {day && canExcuse && (r.shown === "absent" || r.shown === "excused") && (
                        <button disabled={busy}
                          onClick={() => r.shown === "absent"
                            ? run(() => overrideMark(date, r, "excused", "غياب بعذر"), `سُجّل غياب ${r.full_name} بعذر.`)
                            : run(() => overrideMark(date, r, "absent", "غياب بدون عذر"), `أُعيد غياب ${r.full_name} بدون عذر.`)}
                          className={`rounded-sm2 px-2 py-1 text-xs font-semibold disabled:opacity-50 ${
                            r.shown === "absent" ? "bg-excused/10 text-excused hover:bg-excused/20"
                                                 : "border border-line text-muted hover:bg-canvas"}`}>
                          {r.shown === "absent" ? "بعذر" : "بدون عذر"}
                        </button>
                      )}
                      {day && (
                        <button onClick={() => setEditing(editing === r.student_id ? null : r.student_id)}
                          className="rounded-sm2 border border-line px-2 py-1 text-xs text-muted hover:bg-canvas">
                          تصحيح
                        </button>
                      )}
                    </div>
                  </div>
                  {editing === r.student_id && (
                    <OverrideForm row={r} busy={busy} canExcuse={canExcuse}
                      onSave={(status, note) => run(async () => {
                        await overrideMark(date, r, status, note);
                        setEditing(null);
                      }, "حُفظ التصحيح وأُعيد احتساب النسبة.")} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* النسبة المكتملة للإحصاء */}
          <section className="card space-y-3 p-4">
            <div>
              <h3 className="text-sm font-semibold text-ink">النسبة المكتملة (للإجراءات الإحصائية)</h3>
              <p className="mt-0.5 text-xs text-muted">
                تُكمَل بعد الحصة الثانية: الطالب الذي حضر أي حصة خلال اليوم يُحسب حاضرًا. تُحفظ آليًا بعد آخر حصة، ولا تغيّر الاعتماد الرسمي.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Fig value={pctText(finalSum.pct)} label="المكتملة الآن" tone="text-mint-deep" />
              <Fig value={finalSum.absent} label="غائب اليوم كاملًا" tone="text-absent" />
              <Fig value={day?.final_pct != null ? pctText(day.final_pct) : "—"} label="المحفوظة"
                   hint={day?.final_at ? fmtDateTime(day.final_at) : "لم تُحفظ بعد"} />
            </div>
            {day && (
              <button onClick={() => run(() => saveFinal(date, live.rows), "حُفظت النسبة المكتملة.")}
                disabled={busy}
                className="rounded-sm2 border border-mint-deep px-4 py-2 text-sm font-semibold text-mint-deep hover:bg-mint-tint disabled:opacity-50">
                حفظ النسبة المكتملة
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}

const periodWord = (s) => (s ? STATUS[s]?.label ?? s : "—");

function OverrideForm({ row, busy, canExcuse, onSave }) {
  const [status, setStatus] = useState(row.shown === "present" ? "absent" : "present");
  const [note, setNote] = useState("");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm2 bg-gray-tint p-2">
      <select value={status} onChange={(e) => setStatus(e.target.value)}
        className="rounded-sm2 border border-line bg-white px-2 py-1.5 text-sm">
        <option value="present">حاضر</option>
        <option value="absent">غائب</option>
        {(canExcuse || row.shown === "excused") && <option value="excused">غائب بعذر</option>}
      </select>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="سبب التصحيح (مثال: خطأ في التحضير)"
        className="min-w-0 flex-1 rounded-sm2 border border-line bg-white px-2 py-1.5 text-sm" />
      <button onClick={() => onSave(status, note)} disabled={busy}
        className="rounded-sm2 bg-mint-deep px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        حفظ
      </button>
    </div>
  );
}

/** الحصص الأولى والثانية التي لم يرصدها معلموها — سبب «لم يُحضَّر» */
function UnmarkedPeriods({ date, list }) {
  const [open, setOpen] = useState(false);
  const byTeacher = list.reduce((m, r) => {
    (m[r.teacher] ??= []).push(r);
    return m;
  }, {});
  const teachers = Object.entries(byTeacher).sort((a, b) => b[1].length - a[1].length);
  const cls = (r) => `ح${r.period_no} · ${r.grade ?? "—"}/${r.class_no ?? "—"}`;

  const headers = ["م", "المعلم", "الحصة", "الصف", "الفصل", "المادة"];
  const table = () => list.map((r, i) => [i + 1, r.teacher, r.period_no, r.grade ?? "", r.class_no ?? "", r.subject]);
  const title = "حصص الأولى والثانية غير المرصودة";

  return (
    <section className="card overflow-hidden border-warning/40">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 bg-warning-light px-4 py-3 text-right">
        <div>
          <p className="text-sm font-semibold text-warning">
            <span className="num">{list.length}</span> حصة في الأولى والثانية لم تُرصد —
            {" "}<span className="num">{teachers.length}</span> معلمًا
          </p>
          <p className="mt-0.5 text-xs text-muted">لهذا يظهر طلاب «لم يُحضَّروا». اضغط لعرض المعلمين والفصول.</p>
        </div>
        <span className="text-xs text-warning">{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open && (
        <div className="space-y-3 p-4">
          <ExportBar onPrint={() => printReport({ title, subtitle: fmtGreg(date), headers, rows: table(), ...logos(), signatures: SIGNS })}
            onExcel={() => exportStyledExcel({ title, subtitle: fmtGreg(date), headers, rows: table(), fileName: `حصص-غير-مرصودة-${date}`, sheetName: "غير مرصودة", signatures: SIGNS })} />
          <div className="divide-y divide-line">
            {teachers.map(([name, rows]) => (
              <div key={name} className="flex items-start justify-between gap-3 py-2">
                <p className="text-sm font-medium text-ink">{name}</p>
                <div className="flex flex-wrap justify-end gap-1">
                  {rows.map((r, i) => (
                    <span key={i} className="rounded-sm2 bg-gray-tint px-2 py-0.5 text-[11px] text-ink">{cls(r)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-faint">
            بعد أن يرصد المعلمون حصصهم، أعد فتح اليوم واضغط «إعادة الاعتماد» ليُحدَّث الكشف والنسبة.
          </p>
        </div>
      )}
    </section>
  );
}
