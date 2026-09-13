import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { todayDow, todayISO, todayLabel, GRADE_NAMES, STATUS } from "../../lib/schoolTime";

const ORDER = ["present", "absent", "late", "excused"];

// أصناف ثابتة — Tailwind لا يقرأ الأصناف المبنية ديناميكيًا
const SOLID = {
  present: "bg-present text-white font-semibold",
  absent:  "bg-absent text-white font-semibold",
  late:    "bg-late text-white font-semibold",
  excused: "bg-excused text-white font-semibold",
};
const EDGE = {
  absent:  "text-absent bg-absent/[.04]",
  late:    "text-late bg-late/[.04]",
  excused: "text-excused bg-excused/[.04]",
};

export default function Attendance() {
  const { session } = useSession();
  const [periods, setPeriods] = useState([]);
  const [marked, setMarked] = useState(new Set());
  const [active, setActive] = useState(null);
  const [students, setStudents] = useState([]);
  const [marks, setMarks] = useState({});
  const [excused, setExcused] = useState(new Set());
  const [punched, setPunched] = useState(new Set());
  const [permits, setPermits] = useState({}); // student_id -> { by, note }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(true);
  const date = todayISO();
  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      const t = Number(m.active_term ?? 1);
      setYear(y);

      const { data: t0 } = await supabase.from("teachers")
        .select("id").eq("user_id", uid).maybeSingle();
      if (!t0 || !dow) { setLoading(false); return; }

      const { data } = await supabase.from("schedule")
        .select("id, period_no, class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id).eq("academic_year", y)
        .eq("term", t).eq("day_of_week", dow).order("period_no");

      const list = data ?? [];
      setPeriods(list);
      if (list.length) {
        const { data: done } = await supabase.from("class_attendance")
          .select("schedule_id").eq("attend_date", date)
          .in("schedule_id", list.map((p) => p.id));
        const doneSet = new Set((done ?? []).map((r) => r.schedule_id));
        setMarked(doneSet);
        setActive(list.find((p) => !doneSet.has(p.id)) ?? list[0]);
      }
      setLoading(false);
    })();
  }, [session, dow, date]);

  useEffect(() => {
    if (!active) return;
    (async () => {
      setMsg(null);
      const { data: enr } = await supabase.from("student_enrollment")
        .select("student_id, students(id, full_name)")
        .eq("class_id", active.class_id).eq("status", "active");
      const list = (enr ?? []).map((e) => e.students).filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
      setStudents(list);
      const ids = list.map((s) => s.id);
      if (!ids.length) { setPermits({}); return; }

      const [{ data: existing }, { data: exc }, { data: daily }, { data: perms }] =
        await Promise.all([
          supabase.from("class_attendance").select("student_id, status")
            .eq("schedule_id", active.id).eq("attend_date", date),
          supabase.from("excused_absences").select("student_id")
            .lte("date_from", date).gte("date_to", date).in("student_id", ids),
          supabase.from("daily_attendance").select("student_id")
            .eq("attend_date", date).in("student_id", ids),
          supabase.from("permission_request_students")
            .select("student_id, permission_requests!inner(scope, period_numbers, note, created_by, request_date)")
            .in("student_id", ids)
            .eq("permission_requests.request_date", date),
        ]);

      const excSet = new Set((exc ?? []).map((r) => r.student_id));
      setExcused(excSet);
      setPunched(new Set((daily ?? []).map((r) => r.student_id)));

      // الاستئذانات التي تغطي هذه الحصة تحديدًا
      const covering = (perms ?? []).filter((p) => {
        const r = p.permission_requests;
        if (!r) return false;
        if (r.scope === "day") return true;
        return (r.period_numbers ?? []).includes(active.period_no);
      });

      if (covering.length) {
        const raiserIds = [...new Set(covering.map((p) => p.permission_requests.created_by))];
        const [{ data: tchs }, { data: grs }] = await Promise.all([
          supabase.from("teachers").select("user_id, full_name").in("user_id", raiserIds),
          supabase.from("permission_grantors").select("user_id, title").in("user_id", raiserIds),
        ]);
        const nameBy  = Object.fromEntries((tchs ?? []).map((t) => [t.user_id, t.full_name]));
        const titleBy = Object.fromEntries((grs  ?? []).map((g) => [g.user_id, g.title]));

        const map = {};
        covering.forEach((p) => {
          const r = p.permission_requests;
          map[p.student_id] = {
            by: nameBy[r.created_by] ?? titleBy[r.created_by] ?? "الإدارة",
            title: titleBy[r.created_by] ?? null,
            note: r.note ?? null,
          };
        });
        setPermits(map);
      } else {
        setPermits({});
      }

      const init = {};
      list.forEach((s) => { init[s.id] = excSet.has(s.id) ? "excused" : "present"; });
      (existing ?? []).forEach((r) => { init[r.student_id] = r.status; });
      setMarks(init);
    })();
  }, [active, date]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 };
    Object.values(marks).forEach((v) => { c[v] = (c[v] ?? 0) + 1; });
    return c;
  }, [marks]);

  const save = async () => {
    if (!active) return;
    setSaving(true); setMsg(null);
    const rows = students.map((s) => ({
      student_id: s.id, schedule_id: active.id, attend_date: date,
      status: marks[s.id] ?? "present",
      recorded_by: session?.user?.id ?? null, academic_year: year,
    }));
    const { error } = await supabase.from("class_attendance")
      .upsert(rows, { onConflict: "student_id,schedule_id,attend_date" });
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }
    setMarked((m) => new Set(m).add(active.id));
    setMsg({ ok: true, text: "حُفظ التحضير" });
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;
  if (!dow) return <Empty title="اليوم عطلة" body="الأسبوع الدراسي من الأحد إلى الخميس." />;
  if (!periods.length)
    return <Empty title={`لا حصص لك ${todayLabel()}`}
                  body="إن كان هذا غير صحيح، راجع الإدارة للتأكد من الجدول الدراسي." />;

  const grade = active?.classes?.grade;
  const allDone = marked.size === periods.length;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-card bg-mint-deep text-white shadow-card">
        <div className="px-5 pt-4">
          <p className="text-xs text-white/60">
            {todayLabel()} · الحصة <span className="num">{active?.period_no}</span>
          </p>
          <h1 className="mt-1 text-xl font-bold leading-tight">
            {active?.subjects?.name ?? "بلا مادة"}
          </h1>
          <p className="mt-0.5 text-sm text-white/75">
            فصل <span className="num">{active?.classes?.class_no}</span>
            {grade ? ` · ${GRADE_NAMES[grade]}` : ""} ·{" "}
            <span className="num">{students.length}</span> طالبًا
          </p>
        </div>
        <div className="mt-4 grid grid-cols-4 border-t border-white/15">
          {ORDER.map((k) => (
            <div key={k} className="border-l border-white/15 px-2 py-2.5 text-center last:border-l-0">
              <p className="num text-lg font-bold leading-none">{counts[k]}</p>
              <p className="mt-1 text-[11px] text-white/60">{STATUS[k].label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex gap-2 pb-1">
          {periods.map((p) => {
            const on = active?.id === p.id;
            const done = marked.has(p.id);
            return (
              <button key={p.id} onClick={() => setActive(p)}
                className={[
                  "shrink-0 rounded-card border px-3 py-2 text-right transition-colors",
                  on ? "border-mint-deep bg-mint-tint" : done ? "border-line bg-paper" : "border-line bg-warning-light",
                ].join(" ")}>
                <span className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-present" : "bg-faint"}`} />
                  <span className="num text-sm font-bold">{p.period_no}</span>
                </span>
                <span className="mt-0.5 block whitespace-nowrap text-xs text-muted">
                  {p.subjects?.name ?? "—"}
                </span>
                <span className="num mt-0.5 block text-[11px] text-faint">{p.classes?.class_no}</span>
              </button>
            );
          })}
        </div>
      </div>

      {allDone && (
        <p className="rounded-card bg-present/10 px-4 py-2.5 text-sm font-medium text-present">
          حُضِّرت كل حصص اليوم.
        </p>
      )}

      {students.length === 0 ? (
        <Empty title="لا طلاب في هذا الفصل" body="لم تُستورد قائمة طلاب لهذا الفصل بعد." />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {students.map((s, i) => {
            const cur = marks[s.id] ?? "present";
            const edge = cur === "present" ? "" : EDGE[cur];
            const permit = permits[s.id];
            return (
              <div key={s.id} className={`px-3 py-2.5 ${edge}`}
                   style={cur === "present" ? undefined : { boxShadow: "inset 3px 0 0 currentColor" }}>
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="num w-6 shrink-0 text-xs text-faint">{i + 1}</span>
                  <p className="flex-1 truncate text-sm font-medium text-ink">{s.full_name}</p>
                  {!punched.has(s.id) && <span className="chip shrink-0 bg-warning-light text-warning">لم يبصم</span>}
                  {permit && <span className="chip shrink-0 bg-mint-light text-mint-deep">مستأذن</span>}
                  {excused.has(s.id) && <span className="chip shrink-0 bg-excused/10 text-excused">استئذان</span>}
                </div>

                {permit && (
                  <p className="mb-1.5 pr-8 text-[11px] leading-relaxed text-muted">
                    استئذان داخلي — بواسطة {permit.by}
                    {permit.title ? ` (${permit.title})` : ""}
                    {permit.note ? ` · ${permit.note}` : ""}
                  </p>
                )}

                <div className="flex gap-1 pr-8">
                  {ORDER.map((k) => (
                    <button key={k} onClick={() => setMarks((m) => ({ ...m, [s.id]: k }))}
                      className={`flex-1 rounded-sm2 py-2 text-sm transition-colors ${
                        cur === k ? SOLID[k] : "text-muted hover:bg-canvas"}`}>
                      {STATUS[k].label}
                    </button>
                  ))}
                </div>
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

      <div className="fixed inset-x-0 bottom-14 border-t border-line bg-paper/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto max-w-5xl">
          <button className="btn-primary w-full sm:w-auto" onClick={save}
                  disabled={saving || !students.length}>
            {saving ? "جارٍ الحفظ…" : marked.has(active?.id) ? "تحديث التحضير" : "حفظ التحضير"}
          </button>
        </div>
      </div>
      <div className="h-16 sm:hidden" />
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
