import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import DfileReport from "../components/dfile/DfileReport.jsx";
import { loadPublic, visitPing, visitStart } from "../lib/dfile.js";

/* =====================================================================
   ملف المعلم الرقمي للزائر: /f/:code برابط ثابت أو بمسح الرمز (?q=1)، دون دخول.
   يكتب الزائر اسمه وجهته اختياريًا أو يتخطى، وتُسجَّل الزيارة ومدتها للمعلم.
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
  const via = new URLSearchParams(window.location.search).has("q") ? "qr" : "link";

  useEffect(() => {
    let alive = true;
    loadPublic(code).then((r) => alive && setRes(r), () => alive && setErr("تعذّر فتح الملف. تأكد من الاتصال ثم أعد المحاولة."));
    return () => { alive = false; };
  }, [code]);

  const start = async (n = "", o = "") => {
    const v = visit.current;
    if (v.started) return;
    v.started = true; v.t0 = Date.now();
    v.id = await visitStart(code, n, o, via);
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

  return (
    <div style={{ background: "var(--df-bg, #F3F6F4)" }}>
      {welcome && (
        <div className="mx-auto max-w-[860px] px-4 pt-4">
          <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); start(name, org); setWelcome(false); }}>
            <div>
              <h1 className="text-base font-bold text-ink">مرحبًا بك في ملف المعلم</h1>
              <p className="mt-0.5 text-sm text-muted">اكتب اسمك وجهتك ليعرف المعلم من اطّلع على ملفه. هذا اختياري.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="field" placeholder="الاسم" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="الاسم" />
              <input className="field" placeholder="الجهة، مثل مدير المدرسة" value={org} onChange={(e) => setOrg(e.target.value)} maxLength={80} aria-label="الجهة" />
              <button className="btn-primary" type="submit">دخول</button>
              <button className="btn-ghost" type="button" onClick={() => { start(); setWelcome(false); }}>تخطٍّ</button>
            </div>
          </form>
        </div>
      )}
      <DfileReport data={res.data} settings={res.settings} code={res.settings.code} />
    </div>
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
