// src/pages/Referrals.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { todayISO, todayDow, GRADE_NAMES } from "../lib/schoolTime";
import { currentPeriodNo, loadPeriodTimes } from "../lib/periodTimes";
import ReferralSheet, { ReferralPrintArea } from "../components/ReferralSheet.jsx";
import Loader from "../components/Loader.jsx";
import { useNotice } from "../lib/useNotice.js";
import { fmtGreg } from "../lib/dates";
import {
  STATUS, OPEN_STATUSES, LATE_DAYS, stageOf, daysSince, daysLabel, isLate, timelineOf, notifyUsers,
} from "../lib/referrals";

/* =====================================================================
   إحالة الطالب — شاشة واحدة تخدم المسار كاملًا بحسب دور المستخدم:
   • المعلم: يرفع الإحالة من فصوله، وتُملأ المادة والحصة تلقائيًا.
   • وكيل شؤون الطلاب: يكتب ما عمله ويحوّلها للموجه، ثم يقفلها أو يعيدها.
   • الموجه الطلابي: يكتب إجراءه.
   • ولي الأمر: يؤكّد استلامه ويكتب ردّه.
   وتبويب «قيد المتابعة» يُري الوكيل والمدير أين وصلت كل إحالة ومنذ متى.
   وكل مرحلة تُوثَّق بتوقيع صاحبها إلكترونيًا.
   ===================================================================== */

const signedUrl = async (path) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("form-assets").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
};

