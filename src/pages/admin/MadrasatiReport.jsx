// src/pages/admin/MadrasatiReport.jsx
// تقرير دعم منصة مدرستي بهوية البوابة (طقم التقارير): المؤشرات، والأنواع والحالات، والصفوف والفصول،
// وزمن الحل، ومن عالج، والطلبات أسبوعًا بأسبوع، ثم سجل تفصيلي بكل طلب. للطباعة وملف PDF.
// الجوال يظهر بآخر ثلاثة أرقام فقط حفاظًا على خصوصية الطلاب في المستند المطبوع.
import { useEffect, useMemo, useState } from "react";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import { PRINCIPAL_NAME, TECH_SUPPORT_NAME } from "../../lib/exportUtils";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { n, pct, paginate, Box, Signs, Page, Kpis, Bars, Split, Highlights, StackedColumns, Legend, S } from "../../components/report/ReportKit.jsx";
import { MR_KINDS, MR_STATUS } from "../../components/MadrasatiSupport.jsx";

const KIND_C = { password: S[0], class: S[1], other: S[2] };
const ST_C = { new: "#9A7B22", in_progress: "#3F6B99", done: "#4E7D66", rejected: "#A23B3B" };
const hours = (r) => (r.handled_at ? (new Date(r.handled_at) - new Date(r.created_at)) / 36e5 : null);
const dur = (h) => (h == null ? "—" : h < 1 ? "أقل من ساعة" : h < 24 ? `${Math.round(h)} ساعة` : `${Math.round(h / 24)} يوم`);
const durS = (h) => (h == null ? "—" : h < 1 ? "<1 س" : h < 24 ? `${Math.round(h)} س` : `${Math.round(h / 24)} يوم`);
const KIND_S = { password: "كلمة مرور", class: "تغيير فصل", other: "أخرى" };
const clsS = (l) => (l ?? "").split(" · ")[1] ?? l ?? "";
const day = (s) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
const gradeOf = (l) => (l ?? "").split(" · ")[0] || "غير محدد";
const weekKey = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x.toISOString().slice(0, 10); };
const what = (r) => (r.kind === "password" ? (r.mobile ? `رقم جديد …${String(r.mobile).slice(-3)}` : `المسجّل …${String(r.current_mobile ?? "").slice(-3)}`)
  : r.kind === "class" ? `إلى فصل ${clsS(r.target_class)}` : (r.details ?? "").slice(0, 60));

