// src/pages/AbsenceExcuses.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { GRADE_NAMES } from "../lib/schoolTime";
import Loader from "../components/Loader.jsx";
import { EXCUSE_KIND, EXCUSE_STATUS, dayLabel, deciderText, openExcuseFile } from "../components/AbsenceExcuse.jsx";

/* =====================================================================
   أعذار الغياب — لوكيل شؤون الطلاب والمساعدَين الإداريَّين 1 و2 (ومعهم المدير والدعم الفني):
   يرفعها الطالب أو ولي أمره، فيقبلها الوكيل فيصير غياب أيامها «غائب بعذر» آليًا،
   أو يرفضها بسبب يصل صاحبها. (supabase/absence_excuses_1..2.sql)
   ===================================================================== */
export default function AbsenceExcuses() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState(null);
  const [cls, setCls] = useState({});        // الطالب ← صفه وفصله
  const [note, setNote] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    let q = supabase.from("absence_excuses").select("*, students(full_name)").order("created_at", { ascending: tab === "pending" });
    q = tab === "pending" ? q.eq("status", "pending") : q.neq("status", "pending").limit(200);
    const { data, error } = await q;
    if (error) { setMsg({ ok: false, text: /absence_excuses|schema cache/i.test(error.message) ? "تحتاج تشغيل supabase/absence_excuses_1.sql ثم absence_excuses_2.sql في Supabase ← SQL Editor." : error.message }); setRows([]); return; }
    setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((r) => r.student_id))];
    if (ids.length) {
      const { data: v } = await supabase.from("v_active_students").select("student_id, grade, class_no").in("student_id", ids);
      setCls(Object.fromEntries((v ?? []).map((x) => [x.student_id, x])));
    }
  };
  useEffect(() => { setRows(null); load(); }, [tab]);   // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (r, accept) => {
    const n = (note[r.id] ?? "").trim();
    if (!accept && !n) { setMsg({ ok: false, text: "اكتب سبب عدم قبول العذر ليصل صاحبه." }); return; }
    setBusy(r.id); setMsg(null);
    const { data, error } = await supabase.rpc("absence_excuse_decide", { p_id: r.id, p_accept: accept, p_note: n || null });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: accept
      ? `قُبل عذر ${r.students?.full_name ?? ""}${data ? `، وصار غياب ${data === 1 ? "يوم" : `${data} أيام`} معتمد «غائب بعذر»` : ""}.`
      : `لم يُقبل عذر ${r.students?.full_name ?? ""}، ووصل صاحبه السبب.` });
    load();
  };

  const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">أعذار الغياب</h1>
        <p className="mt-1 text-sm text-muted">يرفعها الطالب أو ولي أمره من سجل غيابه. القبول يجعل غياب أيامها «غائب بعذر» آليًا، والرفض يحتاج سببًا يصل صاحبه.</p>
      </div>
      <div className="flex gap-1.5">
        <button className={pill(tab === "pending")} onClick={() => setTab("pending")}>بانتظار القرار</button>
        <button className={pill(tab === "done")} onClick={() => setTab("done")}>السجل</button>
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}
      {!rows ? <Loader /> : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">{tab === "pending" ? "لا أعذار بانتظار القرار." : "لا قرارات بعد."}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const c = cls[r.student_id];
            const st = EXCUSE_STATUS[r.status] ?? EXCUSE_STATUS.pending;
            return (
              <article key={r.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{r.students?.full_name}
                      {c && <span className="mr-1 text-xs font-normal text-muted">· {GRADE_NAMES[c.grade] ?? ""} / <span className="num">{c.class_no}</span></span>}</p>
                    <p className="text-xs text-muted">من {r.requester === "guardian" ? "ولي الأمر" : "الطالب"} · <span className="num">{fmtDateTime(r.created_at)}</span></p>
                  </div>
                  <span className="chip bg-canvas text-muted">{EXCUSE_KIND[r.kind] ?? ""}</span>
                  {r.status !== "pending" && <span className={`chip ${st.c}`}>{st.short}</span>}
                </div>
                <p className="text-sm text-ink"><span className="text-muted">الأيام: </span>{(r.dates ?? []).map(dayLabel).join("، ")}</p>
                {r.reason && <p className="text-sm text-ink"><span className="text-muted">السبب: </span>{r.reason}</p>}
                {r.file_path && (
                  <button className="text-xs font-semibold text-mint-deep underline"
                          onClick={() => openExcuseFile(r.file_path).catch((e) => setMsg({ ok: false, text: e.message }))}>
                    فتح المرفق{r.file_name ? ` (${r.file_name})` : ""} ↗
                  </button>
                )}
                {r.status === "pending" ? (
                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-2">
                    <input className="field min-w-0 flex-1 basis-60" placeholder="ملاحظة لصاحب العذر (إلزامية عند عدم القبول)"
                           value={note[r.id] ?? ""} onChange={(e) => setNote((x) => ({ ...x, [r.id]: e.target.value }))} />
                    <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy === r.id} onClick={() => decide(r, true)}>قبول العذر</button>
                    <button className="rounded-pill border border-absent/50 px-4 py-1.5 text-xs font-semibold text-absent hover:bg-absent/5"
                            disabled={busy === r.id} onClick={() => decide(r, false)}>عدم القبول</button>
                  </div>
                ) : (
                  <p className="border-t border-line pt-2 text-xs text-muted">
                    {deciderText(r)} · <span className="num">{r.decided_at ? fmtDateTime(r.decided_at) : ""}</span>
                    {r.decision_note && <> · {r.decision_note}</>}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
