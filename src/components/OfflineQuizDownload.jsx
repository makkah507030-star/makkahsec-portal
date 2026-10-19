// src/components/OfflineQuizDownload.jsx
// صفحة الاختبار دون إنترنت في البوابة (للطالب، داخل /quiz/:id): تنزيل الاختبار مقفلًا على
// الجوال مع صفحة أدائه، فيعمل في الحصة دون إنترنت (src/lib/offlineQuiz.js و sw.js).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { ensureServiceWorker } from "../lib/push.js";
import { buildLabFile } from "../pages/lab/labFile.js";
import { listPackages, savePackage, savePage } from "../lib/offlineQuiz.js";

// أين يعمل الجوال: iPhone يفصل ذاكرة Safari عن أيقونة البوابة على الشاشة الرئيسية،
// فيُفتح الاختبار في الحصة من المكان نفسه الذي نُزّل منه
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isApp = () => window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;

// نافذة «إضافة إلى الشاشة الرئيسية» في أندرويد (Chrome يطلقها حين يكون الموقع قابلًا للتثبيت)
let installEvent = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });
}

function Downloaded({ quizId }) {
  const addr = `${location.host}/offline-quiz`;
  const ios = isIos(), app = isApp();
  const [canInstall, setCanInstall] = useState(!!installEvent);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const install = async () => { installEvent?.prompt(); await installEvent?.userChoice; installEvent = null; setCanInstall(false); };
  const copy = () => navigator.clipboard?.writeText(`https://${addr}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });

  return (
    <div className="space-y-3 rounded-card bg-present/10 px-3 py-3 text-sm leading-relaxed">
      <p className="font-bold text-present">نُزّل الاختبار على هذا الجوال ✓</p>
      <div className="space-y-1.5">
        <p className="font-semibold text-ink">يوم الاختبار في الفصل (دون إنترنت):</p>
        <p className="text-ink">
          اضغط <b>رابط الاختبار نفسه</b> الذي فتحت منه هذه الصفحة (الإشعار أو الرابط المرسل لك)، ولو دون إنترنت، فيفتح الاختبار مباشرة.
        </p>
        {app ? (
          <p className="text-xs text-muted">أو اضغط <b>أيقونة البوابة على الشاشة الرئيسية</b> — نفس الأيقونة التي نزّلت منها الآن.</p>
        ) : (
          <>
            <p className="text-xs text-muted">أو افتح <b>{ios ? "Safari" : "المتصفح نفسه"}</b> واكتب هذا العنوان:</p>
            <div className="flex items-center gap-2">
              <a href="/offline-quiz" dir="ltr" className="flex-1 rounded-card border border-present/30 bg-paper px-3 py-2 text-center font-bold text-ink">{addr}</a>
              <button type="button" className="btn-ghost shrink-0" onClick={copy}>{copied ? "نُسخ ✓" : "نسخ"}</button>
            </div>
          </>
        )}
        <p className="text-ink">ثم امسح <b>مفتاح الفتح</b> من السبورة أو اكتبه، فيبدأ وقتك. وبعد التسليم اعرض <b>رمز التسليم</b> على معلمك ليمسحه.</p>
      </div>

      {!app && !ios && (
        <div className="space-y-1.5 rounded-card bg-paper px-3 py-2.5">
          <p className="font-semibold text-ink">الأسهل: أضف البوابة إلى الشاشة الرئيسية</p>
          {canInstall
            ? <button type="button" className="btn-primary w-full" onClick={install}>إضافة إلى الشاشة الرئيسية</button>
            : <p className="text-xs text-muted">من قائمة المتصفح <b>⋮</b> اختر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق».</p>}
          <p className="text-xs text-muted">في الحصة اضغط الأيقونة فتظهر صفحة الاختبار مباشرة.</p>
        </div>
      )}
      {!app && ios && (
        <p className="rounded-card bg-warning-light px-3 py-2 text-xs leading-relaxed text-late">
          في iPhone: الاختبار محفوظ في <b>Safari</b> فافتحه منه في الحصة. لا تضف البوابة إلى الشاشة الرئيسية الآن؛ فالأيقونة الجديدة
          لا ترى ما نزّلته في Safari. ولتسهيل الوصول أضف العنوان إلى المفضلة: زر المشاركة ← «إضافة إلى المفضلة».
        </p>
      )}

      <p className="text-xs text-muted">افتح الرابط في Safari أو Chrome لا داخل تطبيق آخر. والأسئلة مقفلة على جوالك حتى الحصة؛ لا تحذف بيانات المتصفح ولا تستخدم التصفح الخفي.</p>
      <a href={`/offline-quiz?q=${quizId}`} className="btn-primary flex w-full justify-center">فتح الاختبار (للتجربة الآن)</a>
      <p className="text-center text-[11px] text-muted">يفتح الاختبار مقفلًا؛ لا يبدأ وقتك إلا بمفتاح المعلم في الحصة.</p>
    </div>
  );
}

export default function OfflineQuizDownload({ quizId, info, online, onDone }) {
  const [local, setLocal] = useState(undefined);   // الحزمة المحفوظة على هذا الجهاز
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const check = () => listPackages().then((l) => setLocal(l.find((r) => r.quiz_id === quizId) ?? null)).catch(() => setLocal(null));
  useEffect(() => { check(); }, [quizId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fresh = local && info?.ver === local.ver;
  const opensAt = online?.opens_at ? new Date(online.opens_at) : null;
  const notYet = opensAt && opensAt > new Date();

  const download = async () => {
    if (!("caches" in window) || !("serviceWorker" in navigator)) {
      setErr("هذا المتصفح لا يدعم حفظ الاختبار. استخدم Safari أو Chrome بإصدار حديث.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const { data: rec, error } = await supabase.rpc("quiz_offline_download", { p_quiz: quizId });
      if (error) throw error;
      const html = await buildLabFile({ mode: "oq", title: "الاختبار دون إنترنت" });
      await savePackage(rec);
      await savePage(html);
      await ensureServiceWorker();
      await navigator.serviceWorker.ready;
      navigator.storage?.persist?.().catch(() => {});
      await check();
      onDone?.();
    } catch (e) {
      setErr(`تعذّر التنزيل: ${e.message ?? e}`);
    }
    setBusy(false);
  };

  if (local === undefined) return null;
  return (
    <div className="mt-4 space-y-3">
      {fresh ? (
        <Downloaded quizId={quizId} />
      ) : (
        <>
          <div className="rounded-card bg-mint-tint px-3 py-2.5 text-sm leading-relaxed text-ink">
            <p className="font-bold">هذا الاختبار يؤدّى في الحصة دون إنترنت</p>
            <p className="mt-1">نزّله الآن على جوالك وأنت متصل. يبقى مقفلًا حتى يعرض معلمك مفتاح الفتح في الحصة.</p>
            {isIos() && !isApp() && (
              <p className="mt-1.5 text-xs text-late">في iPhone: إن كنت تفتح البوابة عادةً من أيقونتها على الشاشة الرئيسية فنزّل الاختبار من داخلها لا من Safari.</p>
            )}
          </div>
          {local && <p className="rounded-card bg-warning-light px-3 py-2 text-xs text-late">أعاد المعلم تجهيز الاختبار بعد تنزيلك له — نزّله من جديد.</p>}
          {notYet ? (
            <p className="rounded-card bg-warning/10 px-3 py-2 text-sm text-warning">يُتاح التنزيل {fmtDateTime(online.opens_at)}</p>
          ) : (
            <button className="btn-primary w-full" disabled={busy} onClick={download}>
              {busy ? "جارٍ التنزيل…" : local ? "تنزيل النسخة الجديدة" : "تنزيل الاختبار على جوالي"}
            </button>
          )}
        </>
      )}
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
    </div>
  );
}
