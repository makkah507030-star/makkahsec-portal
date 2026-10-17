import { useEffect, useRef, useState } from "react";
import { readDistribution } from "../../lib/distribution.js";
import { DAYS, courseLabel, weekWord } from "../../lib/dfile.js";
import { countAr } from "../../lib/arabicCount.js";

/* =====================================================================
   توزيع المنهج في لوحة المعلم: سطر لكل مادة وصفّ من جدوله الدراسي (مع فصولها)،
   وبجانبه رفع ملف التوزيع (Excel أو PDF)، فتقرؤه البوابة أسابيع يراجعها ويصحّحها.
   ويُضاف يدويًا ما ليس في الجدول. ويرى الزائر دروس الأسبوع الدراسي الحالي فقط.
   «كتابة يدوية»: دروس الأسبوع الحالي يومًا بيوم (الأحد إلى الخميس) لمن تعذّر عليه
   الاستيراد، وتُحفظ أسبوعًا في التوزيع نفسه (days، وt مجموعها) فيعمل مع الملف أو دونه.
   ===================================================================== */

/* نص الأسبوع من أيامه، ليبقى t صالحًا لمن يقرأ النص وحده */
const daysText = (days) => days.map((x, i) => (x.trim() ? `${DAYS[i]}: ${x.trim()}` : "")).filter(Boolean).join("، ");

