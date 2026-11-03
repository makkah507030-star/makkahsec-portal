// src/pages/science/SciInventory.jsx
// عهدة مختبر العلوم: الأجهزة والأدوات والمواد الكيميائية بكمياتها وحالتها وصلاحيتها وموقعها. يُدخلها المحضر
// صنفًا صنفًا، أو يرفع ملف Excel لديه (أو قالب البوابة) فتُضاف أصنافه دفعة واحدة. ويُطبع كشف العهدة.
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { fmtDate } from "../../lib/dates";
import { todayISO } from "../../lib/schoolTime";
import Loader from "../../components/Loader.jsx";
import { INV_KIND, INV_STATUS, setupMsg, labOf } from "../../lib/sciLab.js";
import { cleanText, toLatinDigits } from "../../lib/importer";

const pill = (on) => `rounded-pill px-3 py-1.5 text-[12.5px] font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`;
const BLANK = { name: "", kind: "tool", qty: "1", unit: "", status: "ok", expiry: "", location: "", note: "" };
// عناوين الأعمدة المقبولة في ملف Excel (عربية أو إنجليزية)
const HEAD = {
  name: ["الاسم", "اسم الصنف", "الصنف", "اسم الأداة", "البيان", "name"], kind: ["النوع", "kind"],
  qty: ["الكمية", "العدد", "qty"], unit: ["الوحدة", "unit"], status: ["الحالة", "status"],
  expiry: ["الصلاحية", "تاريخ الانتهاء", "تاريخ الصلاحية", "expiry"], location: ["الموقع", "مكان الحفظ", "location"], note: ["ملاحظات", "ملاحظة", "note"],
};
const pick = (map, v, def) => Object.entries(map).find(([k, t]) => t === v || k === v)?.[0] ?? def;
const soon = (d) => d && d <= new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);

