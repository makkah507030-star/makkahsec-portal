// src/pages/SupervisionLog.jsx
// سجل الإشراف اليومي (supabase/supervision_log.sql): المشرف المتابع يسجل حضور المعلمين المشرفين معه في يومه
// (الأصل حاضر)، وملاحظة لكل عضو، وملاحظاته، ويذكّرهم عبر واتساب، ثم يعتمد فيُقفل ويصير تقرير اليوم.
// الوكيل والمدير والدعم الفني يرون الأيام كلها وتقاريرها، والمدير والدعم الفني وحدهما يعدّلان المعتمد.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayISO, DAY_NAMES } from "../lib/schoolTime";
import { useNotice } from "../lib/useNotice.js";
import { friendlyError } from "../lib/friendlyError.js";
import { confirmDanger } from "../lib/danger";
import { loadPrincipalSignature, loadSchoolStamp } from "../lib/principalSignature";
import { signatureByName } from "../lib/userSignatures";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import PageIntro from "../components/PageIntro.jsx";
import ReportViewer from "../components/report/ReportViewer.jsx";
import { Page, Kpis, Box, Signs, dmy } from "../components/report/ReportKit.jsx";

const STATUS = {
  present: { t: "حاضر", c: "bg-present text-white", r: "#4E7D66" },
  late: { t: "متأخر", c: "bg-late text-white", r: "#C08A1E" },
  absent: { t: "غائب", c: "bg-absent text-white", r: "#A23B3B" },
  excused: { t: "مستأذن", c: "bg-excused text-white", r: "#3F6B99" },
};
const dowOf = (d) => { const n = new Date(`${d}T12:00:00`).getDay() + 1; return n >= 1 && n <= 5 ? n : 0; };
const waNumber = (m) => { const d = String(m ?? "").replace(/\D/g, ""); return d.startsWith("05") ? `966${d.slice(1)}` : d.startsWith("5") ? `966${d}` : d; };
const count = (ms, k) => ms.filter((m) => m.status === k).length;

