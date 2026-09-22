import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { holidayToday, todayISO } from "../lib/schoolTime";

/**
 * صندوق الإجازة الرسمية في الصفحة الرئيسية.
 * يظهر تلقائيًا فقط أثناء إجازة مفعّلة (تُدار من صفحة «التقويم والإجازات»)،
 * ويعرض اسم الإجازة وشعارها المرفوع إن وُجد. يختفي وحده بعد انتهاء الإجازة.
 */
export default function HolidayBanner() {
  const h = holidayToday();
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    if (!h) return;
    let alive = true;
    (async () => {
      const t = todayISO();
      const { data } = await supabase
        .from("academic_calendar")
        .select("logo")
        .eq("kind", "holiday")
        .eq("is_active", true)
        .lte("start_date", t)
        .gte("end_date", t)
        .not("logo", "is", null)
        .limit(1)
        .maybeSingle();
      if (alive) setLogo(data?.logo ?? null);
    })();
    return () => { alive = false; };
  }, [h?.name]);

  if (!h) return null;

  return (
    <section
      className="overflow-hidden rounded-card"
      style={{ background: "#002627" }}
    >
      {logo && (
        <img
          src={logo}
          alt=""
          className="mx-auto block w-full max-w-md px-4 pt-4"
        />
      )}
      <div className={`px-5 pb-5 text-center ${logo ? "pt-2" : "pt-5"}`}>
        <p className="text-base font-bold text-white">{h.name}</p>
        <p className="mt-1 text-sm" style={{ color: "#9FE3BE" }}>
          إجازة رسمية — لا توجد حصص ولا تحضير اليوم.
        </p>
      </div>
    </section>
  );
}
