// src/lib/useNotice.js
// بديل مباشر لـ useState لرسائل الصفحة: يحفظ الرسالة كما كانت (فتبقى
// ظاهرة في مكانها)، ويعرضها أيضًا في بطاقة عائمة لا تفوت المستخدم.
//   const [msg, setMsg] = useNotice(null);            // { ok, text }
//   const [err, setErr] = useNotice("", "error");     // نص خطأ
import { useCallback, useState } from "react";
import { notify } from "./notice";

export function useNotice(initial = null, kind) {
  const [value, setValue] = useState(initial);
  const set = useCallback((v) => {
    setValue(v);
    if (!v || typeof v === "function") return;
    if (typeof v === "object") notify(v);
    else notify(String(v), kind ?? "success");
  }, [kind]);
  return [value, set];
}
