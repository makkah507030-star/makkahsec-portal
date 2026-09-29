// src/lib/pushSend.js
import { supabase } from "./supabase";

/** إرسال إشعار الجوال (Web Push) لمستلمي إشعار محفوظ — بجلسة المستخدم الحالي.
 *  دالة push-send ترفض أي طلب بلا جلسة صالحة. لا يرمي خطأً: الإشعار وصل للجرس أصلًا. */
export async function sendPush(notificationId) {
  if (!notificationId) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch("/.netlify/functions/push-send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ notification_id: notificationId }),
    });
  } catch { /* الإشعار في الجرس وصل */ }
}
