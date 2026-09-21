import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayDow, todayISO, todayLabel, GRADE_NAMES, STATUS } from "../../lib/schoolTime";
import {
  loadPeriodTimes, byPeriodNo, currentPeriodNo, fmtRange, toMinutes, nowMinutes,
} from "../../lib/periodTimes";

const TEACHER_ORDER = ["present", "absent", "late"];
const SOLID = {
  present: "bg-present text-white font-semibold",
  absent:  "bg-absent text-white font-semibold",
  late:    "bg-late text-white font-semibold",
};

// مهلة سماح (بالدقائق) قبل ظهور الفصل في قائمة الانتظار — لإعطاء المعلم
// الأصلي فرصة كافية لتحضير حصته بنفسه قبل أن يظهر الفصل متاحًا لغيره
const GRACE_MINUTES = 10;

export default function SubstitutePeriod() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [year, setYear] = useState("");
  const [term, setTerm] = useState(null);
  const [ptimes, setPtimes] = useState([]);
  const [nowPeriod, setNowPeriod] = useState(null);
  const [candidates, setCandidates] = useState(null); // null = جارٍ التحميل
  const [selected, setSelected] = useState(null); // صف الجدول المختار للتغطية
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [excused, setExcused] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const date = todayISO();
  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const { rows } = await loadPeriodTimes();
      setPtimes(rows);
      setNowPeriod(currentPeriodNo(rows));
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      setYear(m.active_year ?? "");
      setTerm(Number(m.active_term ?? 1));

      const { data: t0 } = await supabase.from("teachers")
        .select("id, full_name, specialization").eq("user_id", uid).maybeSingle();
      setMe(t0 ?? null);
      setLoading(false);
    })();
  }, [session]);

  const loadCandidates = async () => {
    if (!me || !dow || nowPeriod == null || !year) { setCandidates([]); return; }
    setCandidates(null);
    const { data: sched } = await supabase.from("schedule")
      .select("id, teacher_id, class_id, classes(class_no, grade), subjects(name), teachers(full_name)")
      .eq("academic_year", year).eq("term", term).eq("day_of_week", dow).eq("period_no", nowPeriod);

    const list = (sched ?? []).filter((s) => s.teacher_id !== me.id);
    if (!list.length) { setCandidates([]); return; }

    const { data: done } = await supabase.from("class_attendance")
      .select("schedule_id").eq("attend_date", date)
      .in("schedule_id", list.map((s) => s.id));
    const doneSet = new Set((done ?? []).map((r) => r.schedule_id));

    setCandidates(list.filter((s) => !doneSet.has(s.id)));
  };

  useEffect(() => { loadCandidates(); }, [me, dow, nowPeriod, year, term]);

  const openRoster = async (sched) => {
    setMsg(null);
    // تحقّق أخير قبل الفتح تفاديًا لتعارض مع معلم انتظار آخر أسرع
    const { count } = await supabase.from("class_attendance")
      .select("id", { count: "exact", head: true })
      .eq("schedule_id", sched.id).eq("attend_date", date);
    if (count > 0) {
      setMsg({ ok: false, text: "سبقك معلم آخر لتحضير هذا الفصل." });
      await loadCandidates();
      return;
    }

    // ملاحظة: الفصل هنا يخصّ معلمًا آخر (المعلم الغائب)، وسياسات RLS تقصر
    // قراءة الطلاب على فصول المعلم نفسه — لذلك لا تُرجع قائمة عادية أي طلاب
    // (كانت تظهر «لا طلاب في هذا الفصل»). نستخدم دالة آمنة تُرجع كشف الفصل
    // وتتجاوز RLS، مع بيان حالة الاستئذان لكل طالب لهذا اليوم.
    const { data: roster, error: rErr } = await supabase.rpc("substitute_roster", {
      p_schedule_id: sched.id,
      p_date: date,
    });
    if (rErr) {
      setMsg({ ok: false, text: "تعذّر تحميل كشف الفصل: " + rErr.message });
      return;
    }
    const list = (roster ?? [])
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    setStudents(list);

    const excSet = new Set(list.filter((s) => s.is_excused).map((s) => s.id));
    setExcused(excSet);

    const init = {};
    list.forEach((s) => { init[s.id] = excSet.has(s.id) ? "excused" : "present"; });
    setMarks(init);
    setSelected(sched);
  };

  const save = async () => {
    if (!selected || !me) return;
    setSaving(true); setMsg(null);

    // تثبيت حجز الحصة أولًا (يمنع أي تعارض مع معلم انتظار آخر بفضل القيد الفريد)
    const { error: subErr } = await supabase.from("substitute_periods").insert({
      schedule_id: selected.id,
      class_id: selected.class_id,
      cover_teacher_id: me.id,
      absent_teacher_id: selected.teacher_id,
      attend_date: date,
      period_no: nowPeriod,
      day_of_week: dow,
      academic_year: year,
      term,
    });
    if (subErr) {
      setSaving(false);
      setMsg({ ok: false, text: "سبقك معلم آخر لهذه الحصة، أو تعذّر الحجز: " + subErr.message });
      setSelected(null);
      await loadCandidates();
      return;
    }

    const rows = students.map((s) => ({
      student_id: s.id, schedule_id: selected.id, attend_date: date,
      status: marks[s.id] ?? "present",
      recorded_by: session?.user?.id ?? null, academic_year: year,
    }));
    const { error } = await supabase.from("class_attendance")
      .upsert(rows, { onConflict: "student_id,schedule_id,attend_date" });
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `تعذّر حفظ التحضير: ${error.message}` }); return; }

    setMsg({ ok: true, text: "تم تسجيلك معلم انتظار وحُفظ التحضير." });
    setSelected(null);
    await loadCandidates();
  };

  const ptMap = byPeriodNo(ptimes);
  const ptimeOf = (no) => (no == null ? null : ptMap[no] ?? null);
  const graceOk = (() => {
    const row = ptimeOf(nowPeriod);
    if (!row) return true;
    return nowMinutes() - toMinutes(row.start_time) >= GRACE_MINUTES;
  })();

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  if (!dow) {
    return <Empty title="اليوم عطلة" body="الأسبوع الدراسي من الأحد إلى الخميس." />;
  }
  if (nowPeriod == null) {
    return (
      <Empty title="لا توجد حصة جارية الآن"
             body="تظهر حصص الانتظار فقط أثناء وقت حصة فعلية من اليوم الدراسي." />
    );
  }

  /* ---------------- شاشة تحضير الفصل المختار ---------------- */
  if (selected) {
    return (
      <div className="space-y-4">
        <section className="rounded-card border border-[#CCF2DB] bg-mint-tint p-4">
          <p className="text-xs font-medium text-[#6AA786]">
            {todayLabel()} · الحصة <span className="num">{nowPeriod}</span>
            {ptimeOf(nowPeriod) && <span className="num"> · {fmtRange(ptimeOf(nowPeriod))}</span>}
            {" "}· انتظار
          </p>
          <h1 className="mt-1 text-xl font-bold leading-tight text-ink">
            {selected.subjects?.name ?? "بلا مادة"}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            فصل <span className="num">{selected.classes?.class_no}</span>
            {selected.classes?.grade ? ` · ${GRADE_NAMES[selected.classes.grade]}` : ""} ·{" "}
            بدل المعلم {selected.teachers?.full_name ?? "—"}
          </p>
        </section>

        {students.length === 0 ? (
          <Empty title="لا طلاب في هذا الفصل" body="لم تُستورد قائمة طلاب لهذا الفصل بعد." />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {students.map((s, i) => {
              const cur = marks[s.id] ?? "present";
              const isExcused = excused.has(s.id);
              return (
                <div key={s.id} className="px-3 py-2.5">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="num w-6 shrink-0 text-xs text-faint">{i + 1}</span>
                    <p className="flex-1 truncate text-sm font-medium text-ink">{s.full_name}</p>
                    {isExcused && <span className="chip shrink-0 bg-excused/10 text-excused">استئذان</span>}
                  </div>
                  {isExcused ? (
                    <div className="pr-8">
                      <div className="rounded-sm2 bg-excused py-2 text-center text-sm font-semibold text-white">
                        {STATUS.excused.label}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-1 pr-8">
                      {TEACHER_ORDER.map((k) => (
                        <button key={k} onClick={() => setMarks((m) => ({ ...m, [s.id]: k }))}
                          className={`flex-1 rounded-sm2 py-2 text-sm transition-colors ${
                            cur === k ? SOLID[k] : "text-muted hover:bg-canvas"}`}>
                          {STATUS[k].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {msg && (
          <p className={`rounded-card px-4 py-2.5 text-sm font-medium ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-primary" onClick={save} disabled={saving || !students.length}>
            {saving ? "جارٍ الحفظ…" : "حفظ التحضير وتسجيلي معلم انتظار"}
          </button>
          <button className="btn-ghost" onClick={() => setSelected(null)} disabled={saving}>
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- شاشة اختيار الفصل ---------------- */
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">حصص الانتظار</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          إذا كنت تغطّي فصلًا غاب عنه معلمه في الحصة الجارية، اخترْه من القائمة وسجّل
          التحضير — يظهر السجل مرة واحدة فقط بعد الحفظ لضمان عدم تعارضه مع حصة أخرى.
        </p>
      </div>

      <p className="text-xs font-medium text-[#6AA786]">
        {todayLabel()} · الحصة الجارية الآن <span className="num">{nowPeriod}</span>
        {ptimeOf(nowPeriod) && <span className="num"> · {fmtRange(ptimeOf(nowPeriod))}</span>}
      </p>

      {msg && (
        <p className={`rounded-card px-4 py-2.5 text-sm font-medium ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {candidates === null ? (
        <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>
      ) : !graceOk ? (
        <Empty title="ما زال الوقت مبكرًا"
               body={`تظهر الفصول المتاحة للانتظار بعد ${GRACE_MINUTES} دقائق من بداية الحصة، لإعطاء معلمها الأصلي فرصة تحضيرها بنفسه.`} />
      ) : candidates.length === 0 ? (
        <Empty title="لا فصول متاحة للانتظار الآن"
               body="كل فصول الحصة الجارية إمّا حُضِّرت، أو أنها ليست ضمن نطاق جدولك." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {candidates.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  فصل <span className="num">{c.classes?.class_no}</span>
                  {c.classes?.grade ? ` · ${GRADE_NAMES[c.classes.grade]}` : ""} · {c.subjects?.name ?? "بلا مادة"}
                </p>
                <p className="mt-0.5 text-xs text-muted">معلمه الأصلي: {c.teachers?.full_name ?? "—"}</p>
              </div>
              <button onClick={() => openRoster(c)} className="btn-primary shrink-0">
                دخول انتظار
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ title, body }) {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
