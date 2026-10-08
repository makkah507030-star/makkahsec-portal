import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";
import { printReport, PRINCIPAL_NAME } from "../lib/exportUtils";
import { activeYear, elementColor, elementSummary, loadAutoCounts, loadEvidence, loadPerfReference } from "../lib/performance";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import Loader from "./Loader.jsx";

/* =====================================================================
   تقييم الأداء الوظيفي بمرحلتيه (supabase/performance_review.sql):
   • ReviewEditor — لمدير المدرسة: يقدّر العناصر الـ11 ويرسل للمعلم.
   • TeacherReviews — للمعلم: يطّلع ويكتب إضافاته ويقرّ.
   التقرير المعتمد يظهر في نظام فارس؛ ما هنا تقييم استرشادي داخلي.
   ===================================================================== */

export const STAGE_LABEL = { mid: "المراجعة النصف سنوية", final: "التقييم النهائي" };
export const RATING_LABEL = { 5: "مثالي", 4: "تخطى التوقعات", 3: "وافق التوقعات", 2: "بحاجة إلى تطوير", 1: "غير مرضي" };
export const NOT_FINAL = "هذا التقييم ليس نهائيًا ولا معتمدًا. التقرير المعتمد يظهر في نظام فارس، ولك حق الاعتراض عبر القنوات الرسمية.";

/** التقدير العام: مجموع (التقدير × الوزن) ÷ 100، من 5 — حين تُقدَّر كل العناصر */
export function overall(elements, ratings) {
  if (!elements.every((e) => ratings?.[e.key])) return null;
  const v = elements.reduce((a, e) => a + Number(ratings[e.key]) * e.weight, 0) / 100;
  return { value: Math.round(v * 100) / 100, label: RATING_LABEL[Math.min(5, Math.max(1, Math.round(v)))] };
}

