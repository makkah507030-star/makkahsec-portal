// src/components/PendingAlertsCard.jsx
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useNavBadges } from "../lib/navBadges.js";

/* =====================================================================
   «ما ينتظرك» — تنبيهات سريعة في الصفحة الرئيسية، من عدادات القائمة نفسها
   (lib/navBadges.js) فلا استعلامات إضافية. تختفي حين لا شيء ينتظر.
   ===================================================================== */

export default function PendingAlertsCard() {
  const { session, effectiveRole, adminRoles } = useSession();
  const b = useNavBadges(session?.user?.id, effectiveRole === "admin" ? adminRoles : []);

  const items = [
    { n: b._returned,        to: "/forms",        text: "نموذج أعاده المدير إليك للتعديل", tone: "absent" },
    { n: b["/my-documents"], to: "/my-documents", text: "نموذج وصلك ينتظر إفادتك",         tone: "warning" },
    { n: b._toApprove,       to: "/forms-review", text: "نموذج ينتظر اعتمادك",             tone: "warning" },
    { n: b._replies,         to: "/forms-review", text: "إفادة وصلت على نموذج أصدرته",     tone: "mint" },
    { n: b["/referrals"],    to: "/referrals",    text: "إحالة تنتظر إجراءك",              tone: "warning" },
  ].filter((x) => x.n > 0);

  if (!items.length) return null;
  const dot = { absent: "bg-absent", warning: "bg-warning", mint: "bg-mint-deep" };

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      <p className="border-b border-line px-4 py-2.5 text-sm font-bold text-ink">ما ينتظرك</p>
      <ul className="divide-y divide-line">
        {items.map((x) => (
          <li key={x.text}>
            <Link to={x.to} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-canvas">
              <span className={`h-2 w-2 shrink-0 rounded-full ${dot[x.tone]}`} />
              <span className="min-w-0 flex-1 text-ink">{x.text}</span>
              <span className="num shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs font-bold text-ink">{x.n}</span>
              <span className="shrink-0 text-xs text-mint-deep">←</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
