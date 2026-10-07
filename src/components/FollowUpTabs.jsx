// src/components/FollowUpTabs.jsx
import { NavLink } from "react-router-dom";

// التبديل بين سجلَّي المتابعة الإلكتروني — رابط واحد في القائمة الجانبية يجمعهما
const TABS = [
  { to: "/follow-up", label: "السجل 1", hint: "تأشير الطلاب في البند" },
  { to: "/follow-up-2", label: "السجل 2", hint: "توزيع الدرجات بالخانات" },
];

export default function FollowUpTabs() {
  return (
    <div className="mb-5 inline-flex rounded-pill border border-line bg-white p-1 print:hidden">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end
                 className={({ isActive }) =>
                   `rounded-pill px-4 py-1.5 text-[13px] transition-colors ${
                     isActive ? "bg-mint-deep font-semibold text-white" : "font-medium text-muted hover:text-ink"}`}>
          {t.label}
          <span className="hidden text-[11px] font-normal opacity-80 sm:inline"> · {t.hint}</span>
        </NavLink>
      ))}
    </div>
  );
}