export function printReview(row, elements, teacherName) {
  const ov = overall(elements, row.ratings);
  printReport({
    title: `تقييم الأداء الوظيفي — ${STAGE_LABEL[row.stage]}`,
    subtitle: `${teacherName} · العام الدراسي ${row.academic_year}`,
    sections: [
      { title: "تقدير العناصر", headers: ["م", "عنصر التقييم", "الوزن", "التقدير", "الوصف"],
        rows: elements.map((e, i) => [i + 1, e.title, `${e.weight}%`, row.ratings?.[e.key] ?? "—", RATING_LABEL[row.ratings?.[e.key]] ?? "—"]) },
      { title: "الخلاصة", headers: ["البند", "التفصيل"], rows: [
        ["التقدير العام", ov ? `${ov.value} من 5 — ${ov.label}` : "—"],
        ["الإيجابيات", row.positives || "—"],
        ["التوصيات", row.recommendations || "—"],
        ["إضافات المعلم", row.teacher_note || "—"],
        ["الإقرار بالاطلاع", row.ack_at ? fmtDate(row.ack_at) : "لم يُقرّ بعد"],
      ] },
    ],
    note: "تقييم استرشادي داخلي، والتقرير المعتمد يظهر في نظام فارس.",
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    signatures: [{ title: "المعلم", name: teacherName }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
  });
}

function OverallBox({ ov }) {
  return (
    <div className="rounded-sm2 bg-mint-tint px-4 py-3 text-center">
      <p className="text-xs text-muted">التقدير العام</p>
      {ov ? (
        <p className="mt-0.5 text-mint-deep"><span className="num text-2xl font-bold">{ov.value}</span>
          <span className="text-sm"> من 5 · {ov.label}</span></p>
      ) : <p className="mt-0.5 text-sm text-muted">يظهر بعد تقدير كل العناصر</p>}
    </div>
  );
}

/* ----------------------------- المدير ----------------------------- */
export function ReviewEditor({ teacher }) {
  const [elements, setElements] = useState(null);
  const [year, setYear] = useState("");
  const [rows, setRows] = useState({});          // { mid, final }
  const [stage, setStage] = useState("mid");
  const [form, setForm] = useState({ ratings: {}, positives: "", recommendations: "" });
  const [summary, setSummary] = useState({});    // ملخص الشواهد لكل عنصر
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const y = await activeYear();
    const [els, { data }, ev, au] = await Promise.all([
      loadPerfReference(),
      supabase.from("perf_reviews").select("*").eq("teacher_user_id", teacher.user_id).eq("academic_year", y),
      loadEvidence(teacher.user_id, y).catch(() => []),
      loadAutoCounts(teacher.user_id, y),
    ]);
    const m = Object.fromEntries((data ?? []).map((r) => [r.stage, r]));
    setYear(y); setElements(els); setRows(m);
    setSummary(Object.fromEntries(els.map((e) => [e.key, elementSummary(e, ev, au[teacher.user_id] ?? {})])));
    const st = m.mid?.sent_at ? "final" : "mid";
    setStage(st);
    const r = m[st];
    setForm({ ratings: r?.ratings ?? {}, positives: r?.positives ?? "", recommendations: r?.recommendations ?? "" });
  }, [teacher.user_id]);

  useEffect(() => { load(); }, [load]);

  if (!elements) return <Loader />;

  const row = rows[stage];
  const locked = !!row?.sent_at;
  const shown = locked ? row : form;
  const ov = overall(elements, shown.ratings);

  const pick = (s) => {
    setStage(s); setMsg(null);
    const r = rows[s];
    setForm({ ratings: r?.ratings ?? {}, positives: r?.positives ?? "", recommendations: r?.recommendations ?? "" });
  };

  const save = async (send = false) => {
    setMsg(null);
    if (send && !overall(elements, form.ratings)) { setMsg({ ok: false, text: "قدّر كل العناصر قبل الإرسال." }); return; }
    if (send && !window.confirm(`إرسال ${STAGE_LABEL[stage]} إلى ${teacher.full_name}؟ لن يمكن تعديله بعد الإرسال.`)) return;
    setBusy(true);
    const payload = {
      teacher_user_id: teacher.user_id, academic_year: year, stage,
      ratings: form.ratings, positives: form.positives.trim() || null,
      recommendations: form.recommendations.trim() || null, updated_at: new Date().toISOString(),
      ...(send ? { sent_at: new Date().toISOString() } : {}),
    };
    const { error } = row
      ? await supabase.from("perf_reviews").update(payload).eq("id", row.id)
      : await supabase.from("perf_reviews").insert(payload);
    if (!error && send) {
      try {
        await supabase.rpc("send_notification", {
          p_title: `وصلك ${STAGE_LABEL[stage]}`, p_body: "اطّلع على تقييم أدائك الوظيفي وأقرّ بالاطلاع.",
          p_kind: "general", p_link: "/my-performance", p_roles: null,
          p_user_ids: [teacher.user_id], p_grade: null, p_class_no: null, p_is_auto: true,
        });
      } catch { /* الإشعار تكميلي */ }
    }
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: send ? "أُرسل التقييم للمعلم." : "حُفظ التقييم مسودةً، ولا يراه المعلم قبل الإرسال." });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["mid", "final"].map((s) => (
          <button key={s} onClick={() => pick(s)} disabled={s === "final" && !rows.mid?.sent_at}
                  className={`w-48 rounded-sm2 py-2 text-sm font-semibold disabled:opacity-40 ${
                    stage === s ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
            {STAGE_LABEL[s]}
          </button>
        ))}
      </div>

      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="flex-1 font-bold text-ink">{STAGE_LABEL[stage]}</h2>
          <span className={`chip w-36 justify-center ${row?.ack_at ? "bg-mint-light text-mint-deep" : locked ? "bg-warning-light text-warning" : "bg-canvas text-muted"}`}>
            {row?.ack_at ? `أقرّ المعلم · ${fmtDate(row.ack_at)}` : locked ? "أُرسل · بانتظار إقراره" : "مسودة"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-mint-tint text-right text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">عنصر التقييم</th>
                <th className="w-16 px-3 py-2 text-center font-semibold">الوزن</th>
                <th className="w-40 px-3 py-2 text-center font-semibold">الشواهد</th>
                <th className="w-48 px-3 py-2 font-semibold">التقدير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {elements.map((e) => {
                const s = summary[e.key];
                const v = shown.ratings?.[e.key] ?? "";
                return (
                  <tr key={e.key}>
                    <td className="px-3 py-2 font-medium" style={{ color: elementColor(e.key) }}>{e.title}</td>
                    <td className="num px-3 py-2 text-center">{e.weight}%</td>
                    <td className="px-3 py-2 text-center text-xs text-muted">
                      {e.evaluator_only ? "مؤشرات مساندة في الملف" : <>متوفر <span className="num">{s?.available ?? 0}</span> · غير متوفر <span className="num">{s?.missing ?? 0}</span></>}
                    </td>
                    <td className="px-3 py-2">
                      {locked ? (
                        <span>{v ? <><span className="num font-bold">{v}</span> · {RATING_LABEL[v]}</> : "—"}</span>
                      ) : (
                        <select className="field py-1.5" value={v}
                                onChange={(ev) => setForm((f) => ({ ...f, ratings: { ...f.ratings, [e.key]: ev.target.value ? Number(ev.target.value) : undefined } }))}>
                          <option value="">اختر…</option>
                          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} — {RATING_LABEL[n]}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <OverallBox ov={ov} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">الإيجابيات</label>
            {locked ? <p className="whitespace-pre-line text-sm text-ink">{row.positives || "—"}</p> : (
              <textarea className="field min-h-[90px]" value={form.positives} onChange={(e) => setForm((f) => ({ ...f, positives: e.target.value }))} />
            )}
          </div>
          <div>
            <label className="label">التوصيات</label>
            {locked ? <p className="whitespace-pre-line text-sm text-ink">{row.recommendations || "—"}</p> : (
              <textarea className="field min-h-[90px]" value={form.recommendations} onChange={(e) => setForm((f) => ({ ...f, recommendations: e.target.value }))} />
            )}
          </div>
        </div>

        {row?.ack_at && (
          <div className="rounded-sm2 bg-canvas px-3 py-2 text-sm">
            <p className="font-semibold text-ink">إضافات المعلم</p>
            <p className="mt-1 whitespace-pre-line text-muted">{row.teacher_note || "لا إضافات."}</p>
          </div>
        )}

        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-mint-light text-mint-deep" : "bg-danger-light text-danger"}`}>{msg.text}</p>}

        <div className="flex flex-wrap gap-2">
          {!locked && <button className="btn-ghost" onClick={() => save(false)} disabled={busy}>حفظ مسودة</button>}
          {!locked && <button className="btn-primary" onClick={() => save(true)} disabled={busy}>إرسال للمعلم للاطلاع</button>}
          {locked && <button className="btn-primary" onClick={() => printReview(row, elements, teacher.full_name)}>طباعة التقييم</button>}
        </div>
        <p className="text-xs text-muted">تقييم استرشادي داخلي، والتقرير المعتمد يُرفع في نظام فارس. لا يرى المعلم المسودة قبل إرسالها.</p>
      </section>
    </div>
  );
}

