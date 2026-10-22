// src/lib/circulars.js
/* =====================================================================
   التعاميم (supabase/circulars_1..2.sql): ثوابت مشتركة بين صفحة الإدارة (Circulars.jsx)
   وصفحة التعميم (CircularView.jsx) وتعاميمي (MyCirculars.jsx).
   ===================================================================== */
import { supabase } from "./supabase";

export const CIRC_BUCKET = "circulars";

export const DIRECTION = {
  incoming: { t: "وارد", c: "bg-[#EAF1FA] text-[#2C527A]" },
  internal: { t: "داخلي", c: "bg-mint-tint text-mint-deep" },
};
export const PRIORITY = {
  normal: { t: "عادي", c: "bg-canvas text-muted" },
  important: { t: "مهم", c: "bg-warning/10 text-warning" },
  urgent: { t: "عاجل", c: "bg-absent/10 text-absent" },
};
export const CATEGORIES = ["الشؤون التعليمية", "شؤون الطلاب", "الشؤون المدرسية", "الاختبارات", "شؤون المعلمين",
  "التوجيه الطلابي", "النشاط", "الأمن والسلامة", "الصحة المدرسية", "التقنية والأنظمة", "عام"];
export const SOURCES = ["الإدارة العامة للتعليم بمنطقة مكة المكرمة", "مكتب التعليم", "وزارة التعليم", "إدارة المدرسة"];

export const STAFF_SCOPES = [
  ["none", "لا أحد"], ["all", "كل المنسوبين"], ["teachers", "المعلمون"], ["admins", "الإداريون"],
];
export const GUARDIAN_SCOPES = [["none", "لا أحد"], ["all", "كل أولياء الأمور"], ["grades", "صفوف أو فصول"]];

/* حالة مستفيد: أقرّ / فتح ولم يقرّ / لم يفتح */
export function recStatus(r, needsAck) {
  if (needsAck ? r.ack_at : r.read_at) return { k: "done", t: needsAck ? "اطّلع وأقرّ" : "اطّلع", c: "bg-success/10 text-success" };
  if (r.read_at) return { k: "opened", t: "فتحه ولم يقرّ", c: "bg-warning/10 text-warning" };
  return { k: "pending", t: "لم يطّلع", c: "bg-absent/10 text-absent" };
}

/* نسبة الاطلاع في تعميم */
export function circStats(recs, needsAck) {
  const total = recs.length;
  const done = recs.filter((r) => (needsAck ? r.ack_at : r.read_at)).length;
  return { total, done, pending: total - done, pct: total ? Math.round((100 * done) / total) : 0 };
}

/* «رقم القيد/السنة» مثل 12/1448 */
export const circNo = (c) => (c?.seq ? `${c.seq}/${String(c.academic_year ?? "").split("-")[0]}` : "—");

export async function openCircularFile(path) {
  const { data, error } = await supabase.storage.from(CIRC_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("تعذّر فتح الملف، حاول مرة أخرى.");
  window.open(data.signedUrl, "_blank", "noopener");
}

export const setupMsg = "التعاميم تحتاج تشغيل supabase/circulars_1.sql ثم circulars_2.sql في Supabase ← SQL Editor.";
export const isSetupErr = (e) => /circular/i.test(e?.message ?? "") && /(does not exist|not find|schema cache)/i.test(e?.message ?? "");
