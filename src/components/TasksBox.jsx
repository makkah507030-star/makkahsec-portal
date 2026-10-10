// src/components/TasksBox.jsx
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import { useNavBadges, refreshNavBadges } from "../lib/navBadges.js";
import { Icon } from "./Layout.jsx";

/* =====================================================================
   «بانتظار إجرائك» — صندوق المهام المعلقة في الرئيسية لكل الحسابات: بطاقة لكل نوع
   إجراء ينتظر صاحب الحساب وعددها، والضغط يفتح مكان الإجراء مباشرة.
   المصدر lib/navBadges.js (العدادات نفسها في القائمة الجانبية).
   حين تُنجَز مهمة تظهر بطاقتها «✓ تمت» لحظات ثم تختفي.
   ===================================================================== */

const TONE = {
  absent:  { card: "border-absent/25 bg-absent/5 hover:bg-absent/10",    icon: "bg-absent/10 text-absent",       num: "text-absent" },
  warning: { card: "border-warning/30 bg-warning/5 hover:bg-warning/10", icon: "bg-warning-light text-warning",  num: "text-warning" },
  mint:    { card: "border-[#CCF2DB] bg-mint-tint hover:bg-mint-light",  icon: "bg-white text-mint-deep",        num: "text-mint-deep" },
};

// آخر ما رآه المستخدم من مهام — يبقى بين زيارات الرئيسية ليُعرف ما أُنجز منذها
let seen = { uid: null, tasks: new Map() };

export default function TasksBox() {
  const { session, effectiveRole, adminRoles } = useSession();
  const uid = session?.user?.id;
  const b = useNavBadges(uid, effectiveRole === "admin" ? adminRoles : [], effectiveRole);
  const tasks = b._tasks ?? [];
  const [done, setDone] = useState([]);
  const [open, setOpen] = useState(null);
  const timers = useRef([]);

  // كل زيارة للرئيسية تُحدّث المهام فورًا، فيختفي ما أُنجز قبل لحظات
  useEffect(() => { refreshNavBadges(true); }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (!b._ready) return;
    const now = new Map(tasks.map((t) => [t.key, t]));
    if (seen.uid === uid) {
      const finished = [...seen.tasks.values()].filter((t) => !now.has(t.key));
      if (finished.length) {
        setDone((d) => [...d.filter((x) => !finished.some((f) => f.key === x.key)), ...finished]);
        const keys = finished.map((f) => f.key);
        timers.current.push(setTimeout(() => setDone((d) => d.filter((x) => !keys.includes(x.key))), 4500));
      }
    }
    seen = { uid, tasks: now };
    if (open && !now.has(open)) setOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b]);

  if (!b._ready) return null;

  const total = tasks.filter((t) => !t.follow).reduce((a, t) => a + t.n, 0);
  const shownDone = done.filter((d) => !tasks.some((t) => t.key === d.key));
  const expanded = tasks.find((t) => t.key === open);

  return (
    <section className="overflow-hidden rounded-card border border-line bg-white">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <p className="text-sm font-bold text-ink">بانتظار إجرائك</p>
        {total > 0 ? (
          <span className="num rounded-full bg-warning-light px-2 py-0.5 text-xs font-bold text-warning">{total}</span>
        ) : null}
        <p className="mr-auto text-[11px] text-faint">{total > 0 ? "اضغط البطاقة للانتقال إلى الإجراء" : ""}</p>
      </div>

      {!tasks.length && !shownDone.length ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-mint-deep">
          <Icon name="check" className="h-4 w-4" />
          لا مهام معلقة — كل شيء منجز.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {tasks.map((t) => <TaskCard key={t.key} t={t} active={open === t.key}
                                      onExpand={() => setOpen(open === t.key ? null : t.key)} />)}
          {shownDone.map((t) => (
            <div key={`done-${t.key}`} className="tasks-done flex min-h-[6.5rem] flex-col rounded-card border border-[#CCF2DB] bg-mint-tint p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-mint-deep">
                <Icon name="check" className="h-4 w-4" />
              </span>
              <p className="mt-2 text-sm font-bold text-mint-deep">تمت ✓</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted line-through">{t.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* عناصر المهمة حين تتعدد ولا صفحة قائمة لها (ولي الأمر والطالب) */}
      {expanded && (
        <ul className="divide-y divide-line border-t border-line">
          {expanded.items.map((x) => (
            <li key={x.id}>
              {x.to ? (
                <Link to={x.to} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-canvas">
                  <span className="min-w-0 flex-1 truncate text-ink">{x.title || expanded.label}</span>
                  <span className="shrink-0 text-xs font-semibold text-mint-deep">افتح ←</span>
                </Link>
              ) : (
                // عنصر للاطلاع فقط، لا صفحة له
                <p className="px-4 py-2.5 text-sm text-ink">{x.title || expanded.label}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <style>{`
        .tasks-done { animation: tasks-done 4.5s ease forwards; }
        @keyframes tasks-done { 0%, 75% { opacity: 1; transform: none; } 100% { opacity: 0; transform: scale(.96); } }
      `}</style>
    </section>
  );
}

function TaskCard({ t, active, onExpand }) {
  const tone = TONE[t.tone] ?? TONE.warning;
  const one = t.items?.length === 1 && t.items[0].to ? t.items[0] : null;
  // تتعدد العناصر (أو هي للاطلاع بلا صفحة) ولا صفحة قائمة لها ← تُعرض قائمتها تحت البطاقات
  const expands = !one && t.items?.length > 0 && t.to === "/";
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone.icon}`}>
          <Icon name={t.icon} className="h-4 w-4" />
        </span>
        <span className={`num text-2xl font-bold leading-none ${tone.num}`}>{t.n}</span>
      </div>
      <p className="mt-2 text-[12.5px] font-semibold leading-snug text-ink">{t.label}</p>
      {t.sub && <p className="num mt-0.5 text-[11px] leading-snug text-muted">{t.sub}</p>}
      <p className="mt-auto pt-1.5 text-[11px] font-semibold text-mint-deep">
        {expands ? (active ? "إخفاء القائمة ↑" : "عرض القائمة ↓") : one ? "افتح الإجراء ←" : "انتقل للإجراء ←"}
      </p>
    </>
  );
  const cls = `flex min-h-[6.5rem] flex-col rounded-card border p-3 text-right transition-colors ${tone.card} ${active ? "ring-2 ring-mint-deep/40" : ""}`;
  return expands
    ? <button type="button" className={cls} onClick={onExpand} aria-expanded={active}>{body}</button>
    : <Link to={one ? one.to : t.to} className={cls}>{body}</Link>;
}
