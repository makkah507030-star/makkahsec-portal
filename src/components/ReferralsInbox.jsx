// src/components/ReferralsInbox.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { OPEN_STATUSES, STAGE_COLS, stageOf, isLate } from "../lib/referrals";

/* =====================================================================
   صندوق الإحالات الواردة — يظهر في لوحة التحكم فوق الطلاب المفقودين.
   • وكيل شؤون الطلاب: إحالات المعلمين الجديدة وردود أولياء الأمور.
   • الموجه الطلابي: ما أُحيل إليه.
   • وللوكيل سطر متابعة: ما عند الموجهين وولي الأمر، وكم تأخر منه.
   ولا يظهر لمن لا إحالة تخصّه.
   ===================================================================== */

export default function ReferralsInbox() {
  const { session, adminRoles } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];

  const isDeputy = roles.includes("deputy_students") ||
                   roles.includes("principal") || roles.includes("tech_support");
  const isCounselor = roles.some((r) => r.startsWith("counselor"));

  const [rows, setRows] = useState(null);
  const [away, setAway] = useState([]);   // قيد المتابعة عند غير الوكيل

  useEffect(() => {
    if (!uid || (!isDeputy && !isCounselor)) { setRows([]); return; }
    (async () => {
      const { data } = await supabase.from("student_referrals")
        .select(STAGE_COLS)
        .in("status", OPEN_STATUSES)
        .order("created_at", { ascending: false })
        .limit(300);
      const all = data ?? [];

      // من جمع الدورين يرى وارد الاثنين
      setRows(all.filter((r) =>
        (isDeputy && ["with_deputy", "guardian_replied"].includes(r.status)) ||
        (isCounselor && ["with_counselor", "returned_to_counselor"].includes(r.status) &&
         r.counselor_id === uid)));
      if (isDeputy) setAway(all.filter((r) => ["counselor", "guardian"].includes(stageOf(r).group)));
    })();
  }, [uid, isDeputy, isCounselor]);

  if (!rows) return null;

  const atCounselor = away.filter((r) => stageOf(r).group === "counselor");
  const atGuardian = away.filter((r) => stageOf(r).group === "guardian");
  const lateAway = away.filter(isLate).length;

  const follow = isDeputy && away.length > 0 && (
    <Link to="/referrals?tab=follow"
          className={`flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs transition-colors hover:bg-canvas ${
            lateAway ? "text-absent" : "text-muted"}`}>
      <span>
        قيد المتابعة: عند الموجهين <span className="num font-bold">{atCounselor.length}</span>
        {" "}· عند ولي الأمر <span className="num font-bold">{atGuardian.length}</span>
        {lateAway > 0 && <> · متأخرة <span className="num font-bold">{lateAway}</span></>}
      </span>
      <span className="font-semibold">متابعة ←</span>
    </Link>
  );

  if (rows.length === 0) {
    return follow ? <section className="card overflow-hidden">{follow}</section> : null;
  }

  const fresh = rows.filter((r) => r.status === "with_deputy" ||
                                   r.status === "with_counselor").length;

  return (
    <section className="overflow-hidden rounded-card border border-warning/35 bg-warning/5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-warning">إحالات طلاب بانتظار إجراءك</p>
          <p className="mt-0.5 text-xs text-muted">
            {isDeputy ? "أُحيلت من المعلمين أو وصل رد ولي الأمر"
                      : "أُحيلت إليك من وكيل شؤون الطلاب"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="num text-2xl font-bold text-warning">{rows.length}</span>
          <Link to="/referrals"
                className="rounded-pill bg-warning px-4 py-1.5 text-xs font-semibold text-white">
            فتح
          </Link>
        </div>
      </div>

      <div className="max-h-56 divide-y divide-warning/15 overflow-y-auto border-t border-warning/15">
        {rows.map((r) => (
          <Link key={r.id} to="/referrals"
                className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-warning/10">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{r.student_name}</p>
              <p className="truncate text-xs text-muted">
                {r.class_label} · {r.reason}
              </p>
            </div>
            <span className="num shrink-0 text-[11px] text-faint">{r.serial}</span>
          </Link>
        ))}
      </div>

      {fresh > 0 && (
        <p className="border-t border-warning/15 px-5 py-2 text-[11px] text-warning">
          منها <span className="num font-bold">{fresh}</span> لم يُتخذ فيها إجراء بعد.
        </p>
      )}

      {follow && <div className="border-t border-warning/15">{follow}</div>}
    </section>
  );
}
