// src/pages/Referrals.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { todayISO, todayDow, GRADE_NAMES } from "../lib/schoolTime";
import { currentPeriodNo, loadPeriodTimes } from "../lib/periodTimes";
import ReferralSheet, { ReferralPrintArea } from "../components/ReferralSheet.jsx";

/* =====================================================================
   إحالة الطالب — شاشة واحدة تخدم المسار كاملًا بحسب دور المستخدم:
   • المعلم: يرفع الإحالة من فصوله، وتُملأ المادة والحصة تلقائيًا.
   • وكيل شؤون الطلاب: يكتب ما عمله ويحوّلها للموجه، ثم يقفلها أو يعيدها.
   • الموجه الطلابي: يكتب إجراءه.
   • ولي الأمر: يؤكّد استلامه ويكتب ردّه.
   وكل مرحلة تُوثَّق بتوقيع صاحبها إلكترونيًا.
   ===================================================================== */

const STATUS = {
  with_deputy:           { t: "لدى وكيل شؤون الطلاب", c: "bg-warning/10 text-warning" },
  with_counselor:        { t: "لدى الموجه الطلابي",   c: "bg-mint-tint text-mint-deep" },
  returned_to_counselor: { t: "مُعادة للموجه",         c: "bg-absent/10 text-absent" },
  closed:                { t: "مُقفلة",                c: "bg-present/10 text-present" },
  with_guardian:         { t: "لدى ولي الأمر",         c: "bg-warning/10 text-warning" },
  guardian_replied:      { t: "وصل رد ولي الأمر",      c: "bg-present/10 text-present" },
  archived:              { t: "مؤرشفة",                c: "bg-canvas text-muted" },
};

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
  const [tab, setTab] = useState(isTeacher ? "new" : "inbox");
  const [msg, setMsg] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("student_referrals")
      .select("*").order("created_at", { ascending: false }).limit(200);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [uid]);

  const mine = useMemo(() => {
    const all = rows ?? [];
    if (isDeputy) return all.filter((r) => ["with_deputy", "guardian_replied"].includes(r.status));
    if (isCounselor) return all.filter(
      (r) => ["with_counselor", "returned_to_counselor"].includes(r.status) && r.counselor_id === uid);
    return all.filter((r) => r.teacher_id === uid);
  }, [rows, isDeputy, isCounselor, uid]);

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

      {tab !== "new" && (
        <div className="no-print space-y-2">
          {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
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

  const act = async (patch, okText) => {
    setBusy(true);
    const { error } = await supabase.from("student_referrals").update(patch).eq("id", r.id);
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
    }, `أُحيلت إلى ${c.name}.`);
  };

  // ③ الموجه يكتب إجراءه
  const counselorDone = async () => {
    if (!note.trim()) return;
    act({
      counselor_note: note.trim(), counselor_sig: await mySig(),
      counselor_at: new Date().toISOString(), status: "with_deputy",
    }, "أُعيدت لوكيل شؤون الطلاب.");
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

    if (ids.size) {
      const { data: nid } = await supabase.rpc("send_notification", {
        p_title: "إحالة طالب",
        p_body: `صدرت إحالة بشأن ${r.student_name} برقم ${r.serial}. افتحها من البوابة للاطّلاع` +
                ` وتأكيد الاستلام.`,
        p_kind: "general", p_link: `/referral/${r.id}`,
        p_roles: null, p_user_ids: [...ids], p_grade: null, p_class_no: null, p_is_auto: false,
      });
      if (nid) {
        try {
          await fetch("/.netlify/functions/push-send", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification_id: nid }),
          });
        } catch { /* الإشعار في البوابة وصل */ }
      }
    }
    setOpen(false);
    onChange({ ok: true, text: "أُقفلت الإحالة وأُشعر الطالب وولي أمره." });
  };

  // ④ب الوكيل يعيدها للموجه
  const returnToCounselor = async () => {
    if (!note.trim()) return;
    act({ return_note: note.trim(), status: "returned_to_counselor" }, "أُعيدت للموجه بملاحظتك.");
  };

  const st = STATUS[r.status] ?? { t: r.status, c: "" };

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
        {(isDeputy || isCounselor) && (
          <button onClick={() => { setOpen((v) => !v); setNote(""); }}
                  className="shrink-0 rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">
            {open ? "إغلاق" : "إجراء"}
          </button>
        )}
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        <span className="text-faint">السبب: </span>{r.reason}
      </p>

      {open && (
        <div className="mt-3 space-y-2 rounded-sm2 bg-mint-tint/50 p-3">
          <textarea rows={3} className="field w-full" value={note}
                    placeholder={isCounselor ? "الإجراء المتخذ والملاحظات"
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

          {isCounselor && (
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
