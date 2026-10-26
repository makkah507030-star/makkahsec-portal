// src/pages/lab/LabUsage.jsx
// سجل استخدام المعمل وتقريره للإدارة: كل حصة محجوزة مضى وقتها سجلٌّ تلقائي،
// ويؤكد المعلم «تمت» أو «لم تُستخدم» مع ملاحظة، ويسجّل استخدامًا بلا حجز.
// التقرير: الإشغال (من الحصص الدراسية المتاحة بعد الإجازات)، والاستخدام حسب
// المعلم والفصل، والأعطال، والتفاصيل — بقالب التقارير الرسمي للبوابة.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Loader from "../../components/Loader.jsx";
import { DAY_NAMES, PERIODS_PER_DAY, todayISO } from "../../lib/schoolTime";
import { printReport, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME, escHtml } from "../../lib/exportUtils";
import { addDays, parseISO, weekStart, shortDate, classText } from "../../lib/lab.js";
import { cmpAr } from "../../lib/sortAr.js";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const dowOf = (iso) => parseISO(iso).getDay() + 1;   // الأحد = 1
const monthStart = (iso) => `${iso.slice(0, 8)}01`;

// عناصر التقرير المطبوع — أصناف printReport نفسها (stat-tiles وbar-chart)، والقيم مهرّبة (أسماء المعلمين والفصول)
const tilesHtml = (tiles) => `<div class="stat-tiles">${tiles
  .map((t) => `<div class="stat-tile"><p class="v">${escHtml(t.value)}</p><p class="l">${escHtml(t.label)}</p></div>`).join("")}</div>`;
const headingHtml = (t) => `<p style="margin:12px 0 6px;font-size:11.5px;font-weight:700;color:#3E6350;">${escHtml(t)}</p>`;
const barsHtml = (items) => {
  const max = Math.max(1, ...items.map((i) => i.count));
  return `<div class="bar-chart">${items.map((it) => `<div class="bar-row">
    <div class="bl"><span>${escHtml(it.label)}</span><span class="n">${escHtml(it.count)}</span></div>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.round((it.count / max) * 100)}%;background:#3E6350"></div></div>
  </div>`).join("")}</div>`;
};

