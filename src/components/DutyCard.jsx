// src/components/DutyCard.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { todayISO, todayDow, DAY_NAMES } from "../lib/schoolTime";

/* =====================================================================
   صندوق المناوبة والإشراف في اللوحة الرئيسية.
   • مناوبو اليوم (جدول المناوبة) والإشراف اليومي حسب جدول الإشراف الأسبوعي
     (المعلمون المشرفون والمشرف المتابع) — يراهم الجميع.
   • شريط شخصي: مناوبتي القادمة وأيام إشرافي.
   • في يوم مناوبة المنسوب أو إشرافه يظهر تنبيه بارز أعلى الصندوق.
   • personal (حساب المعلم): ما يخصّه فقط — التنبيه، ومناوبته القادمة وأيام
     إشرافه، بلا قوائم الجميع. ولا يظهر الصندوق إن لم تكن له مهمة.
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

const Icon = ({ d, className = "h-4 w-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {d}
  </svg>
);
const SHIELD = <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z" />;
const EYE = <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>;
const CAL = <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>;
const BELL = <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>;

/** اسم في قائمة اليوم — يُميَّز صاحب الحساب */
function Person({ name, me, tone = "mint" }) {
  const look = me
    ? "border-mint-deep bg-mint-deep text-white"
    : tone === "amber"
      ? "border-warning/25 bg-warning-light text-ink"
      : "border-mint-light bg-white text-ink";
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-pill border px-3 py-1 text-sm font-medium ${look}`}>
      <span className="truncate">{name}</span>
      {me && <span className="shrink-0 rounded-pill bg-white/20 px-1.5 text-[10px] font-bold">أنت</span>}
    </span>
  );
}

function Block({ icon, title, hint, children }) {
  return (
    <div className="min-w-0 rounded-xl2 border border-mint-light/70 bg-white/80 p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-mint-tint text-mint-deep">
          <Icon d={icon} className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-bold text-ink">{title}</p>
        {hint && <span className="mr-auto text-[11px] text-faint">{hint}</span>}
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

export default function DutyCard({ personal = false }) {
  const { session } = useSession();
  const [data, setData] = useState(null);
  const dow = todayDow();

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setData({ none: true }); return; }
      const today = todayISO();

      const [{ data: mine }, { data: todayRow }, { data: sup }, { data: supToday }] = await Promise.all([
        // أقرب مناوبة لي من اليوم فصاعدًا
        supabase.from("duty_roster")
          .select("duty_date, hijri_label, day_label, name_a, name_b, user_a, user_b")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`)
          .gte("duty_date", today)
          .order("duty_date")
          .limit(1),
        // مناوبو اليوم — يراهم الجميع
        supabase.from("duty_roster")
          .select("duty_date, hijri_label, day_label, name_a, name_b, user_a, user_b, note")
          .eq("duty_date", today)
          .maybeSingle(),
        // إشرافي الأسبوعي
        supabase.from("supervision_duty")
          .select("day_of_week, kind")
          .eq("user_id", uid),
        // الإشراف اليومي حسب الجدول الأسبوعي
        dow
          ? supabase.from("supervision_duty")
              .select("person_name, kind, user_id")
              .eq("day_of_week", dow)
              .order("kind").order("person_name")
          : Promise.resolve({ data: [] }),
      ]);

      setData({
        uid,
        next: mine?.[0] ?? null,
        today: todayRow ?? null,
        sup: sup ?? [],
        supToday: supToday ?? [],
      });
    })();
  }, [session, dow]);

  if (!data || data.none) return null;

  const { uid } = data;
  const myDuty = data.next && data.next.duty_date === todayISO();
  const mySupToday = data.sup.some((s) => s.day_of_week === dow);
  const todayDuty = data.today && (data.today.name_a || data.today.name_b)
    ? [
        { name: data.today.name_a, me: data.today.user_a === uid },
        { name: data.today.name_b, me: data.today.user_b === uid },
      ].filter((p) => p.name)
    : [];
  const teachers = data.supToday.filter((r) => r.kind === "teacher");
  const followers = data.supToday.filter((r) => r.kind === "supervisor");
  const supDays = [...new Set(data.sup.map((s) => s.day_of_week))]
    .sort()
    .map((d) => DAY_NAMES[d])
    .filter(Boolean);

  // لا يظهر الصندوق إن لم يكن هناك ما يُعرض إطلاقًا
  if (!data.next && !supDays.length &&
      (personal || (!todayDuty.length && !data.supToday.length))) return null;

  const inDays = data.next ? daysBetween(data.next.duty_date) : null;
  const partner = myDuty
    ? todayDuty.filter((p) => !p.me).map((p) => p.name).join(" و ")
    : "";
  // المشرف المتابع في يوم إشرافي — يظهر في التنبيه للمعلم
  const follower = mySupToday && !followers.some((r) => r.user_id === uid)
    ? followers.map((r) => r.person_name).join(" و ")
    : "";

  return (
    <section className="overflow-hidden rounded-card border border-mint-light bg-gradient-to-b from-mint-tint to-white shadow-card">
      {/* الترويسة */}
      <div className="flex items-center justify-between gap-3 bg-mint-deep px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
            <Icon d={SHIELD} className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">المناوبة والإشراف</p>
            <p className="text-[11px] text-white/75">
              {dow ? `يوم ${DAY_NAMES[dow]}` : "لا دوام اليوم"}
              {data.today?.hijri_label && <> · <bdi className="num">{data.today.hijri_label}</bdi>هـ</>}
            </p>
          </div>
        </div>
        {(myDuty || mySupToday) && (
          <span className="shrink-0 animate-pulse rounded-pill bg-white px-3 py-1 text-xs font-bold text-mint-deep">
            لديك مهمة اليوم
          </span>
        )}
      </div>

      <div className="space-y-3 p-3.5 sm:p-4">
        {/* تنبيه شخصي في يوم المهمة */}
        {(myDuty || mySupToday) && (
          <div className={`flex items-start gap-3 rounded-xl2 border p-3.5 ${
            myDuty ? "border-absent/30 bg-danger-light" : "border-warning/30 bg-warning-light"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white ${
              myDuty ? "bg-absent" : "bg-warning"}`}>
              <Icon d={BELL} className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className={`font-bold ${myDuty ? "text-absent" : "text-warning"}`}>
                {myDuty && mySupToday ? "أنت مناوب ومشرف اليوم" : myDuty ? "أنت مناوب اليوم" : "أنت مشرف اليوم"}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted">
                {myDuty
                  ? (partner ? `المناوبة مع: ${partner}` : "تابع الطلاب في بداية اليوم ونهايته.")
                  : "تابع مواقع الإشراف في الفسحة وبداية اليوم."}
              </p>
              {personal && follower && (
                <p className="mt-0.5 text-sm leading-relaxed text-muted">المشرف المتابع: {follower}</p>
              )}
            </div>
          </div>
        )}

        {/* الإشراف اليومي حسب الجدول — شريط بعرض الصندوق */}
        {!personal && dow > 0 && data.supToday.length > 0 && (
          <Block icon={EYE} title="الإشراف اليومي" hint="حسب جدول الإشراف">
            <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
              {teachers.length > 0 && (
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 text-[11px] font-medium text-faint">
                    المعلمون المشرفون · <span className="num">{teachers.length}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {teachers.map((r, i) => (
                      <Person key={i} name={r.person_name} me={r.user_id === uid} />
                    ))}
                  </div>
                </div>
              )}
              {followers.length > 0 && (
                <div className="shrink-0 border-t border-mint-light pt-3 md:border-r md:border-t-0 md:pr-4 md:pt-0">
                  <p className="mb-1.5 text-[11px] font-medium text-faint">المشرف المتابع</p>
                  <div className="flex flex-wrap gap-1.5">
                    {followers.map((r, i) => (
                      <Person key={i} name={r.person_name} me={r.user_id === uid} tone="amber" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Block>
        )}

        {/* مناوبو اليوم + الشريط الشخصي */}
        <div className={`grid gap-3 ${personal ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
          {!personal && dow > 0 && (
            <Block icon={SHIELD} title="مناوبو اليوم" hint={data.today?.note || null}>
              {todayDuty.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {todayDuty.map((p, i) => <Person key={i} name={p.name} me={p.me} />)}
                </div>
              ) : (
                <p className="text-xs text-muted">لا مناوبة مسجّلة لهذا اليوم.</p>
              )}
            </Block>
          )}

          {/* الشريط الشخصي */}
          {(data.next || supDays.length > 0) && (
            <div className={personal ? "contents" : "grid gap-2"}>
              {data.next && (
                <div className="flex items-center gap-3 rounded-xl2 border border-mint-light/70 bg-white/80 px-3.5 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-center leading-none text-mint-deep">
                    {inDays === 0
                      ? <span className="text-[11px] font-bold">اليوم</span>
                      : <span><span className="num block text-base font-bold">{inDays}</span><span className="text-[9px]">{inDays === 1 ? "يوم" : "يومًا"}</span></span>}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-faint">مناوبتي القادمة</p>
                    <p className="truncate text-sm font-bold text-ink">
                      {data.next.day_label} <span className="num font-medium text-muted">{fmtG(data.next.duty_date)}</span>
                    </p>
                  </div>
                </div>
              )}
              {supDays.length > 0 && (
                <div className="flex items-center gap-3 rounded-xl2 border border-mint-light/70 bg-white/80 px-3.5 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-warning-light text-warning">
                    <Icon d={CAL} className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] text-faint">إشرافي الأسبوعي</p>
                    <p className="truncate text-sm font-bold text-ink">{supDays.join(" · ")}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
