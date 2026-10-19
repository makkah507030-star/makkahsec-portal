// src/pages/lab/LabGradeLink.jsx
// رابط رمز الدرجة (/lab/g/MKL1...) حين يمسحه المعلم بكاميرا الجوال بدل ماسح البوابة:
// يرصد الدرجة ويعرض النتيجة. قبل الدخول يُحفظ الرابط ويُفتح بعد تسجيل الدخول.
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { ScanResult } from "./LabSessions.jsx";

export default function LabGradeLink() {
  const { code } = useParams();
  const { session } = useSession();
  const [r, setR] = useState(null);

  useEffect(() => {
    if (!session) return;
    supabase.rpc("lab_result_record", { p_text: code })
      .then(({ data, error }) => setR(error ? { error: error.message } : data));
  }, [session, code]);

  if (!session) {
    try { sessionStorage.setItem("mk_after_login", `/lab/g/${code}`); } catch { /* تجاهل */ }
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-bold text-ink">رصد درجة المعمل</h1>
      {r ? <ScanResult r={r} /> : <p className="text-sm text-muted">جارٍ الرصد…</p>}
      <Link to="/lab?tab=lessons" className="btn-ghost w-full">حصص المعمل</Link>
    </div>
  );
}