export default function LabUsage({ lab, canBook, isManager }) {
  const today = todayISO();
  const [range, setRange] = useState(() => ({ key: "month", from: monthStart(today), to: today }));
  const [rows, setRows] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [marking, setMarking] = useState(null);   // { row, used }
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const presets = [
    { key: "week", label: "هذا الأسبوع", from: weekStart(today), to: addDays(weekStart(today), 4) },
    { key: "month", label: "هذا الشهر", from: monthStart(today), to: today },
    { key: "90", label: "آخر 90 يومًا", from: addDays(today, -90), to: today },
  ];

  const load = useCallback(async () => {
    setRows(null);
    const [{ data, error }, { data: hol }, { data: tk }] = await Promise.all([
      supabase.rpc("lab_usage", { p_lab: lab, p_from: range.from, p_to: range.to }),
      supabase.from("academic_calendar").select("start_date, end_date").eq("kind", "holiday").eq("is_active", true)
        .lte("start_date", range.to).or(`end_date.gte.${range.from},and(end_date.is.null,start_date.gte.${range.from})`),
      supabase.from("lab_tickets").select("status, created_at").eq("lab_id", lab)
        .gte("created_at", `${range.from}T00:00:00`).lte("created_at", `${range.to}T23:59:59`),
    ]);
    if (error) setMsg({ ok: false, text: "تعذّر تحميل السجل: " + error.message });
    setRows(data ?? []);
    setHolidays(hol ?? []);
    setTickets(tk ?? []);
  }, [lab, range.from, range.to, setMsg]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    supabase.from("labs").select("name").eq("id", lab).maybeSingle().then(({ data }) => data?.name && setLabName(data.name));
  }, [lab]);

  const stats = useMemo(() => {
    if (!rows) return null;
    // الحصص الدراسية المتاحة: أيام الأحد–الخميس حتى اليوم، بلا الإجازات الرسمية
    const isHoliday = (d) => holidays.some((h) => d >= h.start_date && d <= (h.end_date || h.start_date));
    let available = 0;
    for (let d = range.from; d <= range.to && d <= today; d = addDays(d, 1)) {
      const dow = dowOf(d);
      if (dow >= 1 && dow <= 5 && !isHoliday(d)) available += PERIODS_PER_DAY[dow];
    }
    const used = rows.filter((r) => r.used !== false);
    const count = (key) => {
      const m = new Map();
      used.forEach((r) => { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
      return [...m].map(([label, n]) => ({ label, count: n })).sort((a, b) => b.count - a.count || cmpAr(a.label, b.label));
    };
    return {
      available, used: used.length,
      notUsed: rows.length - used.length,
      pending: rows.filter((r) => r.used == null && !r.walk_in).length,
      occupancy: available ? Math.round((used.length / available) * 100) : 0,
      byTeacher: count((r) => r.teacher_name),
      byClass: count((r) => (r.class_no ? classText(r) : null)),
      ticketsOpened: tickets.length,
      ticketsResolved: tickets.filter((t) => t.status === "resolved").length,
    };
  }, [rows, holidays, tickets, range.from, range.to, today]);

  const rangeText = `من ${shortDate(range.from)} إلى ${shortDate(range.to)}`;

  const printIt = () => {
    const overview = tilesHtml([
      { value: stats.used, label: "حصة استُخدم فيها المعمل" },
      { value: `${stats.occupancy}%`, label: `نسبة الإشغال (من ${stats.available} حصة)` },
      { value: stats.notUsed, label: "حصة محجوزة لم تُستخدم" },
      { value: `${stats.ticketsOpened} / ${stats.ticketsResolved}`, label: "بلاغات الأعطال / المحلول منها" },
    ])
      + (stats.byTeacher.length ? headingHtml("الاستخدام حسب المعلم") + barsHtml(stats.byTeacher) : "")
      + (stats.byClass.length ? headingHtml("الاستخدام حسب الفصل") + barsHtml(stats.byClass) : "");
    printReport({
      title: `تقرير استخدام ${labName}`,
      subtitle: rangeText,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      sections: [
        { title: "ملخص الاستخدام", subtitle: rangeText, html: overview },
        {
          title: "سجل الحصص", subtitle: `${rows.length} حصة`,
          headers: ["م", "التاريخ", "اليوم", "الحصة", "المعلم", "الفصل", "الدرس", "الحالة", "ملاحظة"],
          rows: rows.map((r, i) => [i + 1, shortDate(r.booking_date), DAY_NAMES[dowOf(r.booking_date)], r.period_no,
            r.teacher_name, classText(r) || "—", r.lesson || "—", statusOf(r).label, r.note || ""]),
        },
      ],
      signatures: [
        { title: "محضر معمل الحاسب الآلي", name: "" },
        { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      signOnLastPageOnly: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-3 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.key} type="button" onClick={() => setRange(p)}
                    className={`rounded-pill px-3.5 py-1.5 text-xs font-medium ${range.key === p.key ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="text-[11px] text-muted">من
            <input type="date" className="field mt-0.5 py-1.5 text-xs" value={range.from} max={range.to}
                   onChange={(e) => e.target.value && setRange((r) => ({ ...r, key: "custom", from: e.target.value }))} />
          </label>
          <label className="text-[11px] text-muted">إلى
            <input type="date" className="field mt-0.5 py-1.5 text-xs" value={range.to} min={range.from}
                   onChange={(e) => e.target.value && setRange((r) => ({ ...r, key: "custom", to: e.target.value }))} />
          </label>
        </div>
        <div className="ms-auto flex gap-2">
          {canBook && <button type="button" className="btn-ghost py-2" onClick={() => setAdding(true)}>تسجيل استخدام بلا حجز</button>}
          <button type="button" className="btn-primary py-2" disabled={!stats} onClick={printIt}>طباعة التقرير</button>
        </div>
      </div>

      {!stats ? <Loader /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile value={stats.used} label="حصة استُخدم فيها المعمل" />
            <Tile value={`${stats.occupancy}%`} label={`نسبة الإشغال من ${stats.available} حصة دراسية`} />
            <Tile value={stats.notUsed} label="حصة محجوزة لم تُستخدم" />
            <Tile value={stats.ticketsOpened} label={`بلاغ عطل · حُلّ ${stats.ticketsResolved}`} />
          </div>

          {stats.used > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <Bars title="الاستخدام حسب المعلم" items={stats.byTeacher} />
              <Bars title="الاستخدام حسب الفصل" items={stats.byClass} />
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line/60 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">سجل الحصص <span className="num text-muted">({rows.length})</span></p>
              {stats.pending > 0 && <span className="chip gap-1 bg-warning-light text-late">بانتظار التأكيد <bdi className="num">{stats.pending}</bdi></span>}
            </div>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">لا توجد حصص في المعمل في هذه الفترة.</p>
            ) : (
              <ul className="divide-y divide-line/60">
                {[...rows].reverse().map((r) => {
                  const st = statusOf(r);
                  const canMark = (r.mine || isManager) && !r.walk_in;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-sm">
                      <span className="w-24 shrink-0 text-xs text-muted">
                        {DAY_NAMES[dowOf(r.booking_date)]} <bdi className="num">{shortDate(r.booking_date)}</bdi>
                        <span className="block">الحصة <bdi className="num">{r.period_no}</bdi></span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-ink">{r.teacher_name} {r.class_no && <span className="font-normal text-muted">· {classText(r)}</span>}</span>
                        <span className="block truncate text-xs text-muted">{[r.lesson, r.note].filter(Boolean).join(" — ") || "—"}</span>
                      </span>
                      {/* لصاحب الحصة: زرّا التأكيد يبيّنان حالتها، ولغيره شارة الحالة */}
                      {!canMark && <span className={`chip shrink-0 ${st.chip}`}>{st.label}</span>}
                      {canMark && (
                        <span className="flex w-full shrink-0 justify-end gap-1 sm:w-auto">
                          <button type="button" className={`rounded-pill border px-2.5 py-1 text-[11px] ${r.used === true ? "border-mint-deep bg-mint-deep text-white" : "border-line text-muted"}`}
                                  onClick={() => setMarking({ row: r, used: true })}>تمت</button>
                          <button type="button" className={`rounded-pill border px-2.5 py-1 text-[11px] ${r.used === false ? "border-absent bg-absent text-white" : "border-line text-muted"}`}
                                  onClick={() => setMarking({ row: r, used: false })}>لم تُستخدم</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}

      {marking && (
        <MarkSheet {...marking} onClose={() => setMarking(null)}
                   onDone={(text) => { setMarking(null); setMsg({ ok: true, text }); load(); }}
                   onError={(text) => setMsg({ ok: false, text })} />
      )}
      {adding && (
        <AddSheet lab={lab} today={today} onClose={() => setAdding(false)}
                  onDone={(text) => { setAdding(false); setMsg({ ok: true, text }); load(); }}
                  onError={(text) => setMsg({ ok: false, text })} />
      )}
    </div>
  );
}

function statusOf(r) {
  if (r.walk_in) return { label: "بلا حجز", chip: "bg-mint-tint text-mint-deep" };
  if (r.used === true) return { label: "تمت", chip: "bg-present/10 text-present" };
  if (r.used === false) return { label: "لم تُستخدم", chip: "bg-danger-light text-absent" };
  return { label: "بانتظار التأكيد", chip: "bg-canvas text-muted" };
}

const Tile = ({ value, label }) => (
  <div className="card p-4 text-center">
    <p className="num text-2xl font-bold text-ink">{value}</p>
    <p className="mt-1 text-xs text-muted">{label}</p>
  </div>
);

// أشرطة أفقية بلون واحد (سلسلة واحدة)، والعدد بجانب كل شريط
function Bars({ title, items }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="card p-4">
      <p className="mb-3 text-sm font-semibold text-ink">{title}</p>
      {items.length === 0 ? <p className="text-xs text-muted">—</p> : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.label} title={`${it.label}: ${it.count} حصة`}>
              <div className="mb-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-ink">{it.label}</span>
                <span className="num font-semibold text-ink">{it.count}</span>
              </div>
              <div className="h-2 rounded-pill bg-canvas">
                <div className="h-2 rounded-pill bg-mint-deep" style={{ width: `${(it.count / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Sheet({ title, sub, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 print:hidden" dir="rtl"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-card bg-paper p-4 shadow-xl sm:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-ink">{title}</p>
            {sub && <p className="text-xs text-muted">{sub}</p>}
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MarkSheet({ row, used, onClose, onDone, onError }) {
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("lab_usage_mark", { p_id: row.id, p_used: used, p_note: note });
    setBusy(false);
    if (error) { onError("تعذّر الحفظ: " + error.message); return; }
    onDone(used ? "سُجّلت الحصة: تمت" : "سُجّلت الحصة: لم تُستخدم");
  };
  return (
    <Sheet title={used ? "تمت الحصة في المعمل" : "لم يُستخدم المعمل في هذه الحصة"}
           sub={`${DAY_NAMES[dowOf(row.booking_date)]} ${shortDate(row.booking_date)} · الحصة ${row.period_no}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="use-note">{used ? "ملاحظة (اختياري)" : "السبب (اختياري)"}</label>
          <textarea id="use-note" className="field min-h-[70px]" value={note} maxLength={300}
                    placeholder={used ? "مثال: تطبيق عملي على قواعد البيانات" : "مثال: انقطاع الكهرباء، أو نُقلت الحصة للفصل"}
                    onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </Sheet>
  );
}

function AddSheet({ lab, today, onClose, onDone, onError }) {
  const [date, setDate] = useState(today);
  const [period, setPeriod] = useState(1);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [lesson, setLesson] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.rpc("lab_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? []));
  }, [lab]);
  const dow = dowOf(date);
  const weekend = dow > 5;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("lab_usage_add", {
      p_lab: lab, p_date: date, p_period: Number(period), p_class: classId || null, p_lesson: lesson, p_note: note,
    });
    setBusy(false);
    if (error) { onError("تعذّر التسجيل: " + error.message); return; }
    onDone("سُجّل استخدام المعمل");
  };

  return (
    <Sheet title="تسجيل استخدام بلا حجز" sub="لحصة استُخدم فيها المعمل دون حجز مسبق (آخر 30 يومًا)" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="add-date">التاريخ</label>
            <input id="add-date" type="date" className="field" value={date} max={today} min={addDays(today, -30)}
                   onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="add-period">الحصة</label>
            <select id="add-period" className="field" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {Array.from({ length: weekend ? 7 : PERIODS_PER_DAY[dow] }, (_, i) => i + 1).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        {weekend && <p className="text-xs text-absent">اختر يومًا من الأحد إلى الخميس.</p>}
        <div>
          <label className="label" htmlFor="add-class">الفصل</label>
          <select id="add-class" className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— بدون فصل محدد —</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{classText(c)}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="add-lesson">عنوان الدرس (اختياري)</label>
          <input id="add-lesson" className="field" value={lesson} maxLength={120} onChange={(e) => setLesson(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="add-note">ملاحظة (اختياري)</label>
          <input id="add-note" className="field" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="button" className="btn-primary w-full" disabled={busy || weekend} onClick={save}>{busy ? "جارٍ التسجيل…" : "تسجيل"}</button>
      </div>
    </Sheet>
  );
}
