// src/lab-player/ExamPlayer.jsx
// ملف الاختبار على أجهزة المعمل (mode: "exam")، يعمل دون إنترنت:
// ١. يختار الطالب فصله واسمه ورقم جهازه. ٢. يكتب مفتاح الفتح من السبورة فتُفك الأسئلة ويبدأ الوقت.
// ٣. يجيب (النظري: أسئلة بترتيب خاص به · العملي: مهام من تدريبات الدروس دون تصحيح فوري).
// ٤. عند التسليم أو انتهاء الوقت يظهر رمز QR موقّع: إجابات النظري (تُصحَّح عند المسح، فالإجابات الصحيحة ليست
//    في الملف)، أو نتيجة كل مهمة عملية. التقدم محفوظ على الجهاز فلا يضيع بإعادة الفتح.
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { examResultCode, openPayload, packAnswers, shuffle } from "../lib/labExam.js";
import { WIDGETS } from "../pages/lab/lessons/widgets.jsx";
import { store, Header, pc } from "./shared.jsx";

const LTRS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

export default function ExamPlayer({ data }) {
  const ex = data.exam;
  const K = `mke:${ex.code}`;
  const [st, setSt] = useState(() => store.get(K, {}));          // { cls, stu, seat, key, started, answers, values, submitted }
  const save = (patch) => setSt((o) => { const n = { ...o, ...patch }; store.set(K, n); return n; });
  const content = useMemo(() => (st.key ? openPayload(ex.sealed, st.key) : null), [st.key, ex.sealed]);
  const cls = st.cls != null ? ex.classes[st.cls] : null;
  const name = cls && st.stu != null ? cls.roster[st.stu] : null;

  const reset = () => { if (window.confirm("بدء طالب آخر على هذا الجهاز؟ تأكد أن المعلم مسح رمز الطالب السابق.")) { store.del(K); setSt({}); } };

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 p-4 sm:p-6">
      <Header title={ex.title} chip={name && <span className="chip bg-mint-tint text-mint-deep">{name}</span>} />
      {st.submitted ? <Submitted ex={ex} st={st} content={content} name={name} onNext={reset} />
        : st.cls == null ? <PickClass ex={ex} onPick={(i) => save({ cls: i })} />
        : st.stu == null ? <PickName cls={cls} onPick={(i, seat) => save({ stu: i, seat })} onBack={() => save({ cls: null })} />
        : !content ? <OpenKey ex={ex} onOpen={(k) => save({ key: k, started: st.started ?? Date.now() })} onBack={() => save({ stu: null })} />
        : <Run ex={ex} st={st} content={content} save={save} />}
    </div>
  );
}

function PickClass({ ex, onPick }) {
  useEffect(() => { if (ex.classes.length === 1) onPick(0); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card space-y-3 p-4">
      <p className="font-bold text-ink">١. اختر فصلك</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{ex.classes.map((c, i) => (
        <button key={i} type="button" className="btn-ghost num py-3 text-lg" onClick={() => onPick(i)}>{c.no}</button>))}</div>
    </div>
  );
}

function PickName({ cls, onPick, onBack }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(null);
  const [seat, setSeat] = useState("");
  const list = cls.roster.map((n, i) => ({ n, i })).filter((x) => !q.trim() || x.n.includes(q.trim()));
  return (
    <div className="card space-y-3 p-4">
      <p className="font-bold text-ink">٢. اختر اسمك <span className="text-sm font-normal text-muted">· فصل <bdi className="num">{cls.no}</bdi></span></p>
      <input className="field" placeholder="ابحث باسمك" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2">{list.map((x) => (
        <button key={x.i} type="button" onClick={() => setPick(x.i)}
                className={`rounded-card border px-3 py-2 text-right text-sm ${pick === x.i ? "border-mint-deep bg-mint-tint font-semibold" : "border-line bg-paper"}`}>{x.n}</button>))}</div>
      <label className="flex items-center gap-2 text-sm text-ink">رقم الجهاز <span className="text-[11px] text-muted">(على خلفية سطح المكتب)</span>
        <input dir="ltr" inputMode="numeric" className="field num w-24 text-center" value={seat} onChange={(e) => setSeat(e.target.value.replace(/\D/g, "").slice(0, 2))} /></label>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={onBack}>رجوع</button>
        <button type="button" className="btn-primary flex-1" disabled={pick == null} onClick={() => onPick(pick, Number(seat) || 0)}>متابعة</button>
      </div>
    </div>
  );
}

