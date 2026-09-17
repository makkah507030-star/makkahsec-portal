import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

const CORE_TABS = [
  { key: "attendance", label: "التحضير" },
  { key: "schedule",   label: "جدولي" },
  { key: "records",    label: "السجلات" },
  { key: "reports",    label: "التقارير" },
  { key: "notify",     label: "الإشعارات" },
];

const EXTRA_TABS = [
  { key: "permissions", label: "الاستئذان", hint: "صلاحية كاملة — رفع استئذان لأي طالب" },
  { key: "news",        label: "الأخبار",   hint: "مسودات فقط — تحتاج موافقة الإدارة قبل النشر" },
];

export default function TeacherPermissions() {
  const [q, setQ] = useState("");
  const [teachers, setTeachers] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [hidden, setHidden] = useState(new Set());   // الأساسية المخفية للمعلم المختار
  const [granted, setGranted] = useState(new Set()); // الإضافية الممنوحة للمعلم المختار
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    supabase.from("teachers").select("id, full_name, specialization").order("full_name")
      .then(({ data }) => setTeachers(data ?? []));
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return teachers ?? [];
    return (teachers ?? []).filter((r) => r.full_name.includes(t));
  }, [teachers, q]);

  const pick = async (t) => {
    setTeacher(t);
    setMsg(null);
    const [{ data: h }, { data: g }] = await Promise.all([
      supabase.from("teacher_hidden_tabs").select("tab_key").eq("teacher_id", t.id),
      supabase.from("teacher_granted_tabs").select("tab_key").eq("teacher_id", t.id),
    ]);
    setHidden(new Set((h ?? []).map((r) => r.tab_key)));
    setGranted(new Set((g ?? []).map((r) => r.tab_key)));
  };

  const toggle = (key) =>
    setHidden((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const toggleExtra = (key) =>
    setGranted((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  const save = async () => {
    if (!teacher) return;
    setSaving(true);
    setMsg(null);

    // إعادة كتابة كاملة لكلا الجدولين: حذف الكل ثم إدراج الحالة الحالية فقط
    const delH = await supabase.from("teacher_hidden_tabs").delete().eq("teacher_id", teacher.id);
    if (delH.error) { setMsg({ ok: false, text: delH.error.message }); setSaving(false); return; }

    if (hidden.size > 0) {
      const rows = [...hidden].map((tab_key) => ({ teacher_id: teacher.id, tab_key }));
      const ins = await supabase.from("teacher_hidden_tabs").insert(rows);
      if (ins.error) { setMsg({ ok: false, text: ins.error.message }); setSaving(false); return; }
    }

    const delG = await supabase.from("teacher_granted_tabs").delete().eq("teacher_id", teacher.id);
    if (delG.error) { setMsg({ ok: false, text: delG.error.message }); setSaving(false); return; }

    if (granted.size > 0) {
      const rows = [...granted].map((tab_key) => ({ teacher_id: teacher.id, tab_key }));
      const ins = await supabase.from("teacher_granted_tabs").insert(rows);
      if (ins.error) { setMsg({ ok: false, text: ins.error.message }); setSaving(false); return; }
    }

    setMsg({ ok: true, text: "حُفظ." });
    setSaving(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">صلاحيات المعلمين</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تحكّم فردي بما يظهر لكل معلم من تبويبات شريطه. افتراضيًا كل التبويبات
          ظاهرة للجميع — إلغِ التحديد لإخفاء تبويب عن معلم بعينه.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr] lg:items-start">
        <section className="card overflow-hidden lg:sticky lg:top-20">
          <div className="border-b border-line p-3">
            <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="فلترة بالاسم" />
          </div>
          {!teachers ? (
            <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>
          ) : (
            <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
              {filtered.map((t) => (
                <button key={t.id} onClick={() => pick(t)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-right transition-colors ${
                    teacher?.id === t.id ? "bg-mint-tint" : "hover:bg-canvas"}`}>
                  <span className="min-w-0 truncate text-sm text-ink">{t.full_name}</span>
                  {teacher?.id === t.id && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint-deep" />}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card min-h-[20rem] space-y-4 p-4">
          {!teacher ? (
            <p className="py-10 text-center text-sm text-muted">اختر معلمًا من القائمة.</p>
          ) : (
            <>
              <div>
                <h2 className="text-sm font-bold text-ink">{teacher.full_name}</h2>
                <p className="text-xs text-muted">{teacher.specialization}</p>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-faint">التبويبات الأساسية</p>
                <div className="space-y-2">
                  {CORE_TABS.map((t) => {
                    const visible = !hidden.has(t.key);
                    return (
                      <label key={t.key}
                        className="flex items-center justify-between gap-3 rounded-sm2 border border-line px-3.5 py-2.5">
                        <span className="text-sm text-ink">{t.label}</span>
                        <span className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${visible ? "text-present" : "text-faint"}`}>
                            {visible ? "ظاهر" : "مخفي"}
                          </span>
                          <input type="checkbox" checked={visible} onChange={() => toggle(t.key)} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-faint">صلاحيات إضافية (معطَّلة افتراضيًا)</p>
                <div className="space-y-2">
                  {EXTRA_TABS.map((t) => {
                    const on = granted.has(t.key);
                    return (
                      <label key={t.key}
                        className="flex items-center justify-between gap-3 rounded-sm2 border border-line px-3.5 py-2.5">
                        <span>
                          <span className="block text-sm text-ink">{t.label}</span>
                          <span className="block text-[11px] text-faint">{t.hint}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className={`text-xs font-medium ${on ? "text-mint-deep" : "text-faint"}`}>
                            {on ? "ممنوحة" : "معطَّلة"}
                          </span>
                          <input type="checkbox" checked={on} onChange={() => toggleExtra(t.key)} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {msg && (
                <p className={`rounded-sm2 px-3 py-2 text-sm ${
                  msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                  {msg.text}
                </p>
              )}

              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "جارٍ الحفظ…" : "حفظ"}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
