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
  const manager = hasAdminRole("principal", "tech_support", "deputy_academic", "deputy_school", "deputy_students");
  const editor = hasAdminRole("principal", "tech_support");
  const [date, setDate] = useState(todayISO());
  const [duty, setDuty] = useState(null);        // جدول الإشراف كله
  const [log, setLog] = useState(undefined);     // سجل اليوم المختار (null إن لم يُسجَّل)
  const [members, setMembers] = useState([]);
  const [note, setNote] = useState("");           // ملاحظات مشتركة (السجلات قبل الملاحظات الشخصية)
  const [pnotes, setPnotes] = useState({});        // ملاحظات كل مشرف متابع باسمه (supervision_log_2.sql)
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
  const followerRows = (duty ?? []).filter((r) => r.day_of_week === dow && r.kind === "supervisor");
  const dayFollowers = followerRows.map((r) => r.person_name);

  // الإدارة: كل الأيام؛ والمشرف المتابع: سجلات أيامه (سياسة القراءة تقصره عليها)
  const loadList = () => (manager || myDays.length) && supabase.from("supervision_log").select("id, log_date, day_of_week, members, status, supervisor_name, followers")
    .order("log_date", { ascending: false }).limit(60).then(({ data }) => setList(data ?? []));
  useEffect(() => { loadList(); }, [manager, myDays.join()]); // eslint-disable-line react-hooks/exhaustive-deps

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
        setMembers([...saved, ...extra]); setNote(data.note ?? ""); setPnotes(data.person_notes ?? {});
      } else { setMembers(base); setNote(""); setPnotes({}); }
      setLog(data ?? null);
    });
    if (myDays.includes(dow)) supabase.rpc("supervision_mobiles", { p_dow: dow })
      .then(({ data: m }) => setMobiles(Object.fromEntries((m ?? []).map((x) => [x.user_id, x.mobile]))));
  }, [date, duty]); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = log?.status === "approved";
  const canEdit = dow > 0 && date <= todayISO() && ((follower && !approved) || editor);
  const setM = (i, patch) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch, by: profile?.full_name ?? "" } : m)));

  const save = async (status) => {
    if (status === "approved") {
      const ok = await confirmDanger({ title: `اعتماد سجل إشراف ${DAY_NAMES[dow]} ${dmy(date)}`, confirmLabel: "اعتماد",
        impact: [`حاضر ${count(members, "present")} · متأخر ${count(members, "late")} · غائب ${count(members, "absent")} · مستأذن ${count(members, "excused")}`,
                 "بعد الاعتماد يُقفل السجل ويصير تقرير اليوم، ولا يعدّله إلا المدير والدعم الفني."] });
      if (!ok) return;
    }
    setBusy(true);
    const row = { log_date: date, day_of_week: dow, members, note: note.trim() || null, person_notes: pnotes, status };
    // يُرسل ما تغيّر وحده، فلا يمحو ما حفظه المشرف الآخر في الأثناء (والخادم يأخذ من كلٍّ ملاحظاته)
    const patchOf = (base) => Object.fromEntries(Object.entries(row).filter(([k, v]) => k !== "log_date" && JSON.stringify(v ?? null) !== JSON.stringify(base?.[k] ?? null)));
    let res;
    if (log) res = await supabase.from("supervision_log").update(patchOf(log)).eq("id", log.id).select().single();
    else {
      res = await supabase.from("supervision_log").insert(row).select().single();
      if (res.error && /duplicate|23505/.test(res.error.message)) {   // أنشأه المشرف الآخر للتو
        const { data: cur } = await supabase.from("supervision_log").select("*").eq("log_date", date).maybeSingle();
        if (cur) res = await supabase.from("supervision_log").update(patchOf({ ...cur, note: null, person_notes: {} })).eq("id", cur.id).select().single();
      }
    }
    setBusy(false);
    const { data, error } = res;
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setLog(data); setMembers(data.members ?? members); setNote(data.note ?? ""); setPnotes(data.person_notes ?? {}); loadList();
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
        {dayFollowers.length > 0 && <span className="text-[12px] text-muted">{dayFollowers.length > 1 ? "المشرفون المتابعون" : "المشرف المتابع"}: {dayFollowers.join(" و")}</span>}
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
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{m.name}
                      {followerRows.length > 1 && m.by && <span className="mr-2 text-[11px] font-normal text-faint">سجّله: {m.by.split(" ").filter((w) => w !== "بن").filter((w, k, arr) => k === 0 || k === arr.length - 1).join(" ")}</span>}</span>
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
          <div className="card space-y-3 p-4">
            <p className="text-sm font-semibold text-ink">ملاحظات {followerRows.length > 1 ? "المشرفين المتابعين" : "المشرف المتابع"}
              {followerRows.length > 1 && <span className="text-[11.5px] font-normal text-muted"> · كلٌّ يكتب ملاحظاته ويرى ملاحظات زميله</span>}</p>
            {(followerRows.length ? followerRows : [{ user_id: uid, person_name: profile?.full_name }]).map((r) => {
              const mine = r.user_id === uid, val = pnotes[r.user_id] ?? "";
              return (
                <div key={r.user_id ?? r.person_name}>
                  {followerRows.length > 1 && <p className="mb-1 text-[12px] font-semibold text-muted">{r.person_name}{mine ? " (أنت)" : ""}</p>}
                  {canEdit && (mine || editor) ? <textarea className="field min-h-[70px] w-full text-sm" maxLength={1500} value={val}
                      onChange={(e) => setPnotes((x) => ({ ...x, [r.user_id]: e.target.value }))} placeholder="ما لاحظته في الفسحة وبداية اليوم، والمواقع، وما يحتاج متابعة" />
                    : <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm leading-relaxed text-muted">{val || "لا ملاحظات."}</p>}
                </div>
              );
            })}
            {note && <p className="text-[12px] text-muted">ملاحظات سابقة: {note}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && !approved && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("draft")}>حفظ</button>}
            {canEdit && !approved && <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("approved")}>اعتماد</button>}
            {approved && editor && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("draft")}>إلغاء الاعتماد</button>}
            {approved && <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => setReport(true)}>تقرير اليوم</button>}
          </div>
        </>
      )}

      {list.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="px-4 pt-3 text-sm font-bold text-ink">{manager ? "سجلات الإشراف" : "سجلاتي في الإشراف اليومي"} <span className="text-[11.5px] font-normal text-muted">· اضغط اليوم لفتحه وتقريره</span></p>
          <table className="mt-2 w-full text-sm">
            <thead className="bg-canvas text-xs text-muted"><tr>
              <th className="px-3 py-2 text-start">التاريخ</th><th className="px-3 py-2 text-start">اليوم</th><th className="px-3 py-2 text-start">المشرف المتابع</th>
              <th className="px-3 py-2 text-start">حاضر</th><th className="px-3 py-2 text-start">غائب</th><th className="px-3 py-2 text-start">الحالة</th></tr></thead>
            <tbody className="divide-y divide-line">{list.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-canvas" onClick={() => { setDate(r.log_date); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <td className="num px-3 py-2">{dmy(r.log_date)}</td><td className="px-3 py-2">{DAY_NAMES[r.day_of_week]}</td>
                <td className="px-3 py-2 text-muted">{(r.followers ?? []).length ? r.followers.map((x) => x.name).join(" و") : r.supervisor_name}</td>
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
  // المشرفون المتابعون: المحفوظون عند الاعتماد، وإلا من أنشأ السجل (السجلات القديمة)
  const fol = (log.followers ?? []).length ? log.followers : [{ user_id: log.supervisor_id, name: log.supervisor_name }];
  const folNames = fol.map((x) => x.name).filter(Boolean).join(" و");
  useEffect(() => {
    Promise.all([fol.length === 1 && fol[0].name ? signatureByName(fol[0].name) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([s, p, st]) => setSigs({ sup: s, principal: p?.url ?? null, stamp: st }));
  }, [log]); // eslint-disable-line react-hooks/exhaustive-deps
  const ms = log.members ?? [];
  const doc = { title: "تقرير الإشراف اليومي", meta: [DAY_NAMES[log.day_of_week], dmy(log.log_date)], foot: "الإشراف اليومي" };
  const pages = [
    <Page key="p" theme={theme} doc={doc} page={1} total={1}
          sec={{ no: 1, title: `الإشراف اليومي — ${DAY_NAMES[log.day_of_week]}`, sub: `${dmy(log.log_date)} · ${fol.length > 1 ? "المشرفون المتابعون" : "المشرف المتابع"}: ${folNames || "—"}${log.approved_by_name ? ` · اعتمده ${log.approved_by_name}` : ""}` }}>
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
      <Box icon="list" title={fol.length > 1 ? "ملاحظات المشرفين المتابعين" : "ملاحظات المشرف المتابع"}>
        {fol.map((x) => { const t = log.person_notes?.[x.user_id]; return t ? (
          <p key={x.user_id ?? x.name} style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap", marginBottom: 4 }}>{fol.length > 1 && <b>{x.name}: </b>}{t}</p>) : null; })}
        {log.note && <p style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap" }}>{log.note}</p>}
        {!log.note && !fol.some((x) => log.person_notes?.[x.user_id]) && <p style={{ fontSize: 12.5 }}>لا ملاحظات.</p>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: fol.length > 1 ? "المشرفون المتابعون" : "المشرف المتابع", name: folNames, sig: sigs.sup }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
  return (
    <ReportViewer id="supervision-report-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير الإشراف ${log.log_date}`}
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للسجل</button>} />
  );
}
