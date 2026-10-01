// src/components/StudentPicker.jsx
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES } from "../lib/schoolTime";

/* بحث عن طالب نشط بالاسم واختياره — value: { student_id, full_name, class_no, grade } */
export const studentClassLabel = (s) => (s ? `${GRADE_NAMES[s.grade] ?? ""} — فصل ${s.class_no}` : "");

export default function StudentPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState(null);

  const search = async () => {
    const term = q.trim();
    if (term.length < 2) return;
    const { data } = await supabase.from("v_active_students")
      .select("student_id, full_name, class_no, grade")
      .ilike("full_name", `%${term}%`).order("full_name").limit(25);
    setFound(data ?? []);
  };

  if (value) return (
    <div className="flex items-center justify-between gap-2 rounded-sm2 border border-[#CCF2DB] bg-mint-tint px-3 py-2">
      <p className="text-sm font-semibold text-ink">{value.full_name}
        <span className="mr-2 text-xs font-normal text-muted">{studentClassLabel(value)}</span></p>
      <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold text-mint-deep">تغيير</button>
    </div>
  );

  return (
    <>
      <div className="flex gap-2">
        <input className="field flex-1" value={q} placeholder="اكتب جزءًا من اسم الطالب"
               onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        <button type="button" onClick={search} className="btn-primary">بحث</button>
      </div>
      {found && (
        <div className="mt-1.5 max-h-56 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
          {found.length === 0 && <p className="px-3 py-3 text-xs text-muted">لا نتائج.</p>}
          {found.map((s) => (
            <button key={s.student_id} type="button" onClick={() => { onChange(s); setFound(null); }}
                    className="flex w-full items-center justify-between px-3 py-2 text-right hover:bg-canvas">
              <span className="text-sm text-ink">{s.full_name}</span>
              <span className="text-xs text-muted">{GRADE_NAMES[s.grade]} · فصل <span className="num">{s.class_no}</span></span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
