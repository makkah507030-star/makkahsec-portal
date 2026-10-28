import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates.js";
import { STOP_REASONS, dfileError, dfileLink } from "../../lib/dfile.js";

/* =====================================================================
   ملفات المعلمين الرقمية — اطلاع للمدير ووكيل الشؤون التعليمية ووكيل شؤون الطلاب
   (teacher_dfile_9.sql)، والإدارة للدعم الفني (manage): إيقاف ملف المعلم عند نقله من المدرسة
   أو تقاعده أو تحويله إلى عمل إداري، وإعادة تفعيله. المعلم لا يوقف ملفه بنفسه،
   وإيقافه يعطّل رابطه ورمزه فيرى الزائر «هذا الملف غير متاح».
   ===================================================================== */

export default function DfilesAdmin({ manage = true }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [stopping, setStopping] = useState(null);   // { uid, reason }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("teacher_dfiles")
      .select("teacher_user_id, code, enabled_at, disabled_at, disabled_reason, users(full_name)")
      .order("enabled_at", { ascending: false });
    if (error) { setErr(dfileError(error)); setRows([]); } else setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = async (uid, patch) => {
    setErr("");
    const { error } = await supabase.from("teacher_dfiles").update(patch).eq("teacher_user_id", uid);
    if (error) setErr(dfileError(error)); else { setStopping(null); load(); }
  };

  const shown = (rows ?? []).filter((r) => !q.trim() || (r.users?.full_name ?? "").includes(q.trim()) || r.code.includes(q.trim().toUpperCase()));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">ملفات المعلمين الرقمية</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {manage ? <>يفعّل المعلم ملفه بنفسه، ويوقفه الدعم الفني فقط عند نقله من المدرسة أو تقاعده أو تحويله إلى عمل إداري.
          الإيقاف يعطّل الرابط والرمز، ولا يحذف إعدادات المعلم.</>
            : "ملفات المعلمين الرقمية التي فعّلوها، وحالة كل ملف، ورابطه للاطلاع على محتواه. إيقاف الملف وإعادة تفعيله للدعم الفني."}
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      <input className="field max-w-sm" placeholder="بحث بالاسم أو الكود" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows === null ? <p className="text-sm text-muted">جارٍ التحميل…</p> : shown.length === 0 ? <p className="text-sm text-muted">لا ملفات مفعّلة.</p> : (
        <div className="card divide-y divide-line/60">
          {shown.map((r) => {
            const off = !!r.disabled_at;
            return (
              <div key={r.teacher_user_id} className="space-y-2 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="flex-1 text-sm text-ink">{r.users?.full_name ?? "—"}</b>
                  <span className="font-mono text-xs text-muted" dir="ltr">{r.code}</span>
                  <span className={`chip ${off ? "bg-danger-light text-danger" : "bg-mint-tint text-mint-deep"}`}>{off ? "موقوف" : "مفعّل"}</span>
                </div>
                <p className="text-xs text-muted">
                  فُعّل {fmtDate(r.enabled_at)}{off ? `، وأُوقف ${fmtDate(r.disabled_at)}${r.disabled_reason ? `: ${r.disabled_reason}` : ""}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {!off && <a className="btn-ghost" href={dfileLink(r.code)} target="_blank" rel="noreferrer">فتح الملف</a>}
                  {manage && (off
                    ? <button className="btn-ghost" onClick={() => set(r.teacher_user_id, { disabled_at: null, disabled_reason: null, disabled_by: null })}>إعادة التفعيل</button>
                    : <button className="btn-ghost text-danger" onClick={() => setStopping({ uid: r.teacher_user_id, reason: STOP_REASONS[0] })}>إيقاف</button>)}
                </div>
                {stopping?.uid === r.teacher_user_id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-sm2 bg-canvas p-2">
                    <select className="field max-w-xs" value={stopping.reason} onChange={(e) => setStopping({ ...stopping, reason: e.target.value })}>
                      {STOP_REASONS.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    <button className="btn-primary" onClick={async () => {
                      const { data: { user } } = await supabase.auth.getUser();
                      set(r.teacher_user_id, { disabled_at: new Date().toISOString(), disabled_reason: stopping.reason, disabled_by: user?.id ?? null });
                    }}>تأكيد الإيقاف</button>
                    <button className="btn-ghost" onClick={() => setStopping(null)}>إلغاء</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
