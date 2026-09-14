import { NavLink, useNavigate } from "react-router-dom";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";
import TrialBanner from "./TrialBanner.jsx";

// عناصر الإدارة مربوطة بمفاتيح الصلاحيات
const ADMIN_NAV = [
  { to: "/",            label: "الرئيسية",  perm: null },
  { to: "/import",      label: "الاستيراد", perm: "import" },
  { to: "/students",    label: "الطلاب",    perm: "students" },
  { to: "/reports",     label: "التقارير",  perm: "reports" },
  { to: "/permissions", label: "الاستئذان", perm: "permissions" },
  { to: "/accounts",    label: "الحسابات",  perm: "accounts" },
  { to: "/staff",       label: "الإدارة",   perm: "staff" },
  { to: "/news-admin",  label: "الأخبار",   perm: "news" },
];

const OTHER_NAV = {
  teacher: [
    { to: "/",        label: "التحضير" },
    { to: "/reports", label: "التقارير" },
  ],
  student:  [{ to: "/", label: "الرئيسية" }],
  guardian: [{ to: "/", label: "الرئيسية" }],
};

export default function Layout({ children }) {
  const { profile, adminRoles, signOut, can } = useSession();
  const navigate = useNavigate();

  const items =
    profile?.role === "admin"
      ? ADMIN_NAV.filter((i) => !i.perm || can(i.perm))
      : OTHER_NAV[profile?.role] ?? [];

  const subtitle =
    profile?.role === "admin" && adminRoles.length
      ? adminRoles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" · ")
      : ROLE_LABEL[profile?.role] ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-gray-tint">
      <TrialBanner />

      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={logoIcon}
              alt="شعار مدرسة مكة الثانوية"
              className="h-9 w-9 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-ink">
                بوابة مكة الثانوية
              </p>
              <p className="truncate text-xs text-muted">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="shrink-0 rounded-pill border border-line px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint hover:text-mint-deep"
          >
            خروج
          </button>
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
