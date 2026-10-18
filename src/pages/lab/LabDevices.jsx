// src/pages/lab/LabDevices.jsx
// سجل الأجهزة: رسم المعمل (شكل U) بحالة كل جهاز، ومواصفاته. التعديل لمسؤولي
// المعمل فقط (سياسة lab_devices manage)، والبقية يطّلعون على الحالة.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";
import { printReport, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { DEVICE_STATUS, SPEC_FIELDS, uLayout } from "../../lib/lab.js";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const COLS = "id, seat_no, code, status, cpu, ram, storage, os, software, serial_no, notes, updated_at";

export default function LabDevices({ lab, isManager }) {
  const [devices, setDevices] = useState(null);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("lab_devices").select(COLS).eq("lab_id", lab).order("seat_no");
    if (error) setMsg({ ok: false, text: "تعذّر تحميل الأجهزة: " + error.message });
    setDevices(data ?? []);
  }, [lab, setMsg]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { ok: 0, broken: 0, maintenance: 0 };
    (devices ?? []).forEach((d) => { c[d.status] = (c[d.status] ?? 0) + 1; });
    return c;
  }, [devices]);

  const printList = () => {
    printReport({
      title: "سجل أجهزة معمل الحاسب الآلي",
      subtitle: `${devices.length} جهازًا · يعمل ${counts.ok} · معطّل ${counts.broken} · في الصيانة ${counts.maintenance}`,
      headers: ["الجهاز", "الحالة", ...SPEC_FIELDS.map((f) => f.label), "ملاحظات"],
      rows: devices.map((d) => [d.code, DEVICE_STATUS[d.status]?.label ?? d.status,
        ...SPEC_FIELDS.map((f) => d[f.key] || "—"), d.notes || ""]),
      landscape: true,
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      signatures: [{ title: "محضر معمل الحاسب الآلي", name: "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    });
  };

  if (devices === null) return <Loader />;
  if (!devices.length) {
    return <div className="card px-6 py-12 text-center text-sm text-muted">لا توجد أجهزة مسجّلة لهذا المعمل.</div>;
  }

  const { cols, rows, pos } = uLayout(devices.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap gap-2">
          {Object.entries(DEVICE_STATUS).map(([k, s]) => (
            <span key={k} className={`chip gap-1.5 ${s.chip}`}>
              <span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label} <span className="num">{counts[k]}</span>
            </span>
          ))}
        </div>
        <button type="button" className="btn-ghost py-2" onClick={printList}>طباعة السجل</button>
      </div>

      {/* رسم المعمل */}
      <div className="card p-3 sm:p-5">
        <div className="mx-auto max-w-xl">
          <div className="mb-3 flex items-center gap-2 text-[10px] text-faint">
            <span className="w-12 text-center">يسار المعلم</span>
            <div className="flex-1 rounded-sm2 bg-canvas py-1.5 text-center text-[11px] font-semibold text-muted">
              السبورة ومكتب المعلم
            </div>
            <span className="w-12 text-center">يمين المعلم</span>
          </div>
          <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
            {devices.map((d) => {
              const p = pos(d.seat_no);
              const s = DEVICE_STATUS[d.status] ?? DEVICE_STATUS.ok;
              return (
                <button key={d.id} type="button" onClick={() => setOpen(d)} title={`${d.code} — ${s.label}`}
                        style={{ gridColumn: p.col, gridRow: p.row }}
                        className={`relative flex aspect-square flex-col items-center justify-center rounded-sm2 border text-[10px] font-bold transition-transform hover:scale-105 sm:text-xs ${
                          d.status === "ok" ? "border-line bg-paper text-ink" : `border-transparent ${s.chip}`}`}>
                  <span className="num">{d.seat_no}</span>
                  <span className={`absolute start-1 top-1 h-1.5 w-1.5 rounded-full ${s.dot}`} />
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted">اضغط على الجهاز {isManager ? "لعرض مواصفاته وتعديل حالته" : "لعرض مواصفاته"}.</p>
        </div>
      </div>

      {open && (
        <DeviceSheet device={open} lab={lab} isManager={isManager} onClose={() => setOpen(null)}
                     onSaved={(text) => { setOpen(null); setMsg({ ok: true, text }); load(); }}
                     onError={(text) => setMsg({ ok: false, text })} />
      )}
      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}
    </div>
  );
}

function DeviceSheet({ device, lab, isManager, onClose, onSaved, onError }) {
  const { session } = useSession();
  const [f, setF] = useState(() => ({ ...device }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fields = (src) => ({
    status: src.status,
    ...Object.fromEntries(SPEC_FIELDS.map((s) => [s.key, (src[s.key] ?? "").trim() || null])),
    notes: (src.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: session?.user?.id ?? null,
  });

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("lab_devices").update(fields(f)).eq("id", device.id);
    setBusy(false);
    if (error) { onError("تعذّر الحفظ: " + error.message); return; }
    onSaved(`حُفظ ${device.code}`);
  };

  // أجهزة المعمل عادة متطابقة: تُنسخ مواصفات هذا الجهاز إلى البقية (عدا الرقم التسلسلي)
  const applyAll = async () => {
    const ok = await confirmDanger({
      title: "نسخ مواصفات هذا الجهاز إلى كل أجهزة المعمل؟",
      impact: ["المعالج والذاكرة والتخزين والنظام والبرامج", "لا تتغير حالة الأجهزة ولا أرقامها التسلسلية"],
      level: "medium",
      confirmLabel: "نسخ المواصفات",
    });
    if (!ok) return;
    setBusy(true);
    const specs = Object.fromEntries(SPEC_FIELDS.filter((s) => s.key !== "serial_no")
      .map((s) => [s.key, (f[s.key] ?? "").trim() || null]));
    const { error } = await supabase.from("lab_devices").update(specs).eq("lab_id", lab);
    setBusy(false);
    if (error) { onError("تعذّر النسخ: " + error.message); return; }
    onSaved("نُسخت المواصفات إلى كل الأجهزة");
  };

  const s = DEVICE_STATUS[device.status] ?? DEVICE_STATUS.ok;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 print:hidden" dir="rtl"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-card bg-paper p-4 shadow-xl sm:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="num text-base font-bold text-ink">{device.code}</p>
            <span className={`chip ${s.chip}`}>{s.label}</span>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>إغلاق</button>
        </div>

        {isManager ? (
          <div className="space-y-3">
            <div>
              <p className="label">الحالة</p>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(DEVICE_STATUS).map(([k, st]) => (
                  <button key={k} type="button" onClick={() => setF((x) => ({ ...x, status: k }))}
                          className={`rounded-sm2 border px-2 py-2 text-xs font-semibold ${
                            f.status === k ? `border-transparent ${st.chip} ring-2 ring-mint-deep/40` : "border-line text-muted"}`}>
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
            {SPEC_FIELDS.map((sf) => (
              <div key={sf.key}>
                <label className="label" htmlFor={`dev-${sf.key}`}>{sf.label}</label>
                <input id={`dev-${sf.key}`} dir="auto" className="field" value={f[sf.key] ?? ""} placeholder={sf.ph} onChange={set(sf.key)} />
              </div>
            ))}
            <div>
              <label className="label" htmlFor="dev-notes">ملاحظات</label>
              <textarea id="dev-notes" className="field min-h-[70px]" value={f.notes ?? ""} onChange={set("notes")} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>حفظ</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={applyAll}>نسخ المواصفات لكل الأجهزة</button>
            </div>
            {device.updated_at && <p className="text-[11px] text-faint">آخر تحديث: {fmtDateTime(device.updated_at)}</p>}
          </div>
        ) : (
          <dl className="space-y-1.5 rounded-sm2 bg-canvas p-3 text-sm">
            {SPEC_FIELDS.map((sf) => (
              <div key={sf.key} className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted">{sf.label}</dt>
                <dd className="font-medium text-ink">{device[sf.key] || "—"}</dd>
              </div>
            ))}
            {device.notes && <p className="pt-1 text-xs text-muted">{device.notes}</p>}
          </dl>
        )}
      </div>
    </div>
  );
}
