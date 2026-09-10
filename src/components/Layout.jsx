import { NavLink, useNavigate } from "react-router-dom";
import { useSession, ROLE_LABEL, ADMIN_ROLE_LABEL } from "../lib/session.jsx";

const NAV = {
  admin: [
    { to: "/", label: "الرئيسية" },
    { to: "/import", label: "الاستيراد" },
    { to: "/students", label: "الطلاب" },
  ],
  teacher: [
    { to: "/", label: "الرئيسية" },
    { to: "/attendance", label: "التحضير" },
  ],
  student: [{ to: "/", label: "الرئيسية" }],
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
    <div className="min-h-screen flex flex-col">
      {/* الترويسة */}
      <header className="bg-brand text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              بوابة مكة الثانوية الرقمية
            </p>
            <p className="truncate text-xs text-white/70">{subtitle}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
            className="shrink-0 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium hover:bg-white/10"
          >
            خروج
          </button>
        </div>

        {/* تنقل سطح المكتب */}
        {items.length > 1 && (
          <nav className="hidden border-t border-white/15 sm:block">
            <div className="mx-auto flex max-w-5xl gap-1 px-2">
              {items.map((i) => (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.to === "/"}
                  className={({ isActive }) =>
                    `px-4 py-2.5 text-sm font-medium border-b-2 ${
                      isActive
                        ? "border-white text-white"
                        : "border-transparent text-white/70 hover:text-white"
                    }`
                  }
                >
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

      {/* تنقل الجوال */}
      {items.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-white sm:hidden">
          <div className="flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === "/"}
                className={({ isActive }) =>
                  `flex-1 py-3 text-center text-xs font-semibold ${
                    isActive ? "text-brand" : "text-muted"
                  }`
                }
              >
                {i.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
