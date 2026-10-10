import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";
import { printReport, PRINCIPAL_NAME } from "../lib/exportUtils";
import {
  ACCEPT, AUTO_SOURCE, ITEM_HINT, PORTAL_TAG, SOURCE_LABEL, activeYear, loadAutoCounts, elementColor, elementSummary, itemStatus, loadEvidence,
  loadPerfReference, loadSupportVisits, loadTeacherInfo, openEvidenceFile,
  removeEvidenceFile, uploadEvidenceFile,
} from "../lib/performance";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";
import Loader from "./Loader.jsx";

/* =====================================================================
   ملف الأداء الوظيفي للمعلم — يفتحه المعلم لملفه، ومدير المدرسة لملف أي
   معلم (readOnly). ثلاث شاشات:
   • البطاقات: عنصر لكل بطاقة، وفيها مربعا «متوفر» و«غير متوفر».
   • العنصر: بنوده، وشاهد كل بند وعداده، والرفع والاستبدال.
   • المتابعة: كل البنود في جدول واحد مع التصفية والطباعة.
   ===================================================================== */

const REVIEW_NOTE = "للمقيِّم أن يطلب مشاهدة أكثر من الشاهد المرفوع.";

// شريط نسبة الإنجاز: يمتلئ من اليمين
function ProgressBar({ pct, color, className = "h-2" }) {
  return (
    <div className={`overflow-hidden rounded-pill bg-line/40 ${className}`}>
      <div className="h-full rounded-pill transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
const pctOf = (a, t) => (t ? Math.round((100 * a) / t) : 0);

function CountBoxes({ available, missing, color }) {
  const pct = pctOf(available, available + missing);
  return (
    <>
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-sm2 bg-mint-light px-1 py-1.5 text-center text-mint-deep">
        <span className="num block text-lg font-bold leading-tight">{available}</span>
        <span className="block text-xs">متوفر</span>
      </div>
      <div className="rounded-sm2 bg-warning-light px-1 py-1.5 text-center text-warning">
        <span className="num block text-lg font-bold leading-tight">{missing}</span>
        <span className="block text-xs">غير متوفر</span>
      </div>
    </div>
    <div className="mt-1 flex items-center gap-2">
      <ProgressBar pct={pct} color={color} className="h-2 flex-1" />
      <span className="num w-10 shrink-0 text-left text-xs font-semibold" style={{ color }}>{pct}%</span>
    </div>
    </>
  );
}

// نسبة الإنجاز الكلية: البنود المتوفرة من بنود كل العناصر (عدا عنصر المقيِّم)
function OverallProgress({ elements, evidence, auto }) {
  const sums = elements.filter((e) => !e.evaluator_only).map((e) => elementSummary(e, evidence, auto));
  const ok = sums.reduce((a, x) => a + x.available, 0);
  const total = sums.reduce((a, x) => a + x.available + x.missing, 0);
  const pct = pctOf(ok, total);
  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-bold text-ink">نسبة الإنجاز الكلية</h2>
        <p className="text-sm text-muted">
          متوفر <span className="num font-semibold text-mint-deep">{ok}</span> من <span className="num">{total}</span> بندًا
        </p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <ProgressBar pct={pct} color="#3E6350" className="h-3 flex-1" />
        <span className="num w-14 shrink-0 text-left text-xl font-bold text-mint-deep">{pct}%</span>
      </div>
    </section>
  );
}

function InfoBox({ info, name }) {
  return (
    <section className="card flex items-center gap-4 p-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-light text-lg font-bold text-mint-deep">
        {(info?.full_name ?? name ?? "؟").trim().charAt(0)}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-ink">{info?.full_name ?? name ?? "—"}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted">
          {[
            info?.specialization,
            info?.subjects?.length ? info.subjects.join("، ") : null,
            info?.classes?.length ? `${info.classes.length} فصول` : null,
          ].filter(Boolean).join(" · ") || "لا بيانات تدريس في العام النشط"}
          {info?.periods ? <> · النصاب <span className="num">{info.periods}</span> حصة</> : null}
        </p>
      </div>
    </section>
  );
}

/* نموذج إضافة شاهد أو استبداله أو إضافة مشاركة لسجل */
function EvidenceForm({ uid, year, item, existing, onDone, onCancel }) {
  const fileRef = useRef(null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [provider, setProvider] = useState("");
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [count, setCount] = useState(existing?.use_count ?? 1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    setErr("");
    const file = fileRef.current?.files?.[0];
    if (!title.trim()) { setErr("اكتب عنوان الشاهد."); return; }
    if (!file && !existing) { setErr("أرفق الشاهد: ملف PDF أو صورة."); return; }
    setBusy(true);
    try {
      let up = null;
      if (file) up = await uploadEvidenceFile(uid, file);
      if (existing) {
        // الاستبدال: يتغير الشاهد، ويبقى العداد كما هو (أو كما عدّله المعلم)
        const patch = { title: title.trim(), use_count: Math.max(1, Number(count) || 1) };
        if (up) Object.assign(patch, { file_path: up.path, file_name: up.name, source: "upload" });
        const { error } = await supabase.from("perf_evidence").update(patch).eq("id", existing.id);
        if (error) throw error;
        if (up && existing.file_path) await removeEvidenceFile(existing.file_path);
      } else {
        const row = {
          academic_year: year, item_key: item.key, source: "upload", title: title.trim(),
          file_path: up.path, file_name: up.name,
          use_count: item.is_record ? 1 : Math.max(1, Number(count) || 1),
        };
        if (item.is_record) Object.assign(row, {
          provider: provider.trim() || null, event_date: date || null, hours: hours ? Number(hours) : null,
        });
        const { error } = await supabase.from("perf_evidence").insert(row);
        if (error) {
          await removeEvidenceFile(up.path);
          throw error;
        }
      }
      onDone();
    } catch (e) {
      setErr(e.message?.includes("perf_evidence_single_uq") ? "لهذا البند شاهد من قبل." : (e.message ?? "تعذّر الحفظ."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-sm2 border border-mint-light bg-mint-tint p-3">
      <div>
        <label className="label">{item.is_record ? "عنوان المشاركة" : "عنوان الشاهد"}</label>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)}
               placeholder={item.is_record ? "اسم الدورة أو الورشة أو المؤتمر…" : "وصف مختصر للشاهد"} />
      </div>
      {item.is_record && !existing && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">الجهة</label>
            <input className="field" value={provider} onChange={(e) => setProvider(e.target.value)} />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" className="field num" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">عدد الساعات</label>
            <input type="number" min="0" step="0.5" className="field num" value={hours}
                   onChange={(e) => setHours(e.target.value)} />
          </div>
        </div>
      )}
      <div>
        <label className="label">{existing ? "ملف جديد بدل الحالي (اختياري)" : "الملف: PDF أو صورة، حتى 5 م.ب"}</label>
        <input ref={fileRef} type="file" accept={ACCEPT} className="block w-full text-sm" />
      </div>
      {/* عداد شاهد النماذج تحسبه البوابة، والمرفوع يدخله المعلم */}
      {!item.is_record && existing?.source !== "form" && (
        <div>
          <label className="label">عدد مرات الاستخدام</label>
          <input type="number" min="1" className="field num w-32" value={count}
                 onChange={(e) => setCount(e.target.value)} />
          <p className="mt-1 text-xs text-warning">{REVIEW_NOTE}</p>
        </div>
      )}
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button className="btn-ghost" onClick={onCancel} disabled={busy}>إلغاء</button>
      </div>
    </div>
  );
}

function EvidenceRow({ ev, item, readOnly, onEdit, onDelete }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-sm2 border border-line/60 bg-paper px-3 py-2">
      <span className={`chip w-20 justify-center ${ev.source !== "upload" ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
        {SOURCE_LABEL[ev.source]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{ev.title}</p>
        <p className="mt-0.5 text-xs text-muted">
          {[ev.provider, ev.event_date ? fmtDate(ev.event_date) : null,
            ev.hours ? `${ev.hours} ساعة` : null].filter(Boolean).join(" · ")}
          {!item.is_record && (
            <>العداد <span className="num font-semibold text-ink">{ev.use_count}</span>
              {ev.source === "upload" ? " · مُدخل من المعلم" : ` · آخرها ${fmtDate(ev.last_used_at)}`}</>
          )}
        </p>
      </div>
      {ev.file_path && (
        <button className="text-sm text-mint-deep underline" onClick={() => openEvidenceFile(ev.file_path)}>عرض الملف</button>
      )}
      {ev.form_document_id && (
        <Link className="text-sm text-mint-deep underline" to={`/doc/${ev.form_document_id}`}>عرض النموذج</Link>
      )}
      {ev.pd_report_id && (
        <Link className="text-sm text-mint-deep underline" to={`/pd/${ev.pd_report_id}`}>عرض النموذج</Link>
      )}
      {ev.xvisit_id && (
        <Link className="text-sm text-mint-deep underline" to={`/xvisits/${ev.xvisit_id}`}>عرض الاستمارة</Link>
      )}
      {ev.plc_session_id && (
        <Link className="text-sm text-mint-deep underline" to={`/plc/${ev.plc_session_id}`}>عرض التقرير</Link>
      )}
      {!readOnly && (
        <>
          {!item.is_record && <button className="text-sm text-ink underline" onClick={onEdit}>استبدال</button>}
          <button className="text-sm text-danger underline" onClick={onDelete}>حذف</button>
        </>
      )}
    </div>
  );
}

/* مؤشرات مساندة لأداء الواجبات الوظيفية — للمدير وحده، ولا تُصدر حكمًا */
function DutyIndicators({ uid, year }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    supabase.rpc("perf_duty_indicators", { p_uid: uid, p_year: year })
      .then(({ data, error }) => setRows(error ? [] : data ?? []));
  }, [uid, year]);
  if (!rows?.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-sm font-semibold text-ink">مؤشرات مساندة من البوابة</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-sm2 bg-canvas px-3 py-2 text-center">
            <p className="num text-lg font-bold text-ink">{r.value}</p>
            <p className="text-xs text-muted">{r.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">أرقام من سجلات البوابة في العام الدراسي، تعين على التقدير ولا تُصدره.</p>
    </div>
  );
}

/* الشواهد التي حُسب منها عدّاد البند الآلي: للمعلم في ملفه، وللمدير ليقيّمها.
   تُجمع حسب نوعها (العنوان) مع عدد مراته وآخرها، وتُفتح المجموعة لرؤية تفاصيلها. */
function AutoDetails({ uid, year, itemKey }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [openG, setOpenG] = useState(null);   // المجموعة المفتوحة تفاصيلها
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("perf_auto_details", { p_uid: uid, p_year: year, p_item: itemKey });
      if (error) setErr(error.message?.includes("perf_auto_details") ? "عرض التفاصيل غير مفعّل بعد في قاعدة البيانات." : "تعذّر تحميل التفاصيل.");
      setRows(data ?? []);
    })();
  }, [uid, year, itemKey]);
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows ?? []) {
      const t = r.r_title || "—";
      const g = m.get(t) ?? { title: t, list: [], last: null };
      g.list.push(r);
      if (r.r_at && (!g.last || new Date(r.r_at) > new Date(g.last))) g.last = r.r_at;
      m.set(t, g);
    }
    return [...m.values()].sort((a, b) => b.list.length - a.list.length);
  }, [rows]);
  if (rows === null) return <p className="px-1 py-2 text-xs text-muted">جارٍ التحميل…</p>;
  if (err) return <p className="px-1 py-2 text-xs text-danger">{err}</p>;
  if (!rows.length) return <p className="px-1 py-2 text-xs text-muted">لا تفاصيل.</p>;
  return (
    <div className="divide-y divide-mint-light/70 rounded-sm2 border border-mint-light bg-paper">
      {groups.map((g, i) => (
        <div key={g.title} className="px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="num w-5 shrink-0 text-xs text-muted">{i + 1}</span>
            <span className="min-w-0 flex-1 font-medium text-ink">{g.title}</span>
            <span className="chip bg-mint-light text-mint-deep">
              <span className="num ml-1 font-bold">{g.list.length}</span>{g.list.length === 1 ? "مرة" : "مرات"}
            </span>
            {g.last && <span className="num shrink-0 text-xs text-muted">آخرها {fmtDate(g.last)}</span>}
            <button className="text-xs text-mint-deep underline" onClick={() => setOpenG(openG === g.title ? null : g.title)}>
              {openG === g.title ? "إخفاء التفاصيل" : "التفاصيل"}
            </button>
          </div>
          {openG === g.title && (
            <ol className="mt-2 space-y-1 border-r-2 border-mint-light pr-3">
              {g.list.map((r, j) => (
                <li key={j} className="flex flex-wrap items-baseline gap-x-3 text-xs">
                  <span className="num w-5 shrink-0 text-muted">{j + 1}</span>
                  <span className="min-w-0 flex-1 leading-relaxed text-muted">{r.r_detail || "—"}</span>
                  {r.r_at && <span className="num shrink-0 text-muted">{fmtDate(r.r_at)}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}

function ElementView({ el, evidence, auto, uid, year, readOnly, onBack, onChanged }) {
  const [open, setOpen] = useState(null);   // { key, mode: "add" | "edit", ev }
  const sum = elementSummary(el, evidence, auto);
  const [shown, setShown] = useState(null);   // البند الآلي المفتوحة تفاصيله

  const del = async (ev) => {
    if (!window.confirm("حذف هذا الشاهد من الملف؟")) return;
    const { error } = await supabase.from("perf_evidence").delete().eq("id", ev.id);
    if (error) { alert(error.message); return; }
    await removeEvidenceFile(ev.file_path);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <button className="btn-ghost" onClick={onBack}>رجوع للبطاقات</button>
      <section className="card p-4" style={{ borderTop: `5px solid ${elementColor(el.key)}` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: elementColor(el.key) }}>{el.title}</h2>
            <p className="mt-0.5 flex gap-2 text-sm text-muted">
              <span>الوزن <span className="num">{el.weight}%</span></span>
              <span>·</span>
              <span>عدد البنود <span className="num">{el.items.length}</span></span>
            </p>
          </div>
          {!el.evaluator_only && <div className="w-48"><CountBoxes {...sum} /></div>}
        </div>
        {el.evaluator_only && (
          <p className="mt-3 rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">
            هذا العنصر يقيّمه مدير المدرسة مباشرة، ولا يحتاج شواهد في ملف المعلم.
          </p>
        )}
        {el.evaluator_only && readOnly && <DutyIndicators uid={uid} year={year} />}
      </section>

      <div className="space-y-3">
        {el.items.map((it, n) => {
          const st = itemStatus(it, evidence, auto);
          const isOpen = open?.key === it.key;
          return (
            <section key={it.key} className={`card p-4 ${!el.evaluator_only && !st.ok ? "border-warning/40" : ""}`}>
              <div className="flex flex-wrap items-start gap-3">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                      style={{ background: elementColor(el.key) }}>{n + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-relaxed text-ink">{it.title}</p>
                  {(PORTAL_TAG[it.portal] ?? (it.is_record ? PORTAL_TAG.record : null)) && (
                    <span className={`mt-1 inline-block rounded-pill px-2.5 py-0.5 text-xs ${(PORTAL_TAG[it.portal] ?? PORTAL_TAG.record).c}`}>
                      {(PORTAL_TAG[it.portal] ?? PORTAL_TAG.record).t}
                    </span>
                  )}
                  {!readOnly && !el.evaluator_only && ITEM_HINT[it.key] && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-mint-deep">كيف أجمعه؟ </span>{ITEM_HINT[it.key]}
                    </p>
                  )}
                </div>
                {!el.evaluator_only && (
                  <span className={`chip w-28 justify-center ${st.ok ? "bg-mint-light text-mint-deep" : "bg-warning-light text-warning"}`}>
                    {st.ok ? (it.is_record ? `متوفر · ${st.count}` : "متوفر") : "غير متوفر"}
                  </span>
                )}
              </div>

              {!el.evaluator_only && (
                <div className="mt-3 space-y-2">
                  {st.auto && (
                    <div className="flex flex-wrap items-center gap-2 rounded-sm2 border border-mint-light bg-mint-tint px-3 py-2">
                      <span className="chip w-20 justify-center bg-mint-deep text-white">آلي</span>
                      <p className="min-w-0 flex-1 text-sm text-ink">
                        {AUTO_SOURCE[it.key]?.label ?? "من عملك في البوابة"}
                        <span className="text-muted"> · العداد <span className="num font-semibold text-ink">{st.auto.cnt}</span>
                          {st.auto.last ? ` · آخرها ${fmtDate(st.auto.last)}` : ""}</span>
                      </p>
                      <button className="text-sm text-mint-deep underline" onClick={() => setShown(shown === it.key ? null : it.key)}>
                        {shown === it.key ? "إخفاء الشواهد" : "عرض الشواهد"}
                      </button>
                      {!readOnly && AUTO_SOURCE[it.key]?.to && (
                        <Link className="text-sm text-mint-deep underline" to={AUTO_SOURCE[it.key].to}>فتح الصفحة</Link>
                      )}
                    </div>
                  )}
                  {st.auto && shown === it.key && <AutoDetails uid={uid} year={year} itemKey={it.key} />}
                  {st.list.map((ev) => (
                    <EvidenceRow key={ev.id} ev={ev} item={it} readOnly={readOnly}
                                 onEdit={() => setOpen({ key: it.key, mode: "edit", ev })}
                                 onDelete={() => del(ev)} />
                  ))}
                  {!st.ok && (readOnly || !ITEM_HINT[it.key]) && (
                    <p className="text-xs leading-relaxed text-muted">
                      {readOnly ? "لم يُرفق شاهد لهذا البند بعد."
                        : "كيف أجمعه؟ ارفع صورة أو ملف PDF يثبت تنفيذ البند، أو أرسل نموذجًا صادرًا من صفحة «النماذج والشهادات»."}
                    </p>
                  )}
                  {!readOnly && !isOpen && (it.is_record || !st.ok) && (
                    <button className="btn-ghost" onClick={() => setOpen({ key: it.key, mode: "add" })}>
                      {it.is_record ? "إضافة مشاركة" : "رفع شاهد"}
                    </button>
                  )}
                  {isOpen && (
                    <EvidenceForm uid={uid} year={year} item={it}
                                  existing={open.mode === "edit" ? open.ev : null}
                                  onCancel={() => setOpen(null)}
                                  onDone={() => { setOpen(null); onChanged(); }} />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TrackView({ elements, evidence, auto, info, name, readOnly }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => elements.filter((e) => !e.evaluator_only).flatMap((el) =>
    el.items.map((it) => ({ el, it, st: itemStatus(it, evidence, auto) }))), [elements, evidence, auto]);
  const shown = rows.filter((r) => filter === "all" || (filter === "ok" ? r.st.ok : !r.st.ok));
  const ok = rows.filter((r) => r.st.ok).length;
  const [openEls, setOpenEls] = useState(() => new Set());
  const toggle = (k) => setOpenEls((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });
  // بنود كل عنصر بعد التصفية؛ العنصر الذي لا بنود له في التصفية لا يظهر
  const groups = elements.filter((e) => !e.evaluator_only).map((el) => {
    const list = shown.filter((r) => r.el.key === el.key);
    return { el, list, okN: list.filter((r) => r.st.ok).length };
  }).filter((g) => g.list.length);

  const evText = (r) => {
    if (!r.st.ok) return "—";
    if (r.it.is_record) return `المشاركات: ${r.st.count}`;
    if (r.st.list.length) return `العداد ${r.st.count} · ${r.st.list[0].title}`;
    return `آلي · العداد ${r.st.auto.cnt}`;
  };

  const print = () => {
    const teacher = info?.full_name ?? name ?? "";
    printReport({
      title: "متابعة شواهد الأداء الوظيفي",
      subtitle: `${teacher} · متوفر ${ok} · غير متوفر ${rows.length - ok}`,
      sections: elements.filter((e) => !e.evaluator_only).map((el) => {
        const list = shown.filter((r) => r.el.key === el.key);
        return list.length ? {
          title: `${el.title} (${el.weight}%)`,
          headers: ["م", "البند", "الحالة", "الشاهد والعدد"],
          rows: list.map((r, i) => [i + 1, r.it.title, r.st.ok ? "متوفر" : "غير متوفر", evText(r)]),
        } : null;
      }).filter(Boolean),
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [{ title: "المعلم", name: teacher }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
      signOnLastPageOnly: true,
    });
  };

  const tab = (k, label) => (
    <button key={k} onClick={() => setFilter(k)}
            className={`w-28 rounded-sm2 py-1.5 text-sm ${filter === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip w-28 justify-center bg-mint-light text-mint-deep">متوفر <span className="num mr-1">{ok}</span></span>
        <span className="chip w-28 justify-center bg-warning-light text-warning">غير متوفر <span className="num mr-1">{rows.length - ok}</span></span>
        <div className="flex-1" />
        {tab("all", "الكل")}{tab("ok", "المتوفر")}{tab("missing", "غير المتوفر")}
        <button className="btn-primary" onClick={print}>طباعة</button>
      </div>
      {/* القائمة مطوية: سطر لكل عنصر بعدّاديه، ويُفتح بالضغط لتظهر بنوده */}
      <div className="flex justify-end gap-3 text-sm">
        <button className="text-mint-deep underline" onClick={() => setOpenEls(new Set(groups.map((g) => g.el.key)))}>فتح الكل</button>
        <button className="text-mint-deep underline" onClick={() => setOpenEls(new Set())}>طي الكل</button>
      </div>
      <div className="space-y-2">
        {groups.map(({ el, list, okN }) => {
          const c = elementColor(el.key);
          const isOpen = openEls.has(el.key);
          return (
            <section key={el.key} className="card overflow-hidden" style={{ borderRight: `5px solid ${c}` }}>
              <button type="button" onClick={() => toggle(el.key)} aria-expanded={isOpen}
                      className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-canvas">
                <span className="min-w-0 flex-1 font-bold" style={{ color: c }}>{el.title}</span>
                <span className="chip w-24 justify-center bg-mint-light text-mint-deep">متوفر <span className="num mr-1">{okN}</span></span>
                <span className="chip w-28 justify-center bg-warning-light text-warning">غير متوفر <span className="num mr-1">{list.length - okN}</span></span>
                <span className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true">▾</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-line/60 border-t border-line/60">
                  {list.map((r) => (
                    <div key={r.it.key} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm ${r.st.ok ? "" : "bg-warning-light/40"}`}>
                      <span className="min-w-0 flex-1 text-ink">{r.it.title}</span>
                      <span className="text-muted">{evText(r)}</span>
                      <span className={`w-24 text-center font-semibold ${r.st.ok ? "text-mint-deep" : "text-warning"}`}>
                        {r.st.ok ? "متوفر" : "غير متوفر"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className="card px-4 py-3 text-sm text-faint">لا بنود في هذه التصفية.</p>}
      </div>
      {readOnly && <p className="text-xs text-muted">{REVIEW_NOTE.replace("للمقيِّم أن يطلب", "يمكنك طلب")}</p>}
    </div>
  );
}

export default function PerformanceFile({ uid, name, readOnly = false }) {
  const [elements, setElements] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [auto, setAuto] = useState({});      // الشواهد الآلية: { [بند]: { cnt, last } }
  const [visits, setVisits] = useState([]);
  const [info, setInfo] = useState(null);
  const [year, setYear] = useState("");
  const [view, setView] = useState("cards");
  const [current, setCurrent] = useState(null);
  const [err, setErr] = useState("");

  const reload = useCallback(async () => {
    try {
      const y = await activeYear();
      const [els, ev, vs, inf, au] = await Promise.all([
        loadPerfReference(), loadEvidence(uid, y), loadSupportVisits(uid), loadTeacherInfo(uid), loadAutoCounts(uid, y),
      ]);
      setYear(y); setElements(els); setEvidence(ev); setVisits(vs); setInfo(inf); setAuto(au[uid] ?? {});
    } catch (e) {
      setErr(e.message?.includes("perf_") ? "ملف الأداء غير مفعّل بعد في قاعدة البيانات." : (e.message ?? "تعذّر التحميل."));
      setElements([]);
    }
  }, [uid]);

  useEffect(() => { setElements(null); setView("cards"); setCurrent(null); reload(); }, [reload]);

  if (elements === null) return <Loader />;
  if (err) return <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>;

  if (current) {
    const el = elements.find((e) => e.key === current);
    return (
      <ElementView el={el} evidence={evidence} auto={auto} uid={uid} year={year} readOnly={readOnly}
                   onBack={() => setCurrent(null)} onChanged={reload} />
    );
  }

  return (
    <div className="space-y-4">
      <InfoBox info={info} name={name} />

      <div className="flex gap-2">
        {[["cards", "بطاقات العناصر"], ["track", "متابعة الشواهد"]].map(([k, l]) => (
          <button key={k} onClick={() => setView(k)}
                  className={`w-36 rounded-sm2 py-2 text-sm font-semibold ${view === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>
            {l}
          </button>
        ))}
      </div>

      {view === "track" ? (
        <TrackView elements={elements} evidence={evidence} auto={auto} info={info} name={name} readOnly={readOnly} />
      ) : (
        <>
          <OverallProgress elements={elements} evidence={evidence} auto={auto} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {elements.map((el) => (
              // عنصر المقيِّم يُفتح للمدير فقط (يرى بنوده)، وللمعلم بطاقة مقفلة
              <button key={el.key} type="button"
                      disabled={el.evaluator_only && !readOnly}
                      onClick={() => setCurrent(el.key)}
                      style={{ borderTop: `5px solid ${elementColor(el.key)}`,
                               background: el.evaluator_only ? undefined : `linear-gradient(180deg, ${elementColor(el.key)}14 0%, #ffffff 55%)` }}
                      className={`card flex flex-col gap-2 p-4 text-right transition-shadow ${
                        el.evaluator_only ? "border-dashed bg-canvas" : "hover:shadow-md"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold leading-snug" style={{ color: elementColor(el.key) }}>{el.title}</p>
                  <span className="num shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: elementColor(el.key) }}>{el.weight}%</span>
                </div>
                {el.evaluator_only ? (
                  <p className="text-sm leading-relaxed text-muted">يقيّمه مدير المدرسة مباشرة، ولا يحتاج شواهد.</p>
                ) : (
                  <CountBoxes {...elementSummary(el, evidence, auto)} color={elementColor(el.key)} />
                )}
              </button>
            ))}
          </div>

          <section className="card p-4">
            <h2 className="font-bold text-ink">زيارات الدعم</h2>
            <p className="mt-0.5 text-sm text-muted">تصل تلقائيًا من الوكلاء ومدير المدرسة.</p>
            {visits.length === 0 ? (
              <p className="mt-3 text-sm text-faint">لا زيارات بعد.</p>
            ) : (
              <div className="mt-3 divide-y divide-line/60">
                {visits.map((v) => (
                  <Link key={v.id} to={`/doc/${v.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-canvas">
                    <span className="text-sm text-ink">{v.title}{v.signature_name ? ` · ${v.signature_name}` : ""}</span>
                    <span className="num text-xs text-muted">{fmtDate(v.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
