import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";

/** ترقيمنا: الأحد=1 … الخميس=5 */
const todayDow = () => {
  const js = new Date().getDay(); // الأحد=0
  return js + 1;
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

const STATUSES = [
  { key: "present", label: "حاضر", cls: "bg-present text-white" },
  { key: "absent", label: "غائب", cls: "bg-absent text-white" },
  { key: "late", label: "متأخر", cls: "bg-late text-white" },
  { key: "excused", label: "مستأذن", cls: "bg-excused text-white" },
];

export default function Attendance() {
  const { session } = useSession();
  const [periods, setPeriods] = useState([]);
  const [active, setActive] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [excused, setExcused] = useState(new Set());
  const [punched, setPunched] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [year, setYear] = useState("");
  const date = todayISO();

  /* حصص اليوم لهذا المعلم وحده */
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      // السنة النشطة من الإعدادات — لا تُكتب في الكود
      const { data: setting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "active_year")
        .maybeSingle();
      const activeYear = setting?.value ?? "";
      setYear(activeYear);

      const { data: t } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      if (!t) return;

      const { data } = await supabase
        .from("schedule")
        .select("id, period_no, class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t.id)
        .eq("academic_year", activeYear)
        .eq("day_of_week", todayDow())
        .order("period_no");

      setPeriods(data ?? []);
      if (data?.length) setActive(data[0]);
    })();
  }, [session]);

  /* طلاب الحصة المختارة */
  useEffect(() => {
    if (!active) return;
    (async () => {
      setMsg("");
      const { data: enr } = await supabase
        .from("student_enrollment")
        .select("student_id, students(id, full_name, national_id)")
        .eq("class_id", active.class_id)
        .eq("status", "active");

      const list = (enr ?? [])
        .map((e) => e.students)
        .filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
      setStudents(list);

      const ids = list.map((s) => s.id);
      if (!ids.length) return;

      const [{ data: existing }, { data: exc }, { data: daily }] = await Promise.all([
        supabase.from("class_attendance")
          .select("student_id, status")
          .eq("schedule_id", active.id)
          .eq("attend_date", date),
        supabase.from("excused_absences")
          .select("student_id")
          .lte("date_from", date)
          .gte("date_to", date)
          .in("student_id", ids),
        supabase.from("daily_attendance")
          .select("student_id")
          .eq("attend_date", date)
          .in("student_id", ids),
      ]);

      const excSet = new Set((exc ?? []).map((r) => r.student_id));
      setExcused(excSet);
      setPunched(new Set((daily ?? []).map((r) => r.student_id)));

      // الافتراضي: الكل حاضر — والمستأذن يظهر جاهزًا
      const init = {};
      list.forEach((s) => {
        init[s.id] = excSet.has(s.id) ? "excused" : "present";
      });
      (existing ?? []).forEach((r) => {
        init[r.student_id] = r.status;
      });
      setMarks(init);
    })();
  }, [active, date]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(marks).forEach((v) => (c[v] = (c[v] ?? 0) + 1));
    return c;
  }, [marks]);

  const save = async () => {
    if (!active) return;
    setSaving(true);
    setMsg("");

    const rows = students.map((s) => ({
      student_id: s.id,
      schedule_id: active.id,
      attend_date: date,
      status: marks[s.id] ?? "present",
      recorded_by: session?.user?.id ?? null,
      academic_year: year,
    }));

    const { error } = await supabase
      .from("class_attendance")
      .upsert(rows, { onConflict: "student_id,schedule_id,attend_date" });

    setSaving(false);
    setMsg(error ? `تعذّر الحفظ: ${error.message}` : "حُفظ التحضير");
  };

  if (!periods.length) {
    return (
      <div className="card p-6 text-center">
        <p className="font-medium">لا توجد حصص لك اليوم</p>
        <p className="mt-1 text-sm text-muted">
          إن كان هذا غير صحيح، راجع الإدارة للتأكد من الجدول الدراسي.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* اختيار الحصة */}
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setActive(p)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold ${
                active?.id === p.id
                  ? "bg-brand text-white"
                  : "border border-line bg-white text-ink"
              }`}
            >
              الحصة <span className="num">{p.period_no}</span> · فصل{" "}
              <span className="num">{p.classes?.class_no}</span>
            </button>
          ))}
        </div>
      </div>

      {/* الملخص */}
      <div className="card flex flex-wrap gap-4 px-4 py-3 text-sm">
        <span className="text-present">حاضر <b className="num">{counts.present}</b></span>
        <span className="text-absent">غائب <b className="num">{counts.absent}</b></span>
        <span className="text-late">متأخر <b className="num">{counts.late}</b></span>
        <span className="text-excused">مستأذن <b className="num">{counts.excused}</b></span>
      </div>

      {/* الطلاب */}
      <div className="card divide-y divide-line overflow-hidden">
        {students.map((s) => (
          <div key={s.id} className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">{s.full_name}</p>
              {!punched.has(s.id) && (
                <span className="shrink-0 rounded-full bg-late/10 px-2 py-0.5 text-xs font-medium text-late">
                  لم يبصم
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {STATUSES.map((st) => (
                <button
                  key={st.key}
                  onClick={() => setMarks((m) => ({ ...m, [s.id]: st.key }))}
                  className={`rounded-lg py-2.5 text-sm font-semibold ${
                    marks[s.id] === st.key
                      ? st.cls
                      : "border border-line bg-white text-muted"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {students.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">
            لا يوجد طلاب مسجّلون في هذا الفصل.
          </p>
        )}
      </div>

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.startsWith("حُفظ")
              ? "bg-present/10 text-present"
              : "bg-absent/10 text-absent"
          }`}
        >
          {msg}
        </p>
      )}

      {/* شريط الحفظ الثابت */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white p-3 sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <div
          className="mx-auto max-w-5xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <button
            className="btn-primary w-full sm:w-auto"
            onClick={save}
            disabled={saving || !students.length}
          >
            {saving ? "جارٍ الحفظ…" : "حفظ التحضير"}
          </button>
        </div>
      </div>
      <div className="h-16 sm:hidden" />
    </div>
  );
}
