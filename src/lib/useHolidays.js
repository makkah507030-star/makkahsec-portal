// src/lib/useHolidays.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { setHolidayRanges } from "./schoolTime";

/* يحمّل الإجازات الرسمية المفعّلة مرة واحدة عند إقلاع البوابة، ويضعها في
   ذاكرة schoolTime ليعتمد عليها todayDow و todayLabel و holidayToday
   في كل الشاشات ولكل الحسابات. يعيد true بعد اكتمال التحميل حتى لا
   تُرسم الشاشات قبل معرفة إن كان اليوم إجازة. */
export function useHolidays() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("academic_calendar")
        .select("title, start_date, end_date")
        .eq("kind", "holiday")
        .eq("is_active", true);

      if (error) console.error("تعذّر تحميل الإجازات:", error.message);

      setHolidayRanges(
        (data ?? []).map((r) => ({
          name: r.title,
          start: r.start_date,
          end: r.end_date || r.start_date,
        })),
      );
      if (alive) setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  return ready;
}