function pages({ rows, theme, sigs, range }) {
  const doc = { title: "تقرير دعم منصة مدرستي", meta: ["الدعم الفني", range], foot: "دعم منصة مدرستي" };
  const total = rows.length;
  const by = (f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const st = by((r) => r.status), kd = by((r) => r.kind);
  const solved = rows.filter((r) => r.status === "done");
  const hs = solved.map(hours).filter((h) => h != null);
  const avg = hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null;
  const in24 = hs.filter((h) => h <= 24).length;
  const open = (st.new ?? 0) + (st.in_progress ?? 0);
  const grades = Object.entries(by((r) => gradeOf(r.class_label))).sort((a, b) => b[1] - a[1]);
  const classes = Object.entries(by((r) => r.class_label || "غير محدد")).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const handlers = Object.entries(by((r) => r.handled_by_name || (r.status === "new" ? "لم يُعالج بعد" : "—")))
    .filter(([k]) => k !== "—").sort((a, b) => b[1] - a[1]);
  const repeat = Object.values(by((r) => r.user_id)).filter((v) => v > 1).length;
  // آخر ثمانية أسابيع
  const weeks = [...new Set(rows.map((r) => weekKey(r.created_at)))].sort().slice(-8);
  const cols = weeks.map((w) => ({ label: day(w), values: Object.fromEntries(MR_KINDS.map((k) => [k.k, rows.filter((r) => weekKey(r.created_at) === w && r.kind === k.k).length])) }));
  const series = MR_KINDS.map((k) => ({ k: k.k, t: k.t, c: KIND_C[k.k] }));
  const kindAvg = MR_KINDS.map((k) => {
    const h = solved.filter((r) => r.kind === k.k).map(hours).filter((x) => x != null);
    return { t: k.t, v: h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : 0, c: KIND_C[k.k], note: durS(h.length ? h.reduce((a, b) => a + b, 0) / h.length : null) };
  });

  const high = [
    `${n(total)} طلبًا في الفترة، تمّ منها ${n(solved.length)} (${pct(solved.length, total) ?? 0}%) و${n(open)} مفتوحة.`,
    kd.password ? `طلبات كلمة المرور ${n(kd.password)} (${pct(kd.password, total)}%)، منها ${n(rows.filter((r) => r.kind === "password" && r.mobile).length)} برقم جديد لأن المسجّل في المنصة لا يعمل أو تغيّر.` : null,
    avg != null ? `متوسط زمن الحل ${dur(avg)}، وحُلّ ${pct(in24, hs.length)}% من الطلبات خلال 24 ساعة.` : null,
    grades[0] ? `أكثر الصفوف طلبًا: ${grades[0][0]} (${n(grades[0][1])}).` : null,
    repeat ? `${n(repeat)} طالبًا أرسلوا أكثر من طلب في الفترة.` : null,
  ].filter(Boolean);

  const signs = <Signs stamp={sigs.stamp} people={[{ title: "الدعم الفني", name: TECH_SUPPORT_NAME, sig: sigs.tech }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />;
  const list = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const chunks = paginate(list, (r) => (what(r).length > 30 || (r.student_name ?? "").length > 22 ? 2 : 1), 26, 32);
  const totalPages = 2 + chunks.length;

  return [
    <Page key="p1" theme={theme} doc={doc} page={1} total={totalPages}
          sec={{ no: 1, title: "ملخص الدعم", sub: `طلبات الطلاب لمنصة مدرستي من «مركز الدعم والمساندة» · ${range}` }}>
      <Kpis items={[
        { ic: "list", t: "إجمالي الطلبات", v: total },
        { ic: "check", t: "تمّت", v: solved.length, s: `${pct(solved.length, total) ?? 0}%`, c: ST_C.done },
        { ic: "alert", t: "مفتوحة", v: open, c: ST_C.new },
        { ic: "chart", t: "متوسط زمن الحل", v: dur(avg), s: hs.length ? `${pct(in24, hs.length)}% خلال 24 ساعة` : null },
      ]} />
      <div className="mr-row c2">
        <Box icon="list" title="الطلبات بالنوع">
          <Bars items={MR_KINDS.map((k) => ({ t: k.t, v: kd[k.k] ?? 0, c: KIND_C[k.k] }))} wide />
        </Box>
        <Box icon="check" title="الحالة">
          <Split parts={Object.keys(MR_STATUS).map((k) => ({ t: MR_STATUS[k].t, v: st[k] ?? 0, c: ST_C[k] }))} />
        </Box>
      </div>
      {cols.length > 1 && (
        <Box icon="chart" title="الطلبات أسبوعًا بأسبوع" aside="آخر ثمانية أسابيع">
          <StackedColumns cols={cols} series={series} />
          <Legend series={series} />
        </Box>
      )}
      <Highlights items={high} />
    </Page>,
    <Page key="p2" theme={theme} doc={doc} page={2} total={totalPages} sec={{ no: 2, title: "التوزيع وزمن الحل" }}>
      <Box icon="users" title="الطلبات بالصف"><Bars items={grades.map(([t, v], i) => ({ t, v, c: S[i % 4] }))} full /></Box>
      <Box icon="chart" title="متوسط زمن الحل بالنوع" aside="س: ساعة"><Bars items={kindAvg} full /></Box>
      <Box icon="list" title="أكثر الفصول طلبًا" aside="أعلى ثمانية"><Bars items={classes.map(([t, v]) => ({ t, v }))} full /></Box>
      {handlers.length > 0 && <Box icon="users" title="المعالجة بحسب الموظف"><Bars items={handlers.map(([t, v]) => ({ t, v }))} full /></Box>}
    </Page>,
    ...chunks.map((chunk, i) => (
      <Page key={`t${i}`} theme={theme} doc={doc} page={3 + i} total={totalPages}
            sec={i === 0 ? { no: 3, title: "سجل الطلبات", sub: `${n(total)} طلبًا بترتيب ورودها` } : { no: 3, title: "سجل الطلبات (تتمة)" }}>
        <table className="mr-table" style={{ fontSize: 10.5 }}>
          <thead><tr><th className="c">#</th><th>التاريخ</th><th>الطالب</th><th className="c">الفصل</th><th>الطلب</th><th>التفاصيل</th><th>الحالة</th><th>المعالج</th><th className="c">المدة</th></tr></thead>
          <tbody>{chunk.map((r) => (
            <tr key={r.id}>
              <td className="c num">{list.indexOf(r) + 1}</td>
              <td className="num">{day(r.created_at)}</td>
              <td>{(r.student_name ?? "").split(" ").filter((w, i, a) => i === 0 || i === a.length - 1).join(" ")}</td>
              <td className="c num">{clsS(r.class_label)}</td>
              <td style={{ whiteSpace: "nowrap" }}>{KIND_S[r.kind]}</td>
              <td>{what(r)}</td>
              <td style={{ color: ST_C[r.status], fontWeight: 600, whiteSpace: "nowrap" }}>{MR_STATUS[r.status]?.t}</td>
              <td style={{ whiteSpace: "nowrap" }}>{(r.handled_by_name ?? "—").split(" ").slice(0, 2).join(" ")}</td>
              <td className="c num" style={{ whiteSpace: "nowrap" }}>{durS(hours(r))}</td>
            </tr>))}</tbody>
        </table>
        {i === chunks.length - 1 && signs}
      </Page>
    )),
  ];
}

export default function MadrasatiReport({ rows, onBack }) {
  const [theme, setTheme] = useState("light");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sigs, setSigs] = useState({ tech: null, principal: null, stamp: null });
  useEffect(() => {
    Promise.all([signatureByName(TECH_SUPPORT_NAME), loadPrincipalSignature(), loadSchoolStamp()])
      .then(([t, p, s]) => setSigs({ tech: t, principal: p?.url ?? null, stamp: s }));
  }, []);
  const sel = useMemo(() => rows.filter((r) => (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)), [rows, from, to]);
  const range = from || to ? `${from || "البداية"} — ${to || "اليوم"}` : "كل الطلبات";
  const pg = useMemo(() => pages({ rows: sel, theme, sigs, range }), [sel, theme, sigs, range]);
  return (
    <ReportViewer id="madrasati-report-print" pages={pg} theme={theme} setTheme={setTheme} fileTitle="تقرير دعم منصة مدرستي"
      controls={<>
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للطلبات</button>
        <label className="flex items-center gap-1 text-xs text-muted">من <input type="date" className="field py-1 text-xs" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="flex items-center gap-1 text-xs text-muted">إلى <input type="date" className="field py-1 text-xs" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </>} />
  );
}
