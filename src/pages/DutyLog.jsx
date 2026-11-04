// src/pages/DutyLog.jsx
// سجل المناوبة اليومية (supabase/duty_log_1..2.sql): المناوبون يسجلون بداية اليوم ونهايته، والطلاب المتأخرين
// وسببه، والمواقف على الطلاب، وملاحظاتهم، ثم يرفعونه للوكيل. والوكيل يسجل حضورهم (الأصل حاضر) وملاحظة لكل
// منهم وملاحظاته ويذكّرهم عبر واتساب، ثم يعتمد: يُقفل ويصير تقرير اليوم، ويصل أولياء أمور المتأخرين تنبيه.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayISO, DAY_NAMES } from "../lib/schoolTime";
import { useNotice } from "../lib/useNotice.js";
import { friendlyError } from "../lib/friendlyError.js";
import { confirmDanger } from "../lib/danger";
import { loadPrincipalSignature, loadSchoolStamp } from "../lib/principalSignature";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import PageIntro from "../components/PageIntro.jsx";
import DutyGuide from "../components/DutyGuide.jsx";
import ReportViewer from "../components/report/ReportViewer.jsx";
import { Page, Kpis, Box, Signs, dmy } from "../components/report/ReportKit.jsx";

const STATUS = {
  present: { t: "حاضر", c: "bg-present text-white", r: "#4E7D66" },
  late: { t: "متأخر", c: "bg-late text-white", r: "#C08A1E" },
  absent: { t: "غائب", c: "bg-absent text-white", r: "#A23B3B" },
  excused: { t: "مستأذن", c: "bg-excused text-white", r: "#3F6B99" },
};
// التأخر الصباحي له إجراءاته مع البصمة، فالمناوبة تسجل التأخر في الانصراف (الاستلام) وحده
const ST = { draft: ["مسودة", "bg-canvas text-muted"], submitted: ["مرفوع للوكيل", "bg-warning-light text-warning"], approved: ["معتمد", "bg-present/10 text-present"] };
const dowOf = (d) => { const n = new Date(`${d}T12:00:00`).getDay() + 1; return n >= 1 && n <= 5 ? n : 0; };
const waNumber = (m) => { const d = String(m ?? "").replace(/\D/g, ""); return d.startsWith("05") ? `966${d.slice(1)}` : d.startsWith("5") ? `966${d}` : d; };
// المتأخرون والمواقف بترتيب إضافتها (الخادم يدمج نصيب كل مناوب فقد يتغيّر ترتيبها)
const byAt = (a) => [...(a ?? [])].sort((x, y) => (x.at ?? 0) - (y.at ?? 0));
const norm = (l) => ({ ...l, person_notes: l.person_notes ?? {}, lates: byAt(l.lates), incidents: byAt(l.incidents) });
// الاسم الأول والعائلة («بندر بن معيض الحارثي» ← «بندر الحارثي»)
const short = (n) => { const w = String(n ?? "").split(" ").filter((x) => x && x !== "بن"); return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0] ?? ""; };
// الوقت من منتقي الوقت (13:50) بصيغة واحدة للعرض والتنبيه (1:50 م)
const t12 = (v) => { if (!/^\d{1,2}:\d{2}/.test(v ?? "")) return ""; const [h, m] = v.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`; };
const L = ({ children }) => <p className="mb-1.5 text-sm font-semibold text-ink">{children}</p>;

/* بحث عن طالب بالاسم من الطلاب النشطين */
function StudentPick({ onPick }) {
  const [q, setQ] = useState(""); const [res, setRes] = useState([]);
  useEffect(() => {
    const t = q.trim(); if (t.length < 3) { setRes([]); return undefined; }
    const h = setTimeout(() => supabase.from("v_active_students").select("student_id, full_name, class_no").ilike("full_name", `%${t}%`).limit(8)
      .then(({ data }) => setRes(data ?? [])), 300);
    return () => clearTimeout(h);
  }, [q]);
  return (
    <div className="relative">
      <input className="field w-full py-1.5 text-sm" placeholder="ابحث باسم الطالب (3 أحرف فأكثر)" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-sm2 border border-line bg-white shadow-card">
          {res.map((s) => (
            <button key={s.student_id} type="button" className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-canvas"
                    onClick={() => { onPick({ student_id: s.student_id, name: s.full_name, class_no: s.class_no }); setQ(""); setRes([]); }}>
              <span>{s.full_name}</span><span className="num text-[11.5px] text-muted">{s.class_no}</span></button>))}
        </div>
      )}
    </div>
  );
}

export default function DutyLog() {
  const { session, profile, hasAdminRole } = useSession();
  const uid = session?.user?.id;
  const approver = hasAdminRole("principal", "tech_support", "deputy_school", "deputy_students");
  const reader = approver || hasAdminRole("deputy_academic");
  const editor = hasAdminRole("principal", "tech_support");
  const [date, setDate] = useState(todayISO());
  const [roster, setRoster] = useState(undefined);
  const [log, setLog] = useState(undefined);
  const [f, setF] = useState(null);              // نسخة التعديل
  const [mobiles, setMobiles] = useState({});
  const [mine, setMine] = useState([]);          // أيام مناوبتي
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(false);
  const [late, setLate] = useState({ kind: "pickup", time: "", reason: "" });
  const [inc, setInc] = useState("");
  const [msg, setMsg] = useNotice(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const by = () => ({ added_by: uid, added_by_name: profile?.full_name ?? "", at: Date.now() });
  const mineItem = (x) => canDeputy || (canDuty && x.added_by === uid);

  useEffect(() => {
    if (!uid) return;
    supabase.from("duty_roster").select("duty_date").or(`user_a.eq.${uid},user_b.eq.${uid}`).lte("duty_date", todayISO())
      .order("duty_date", { ascending: false }).limit(60).then(({ data }) => setMine((data ?? []).map((r) => r.duty_date)));
  }, [uid]);
  const loadList = () => supabase.from("duty_log").select("id, duty_date, members, lates, incidents, status, created_by_name")
    .order("duty_date", { ascending: false }).limit(60).then(({ data }) => setList(data ?? []));
  useEffect(() => { loadList(); }, []);

  useEffect(() => {
    setRoster(undefined); setLog(undefined);
    Promise.all([
      supabase.from("duty_roster").select("name_a, name_b, user_a, user_b, note").eq("duty_date", date).maybeSingle(),
      supabase.from("duty_log").select("*").eq("duty_date", date).maybeSingle(),
    ]).then(([{ data: r }, { data: l, error }]) => {
      if (error && /duty_log|schema cache/i.test(error.message)) setMsg({ ok: false, text: "نفّذ supabase/duty_log_1.sql وduty_log_2.sql في قاعدة البيانات أولًا." });
      setRoster(r ?? null); setLog(l ?? null);
      const base = r ? [[r.user_a, r.name_a], [r.user_b, r.name_b]].filter(([, n]) => n).map(([u, n]) => ({ user_id: u, name: n, status: "present", note: "" })) : [];
      setF(l ? norm(l) : { members: base, start_note: "", end_note: "", lates: [], incidents: [], person_notes: {}, duty_note: "", deputy_note: "", status: "draft" });
    });
    supabase.rpc("duty_mobiles", { p_date: date }).then(({ data }) => setMobiles(Object.fromEntries((data ?? []).map((x) => [x.user_id, x.mobile]))));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const person = !!roster && [roster.user_a, roster.user_b].includes(uid);
  const st = log?.status ?? "draft";
  const canDuty = person && st === "draft" && date <= todayISO();
  const canDeputy = approver && (st !== "approved" || editor);
  const canAny = canDuty || canDeputy;

  const save = async (status) => {
    if (status === "approved") {
      const ok = await confirmDanger({ title: `اعتماد سجل مناوبة ${DAY_NAMES[dowOf(date)] ?? ""} ${dmy(date)}`, confirmLabel: "اعتماد",
        impact: [f.lates.length ? `يصل ${f.lates.length === 1 ? "ولي أمر الطالب المتأخر" : `أولياء أمور ${f.lates.length} طلاب متأخرين`} تنبيه في حساباتهم بالبوابة.` : "لا طلاب متأخرين.",
                 "بعد الاعتماد يُقفل السجل ويصير تقرير اليوم، ولا يعدّله إلا المدير والدعم الفني."] });
      if (!ok) return;
    }
    setBusy(true);
    const row = { duty_date: date, members: f.members, start_note: f.start_note?.trim() || null, end_note: f.end_note?.trim() || null,
      lates: f.lates, incidents: f.incidents, person_notes: f.person_notes, duty_note: f.duty_note?.trim() || null,
      deputy_note: f.deputy_note?.trim() || null, status };
    // يُرسل ما تغيّر وحده، فلا يمحو ما حفظه الزميل في الأثناء (والخادم يأخذ من كل مناوب نصيبه)
    const patchOf = (base) => Object.fromEntries(Object.entries(row).filter(([k, v]) => k !== "duty_date" && JSON.stringify(v ?? null) !== JSON.stringify(base?.[k] ?? null)));
    let res;
    if (log) res = await supabase.from("duty_log").update(patchOf(log)).eq("id", log.id).select().single();
    else {
      res = await supabase.from("duty_log").insert(row).select().single();
      if (res.error && /duplicate|23505/.test(res.error.message)) {   // أنشأه الزميل للتو
        const { data: cur } = await supabase.from("duty_log").select("*").eq("duty_date", date).maybeSingle();
        const blank = { members: [], start_note: null, end_note: null, lates: [], incidents: [], person_notes: {}, duty_note: null, deputy_note: null, status: "draft" };
        if (cur) res = await supabase.from("duty_log").update(patchOf({ ...cur, ...blank, members: cur.members, status: cur.status })).eq("id", cur.id).select().single();
      }
    }
    setBusy(false);
    const { data, error } = res;
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setLog(data); setF(norm(data)); loadList();
    setMsg({ ok: true, text: { draft: "حُفظ السجل.", submitted: "رُفع السجل للوكيل.", approved: "اعتُمد السجل، ووصل أولياء أمور المتأخرين التنبيه." }[status] });
  };

  const waLink = (m) => {
    const mob = m.user_id && m.user_id !== uid && mobiles[m.user_id];
    if (!mob) return null;
    const text = [`السلام عليكم ورحمة الله وبركاته أ. ${m.name}`, `نذكّرك بالمناوبة اليومية ${date === todayISO() ? "اليوم" : `يوم ${dmy(date)}`} ${DAY_NAMES[dowOf(date)] ?? ""} في بداية اليوم ونهايته.`,
      "شاكرين تعاونك.", profile?.full_name].filter(Boolean).join("\n");
    return `https://api.whatsapp.com/send?phone=${waNumber(mob)}&text=${encodeURIComponent(text)}`;
  };

  if (roster === undefined || log === undefined || !f) return <Loader />;
  if (report && log) return <DutyReport log={log} onBack={() => setReport(false)} />;
  if (!reader && !mine.length && !person) return <p className="card px-4 py-8 text-center text-sm text-muted">هذه الصفحة للمناوبين في أيام مناوبتهم، وللوكيل والإدارة.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">المناوبة اليومية</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          المناوبون يسجلون بداية اليوم ونهايته، والطلاب المتأخرين في الانصراف وسبب التأخر، والمواقف على الطلاب، ثم يرفعون السجل للوكيل.
          والوكيل يسجل حضورهم (الأصل حاضر) وملاحظاته ويعتمد، فيصير تقرير اليوم ويصل أولياء أمور المتأخرين تنبيه في حساباتهم.
        </PageIntro>
      </div>

      {(person || mine.length > 0) && <DutyGuide dow={dowOf(date)} />}

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <label className="flex items-center gap-2 text-sm text-muted">التاريخ
          <input type="date" className="field py-1 text-sm" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        <span className="text-sm font-semibold text-ink">{DAY_NAMES[dowOf(date)] ?? "لا دوام"}</span>
        <span className={`chip ms-auto ${ST[st][1]}`}>{ST[st][0]}{st === "approved" && log?.approved_by_name ? ` · ${log.approved_by_name}` : ""}</span>
      </div>

      {!roster ? <p className="card px-4 py-6 text-center text-sm text-muted">لا مناوبة مسجّلة في جدول المناوبة لهذا اليوم.</p>
        : !person && !reader ? <p className="card px-4 py-6 text-center text-sm text-muted">ليس من أيام مناوبتك.</p> : (
        <>
          <div className="card space-y-2 p-4">
            <L>المناوبين {!approver && <span className="text-[11.5px] font-normal text-muted">· الحضور يسجله الوكيل</span>}</L>
            {f.members.map((m, i) => {
              const wa = waLink(m);
              return (
                <div key={m.user_id ?? m.name} className="space-y-2 rounded-sm2 border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{m.name}{m.user_id === uid ? " (أنت)" : ""}</span>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-pill border border-line px-2.5 py-0.5 text-[11.5px] text-present hover:bg-present/10">تذكير واتساب</a>}
                    <div className="flex gap-1">{Object.entries(STATUS).map(([k, s]) => (
                      <button key={k} type="button" disabled={!canDeputy} onClick={() => set("members", f.members.map((x, j) => (j === i ? { ...x, status: k } : x)))}
                              className={`rounded-pill px-2.5 py-1 text-[11.5px] font-semibold ${m.status === k ? s.c : "border border-line bg-white text-muted"} ${canDeputy ? "" : "cursor-default opacity-80"}`}>{s.t}</button>))}</div>
                  </div>
                  {canDeputy ? <input className="field w-full py-1.5 text-sm" placeholder="ملاحظة الوكيل على المناوب (اختياري)" maxLength={200} value={m.note ?? ""}
                                      onChange={(e) => set("members", f.members.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
                    : m.note ? <p className="text-[12.5px] text-muted">ملاحظة: {m.note}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[["start_note", "بداية اليوم", "استقبال الطلاب، والبوابة، والاصطفاف"], ["end_note", "نهاية اليوم", "الانصراف، وخروج آخر طالب ووقته"]].map(([k, t, ph]) => (
              <div key={k} className="card p-4"><L>{t}</L>
                {canAny ? <textarea className="field min-h-[80px] w-full text-sm" maxLength={1000} placeholder={ph} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
                  : <p className="text-sm leading-relaxed text-muted">{f[k] || "—"}</p>}
              </div>))}
          </div>

          <div className="card space-y-2 p-4">
            <L>الطلاب المتأخرون في الانصراف <span className="text-[11.5px] font-normal text-muted">· يصل ولي الأمر تنبيه في حسابه بالبوابة عند الاعتماد</span></L>
            {f.lates.map((x, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-sm2 bg-canvas px-3 py-2 text-[13px]">
                <b className="text-ink">{x.name}</b><span className="num text-muted">{x.class_no}</span>
                {x.time && <span dir="rtl" className="chip whitespace-nowrap bg-late/10 text-late">{x.time}</span>}
                <span className="min-w-0 flex-1 text-muted">{x.reason || "—"}</span>
                {x.added_by_name && <span className="text-[11px] text-faint">أضافه: {short(x.added_by_name)}</span>}
                {mineItem(x) && <button className="text-[12px] text-absent" onClick={() => set("lates", f.lates.filter((_, j) => j !== i))}>حذف</button>}
              </div>))}
            {canAny && (
              <div className="grid gap-2 sm:grid-cols-[1fr_190px]">
                <StudentPick onPick={(s) => { set("lates", [...f.lates, { ...s, kind: "pickup", time: t12(late.time), reason: late.reason, ...by() }]); setLate({ kind: "pickup", time: late.time, reason: "" }); }} />
                <label className="flex items-center gap-1.5 text-[12px] text-muted"><span className="shrink-0">وقت المغادرة</span>
                  <input type="time" className="field w-full py-1.5 text-sm" step={60} value={late.time} onChange={(e) => setLate({ ...late, time: e.target.value })} /></label>
                <input className="field py-1.5 text-sm sm:col-span-2" placeholder="سبب التأخر (يُكتب مع الوقت قبل اختيار الطالب)" maxLength={160} value={late.reason} onChange={(e) => setLate({ ...late, reason: e.target.value })} />
              </div>)}
          </div>

          <div className="card space-y-2 p-4">
            <L>المواقف والملاحظات على الطلاب</L>
            {f.incidents.map((x, i) => (
              <div key={i} className="flex flex-wrap items-start gap-2 rounded-sm2 bg-canvas px-3 py-2 text-[13px]">
                <b className="text-ink">{x.name}</b><span className="num text-muted">{x.class_no}</span><span className="min-w-0 flex-1 text-muted">{x.text}</span>
                {x.added_by_name && <span className="text-[11px] text-faint">أضافه: {short(x.added_by_name)}</span>}
                {mineItem(x) && <button className="text-[12px] text-absent" onClick={() => set("incidents", f.incidents.filter((_, j) => j !== i))}>حذف</button>}
              </div>))}
            {canAny && (
              <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
                <input className="field py-1.5 text-sm" placeholder="الموقف أو الملاحظة (يُكتب أولًا)" maxLength={300} value={inc} onChange={(e) => setInc(e.target.value)} />
                <StudentPick onPick={(s) => { if (!inc.trim()) { setMsg({ ok: false, text: "اكتب الموقف أولًا ثم اختر الطالب." }); return; } set("incidents", [...f.incidents, { ...s, text: inc.trim(), ...by() }]); setInc(""); }} />
              </div>)}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card space-y-3 p-4"><L>ملاحظات المناوبين <span className="text-[11.5px] font-normal text-muted">· كلٌّ يكتب ملاحظاته ويرى ملاحظات زميله</span></L>
              {f.members.map((m) => {
                const key = m.user_id ?? m.name, val = f.person_notes?.[key] ?? "";
                const edit = (canDuty && m.user_id === uid) || canDeputy;
                return (
                  <div key={key}>
                    <p className="mb-1 text-[12px] font-semibold text-muted">{m.name}{m.user_id === uid ? " (أنت)" : ""}</p>
                    {edit ? <textarea className="field min-h-[60px] w-full text-sm" maxLength={1500} value={val}
                                      onChange={(e) => set("person_notes", { ...(f.person_notes ?? {}), [key]: e.target.value })} />
                      : <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">{val || "—"}</p>}
                  </div>
                );
              })}
              {f.duty_note && <p className="text-[12px] text-muted">ملاحظات سابقة: {f.duty_note}</p>}
            </div>
            <div className="card p-4"><L>ملاحظات الوكيل</L>
              {canDeputy ? <textarea className="field min-h-[70px] w-full text-sm" maxLength={1500} value={f.deputy_note ?? ""} onChange={(e) => set("deputy_note", e.target.value)} />
                : <p className="text-sm text-muted">{f.deputy_note || "—"}</p>}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canDuty && !approver && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("draft")}>حفظ</button>}
            {canDuty && !approver && <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("submitted")}>رفع للوكيل</button>}
            {canDeputy && st !== "approved" && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save(st)}>حفظ</button>}
            {canDeputy && st !== "approved" && <button className="btn-primary px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("approved")}>اعتماد</button>}
            {st === "approved" && editor && <button className="btn-ghost px-4 py-1.5 text-sm" disabled={busy} onClick={() => save("submitted")}>إلغاء الاعتماد</button>}
            {st === "approved" && <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => setReport(true)}>تقرير المناوبة</button>}
          </div>
        </>
      )}

      {list.length > 0 && (
        <div className="card overflow-x-auto">
          <p className="px-4 pt-3 text-sm font-bold text-ink">{reader ? "سجلات المناوبة" : "سجلاتي في المناوبة"} <span className="text-[11.5px] font-normal text-muted">· اضغط اليوم لفتحه</span></p>
          <table className="mt-2 w-full text-sm">
            <thead className="bg-canvas text-xs text-muted"><tr>
              <th className="px-3 py-2 text-start">التاريخ</th><th className="px-3 py-2 text-start">المناوبين</th><th className="px-3 py-2 text-start">متأخرون</th>
              <th className="px-3 py-2 text-start">مواقف</th><th className="px-3 py-2 text-start">الحالة</th></tr></thead>
            <tbody className="divide-y divide-line">{list.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-canvas" onClick={() => { setDate(r.duty_date); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <td className="num px-3 py-2">{dmy(r.duty_date)}</td><td className="px-3 py-2 text-muted">{(r.members ?? []).map((m) => m.name).join(" و")}</td>
                <td className="num px-3 py-2">{(r.lates ?? []).length}</td><td className="num px-3 py-2">{(r.incidents ?? []).length}</td>
                <td className="px-3 py-2"><span className={`chip ${ST[r.status][1]}`}>{ST[r.status][0]}</span></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {!reader && mine.length > 0 && !list.length && <p className="text-[12px] text-muted">أيام مناوبتك: {mine.slice(0, 6).map(dmy).join("، ")}</p>}
    </div>
  );
}

/* تقرير المناوبة اليومية بطقم تقارير البوابة */
function DutyReport({ log, onBack }) {
  const [theme, setTheme] = useState("light");
  const [sigs, setSigs] = useState({ principal: null, stamp: null });
  useEffect(() => { Promise.all([loadPrincipalSignature(), loadSchoolStamp()]).then(([p, s]) => setSigs({ principal: p?.url ?? null, stamp: s })); }, []);
  const ms = log.members ?? [], lates = log.lates ?? [], inc = log.incidents ?? [];
  const day = DAY_NAMES[dowOf(log.duty_date)] ?? "";
  const doc = { title: "تقرير المناوبة اليومية", meta: [day, dmy(log.duty_date)], foot: "المناوبة اليومية" };
  const T = ({ head, rows }) => (
    <table className="mr-table" style={{ fontSize: 11 }}><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows}</tbody></table>);
  const pages = [
    <Page key="p" theme={theme} doc={doc} page={1} total={1} sec={{ no: 1, title: `المناوبة اليومية — ${day}`, sub: `${dmy(log.duty_date)} · المناوبين: ${ms.map((m) => m.name).join(" و")}` }}>
      <Kpis items={[
        { ic: "users", t: "المناوبين", v: ms.length, s: ms.map((m) => STATUS[m.status]?.t).join(" · ") },
        { ic: "alert", t: "متأخرون في الانصراف", v: lates.length, c: "#C08A1E" },
        { ic: "list", t: "مواقف على الطلاب", v: inc.length, c: "#A23B3B" },
        { ic: "check", t: "الاعتماد", v: "معتمد", s: log.approved_by_name, c: "#4E7D66" },
      ]} />
      <div className="mr-row c2">
        <Box icon="list" title="بداية اليوم"><p style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{log.start_note || "—"}</p></Box>
        <Box icon="list" title="نهاية اليوم"><p style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{log.end_note || "—"}</p></Box>
      </div>
      <T head={["المناوب", "الحالة", "ملاحظة الوكيل"]} rows={ms.map((m) => <tr key={m.name}><td>{m.name}</td><td style={{ color: STATUS[m.status]?.r, fontWeight: 700 }}>{STATUS[m.status]?.t}</td><td>{m.note || "—"}</td></tr>)} />
      {lates.length > 0 && <T head={["المتأخر في الانصراف", "الفصل", "وقت المغادرة", "السبب"]}
        rows={lates.map((x, i) => <tr key={i}><td>{x.name}</td><td className="num">{x.class_no}</td><td dir="rtl" style={{ whiteSpace: "nowrap" }}>{x.time || "—"}</td><td>{x.reason || "—"}</td></tr>)} />}
      {inc.length > 0 && <T head={["الطالب", "الفصل", "الموقف أو الملاحظة"]}
        rows={inc.map((x, i) => <tr key={i}><td>{x.name}</td><td className="num">{x.class_no}</td><td>{x.text}</td></tr>)} />}
      <div className="mr-row c2">
        <Box icon="list" title="ملاحظات المناوبين">
          {ms.map((m) => (
            <p key={m.name} style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 4 }}>
              <b>{short(m.name)}:</b> {log.person_notes?.[m.user_id ?? m.name] || "—"}</p>))}
          {log.duty_note && <p style={{ fontSize: 12, lineHeight: 1.8 }}>{log.duty_note}</p>}
        </Box>
        <Box icon="list" title="ملاحظات الوكيل"><p style={{ fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{log.deputy_note || "—"}</p></Box>
      </div>
      <Signs stamp={sigs.stamp} people={[{ title: "الوكيل", name: log.approved_by_name }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
  return <ReportViewer id="duty-report-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير المناوبة ${log.duty_date}`}
    controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للسجل</button>} />;
}