function OpenKey({ ex, onOpen, onBack }) {
  const [k, setK] = useState("");
  const [bad, setBad] = useState(false);
  const go = () => (openPayload(ex.sealed, k) ? onOpen(k) : setBad(true));
  return (
    <div className="card flex flex-col items-center gap-4 p-6 text-center">
      <p className="text-lg font-bold text-ink">٣. اكتب مفتاح الفتح الظاهر على السبورة</p>
      <p className="text-sm text-muted">يبدأ الوقت لحظة الفتح{ex.duration ? <> · المدة <span className="num">{ex.duration}</span> دقيقة</> : null}</p>
      <input dir="ltr" inputMode="numeric" autoFocus maxLength={6} value={k} placeholder="• • • • • •"
             className="field num max-w-[16rem] text-center text-3xl tracking-[0.4em]" onChange={(e) => { setK(e.target.value); setBad(false); }} onKeyDown={(e) => e.key === "Enter" && go()} />
      {bad && <p className="text-sm text-absent">مفتاح غير صحيح.</p>}
      <div className="flex w-full max-w-[16rem] gap-2">
        <button type="button" className="btn-ghost" onClick={onBack}>رجوع</button>
        <button type="button" className="btn-primary flex-1" disabled={k.trim().length < 6} onClick={go}>ابدأ</button>
      </div>
    </div>
  );
}

function Run({ ex, st, content, save }) {
  const theory = ex.kind === "theory";
  const items = theory ? content.questions : content.tasks;
  const order = useMemo(() => shuffle(items.map((_, i) => i), `${ex.code}:${st.cls}:${st.stu}`), [items, ex.code, st.cls, st.stu]);
  const [now, setNow] = useState(Date.now());
  const end = ex.duration ? st.started + ex.duration * 60000 : null;
  const submit = () => {
    const body = theory ? packAnswers(content.questions, st.answers ?? {})
      : content.tasks.map((t, i) => { const W = WIDGETS[t.widget]; const v = st.values?.[i]; return W && v != null && W.check(t.task, v) ? "1" : "0"; }).join("");
    save({ submitted: true, body });
  };
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (end && now >= end) submit(); }, [now]);   // eslint-disable-line react-hooks/exhaustive-deps
  const answered = theory ? items.filter((q) => st.answers?.[q.id] != null).length : items.filter((_, i) => st.values?.[i] != null).length;

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 flex items-center gap-3 rounded-card border border-line bg-white/95 px-3 py-2 backdrop-blur">
        <span className="num chip bg-canvas text-ink">{st.seat ? pc(st.seat) : "—"}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-pill bg-line/50"><div className="h-full bg-mint-deep" style={{ width: `${(answered / items.length) * 100}%` }} /></div>
        <span className="num text-xs text-muted">{answered}/{items.length}</span>
        {end && <span className={`num rounded-pill px-2.5 py-0.5 text-sm font-bold ${end - now < 300000 ? "bg-danger-light text-absent" : "bg-mint-tint text-mint-deep"}`}>{clock(end - now)}</span>}
      </div>
      {order.map((idx, n) => (theory
        ? <Question key={items[idx].id} q={items[idx]} n={n + 1} value={st.answers?.[items[idx].id]} onChange={(v) => save({ answers: { ...(st.answers ?? {}), [items[idx].id]: v } })} />
        : <Task key={idx} t={items[idx]} n={n + 1} value={st.values?.[idx]} onChange={(v) => save({ values: { ...(st.values ?? {}), [idx]: v } })} />))}
      <button type="button" className="btn-primary w-full py-3 text-base"
              onClick={() => { if (answered < items.length && !window.confirm(`لم تُجب ${items.length - answered} — هل تسلّم؟`)) return; if (window.confirm("تسليم نهائي؟ لا يمكن التعديل بعده.")) submit(); }}>تسليم الاختبار</button>
    </div>
  );
}

