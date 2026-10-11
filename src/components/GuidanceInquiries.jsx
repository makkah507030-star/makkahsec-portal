// src/components/GuidanceInquiries.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";
import { refreshNavBadges } from "../lib/navBadges.js";
import { FLAGS, FLAG_ORDER, STATUS, isSetupErr, setupMsg } from "../lib/guidanceInquiry";
import Loader from "./Loader.jsx";

/* =====================================================================
   تبويب «استمارات المستوى» في التوجيه الطلابي: قائمة استمارات الصف ومراحلها،
   واستمارة جديدة: الفصل ثم الطالب، فيظهر معلموه من الجدول الدراسي، والملصق.
   ===================================================================== */

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function GuidanceInquiries({ grade }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    setRows(null);
    supabase.from("guidance_inquiries")
      .select("id, student_name, class_label, flag, status, created_at, sent_at, guardian_seen_at, guidance_inquiry_items(filled_at, teacher_user_id)")
      .eq("grade", grade).order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setErr(isSetupErr(error) ? setupMsg : error.message); setRows(data ?? []); });
  }, [grade]);

  if (err) return <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>;
  if (!rows) return <Loader />;

  const open = rows.filter((r) => r.status !== "sent");
  const list = (filter === "open" ? open : rows.filter((r) => r.status === "sent"))
    .slice().sort((a, b) => rank(a) - rank(b));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={pill(filter === "open")} onClick={() => setFilter("open")}>قيد الإجراء <span className="num">({open.length})</span></button>
        <button className={pill(filter === "sent")} onClick={() => setFilter("sent")}>أُرسلت لولي الأمر <span className="num">({rows.length - open.length})</span></button>
        {!creating && <button className="btn-primary mr-auto px-4 py-1.5 text-xs" onClick={() => setCreating(true)}>+ استمارة مستوى جديدة</button>}
      </div>
      <p className="text-xs text-muted">تصل الاستمارة لمعلمي الطالب فيعبّئ كل معلم مادته، ثم تكتب رأيك وترسلها للوكيل، فتعود إليك لترسل نسخة لولي الأمر.</p>

      {creating && <NewInquiry grade={grade} onClose={() => setCreating(false)} />}

      {list.length === 0 ? <p className="card px-4 py-6 text-center text-sm text-muted">لا استمارات.</p> : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((r) => {
            const its = r.guidance_inquiry_items ?? [];
            const withAcc = its.filter((x) => x.teacher_user_id);
            return (
              <Link key={r.id} to={`/inquiry/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.student_name}</p>
                  <p className="truncate text-xs text-muted">{r.class_label} · <span className="num">{fmtDate(r.created_at)}</span>
                    {r.status === "teachers" && <> · عبّأ <span className="num">{withAcc.filter((x) => x.filled_at).length}/{withAcc.length}</span></>}
                    {r.status === "sent" && (r.guardian_seen_at ? " · اطّلع ولي الأمر" : " · لم يطّلع ولي الأمر")}
                  </p>
                </div>
                {FLAGS[r.flag] && <span className={`chip shrink-0 ${FLAGS[r.flag].c}`}>{FLAGS[r.flag].t}</span>}
                <span className={`chip shrink-0 ${STATUS[r.status].c}`}>{STATUS[r.status].t}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

const rank = (r) => { const i = FLAG_ORDER.indexOf(r.flag); return i < 0 ? 9 : i; };

function NewInquiry({ grade, onClose }) {
  const navigate = useNavigate();
  const [students, setStudents] = useState(null);
  const [classNo, setClassNo] = useState("");
  const [studentId, setStudentId] = useState("");
  const [teachers, setTeachers] = useState(null);   // [{ subject, teacher_id, teacher_name, has_account, on }]
  const [flag, setFlag] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("v_active_students").select("student_id, full_name, class_no").eq("grade", grade)
      .order("full_name").then(({ data }) => setStudents(data ?? []));
  }, [grade]);

  const classes = useMemo(() => [...new Set((students ?? []).map((s) => s.class_no))].sort((a, b) => a - b), [students]);
  const inClass = (students ?? []).filter((s) => String(s.class_no) === classNo);

  useEffect(() => {
    setTeachers(null); setErr("");
    if (!studentId) return;
    supabase.rpc("guidance_class_teachers", { p_student: studentId }).then(({ data, error }) => {
      if (error) { setErr(isSetupErr(error) ? setupMsg : error.message); return; }
      setTeachers((data ?? []).map((t) => ({ ...t, on: true })));
    });
  }, [studentId]);

  const chosen = (teachers ?? []).filter((t) => t.on);
  const send = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("guidance_inquiry_create", {
      p_student: studentId, p_flag: flag,
      p_items: chosen.map((t) => ({ subject: t.subject, teacher_id: t.teacher_id })),
    });
    setBusy(false);
    if (error) { setErr(isSetupErr(error) ? setupMsg : error.message); return; }
    refreshNavBadges(true);
    navigate(`/inquiry/${data}`);
  };

  return (
    <section className="card space-y-3 border-mint-deep/40 p-4">
      <p className="font-semibold text-ink">استمارة توضيح مستوى الطالب التحصيلي والسلوكي</p>
      {!students ? <Loader /> : (
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
          <select className="field" value={classNo} onChange={(e) => { setClassNo(e.target.value); setStudentId(""); }}>
            <option value="">الفصل</option>
            {classes.map((c) => <option key={c} value={c}>فصل {c}</option>)}
          </select>
          <select className="field" value={studentId} disabled={!classNo} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">الطالب</option>
            {inClass.map((s) => <option key={s.student_id} value={s.student_id}>{s.full_name}</option>)}
          </select>
        </div>
      )}

      {studentId && !teachers && !err && <Loader />}
      {teachers && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">معلمو الطالب من الجدول الدراسي — ألغِ من لا تريد إرسالها له</p>
          {teachers.length === 0 ? <p className="text-xs text-absent">لا جدول دراسي لفصل الطالب في الفصل الدراسي النشط.</p> : (
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {teachers.map((t, i) => (
                <li key={`${t.subject}-${t.teacher_id}`}>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-sm2 border px-3 py-2 text-sm ${t.on ? "border-mint-deep/50 bg-mint-tint" : "border-line bg-white"}`}>
                    <input type="checkbox" checked={t.on}
                           onChange={() => setTeachers((ts) => ts.map((x, j) => j === i ? { ...x, on: !x.on } : x))} />
                    <span className="min-w-0 flex-1 truncate"><b className="text-ink">{t.subject}</b>
                      <span className="text-xs text-muted"> · {t.teacher_name}</span></span>
                    {!t.has_account && <span className="shrink-0 text-[11px] text-faint">لا حساب له</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {teachers?.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">الملصق (يظهر للمعلمين والوكيل)</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={pill(!flag)} onClick={() => setFlag(null)}>بلا ملصق</button>
            {Object.entries(FLAGS).map(([k, f]) => (
              <button key={k} type="button" onClick={() => setFlag(k)}
                      className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold ${flag === k ? f.c : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                {f.t}
              </button>
            ))}
          </div>
        </div>
      )}

      {err && <p className="text-xs text-absent">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !chosen.length} onClick={send}>
          {busy ? "جارٍ الإرسال…" : `إرسال للمعلمين${chosen.length ? ` (${chosen.length})` : ""}`}
        </button>
        <button className="btn-ghost" onClick={onClose}>إلغاء</button>
      </div>
    </section>
  );
}
