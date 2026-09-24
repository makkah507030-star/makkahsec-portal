// src/pages/admin/DutyAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { DAY_NAMES } from "../../lib/schoolTime";
import DutyReport, { DutyPrintArea } from "../../components/DutyReport.jsx";
import { useSession } from "../../lib/session.jsx";

/* =====================================================================
   إدارة المناوبة والإشراف.
   تُدخل منها جداول الفصل الجديد وتُعدّل بلا تدخل برمجي:
   • المناوبة: يوم بتاريخه ومناوبَيه.
   • الإشراف: أسبوعي ثابت، معلمون ومشرف متابع لكل يوم.
   • الأسماء تُختار من قائمة الموظفين، فلا تقع أخطاء إملائية ولا ربط فاشل.
   ===================================================================== */

const iso = (d) => d.toISOString().slice(0, 10);
const todayISO = () => iso(new Date());

const fmtG = (s) => {
  if (!s) return "";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const hijriOf = (s) => {
  if (!s) return "";
  try {
    const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(s + "T00:00:00"));
    const g = (t) => p.find((x) => x.type === t)?.value ?? "";
    return `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}`;
  } catch { return ""; }
};

// اليوم من التاريخ: الأحد = 1 … الخميس = 5، و0 لنهاية الأسبوع
const dowOf = (s) => {
  const n = new Date(s + "T00:00:00").getDay() + 1;
  return n >= 1 && n <= 5 ? n : 0;
};

export default function DutyAdmin() {
  const { profile } = useSession();
  const [tab, setTab] = useState("duty");
  const [staff, setStaff] = useState([]);
  const [report, setReport] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("users")
        .select("id, full_name, username, role")
        .in("role", ["teacher", "admin"])
        .eq("is_active", true)
        .order("full_name");
      setStaff(data ?? []);
    })();
  }, []);

  // تقرير الجدولين للطباعة
  const buildReport = async () => {
    // الموقّعان: وكيل الشؤون التعليمية ومدير المدرسة، من الحسابات الإدارية
    const { data: signers } = await supabase
      .from("admin_roles")
      .select("role_type, users(full_name)")
      .in("role_type", ["deputy_academic", "principal"]);
    const nameOf = (role) =>
      (signers ?? []).find((r) => r.role_type === role)?.users?.full_name ?? "";

    const [{ data: duty }, { data: sup }] = await Promise.all([
      supabase.from("duty_roster")
        .select("id, duty_date, hijri_label, week_label, day_label, name_a, name_b")
        .order("duty_date"),
      supabase.from("supervision_duty")
        .select("day_of_week, person_name, kind").order("day_of_week"),
    ]);
    setReport({
      duty: duty ?? [],
      supervision: sup ?? [],
      deputy: nameOf("deputy_academic"),
      principal: nameOf("principal"),
      term: duty?.length
        ? `من ${new Date(duty[0].duty_date + "T00:00:00").toLocaleDateString("ar-SA-u-ca-gregory")}` +
          ` إلى ${new Date(duty[duty.length - 1].duty_date + "T00:00:00").toLocaleDateString("ar-SA-u-ca-gregory")}`
        : "",
    });
  };

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">المناوبة والإشراف</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          جدول المناوبة اليومية وجدول الإشراف الأسبوعي. تظهر لكل موظف مناوبته
          وإشرافه في صفحته الرئيسية، ويصله تنبيه بارز في يومه.
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-1.5">
        <button className={pill(tab === "duty")} onClick={() => setTab("duty")}>المناوبة</button>
        <button className={pill(tab === "sup")} onClick={() => setTab("sup")}>الإشراف الأسبوعي</button>
        <button className="btn-primary mr-auto" onClick={buildReport}>تقرير الجدولين</button>
      </div>

      {report && (
        <>
          <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
            <p className="text-sm text-mint-deep">
              التقرير جاهز — <span className="num">{report.duty.length}</span> يوم مناوبة
              و<span className="num">{report.supervision.length}</span> اسم إشراف.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setReport(null)}
                      className="rounded-pill border border-line bg-white px-4 py-1.5 text-sm text-muted">
                إغلاق
              </button>
              <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
            </div>
          </div>

          <div className="hidden print:block">
            <DutyPrintArea>
              <DutyReport {...report} />
            </DutyPrintArea>
          </div>
        </>
      )}

      <div className="no-print">
        {tab === "duty" && <DutyTab staff={staff} />}
        {tab === "sup" && <SupTab staff={staff} />}
      </div>
    </div>
  );
}

