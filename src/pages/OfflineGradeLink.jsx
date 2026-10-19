// src/pages/OfflineGradeLink.jsx
// رابط رمز التسليم في الاختبار دون إنترنت (/q/g/MKQ1...) حين يمسحه المعلم بكاميرا الجوال
// بدل ماسح البوابة: يُصحَّح ويُرصد (quiz_offline_scan). قبل الدخول يُحفظ الرابط ويُفتح بعده.
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { ScanResultBox } from "../components/OfflineQuizTools.jsx";

export default function OfflineGradeLink() {
  const { code } = useParams();
  const { session } = useSession();
  const [r, setR] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("quiz_offline_scan", { p_text: code })
      .then(({ data, error }) => setR(error ? { error: error.message } : data));
  }, [session, code]);

  if (!session) {
    try { sessionStorage.setItem("mk_after_login", `/q/g/${code}`); } catch { /* تجاهل */ }
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-bold text-ink">رصد اختبار دون إنترنت</h1>
      {r ? <ScanResultBox r={r} /> : <p className="text-sm text-muted">جارٍ الرصد…</p>}
      <Link to="/quizzes" className="btn-ghost w-full">اختباراتي</Link>
    </div>
  );
}
