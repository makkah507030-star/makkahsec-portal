// src/components/GradeSheetEditor.jsx
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES } from "../lib/schoolTime";
import {
  PERIODS, loadQuizMarks, loadEntries, saveEntry, sheetShape, buildRow, validCell,
} from "../lib/gradeBook";

/* =====================================================================
   محرّر كشف رصد الدرجات لفصل ومادة.
   • عمود «التقويمات التحريرية» يأتي تلقائيًا من الاختبارات المصحّحة (أخضر).
   • المعلم يعدّل أي خانة في أي وقت، فيُحفظ تعديله فورًا ويتقدّم على الآلي (أصفر)،
     ويستطيع إرجاع الخانة للقيمة الآلية بزر ↺.
   • المجاميع تُحسب تلقائيًا حين تكتمل خانات الفترة.
   • Enter ينقل للطالب التالي في نفس العمود — لرصد سريع بلوحة المفاتيح.
   ===================================================================== */

const P_LABEL = { period1: "الفترة الأولى", period2: "الفترة الثانية" };
const TONE = {
  manual: "bg-[#FFF3D6] border-[#E8C46A]",
  auto:   "bg-mint-tint border-[#BFE8D0]",
  "":     "bg-white border-line",
};

export default function GradeSheetEditor({ g, uid, year, term, onClose }) {
  const shape = useMemo(() => sheetShape(g), [g]);
  const [marks, setMarks] = useState(null);
  const [entries, setEntries] = useState(null);
  const [draft, setDraft] = useState({});      // key → نص قيد الكتابة
  const [bad, setBad] = useState({});          // key → true للقيمة غير الصالحة
  const [saving, setSaving] = useState(0);
  const [err, setErr] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    const ctx = { uid, year, term, groups: [g] };
    Promise.all([loadQuizMarks(supabase, ctx), loadEntries(supabase, ctx)])
      .then(([qm, en]) => { setMarks(qm[g.key] ?? null); setEntries(en); })
      .catch((e) => setErr(e?.message || "تعذّر تحميل الكشف"));
  }, [g, uid, year, term]);

  const keyOf = (studentId, cell) => `${g.key}|${studentId}|${cell}`;

  const persist = async (studentId, cell, value) => {
    setSaving((n) => n + 1); setErr(null);
    const { error } = await saveEntry(supabase, { uid, year, term, g, studentId, cell, value });
    setSaving((n) => n - 1);
    if (error) { setErr(`لم يُحفظ التعديل: ${error.message}`); return false; }
    setEntries((e) => {
      const n = { ...e };
      if (value === null) delete n[keyOf(studentId, cell)];
      else n[keyOf(studentId, cell)] = value;
      return n;
    });
    return true;
  };

  const commit = async (student, c) => {
    const k = keyOf(student.id, c.cell);
    if (!(k in draft)) return;
    const res = validCell(draft[k], c.max);
    if (!res.ok) { setBad((b) => ({ ...b, [k]: true })); return; }
    setBad((b) => { const n = { ...b }; delete n[k]; return n; });
    setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
    if (res.value === c.text) return;                         // لم يتغيّر شيء
    // إعادة كتابة القيمة الآلية نفسها = إرجاع الخانة للآلي
    if (c.auto !== "" && res.value === c.auto) { await persist(student.id, c.cell, null); return; }
    await persist(student.id, c.cell, res.value);
  };

  // Enter ⇒ الطالب التالي في نفس العمود
  const onKey = (e, row, col) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = tableRef.current?.querySelector(`input[data-r="${row + 1}"][data-c="${col}"]`);
    if (next) next.focus(); else e.currentTarget.blur();
  };

  const loading = entries === null && !err;
  const autoCount = marks ? marks.count.period1 + marks.count.period2 : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" dir="rtl">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3">
        <button onClick={onClose} className="rounded-pill border border-line px-3 py-1 text-sm font-semibold text-muted">
          إغلاق
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">كشف رصد درجات {g.subject}</p>
          <p className="text-xs text-muted">
            {GRADE_NAMES[g.grade] ?? ""} · فصل <bdi>{g.class_no}</bdi> · <bdi>{g.students.length}</bdi> طالبًا
          </p>
        </div>
        <span className={`chip shrink-0 ${saving ? "bg-warning/10 text-warning" : "bg-present/10 text-present"}`}>
          {saving ? "جارٍ الحفظ…" : "كل التعديلات محفوظة"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] border ${TONE.auto}`} /> من التصحيح الآلي</span>
        <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-[3px] border ${TONE.manual}`} /> عدّله المعلم</span>
        <span>اكتب رقمًا أو «غ» للغائب · Enter للطالب التالي</span>
        {autoCount > 0
          ? <span className="text-mint-deep">عمود التقويمات التحريرية من <bdi>{autoCount}</bdi> اختبار قصير مصحَّح</span>
          : <span>لا توجد اختبارات قصيرة مصحَّحة لهذا الفصل بعد</span>}
      </div>

      {err && <p className="bg-absent/10 px-4 py-2 text-sm text-absent">{err}</p>}

      <div className="flex-1 overflow-auto p-3">
        {loading ? (
          <p className="py-10 text-center text-sm text-muted">جارٍ تحميل الكشف…</p>
        ) : (
          <table ref={tableRef} className="border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-10">
              <tr>
                <th rowSpan={2} className="sticky right-0 z-20 w-[36px] min-w-[36px] max-w-[36px] border border-line bg-white py-1.5">م</th>
                <th rowSpan={2} className="sticky right-[36px] z-20 min-w-[170px] border border-line bg-white px-2 py-1.5 text-right">اسم الطالب</th>
                {PERIODS.map((p) => (
                  <th key={p} colSpan={shape.nCols + 1} className="border border-line bg-[#EFEFEF] px-2 py-1.5">{P_LABEL[p]}</th>
                ))}
                <th rowSpan={2} className="border border-line bg-[#EFEFEF] px-2 py-1.5">المجموع</th>
              </tr>
              <tr>
                {PERIODS.map((p) => (
                  <Fragment key={p}>
                    {shape.cols.map((c, ci) => (
                      <th key={ci} className={`max-w-[92px] border border-line px-1.5 py-1 font-medium leading-snug ${
                        ci === shape.qIdx ? "bg-mint-tint" : "bg-white"}`}>
                        {c.label} <span className="num">({c.max})</span>
                      </th>
                    ))}
                    <th className="border border-line bg-white px-1.5 py-1 font-medium">مجموع الفترة</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.students.map((st, ri) => {
                const row = buildRow(g, shape, st, marks, entries ?? {});
                return (
                  <tr key={st.id}>
                    <td className="num sticky right-0 z-[1] w-[36px] min-w-[36px] max-w-[36px] border border-line bg-white py-1 text-center text-muted">{ri + 1}</td>
                    <td className="sticky right-[36px] z-[1] min-w-[170px] border border-line bg-white px-2 py-1 font-medium text-ink">{st.full_name}</td>
                    {row.map((c, ci) => {
                      if (c.total || c.grand) {
                        return (
                          <td key={ci} className="num border border-line bg-[#F7F7F7] px-2 py-1 text-center font-bold text-ink">
                            {c.text}
                          </td>
                        );
                      }
                      const k = keyOf(st.id, c.cell);
                      const shown = k in draft ? draft[k] : c.text;
                      return (
                        <td key={ci} className="border border-line p-0.5">
                          <div className="flex items-center gap-0.5">
                            <input value={shown} inputMode="decimal"
                                   data-r={ri} data-c={ci}
                                   onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                                   onBlur={() => commit(st, c)}
                                   onKeyDown={(e) => onKey(e, ri, ci)}
                                   className={`num h-8 w-14 rounded-[5px] border text-center text-xs outline-none focus:ring-2 focus:ring-mint-deep/40 ${
                                     bad[k] ? "border-absent bg-absent/10" : TONE[c.src] ?? TONE[""]}`}
                                   title={bad[k] ? `اكتب رقمًا من 0 إلى ${c.max} أو «غ»` : ""} />
                            {c.src === "manual" && c.auto !== "" && (
                              <button type="button" title={`إرجاع للقيمة الآلية (${c.auto})`}
                                      onClick={() => persist(st.id, c.cell, null)}
                                      className="text-[11px] text-muted hover:text-mint-deep">↺</button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
