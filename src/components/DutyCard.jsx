// src/components/DutyCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayISO, todayDow, DAY_NAMES } from "../lib/schoolTime";

/* =====================================================================
   صندوق المناوبة والإشراف.
   يعرض للمنسوب: يوم إشرافه الأسبوعي، وأقرب مناوبة له.
   ويتحوّل إلى تنبيه بارز في يوم مناوبته أو يوم إشرافه.
   ===================================================================== */

const fmtG = (iso) => {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const daysBetween = (iso) => {
  const a = new Date(todayISO() + "T00:00:00");
  const b = new Date(iso + "T00:00:00");
  return Math.round((b - a) / 86400000);
};

export default function DutyCard() {
  const { session } = useSession();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setData({ none: true }); return; }
      const today = todayISO();

      const [{ data: mine }, { data: todayRow }, { data: sup }] = await Promise.all([
        // أقرب مناوبة لي من اليوم فصاعدًا
        supabase.from("duty_roster")
          .select("duty_date, hijri_label, day_label, name_a, name_b, user_a, user_b")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`)
          .gte("duty_date", today)
          .order("duty_date")
          .limit(1),
        // مناوبو اليوم — يراهم الجميع
        supabase.from("duty_roster")
          .select("duty_date, hijri_label, day_label, name_a, name_b, note")
          .eq("duty_date", today)
          .maybeSingle(),
        // إشرافي الأسبوعي
        supabase.from("supervision_duty")
          .select("day_of_week, kind")
          .eq("user_id", uid),
      ]);

      setData({
        next: mine?.[0] ?? null,
        today: todayRow ?? null,
        sup: sup ?? [],
      });
    })();
  }, [session]);

  if (!data || data.none) return null;

  const dow = todayDow();
  const myDuty = data.next && data.next.duty_date === todayISO();
  const mySupToday = (data.sup ?? []).some((s) => s.day_of_week === dow);

  // لا يظهر الصندوق لمن لا مناوبة له ولا إشراف
  if (!data.next && (data.sup ?? []).length === 0 && !data.today) return null;

  /* ——— اليوم يوم مناوبتي أو إشرافي: تنبيه بارز ——— */
  if (myDuty || mySupToday) {
    const isDuty = myDuty;
    const tone = isDuty
      ? { bg: "bg-absent/8", border: "border-absent/35", text: "text-absent", chip: "bg-absent text-white" }
      : { bg: "bg-warning/8", border: "border-warning/35", text: "text-warning", chip: "bg-warning text-white" };
    const partner = isDuty
      ? [data.next.name_a, data.next.name_b].filter(Boolean).join(" و ")
      : null;

    return (
      <section className={`rounded-card border ${tone.border} ${tone.bg} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`chip ${tone.chip}`}>اليوم</span>
            <p className={`mt-2 text-lg font-bold ${tone.text}`}>
              {isDuty ? "أنت مناوب اليوم" : "أنت مشرف اليوم"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {isDuty
                ? `المناوبة مع: ${partner}`
                : `إشراف ${DAY_NAMES[dow] ?? ""} — تابع مواقع الإشراف في الفسحة وبداية اليوم.`}
            </p>
          </div>
          {isDuty && data.next.hijri_label && (
            <span className="num shrink-0 text-xs text-faint">{data.next.hijri_label}هـ</span>
          )}
        </div>
      </section>
    );
  }

  /* ——— بقية الأيام: بطاقة هادئة ——— */
  const inDays = data.next ? daysBetween(data.next.duty_date) : null;
  const supDays = (data.sup ?? []).map((s) => DAY_NAMES[s.day_of_week]).filter(Boolean);

  return (
    <section className="rounded-card border border-line bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {data.next && (
          <div>
            <p className="text-xs font-medium text-faint">مناوبتي القادمة</p>
            <p className="mt-1 text-sm font-bold text-ink">
              {data.next.day_label} <span className="num">{fmtG(data.next.duty_date)}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {inDays === 0 ? "اليوم" : inDays === 1 ? "غدًا" : <>بعد <span className="num">{inDays}</span> يومًا</>}
              {data.next.hijri_label && <span className="num"> · {data.next.hijri_label}هـ</span>}
            </p>
          </div>
        )}

        {supDays.length > 0 && (
          <div>
            <p className="text-xs font-medium text-faint">إشرافي الأسبوعي</p>
            <p className="mt-1 text-sm font-bold text-ink">{supDays.join(" · ")}</p>
            <p className="mt-0.5 text-xs text-muted">يتكرر كل أسبوع</p>
          </div>
        )}
      </div>

      {data.today && (data.today.name_a || data.today.name_b) && (
        <p className="mt-3 border-t border-line pt-2.5 text-xs text-muted">
          مناوبو اليوم:{" "}
          <span className="font-medium text-ink">
            {[data.today.name_a, data.today.name_b].filter(Boolean).join(" و ")}
          </span>
          {data.today.note && <span className="text-faint"> · {data.today.note}</span>}
        </p>
      )}
    </section>
  );
}