export default function SciInventory({ lab, isManager, onPrint }) {
  const [rows, setRows] = useState(null);
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(() => supabase.from("sci_inventory").select("*").eq("lab", lab).order("kind").order("name")
    .then(({ data, error }) => { if (error) setMsg({ ok: false, text: setupMsg(error) }); setRows(data ?? []); }), [lab, setMsg]);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => (rows ?? []).filter((x) => (kind === "all" || x.kind === kind || (kind === "alert" && (x.status !== "ok" || soon(x.expiry))))
    && (!q.trim() || x.name.includes(q.trim()))), [rows, kind, q]);
  const alerts = (rows ?? []).filter((x) => x.status !== "ok" || soon(x.expiry)).length;

  const save = async () => {
    setBusy(true);
    const row = { lab, name: form.name.trim(), kind: form.kind, qty: Number(toLatinDigits(form.qty)) || 0, unit: form.unit.trim() || null,
      status: form.status, expiry: form.expiry || null, location: form.location.trim() || null, note: form.note.trim() || null, updated_at: new Date().toISOString() };
    const { error } = form.id ? await supabase.from("sci_inventory").update(row).eq("id", form.id) : await supabase.from("sci_inventory").insert(row);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: setupMsg(error) }); return; }
    setForm(null); load();
  };
  const remove = async (x) => {
    if (!(await confirmDanger({ title: `حذف «${x.name}» من العهدة`, impact: ["يُحذف الصنف من كشف العهدة."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("sci_inventory").delete().eq("id", x.id);
    if (error) setMsg({ ok: false, text: error.message }); else load();
  };

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([["الاسم", "النوع", "الكمية", "الوحدة", "الحالة", "الصلاحية", "الموقع", "ملاحظات"],
      ["موقد بنزن", "جهاز", 4, "", "صالح", "", "الخزانة 1", ""], ["نترات الفضة", "مادة كيميائية", 1, "لتر", "صالح", "2027-05-01", "خزانة المواد", ""]]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "العهدة");
    XLSX.writeFile(wb, `قالب عهدة ${labOf(lab).name}.xlsx`);
  };
  const upload = async (file) => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false, cellDates: false });
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: "" });
      const hi = grid.findIndex((r) => r.some((c) => HEAD.name.includes(cleanText(c))));
      if (hi < 0) throw new Error("لم أجد عمود «الاسم» في الملف. نزّل قالب البوابة وانسخ الأصناف إليه.");
      const col = Object.fromEntries(Object.entries(HEAD).map(([k, names]) => [k, grid[hi].findIndex((c) => names.includes(cleanText(c)))]));
      const val = (r, k) => (col[k] >= 0 ? cleanText(r[col[k]]) : "");
      const items = grid.slice(hi + 1).filter((r) => val(r, "name")).map((r) => {
        const exp = toLatinDigits(val(r, "expiry")).replace(/\//g, "-");
        return { lab, name: val(r, "name").slice(0, 160), kind: pick(INV_KIND, val(r, "kind"), "tool"), qty: Number(toLatinDigits(val(r, "qty"))) || 1,
          unit: val(r, "unit") || null, status: pick(INV_STATUS, val(r, "status"), "ok"),
          expiry: /^\d{4}-\d{1,2}-\d{1,2}$/.test(exp) ? exp : null, location: val(r, "location") || null, note: val(r, "note") || null };
      });
      if (!items.length) throw new Error("لا أصناف في الملف تحت صف العناوين.");
      for (let i = 0; i < items.length; i += 200) {
        const { error } = await supabase.from("sci_inventory").insert(items.slice(i, i + 200));
        if (error) throw error;
      }
      setMsg({ ok: true, text: `أُضيف ${items.length} صنفًا إلى العهدة.` }); load();
    } catch (e) { setMsg({ ok: false, text: setupMsg(e) }); }
    setBusy(false);
  };

  if (!rows) return <Loader />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={pill(kind === "all")} onClick={() => setKind("all")}>الكل <span className="num">({rows.length})</span></button>
        {Object.entries(INV_KIND).map(([k, t]) => <button key={k} className={pill(kind === k)} onClick={() => setKind(k)}>{t}</button>)}
        {alerts > 0 && <button className={pill(kind === "alert")} onClick={() => setKind("alert")}>تنبيهات <span className="num">({alerts})</span></button>}
        <button className="btn-primary ms-auto px-4 py-1.5 text-sm" disabled={!rows.length} onClick={() => onPrint(rows)}>طباعة كشف العهدة</button>
      </div>
      {isManager && (
        <div className="card flex flex-wrap items-center gap-2 p-3">
          {!form && <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => setForm(BLANK)}>+ صنف</button>}
          <label className="btn-ghost cursor-pointer px-4 py-1.5 text-sm">رفع ملف Excel
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button className="text-xs font-semibold text-mint-deep" onClick={template}>تنزيل القالب</button>
          <span className="text-[11px] text-muted">ملف العهدة الذي لديك يُقبل إن كان فيه عمود «الاسم»، والبقية اختيارية.</span>
        </div>
      )}
      <input className="field max-w-xs" placeholder="ابحث باسم الصنف…" value={q} onChange={(e) => setQ(e.target.value)} />
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.text}</p>}
      {form && (
        <div className="card space-y-2 p-3 ring-2 ring-mint-deep/40">
          <div className="grid gap-2 sm:grid-cols-3">
            <input className="field sm:col-span-2" placeholder="اسم الصنف" maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{Object.entries(INV_KIND).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            <input className="field num" placeholder="الكمية" inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
            <input className="field" placeholder="الوحدة (لتر، علبة…)" maxLength={20} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <select className="field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(INV_STATUS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            <label className="text-xs text-muted">الصلاحية (للمواد)<input type="date" className="field num mt-1 w-full" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></label>
            <input className="field self-end" placeholder="الموقع" maxLength={60} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <input className="field self-end" placeholder="ملاحظات" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !form.name.trim()} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>إلغاء</button>
          </div>
        </div>
      )}
      {list.length === 0 ? <p className="card px-4 py-8 text-center text-sm text-muted">{rows.length ? "لا أصناف بهذا التصنيف." : "لا أصناف في العهدة بعد."}</p> : (
        <div className="card divide-y divide-line/60 overflow-hidden">
          {list.map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{x.name} <span className="text-xs font-normal text-muted">· {INV_KIND[x.kind]}</span></p>
                <p className="text-xs text-muted">
                  <span className="num">{Number(x.qty)}</span> {x.unit ?? ""}{x.location && <> · {x.location}</>}{x.note && <> · {x.note}</>}
                  {x.expiry && <> · الصلاحية <span className={`num ${soon(x.expiry) ? "font-semibold text-danger" : ""}`}>{fmtDate(x.expiry + "T12:00:00")}</span>{x.expiry < todayISO() && " (منتهية)"}</>}
                </p>
              </div>
              <span className={`chip ${x.status === "ok" ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{INV_STATUS[x.status]}</span>
              {isManager && (
                <span className="flex shrink-0 gap-2 text-xs">
                  <button className="font-semibold text-mint-deep" onClick={() => setForm({ ...BLANK, ...x, qty: String(Number(x.qty)), unit: x.unit ?? "", expiry: x.expiry ?? "", location: x.location ?? "", note: x.note ?? "" })}>تعديل</button>
                  <button className="text-danger" onClick={() => remove(x)}>حذف</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
