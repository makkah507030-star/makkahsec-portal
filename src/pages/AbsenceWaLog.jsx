// src/pages/AbsenceWaLog.jsx
// سجل رسائل الغياب بواتساب وتقريرها (absence_wa_range في supabase/absence_whatsapp.sql): لكل يوم عدد الغائبين
// بلا عذر، وكم أُرسل لهم، وكم بقي، ومن بلا جوال، ومن أرسل. ويُفتح اليوم فتظهر رسائله طالبًا طالبًا،
// ويُصدَّر تقرير المدة بهوية البوابة.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { todayISO, DAY_NAMES, GRADE_NAMES } from "../lib/schoolTime";
import { friendlyError } from "../lib/friendlyError.js";
import { loadPrincipalSignature, loadSchoolStamp } from "../lib/principalSignature";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import ReportViewer from "../components/report/ReportViewer.jsx";
import { Page, Kpis, Signs, paginate } from "../components/report/ReportKit.jsx";

const dmy = (iso) => { const [y, m, d] = iso.split("-"); return `${Number(d)}/${Number(m)}/${y}`; };
const dayName = (iso) => DAY_NAMES[new Date(`${iso}T12:00:00`).getDay() + 1] ?? "";
const hhmm = (ts) => (ts ? new Date(ts).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" }) : "");
const addDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// حالة رسالة الطالب في يومها
const state = (r) => (r.sent_at ? (r.status === "excused" ? ["أُرسل ثم قُبل العذر", "#3F6B99"] : ["أُرسل", "#4E7D66"])
  : !r.has_mobile ? ["لا جوال", "#C08A1E"] : ["لم يُرسل", "#A23B3B"]);

function summarizeDays(rows) {
  const m = new Map();
  for (const r of rows) {
    const d = m.get(r.attend_date) ?? { date: r.attend_date, absent: 0, sent: 0, left: 0, noMobile: 0, senders: new Map(), rows: [] };
    if (r.status === "absent") d.absent += 1;
    if (r.sent_at) { d.sent += 1; if (r.sent_by_name) d.senders.set(r.sent_by_name, (d.senders.get(r.sent_by_name) ?? 0) + 1); }
    else if (!r.has_mobile) d.noMobile += 1;
    else d.left += 1;
    d.rows.push(r);
    m.set(r.attend_date, d);
  }
  return [...m.values()].sort((a, b) => b.date.localeCompare(a.date));
}
const sendersText = (d) => [...d.senders].map(([n, c]) => `${n} (${c})`).join("، ") || "—";

export default function AbsenceWaLog() {
  const [from, setFrom] = useState(addDays(todayISO(), -30));
  const [to, setTo] = useState(todayISO());
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(false);

  useEffect(() => {
    let live = true;
    setRows(null); setErr("");
    supabase.rpc("absence_wa_range", { p_from: from, p_to: to }).then(({ data, error }) => {
      if (!live) return;
      if (error) setErr(/absence_wa|schema cache|function/i.test(error.message) ? "نفّذ supabase/absence_whatsapp.sql في قاعدة البيانات أولًا." : friendlyError(error.message));
      setRows(data ?? []);
    });
    return () => { live = false; };
  }, [from, to]);

  const days = useMemo(() => summarizeDays(rows ?? []), [rows]);
  const tot = useMemo(() => days.reduce((a, d) => ({ absent: a.absent + d.absent, sent: a.sent + d.sent, left: a.left + d.left, noMobile: a.noMobile + d.noMobile }),
    { absent: 0, sent: 0, left: 0, noMobile: 0 }), [days]);

  if (report) return <WaReport days={days} tot={tot} from={from} to={to} onBack={() => setReport(false)} />;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-ink">من
          <input type="date" className="field w-auto py-1 text-sm" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">إلى
          <input type="date" className="field w-auto py-1 text-sm" value={to} min={from} max={todayISO()} onChange={(e) => e.target.value && setTo(e.target.value)} />
        </label>
        <button type="button" className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!days.length} onClick={() => setReport(true)}>تقرير المدة</button>
      </div>

      {err && <p className="card px-4 py-3 text-sm text-absent">{err}</p>}
      {rows === null ? <Loader /> : !days.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">لا غياب معتمد بلا عذر في هذه المدة.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["أيام", days.length, "text-ink"], ["أُرسل", tot.sent, "text-present"], ["لم يُرسل", tot.left, "text-absent"], ["بلا جوال", tot.noMobile, "text-warning"]].map(([t, v, c]) => (
              <div key={t} className="card px-3 py-2.5 text-center">
                <p className={`num text-xl font-bold ${c}`}>{v}</p>
                <p className="text-xs text-muted">{t}</p>
              </div>
            ))}
          </div>
          <div className="card divide-y divide-line">
            {days.map((d) => (
              <div key={d.date}>
                <button type="button" onClick={() => setOpen(open === d.date ? null : d.date)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2.5 text-start text-sm">
                  <span className="min-w-[7.5rem] font-semibold text-ink">{dayName(d.date)} <span className="num">{dmy(d.date)}</span></span>
                  <span className="text-xs text-muted">غائبون <b className="num text-ink">{d.absent}</b></span>
                  <span className="text-xs text-present">أُرسل <b className="num">{d.sent}</b></span>
                  {d.left > 0 && <span className="text-xs text-absent">لم يُرسل <b className="num">{d.left}</b></span>}
                  {d.noMobile > 0 && <span className="text-xs text-warning">بلا جوال <b className="num">{d.noMobile}</b></span>}
                  <span className="ms-auto text-xs text-muted">{open === d.date ? "▲" : "▼"}</span>
                </button>
                {open === d.date && (
                  <div className="bg-canvas/50 px-3 pb-3">
                    <p className="py-1.5 text-xs text-muted">أرسل: {sendersText(d)}</p>
                    <div className="divide-y divide-line rounded-lg bg-white">
                      {d.rows.map((r) => {
                        const [t, c] = state(r);
                        return (
                          <div key={r.student_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.full_name}</span>
                            <span className="text-muted">{GRADE_NAMES[r.grade]} · <span className="num">{r.class_no}</span></span>
                            <span style={{ color: c }} className="font-semibold">{t}</span>
                            {r.sent_at && <span className="text-muted">{r.sent_by_name} <span dir="rtl">{hhmm(r.sent_at)}</span></span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* تقرير المدة: الصفحة الأولى ملخص وجدول الأيام، وما بعدها سجل الرسائل طالبًا طالبًا */
function WaReport({ days, tot, from, to, onBack }) {
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({ principal: null, stamp: null });
  useEffect(() => { Promise.all([loadPrincipalSignature(), loadSchoolStamp()]).then(([p, s]) => setSigs({ principal: p?.url ?? null, stamp: s })); }, []);
  const doc = { title: "تقرير رسائل الغياب بواتساب", meta: [`من ${dmy(from)} إلى ${dmy(to)}`], foot: "رسائل الغياب بواتساب" };
  const pct = tot.absent ? Math.round((tot.sent / Math.max(tot.sent + tot.left + tot.noMobile, 1)) * 100) : 0;
  const all = days.flatMap((d) => d.rows);
  const dayChunks = paginate(days, () => 1, 22, 34);
  const rowChunks = paginate(all, () => 1, 34, 34);
  const total = dayChunks.length + rowChunks.length;
  const th = (h) => <thead><tr>{h.map((x) => <th key={x}>{x}</th>)}</tr></thead>;
  const pages = [
    ...dayChunks.map((ch, i) => (
      <Page key={`d${i}`} theme={theme} doc={doc} page={i + 1} total={total}
        sec={{ no: 1, title: "ملخص الأيام", sub: `من ${dmy(from)} إلى ${dmy(to)} · أيام الغياب المعتمد: ${days.length}` }}>
        {i === 0 && (
          <Kpis items={[
            { ic: "users", t: "غائبون بلا عذر", v: tot.absent },
            { ic: "check", t: "رسائل أُرسلت", v: tot.sent, s: `${pct}%`, c: "#4E7D66" },
            { ic: "alert", t: "لم يُرسل لهم", v: tot.left, c: "#A23B3B" },
            { ic: "list", t: "بلا جوال لولي الأمر", v: tot.noMobile, c: "#C08A1E" },
          ]} />
        )}
        <table className="mr-table" style={{ fontSize: 11 }}>
          {th(["اليوم", "التاريخ", "الغائبون", "أُرسل", "لم يُرسل", "بلا جوال", "من أرسل"])}
          <tbody>{ch.map((d) => (
            <tr key={d.date}><td>{dayName(d.date)}</td><td className="num">{dmy(d.date)}</td><td className="num">{d.absent}</td>
              <td className="num" style={{ color: "#4E7D66", fontWeight: 700 }}>{d.sent}</td><td className="num">{d.left}</td><td className="num">{d.noMobile}</td>
              <td style={{ fontSize: 10 }}>{sendersText(d)}</td></tr>))}</tbody>
        </table>
        {i === dayChunks.length - 1 && <Signs stamp={sigs.stamp} people={[{ title: "وكيل شؤون الطلاب", name: "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />}
      </Page>
    )),
    ...rowChunks.map((ch, i) => (
      <Page key={`r${i}`} theme={theme} doc={doc} page={dayChunks.length + i + 1} total={total}
        sec={{ no: 2, title: "سجل الرسائل", sub: "كل طالب غائب بلا عذر في يومه، وحالة رسالته ومن أرسلها" }}>
        <table className="mr-table" style={{ fontSize: 10.5 }}>
          {th(["التاريخ", "الطالب", "الصف", "الفصل", "الحالة", "المرسل", "الوقت"])}
          <tbody>{ch.map((r) => { const [t, c] = state(r); return (
            <tr key={`${r.attend_date}${r.student_id}`}><td className="num">{dmy(r.attend_date)}</td><td>{r.full_name}</td><td>{GRADE_NAMES[r.grade]}</td>
              <td className="num">{r.class_no}</td><td style={{ color: c, fontWeight: 700 }}>{t}</td><td>{(r.sent_at && r.sent_by_name) || "—"}</td>
              <td dir="rtl" style={{ whiteSpace: "nowrap" }}>{hhmm(r.sent_at) || "—"}</td></tr>); })}</tbody>
        </table>
      </Page>
    )),
  ];
  return <ReportViewer id="absence-wa-report" pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير رسائل الغياب ${from} إلى ${to}`}
    controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للسجل</button>} />;
}