export default function DfileDistribution({ s, d, onSave }) {
  const items = s.distribution?.items ?? [];
  const courses = (d?.courses ?? []).map((c) => ({ label: courseLabel(c), classes: c.classes ?? [] }));
  // المواد من الجدول أولًا، ثم ما أضافه المعلم ولم يعد في جدوله
  const rows = [...courses, ...items.filter((it) => !courses.some((c) => c.label === it.subject)).map((it) => ({ label: it.subject, classes: it.classes ?? [] }))];
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({});
  const [open, setOpen] = useState("");
  const [extra, setExtra] = useState("");
  const [manual, setManual] = useState("");
  const cur = d?.week?.n ?? null;
  const curRef = useRef(null);

  useEffect(() => { curRef.current?.scrollIntoView({ block: "nearest" }); }, [open]);

  const store = (next) => onSave({ distribution: { items: next } });
  const itemOf = (label) => items.find((x) => x.subject === label);

  const upload = async (row, file) => {
    if (!file) return;
    setBusy(row.label);
    const { weeks, error } = await readDistribution(file);
    const item = { subject: row.label, classes: row.classes, file: file.name, weeks: weeks.length ? weeks : [{ n: cur ?? 1, t: "" }] };
    await store([...items.filter((x) => x.subject !== row.label), item]);
    setOpen(row.label);
    setMsg({ ...msg, [row.label]: error || `قرأت البوابة ${countAr(weeks.length, "week")}. راجع البطاقات وصحّح ما يلزم.` });
    setBusy("");
  };

  const setWeeks = (label, weeks) => store(items.map((it) => (it.subject !== label ? it : { ...it, weeks })));

  // يوم من الأسبوع الحالي: يُنشأ سطر المادة وأسبوعها إن لم يوجدا
  const setDay = (row, i, text) => {
    const it = itemOf(row.label) ?? { subject: row.label, classes: row.classes, file: null, weeks: [] };
    const w = it.weeks.find((x) => x.n === cur) ?? { n: cur, t: "" };
    const days = [...(w.days ?? DAYS.map(() => ""))];
    if ((days[i] ?? "") === text) return;
    days[i] = text;
    const week = { ...w, days, t: daysText(days) };
    const weeks = [...it.weeks.filter((x) => x.n !== cur), week].sort((a, b) => a.n - b.n);
    store([...items.filter((x) => x.subject !== row.label), { ...it, weeks }]);
  };

  return (
    <div className="space-y-3">
      {cur && <p className="text-xs text-muted">الأسبوع الدراسي الحالي: {weekWord(cur)}، ودروسه هي ما يراه الزائر.</p>}
      {rows.length === 0 && <p className="text-sm text-muted">لا مواد لك في الجدول الدراسي لهذا الفصل. أضف مادتك بالأسفل.</p>}

      {rows.map((row) => {
        const it = itemOf(row.label);
        return (
          <div key={row.label} className="rounded-sm2 border border-line/60">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button type="button" className="min-w-0 basis-full text-start sm:basis-0 sm:flex-1" onClick={() => it && setOpen(open === row.label ? "" : row.label)}>
                <p className="text-sm font-bold text-ink">{row.label}</p>
                <p className="text-xs text-muted">
                  {row.classes.length > 0 && `الفصول ${row.classes.join(" و")}`}
                  {it ? `${row.classes.length ? "، " : ""}${countAr(it.weeks.length, "week")}${it.file ? `، ${it.file}` : ""}` : `${row.classes.length ? "، " : ""}لم يُرفع توزيع`}
                </p>
              </button>
              <label className={`${it ? "btn-ghost" : "btn-primary"} cursor-pointer ${busy ? "opacity-60" : ""}`}>
                <input type="file" hidden accept=".xlsx,.xls,.csv,.pdf" disabled={!!busy} onChange={(e) => { upload(row, e.target.files?.[0]); e.target.value = ""; }} />
                {busy === row.label ? "جارٍ القراءة…" : it ? "استبدال الملف" : "رفع ملف التوزيع"}
              </label>
              {cur && (
                <button type="button" className={manual === row.label ? "btn-primary" : "btn-ghost"}
                        onClick={() => setManual(manual === row.label ? "" : row.label)}>كتابة يدوية</button>
              )}
              {it && <button type="button" className="text-xs text-danger" onClick={() => { store(items.filter((x) => x.subject !== row.label)); setOpen(""); setManual(""); }}>حذف</button>}
            </div>
            {manual === row.label && cur && (
              <div className="space-y-2 border-t border-line/60 p-3">
                <p className="text-xs text-muted">دروس الأسبوع {weekWord(cur)} يومًا بيوم، ويراها الزائر هذا الأسبوع. ما تتركه فارغًا لا يظهر.</p>
                {DAYS.map((day, i) => (
                  <div key={`${row.label}-${cur}-${i}`} className="flex items-start gap-2">
                    <span className="w-16 shrink-0 pt-2 text-sm font-bold text-ink">{day}</span>
                    <input className="field text-sm" placeholder="الدرس أو الدروس"
                           defaultValue={it?.weeks.find((w) => w.n === cur)?.days?.[i] ?? ""}
                           onBlur={(e) => setDay(row, i, e.target.value.trim())} maxLength={160} />
                  </div>
                ))}
              </div>
            )}
            {msg[row.label] && <p className="mx-3 mb-2 rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">{msg[row.label]}</p>}
            {it && open === row.label && (
              <div className="max-h-96 space-y-2 overflow-y-auto border-t border-line/60 p-3">
                {it.weeks.map((w) => (
                  <div key={w.n} ref={w.n === cur ? curRef : null}
                       className={`rounded-sm2 border p-2 ${w.n === cur ? "border-mint-deep bg-mint-tint" : "border-line/60"}`}>
                    <p className="mb-1 text-xs font-bold text-ink">الأسبوع {weekWord(w.n)}{w.n === cur ? " (الحالي)" : ""}</p>
                    <textarea className="field min-h-[56px] text-sm" defaultValue={w.t} placeholder="دروس الأسبوع، يفصل بينها «،»"
                              onBlur={(e) => { const t = e.target.value.trim(); if (t !== w.t) setWeeks(row.label, it.weeks.map((x) => (x.n === w.n ? { ...x, t } : x))); }} />
                  </div>
                ))}
                <button type="button" className="btn-ghost w-full"
                        onClick={() => setWeeks(row.label, [...it.weeks, { n: Math.max(0, ...it.weeks.map((x) => x.n)) + 1, t: "" }])}>إضافة أسبوع</button>
              </div>
            )}
          </div>
        );
      })}

      <form className="flex gap-2" onSubmit={(e) => {
        e.preventDefault();
        const t = extra.trim();
        if (!t || rows.some((r) => r.label === t)) return;
        store([...items, { subject: t, classes: [], file: null, weeks: [{ n: cur ?? 1, t: "" }] }]);
        setExtra(""); setOpen(t);
      }}>
        <input className="field" placeholder="مادة ليست في جدولك…" value={extra} onChange={(e) => setExtra(e.target.value)} />
        <button className="btn-ghost" type="submit">إضافة</button>
      </form>
    </div>
  );
}