function Question({ q, n, value, onChange }) {
  return (
    <div className="card space-y-2.5 p-4">
      <p className="font-semibold leading-relaxed text-ink"><span className="num me-2 inline-grid h-6 w-6 place-items-center rounded-full bg-mint-deep align-middle text-[11px] font-bold text-white">{n}</span>{q.text} <span className="num text-[11px] font-normal text-muted">({q.marks})</span></p>
      {q.kind === "mcq" && <div className="grid gap-1.5 sm:grid-cols-2">{q.options.map((o, k) => (
        <button key={k} type="button" onClick={() => onChange(String(k))}
                className={`rounded-card border px-3 py-2 text-right text-sm ${String(value) === String(k) ? "border-mint-deep bg-mint-tint font-semibold" : "border-line bg-paper"}`}>{LTRS[k]}) {o}</button>))}</div>}
      {q.kind === "truefalse" && <div className="flex gap-2">{[["true", "صح"], ["false", "خطأ"]].map(([v, t]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className={`flex-1 rounded-card border py-2 text-sm ${value === v ? "border-mint-deep bg-mint-tint font-bold" : "border-line bg-paper"}`}>{t}</button>))}</div>}
      {q.kind === "match" && (
        <div className="space-y-1.5">
          <div className="grid gap-1 rounded-sm2 bg-canvas p-2 text-[12.5px] sm:grid-cols-2">{q.options.right.map((r, k) => <span key={k}><b>{LTRS[k]})</b> {r}</span>)}</div>
          {q.options.left.map((l, k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-ink">{l}</span>
              <select className="field w-24 py-1.5" value={value?.[String(k)] ?? ""} onChange={(e) => onChange({ ...(value ?? {}), [String(k)]: e.target.value === "" ? undefined : e.target.value })}>
                <option value="">—</option>{q.options.right.map((_, j) => <option key={j} value={String(j)}>{LTRS[j]}</option>)}</select>
            </div>))}
        </div>)}
    </div>
  );
}

function Task({ t, n, value, onChange }) {
  const W = WIDGETS[t.widget];
  if (!W) return null;
  const v = value ?? W.initial(t.task);
  return (
    <div className="card space-y-3 p-4">
      <p className="font-semibold text-ink"><span className="num me-2 inline-grid h-6 w-6 place-items-center rounded-full bg-mint-deep align-middle text-[11px] font-bold text-white">{n}</span>{t.title} <span className="num text-[11px] font-normal text-muted">({t.marks})</span></p>
      <p className="text-sm text-ink">{W.prompt(t.task)}</p>
      <W.Input task={t.task} value={v} setValue={onChange} disabled={false} />
    </div>
  );
}

function Submitted({ ex, st, name, onNext }) {
  const [src, setSrc] = useState("");
  const text = examResultCode({ code: ex.code, secret: ex.secret, cls: st.cls, stu: st.stu, seat: st.seat, body: st.body ?? "" });
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setSrc); }, [text]);
  return (
    <div className="card flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-lg font-bold text-present">تم التسليم ✓</p>
      <p className="text-sm text-ink">{name} · فصل <bdi className="num">{ex.classes[st.cls]?.no}</bdi>{st.seat ? <> · <bdi className="num">{pc(st.seat)}</bdi></> : null}</p>
      {src && <img src={src} alt="رمز التسليم" className="w-72 max-w-full" />}
      <p className="text-sm text-muted">اعرض الرمز على معلمك ليمسحه. لا تغلق هذه الصفحة حتى يُرصد.</p>
      <button type="button" className="text-xs text-muted underline" onClick={onNext}>طالب آخر على هذا الجهاز</button>
    </div>
  );
}
