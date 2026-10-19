// src/pages/activities/Activities.jsx
// الأنشطة: حقيبة حصص الانتظار (ترفيه يخفف ضغط الحصص)، والأنشطة الصفية، وأدوات الصف
// مع دوري المادة (أفراد) وكأسها (مجموعات). يدير البنك وكيل الشؤون التعليمية،
// ويستفيد منه المعلمون (supabase/activities_1.sql و_2).
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import ActivityBank from "./ActivityBank.jsx";
import ClassTools from "./ClassTools.jsx";
import ActivityAdmin from "./ActivityAdmin.jsx";

export default function Activities() {
  const { effectiveRole, adminRoles } = useSession();
  const manager = effectiveRole === "admin" && adminRoles.includes("deputy_academic");
  const teacher = effectiveRole === "teacher";
  const tabs = [
    { key: "waiting", label: "حقيبة حصص الانتظار" },
    { key: "class", label: "الأنشطة الصفية" },
    { key: "tools", label: "أدوات الصف ودوري المادة" },
    ...(manager ? [{ key: "admin", label: "إدارة البنك" }] : []),
  ];
  const [params, setParams] = useSearchParams();
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "waiting";
  const go = (k) => setParams({ tab: k }, { replace: true });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">الأنشطة</h1>
        <p className="mt-0.5 text-sm text-muted">
          {manager ? "أضف أنشطة الحقيبة والأنشطة الصفية وانشرها للمعلمين، وتابع استخدامها."
            : "أنشطة جاهزة لحصص الانتظار ولدروسك، وأدوات للصف ودوري المادة."}
        </p>
      </div>
      <div className="flex max-w-full overflow-x-auto rounded-card border border-line bg-paper p-1 sm:inline-flex print:hidden">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => go(t.key)}
                  className={`shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-[13px] transition-colors ${
                    tab === t.key ? "bg-mint-deep font-semibold text-white" : "font-medium text-muted hover:text-ink"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {(tab === "waiting" || tab === "class") && <ActivityBank key={tab} kind={tab} teacher={teacher} />}
      {tab === "tools" && <ClassTools teacher={teacher} />}
      {tab === "admin" && <ActivityAdmin />}
    </div>
  );
}
