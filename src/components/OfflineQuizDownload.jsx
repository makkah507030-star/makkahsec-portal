// src/components/OfflineQuizDownload.jsx
// صفحة الاختبار دون إنترنت في البوابة (للطالب، داخل /quiz/:id): تنزيل الاختبار مقفلًا على
// الجوال مع صفحة أدائه، فيعمل في الحصة دون إنترنت (src/lib/offlineQuiz.js و sw.js).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { ensureServiceWorker } from "../lib/push.js";
import { buildLabFile } from "../pages/lab/labFile.js";
import { listPackages, savePackage, savePage } from "../lib/offlineQuiz.js";

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
        <div className="space-y-2 rounded-card bg-present/10 px-3 py-3 text-sm leading-relaxed">
          <p className="font-bold text-present">نُزّل الاختبار على هذا الجوال ✓</p>
          <ol className="list-decimal space-y-1 pr-5 text-ink">
            <li>في الحصة افتح البوابة من هذا المتصفح نفسه، <b>ولو دون إنترنت</b>، فتظهر صفحة الاختبار.</li>
            <li>امسح <b>مفتاح الفتح</b> الذي يعرضه معلمك على السبورة، أو اكتبه، فيبدأ وقتك.</li>
            <li>بعد التسليم اعرض <b>رمز التسليم</b> على معلمك ليمسحه، فتُرصد درجتك.</li>
          </ol>
          <p className="text-xs text-muted">الأسئلة مقفلة على جوالك حتى الحصة. لا تحذف بيانات المتصفح قبل الاختبار.</p>
          <a href="/offline-quiz" className="btn-ghost inline-flex">تجربة صفحة الاختبار</a>
        </div>
      ) : (
        <>
          <div className="rounded-card bg-mint-tint px-3 py-2.5 text-sm leading-relaxed text-ink">
            <p className="font-bold">هذا الاختبار يؤدّى في الحصة دون إنترنت</p>
            <p className="mt-1">نزّله الآن على جوالك وأنت متصل. يبقى مقفلًا حتى يعرض معلمك مفتاح الفتح في الحصة.</p>
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
