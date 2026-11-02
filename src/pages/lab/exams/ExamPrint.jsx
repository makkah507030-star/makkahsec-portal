// src/pages/lab/exams/ExamPrint.jsx
// بطاقات الاختبار العملي المطبوعة: لكل طالب ورقة باسمه فيها مهمة الأداء التي وقعت له بالقرعة ومعاييرها
// ودرجاتها وخانة التقدير، ومهام الأجهزة إن كان في الاختبار جزء آلي.
import { QuizPrintArea } from "../../../components/QuizPaper.jsx";
import { EXAM_GRADES } from "../../../lib/labExam.js";
import { cardFor } from "../../../lib/labPractical.js";
import logoIcon from "../../../assets/icon-mint.png";

const B = { border: "1px solid #000", padding: "5px 7px" };

export function TaskCardsPrint({ exam, students, classNo }) {
  const ids = students.map((s) => s.id);
  const b = exam.body ?? {};
  return (
    <QuizPrintArea>
      {students.map((s) => {
        const card = b.rubricMarks > 0 ? cardFor(exam, ids, s.id) : null;
        return (
          <div key={s.id} className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", padding: "14mm 15mm", background: "#fff", color: "#000", fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid #3E6350", paddingBottom: 8 }}>
              <img src={logoIcon} alt="" style={{ width: 34, height: 34 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#444" }}>مدرسة مكة الثانوية · معمل الحاسب الآلي · {EXAM_GRADES[exam.grade]?.subject}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{exam.title}</div>
              </div>
              <div style={{ textAlign: "center", border: "1.5px solid #000", borderRadius: 6, padding: "4px 10px" }}>
                <div style={{ fontSize: 10 }}>الدرجة</div><div style={{ fontSize: 15, fontWeight: 700 }}>___ / {exam.total}</div>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }}><tbody><tr>
              <td style={B}>الطالب: <b>{s.full_name}</b></td><td style={{ ...B, width: "22%" }}>الفصل: <b>{classNo ?? ""}</b></td>
              <td style={{ ...B, width: "22%" }}>رقم الجهاز: ______</td></tr></tbody></table>

            {b.autoMarks > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, background: "#EEF5F0", padding: "5px 8px", borderRadius: 4 }}>الجزء الأول: مهام الجهاز ({b.autoMarks} درجة)</div>
                <p style={{ margin: "6px 0", lineHeight: 1.7 }}>افتح ملف الاختبار على جهازك، واختر فصلك واسمك، واكتب مفتاح الفتح الذي يعلنه المعلم، ثم نفّذ المهام ({b.tasks.length}) وسلّم، واعرض رمز QR على المعلم.</p>
              </div>)}

            {card && (
              <div>
                <div style={{ fontWeight: 700, background: "#F6EFE3", padding: "5px 8px", borderRadius: 4 }}>{b.autoMarks > 0 ? "الجزء الثاني" : "المهمة"}: {card.title} ({b.rubricMarks} درجة)</div>
                <p style={{ margin: "6px 0", fontSize: 12, color: "#444" }}>البرنامج: {card.app}</p>
                <p style={{ margin: "6px 0 10px", lineHeight: 1.9, fontSize: 14 }}>{card.task}</p>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr style={{ background: "#EEE" }}><th style={B}>م</th><th style={B}>معيار التقييم</th><th style={{ ...B, width: "16%" }}>الدرجة</th><th style={{ ...B, width: "16%" }}>التقدير</th></tr></thead>
                  <tbody>{card.criteria.map((x, i) => (
                    <tr key={x.t}><td style={{ ...B, textAlign: "center" }}>{i + 1}</td><td style={B}>{x.t}</td><td style={{ ...B, textAlign: "center" }}>{x.m}</td><td style={B} /></tr>))}
                    <tr><td style={B} /><td style={{ ...B, fontWeight: 700 }}>المجموع</td><td style={{ ...B, textAlign: "center", fontWeight: 700 }}>{b.rubricMarks}</td><td style={B} /></tr></tbody>
                </table>
                <p style={{ marginTop: 10, fontSize: 11.5, color: "#444" }}>احفظ عملك باسمك ورقم فصلك في المجلد الذي يحدده المعلم، ولا تغلق البرنامج حتى يطّلع عليه المعلم.</p>
              </div>)}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 26, fontSize: 12 }}>
              <span>معلم المادة: ____________________</span><span>التوقيع: __________</span>
            </div>
          </div>
        );
      })}
    </QuizPrintArea>
  );
}
