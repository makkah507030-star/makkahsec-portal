import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useNotifications, KIND_META } from "../lib/useNotifications";
import { fmtDateTime } from "../lib/dates";

// صفحة كل إشعارات المستخدم — إليها يعود زر «رجوع» من صفحة الإشعار
export default function NotificationsList() {
  const { session } = useSession();
  const { items, loading, markAllRead, unread } = useNotifications(session);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">الإشعارات</h1>
          <p className="mt-1 text-sm text-muted">
            كل الإشعارات والتعاميم الموجّهة إليك.
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="shrink-0 rounded-pill border border-line bg-paper px-4 py-1.5 text-xs font-medium text-ink hover:bg-canvas">
            تعليم الكل كمقروء
          </button>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>
      ) : items.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا توجد إشعارات</p>
          <p className="mt-1.5 text-sm text-muted">ستظهر هنا التعاميم والإشعارات فور وصولها.</p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {items.map((n) => {
            const meta = KIND_META[n.kind] ?? KIND_META.general;
            return (
              <Link key={n.id} to={`/notify/${n.id}`}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-canvas">
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint-deep" />}
                {n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${n.read_at ? "font-medium text-ink" : "font-bold text-ink"}`}>
                      {n.title}
                    </p>
                    <span className={`chip shrink-0 ${meta.tone}`}>{meta.label}</span>
                  </div>
                  {n.body && <p className="mt-0.5 truncate text-xs text-muted">{n.body}</p>}
                  <p className="num mt-0.5 text-[11px] text-faint">{fmtDateTime(n.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
