import { useEffect, useState } from "react";
import {
  pushSupported, pushState, enablePush, disablePush, isIosNeedsInstall,
} from "../lib/push";

// بطاقة تفعيل إشعارات الجوال — يضعها التخطيط في حساب المستخدم.
// تظهر فقط عند دعم المتصفّح، وترشد مستخدم الآيفون لتثبيت البوابة أولًا.
export default function EnableNotifications() {
  const [state, setState] = useState(null); // { supported, permission, subscribed }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const iosInstall = isIosNeedsInstall();

  const refresh = () => pushState().then(setState);
  useEffect(() => { refresh(); }, []);

  if (!pushSupported() || !state?.supported) return null;

  const on = async () => {
    setErr(""); setBusy(true);
    try { await enablePush(); await refresh(); }
    catch (e) { setErr(e.message || "تعذّر تفعيل الإشعارات."); }
    finally { setBusy(false); }
  };
  const off = async () => {
    setBusy(true);
    try { await disablePush(); await refresh(); }
    finally { setBusy(false); }
  };

  const Bell = (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0 text-mint-deep"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );

  // مثبّتة وفعّالة
  if (state.subscribed && state.permission === "granted") {
    return (
      <section className="rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
        <div className="flex items-center gap-2.5">
          {Bell}
          <p className="flex-1 text-sm font-semibold text-mint-deep">إشعارات الجوال مُفعّلة على هذا الجهاز</p>
          <button onClick={off} disabled={busy}
            className="shrink-0 text-xs font-medium text-muted hover:text-absent hover:underline disabled:opacity-50">
            {busy ? "…" : "إيقاف"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-white px-4 py-3.5">
      <div className="flex items-start gap-2.5">
        {Bell}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">فعّل إشعارات الجوال</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            استقبل تعاميم وإشعارات البوابة على شاشة جوالك مباشرة — حتى والبوابة مغلقة.
          </p>

          {iosInstall ? (
            <p className="mt-2 rounded-sm2 bg-warning-light px-3 py-2 text-xs leading-relaxed text-warning">
              على الآيفون: أضِف البوابة إلى الشاشة الرئيسية أولًا (زر المشاركة ← «إضافة إلى الشاشة الرئيسية»)،
              ثم افتحها من الأيقونة وفعّل الإشعارات من هنا. (يتطلب iOS 16.4 فأحدث)
            </p>
          ) : state.permission === "denied" ? (
            <p className="mt-2 rounded-sm2 bg-absent/10 px-3 py-2 text-xs leading-relaxed text-absent">
              الإشعارات محظورة في إعدادات المتصفّح لهذا الموقع. فعّلها من إعدادات الموقع ثم أعد المحاولة.
            </p>
          ) : (
            <button onClick={on} disabled={busy}
              className="mt-2.5 rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#6AA786] disabled:opacity-60">
              {busy ? "جارٍ التفعيل…" : "تفعيل الإشعارات"}
            </button>
          )}

          {err && <p className="mt-2 text-xs text-absent">{err}</p>}
        </div>
      </div>
    </section>
  );
}
