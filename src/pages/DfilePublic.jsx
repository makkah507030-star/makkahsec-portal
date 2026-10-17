import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import DfileReport from "../components/dfile/DfileReport.jsx";
import { loadPublic, visitNote, visitPing, visitStart, visitWho } from "../lib/dfile.js";

/* =====================================================================
   ملف المعلم الرقمي للزائر: /f/:code برابط ثابت أو بمسح الرمز (?q=1) أو من رسالة
   واتساب المعلم (?w=1)، دون دخول. الملف يظهر أولًا، وشريط صغير أسفل الشاشة يدعو الزائر
   إلى كتابة اسمه وجهته اختياريًا (تُضاف إلى زيارته متى كتبها). تُسجَّل الزيارة ومدتها
   للمعلم، ويكتب الزائر ملاحظته للمعلم في سجل الزوار.
   ===================================================================== */

const AUTO_START = 15;   // ثانية: تُسجَّل الزيارة دون اسم إن لم يكتب الزائر ولم يتخطَّ
const PING = 20;         // ثانية بين كل تحديث لمدة الزيارة

export default function DfilePublic() {
  const { code } = useParams();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState(true);          // شريط «عرّف المعلم بنفسك» أسفل الشاشة
  const [who, setWho] = useState({ name: "", org: "" });
  const [whoOpen, setWhoOpen] = useState(false);
  const visit = useRef({ id: null, started: false, t0: Date.now() });
  const qs = new URLSearchParams(window.location.search);
  const via = qs.has("q") ? "qr" : qs.has("w") ? "wa" : "link";

  useEffect(() => {
    let alive = true;
    loadPublic(code).then((r) => alive && setRes(r), () => alive && setErr("تعذّر فتح الملف. تأكد من الاتصال ثم أعد المحاولة."));
    return () => { alive = false; };
  }, [code]);

  const start = async (n = "", o = "") => {
    const v = visit.current;
    if (v.started) return v.ready;
    v.started = true; v.t0 = Date.now();
    v.ready = visitStart(code, n, o, via).then((id) => (v.id = id));
    return v.ready;
  };

  // الاسم والجهة: يبدأ بهما الزيارة إن لم تبدأ، وإلا يُضافان إلى الزيارة القائمة
  const saveWho = async (name, org) => {
    if (!name.trim() && !org.trim()) return;
    if (!visit.current.started) { await start(name, org); }
    else {
      const id = await visit.current.ready;
      if (!id || !(await visitWho(id, name, org))) throw new Error("تعذّر حفظ اسمك. أعد تحميل الصفحة ثم حاول مرة أخرى.");
    }
    setWho({ name, org });
  };

  // تسجيل تلقائي بلا اسم، ثم تحديث المدة دوريًا وعند مغادرة الصفحة
  useEffect(() => {
    if (res?.status !== "ok") return undefined;
    const auto = setTimeout(() => start(), AUTO_START * 1000);
    const tick = setInterval(() => visitPing(visit.current.id, (Date.now() - visit.current.t0) / 1000), PING * 1000);
    const leave = () => { if (document.visibilityState === "hidden") visitPing(visit.current.id, (Date.now() - visit.current.t0) / 1000); };
    document.addEventListener("visibilitychange", leave);
    return () => { clearTimeout(auto); clearInterval(tick); document.removeEventListener("visibilitychange", leave); };
    // start ثابتة الأثر (تعتمد على ref)، ولا نريد إعادة الضبط عند كل رسم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res]);

  if (err) return <Note title="تعذّر فتح الملف" body={err} />;
  if (!res) return <Note title="جارٍ فتح الملف…" />;
  if (res.status !== "ok") return <Note title="هذا الملف غير متاح حاليًا" body="قد يكون الرابط غير صحيح، أو أُوقف الملف." />;

  const known = !!(who.name || who.org);
  return (
    <div style={{ background: "var(--df-bg, #F3F6F4)" }}>
      {/* الملف أولًا، والترحيب شريط صغير أسفل الشاشة لا يدفع الملف */}
      <DfileReport data={res.data} settings={res.settings} code={res.settings.code} />

      {ask && !known && (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[560px]" dir="rtl">
          <div className="card flex items-center gap-3 p-3">
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
              <b>مرحبًا بك.</b> <span className="text-muted">عرّف المعلم بنفسك ليعرف من اطّلع على ملفه (اختياري).</span>
            </p>
            <button type="button" className="btn-primary shrink-0 px-3 py-2" onClick={() => setWhoOpen(true)}>اكتب اسمك</button>
            <button type="button" aria-label="إغلاق" onClick={() => { start(); setAsk(false); }}
                    className="shrink-0 rounded-sm2 p-1.5 text-muted hover:bg-canvas">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {whoOpen && (
        <WhoDialog initial={who} onClose={() => setWhoOpen(false)}
                   onSave={async (n, o) => { await saveWho(n, o); setWhoOpen(false); setAsk(false); }} />
      )}

      {/* زر الملاحظة يظهر بعد إغلاق الترحيب أو التعريف، فلا يتراكبان */}
      {(!ask || known) && (
        <VisitorNote known={known} save={async (text, n, o) => {
          if (!known && (n.trim() || o.trim())) await saveWho(n, o);
          const id = await start();
          if (!id) throw new Error("تعذّر حفظ الملاحظة. أعد تحميل الصفحة ثم حاول مرة أخرى.");
          return visitNote(id, text);
        }} />
      )}
    </div>
  );
}

/* نافذة الاسم والجهة */
function WhoDialog({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name);
  const [org, setOrg] = useState(initial.org);
  const [state, setState] = useState("");   // "" | busy | رسالة خطأ
  const send = async (e) => {
    e.preventDefault();
    setState("busy");
    try { await onSave(name.trim(), org.trim()); }
    catch (er) { setState(er.message || "تعذّر الحفظ."); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" dir="rtl" onClick={onClose}>
      <form className="card w-full max-w-md space-y-3 p-4" onSubmit={send} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold text-ink">مرحبًا بك في ملف المعلم</p>
          <p className="mt-0.5 text-sm text-muted">يظهر اسمك وجهتك للمعلم في سجل زوار ملفه.</p>
        </div>
        <WhoFields name={name} org={org} setName={setName} setOrg={setOrg} autoFocus />
        {state && state !== "busy" && <p className="text-sm text-absent">{state}</p>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" type="submit" disabled={state === "busy" || (!name.trim() && !org.trim())}>
            {state === "busy" ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>إغلاق</button>
        </div>
      </form>
    </div>
  );
}

function WhoFields({ name, org, setName, setOrg, autoFocus }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <input className="field" placeholder="الاسم" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)}
             maxLength={80} aria-label="الاسم" autoFocus={autoFocus} />
      <input className="field" placeholder="الجهة، مثل مدير المدرسة" value={org} onChange={(e) => setOrg(e.target.value)}
             maxLength={80} aria-label="الجهة" />
    </div>
  );
}

/* «اكتب ملاحظتك للمعلم»: زر ثابت أسفل الصفحة يفتح نافذة الملاحظة، وتُحفظ في سجل الزوار.
   ومن لم يعرّف بنفسه بعد يكتب اسمه وجهته فيها اختياريًا. */
function VisitorNote({ known, save }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [state, setState] = useState("");   // "" | busy | saved | رسالة خطأ
  const send = async (e) => {
    e.preventDefault();
    setState("busy");
    try { await save(text, name, org); setState("saved"); }
    catch (er) { setState(er.message || "تعذّر حفظ الملاحظة."); }
  };
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); if (state !== "busy") setState(""); }}
              className="fixed bottom-4 left-4 z-40 rounded-pill bg-mint-deep px-4 py-2.5 text-sm font-bold text-white shadow-card">
        {state === "saved" ? "✓ ملاحظتك وصلت" : "اكتب ملاحظتك للمعلم"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" dir="rtl" onClick={() => setOpen(false)}>
          <form className="card w-full max-w-md space-y-3 p-4" onSubmit={send} onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-base font-bold text-ink">ملاحظتك في سجل الزوار</p>
              <p className="mt-0.5 text-sm text-muted">يراها المعلم وحده، ويسعده توجيهك وملاحظاتك.</p>
            </div>
            {!known && <WhoFields name={name} org={org} setName={setName} setOrg={setOrg} />}
            <textarea className="field min-h-32" value={text} onChange={(e) => { setText(e.target.value); setState(""); }}
                      maxLength={1000} placeholder="اكتب ملاحظتك هنا" aria-label="الملاحظة" autoFocus />
            {state && state !== "busy" && (
              <p className={`text-sm ${state === "saved" ? "text-present" : "text-absent"}`}>
                {state === "saved" ? "حُفظت ملاحظتك، شكرًا لك. يمكنك تعديلها وحفظها مرة أخرى." : state}
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" type="submit" disabled={state === "busy" || !text.trim()}>
                {state === "busy" ? "جارٍ الحفظ…" : "حفظ الملاحظة"}
              </button>
              <button className="btn-ghost" type="button" onClick={() => setOpen(false)}>إغلاق</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function Note({ title, body }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6" dir="rtl">
      <div className="card max-w-sm p-6 text-center">
        <p className="text-base font-bold text-ink">{title}</p>
        {body && <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>}
      </div>
    </div>
  );
}
