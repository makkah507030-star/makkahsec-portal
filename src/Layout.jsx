import { NavLink, useNavigate } from "react-router-dom";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import logoIcon from "../assets/icon-white.png";

const NAV = {
  admin: [
    { to: "/",            label: "الرئيسية" },
    { to: "/import",      label: "الاستيراد" },
    { to: "/students",    label: "الطلاب" },
    { to: "/accounts",    label: "الحسابات" },
    { to: "/permissions", label: "الاستئذان" },
    { to: "/staff",       label: "الإدارة" },
  ],
  teacher:  [{ to: "/", label: "التحضير" }],
  student:  [{ to: "/", label: "الرئيسية" }],
  guardian: [{ to: "/", label: "الرئيسية" }],
};

export default function Layout({ children }) {
  const { profile, adminRoles, signOut } = useSession();
  const navigate = useNavigate();
  const items = NAV[profile?.role] ?? [];

  const subtitle =
    profile?.role === "admin" && adminRoles.length
      ? adminRoles.map((r) => ADMIN_ROLE_LABEL[r]).join(" · ")
      : ROLE_LABEL[profile?.role] ?? "";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-mint-deep text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm2 bg-white/15 p-1">
              <img
                src={logoIcon}
                alt="شعار مدرسة مكة الثانوية"
                className="h-full w-full object-contain"
              />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                بوابة مكة الثانوية
              </p>
              <p className="truncate text-xs text-white/60">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={async () => { await signOut(); navigate("/login"); }}
            className="shrink-0 rounded-sm2 border border-white/25 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            خروج
          </button>
        </div>

        {items.length > 1 && (
          <nav className="hidden border-t border-white/15 sm:block">
            <div className="mx-auto flex max-w-5xl gap-1 px-2">
              {items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.to === "/"}
                  className={({ isActive }) =>
                    `border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive ? "border-white text-white"
                               : "border-transparent text-white/65 hover:text-white"}`}>
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
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-paper sm:hidden">
          <div className="flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.to === "/"}
                className={({ isActive }) =>
                  `flex-1 py-3 text-center text-xs font-semibold ${
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