export default function SupervisionLog() {
  const { session, profile, hasAdminRole } = useSession();
  const uid = session?.user?.id;
  const manager = hasAdminRole("principal", "tech_support", "deputy_school", "deputy_students");
  const editor = hasAdminRole("principal", "tech_support");
  const [date, setDate] = useState(todayISO());
  const [duty, setDuty] = useState(null);        // جدول الإشراف كله
  const [log, setLog] = useState(undefined);     // سجل اليوم المختار (null إن لم يُسجَّل)
  const [members, setMembers] = useState([]);
  const [note, setNote] = useState("");
  const [mobiles, setMobiles] = useState({});
  const [list, setList] = useState([]);          // آخر السجلات (للإدارة)
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const dow = dowOf(date);

  useEffect(() => {
    supabase.from("supervision_duty").select("day_of_week, person_name, kind, user_id").then(({ data }) => setDuty(data ?? []));
  }, []);
  const myDays = useMemo(() => [...new Set((duty ?? []).filter((r) => r.kind === "supervisor" && r.user_id === uid).map((r) => r.day_of_week))].sort(), [duty, uid]);
  const follower = myDays.includes(dow);
  const dayTeachers = useMemo(() => (duty ?? []).filter((r) => r.day_of_week === dow && r.kind === "teacher"), [duty, dow]);
  const dayFollowers = (duty ?? []).filter((r) => r.day_of_week === dow && r.kind === "supervisor").map((r) => r.person_name);

  const loadList = () => manager && supabase.from("supervision_log").select("id, log_date, day_of_week, members, status, supervisor_name")
    .order("log_date", { ascending: false }).limit(60).then(({ data }) => setList(data ?? []));
  useEffect(() => { loadList(); }, [manager]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!duty) return;
    setLog(undefined);
    supabase.from("supervision_log").select("*").eq("log_date", date).maybeSingle().then(({ data, error }) => {
      if (error && /supervision_log|schema cache/i.test(error.message)) setMsg({ ok: false, text: "نفّذ supabase/supervision_log.sql في قاعدة البيانات أولًا." });
      const base = dayTeachers.map((r) => ({ user_id: r.user_id, name: r.person_name, status: "present", note: "" }));
      if (data) {
        const saved = data.members ?? [];
        // من أُضيف لجدول الإشراف بعد الحفظ يظهر في المسودة حاضرًا
        const extra = data.status === "draft" ? base.filter((b) => !saved.some((s) => (s.user_id ?? s.name) === (b.user_id ?? b.name))) : [];
        setMembers([...saved, ...extra]); setNote(data.note ?? "");
      } else { setMembers(base); setNote(""); }
      setLog(data ?? null);
    });
    if (myDays.includes(dow)) supabase.rpc("supervision_mobiles", { p_dow: dow })
      .then(({ data: m }) => setMobiles(Object.fromEntries((m ?? []).map((x) => [x.user_id, x.mobile]))));
  }, [date, duty]); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = log?.status === "approved";
  const canEdit = dow > 0 && date <= todayISO() && ((follower && !approved) || editor);
  const setM = (i, patch) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const save = async (status) => {
    if (status === "approved") {
      const ok = await confirmDanger({ title: `اعتماد سجل إشراف ${DAY_NAMES[dow]} ${dmy(date)}`, confirmLabel: "اعتماد",
        impact: [`حاضر ${count(members, "present")} · متأخر ${count(members, "late")} · غائب ${count(members, "absent")} · مستأذن ${count(members, "excused")}`,
                 "بعد الاعتماد يُقفل السجل ويصير تقرير اليوم، ولا يعدّله إلا المدير والدعم الفني."] });
      if (!ok) return;
    }
    setBusy(true);
    const { data, error } = await supabase.from("supervision_log")
      .upsert({ log_date: date, day_of_week: dow, members, note: note.trim() || null, status }, { onConflict: "log_date" }).select().single();
    setBusy(false);
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setLog(data); loadList();
    setMsg({ ok: true, text: status === "approved" ? "اعتُمد سجل الإشراف، وصار تقرير اليوم جاهزًا." : status === "draft" && approved ? "أُعيد السجل مسودة." : "حُفظ السجل." });
  };

  const waLink = (m) => {
    const mob = follower && m.user_id && mobiles[m.user_id];
    if (!mob) return null;
    const text = [`السلام عليكم ورحمة الله وبركاته أ. ${m.name}`, `نذكّرك بالإشراف اليومي اليوم ${DAY_NAMES[dow] ?? ""} في الفسحة وبداية اليوم.`,
      "شاكرين تعاونك.", profile?.full_name && `${profile.full_name} — المشرف المتابع`].filter(Boolean).join("\n");
    return `https://api.whatsapp.com/send?phone=${waNumber(mob)}&text=${encodeURIComponent(text)}`;
  };

  if (!duty || log === undefined) return <Loader />;
  if (report && log) return <SupReport log={log} onBack={() => setReport(false)} />;
  if (!manager && !myDays.length) return <p className="card px-4 py-8 text-center text-sm text-muted">هذه الصفحة للمشرف المتابع في أيام إشرافه، وللوكيل والإدارة.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">الإشراف اليومي</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          المشرف المتابع يسجل حضور المعلمين المشرفين في يومه (الأصل حاضر) وملاحظة لكل منهم وملاحظاته، ويذكّرهم عبر واتساب،
          ثم يعتمد السجل فيُقفل ويصير تقرير اليوم.{myDays.length > 0 && ` أيام إشرافك: ${myDays.map((d) => DAY_NAMES[d]).join("، ")}.`}
        </PageIntro>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-muted">التاريخ
          <input type="date" className="field py-1 text-sm" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <span className="text-sm font-semibold text-ink">{DAY_NAMES[dow] ?? "لا دوام"}</span>
        {dayFollowers.length > 0 && <span className="text-[12px] text-muted">المشرف المتابع: {dayFollowers.join(" و")}</span>}
        <span className={`chip ms-auto ${approved ? "bg-present/10 text-present" : log ? "bg-warning-light text-warning" : "bg-canvas text-muted"}`}>
          {approved ? `معتمد${log.approved_by_name ? ` · ${log.approved_by_name}` : ""}` : log ? "مسودة" : "لم يُسجَّل"}</span>
      </div>

      {!dow ? <p className="card px-4 py-6 text-center text-sm text-muted">لا دوام في هذا اليوم.</p>
        : !follower && !manager ? <p className="card px-4 py-6 text-center text-sm text-muted">ليس من أيام إشرافك. اختر يومًا من أيامك.</p>
        : members.length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">لا معلمين مشرفين في جدول الإشراف لهذا اليوم.</p> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(STATUS).map(([k, s]) => (
              <div key={k} className="card px-3 py-2.5"><span className="num block text-xl font-bold" style={{ color: s.r }}>{count(members, k)}</span>
                <span className="text-[11.5px] text-muted">{s.t}</span></div>))}
          </div>
          <div className="card divide-y divide-line">
            {members.map((m, i) => {
              const wa = waLink(m);
              return (
                <div key={m.user_id ?? m.name} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{m.name}</span>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line px-2.5 py-0.5 text-[11.5px] text-present hover:bg-present/10">تذكير واتساب</a>}
                    <div className="flex gap-1">
                      {Object.entries(STATUS).map(([k, s]) => (
                        <button key={k} type="button" disabled={!canEdit} onClick={() => setM(i, { status: k })}
                                className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${m.status === k ? s.c : "border border-line bg-white text-muted"} ${canEdit ? "" : "cursor-default opacity-80"}`}>{s.t}</button>))}
                    </div>
                  </div>
                  {canEdit ? <input className="field w-full py-1.5 text-sm" placeholder="ملاحظة على العضو (اختياري)" maxLength={200}
                                    value={m.note ?? ""} onChange={(e) => setM(i, { note: e.target.value })} />
                    : m.note ? <p className="text-[12.5px] text-muted">ملاحظة: {m.note}</p> : null}
                </div>
              );
            })}
          </div>
          <div className="card space-y-2 p-4">
            <p className="text-sm font-semibold text-ink">ملاحظات المشرف المتابع</p>
            {canEdit ? <textarea className="field min-h-[80px] w-full text-sm" maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)}
                                 placeholder="ما لاحظته في الفسحة وبداية اليوم، والمواقع، وما يحتاج متابعة" />
              : <p className="text-sm leading-relaxed text-muted">{note || "لا ملاحظات."}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !approved && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("draft")}>حفظ</button>}
            {canEdit && !approved && <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("approved")}>اعتماد</button>}
            {approved && editor && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("draft")}>إلغاء الاعتماد</button>}
            {approved && <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => setReport(true)}>تقرير اليوم</button>}
          </div>
        </>
      )}

      {manager && list.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="px-4 pt-3 text-sm font-bold text-ink">سجلات الإشراف</p>
          <table className="mt-2 w-full text-sm">
            <thead className="bg-canvas text-xs text-muted"><tr>
              <th className="px-3 py-2 text-start">التاريخ</th><th className="px-3 py-2 text-start">اليوم</th><th className="px-3 py-2 text-start">المشرف المتابع</th>
              <th className="px-3 py-2 text-start">حاضر</th><th className="px-3 py-2 text-start">غائب</th><th className="px-3 py-2 text-start">الحالة</th></tr></thead>
            <tbody className="divide-y divide-line">{list.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-canvas" onClick={() => { setDate(r.log_date); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <td className="num px-3 py-2">{dmy(r.log_date)}</td><td className="px-3 py-2">{DAY_NAMES[r.day_of_week]}</td>
                <td className="px-3 py-2 text-muted">{r.supervisor_name}</td>
                <td className="num px-3 py-2 text-present">{count(r.members ?? [], "present")}</td>
                <td className="num px-3 py-2 text-absent">{count(r.members ?? [], "absent")}</td>
                <td className="px-3 py-2"><span className={`chip ${r.status === "approved" ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>{r.status === "approved" ? "معتمد" : "مسودة"}</span></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* تقرير الإشراف اليومي بطقم تقارير البوابة: صفحة واحدة بالحضور والملاحظات والتوقيعات */
function SupReport({ log, onBack }) {
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({ sup: null, principal: null, stamp: null });
  useEffect(() => {
    Promise.all([log.supervisor_name ? signatureByName(log.supervisor_name) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([s, p, st]) => setSigs({ sup: s, principal: p?.url ?? null, stamp: st }));
  }, [log]);
  const ms = log.members ?? [];
  const doc = { title: "تقرير الإشراف اليومي", meta: [DAY_NAMES[log.day_of_week], dmy(log.log_date)], foot: "الإشراف اليومي" };
  const pages = [
    <Page key="p" theme={theme} doc={doc} page={1} total={1}
          sec={{ no: 1, title: `الإشراف اليومي — ${DAY_NAMES[log.day_of_week]}`, sub: `${dmy(log.log_date)} · المشرف المتابع: ${log.supervisor_name ?? "—"}` }}>
      <Kpis items={[
        { ic: "users", t: "المعلمون المشرفون", v: ms.length },
        { ic: "check", t: "حاضر", v: count(ms, "present"), c: STATUS.present.r },
        { ic: "alert", t: "متأخر", v: count(ms, "late"), c: STATUS.late.r },
        { ic: "alert", t: "غائب", v: count(ms, "absent"), s: count(ms, "excused") ? `مستأذن ${count(ms, "excused")}` : null, c: STATUS.absent.r },
      ]} />
      <table className="mr-table" style={{ fontSize: 11.5 }}>
        <thead><tr><th className="c">#</th><th>المعلم</th><th className="c">الحالة</th><th>الملاحظة</th></tr></thead>
        <tbody>{ms.map((m, i) => (
          <tr key={m.user_id ?? m.name}><td className="c num">{i + 1}</td><td>{m.name}</td>
            <td className="c" style={{ color: STATUS[m.status]?.r, fontWeight: 700 }}>{STATUS[m.status]?.t}</td><td>{m.note || "—"}</td></tr>))}</tbody>
      </table>
      <Box icon="list" title="ملاحظات المشرف المتابع"><p style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{log.note || "لا ملاحظات."}</p></Box>
      <Signs stamp={sigs.stamp} people={[{ title: "المشرف المتابع", name: log.supervisor_name, sig: sigs.sup }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
  return (
    <ReportViewer id="supervision-report-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير الإشراف ${log.log_date}`}
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للسجل</button>} />
  );
}
