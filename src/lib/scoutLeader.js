// src/lib/scoutLeader.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ADMIN_ROLE_LABEL } from "./session.jsx";

/* =====================================================================
   القائد الكشفي لمخرجات الفريق الكشفي (supabase/scouts_2.sql):
   كشف أسماء الفريق، والنماذج والشهادات، وشهادات الأحداث تظهر باسمه وتوقيعه
   وصفته، ولو أصدرها نائبه أو غيره من أدوار الكشافة.
   القائد: صاحب الدور المخصّص «القائد الكشفي»، وتوقيعه من «توقيعي».
   ===================================================================== */

/** دور من أدوار الكشافة (القائد أو نائبه…): أدوار مخصّصة في اسمها «كشف» */
export const isScoutRole = (r) => /كشف/.test(ADMIN_ROLE_LABEL[r] ?? "");

/** المُصدِر من الكشافة إن كانت أدواره الإدارية كلها من أدوارها */
export const issuesAsScout = (roles) => roles.length > 0 && roles.every(isScoutRole);

let loading = null;

/** { user_id, full_name, label, sig_path, sig_url } أو null إن لم يُسنَد الدور أو لم يُشغَّل الملف */
export function loadScoutLeader() {
  loading ??= (async () => {
    try {
      const { data, error } = await supabase.rpc("scout_leader");
      const row = !error && data?.[0];
      if (!row) return null;
      const { data: link } = row.sig_path
        ? await supabase.storage.from("form-assets").createSignedUrl(row.sig_path, 3600)
        : { data: null };
      return { ...row, sig_url: link?.signedUrl ?? null };
    } catch { return null; }
  })();
  return loading;
}

export function useScoutLeader(enabled = true) {
  const [leader, setLeader] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadScoutLeader().then((l) => { if (alive) setLeader(l); });
    return () => { alive = false; };
  }, [enabled]);
  return leader;
}
