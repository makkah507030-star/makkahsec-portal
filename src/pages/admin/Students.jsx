import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";

export default function Students() {
  const [rows, setRows] = useState(null);
  const [guardians, setGuardians] = useState(new Map());
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState(0);
  const [cls, setCls] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("v_active_students").select("*").order("class_no");
      setRows(data ?? []);
      const { data: gs } = await supabase.from("guardian_student")
        .select("student_id, guardians(full_name, mobile)");
      setGuardians(new Map((gs ?? []).map((r) => [r.student_id, r.guardians])));
    })();
  }, []);

  const classList = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.class_no))].sort((a, b) => a - b),
    [rows]
  );

  const filtered = useMemo(() => {
    const term = q.trim();
    return (rows ?? []).filter((r) =>
      (!grade || r.grade === grade) &&
      (!cls || r.class_no === cls) &&
      (!term || r.full_name?.includes(term) || r.national_id?.includes(term))
    );
  }, [rows, q, grade, cls]);

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-bold">الطلاب</h1>
        <p className="text-sm text-muted">
          <span className="num font-semibold text-ink">{filtered.length}</span> من{" "}
          <span className="num">{rows.length}</span>
        </p>
      </header>

      <input className="field" placeholder="بحث بالاسم أو رقم الهوية"
             value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="flex flex-wrap gap-1.5">
        <Pill on={!grade} onClick={() => { setGrade(0); setCls(0); }}>كل الصفوف</Pill>
        {[1, 2, 3].map((g) => (
          <Pill key={g} on={grade === g} onClick={() => { setGrade(g); setCls(0); }}>
            {GRADE_NAMES[g]}
          </Pill>
        ))}
      </div>

      {grade > 0 && (
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="flex gap-1.5 pb-1">
            <Pill on={!cls} onClick={() => setCls(0)}>الكل</Pill>
            {classList.filter((c) => Math.floor(c / 100) === grade).map((c) => (
              <Pill key={c} on={cls === c} onClick={() => setCls(c)}>
                <span className="num">{c}</span>
              </Pill>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold">لا نتائج</p>
          <p className="mt-1 text-sm text-muted">جرّب اسمًا آخر أو غيّر الفلتر.</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {filtered.slice(0, 300).map((r) => {
            const g = guardians.get(r.student_id);
            return (
              <div key={r.student_id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  <p className="num mt-0.5 text-xs text-faint">{r.national_id}</p>
                  {g && (
                    <p className="mt-1 truncate text-xs text-muted">
                      {g.full_name} · <span className="num">{g.mobile}</span>
                    </p>
                  )}
                </div>
                <span className="num shrink-0 rounded-md bg-mint-tint px-2 py-1 text-xs font-bold text-mint-deep">
                  {r.class_no}
                </span>
              </div>
            );
          })}
          {filtered.length > 300 && (
            <p className="px-4 py-3 text-center text-xs text-muted">
              يُعرض أول 300 — استخدم البحث أو الفلتر للوصول لبقية الطلاب.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
