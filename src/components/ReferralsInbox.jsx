// src/components/ReferralsInbox.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";

/* =====================================================================
   صندوق الإحالات الواردة — يظهر في لوحة التحكم فوق الطلاب المفقودين.
   • وكيل شؤون الطلاب: إحالات المعلمين الجديدة وردود أولياء الأمور.
   • الموجه الطلابي: ما أُحيل إليه.
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

  useEffect(() => {
    if (!uid || (!isDeputy && !isCounselor)) { setRows([]); return; }
    (async () => {
      let q = supabase.from("student_referrals")
        .select("id, serial, student_name, class_label, reason, status, teacher_name, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      q = isDeputy
        ? q.in("status", ["with_deputy", "guardian_replied"])
        : q.in("status", ["with_counselor", "returned_to_counselor"]).eq("counselor_id", uid);

      const { data } = await q;
      setRows(data ?? []);
    })();
  }, [uid, isDeputy, isCounselor]);

  if (!rows || rows.length === 0) return null;

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
    </section>
  );
}
