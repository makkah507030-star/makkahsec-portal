// src/pages/studio/Access.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { GENERAL_ROLES, SPECIFIC_ROLES } from "../../lib/formRoles";
import { useNotice } from "../../lib/useNotice.js";
import { SECTIONS, TEMPLATES } from "./templates";
import { STUDIO_ACCESS_KEY, defaultAccess } from "./lib";

/* =====================================================================
   إدارة القوالب — المدير والدعم الفني يحددون من يستخدم كل قالب.
   الافتراضي: قوالب المعلمين للمعلمين، وقوالب الإداريين للإداريين.
   ===================================================================== */

const chip = (on) =>
  `rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

const sectionLabel = (tpl) => tpl.sections.map((s) => SECTIONS.find((x) => x.key === s)?.label).join(" و");

export default function Access({ rules, onSaved }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(TEMPLATES.map((t) => [t.key, rules[t.key] ?? defaultAccess(t)])));
  const [openKey, setOpenKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const toggle = (key, role) => setDraft((d) => {
    const cur = d[key] ?? [];
    return { ...d, [key]: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role] };
  });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("settings")
      .upsert({ key: STUDIO_ACCESS_KEY, value: JSON.stringify(draft) }, { onConflict: "key" });
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: /row-level security|permission/i.test(error.message)
        ? "الحفظ للدعم الفني يحتاج تشغيل supabase/studio_access.sql مرة واحدة، ويستطيع المدير الحفظ مباشرة."
        : `تعذّر الحفظ: ${error.message}` });
      return;
    }
    onSaved(draft);
    setMsg({ ok: true, text: "حُفظت الصلاحيات، وتسري على المستخدمين عند فتحهم الاستوديو." });
  };

  return (
    <div className="space-y-3">
      <p className="rounded-card bg-mint-tint px-4 py-3 text-sm leading-relaxed text-mint-deep">
        حدّد من يستخدم كل قالب: كل المعلمين، أو كل الإداريين، أو أدوارًا بعينها. المدير والدعم الفني
        يصلان لكل القوالب دائمًا، والقالب بلا أي اختيار لا يظهر لغيرهما.
      </p>

      <div className="card divide-y divide-line overflow-hidden">
        {TEMPLATES.map((t) => {
          const roles = draft[t.key] ?? [];
          const specific = roles.filter((r) => !GENERAL_ROLES.some((g) => g.key === r));
          return (
            <div key={t.key} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-[11px] text-muted">قسم {sectionLabel(t)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {GENERAL_ROLES.map((g) => (
                    <button key={g.key} className={chip(roles.includes(g.key))} onClick={() => toggle(t.key, g.key)}>
                      {g.label}
                    </button>
                  ))}
                  <button className={chip(openKey === t.key)} onClick={() => setOpenKey(openKey === t.key ? null : t.key)}>
                    أدوار محددة{specific.length ? ` (${specific.length})` : ""}
                  </button>
                </div>
              </div>
              {openKey === t.key && (
                <div className="flex flex-wrap gap-1.5 rounded-sm2 bg-canvas p-2">
                  {SPECIFIC_ROLES.map((r) => (
                    <button key={r.key} className={chip(roles.includes(r.key))} onClick={() => toggle(t.key, r.key)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
              {!roles.length && <p className="text-[11px] text-absent">مخفي عن الجميع عدا المدير والدعم الفني.</p>}
            </div>
          );
        })}
      </div>

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={save} className="btn-primary px-6 disabled:opacity-50">حفظ الصلاحيات</button>
        <button onClick={() => setDraft(Object.fromEntries(TEMPLATES.map((t) => [t.key, defaultAccess(t)])))}
          className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          الرجوع للافتراضي
        </button>
      </div>
    </div>
  );
}
