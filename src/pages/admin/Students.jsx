import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Students() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("v_active_students")
        .select("*")
        .order("class_no")
        .limit(1000);
      setRows(data ?? []);
    })();
  }, []);

  const filtered = rows.filter(
    (r) =>
      !q ||
      r.full_name?.includes(q) ||
      r.national_id?.includes(q) ||
      String(r.class_no) === q
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">الطلاب</h1>

      <input
        className="field"
        placeholder="بحث بالاسم أو الهوية أو رقم الفصل"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <p className="text-sm text-muted">
        <span className="num">{filtered.length}</span> من{" "}
        <span className="num">{rows.length}</span>
      </p>

      <div className="card divide-y divide-line overflow-hidden">
        {filtered.slice(0, 200).map((r) => (
          <div key={r.student_id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.full_name}</p>
              <p className="num text-xs text-muted">{r.national_id}</p>
            </div>
            <span className="num shrink-0 rounded-md bg-brand-light px-2 py-1 text-xs font-semibold text-brand">
              فصل {r.class_no}
            </span>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted">لا توجد نتائج.</p>
        )}
      </div>
    </div>
  );
}