export default function Referrals() {
  const { session, profile, adminRoles, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];

  const isDeputy = roles.includes("deputy_students") ||
                   roles.includes("principal") || roles.includes("tech_support");
  const isCounselor = roles.some((r) => r.startsWith("counselor"));
  const isTeacher = effectiveRole === "teacher";

  const [rows, setRows] = useState(null);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "follow" && isDeputy ? "follow" : isTeacher ? "new" : "inbox");
  const [msg, setMsg] = useNotice(null);
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("student_referrals")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [uid]);

  const mine = useMemo(() => {
    const all = rows ?? [];
    // من جمع الدورين يرى وارد الاثنين
    if (isDeputy || isCounselor) return all.filter((r) =>
      (isDeputy && ["with_deputy", "guardian_replied"].includes(r.status)) ||
      (isCounselor && ["with_counselor", "returned_to_counselor"].includes(r.status) &&
       r.counselor_id === uid));
    return all.filter((r) => r.teacher_id === uid);
  }, [rows, isDeputy, isCounselor, uid]);

  // كل ما لم يُنهَ، الأقدم في مرحلته أولًا
  const following = useMemo(() =>
    (rows ?? []).filter((r) => OPEN_STATUSES.includes(r.status))
      .sort((a, b) => new Date(stageOf(a).since) - new Date(stageOf(b).since)),
  [rows]);

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div className="no-print">
        <h1 className="text-lg font-bold text-ink">إحالة الطالب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ملف واحد يوثّق مسار الإحالة كاملًا: المعلم، فوكيل شؤون الطلاب، فالموجه الطلابي،
          ثم إشعار الطالب وولي أمره.
        </p>
      </div>

      <div className="no-print flex flex-wrap gap-1.5">
        {isTeacher && (
          <button className={pill(tab === "new")} onClick={() => setTab("new")}>إحالة جديدة</button>
        )}
        <button className={pill(tab === "inbox")} onClick={() => setTab("inbox")}>
          {isDeputy || isCounselor ? "الواردة إليّ" : "إحالاتي"}
          {mine.length > 0 && <span className="num"> ({mine.length})</span>}
        </button>
        {isDeputy && (
          <button className={pill(tab === "follow")} onClick={() => setTab("follow")}>
            قيد المتابعة
            {following.length > 0 && <span className="num"> ({following.length})</span>}
          </button>
        )}
        <button className={pill(tab === "all")} onClick={() => setTab("all")}>السجل</button>
      </div>

      {msg && (
        <p className={`no-print rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {tab === "new" && isTeacher && (
        <NewReferral uid={uid} profile={profile} onDone={(t) => { setMsg(t); setTab("inbox"); load(); }} />
      )}

      {tab === "follow" && isDeputy && (
        <FollowUp list={following} rows={rows} uid={uid} profile={profile} roles={roles}
                  isDeputy={isDeputy} isCounselor={isCounselor}
                  onOpen={setViewing} onChange={(t) => { setMsg(t); load(); }} />
      )}

      {(tab === "inbox" || tab === "all") && (
        <div className="no-print space-y-2">
          {!rows && <Loader compact />}
          {(tab === "inbox" ? mine : rows ?? []).length === 0 && rows && (
            <p className="card px-4 py-6 text-sm text-muted">لا إحالات هنا.</p>
          )}
          {(tab === "inbox" ? mine : rows ?? []).map((r) => (
            <ReferralRow key={r.id} r={r} uid={uid} profile={profile} roles={roles}
                         isDeputy={isDeputy} isCounselor={isCounselor}
                         onOpen={setViewing} onChange={(t) => { setMsg(t); load(); }} />
          ))}
        </div>
      )}

      {viewing && (
        <SheetModal r={viewing} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}

/* ------------------------- إحالة جديدة (المعلم) ------------------------- */
function NewReferral({ uid, profile, onDone }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState("");
  const [ctx, setCtx] = useState({ subject: "", period: null, className: "", grade: null });
  const [reasons, setReasons] = useState([]);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState("");
  const [sig, setSig] = useState(null);
  const [busy, setBusy] = useState(false);

  // فصول المعلم اليوم مع مادته وحصته
  useEffect(() => {
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term", "referral_reasons"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      setReasons((m.referral_reasons ?? "").split("|").filter(Boolean));

      const { data: t } = await supabase.from("teachers")
        .select("id").eq("user_id", uid).maybeSingle();
      if (!t) return;

      const { data: sch } = await supabase.from("schedule")
        .select("id, period_no, day_of_week, class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1))
        .order("period_no");

      // فصول اليوم أولًا، ثم بقية فصوله
      const dow = todayDow();
      const today = (sch ?? []).filter((x) => x.day_of_week === dow);
      const seen = new Set();
      const list = [...today, ...(sch ?? [])].filter((x) => {
        if (seen.has(x.class_id)) return false;
        seen.add(x.class_id); return true;
      });
      setClasses(list);

      // الحصة الجارية تُحدّد الفصل تلقائيًا
      const { rows: pt } = await loadPeriodTimes();
      const now = currentPeriodNo(pt);
      const auto = today.find((x) => x.period_no === now) ?? today[0] ?? list[0];
      if (auto) pickClass(auto, list);

      const { data: s } = await supabase.from("user_signatures")
        .select("path").eq("user_id", uid).maybeSingle();
      setSig(s?.path ?? null);
    })();
  }, [uid]);

  const pickClass = async (row, list) => {
    setClassId(row.class_id);
    setCtx({
      subject: row.subjects?.name ?? "",
      period: row.period_no ?? null,
      className: row.classes?.class_no ?? "",
      grade: row.classes?.grade ?? null,
    });
    const { data } = await supabase.from("student_enrollment")
      .select("students(id, full_name)").eq("class_id", row.class_id).eq("status", "active");
    setStudents((data ?? []).map((e) => e.students).filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    setStudentId("");
  };

  const submit = async () => {
    if (!studentId || !reason.trim()) return;
    setBusy(true);
    const student = students.find((s) => s.id === studentId);
    const { data: serial } = await supabase.rpc("next_referral_serial");

    const { error } = await supabase.from("student_referrals").insert({
      serial,
      student_id: studentId,
      student_name: student?.full_name ?? "",
      class_label: `${GRADE_NAMES[ctx.grade] ?? ""} — فصل ${ctx.className}`.trim(),
      grade: ctx.grade ?? null,
      teacher_id: uid,
      teacher_name: profile?.full_name ?? "",
      subject: ctx.subject,
      period_no: ctx.period,
      referral_date: todayISO(),
      reason: reason.trim(),
      done_in_class: done.trim() || null,
      teacher_sig: sig,
      status: "with_deputy",
    });
    setBusy(false);
    onDone(error ? { ok: false, text: error.message }
                 : { ok: true, text: `أُرسلت الإحالة ${serial} لوكيل شؤون الطلاب.` });
  };

  return (
    <section className="card space-y-4 p-4">
      <div>
        <label className="text-xs text-muted">الفصل</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <button key={c.class_id} type="button" onClick={() => pickClass(c, classes)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                classId === c.class_id ? "bg-mint-deep text-white"
                                       : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              فصل {c.classes?.class_no}
              <span className="text-[11px] opacity-75"> · {c.subjects?.name}</span>
            </button>
          ))}
          {classes.length === 0 && <p className="text-sm text-muted">لا فصول مسندة إليك.</p>}
        </div>
      </div>

      {classId && (
        <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs text-mint-deep">
          {ctx.subject} · الحصة <span className="num">{ctx.period ?? "—"}</span> ·{" "}
          {GRADE_NAMES[ctx.grade] ?? ""} فصل <span className="num">{ctx.className}</span>
        </p>
      )}

      <div>
        <label className="text-xs text-muted">الطالب</label>
        <select className="field mt-1 w-full" value={studentId}
                onChange={(e) => setStudentId(e.target.value)}>
          <option value="">اختر الطالب…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      <div>
        <label className="text-xs text-muted">سبب التحويل</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {reasons.map((t) => (
            <button key={t} type="button" onClick={() => setReason(t)}
                    className="rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1 text-[11.5px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
              {t}
            </button>
          ))}
        </div>
        <textarea rows={2} className="field mt-1.5 w-full" value={reason}
                  placeholder="اختر صيغة أو اكتب السبب"
                  onChange={(e) => setReason(e.target.value)} />
      </div>

      <div>
        <label className="text-xs text-muted">ما تم عمله بخصوص المشكلة</label>
        <textarea rows={3} className="field mt-1 w-full" value={done}
                  onChange={(e) => setDone(e.target.value)} />
      </div>

      {!sig && (
        <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
          لم ترفع توقيعك بعد. يمكنك الإرسال، ويفضّل رفعه من صفحة «توقيعي».
        </p>
      )}

      <button className="btn-primary w-full" disabled={!studentId || !reason.trim() || busy}
              onClick={submit}>
        {busy ? "جارٍ الإرسال…" : "رفع الإحالة"}
      </button>
    </section>
  );
}

/* ------------------ قيد المتابعة (الوكيل والمدير) ------------------ */
const GROUPS = [
  { k: "all",       t: "الكل" },
  { k: "late",      t: "المتأخرة" },
  { k: "deputy",    t: "عند الوكيل" },
  { k: "counselor", t: "عند الموجهين" },
  { k: "guardian",  t: "عند ولي الأمر" },
];

function FollowUp({ list, rows, onOpen, onChange, ...rowProps }) {
  const [g, setG] = useState("all");

  const count = (k) => k === "all" ? list.length
    : k === "late" ? list.filter(isLate).length
    : list.filter((r) => stageOf(r).group === k).length;

  const shown = g === "all" ? list
    : g === "late" ? list.filter(isLate)
    : list.filter((r) => stageOf(r).group === g);

  // حِمل كل موجه: ما عنده الآن وكم تأخر منه
  const byCounselor = useMemo(() => {
    const m = new Map();
    list.filter((r) => stageOf(r).group === "counselor").forEach((r) => {
      const k = r.counselor_name || "—";
      const v = m.get(k) ?? { n: 0, late: 0 };
      v.n += 1; if (isLate(r)) v.late += 1;
      m.set(k, v);
    });
    return [...m.entries()];
  }, [list]);

  if (!rows) return <Loader compact />;

  return (
    <div className="no-print space-y-3">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {GROUPS.slice(1).map((x) => (
          <button key={x.k} onClick={() => setG(x.k)}
                  className={`card p-3 text-right transition-colors ${
                    g === x.k ? "ring-2 ring-mint-deep" : "hover:bg-canvas"}`}>
            <p className="text-xs text-muted">{x.t}</p>
            <p className={`num mt-1 text-2xl font-bold ${
              x.k === "late" && count("late") ? "text-absent" : "text-ink"}`}>{count(x.k)}</p>
          </button>
        ))}
      </section>

      {byCounselor.length > 0 && (
        <p className="text-xs leading-relaxed text-muted">
          <span className="text-faint">عند الموجهين: </span>
          {byCounselor.map(([name, v], i) => (
            <span key={name}>
              {i > 0 && " · "}
              {name} <span className="num">{v.n}</span>
              {v.late > 0 && <span className="text-absent"> (<span className="num">{v.late}</span> متأخرة)</span>}
            </span>
          ))}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((x) => (
          <button key={x.k} onClick={() => setG(x.k)}
                  className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                    g === x.k ? "bg-ink text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {x.t} <span className="num">({count(x.k)})</span>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-faint">
        الأقدم في مرحلته أولًا. تُعدّ متأخرة إن بقيت في مرحلتها أكثر من <span className="num">{LATE_DAYS}</span> أيام.
      </p>

      {shown.length === 0 && <p className="card px-4 py-6 text-sm text-muted">لا إحالات هنا.</p>}
      {shown.map((r) => (
        <ReferralRow key={r.id} r={r} {...rowProps} onOpen={onOpen} onChange={onChange} />
      ))}
    </div>
  );
}

/* --------------------------- صف الإحالة --------------------------- */
function ReferralRow({ r, uid, profile, roles, isDeputy, isCounselor, onOpen, onChange }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [counselor, setCounselor] = useState("");
  const [counselors, setCounselors] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !isDeputy || counselors.length) return;
    (async () => {
      const { data } = await supabase.from("admin_roles")
        .select("user_id, role_type, users(full_name)")
        .in("role_type", ["counselor_1", "counselor_2", "counselor_3"]);

      const list = (data ?? []).map((x) => ({
        id: x.user_id,
        name: x.users?.full_name ?? "",
        role: ADMIN_ROLE_LABEL[x.role_type] ?? x.role_type,
        grade: Number(String(x.role_type).replace(/\D/g, "")) || null,
      }));
      setCounselors(list);

      // الإسناد الآلي بحسب صف الطالب: الأول ← موجه 1، والثاني ← 2، والثالث ← 3
      const auto = list.find((c) => c.grade === r.grade);
      if (auto) setCounselor(auto.id);
    })();
  }, [open, isDeputy, counselors.length, r.grade]);

  const mySig = async () => {
    const { data } = await supabase.from("user_signatures")
      .select("path").eq("user_id", uid).maybeSingle();
    return data?.path ?? null;
  };

  const act = async (patch, okText, after) => {
    setBusy(true);
    const { error } = await supabase.from("student_referrals").update(patch).eq("id", r.id);
    if (!error && after) await after();
    setBusy(false);
    setOpen(false);
    onChange(error ? { ok: false, text: error.message } : { ok: true, text: okText });
  };

  // ② الوكيل يحوّلها للموجه
  const toCounselor = async () => {
    if (!counselor || !note.trim()) return;
    const c = counselors.find((x) => x.id === counselor);
    act({
      deputy_id: uid, deputy_name: profile?.full_name ?? "",
      deputy_note: note.trim(), deputy_sig: await mySig(), deputy_at: new Date().toISOString(),
      counselor_id: c.id, counselor_name: c.name,
      status: "with_counselor", return_note: null,
    }, `أُحيلت إلى ${c.name} وأُشعر بها.`,
    () => notifyUsers([c.id], "إحالة طالب جديدة",
      `أحال إليك وكيل شؤون الطلاب إحالة ${r.student_name} برقم ${r.serial}.`, "/referrals"));
  };

  // ③ الموجه يكتب إجراءه
  const counselorDone = async () => {
    if (!note.trim()) return;
    act({
      counselor_note: note.trim(), counselor_sig: await mySig(),
      counselor_at: new Date().toISOString(), status: "with_deputy",
    }, "أُعيدت لوكيل شؤون الطلاب.",
    () => notifyUsers([r.deputy_id], "إجراء الموجه على إحالة",
      `كتب الموجه الطلابي إجراءه في إحالة ${r.student_name} (${r.serial}) وهي بانتظار اعتمادك.`,
      "/referrals"));
  };

  // ④ الوكيل يقفلها ويُشعر ولي الأمر
  const close = async () => {
    const patch = {
      close_note: note.trim() || "اعتُمد الإجراء وأُقفلت الإحالة.",
      closed_at: new Date().toISOString(),
      status: "with_guardian",
    };
    const { error } = await supabase.from("student_referrals").update(patch).eq("id", r.id);
    if (error) { onChange({ ok: false, text: error.message }); return; }

    // إشعار الطالب وولي أمره
    const ids = new Set();
    const { data: s } = await supabase.from("students")
      .select("user_id").eq("id", r.student_id).maybeSingle();
    if (s?.user_id) ids.add(s.user_id);
    const { data: gs } = await supabase.from("guardian_student")
      .select("guardians(user_id)").eq("student_id", r.student_id);
    (gs ?? []).forEach((g) => { if (g.guardians?.user_id) ids.add(g.guardians.user_id); });

    await notifyUsers([...ids], "إحالة طالب",
      `صدرت إحالة بشأن ${r.student_name} برقم ${r.serial}. افتحها من البوابة للاطّلاع` +
      ` وتأكيد الاستلام.`, `/referral/${r.id}`);
    setOpen(false);
    onChange({ ok: true, text: "أُقفلت الإحالة وأُشعر الطالب وولي أمره." });
  };

  // ④ب الوكيل يعيدها للموجه
  const returnToCounselor = async () => {
    if (!note.trim()) return;
    act({ return_note: note.trim(), status: "returned_to_counselor" }, "أُعيدت للموجه بملاحظتك.",
      () => notifyUsers([r.counselor_id], "إحالة مُعادة إليك",
        `أعاد وكيل شؤون الطلاب إحالة ${r.student_name} (${r.serial}) بملاحظة.`, "/referrals"));
  };

  // ⑤ بعد رد ولي الأمر: تنتهي المتابعة وتُحفظ في السجل
  const archive = async () => {
    act({ status: "archived" }, "انتهت متابعة الإحالة وحُفظت في السجل.");
  };

  const st = STATUS[r.status] ?? { t: r.status, c: "" };
  const counselorTurn = isCounselor && r.counselor_id === uid &&
    ["with_counselor", "returned_to_counselor"].includes(r.status);
  const deputyTurn = isDeputy && ["with_deputy", "guardian_replied"].includes(r.status);
  const stage = stageOf(r);
  const days = daysSince(stage.since);
  const late = isLate(r);

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{r.student_name}</p>
          <p className="num mt-0.5 text-xs text-faint">
            {r.serial} · {r.class_label} · {r.subject}
            {r.period_no ? ` · الحصة ${r.period_no}` : ""}
          </p>
        </div>
        <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>
        <button onClick={() => onOpen(r)}
                className="shrink-0 rounded-pill border border-line px-3 py-1 text-xs text-muted hover:bg-canvas">
          الملف
        </button>
        {(deputyTurn || counselorTurn) && (
          <button onClick={() => { setOpen((v) => !v); setNote(""); }}
                  className="shrink-0 rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">
            {open ? "إغلاق" : "إجراء"}
          </button>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        <span className="text-faint">السبب: </span>{r.reason}
      </p>

      {stage.group !== "done" && (
        <p className={`mt-1.5 text-xs ${late ? "font-semibold text-absent" : "text-muted"}`}>
          عند {stage.who} {daysLabel(days)} — {stage.what}
          {late && " · متأخرة"}
        </p>
      )}

      <Timeline r={r} />

      {open && (
        <div className="mt-3 space-y-2 rounded-sm2 bg-mint-tint/50 p-3">
          <textarea rows={3} className="field w-full" value={note}
                    placeholder={counselorTurn ? "الإجراء المتخذ والملاحظات"
                                             : "ما تم عمله والملاحظات"}
                    onChange={(e) => setNote(e.target.value)} />

          {isDeputy && r.status === "with_deputy" && !r.counselor_id && (
            <>
              <div>
                <p className="mb-1 text-[11px] text-muted">
                  الموجه المسند لصف الطالب — يمكن تغييره عند الحاجة
                </p>
                <select className="field w-full" value={counselor}
                        onChange={(e) => setCounselor(e.target.value)}>
                  <option value="">اختر الموجه الطلابي…</option>
                  {counselors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.role}
                      {c.grade === r.grade ? " (موجه الصف)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full" disabled={busy || !counselor || !note.trim()}
                      onClick={toCounselor}>
                تحويل للموجه الطلابي
              </button>
            </>
          )}

          {counselorTurn && (
            <button className="btn-primary w-full" disabled={busy || !note.trim()}
                    onClick={counselorDone}>
              حفظ الإجراء وإعادتها للوكيل
            </button>
          )}

          {isDeputy && r.counselor_id && r.status === "with_deputy" && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary flex-1" disabled={busy} onClick={close}>
                اعتماد وإقفال وإشعار ولي الأمر
              </button>
              <button disabled={busy || !note.trim()} onClick={returnToCounselor}
                      className="flex-1 rounded-pill border border-warning/40 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/5">
                إعادة للموجه
              </button>
            </div>
          )}

          {isDeputy && r.status === "guardian_replied" && (
            <button className="btn-primary w-full" disabled={busy} onClick={archive}>
              إنهاء المتابعة وحفظها في السجل
            </button>
          )}
        </div>
      )}

      {r.guardian_note && (
        <p className="mt-2 rounded-sm2 bg-present/5 px-3 py-2 text-xs leading-relaxed text-ink">
          <span className="font-semibold text-present">رد ولي الأمر: </span>{r.guardian_note}
        </p>
      )}
    </div>
  );
}

/* --------------------------- مسار الإحالة --------------------------- */
function Timeline({ r }) {
  const steps = timelineOf(r);
  const next = steps.findIndex((x) => !x.at);
  return (
    <ol className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px]">
      {steps.map((x, i) => {
        const done = Boolean(x.at);
        const current = i === next && !["closed", "archived"].includes(r.status);
        return (
          <li key={x.t} className="flex items-center gap-1">
            {i > 0 && <span className="text-faint">←</span>}
            <span title={x.who || undefined}
                  className={`rounded-pill px-2 py-0.5 ${
                    done ? "bg-present/10 text-present"
                    : current ? "bg-warning/10 font-semibold text-warning"
                    : "bg-canvas text-faint"}`}>
              {x.t}
              {done && <span className="num"> {fmtGreg(x.at)}</span>}
            </span>
          </li>
        );
      })}
      {r.return_note && ["returned_to_counselor"].includes(r.status) && (
        <li className="rounded-pill bg-absent/10 px-2 py-0.5 text-absent">أُعيدت للموجه</li>
      )}
    </ol>
  );
}

/* --------------------------- عرض الملف --------------------------- */
function SheetModal({ r, onClose }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [stamp, setStamp] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_assets")
        .select("path").eq("key", "stamp").maybeSingle();
      setStamp(await signedUrl(data?.path));
    })();
  }, []);

  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4">
      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-3 flex justify-between gap-2">
          <button onClick={onClose}
                  className="rounded-pill bg-white px-4 py-1.5 text-sm font-medium text-muted">
            إغلاق
          </button>
          <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
        </div>

        <div ref={box} className="no-print overflow-hidden rounded-card bg-white">
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top right",
                        width: 794, height: 1123 * scale }}>
            <ReferralSheet r={r} stampUrl={stamp} />
          </div>
        </div>

        <div className="hidden print:block">
          <ReferralPrintArea>
            <ReferralSheet r={r} stampUrl={stamp} />
          </ReferralPrintArea>
        </div>
      </div>
    </div>
  );
}
