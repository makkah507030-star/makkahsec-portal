import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtGreg } from "../../lib/dates";

// أنواع محطات التقويم — «إجازة» فقط هي التي تُعطّل الدراسة في البوابة،
// والبقية للعرض في شريط «التقويم الدراسي» العام.
const KINDS = [
  { key: "holiday",    label: "إجازة" },
  { key: "event",      label: "حدث" },
  { key: "exam",       label: "اختبارات" },
  { key: "term_start", label: "بداية فصل" },
  { key: "term_end",   label: "نهاية فصل" },
];
const kindLabel = (k) => KINDS.find((x) => x.key === k)?.label ?? k;

// يُصغّر صورة الشعار إلى عرض معقول ويعيدها Data-URL لتخزينها في الحقل
function fileToLogo(file, maxW = 900) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const EMPTY = {
  id: null, title: "", kind: "holiday",
  start_date: "", end_date: "", hijri_label: "", logo: "", is_active: true,
};

export default function CalendarAdmin() {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("academic_calendar")
      .select("id, title, kind, start_date, end_date, hijri_label, logo, is_active")
      .order("start_date", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const editing = Boolean(form.id);
  const isHoliday = form.kind === "holiday";

  const canSave = useMemo(() => {
    if (form.title.trim().length < 2) return false;
    if (!form.start_date) return false;
    if (form.end_date && form.end_date < form.start_date) return false;
    return true;
  }, [form]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const logo = await fileToLogo(file);
      set("logo", logo);
    } catch {
      setMsg({ ok: false, text: "تعذّر قراءة الصورة." });
    }
  };

  const reset = () => { setForm(EMPTY); setMsg(null); };

  const save = async () => {
    setSaving(true); setMsg(null);
    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      hijri_label: form.hijri_label.trim() || null,
      logo: isHoliday ? (form.logo || null) : null,
      is_active: form.is_active,
    };
    const q = editing
      ? supabase.from("academic_calendar").update(payload).eq("id", form.id)
      : supabase.from("academic_calendar").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: editing ? "تم حفظ التعديل." : "تمت الإضافة." });
    reset();
    load();
  };

  const edit = (r) => {
    setForm({
      id: r.id, title: r.title, kind: r.kind,
      start_date: r.start_date ?? "", end_date: r.end_date ?? "",
      hijri_label: r.hijri_label ?? "", logo: r.logo ?? "",
      is_active: r.is_active ?? true,
    });
    setMsg(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (r) => {
    if (!window.confirm(`حذف «${r.title}» نهائيًا؟`)) return;
    await supabase.from("academic_calendar").delete().eq("id", r.id);
    if (form.id === r.id) reset();
    load();
  };

  const toggleActive = async (r) => {
    await supabase.from("academic_calendar")
      .update({ is_active: !r.is_active }).eq("id", r.id);
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">التقويم والإجازات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أضف إجازات المدرسة ومحطات التقويم. أي <b>إجازة</b> مفعّلة تُعامَل تلقائيًا
          كيوم عطلة كامل في كل البوابة خلال مدّتها (تختفي الجداول والتحضير وإحصائيات
          اليوم)، ويظهر اسمها وشعارها في الصفحة الرئيسية.
        </p>
      </div>

      {/* نموذج الإضافة/التعديل */}
      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">
          {editing ? "تعديل محطة" : "إضافة محطة جديدة"}
        </h2>

        <div>
          <label className="text-xs text-muted">الاسم</label>
          <input className="field mt-1" value={form.title}
                 onChange={(e) => set("title", e.target.value)}
                 placeholder="مثال: إجازة اليوم الوطني" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">النوع</label>
            <select className="field mt-1" value={form.kind}
                    onChange={(e) => set("kind", e.target.value)}>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">الوصف الهجري (اختياري)</label>
            <input className="field mt-1" value={form.hijri_label}
                   onChange={(e) => set("hijri_label", e.target.value)}
                   placeholder="مثال: ١٢–١٣/٤/١٤٤٨" dir="rtl" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs text-muted">من تاريخ</label>
            <input type="date" className="field mt-1" value={form.start_date}
                   onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted">إلى تاريخ (اتركه فارغًا ليوم واحد)</label>
            <input type="date" className="field mt-1" value={form.end_date}
                   onChange={(e) => set("end_date", e.target.value)} />
          </div>
        </div>

        {isHoliday && (
          <div>
            <label className="text-xs text-muted">شعار الإجازة (اختياري)</label>
            <div className="mt-1 flex items-center gap-3">
              <input type="file" accept="image/*" onChange={onLogo}
                     className="text-sm text-muted" />
              {form.logo && (
                <div className="flex items-center gap-2">
                  <img src={form.logo} alt=""
                       className="h-12 rounded-md border border-line" />
                  <button type="button" onClick={() => set("logo", "")}
                          className="text-xs text-absent">إزالة</button>
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-faint">
              يظهر داخل صندوق الإجازة في الصفحة الرئيسية.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.is_active}
                 onChange={(e) => set("is_active", e.target.checked)} />
          مفعّلة
        </label>

        {msg && (
          <p className={`rounded-card px-4 py-3 text-sm ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}

        <div className="flex gap-2">
          <button className="btn-primary" onClick={save} disabled={!canSave || saving}>
            {saving ? "جارٍ الحفظ…" : editing ? "حفظ التعديل" : "إضافة"}
          </button>
          {editing && (
            <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted hover:bg-canvas"
                    onClick={reset}>إلغاء</button>
          )}
        </div>
      </section>

      {/* القائمة */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          المحطات المسجّلة
        </h2>
        {!rows ? (
          <p className="px-4 py-5 text-sm text-muted">جارٍ التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">لا توجد محطات بعد.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id}
                 className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              {r.logo
                ? <img src={r.logo} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
                : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-mint-tint text-[11px] font-bold text-mint-deep">{kindLabel(r.kind)}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {r.title}
                  {!r.is_active && <span className="mr-2 text-xs font-normal text-faint">(موقوفة)</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {kindLabel(r.kind)} · {fmtGreg(r.start_date + "T00:00:00")}
                  {r.end_date && r.end_date !== r.start_date &&
                    ` — ${fmtGreg(r.end_date + "T00:00:00")}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button onClick={() => toggleActive(r)}
                        className="rounded-pill border border-line px-2.5 py-1 text-xs text-muted hover:bg-canvas">
                  {r.is_active ? "إيقاف" : "تفعيل"}
                </button>
                <button onClick={() => edit(r)}
                        className="rounded-pill border border-line px-2.5 py-1 text-xs text-mint-deep hover:bg-canvas">
                  تعديل
                </button>
                <button onClick={() => remove(r)}
                        className="rounded-pill border border-line px-2.5 py-1 text-xs text-absent hover:bg-canvas">
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