/* ------------------------- اختيار موظف ------------------------- */
function StaffPick({ staff, value, onChange, placeholder = "اختر…" }) {
  return (
    <select className="field w-full" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>{s.full_name ?? s.username}</option>
      ))}
    </select>
  );
}

/* --------------------------- المناوبة --------------------------- */
function DutyTab({ staff }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [from, setFrom] = useState("");
  const [adding, setAdding] = useState(false);
  const [openWeeks, setOpenWeeks] = useState(null);   // أسماء الأسابيع المفتوحة
  const [nf, setNf] = useState({ date: "", a: null, b: null, note: "", week: "" });

  const nameById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s.full_name ?? s.username])),
    [staff]);

  const load = async () => {
    let q = supabase.from("duty_roster")
      .select("id, duty_date, hijri_label, week_label, day_label, name_a, name_b, user_a, user_b, note")
      .order("duty_date");
    if (from) q = q.gte("duty_date", from);
    const { data } = await q;
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [from]);

  // تجميع الأيام بالأسابيع: يُعتمد اسم الأسبوع، وإلا يُحسب من تاريخ الأحد
  const weeks = useMemo(() => {
    const today = todayISO();
    const map = new Map();
    (rows ?? []).forEach((r) => {
      let key = r.week_label;
      if (!key) {
        const d = new Date(r.duty_date + "T00:00:00");
        d.setDate(d.getDate() - ((d.getDay() + 7) % 7));   // أحد ذلك الأسبوع
        key = fmtG(iso(d));
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return [...map.entries()].map(([key, items]) => ({
      key,
      items,
      current: items.some((x) => x.duty_date === today) ||
               (items[0].duty_date <= today && items[items.length - 1].duty_date >= today),
    }));
  }, [rows]);

  const defaultOpen = useMemo(() => {
    const cur = weeks.filter((w) => w.current).map((w) => w.key);
    if (cur.length) return cur;
    const next = weeks.find((w) => w.items[0].duty_date >= todayISO());
    return next ? [next.key] : weeks.slice(-1).map((w) => w.key);
  }, [weeks]);

  const patch = async (row, fields) => {
    const { error } = await supabase.from("duty_roster").update(fields).eq("id", row.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...fields } : r)));
    setMsg({ ok: true, text: `حُفظ ${fmtG(row.duty_date)}` });
  };

  const setPerson = (row, slot, userId) => {
    const name = userId ? nameById[userId] : null;
    patch(row, slot === "a" ? { user_a: userId, name_a: name } : { user_b: userId, name_b: name });
  };

  const add = async () => {
    if (!nf.date) { setMsg({ ok: false, text: "حدّد التاريخ." }); return; }
    const dow = dowOf(nf.date);
    const payload = {
      duty_date: nf.date,
      hijri_label: hijriOf(nf.date),
      day_label: DAY_NAMES[dow] ?? "",
      week_label: nf.week.trim() || null,
      user_a: nf.a, name_a: nf.a ? nameById[nf.a] : null,
      user_b: nf.b, name_b: nf.b ? nameById[nf.b] : null,
      note: nf.note.trim() || null,
    };
    const { error } = await supabase.from("duty_roster")
      .upsert(payload, { onConflict: "duty_date" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `أُضيف ${fmtG(nf.date)}` });
    setNf({ date: "", a: null, b: null, note: "", week: "" });
    setAdding(false);
    load();
  };

  const remove = async (row) => {
    if (!window.confirm(`حذف مناوبة ${fmtG(row.duty_date)}؟`)) return;
    await supabase.from("duty_roster").delete().eq("id", row.id);
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted">اعرض من تاريخ</label>
          <input type="date" className="field num mt-1" value={from}
                 onChange={(e) => setFrom(e.target.value)} />
        </div>
        <button onClick={() => setFrom(todayISO())}
                className="rounded-pill border border-line px-3.5 py-2 text-xs text-muted hover:bg-canvas">
          من اليوم
        </button>
        <button onClick={() => setFrom("")}
                className="rounded-pill border border-line px-3.5 py-2 text-xs text-muted hover:bg-canvas">
          الكل
        </button>
        <button className="btn-primary mr-auto" onClick={() => setAdding((v) => !v)}>
          {adding ? "إغلاق" : "إضافة يوم مناوبة"}
        </button>
      </div>

      {adding && (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">يوم مناوبة جديد</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted">التاريخ</label>
              <input type="date" className="field num mt-1 w-full" value={nf.date}
                     onChange={(e) => setNf((f) => ({ ...f, date: e.target.value }))} />
              {nf.date && (
                <p className="num mt-1 text-[11px] text-mint-deep">
                  {DAY_NAMES[dowOf(nf.date)] ?? "نهاية أسبوع"} · {hijriOf(nf.date)}هـ
                </p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted">الأسبوع (اختياري)</label>
              <input className="field mt-1 w-full" value={nf.week} placeholder="مثال: الأول"
                     onChange={(e) => setNf((f) => ({ ...f, week: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted">المناوب الأول</label>
              <div className="mt-1">
                <StaffPick staff={staff} value={nf.a} onChange={(v) => setNf((f) => ({ ...f, a: v }))} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted">المناوب الثاني</label>
              <div className="mt-1">
                <StaffPick staff={staff} value={nf.b} onChange={(v) => setNf((f) => ({ ...f, b: v }))} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">ملاحظة (اختياري)</label>
            <input className="field mt-1 w-full" value={nf.note} placeholder="مثال: إجازة اليوم الوطني"
                   onChange={(e) => setNf((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={add}>حفظ اليوم</button>
        </section>
      )}

      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}
      {rows?.length === 0 && (
        <p className="card px-4 py-6 text-sm text-muted">لا أيام مناوبة في هذا النطاق.</p>
      )}

      {/* الأسابيع: مطويّة افتراضيًا عدا الأسبوع الجاري */}
      {weeks.map((w) => {
        const open = (openWeeks ?? defaultOpen).includes(w.key);
        return (
          <section key={w.key} className="overflow-hidden rounded-card border border-line bg-white">
            <button
              onClick={() => setOpenWeeks((prev) => {
                const cur = prev ?? defaultOpen;
                return cur.includes(w.key) ? cur.filter((x) => x !== w.key) : [...cur, w.key];
              })}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors ${
                w.current ? "bg-mint-tint" : "hover:bg-canvas"}`}>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-ink">
                  الأسبوع {w.key}
                  {w.current && <span className="mr-2 chip bg-mint-deep text-white">الجاري</span>}
                </span>
                <span className="num mt-0.5 block text-xs text-faint">
                  {fmtG(w.items[0].duty_date)} — {fmtG(w.items[w.items.length - 1].duty_date)}
                  {" · "}{w.items.length} أيام
                </span>
              </span>
              <svg viewBox="0 0 24 24" fill="none"
                   className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`}
                   stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {open && (
              <div className="space-y-2 border-t border-line p-3">
                {w.items.map((r) => {
          const past = r.duty_date < todayISO();
          const isToday = r.duty_date === todayISO();
          return (
            <div key={r.id}
                 className={`card p-3 ${isToday ? "border-mint-deep bg-mint-tint/40" : past ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num shrink-0 rounded-sm2 bg-mint-tint px-2.5 py-1 text-xs font-bold text-mint-deep">
                  {fmtG(r.duty_date)}
                </span>
                <span className="text-xs text-muted">
                  {r.day_label}
                  {r.hijri_label && <span className="num"> · {r.hijri_label}هـ</span>}
                  {r.week_label && <span> · الأسبوع {r.week_label}</span>}
                </span>
                {isToday && <span className="chip bg-mint-deep text-white">اليوم</span>}
                <button onClick={() => remove(r)}
                        className="mr-auto shrink-0 text-xs font-medium text-absent hover:underline">
                  حذف
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <StaffPick staff={staff} value={r.user_a}
                           placeholder={r.name_a ? `${r.name_a} — غير مربوط` : "المناوب الأول"}
                           onChange={(v) => setPerson(r, "a", v)} />
                <StaffPick staff={staff} value={r.user_b}
                           placeholder={r.name_b ? `${r.name_b} — غير مربوط` : "المناوب الثاني"}
                           onChange={(v) => setPerson(r, "b", v)} />
              </div>

              {r.note && <p className="mt-1.5 text-xs text-warning">{r.note}</p>}
            </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------- الإشراف -------------------------- */
function SupTab({ staff }) {
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [add, setAdd] = useState({ day: 1, kind: "teacher", user: null });

  const nameById = useMemo(
    () => Object.fromEntries(staff.map((s) => [s.id, s.full_name ?? s.username])),
    [staff]);

  const load = async () => {
    const { data } = await supabase.from("supervision_duty")
      .select("id, day_of_week, person_name, kind, user_id")
      .order("day_of_week").order("kind");
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const addRow = async () => {
    if (!add.user) { setMsg({ ok: false, text: "اختر الموظف." }); return; }
    const { error } = await supabase.from("supervision_duty").insert({
      day_of_week: Number(add.day),
      person_name: nameById[add.user],
      kind: add.kind,
      user_id: add.user,
    });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "أُضيف." });
    setAdd((a) => ({ ...a, user: null }));
    load();
  };

  const remove = async (r) => {
    if (!window.confirm(`حذف ${r.person_name} من إشراف ${DAY_NAMES[r.day_of_week]}؟`)) return;
    await supabase.from("supervision_duty").delete().eq("id", r.id);
    load();
  };

  const clearDay = async (d) => {
    if (!window.confirm(`حذف كل مشرفي ${DAY_NAMES[d]}؟ يُستعمل عند إدخال جدول فصل جديد.`)) return;
    await supabase.from("supervision_duty").delete().eq("day_of_week", d);
    load();
  };

  return (
    <div className="space-y-3">
      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">إضافة مشرف</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="text-xs text-muted">اليوم</label>
            <select className="field mt-1 w-full" value={add.day}
                    onChange={(e) => setAdd((a) => ({ ...a, day: e.target.value }))}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">الصفة</label>
            <select className="field mt-1 w-full" value={add.kind}
                    onChange={(e) => setAdd((a) => ({ ...a, kind: e.target.value }))}>
              <option value="teacher">معلم مشرف</option>
              <option value="supervisor">مشرف متابع</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted">اسم الموظف</label>
            <div className="mt-1">
              <StaffPick staff={staff} value={add.user} onChange={(v) => setAdd((a) => ({ ...a, user: v }))} />
            </div>
          </div>
        </div>
        <button className="btn-primary" onClick={addRow}>إضافة</button>
        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}
      </section>

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {[1, 2, 3, 4, 5].map((d) => {
        const day = (rows ?? []).filter((r) => r.day_of_week === d);
        const teachers = day.filter((r) => r.kind === "teacher");
        const sups = day.filter((r) => r.kind === "supervisor");
        return (
          <section key={d} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-mint-deep">{DAY_NAMES[d]}</h2>
              {day.length > 0 && (
                <button onClick={() => clearDay(d)}
                        className="text-xs font-medium text-absent hover:underline">
                  حذف الكل
                </button>
              )}
            </div>

            {day.length === 0 ? (
              <p className="mt-2 text-xs text-muted">لا مشرفين لهذا اليوم.</p>
            ) : (
              <>
                <p className="mt-2 text-[11px] font-medium text-faint">المعلمون المشرفون</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {teachers.map((r) => <Chip key={r.id} r={r} onRemove={remove} />)}
                  {teachers.length === 0 && <span className="text-xs text-muted">—</span>}
                </div>

                <p className="mt-3 text-[11px] font-medium text-faint">المشرف المتابع</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {sups.map((r) => <Chip key={r.id} r={r} onRemove={remove} sup />)}
                  {sups.length === 0 && <span className="text-xs text-muted">—</span>}
                </div>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Chip({ r, onRemove, sup }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs ${
      sup ? "bg-warning/10 text-warning" : "bg-mint-tint text-mint-deep"}`}>
      {r.person_name}
      {!r.user_id && <span className="text-absent">غير مربوط</span>}
      <button onClick={() => onRemove(r)} aria-label="حذف"
              className="opacity-60 transition-opacity hover:opacity-100">×</button>
    </span>
  );
}
