// src/pages/lab/LabRules.jsx
// قواعد السلامة والتعليمات: يحررها محضر المعمل، وتُطبع لوحةً تُعلَّق في المعمل،
// ويقرّ بها الطالب من صفحته مرة كل فصل دراسي، ويتابع المعلم من أقرّ من فصله.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";
import { byName } from "../../lib/sortAr.js";
import { printReport } from "../../lib/exportUtils";
import LabPrintDialog from "./LabPrintDialog.jsx";
import { RulesSheet } from "./LabSheets.jsx";
import { classText } from "../../lib/lab.js";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

export default function LabRules({ lab, isManager }) {
  const [rules, setRules] = useState(null);
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [editing, setEditing] = useState(null);   // مسودة القواعد أثناء التعديل
  const [reack, setReack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [size, setSize] = useState("A3");
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("lab_rules").select("items, version, updated_at").eq("id", 1).maybeSingle();
    setRules(data ?? { items: [], version: 1 });
  }, []);

  useEffect(() => {
    load();
    supabase.from("labs").select("name").eq("id", lab).maybeSingle().then(({ data }) => data?.name && setLabName(data.name));
  }, [lab, load]);

  const save = async () => {
    const items = editing.map((t) => t.trim()).filter(Boolean);
    if (!items.length) { setMsg({ ok: false, text: "أضف قاعدة واحدة على الأقل." }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("lab_rules_save", { p_items: items, p_reack: reack });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: "تعذّر الحفظ: " + error.message }); return; }
    setEditing(null); setReack(false);
    setMsg({ ok: true, text: reack ? "حُفظت القواعد، وسيُطلب من الطلاب الإقرار بها من جديد." : "حُفظت القواعد." });
    load();
  };

  const move = (i, d) => setEditing((list) => {
    const a = [...list]; const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]]; return a;
  });

  if (rules === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-ink">قواعد السلامة والتعليمات</h2>
            <p className="text-[11px] text-muted">يقرّ بها الطالب من صفحته مرة كل فصل دراسي{rules.updated_at ? ` · آخر تحديث ${fmtDateTime(rules.updated_at)}` : ""}</p>
          </div>
          {!editing && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-ghost py-2" onClick={() => setPrinting(true)}>طباعة اللوحة</button>
              {isManager && <button type="button" className="btn-primary py-2" onClick={() => setEditing([...rules.items])}>تعديل القواعد</button>}
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            {editing.map((t, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="num mt-2 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">{i + 1}</span>
                <textarea className="field min-h-[44px] flex-1 py-2" rows={1} value={t} maxLength={160}
                          onChange={(e) => setEditing((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
                <div className="flex shrink-0 flex-col">
                  <button type="button" className="px-1.5 text-xs text-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="إلى الأعلى">▲</button>
                  <button type="button" className="px-1.5 text-xs text-muted disabled:opacity-30" disabled={i === editing.length - 1} onClick={() => move(i, 1)} aria-label="إلى الأسفل">▼</button>
                </div>
                <button type="button" className="mt-2 px-1 text-xs text-absent" onClick={() => setEditing((l) => l.filter((_, k) => k !== i))} aria-label="حذف القاعدة">✕</button>
              </div>
            ))}
            <button type="button" className="text-sm font-semibold text-mint-deep" onClick={() => setEditing((l) => [...l, ""])}>+ إضافة قاعدة</button>
            <label className="flex items-center gap-2 rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink">
              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-mint-deep))]" checked={reack} onChange={(e) => setReack(e.target.checked)} />
              اطلب من الطلاب الإقرار من جديد (لتعديل جوهري)
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ القواعد"}</button>
              <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setReack(false); }}>إلغاء</button>
            </div>
          </div>
        ) : (
          <ol className="grid gap-2 sm:grid-cols-2">
            {rules.items.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-sm2 border border-line/70 bg-canvas/50 p-3">
                <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-deep text-xs font-bold text-white">{i + 1}</span>
                <p className="text-sm leading-relaxed text-ink">{t}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <AcksByClass lab={lab} version={rules.version} />
      {printing && (
        <LabPrintDialog title="لوحة قواعد السلامة" fileName={`قواعد-السلامة-${labName}`} paper={size}
                        onClose={() => setPrinting(false)}
                        render={(th) => <RulesSheet theme={th} items={rules.items} labName={labName} />}>
          <div>
            <p className="label">مقاس الورق</p>
            <div className="flex gap-1.5">
              {["A3", "A4"].map((z) => (
                <button key={z} type="button" onClick={() => setSize(z)}
                        className={`rounded-pill px-3.5 py-1.5 text-xs font-medium ${size === z ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`}>
                  {z === "A3" ? "لوحة A3" : "ورقة A4"}
                </button>
              ))}
            </div>
          </div>
        </LabPrintDialog>
      )}
      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}
    </div>
  );
}

// متابعة إقرار طلاب فصل في الفصل الدراسي الحالي
function AcksByClass({ lab, version }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    supabase.rpc("lab_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? []));
  }, [lab]);

  useEffect(() => {
    if (!classId) { setRows(null); return; }
    let alive = true;
    setRows(undefined);
    supabase.rpc("lab_rules_class", { p_class: classId }).then(({ data }) => alive && setRows((data ?? []).sort(byName())));
    return () => { alive = false; };
  }, [classId, version]);

  const cls = classes.find((c) => c.class_id === classId);
  const done = (rows ?? []).filter((r) => r.acked_at).length;

  const printList = () => printReport({
    title: `إقرار قواعد السلامة — ${classText(cls)}`,
    subtitle: `معمل الحاسب الآلي · أقرّ ${done} من ${rows.length}`,
    headers: ["م", "الطالب", "الإقرار"],
    rows: rows.map((r, i) => [i + 1, r.full_name, r.acked_at ? fmtDateTime(r.acked_at) : "لم يقرّ"]),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    hideSignatures: true,
  });

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="ack-class">إقرار الطلاب بالقواعد (الفصل الدراسي الحالي)</label>
          <select id="ack-class" className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— اختر الفصل —</option>
            {classes.map((c) => <option key={c.class_id} value={c.class_id}>{classText(c)}</option>)}
          </select>
        </div>
        {rows?.length > 0 && <button type="button" className="btn-ghost py-2" onClick={printList}>طباعة الكشف</button>}
      </div>
      {rows === undefined ? <Loader /> : rows && (
        rows.length === 0 ? <p className="mt-3 text-sm text-muted">لا يوجد طلاب في هذا الفصل.</p> : (
          <>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-pill bg-canvas">
                <div className="h-full rounded-pill bg-mint-deep" style={{ width: `${(done / rows.length) * 100}%` }} />
              </div>
              <span className="num text-xs font-semibold text-ink">{done}/{rows.length}</span>
            </div>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {rows.map((r) => (
                <li key={r.student_id} className="flex items-center justify-between gap-2 rounded-sm2 bg-canvas/60 px-3 py-1.5 text-sm">
                  <span className="truncate text-ink">{r.full_name}</span>
                  {r.acked_at
                    ? <span className="chip shrink-0 bg-present/10 text-present">✓ أقرّ</span>
                    : <span className="chip shrink-0 bg-danger-light text-absent">لم يقرّ</span>}
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </div>
  );
}
