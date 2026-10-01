// src/pages/ArLaunch.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* =====================================================================
   صفحة عامة يفتحها رمز QR على بطاقة المعلم: /ar/<الرمز>
   تجلب بياناته المهنية ثم تنتقل إلى مشهد الواقع المعزز الثابت
   /ar/view.html حاملة البيانات في الرابط (#). و/ar/demo بيانات تجريبية.
   ===================================================================== */
const DEMO = {
  name: "أ. محمد بن عبدالله القحطاني",
  spec: "رياضيات",
  subjects: ["الرياضيات ٢", "الرياضيات ٣"],
  classes: 6, students: 168, periods: 24,
};

// base64 آمن مع العربية
const pack = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));

export default function ArLaunch() {
  const [err, setErr] = useState("");

  useEffect(() => {
    const token = decodeURIComponent(window.location.pathname.split("/")[2] || "");
    const go = (data) => window.location.replace(`/ar/view.html#${pack(data)}`);
    if (!token || token === "demo") { go(DEMO); return; }
    if (!/^[0-9a-f-]{36}$/i.test(token)) { setErr("الرمز غير صحيح."); return; }
    supabase.rpc("teacher_ar_profile", { p_token: token }).then(({ data, error }) => {
      if (error || !data) setErr("تعذّر العثور على البطاقة، أو لم تعد فعّالة.");
      else go(data);
    });
  }, []);

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-[#00234E] p-6 text-center text-white">
      {err ? (
        <div>
          <p className="text-lg font-bold">{err}</p>
          <a href="/" className="mt-4 inline-block text-sm text-[#FFCB05] underline">بوابة مدرسة مكة الثانوية</a>
        </div>
      ) : (
        <p className="animate-pulse text-sm opacity-80">جارٍ تجهيز تجربة الواقع المعزز…</p>
      )}
    </div>
  );
}
