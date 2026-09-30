// src/pages/studio/assets.js
import { createContext, useContext } from "react";

/* أصول المدرسة المشتركة لأوراق الاستوديو (مثل الختم المعتمد) — تمرّ بالسياق
   فتصل للمعاينة ونسخة الطباعة معًا دون تمريرها في بيانات كل قالب. */
export const StudioAssets = createContext({ stamp: null });
export const useStudioAssets = () => useContext(StudioAssets);
