// src/components/QBankBrowser.jsx
/* =====================================================================
   بنك الأسئلة — تصفّح وبحث بالمادة والصف والنوع والصعوبة والدرس، واسم المعلم الذي أضاف
   كل سؤال. وضعان:
   • mode="page": صفحة البنك؛ في «أسئلتي» يشارك المعلم أسئلته ويحدد درسها وصعوبتها.
   • mode="pick": «إضافة من البنك» في محرر الاختبار؛ تُنسخ الأسئلة المختارة بصورها.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES } from "../lib/schoolTime";
import { KIND_LABEL, DIFFICULTY, diffOf, preview, answerText, copyQuestionsInto } from "../lib/qbank.js";

const PAGE = 60;
const teacherName = (n) => (!n ? "—" : /^(الأستاذ|أ\.)/.test(n) ? n : `أ. ${n}`);

export default function QBankBrowser({ mode = "page", uid, quiz, allowed, listening, nextOrder, onDone, onClose }) {
  const pick = mode === "pick";
  const [scope, setScope] = useState("school");
  const [f, setF] = useState({ subject: quiz?.subject_name ?? "", grade: quiz?.grade ?? "", kind: "", diff: "", lesson: "", text: "" });
  const [subjects, setSubjects] = useState([]);
  const [rows, setRows] = useState(null);
  const [count, setCount] = useState(0);
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tick, setTick] = useState(0);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setLimit(PAGE); };

  useEffect(() => { supabase.rpc("qbank_subjects").then(({ data }) => setSubjects(data ?? [])); }, [tick]);
  useEffect(() => {
    let live = true;
    const h = setTimeout(async () => {
      let q = supabase.from("qbank").select("id, owner_id, owner_name, subject_name, grade, lesson, difficulty, kind, body, q, shared, uses, created_at", { count: "exact" });
      q = scope === "mine" ? q.eq("owner_id", uid) : q.eq("shared", true);
      if (f.subject) q = q.eq("subject_name", f.subject);
      if (f.grade) q = q.eq("grade", Number(f.grade));
      if (f.kind) q = q.eq("kind", f.kind);
      if (f.diff) q = q.eq("difficulty", f.diff);
      if (f.lesson.trim()) q = q.ilike("lesson", `%${f.lesson.trim()}%`);
      if (f.text.trim()) q = q.ilike("body", `%${f.text.trim()}%`);
      const { data, count: n, error } = await q.order("uses", { ascending: false }).order("created_at", { ascending: false }).range(0, limit - 1);
      if (!live) return;
      if (error) setMsg({ ok: false, t: /qbank/.test(error.message) ? "البنك يحتاج تشغيل supabase/qbank_1.sql و qbank_2.sql." : error.message });
      setRows(data ?? []); setCount(n ?? 0);
    }, 250);
    return () => { live = false; clearTimeout(h); };
  }, [scope, f, limit, uid, tick]);

  // في الإضافة: سبب عدم مناسبة السؤال لنوع الاختبار
  const why = (r) => (!pick ? null : !allowed.includes(r.kind) ? `«${KIND_LABEL[r.kind] ?? r.kind}» لا يُضاف في هذا الاختبار`
    : r.q?.listening && !listening ? "سؤال استماع" : null);
  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const chosen = useMemo(() => (rows ?? []).filter((r) => sel.has(r.id)), [rows, sel]);

  const add = async () => {
    setBusy(true);
    const { data, error, lostImages } = await copyQuestionsInto(quiz, chosen.map((r) => r.q), nextOrder);
    if (!error) await supabase.rpc("qbank_used", { p_ids: chosen.map((r) => r.id) });
    setBusy(false);
    if (error) { onDone([], { ok: false, text: "تعذّرت الإضافة: " + error.message }); return; }
    onDone(data, { ok: true, text: [`أُضيف ${chosen.length} سؤالًا من البنك.`, lostImages ? `تعذّر نسخ ${lostImages} صورة، فأضفها يدويًا.` : "", "راجع الدرجات ومجموعها."].filter(Boolean).join(" ") });
  };
  const bulk = async (patch, text) => {
    setBusy(true);
    const { data, error } = await supabase.rpc("qbank_set", { p_ids: [...sel], p_shared: patch.shared ?? null, p_lesson: patch.lesson ?? null, p_difficulty: patch.difficulty ?? null });
    setBusy(false);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: `${text} (${data ?? 0}).` });
    setTick((n) => n + 1);
  };
  const remove = async () => {
    if (!window.confirm(`حذف ${sel.size} سؤالًا من بنكك؟ تبقى في اختباراتها كما هي.`)) return;
    await supabase.from("qbank").delete().in("id", [...sel]);
    setSel(new Set()); setTick((n) => n + 1);
  };

  return (
    <div className={pick ? "card space-y-3 p-4" : "space-y-3"}>
      {pick && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">إضافة أسئلة من بنك الأسئلة</p>
          <button type="button" className="text-xs text-muted underline" onClick={onClose}>إغلاق</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {[["school", "بنك المدرسة"], ["mine", "أسئلتي"]].map(([k, t]) => (
          <button key={k} type="button" onClick={() => { setScope(k); setSel(new Set()); setLimit(PAGE); }}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium ${scope === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>{t}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <select className="field" value={f.subject} onChange={(e) => set("subject", e.target.value)}>
          <option value="">كل المواد</option>
          {subjects.map((s) => <option key={s.subject_name} value={s.subject_name}>{s.subject_name}</option>)}
          {f.subject && !subjects.some((s) => s.subject_name === f.subject) && <option value={f.subject}>{f.subject}</option>}
        </select>
        <select className="field" value={f.grade} onChange={(e) => set("grade", e.target.value)}>
          <option value="">كل الصفوف</option>{[1, 2, 3].map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
        </select>
        <select className="field" value={f.kind} onChange={(e) => set("kind", e.target.value)}>
          <option value="">كل الأنواع</option>{Object.entries(KIND_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <select className="field" value={f.diff} onChange={(e) => set("diff", e.target.value)}>
          <option value="">كل المستويات</option>{DIFFICULTY.map((d) => <option key={d.k} value={d.k}>{d.t}</option>)}
        </select>
        <input className="field" placeholder="الدرس أو الوحدة" value={f.lesson} onChange={(e) => set("lesson", e.target.value)} />
        <input className="field" placeholder="بحث في نص السؤال" value={f.text} onChange={(e) => set("text", e.target.value)} />
      </div>
      {msg && <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

      {scope === "mine" && !pick && sel.size > 0 && <MineBar n={sel.size} busy={busy} bulk={bulk} remove={remove} />}

      {!rows ? <p className="text-sm text-muted">جارٍ التحميل…</p> : !rows.length ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">{scope === "mine"
          ? "لا أسئلة بهذه التصفية. أسئلة اختباراتك تدخل بنكك تلقائيًا."
          : "لا أسئلة مشاركة بهذه التصفية بعد. شارك أسئلتك من «أسئلتي»."}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span><span className="num">{count}</span> سؤالًا</span>
            {(pick || scope === "mine") && <>
              <button type="button" className="text-mint-deep underline" onClick={() => setSel(new Set(rows.filter((r) => !why(r)).map((r) => r.id)))}>تحديد المعروض</button>
              <button type="button" className="underline" onClick={() => setSel(new Set())}>إلغاء التحديد</button>
              <span className="num">المحدد {sel.size}</span>
            </>}
          </div>
          <ul className={`space-y-2 ${pick ? "max-h-[28rem] overflow-y-auto" : ""}`}>
            {rows.map((r) => <Item key={r.id} r={r} bad={why(r)} selectable={pick || scope === "mine"} checked={sel.has(r.id)} onCheck={() => toggle(r.id)} mine={r.owner_id === uid} />)}
          </ul>
          {rows.length < count && <button type="button" className="w-full text-sm text-mint-deep underline" onClick={() => setLimit((n) => n + PAGE)}>عرض المزيد</button>}
        </>
      )}
      {pick && <button type="button" className="btn-primary w-full" disabled={!chosen.length || busy} onClick={add}>
        {busy ? "جارٍ الإضافة…" : `إضافة ${chosen.length} سؤالًا إلى الاختبار`}</button>}
    </div>
  );
}

function MineBar({ n, busy, bulk, remove }) {
  const [lesson, setLesson] = useState("");
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3 text-xs">
      <span className="font-semibold text-ink">المحدد <span className="num">{n}</span>:</span>
      <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => bulk({ shared: true }, "شوركت مع معلمي المدرسة")}>مشاركة</button>
      <button className="rounded-pill border border-line px-3 py-1.5 text-muted hover:bg-canvas" disabled={busy} onClick={() => bulk({ shared: false }, "أُلغيت المشاركة")}>إلغاء المشاركة</button>
      {DIFFICULTY.map((d) => <button key={d.k} className={`rounded-pill px-3 py-1.5 font-semibold ${d.c}`} disabled={busy} onClick={() => bulk({ difficulty: d.k }, `صارت «${d.t}»`)}>{d.t}</button>)}
      <input className="field w-48 py-1 text-xs" placeholder="الدرس أو الوحدة" value={lesson} onChange={(e) => setLesson(e.target.value)} />
      <button className="rounded-pill border border-line px-3 py-1.5 text-muted hover:bg-canvas" disabled={busy || !lesson.trim()} onClick={() => bulk({ lesson }, "حُدّد الدرس")}>تحديد الدرس</button>
      <button className="mr-auto text-absent underline" disabled={busy} onClick={remove}>حذف من بنكي</button>
    </div>
  );
}

function Item({ r, bad, selectable, checked, onCheck, mine }) {
  const q = r.q ?? {}, d = diffOf(r.difficulty), ans = answerText(q);
  return (
    <li className={`card p-3 ${bad ? "opacity-60" : ""} ${checked ? "ring-1 ring-mint-deep" : ""}`}>
      <label className={`flex items-start gap-2 ${selectable && !bad ? "cursor-pointer" : ""}`}>
        {selectable && <input type="checkbox" className="mt-1 accent-[#3E6350]" disabled={!!bad} checked={!bad && checked} onChange={onCheck} />}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{preview(r.body, 400)}</p>
          {r.kind === "mcq" && Array.isArray(q.options) && (
            <div className="flex flex-wrap gap-1.5">{q.options.map((o, i) => (
              <span key={i} className={`rounded-sm2 px-2 py-0.5 text-xs ${o === ans ? "bg-present/10 font-semibold text-present" : "bg-canvas text-muted"}`}>{String(o)}</span>
            ))}</div>
          )}
          {r.kind === "truefalse" && ans && <p className="text-xs text-present">الإجابة: {ans}</p>}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
            <span className="chip bg-mint-tint text-mint-deep">{KIND_LABEL[r.kind] ?? r.kind}</span>
            {d && <span className={`chip ${d.c}`}>{d.t}</span>}
            {r.lesson && <span className="chip bg-canvas text-ink">{r.lesson}</span>}
            <span>{r.subject_name ?? "—"}{r.grade ? ` · ${GRADE_NAMES[r.grade] ?? r.grade}` : ""}</span>
            {q.image_path && <span>· بصورة</span>}
            <span>· <span className="num">{q.marks ?? 1}</span> درجة</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-1.5 text-[11px]">
            <span className="font-semibold text-ink">أضافه: {teacherName(r.owner_name)}</span>
            {r.uses > 0 && <span className="text-muted">· استُخدم <span className="num">{r.uses}</span> مرة</span>}
            {mine && <span className={`chip ${r.shared ? "bg-present/10 text-present" : "bg-canvas text-muted"}`}>{r.shared ? "مشارك" : "خاص بي"}</span>}
            {bad && <span className="text-late">· {bad}</span>}
          </div>
        </div>
      </label>
    </li>
  );
}
