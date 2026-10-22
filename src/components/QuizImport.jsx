// src/components/QuizImport.jsx
// استيراد أسئلة من اختبار آخر للمعلم (مثل نقل أسئلة الإلكتروني إلى الورقي أو التصحيح الآلي).
// تُضاف «نسخة» من كل سؤال مختار بكل حقوله (النص والخيارات والإجابة والدرجة)، وتُنسخ صوره
// في مجلد الاختبار الجديد، ويبقى الاختبار الأصلي كما هو. ما لا يناسب نوع الاختبار الجديد
// (مثل المقالي في الإلكتروني) يظهر معطّلًا بسببه.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { KIND_LABEL, copyQuestionsInto } from "../lib/qbank.js";

const MODE_LABEL = { paper: "ورقي", omr: "تصحيح آلي", online: "إلكتروني", offline: "دون إنترنت" };
const preview = (t) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, 90) || "(بلا نص)";

/* allowed: أنماط الأسئلة المسموحة في الاختبار الحالي؛ listening: هل يقبل أسئلة الاستماع */
export default function QuizImport({ quiz, uid, allowed, listening, nextOrder, onDone, onClose }) {
  const [quizzes, setQuizzes] = useState(null);
  const [srcId, setSrcId] = useState("");
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [busy, setBusy] = useState(false);

  // سبب عدم مناسبة السؤال للاختبار الحالي (أو null)
  const why = (r) => (!allowed.includes(r.kind) ? `«${KIND_LABEL[r.kind] ?? r.kind}» لا يُضاف في هذا النوع`
    : r.listening && !listening ? "سؤال استماع: للاختبار الإلكتروني بالإنجليزية فقط" : null);

  useEffect(() => {
    supabase.from("quizzes").select("id, title, mode, created_at").eq("teacher_id", uid).neq("id", quiz.id)
      .neq("mode", "external").order("created_at", { ascending: false })
      .then(({ data }) => setQuizzes(data ?? []));
  }, [uid, quiz.id]);

  useEffect(() => {
    if (!srcId) { setRows(null); return; }
    setRows(null);
    supabase.from("quiz_questions").select("*").eq("quiz_id", srcId).order("sort_order").then(({ data }) => {
      const list = data ?? [];
      setRows(list);
      setPicked(new Set(list.filter((r) => !why(r)).map((r) => r.id)));
    });
  }, [srcId]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = (rows ?? []).filter((r) => !why(r));
  const toggle = (id) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = async () => {
    setBusy(true);
    const chosen = ok.filter((r) => picked.has(r.id));
    const { data, error, lostImages } = await copyQuestionsInto(quiz, chosen, nextOrder);
    setBusy(false);
    if (error) { onDone([], { ok: false, text: "تعذّر الاستيراد: " + error.message }); return; }
    const skipped = (rows ?? []).length - ok.length;
    onDone(data, { ok: true, text: [
      `استُورد ${chosen.length} سؤالًا.`,
      skipped ? `لم يُستورد ${skipped} لا يناسب نوع هذا الاختبار.` : "",
      lostImages ? `تعذّر نسخ ${lostImages} صورة، فأضفها يدويًا.` : "",
      "راجع مجموع الدرجات.",
    ].filter(Boolean).join(" ") });
  };

  const src = quizzes?.find((x) => x.id === srcId);
  return (
    <div className="card space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">استيراد أسئلة من اختبار آخر</p>
        <button type="button" className="text-xs text-muted underline" onClick={onClose}>إغلاق</button>
      </div>
      <select className="field" value={srcId} onChange={(e) => setSrcId(e.target.value)}>
        <option value="">{quizzes === null ? "جارٍ التحميل…" : quizzes.length ? "— اختر الاختبار —" : "لا اختبارات أخرى"}</option>
        {(quizzes ?? []).map((x) => <option key={x.id} value={x.id}>{x.title} · {MODE_LABEL[x.mode] ?? ""}</option>)}
      </select>
      {srcId && rows === null && <p className="text-xs text-muted">جارٍ تحميل الأسئلة…</p>}
      {rows && !rows.length && <p className="text-xs text-muted">لا أسئلة في «{src?.title}».</p>}
      {rows && rows.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-xs">
            <button type="button" className="text-mint-deep underline" onClick={() => setPicked(new Set(ok.map((r) => r.id)))}>تحديد الكل</button>
            <button type="button" className="text-muted underline" onClick={() => setPicked(new Set())}>إلغاء التحديد</button>
            <span className="num text-muted">المحدد {picked.size} من {ok.length}</span>
          </div>
          <ul className="max-h-80 divide-y divide-line/60 overflow-y-auto rounded-card border border-line/60">
            {rows.map((r, i) => {
              const bad = why(r);
              return (
                <li key={r.id}>
                  <label className={`flex items-start gap-2 px-3 py-2 text-sm ${bad ? "opacity-60" : "cursor-pointer hover:bg-canvas"}`}>
                    <input type="checkbox" className="mt-1 accent-[#3E6350]" disabled={!!bad}
                           checked={!bad && picked.has(r.id)} onChange={() => toggle(r.id)} />
                    <span className="num mt-0.5 text-xs text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ink">{preview(r.text)}</span>
                      <span className="text-[11px] text-muted">
                        {KIND_LABEL[r.kind] ?? r.kind} · <bdi className="num">{r.marks}</bdi> درجة{r.image_path ? " · بصورة" : ""}
                        {bad && <span className="text-late"> · {bad}</span>}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn-primary w-full" disabled={!picked.size || busy} onClick={run}>
            {busy ? "جارٍ الاستيراد…" : `استيراد ${picked.size} سؤالًا`}
          </button>
        </>
      )}
    </div>
  );
}
