import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates.js";
import { dfileError } from "../../lib/dfile.js";

/* =====================================================================
   رأي الإدارة في ملف المعلم الرقمي — لمدير المدرسة ووكيل الشؤون التعليمية.
   رأي واحد لكلٍّ منهما لكل معلم فعّل ملفه، اختياري. لا يظهر للزائر إلا إذا
   اختار المعلم «إظهار»، وإذا عُدّل عاد للمعلم ليختار. لا إشعار للمعلم.
   ===================================================================== */

const STATE = { pending: ["بانتظار اختيار المعلم", "bg-warning-light text-warning"], shown: ["يظهر للزائر", "bg-mint-tint text-mint-deep"], hidden: ["أخفاه المعلم", "bg-canvas text-muted"] };

export default function DfileOpinions() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);   // { uid, body }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("dfile_opinion_list");
    if (error) { setErr(dfileError(error)); setRows([]); } else setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (uid, body) => {
    setBusy(true); setErr("");
    const { error } = await supabase.rpc("dfile_opinion_write", { p_teacher: uid, p_body: body });
    setBusy(false);
    if (error) setErr(dfileError(error)); else { setEdit(null); load(); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">رأي الإدارة في ملفات المعلمين</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اكتب رأيك اختياريًا في ملف المعلم الرقمي، ويظهر للزائر باسمك وتاريخه ووسم «موقّع إلكترونيًا» بعد أن يختار
          المعلم إظهاره. لا يعدّل المعلم نصك، وإذا عدّلته عاد إليه ليختار من جديد. تظهر هنا ملفات المعلمين المفعّلة فقط.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      {rows === null ? <p className="text-sm text-muted">جارٍ التحميل…</p> : rows.length === 0 ? <p className="text-sm text-muted">لا ملفات مفعّلة بعد.</p> : (
        <div className="card divide-y divide-line/60">
          {rows.map((r) => (
            <div key={r.teacher_user_id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <b className="flex-1 text-sm text-ink">{r.name}</b>
                {r.decision && <span className={`chip ${STATE[r.decision][1]}`}>{STATE[r.decision][0]}</span>}
              </div>
              {edit?.uid === r.teacher_user_id ? (
                <div className="space-y-2">
                  <textarea className="field min-h-[110px]" maxLength={1200} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                            placeholder="رأيك في أداء المعلم، في سطرين أو ثلاثة" />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" disabled={busy || !edit.body.trim()} onClick={() => save(r.teacher_user_id, edit.body)}>حفظ</button>
                    <button className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
                    {r.body && <button className="btn-ghost text-danger" disabled={busy} onClick={() => save(r.teacher_user_id, "")}>حذف الرأي</button>}
                  </div>
                </div>
              ) : (
                <>
                  {r.body && <p className="text-sm leading-relaxed text-ink">«{r.body}» <span className="text-xs text-muted">{fmtDate(r.written_at)}</span></p>}
                  <button className="btn-ghost" onClick={() => setEdit({ uid: r.teacher_user_id, body: r.body ?? "" })}>{r.body ? "تعديل الرأي" : "اكتب رأيك"}</button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
