// src/lib/navContext.js
/* أقسام القائمة العامة كما يراها المستخدم (بعد تصفية الصلاحيات) وعدادات «بانتظار إجرائك»،
   من Layout إلى صفحة القسم (pages/SectionHub.jsx) — فتعرض الصفحة ما تعرضه القائمة بالضبط. */
import { createContext, useContext } from "react";

export const NavContext = createContext(null);
export const useNav = () => useContext(NavContext);
