// src/components/QuizGenerate.jsx
// «توليد أسئلة بالمساعد الذكي» في محرّر الاختبار: يلصق المعلم نص الدرس (أو يرفع صفحاته PDF/صورة)،
// ويختار العدد لكل نمط والمستوى، فتُولَّد الأسئلة بصيغة البوابة (دالة الخادم ai-assistant مع Claude).
// النتيجة مسودة يراجعها المعلم: يختار منها ما يريد فيُضاف إلى الاختبار ويعدّله كأي سؤال.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { describeEdgeError } from "../lib/edgeError.js";
import { countAr } from "../lib/arabicCount.js";

const KINDS = [
  { key: "mcq", label: "اختيار من متعدد", def: 5 },
  { key: "truefalse", label: "صح وخطأ", def: 5 },
  { key: "match", label: "مزاوجة", def: 0, max: 4 },
];
const LEVELS = [["easy", "سهل"], ["mixed", "متدرج"], ["hard", "متقدم"]];
const LETTERS = ["أ", "ب", "ج", "د"];
// عدد الأسئلة مفعولًا به: «ولّد سؤالًا واحدًا / سؤالين / 10 أسئلة / 12 سؤالًا»
const qAcc = (n) => (n === 1 ? "سؤالًا واحدًا" : countAr(n, "question", { acc: true }));

// الملف base64 بلا مقدمة data:
const toBase64 = (file) => new Promise((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(",")[1] ?? "");
  r.onerror = fail;
  r.readAsDataURL(file);
});

