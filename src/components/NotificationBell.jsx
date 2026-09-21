import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useNotifications, KIND_META } from "../lib/useNotifications";
import { fmtDateTime } from "../lib/dates";

export default function NotificationBell() {
  const { session } = useSession();
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead } = useNotifications(session);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // إغلاق عند الضغط خارج القائمة
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openItem = async (n) => {
    if (!n.read_at) await markRead(n.id);
    setOpen(false);
    // فتح صفحة عرض الإشعار الاحترافية (نفس وجهة إشعار الجوال)
    navigate(`/notify/${n.id}`);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="الإشعارات"
        className="relative rounded-pill border border-line p-2 text-muted transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint hover:text-mint-deep"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>

        {unread > 0 && (
          <span className="num absolute -top-1 -left-1 grid h-4 min-w-4 place-items-center rounded-full bg-absent px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-16 z-[60] overflow-hidden rounded-card border border-line bg-white shadow-xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <p className="text-sm font-semibold text-ink">
              الإشعارات{unread > 0 && <span className="num text-absent"> ({unread})</span>}
            </p>
            {unread > 0 && (
              <button onClick={markAllRead}
                className="text-xs font-medium text-mint-deep hover:underline">
                تعليم الكل كمقروء
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">لا توجد إشعارات.</p>
          ) : (
            <div className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const meta = KIND_META[n.kind] ?? KIND_META.general;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className={`block w-full px-4 py-3 text-right transition-colors hover:bg-canvas ${
                      n.read_at ? "" : "bg-mint-tint/40"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint-deep" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`chip ${meta.tone}`}>{meta.label}</span>
                          <span className="text-[11px] text-faint">
                            {fmtDateTime(n.created_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium leading-snug text-ink">
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted line-clamp-2">
                            {n.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
