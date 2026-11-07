// src/pages/lab/exams/LabExams.jsx
// تبويب «مركز الاختبارات» في معمل الحاسب: الاختبارات النهائية للتقنية الرقمية، منفصلة عن اختبارات البوابة العامة.
// • النظري (15): ورقي بتصحيح بطاقة الإجابة بالكاميرا، وإلكتروني على أجهزة المعمل دون إنترنت برمز QR.
// • العملي (25): آلي على الأجهزة، أو مهام أداء بسلّم تقدير، أو مختلط، بحسب اختيار المعلم.
// • بنك الأسئلة من دروس المعمل، يعدّله المعلمون ويضيفون إليه.
// الدرجات تُرصد في «سجل التطبيقات» عملًا لكل فصل (supabase/lab_exam_1.sql، src/lib/labExamData.js).
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Loader from "../../../components/Loader.jsx";
import { fmtDate } from "../../../lib/dates";
import { EXAM_GRADES } from "../../../lib/labExam.js";
import { PRACTICAL_MODES } from "../../../lib/labPractical.js";
import { setupMsg } from "../../../lib/labExamData.js";
import ExamCreate from "./ExamCreate.jsx";
import ExamBank from "./ExamBank.jsx";
import ExamPage from "./ExamPage.jsx";

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

export default function LabExams({ lab, canCreate, readOnly = false }) {
  const [part, setPart] = useState("exams");
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(null);   // "theory" | "practical"
  const [open, setOpen] = useState(null);
  const load = async () => {
    const { data, error } = await supabase.from("lab_exams").select("*").order("created_at", { ascending: false });
    if (error) { setErr(setupMsg(error)); setList([]); return; }
    setErr(""); setList(data ?? []);
  };
  useEffect(() => { load(); }, []);

  if (creating) return <ExamCreate kind={creating} lab={lab} onCancel={() => setCreating(null)} onSaved={(e) => { setCreating(null); load(); setOpen(e); }} />;
  if (open) return <ExamPage exam={open} readOnly={readOnly} onBack={() => { setOpen(null); load(); }} onDeleted={() => { setOpen(null); load(); }} />;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-base font-bold text-ink">مركز اختبارات التقنية الرقمية</h2>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">
          الاختبار النهائي النظري (<span className="num">15</span>) ورقيًا بتصحيح بطاقة الإجابة بالكاميرا، أو إلكترونيًا على أجهزة المعمل دون إنترنت،
          والاختبار العملي (<span className="num">25</span>) بالصيغة التي تختارها. تُرصد الدرجات في سجل التطبيقات لكل فصل.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" className={pill(part === "exams")} onClick={() => setPart("exams")}>الاختبارات</button>
          <button type="button" className={pill(part === "bank")} onClick={() => setPart("bank")}>بنك الأسئلة</button>
        </div>
      </div>

      {readOnly && <p className="rounded-card bg-canvas px-3 py-2 text-[12.5px] text-muted">اطّلاع للدعم الفني لتقديم الدعم: عرض الاختبارات ورصدها دون إنشاء أو تعديل أو طباعة.</p>}
      {err && <p className="rounded-card bg-warning-light px-3 py-2 text-sm text-late">{err}</p>}
      {part === "bank" ? <ExamBank canEdit={canCreate} /> : (
        <>
          {canCreate && !err && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setCreating("theory")} className="card p-4 text-right hover:shadow-md" style={{ borderTop: "4px solid #3E6350" }}>
                <b className="block text-ink">+ اختبار نهائي نظري</b>
                <span className="text-[12.5px] text-muted">من بنك الأسئلة بالوحدات وعدد الأسئلة، من <span className="num">15</span> درجة</span>
              </button>
              <button type="button" onClick={() => setCreating("practical")} className="card p-4 text-right hover:shadow-md" style={{ borderTop: "4px solid #9A6A1F" }}>
                <b className="block text-ink">+ اختبار عملي</b>
                <span className="text-[12.5px] text-muted">آلي، أو مهام أداء بسلّم تقدير، أو مختلط، من <span className="num">25</span> درجة</span>
              </button>
            </div>
          )}
          {!list ? <Loader /> : !list.length ? (
            <p className="card px-4 py-8 text-center text-sm text-muted">لا اختبارات بعد.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {list.map((e) => (
                <button key={e.id} type="button" onClick={() => setOpen(e)} className="card flex flex-col gap-1.5 p-4 text-right hover:shadow-md"
                        style={{ borderRight: `5px solid ${e.kind === "theory" ? "#3E6350" : "#9A6A1F"}` }}>
                  <span className="text-[11px] font-semibold" style={{ color: e.kind === "theory" ? "#3E6350" : "#9A6A1F" }}>
                    {e.kind === "theory" ? "نظري" : `عملي · ${PRACTICAL_MODES[e.body?.mode]?.t ?? ""}`} · {EXAM_GRADES[e.grade]?.t}
                  </span>
                  <b className="text-[14.5px] text-ink">{e.title}</b>
                  <span className="text-[11.5px] text-muted">
                    من <span className="num">{e.total}</span> · {e.kind === "theory" ? <><span className="num">{e.body?.questions?.length ?? 0}</span> سؤالًا</> : <><span className="num">{(e.body?.tasks?.length ?? 0) + (e.body?.cards?.length ?? 0)}</span> مهمة</>}
                    {" · "}<span className="num">{e.classes?.length ?? 0}</span> فصول · {fmtDate(e.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
