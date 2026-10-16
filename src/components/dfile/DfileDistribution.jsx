import { useEffect, useRef, useState } from "react";
import { readDistribution } from "../../lib/distribution.js";
import { weekWord } from "../../lib/dfile.js";
import { countAr } from "../../lib/arabicCount.js";

/* =====================================================================
   توزيع المنهج في لوحة المعلم: يرفع المعلم ملف التوزيع لكل مادة (Excel أو PDF)،
   فتقرؤه البوابة أسابيع يراجعها ويصحّحها. ويرى الزائر دروس الأسبوع الدراسي
   الحالي فقط (dfile_week في SQL)، ولا تذكير ولا خطة فصل.
   ===================================================================== */

export default function DfileDistribution({ s, d, onSave }) {
  const items = s.distribution?.items ?? [];
  const [subject, setSubject] = useState(d?.subjects?.[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [openIdx, setOpenIdx] = useState(items.length ? 0 : -1);
  const cur = d?.week?.n ?? null;
  const curRef = useRef(null);

  useEffect(() => { curRef.current?.scrollIntoView({ block: "nearest" }); }, [openIdx]);

  const store = (next) => onSave({ distribution: { items: next } });

  const upload = async (file) => {
    if (!file) return;
    if (!subject.trim()) { setMsg("اكتب اسم المادة أولًا."); return; }
    setBusy(true); setMsg("");
    const { weeks, error } = await readDistribution(file);
    const item = { subject: subject.trim(), file: file.name, weeks: weeks.length ? weeks : [{ n: cur ?? 1, t: "" }] };
    const next = [...items.filter((x) => x.subject !== item.subject), item];
    await store(next);
    setOpenIdx(next.length - 1);
    setMsg(error || `قرأت البوابة ${countAr(weeks.length, "week")}. راجع البطاقات وصحّح ما يلزم.`);
    setBusy(false);
  };

  const setWeek = (i, n, t) => {
    const next = items.map((it, k) => (k !== i ? it : { ...it, weeks: it.weeks.map((w) => (w.n === n ? { ...w, t } : w)) }));
    store(next);
  };
  const addWeek = (i) => {
    const it = items[i];
    const n = Math.max(0, ...it.weeks.map((w) => w.n)) + 1;
    store(items.map((x, k) => (k !== i ? x : { ...x, weeks: [...x.weeks, { n, t: "" }] })));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="field" list="dfile-subjects" placeholder="المادة، مثل رياضيات 2-1" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <datalist id="dfile-subjects">{(d?.subjects ?? []).map((x) => <option key={x} value={x} />)}</datalist>
        <label className={`btn-primary cursor-pointer ${busy ? "opacity-60" : ""}`}>
          <input type="file" hidden accept=".xlsx,.xls,.csv,.pdf" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          {busy ? "جارٍ القراءة…" : "رفع ملف التوزيع"}
        </label>
      </div>
      {msg && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">{msg}</p>}
      {cur && <p className="text-xs text-muted">الأسبوع الدراسي الحالي: {weekWord(cur)}، ودروسه هي ما يراه الزائر.</p>}

      {items.map((it, i) => (
        <div key={it.subject} className="rounded-sm2 border border-line/60">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <button type="button" className="flex-1 text-start text-sm font-bold text-ink" onClick={() => setOpenIdx(openIdx === i ? -1 : i)}>
              {it.subject} <span className="font-normal text-muted">({countAr(it.weeks.length, "week")}{it.file ? `، ${it.file}` : ""})</span>
            </button>
            <button type="button" className="text-xs text-danger" onClick={() => { store(items.filter((_, k) => k !== i)); setOpenIdx(-1); }}>حذف</button>
          </div>
          {openIdx === i && (
            <div className="max-h-96 space-y-2 overflow-y-auto border-t border-line/60 p-3">
              {it.weeks.map((w) => (
                <div key={w.n} ref={w.n === cur ? curRef : null}
                     className={`rounded-sm2 border p-2 ${w.n === cur ? "border-mint-deep bg-mint-tint" : "border-line/60"}`}>
                  <p className="mb-1 text-xs font-bold text-ink">الأسبوع {weekWord(w.n)}{w.n === cur ? " (الحالي)" : ""}</p>
                  <textarea className="field min-h-[56px] text-sm" defaultValue={w.t} placeholder="دروس الأسبوع، يفصل بينها «،»"
                            onBlur={(e) => { if (e.target.value !== w.t) setWeek(i, w.n, e.target.value.trim()); }} />
                </div>
              ))}
              <button type="button" className="btn-ghost w-full" onClick={() => addWeek(i)}>إضافة أسبوع</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
