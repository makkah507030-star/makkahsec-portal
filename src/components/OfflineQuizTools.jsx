// src/components/OfflineQuizTools.jsx
// أدوات المعلم في «الاختبار دون إنترنت» (تحت «الإطلاق والمتابعة»):
// • تجهيز الحزمة المشفّرة (src/lib/offlineQuizBuild.js) وإعادة تجهيزها بعد تعديل الأسئلة.
// • عرض مفتاح الفتح على السبورة في بداية الحصة.
// • مسح رموز التسليم من جوالات الطلاب، فتُصحَّح وتُرصد (quiz_offline_scan).
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { fmtKey, keyQr } from "../lib/offlineQuiz.js";
import { buildOfflinePackage } from "../lib/offlineQuizBuild.js";
import LabScanner from "../pages/lab/LabScanner.jsx";
import { OFFLINE_NOTE, OFFLINE_SCENARIO } from "../lib/offlineQuizGuide.js";

/** التعريف بالنوع ومثال الخطوات (مطويًّا أو ظاهرًا) */
export function OfflineQuizIntro({ open = false }) {
  return (
    <div className="space-y-2">
      <p className="rounded-sm2 border-r-4 border-mint-deep bg-mint-tint px-3 py-2 text-xs leading-relaxed text-ink">{OFFLINE_NOTE}</p>
      <details className="rounded-card border border-line bg-paper" open={open}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-mint-deep">مثال: كيف يسير الاختبار من البداية إلى النهاية؟</summary>
        <ol className="space-y-2 border-t border-line px-3 py-2.5">
          {OFFLINE_SCENARIO.map(([when, what], i) => (
            <li key={when} className="flex gap-2 text-xs leading-relaxed">
              <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-deep text-[10px] font-bold text-white">{i + 1}</span>
              <span><b className="text-ink">{when}:</b> <span className="text-muted">{what}</span></span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export default function OfflineQuizTools({ quiz, viewOnly, onChanged }) {
  const [st, setSt] = useState(undefined);   // undefined = تحميل، null = لم تُجهَّز
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [scan, setScan] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc("quiz_offline_status", { p_quiz: quiz.id });
    if (error) { setErr(/quiz_offline/.test(error.message) ? "يلزم تشغيل ملفات supabase/quiz_offline_1.sql إلى _4 في قاعدة البيانات." : error.message); setSt(null); return; }
    setSt(data ?? null);
  };
  useEffect(() => { load(); }, [quiz.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const build = async () => {
    if (st && !window.confirm("إعادة تجهيز الاختبار؟\n\nيلزم بعدها كل من نزّله أن ينزّله من جديد، ويتغيّر مفتاح الفتح.")) return;
    setBusy(true); setErr("");
    try { await buildOfflinePackage(quiz); await load(); onChanged?.(); }
    catch (e) { setErr(`تعذّر التجهيز: ${e.message ?? e}`); }
    setBusy(false);
  };

  if (st === undefined) return null;
  const list = st?.students ?? [];
  const n = (f) => list.filter(f).length;

  return (
    <div className="space-y-3 rounded-card border border-mint-light bg-mint-tint/50 p-3">
      <p className="text-sm font-semibold text-ink">الأداء دون إنترنت</p>
      <OfflineQuizIntro />
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}
      {!st ? (
        <>
          <p className="text-xs leading-relaxed text-muted">جهّز نسخة الاختبار المشفّرة لينزّلها الطلاب على جوالاتهم قبل يوم الاختبار.</p>
          {!viewOnly && <button className="btn-primary w-full" disabled={busy} onClick={build}>{busy ? "جارٍ التجهيز…" : "تجهيز الاختبار للتنزيل"}</button>}
        </>
      ) : (
        <>
          <p className="text-[11px] text-faint">جُهّز {fmtDateTime(st.built_at)} · الإصدار <bdi className="num">{st.ver}</bdi> · <bdi className="num">{st.size_kb}</bdi> ك.ب</p>
          {n((s) => s.old && !s.submitted) > 0 && (
            <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
              <bdi className="num">{n((s) => s.old && !s.submitted)}</bdi> نزّلوا نسخة قديمة قبل إعادة التجهيز، ويلزمهم تنزيلها من جديد.
            </p>
          )}
          {!viewOnly && (
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary flex-1" onClick={() => setShowKey(true)}>عرض مفتاح الفتح على السبورة</button>
              <button className="btn-primary flex-1" onClick={() => setScan(true)}>مسح رموز التسليم</button>
              <button className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted" disabled={busy} onClick={build}>
                {busy ? "جارٍ التجهيز…" : "إعادة التجهيز بعد تعديل الأسئلة"}
              </button>
            </div>
          )}
          {list.some((s) => !s.downloaded && !s.submitted) && (
            <p className="text-xs leading-relaxed text-muted">
              لم ينزّله بعد: <span className="text-ink">{list.filter((s) => !s.downloaded && !s.submitted).map((s) => s.name).join("، ")}</span>
            </p>
          )}
        </>
      )}
      {showKey && <KeyBoard quiz={quiz} k={st.key} onClose={() => setShowKey(false)} />}
      {scan && <ScanBox onClose={() => { setScan(false); load(); onChanged?.(); }} />}
    </div>
  );
}

// المفتاح بملء الشاشة للسبورة: رمز QR يمسحه الطلاب، والحروف لمن تعذّرت كاميرته
function KeyBoard({ quiz, k, onClose }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(keyQr(k), { margin: 1, width: 640, errorCorrectionLevel: "M" }).then(setSrc); }, [k]);
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white p-6 text-center" dir="rtl">
      <p className="text-2xl font-bold text-ink">{quiz.title}</p>
      <p className="text-lg text-muted">افتح البوابة في جوالك، ثم امسح الرمز أو اكتب المفتاح</p>
      {src && <img src={src} alt="مفتاح الفتح" className="w-[min(60vh,80vw)]" />}
      <p className="num text-5xl font-bold tracking-widest text-mint-deep" dir="ltr">{fmtKey(k)}</p>
      <button className="btn-ghost mt-2" onClick={onClose}>إغلاق</button>
    </div>
  );
}

export function ScanResultBox({ r }) {
  if (r.error) return <p className="rounded-card bg-danger-light px-3 py-3 text-sm text-absent">{r.error}</p>;
  const dup = r.status === "dup";
  return (
    <div className={`rounded-card px-3 py-3 text-sm ${dup ? "bg-warning-light" : "bg-present/10"}`}>
      <p className={`font-bold ${dup ? "text-late" : "text-present"}`}>{dup ? "رُصد من قبل" : "رُصدت الدرجة ✓"}</p>
      <p className="mt-1 text-ink">{r.student}</p>
      <p className="text-xs text-muted">{r.title}</p>
      {r.score != null && <p className="mt-1 text-ink">الدرجة: <bdi className="num text-lg font-bold">{Number(r.score)}</bdi> من <bdi className="num">{Number(r.total)}</bdi></p>}
      {!dup && <p className="text-xs text-muted">مدة الأداء <bdi className="num">{r.minutes}</bdi> د · غادر صفحة الاختبار <bdi className="num">{r.leaves}</bdi> {r.leaves === 1 ? "مرة" : "مرات"}</p>}
    </div>
  );
}

function ScanBox({ onClose }) {
  const [last, setLast] = useState(null);
  const [count, setCount] = useState(0);
  const onCode = async (text) => {
    if (!/MKQ1\./.test(text)) { setLast({ error: "هذا ليس رمز تسليم اختبار." }); return; }
    const { data, error } = await supabase.rpc("quiz_offline_scan", { p_text: text });
    setLast(error ? { error: error.message } : data);
    if (!error && data?.status === "ok") { setCount((c) => c + 1); navigator.vibrate?.(80); }
  };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4" dir="rtl">
      <div className="card mx-auto max-w-md space-y-3 p-4">
        <div className="flex items-center gap-2">
          <p className="flex-1 font-bold text-ink">مسح رموز التسليم</p>
          <button className="btn-ghost" onClick={onClose}>إنهاء</button>
        </div>
        <LabScanner onCode={onCode} deniedText="لم يُسمح باستخدام الكاميرا. اسمح بها من إعدادات المتصفح، أو امسح رمز الطالب بكاميرا الجوال فيفتح رابط الرصد." />
        <p className="text-xs text-muted">وجّه الكاميرا إلى رمز التسليم على جوال الطالب · رُصد في هذه الجلسة <bdi className="num">{count}</bdi></p>
        {last && <ScanResultBox r={last} />}
      </div>
    </div>
  );
}
