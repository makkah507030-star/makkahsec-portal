import { supabase } from "./supabase";

/**
 * مجموعة معرّفات الحصص التي حُضِّرت في تاريخ معيّن.
 *
 * المسار السريع: دالة قاعدة بيانات `marked_schedule_ids` تُعيد المعرّفات
 * المميّزة في طلب واحد صغير (بضع مئات على الأكثر) — أسرع بكثير من قراءة
 * آلاف صفوف class_attendance.
 *
 * المسار الاحتياطي (إن لم تكن الدالة منشورة بعد): جلب schedule_id على
 * دفعات لتجاوز حدّ Supabase الافتراضي (1000 صف)، وإلا نقصت المجموعة
 * فظهرت حصص مُحضَّرة على أنها "لم تُحضَّر".
 */
export async function markedScheduleIds(date) {
  const rpc = await supabase.rpc("marked_schedule_ids", { p_date: date });
  if (!rpc.error && Array.isArray(rpc.data)) {
    return new Set(
      rpc.data.map((r) => (typeof r === "string" ? r : r.schedule_id))
    );
  }

  // احتياطي: جلب على دفعات
  const set = new Set();
  for (let from = 0; from < 50000; from += 1000) {
    const { data: page } = await supabase
      .from("class_attendance")
      .select("schedule_id")
      .eq("attend_date", date)
      .order("schedule_id", { ascending: true })
      .range(from, from + 999);
    (page ?? []).forEach((r) => set.add(r.schedule_id));
    if (!page || page.length < 1000) break;
  }
  return set;
}

/**
 * جلب كل صفوف استعلام مهما كثرت — لتجاوز حدّ Supabase الافتراضي (1000 صف
 * لكل طلب) الذي يقصّ النتائج بصمت حتى مع .limit أكبر، فتظهر أرقام ناقصة.
 *
 * `makeQuery`: دالة تُعيد استعلامًا جديدًا في كل استدعاء (بلا range) مع
 * ترتيب ثابت على عمود فريد (id مثلًا) لضمان عدم تكرار/تخطّي صفوف بين
 * الدفعات. نطبّق نحن range الترقيم.
 *
 * مثال:
 *   const rows = await fetchAllPaged(() =>
 *     supabase.from("class_attendance").select("...").eq("attend_date", d)
 *       .order("id", { ascending: true }));
 */
export async function fetchAllPaged(makeQuery, pageSize = 1000, maxRows = 60000) {
  let all = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = data ?? [];
    all = all.concat(chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}
