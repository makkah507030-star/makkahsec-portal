import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtGreg, fmtHijri } from "../lib/dates";

const KIND_LABEL = {
  holiday:    "إجازة",
  event:      "حدث",
  exam:       "اختبارات",
  term_start: "بداية",
  term_end:   "نهاية",
};



function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target - today) / 86400000);
}

function countdownText(days) {
  if (days === 0) return "اليوم";
  if (days === 1) return "غدًا";
  if (days < 7) return `بعد ${days} أيام`;
  if (days < 30) {
    const w = Math.round(days / 7);
    return w === 1 ? "بعد أسبوع" : `بعد ${w} أسابيع`;
  }
  const m = Math.round(days / 30);
  return m === 1 ? "بعد شهر" : `بعد ${m} أشهر`;
}

export default function CalendarTimeline() {
  const [events, setEvents] = useState(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("academic_calendar")
        .select("id, title, kind, start_date, end_date, hijri_label")
        .eq("is_active", true)
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`)
        .order("start_date")
        .limit(4);
      setEvents(data ?? []);
    })();
  }, []);

  if (!events || events.length === 0) return null;

  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="text-xl font-bold text-ink">التقويم الدراسي</h2>
        <p className="mt-1.5 text-sm text-muted">أقرب المحطات القادمة في العام الدراسي.</p>

        <div className="mt-8">
          <div className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* الخط الزمني */}
            <div
              aria-hidden="true"
              className="absolute right-0 left-0 top-[7px] hidden h-px bg-[#CCF2DB] lg:block"
            />

            {events.map((e) => {
              const days = daysUntil(e.start_date);
              const isNow =
                days <= 0 &&
                (!e.end_date || new Date(e.end_date + "T23:59:59") >= new Date());

              return (
                <article key={e.id} className="relative">
                  <span
                    className={`relative z-[1] block h-3.5 w-3.5 rounded-full border-2 border-white ${
                      isNow ? "bg-mint-deep" : "bg-[#89D7AD]"
                    }`}
                  />
                  <div
                    className={`mt-4 rounded-card border p-4 ${
                      isNow
                        ? "border-[#CCF2DB] bg-mint-tint"
                        : "border-line bg-white"
                    }`}
                  >
                    <p className="text-[11px] font-semibold text-[#6AA786]">
                      {isNow ? "جارية الآن" : countdownText(days)}
                    </p>
                    <h3 className="mt-1.5 text-sm font-bold leading-snug text-ink">
                      {e.title}
                    </h3>
                    <p className="mt-2 text-xs text-muted">
                      {fmtGreg(e.start_date + "T00:00:00")}
                      {e.end_date &&
                        ` — ${fmtGreg(e.end_date + "T00:00:00")}`}
                    </p>
                    {e.hijri_label && (
                      <p className="mt-0.5 text-xs text-faint">
                        <span className="num">
                          {fmtHijri(e.start_date + "T00:00:00", false)}
                        </span>
                        هـ
                      </p>
                    )}
                    <span className="chip mt-3 inline-block bg-mint-tint text-mint-deep">
                      {KIND_LABEL[e.kind] ?? "حدث"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
