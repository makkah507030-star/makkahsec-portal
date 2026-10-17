import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import DfileReport from "../components/dfile/DfileReport.jsx";
import { experience, loadPublic, visitNote, visitPing, visitStart } from "../lib/dfile.js";
import logoWhite from "../assets/icon-white.png";

/* =====================================================================
   ملف المعلم الرقمي للزائر: /f/:code برابط ثابت أو بمسح الرمز (?q=1) أو من رسالة
   واتساب المعلم (?w=1)، دون دخول. يظهر الترحيب وحده أولًا: يكتب الزائر اسمه وجهته
   اختياريًا أو يتخطى، ثم يظهر الملف من بطاقة المعلم. وتُسجَّل
   الزيارة ومدتها للمعلم، ويكتب ملاحظته للمعلم في سجل الزوار.
   ===================================================================== */

const AUTO_START = 15;   // ثانية: تُسجَّل الزيارة دون اسم إن لم يكتب الزائر ولم يتخطَّ
const PING = 20;         // ثانية بين كل تحديث لمدة الزيارة

export default function DfilePublic() {
  const { code } = useParams();
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [welcome, setWelcome] = useState(true);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
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

  // الترحيب وحده أولًا: يكتب الزائر اسمه وجهته أو يتخطى، ثم يظهر الملف من بطاقة المعلم
  const enter = (n = "", o = "") => { start(n, o); setWelcome(false); window.scrollTo(0, 0); };
  if (welcome) {
    const d = res.data ?? {};
    const exp = experience(res.settings, d.year);
    return (
      <div className="dfile df-gate" dir="rtl" data-subject={res.settings?.color || "science"}>
        <div className="df-gate-in">
          <img src={logoWhite} alt="" className="df-gate-logo" />
          <p className="df-gate-eye">مدرسة مكة الثانوية، ملف المعلم الرقمي{d.year ? `، ${d.year}هـ` : ""}</p>
          {d.name && <h1 className="df-gate-name">أ. {d.name}</h1>}
          <p className="df-gate-role">
            {[d.spec && `معلم ${d.spec}`, exp != null && `${exp} سنة خبرة`].filter(Boolean).join("، ")}
          </p>

          <form className="df-gate-card" onSubmit={(e) => { e.preventDefault(); enter(name, org); }}>
            <h2>مرحبًا بك في ملف المعلم</h2>
            <p>اكتب اسمك وجهتك ليعرف المعلم من اطّلع على ملفه، وتستطيع كتابة ملاحظتك له من الزر أسفل الصفحة. هذا اختياري.</p>
            <div className="df-gate-grid">
              <input placeholder="الاسم" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="الاسم" />
              <input placeholder="الجهة، مثل مدير المدرسة" value={org} onChange={(e) => setOrg(e.target.value)} maxLength={80} aria-label="الجهة" />
              <button className="df-gate-go" type="submit">دخول</button>
              <button className="df-gate-skip" type="button" onClick={() => enter()}>تخطٍّ</button>
            </div>
          </form>

          {res.settings?.code && <p className="df-gate-foot">رمز التحقق <span className="df-code">{res.settings.code}</span></p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--df-bg, #F3F6F4)" }}>
      <DfileReport data={res.data} settings={res.settings} code={res.settings.code} />
      <VisitorNote save={async (text) => {
        const id = await start(name, org);
        if (!id) throw new Error("تعذّر حفظ الملاحظة. أعد تحميل الصفحة ثم حاول مرة أخرى.");
        return visitNote(id, text);
      }} />
    </div>
  );
}

/* «اكتب ملاحظتك للمعلم»: زر ثابت أسفل الصفحة يفتح نافذة الملاحظة، وتُحفظ في سجل الزوار */
function VisitorNote({ save }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState("");   // "" | busy | saved | رسالة خطأ
  const send = async (e) => {
    e.preventDefault();
    setState("busy");
    try { await save(text); setState("saved"); }
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
