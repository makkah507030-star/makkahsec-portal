import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";
import TrialBanner from "./TrialBanner.jsx";

/* أقسام قائمة الإدارة — مجمّعة منطقيًا */
const ADMIN_GROUPS = [
  {
    title: null,
    items: [{ to: "/", label: "الرئيسية", perm: null, icon: "home" }],
  },
  {
    title: "الطلاب والمتابعة",
    items: [
      { to: "/students",    label: "الطلاب",    perm: "students",    icon: "users" },
      { to: "/reports",     label: "التقارير",  perm: "reports",     icon: "chart" },
      { to: "/permissions", label: "الاستئذان", perm: "permissions", icon: "ticket" },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { to: "/news-admin",     label: "الأخبار",   perm: "news",     icon: "news" },
      { to: "/feedback-admin", label: "الملاحظات", perm: "feedback", icon: "chat" },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { to: "/import",         label: "الاستيراد",           perm: "import",         icon: "upload" },
      { to: "/season",         label: "التوقيت الزمني",       perm: "import",         icon: "clock" },
      { to: "/accounts",       label: "الحسابات",            perm: "accounts",       icon: "key" },
      { to: "/staff",          label: "الإدارة",             perm: "staff",          icon: "shield" },
      { to: "/password-reset", label: "استعادة كلمة المرور", perm: "password_reset", icon: "lock" },
    ],
  },
];

const OTHER_NAV = {
  teacher: [
    { to: "/",        label: "التحضير" },
    { to: "/reports", label: "التقارير" },
  ],
  student:  [{ to: "/", label: "الرئيسية" }],
  guardian: [{ to: "/", label: "الرئيسية" }],
};

/* أيقونات خطّية بسيطة */
function Icon({ name, className = "h-[18px] w-[18px]" }) {
  const p = {
    home:   "M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5",
    users:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9",
    chart:  "M3 3v18h18M7 15V9m5 6V5m5 10v-4",
    ticket: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z",
    news:   "M4 5h12v14H4zM16 8h4v9a2 2 0 0 1-4 0zM7 9h6M7 12h6M7 15h4",
    chat:   "M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z",
    upload: "M12 16V4m-5 5 5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
    clock:  "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    key:    "M14 7a4 4 0 1 1-5.6 5.6L3 18v3h3l5.4-5.4A4 4 0 0 1 14 7Z",
    shield: "M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z",
    lock:   "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  }[name];

  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} shrink-0`}
         stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={p} />
    </svg>
  );
}

export default function Layout({ children }) {
  const { profile, adminRoles, signOut, can } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isAdmin = profile?.role === "admin";

  const groups = ADMIN_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(i.perm)) }))
    .filter((g) => g.items.length);

  const items = isAdmin ? [] : OTHER_NAV[profile?.role] ?? [];

  const subtitle =
    isAdmin && adminRoles.length
      ? adminRoles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" · ")
      : ROLE_LABEL[profile?.role] ?? "";

  const Brand = ({ compact }) => (
    <div className="flex min-w-0 items-center gap-2.5">
      <img src={logoIcon} alt="" className="h-9 w-9 shrink-0 object-contain" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight text-ink">
          بوابة مكة الثانوية
        </p>
        {!compact && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
    </div>
  );

  const SignOut = () => (
    <button
      onClick={async () => { await signOut(); navigate("/login"); }}
      className="shrink-0 rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint hover:text-mint-deep"
    >
      خروج
    </button>
  );

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 rounded-sm2 px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-mint-tint text-mint-deep"
        : "text-muted hover:bg-canvas hover:text-ink"
    }`;

  /* ================= واجهة الإدارة: قائمة جانبية ================= */
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-tint">
        <TrialBanner />

        {/* شريط علوي للجوال */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="القائمة"
                  className="rounded-sm2 border border-line p-2 text-muted hover:bg-canvas">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                 stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Brand compact />
          <SignOut />
        </header>

        <div className="mx-auto flex max-w-[1400px]">
          {/* القائمة الجانبية — سطح المكتب */}
          <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-line bg-white lg:flex">
            <div className="border-b border-line px-4 py-4">
              <Brand />
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {groups.map((g, gi) => (
                <div key={gi}>
                  {g.title && (
                    <p className="mb-1.5 px-3 text-[11px] font-semibold text-faint">
                      {g.title}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {g.items.map((i) => (
                      <NavLink key={i.to} to={i.to} end={i.to === "/"} className={linkClass}>
                        <Icon name={i.icon} />
                        <span className="truncate">{i.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-line px-4 py-3">
              <SignOut />
            </div>
          </aside>

          {/* القائمة المنسدلة — الجوال */}
          {open && (
            <>
              <div className="fixed inset-0 z-40 bg-ink/30 lg:hidden"
                   onClick={() => setOpen(false)} />
              <aside className="fixed inset-y-0 right-0 z-50 flex w-72 flex-col bg-white shadow-xl lg:hidden">
                <div className="flex items-center justify-between border-b border-line px-4 py-4">
                  <Brand />
                  <button onClick={() => setOpen(false)} aria-label="إغلاق"
                          className="rounded-sm2 p-1.5 text-muted hover:bg-canvas">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none"
                         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                  {groups.map((g, gi) => (
                    <div key={gi}>
                      {g.title && (
                        <p className="mb-1.5 px-3 text-[11px] font-semibold text-faint">
                          {g.title}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {g.items.map((i) => (
                          <NavLink key={i.to} to={i.to} end={i.to === "/"}
                                   onClick={() => setOpen(false)} className={linkClass}>
                            <Icon name={i.icon} />
                            <span className="truncate">{i.label}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              </aside>
            </>
          )}

          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  /* ============ باقي الفئات: شريط أفقي كما هو ============ */
  return (
    <div className="flex min-h-screen flex-col bg-gray-tint">
      <TrialBanner />

      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Brand />
          <SignOut />
        </div>

        {items.length > 1 && (
          <nav className="hidden border-t border-line sm:block">
            <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === "/"}
                  className={({ isActive }) =>
                    `shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? "border-mint-deep text-mint-deep"
                               : "border-transparent text-muted hover:text-ink"}`}>
                  {i.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 pb-24 sm:pb-8">
        {children}
      </main>

      {items.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white sm:hidden">
          <div className="flex overflow-x-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/"}
                className={({ isActive }) =>
                  `min-w-[4.5rem] flex-1 py-3 text-center text-xs font-semibold ${
                    isActive ? "text-mint-deep" : "text-faint"}`}>
                {i.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