/* allowed: الأنماط المسموحة في الاختبار الحالي */
export default function QuizGenerate({ quiz, allowed, nextOrder, onDone, onClose }) {
  const kinds = KINDS.filter((k) => allowed.includes(k.key));
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [counts, setCounts] = useState(() => Object.fromEntries(kinds.map((k) => [k.key, k.def])));
  const [level, setLevel] = useState("mixed");
  const [quota, setQuota] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState(new Set());

  useEffect(() => { supabase.rpc("ai_my_quota").then(({ data }) => setQuota(data ?? null)); }, []);
  const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
  const left = quota ? quota.limit - quota.used : null;

  const generate = async () => {
    setErr(""); setBusy(true);
    try {
      if (file && file.size > 5 * 1024 * 1024) throw new Error("الملف أكبر من 5 م.ب");
      const body = { task: "quiz_questions", quiz_id: quiz.id, lesson: { title, text }, counts, level,
        file: file ? { media_type: file.type, data: await toBase64(file) } : null };
      const { data, error } = await supabase.functions.invoke("ai-assistant", { body });
      if (error) throw new Error(/Failed to send|FunctionsFetchError|not found/i.test(error.message) && !error.context
        ? "المساعد الذكي لم يُفعَّل بعد في الخادم. أبلغ الدعم الفني." : await describeEdgeError(error));
      if (data?.error) throw new Error(data.error);
      setItems(data.questions ?? []);
      setPicked(new Set((data.questions ?? []).map((_, i) => i)));
      if (data.limit != null) setQuota({ used: data.used, limit: data.limit });
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const rows = items.filter((_, i) => picked.has(i)).map((q, i) => ({
      quiz_id: quiz.id, sort_order: nextOrder + i, kind: q.kind, text: q.text, marks: 1, options: q.options, answer: q.answer,
    }));
    if (!rows.length) return;
    setBusy(true);
    const { data, error } = await supabase.from("quiz_questions").insert(rows).select();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone(data ?? [], { ok: true, text: `أُضيف إلى الاختبار من المساعد الذكي: ${countAr(rows.length, "question")}. راجعها وعدّل ما تحتاج.` });
  };

  const toggle = (i) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="card space-y-4 border-2 border-mint-light p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 font-bold text-ink">✨ توليد أسئلة بالمساعد الذكي</p>
        {quota && <span className="chip bg-canvas text-muted">{`استخدمت هذا الشهر ${quota.used} من ${quota.limit}`}</span>}
        <button type="button" className="text-xs text-muted underline" onClick={onClose}>إغلاق</button>
      </div>

      {!items ? (
        <>
          <p className="rounded-card bg-mint-tint px-3 py-2 text-xs leading-relaxed text-ink">
            الصق نص الدرس أو ارفع صفحاته من الكتاب، فيكتب المساعد أسئلة منه وحده بأنماط اختبارك.
            النتيجة <b>مسودة تراجعها</b> قبل إضافتها، ولا يُرسل شيء من بيانات الطلاب.
          </p>
          <label className="block text-xs text-muted">عنوان الدرس
            <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: الروابط الكيميائية" />
          </label>
          <label className="block text-xs text-muted">نص الدرس
            <textarea rows={7} className="field mt-1" value={text} onChange={(e) => setText(e.target.value)}
                      placeholder="الصق هنا شرح الدرس أو ملخصه أو أهم فقراته…" />
          </label>
          <label className="block text-xs text-muted">أو صفحات الدرس (PDF أو صورة، حتى 5 م.ب)
            <input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="mt-1 block text-xs"
                   onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            {kinds.map((k) => (
              <label key={k.key} className="text-xs text-muted">{k.label}
                <input type="number" min={0} max={k.max ?? 30} className="field num mt-1 w-24" value={counts[k.key]}
                       onChange={(e) => setCounts((c) => ({ ...c, [k.key]: Math.max(0, Math.min(k.max ?? 30, Number(e.target.value) || 0)) }))} />
              </label>
            ))}
            <div className="text-xs text-muted">المستوى
              <div className="mt-1 flex gap-1">
                {LEVELS.map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setLevel(k)}
                    className={`rounded-pill px-3 py-1.5 text-xs font-semibold ${level === k ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
          <button type="button" className="btn-primary w-full"
                  disabled={busy || (!text.trim() && !file) || total < 1 || total > 30 || left === 0} onClick={generate}>
            {busy ? "جارٍ التوليد… قد يستغرق دقيقة" : left === 0 ? "بلغت حدّك الشهري" : `ولّد ${qAcc(total)}`}
          </button>
          {total > 30 && <p className="text-xs text-absent">الحد 30 سؤالًا في الطلب الواحد.</p>}
        </>
      ) : (
        <>
          <p className="text-sm text-ink">
            ولّد المساعد {qAcc(items.length)}. <b>راجع كل سؤال</b> واختر ما تضيفه، ثم عدّله في الاختبار كأي سؤال.
          </p>
          <div className="space-y-2">
            {items.map((q, i) => (
              <label key={i} className={`card flex cursor-pointer gap-3 p-3 ${picked.has(i) ? "" : "opacity-50"}`}>
                <input type="checkbox" className="mt-1" checked={picked.has(i)} onChange={() => toggle(i)} />
                <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                  <p className="text-[11px] text-muted">{KINDS.find((k) => k.key === q.kind)?.label}</p>
                  <p className="font-semibold text-ink">{q.text}</p>
                  {q.kind === "mcq" && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((o, k) => (
                        <span key={k} className={`chip ${String(k) === q.answer ? "bg-present/15 font-bold text-present" : "bg-canvas text-muted"}`}>{LETTERS[k]}) {o}</span>
                      ))}
                    </div>
                  )}
                  {q.kind === "truefalse" && <span className="chip bg-present/15 font-bold text-present">{q.answer === "true" ? "صح ✓" : "خطأ ✗"}</span>}
                  {q.kind === "match" && (
                    <div className="grid gap-1 text-xs">
                      {q.options.left.map((l, k) => (
                        <p key={k}><span className="text-ink">{l}</span> ← <b className="text-present">{q.options.right[Number(q.answer[String(k)])]}</b></p>
                      ))}
                    </div>
                  )}
                  {q.explanation && <p className="text-[11px] leading-relaxed text-faint">💡 {q.explanation}</p>}
                </div>
              </label>
            ))}
          </div>
          {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary flex-1" disabled={busy || !picked.size} onClick={add}>
              {busy ? "جارٍ الإضافة…" : `أضف المحدد (${picked.size}) إلى الاختبار`}
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setItems(null); setErr(""); }}>توليد آخر</button>
          </div>
          <p className="text-[11px] text-faint">الشرح 💡 للمراجعة فقط ولا يظهر للطلاب. وتُخلط الخيارات تلقائيًا.</p>
        </>
      )}
    </div>
  );
}
