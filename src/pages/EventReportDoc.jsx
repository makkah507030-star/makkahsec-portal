// src/pages/EventReportDoc.jsx
import { fmtDate } from "../lib/dates";
import { eventDateRange } from "../lib/eventDates.js";
import { audienceLabel, audienceTitle } from "../lib/eventAudience.js";
import { S, n, paginate, Kpis, Box, Signs, Page, Cover } from "../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير تنفيذ الحدث بطقم التقارير (components/report) وبهوية البوابة الرسمية،
   كالتقارير الشهرية: الغلاف ← بيانات الحدث والمشاركة ← النبذة والأهداف ووصف التنفيذ
   والنتائج والتوصيات ← صور التنفيذ ← الحاضرون ← الاعتماد والتواقيع.
   بنسختين ملوّنة ورسمية موفّرة للحبر (ReportViewer). حلّ محل EventReportSheet.
   ===================================================================== */

const CAP = 800;   // ارتفاع محتوى الورقة التقديري بعد الترويسة
const has = (v) => typeof v === "string" && v.trim() !== "";
// «08:00» ← «8:00 ص»
const t12 = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
};
// ارتفاع فقرة نصية تقديريًا: نحو 95 حرفًا في السطر، وسطر بـ 22 نقطة، مع عنوان الصندوق
const textH = (s) => 70 + Math.ceil(String(s).length / 95 + String(s).split("\n").length - 1) * 22;

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function eventReportPages({ e, stats, attended, staff = [], photos = [], theme = "light", sigs = {} }) {
  const date = eventDateRange(e, (d) => fmtDate(`${d}T12:00:00`)) || "—";
  const time = e.start_time ? `${t12(e.start_time)}${e.end_time ? ` – ${t12(e.end_time)}` : ""}` : "—";
  const doc = { title: "تقرير تنفيذ حدث", meta: [e.category || "الأحداث والمناسبات", e.serial ? `رقم ${e.serial}` : null], foot: "الأحداث والمناسبات" };

  // الفقرات النصية تُوزَّع على الصفحات بحسب طولها
  const texts = [
    ["doc", "نبذة عن الحدث", e.description], ["award", "الأهداف", e.goals], ["pen", "وصف التنفيذ", e.report_summary],
    ["chart", "النتائج والأثر", e.report_outcomes], ["spark", "التوصيات", e.report_recommendations],
  ].filter(([, , v]) => has(v)).map(([ic, t, v]) => ({ ic, t, v: v.trim() }));
  const textPages = texts.length ? paginate(texts, (x) => textH(x.v), CAP - 40) : [];
  const photoPages = [];
  for (let i = 0; i < photos.length; i += 4) photoPages.push(photos.slice(i, i + 4));
  const people = [
    ...(attended.length ? [{ head: `الطلاب الحاضرون (${n(attended.length)})`, cols: ["اسم الطالب", "الصف والفصل"] }, ...attended.map((p) => ({ p }))] : []),
    ...(staff.length ? [{ head: `المعلمون والإدارة الحاضرون (${n(staff.length)})`, cols: ["الاسم", "الصفة"] }, ...staff.map((p) => ({ p }))] : []),
  ];
  const peoplePages = people.length ? paginate(people, (r) => (r.head ? 40 : 24), CAP - 30, CAP - 30, (r) => !!r.head) : [];

  const total = 3 + textPages.length + photoPages.length + peoplePages.length;
  const common = { theme, doc, total };
  let pg = 2, sec = 1;
  const kpiCols = Math.min(stats.length, 4) || 1;

  return [
    <Cover key="cover" theme={theme} c={{
      year: e.academic_year ?? null, tag: ["award", "الأحداث والمناسبات"], title: "تقرير تنفيذ حدث", sub: e.title,
      badge: { main: date, sub: "تاريخ الحدث" }, side: e.serial ? { main: String(e.serial), sub: "رقم الحدث" } : null,
      rows: [["user", "المنظّم", `${e.organizer_name ?? "—"}${e.organizer_role ? ` — ${e.organizer_role}` : ""}`],
             ["clock", "الوقت", time], ["folder", "المكان", e.venue || "—"],
             ...(audienceLabel(e) ? [["users", audienceTitle(e), audienceLabel(e)]] : [["grid", "التصنيف", e.category || "—"]])],
      note: ["check", e.stage === "approved"
        ? `اعتمده مدير المدرسة${e.approved_at ? ` في ${fmtDate(String(e.approved_at).slice(0, 10) + "T12:00:00")}` : ""}.`
        : "تقرير مرفوع للاعتماد: يكتمل بتوقيع مدير المدرسة بعد اعتماده."],
      strip: stats.slice(0, 4).map(([k, v]) => [typeof v === "number" ? n(v) : v, k]),
      foot: "الأحداث والمناسبات",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: sec, title: "بيانات الحدث والمشاركة", sub: "كما سُجّلت في البوابة خلال مراحل الحدث" }}>
      <table className="mr-table">
        <tbody>
          {[["رقم الحدث", e.serial ?? "—", "التصنيف", e.category || "—"], ["التاريخ", date, "الوقت", time],
            ["المكان", e.venue || "—", "المنظّم", `${e.organizer_name ?? "—"}${e.organizer_role ? ` — ${e.organizer_role}` : ""}`]].map((r) => (
            <tr key={r[0]}>
              <td style={{ width: 90, color: "var(--mr-ink2)" }}>{r[0]}</td><td className="num">{r[1]}</td>
              <td style={{ width: 90, color: "var(--mr-ink2)" }}>{r[2]}</td><td>{r[3]}</td>
            </tr>
          ))}
          {audienceLabel(e) && <tr><td style={{ color: "var(--mr-ink2)" }}>{audienceTitle(e)}</td><td colSpan={3}>{audienceLabel(e)}</td></tr>}
        </tbody>
      </table>
      <Kpis cols={kpiCols} items={stats.map(([k, v], i) => ({ ic: ["users", "check", "photo", "award"][i % 4], t: k, v, c: S[i % 4] }))} />
    </Page>,

    ...textPages.map((list, i) => (
      <Page key={`t${i}`} {...common} page={++pg} sec={i ? null : { no: ++sec, title: "التنفيذ ونتائجه", sub: "نبذة الحدث وأهدافه، ووصف التنفيذ، والنتائج والتوصيات كما كتبها المنظّم" }}>
        {list.map((x) => (
          <Box key={x.t} icon={x.ic} title={x.t}><div className="mr-notes" style={{ whiteSpace: "pre-line" }}>{x.v}</div></Box>
        ))}
      </Page>
    )),

    ...photoPages.map((list, i) => (
      <Page key={`p${i}`} {...common} page={++pg} sec={i ? null : { no: ++sec, title: "صور من التنفيذ", sub: `${n(photos.length)} صورة` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {list.map((u) => (
            <img key={u} src={u} alt="" crossOrigin="anonymous"
                 style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 10, border: "1px solid var(--mr-line, #DDE5E0)" }} />
          ))}
        </div>
      </Page>
    )),

    ...peoplePages.map((list, i) => (
      <Page key={`a${i}`} {...common} page={++pg} sec={i ? null : { no: ++sec, title: "الحاضرون", sub: "الطلاب، ثم المعلمون والإدارة في حدث للمدرسة كلها" }}>
        <table className="mr-table">
          <tbody>{(() => {
            let k = 0;
            return list.map((r, j) => {
              if (r.head) {
                k = 0;
                return (
                  <tr key={`h${j}`}><td colSpan={3} style={{ background: "var(--mr-tint)", fontWeight: 700, color: "var(--mr-deep)" }}>
                    {r.head} <span style={{ fontWeight: 500, fontSize: 10.5, color: "var(--mr-ink2)" }}>· {r.cols[0]} و{r.cols[1]}</span></td></tr>
                );
              }
              return (
                <tr key={j}><td className="c num" style={{ width: 30 }}>{++k}</td><td>{r.p.student_name}</td>
                  <td style={{ width: 210, fontSize: 10.5 }}>{r.p.class_label}</td></tr>
              );
            });
          })()}</tbody>
        </table>
      </Page>
    )),

    <Page key="end" {...common} page={++pg} sec={{ no: ++sec, title: "الاعتماد", sub: "توقيع منظّم الحدث، وتوقيع مدير المدرسة بعد اعتماده" }}>
      <Box icon="check" title="حالة التقرير" tint>
        <div className="mr-notes">
          {e.stage === "approved"
            ? `اعتمد مدير المدرسة التقرير${e.approved_by_name ? ` (${e.approved_by_name})` : ""}${e.approved_at ? ` في ${fmtDate(String(e.approved_at).slice(0, 10) + "T12:00:00")}` : ""}، وأُقفل الحدث.`
            : e.report_submitted_at ? "التقرير مرفوع لمدير المدرسة وبانتظار الاعتماد." : "مسودة تقرير لم تُرفع للاعتماد بعد."}
        </div>
      </Box>
      <Signs stamp={sigs.stamp} people={[
        { title: e.organizer_role || "منظّم الحدث", name: e.organizer_name, sig: sigs.organizer },
        { title: "مدير المدرسة", name: sigs.principalName, sig: e.stage === "approved" ? sigs.principal : null },
      ]} />
    </Page>,
  ];
}
