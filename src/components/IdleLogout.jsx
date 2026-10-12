// src/components/IdleLogout.jsx
// الخروج التلقائي عند عدم النشاط لحسابات الإدارة بعد 20 دقيقة (lib/idle.js)، ومنها
// الإداري المعلم في الواجهتين؛ المعلم والطالب وولي الأمر لا يخرجون تلقائيًا. أي لمس أو كتابة أو تمرير يعيد العدّ، والنشاط في تبويب يمدد غيره،
// وقبل الخروج بدقيقة نافذة «ما زلت هنا». لا خروج أثناء أداء الطالب اختبارًا (/quiz/…).
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { IDLE_MINUTES, WARN_SECONDS, lastActive, touchActive, markIdleOut } from "../lib/idle.js";

const EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"];

export default function IdleLogout() {
  const { session, profile, signOut } = useSession();
  const uid = session?.user?.id;
  const minutes = IDLE_MINUTES[profile?.role];
  const limit = (minutes ?? 0) * 60 * 1000;
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [left, setLeft] = useState(null);       // ثوانٍ متبقية أثناء التنبيه
  const leaving = useRef(false);
  const exempt = pathname.startsWith("/quiz/");
  const warnRef = useRef(false);
  useEffect(() => { warnRef.current = left != null; }, [left]);

  useEffect(() => {
    if (!uid || !profile || !minutes) return undefined;
    leaving.current = false;
    if (!lastActive(uid)) touchActive(uid);

    let lastWrite = 0;
    const onActivity = () => {
      // أثناء التنبيه لا يمدد إلا زر «ما زلت هنا»، فلا تُلغيه حركة فأرة عابرة
      if (warnRef.current) return;
      const now = Date.now();
      if (now - lastWrite > 10000) { lastWrite = now; touchActive(uid, now); }
    };

    const check = async () => {
      if (leaving.current) return;
      if (exempt) { touchActive(uid); setLeft(null); return; }
      const idle = Date.now() - (lastActive(uid) ?? Date.now());
      if (idle >= limit) {
        leaving.current = true;
        markIdleOut();
        await signOut();
        navigate("/login", { replace: true });
      } else if (idle >= limit - WARN_SECONDS * 1000) {
        setLeft(Math.ceil((limit - idle) / 1000));
      } else {
        setLeft(null);
      }
    };

    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(check, 1000);
    check();
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [uid, profile, minutes, limit, exempt]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (left == null) return null;
  const stay = () => { touchActive(uid); setLeft(null); };

  return (
    <div className="no-print fixed inset-0 z-[1000] grid place-items-center bg-ink/30 px-4 backdrop-blur-[1.5px]">
      <div role="alertdialog" aria-modal="true" dir="rtl"
           className="nt-pop w-full max-w-sm rounded-xl2 border border-line bg-white p-5 text-center shadow-card">
        <p className="text-base font-bold text-ink">هل ما زلت هنا؟</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          لم نلحظ نشاطًا منذ مدة، وسيُسجَّل خروجك تلقائيًا لحماية حسابك بعد
          {" "}<span className="num font-bold text-absent">{left}</span> ثانية.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button autoFocus onClick={stay} className="btn-primary">ما زلت هنا</button>
          <button onClick={async () => { leaving.current = true; await signOut(); navigate("/login", { replace: true }); }}
                  className="btn-ghost">تسجيل الخروج</button>
        </div>
      </div>
    </div>
  );
}