/* ----------------------------- المعلم ----------------------------- */
export function TeacherReviews({ uid, name }) {
  const [elements, setElements] = useState(null);
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const y = await activeYear();
    const [els, { data }] = await Promise.all([
      loadPerfReference(),
      supabase.from("perf_reviews").select("*").eq("teacher_user_id", uid).eq("academic_year", y).not("sent_at", "is", null),
    ]);
    setElements(els);
    setRows((data ?? []).sort((a, b) => (a.stage === "mid" ? 0 : 1) - (b.stage === "mid" ? 0 : 1)));
  }, [uid]);

  useEffect(() => { load().catch(() => setRows([])); }, [load]);

  if (!elements || rows.length === 0) return null;

  const ack = async (r) => {
    setBusy(true);
    const { error } = await supabase.rpc("perf_review_ack", { p_id: r.id, p_note: notes[r.id] ?? "" });
    setBusy(false);
    if (error) { alert(error.message); return; }
    load();
  };

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const ov = overall(elements, r.ratings);
        return (
          <section key={r.id} className="card space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="flex-1 font-bold text-ink">تقييم الأداء الوظيفي · {STAGE_LABEL[r.stage]}</h2>
              <span className={`chip w-36 justify-center ${r.ack_at ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
                {r.ack_at ? `اطّلعت · ${fmtDate(r.ack_at)}` : "بانتظار اطلاعك"}
              </span>
            </div>
            <div className="divide-y divide-line/60 rounded-sm2 border border-line/60">
              {elements.map((e) => (
                <div key={e.key} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 font-medium" style={{ color: elementColor(e.key) }}>{e.title}</span>
                  <span className="num w-12 text-center text-muted">{e.weight}%</span>
                  <span className="w-40 text-ink"><span className="num font-bold">{r.ratings?.[e.key] ?? "—"}</span> · {RATING_LABEL[r.ratings?.[e.key]] ?? ""}</span>
                </div>
              ))}
            </div>
            <OverallBox ov={ov} />
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><p className="label">الإيجابيات</p><p className="whitespace-pre-line text-ink">{r.positives || "—"}</p></div>
              <div><p className="label">التوصيات</p><p className="whitespace-pre-line text-ink">{r.recommendations || "—"}</p></div>
            </div>

            <div className="flex gap-3 rounded-sm2 border border-warning/40 bg-warning-light px-3 py-2.5 text-sm text-warning">
              <span aria-hidden="true" className="font-bold">!</span>
              <p>{NOT_FINAL}</p>
            </div>

            {r.ack_at ? (
              <div className="rounded-sm2 bg-canvas px-3 py-2 text-sm">
                <p className="font-semibold text-ink">إضافاتك</p>
                <p className="mt-1 whitespace-pre-line text-muted">{r.teacher_note || "لا إضافات."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label">إضافات من المعلم (اختياري)</label>
                  <textarea className="field min-h-[80px]" value={notes[r.id] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                </div>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={!!checked[r.id]} onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))} />
                  اطّلعتُ على هذا التقييم
                </label>
                <button className="btn-primary" disabled={!checked[r.id] || busy} onClick={() => ack(r)}>تأكيد الاطلاع</button>
              </div>
            )}
            <button className="text-sm text-mint-deep underline" onClick={() => printReview(r, elements, name ?? "")}>طباعة التقييم</button>
          </section>
        );
      })}
    </div>
  );
}
