// src/pages/lab/LabTickets.jsx
// بلاغات أعطال الأجهزة: يرفعها معلم التقنية (من رمز QR على خلفية الجهاز أو
// من هنا)، ويتابعها محضر المعمل حتى تُحل. حالة الجهاز تتبع البلاغ في القاعدة.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Loader from "../../components/Loader.jsx";
import { fmtDateTime } from "../../lib/dates";
import { notifyUsers } from "../../lib/referrals";
import { TICKET_CATEGORIES, TICKET_STATUS, OPEN_TICKET, DEVICE_STATUS } from "../../lib/lab.js";

const FILTERS = [
  { key: "open", label: "المفتوحة" },
  { key: "resolved", label: "المحلولة" },
  { key: "all", label: "الكل" },
];

export default function LabTickets({ lab, canReport, isManager, reportSeat, onReportDone }) {
  const [rows, setRows] = useState(null);
  const [devices, setDevices] = useState([]);
  const [filter, setFilter] = useState("open");
  const [newFor, setNewFor] = useState(reportSeat ?? null);   // رقم الجهاز أو 0 للاختيار
  const [handling, setHandling] = useState(null);
  const [msg, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    const [{ data, error }, { data: d }] = await Promise.all([
      supabase.from("lab_tickets")
        .select("id, seat_no, category, description, stopped, status, reporter_name, created_at, updated_at, resolution")
        .eq("lab_id", lab).order("created_at", { ascending: false }).limit(300),
      supabase.from("lab_devices").select("seat_no, code, status").eq("lab_id", lab).order("seat_no"),
    ]);
    if (error) setMsg({ ok: false, text: "تعذّر تحميل البلاغات: " + error.message });
    setRows(data ?? []);
    setDevices(d ?? []);
  }, [lab, setMsg]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (reportSeat) setNewFor(reportSeat); }, [reportSeat]);

  const codeOf = useMemo(() => Object.fromEntries(devices.map((d) => [d.seat_no, d.code])), [devices]);
  const openCount = (rows ?? []).filter((r) => OPEN_TICKET.includes(r.status)).length;
  const shown = (rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "open" ? OPEN_TICKET.includes(r.status) : r.status === "resolved");

  if (rows === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-card border border-line bg-paper p-1">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                    className={`rounded-pill px-3 py-1 text-xs transition-colors ${
                      filter === f.key ? "bg-ink font-semibold text-paper" : "text-muted hover:text-ink"}`}>
              {f.label}{f.key === "open" && openCount > 0 && <span className="num"> ({openCount})</span>}
            </button>
          ))}
        </div>
        {canReport && <button type="button" className="btn-primary py-2" onClick={() => setNewFor(0)}>بلاغ عطل جديد</button>}
      </div>

      {shown.length === 0 ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          {filter === "open" ? "لا توجد بلاغات مفتوحة — كل الأجهزة بخير." : "لا توجد بلاغات."}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => {
            const st = TICKET_STATUS[t.status] ?? TICKET_STATUS.new;
            return (
              <li key={t.id} className="card flex flex-wrap items-start gap-3 p-3">
                <span className="num grid h-11 w-11 shrink-0 place-items-center rounded-sm2 bg-canvas text-base font-bold text-ink">{t.seat_no}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-ink">{t.category}</p>
                    <span className={`chip ${st.chip}`}>{st.label}</span>
                    {t.stopped && t.status !== "resolved" && <span className="chip bg-danger-light text-absent">الجهاز متوقف</span>}
                  </div>
                  {t.description && <p className="mt-0.5 text-sm text-ink">{t.description}</p>}
                  <p className="mt-1 text-[11px] text-muted">
                    <bdi dir="ltr">{codeOf[t.seat_no]}</bdi> · {t.reporter_name || "—"} · {fmtDateTime(t.created_at)}
                  </p>
                  {t.resolution && <p className="mt-1 rounded-sm2 bg-canvas px-2 py-1 text-xs text-ink">الإجراء: {t.resolution}</p>}
                </div>
                {isManager && t.status !== "resolved" && (
                  <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setHandling(t)}>متابعة</button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}

      {newFor !== null && (
        <NewTicket lab={lab} devices={devices} seat={newFor || null}
                   onClose={() => { setNewFor(null); onReportDone?.(); }}
                   onDone={(text) => { setNewFor(null); onReportDone?.(); setFilter("open"); setMsg({ ok: true, text }); load(); }}
                   onError={(text) => setMsg({ ok: false, text })} />
      )}
      {handling && (
        <HandleTicket ticket={handling} code={codeOf[handling.seat_no]}
                      onClose={() => setHandling(null)}
                      onDone={(text) => { setHandling(null); setMsg({ ok: true, text }); load(); }}
                      onError={(text) => setMsg({ ok: false, text })} />
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

function NewTicket({ lab, devices, seat: seat0, onClose, onDone, onError }) {
  const [seat, setSeat] = useState(seat0 ?? "");
  const [category, setCategory] = useState("");
  const [desc, setDesc] = useState("");
  const [stopped, setStopped] = useState(false);
  const [busy, setBusy] = useState(false);
  const dev = devices.find((d) => d.seat_no === Number(seat));

  const send = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("lab_ticket_open", {
      p_lab: lab, p_seat: Number(seat), p_category: category, p_desc: desc, p_stopped: stopped,
    });
    if (error) { setBusy(false); onError("تعذّر رفع البلاغ: " + error.message); return; }
    // إشعار محضر المعمل — لا يعطّل البلاغ لو فشل
    const { data: ids } = await supabase.rpc("lab_manager_ids");
    await notifyUsers(ids ?? [], `بلاغ عطل: الجهاز ${seat}`, [category, desc.trim()].filter(Boolean).join(" — "), "/lab?tab=tickets");
    setBusy(false);
    onDone(`رُفع البلاغ عن الجهاز ${seat}، ووصل إشعار لمحضر المعمل.`);
  };

  return (
    <Sheet title="بلاغ عطل" sub={dev ? `الجهاز ${dev.seat_no} · ${dev.code}` : "معمل الحاسب الآلي"} onClose={onClose}>
      <div className="space-y-3">
        {!seat0 && (
          <div>
            <label className="label" htmlFor="tk-seat">الجهاز</label>
            <select id="tk-seat" className="field" value={seat} onChange={(e) => setSeat(e.target.value)}>
              <option value="">— اختر رقم الجهاز —</option>
              {devices.map((d) => (
                <option key={d.seat_no} value={d.seat_no}>
                  {d.seat_no} · {d.code}{d.status !== "ok" ? ` (${DEVICE_STATUS[d.status]?.label})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <p className="label">نوع العطل</p>
          <div className="flex flex-wrap gap-1.5">
            {TICKET_CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                      className={`rounded-pill border px-3 py-1.5 text-xs transition-colors ${
                        category === c ? "border-mint-deep bg-mint-deep font-semibold text-white" : "border-line text-ink hover:border-mint-deep"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tk-desc">وصف العطل {category === "أخرى" ? "" : "(اختياري)"}</label>
          <textarea id="tk-desc" className="field min-h-[70px]" value={desc} maxLength={400}
                    placeholder="مثال: الشاشة تومض ثم تنطفئ" onChange={(e) => setDesc(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-mint-deep))]" checked={stopped} onChange={(e) => setStopped(e.target.checked)} />
          الجهاز متوقف ولا يصلح للاستخدام
        </label>
        <button type="button" className="btn-primary w-full" onClick={send}
                disabled={busy || !seat || !category || (category === "أخرى" && !desc.trim())}>
          {busy ? "جارٍ الإرسال…" : "إرسال البلاغ"}
        </button>
      </div>
    </Sheet>
  );
}

function HandleTicket({ ticket, code, onClose, onDone, onError }) {
  const [status, setStatus] = useState(ticket.status === "new" ? "in_progress" : ticket.status);
  const [note, setNote] = useState(ticket.resolution ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { data: reporter, error } = await supabase.rpc("lab_ticket_update", { p_id: ticket.id, p_status: status, p_note: note });
    if (error) { setBusy(false); onError("تعذّر الحفظ: " + error.message); return; }
    if (status === "resolved") {
      await notifyUsers([reporter], `تم حل بلاغ الجهاز ${ticket.seat_no}`, note.trim() || ticket.category, "/lab?tab=tickets");
    }
    setBusy(false);
    onDone(`حُدّث بلاغ الجهاز ${ticket.seat_no}: ${TICKET_STATUS[status].label}`);
  };

  return (
    <Sheet title={`متابعة بلاغ الجهاز ${ticket.seat_no}`} sub={`${code ?? ""} · ${ticket.category}`} onClose={onClose}>
      <div className="space-y-3">
        {ticket.description && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink">{ticket.description}</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {["in_progress", "external", "resolved"].map((k) => (
            <button key={k} type="button" onClick={() => setStatus(k)}
                    className={`rounded-sm2 border px-2 py-2 text-xs font-semibold ${
                      status === k ? `border-transparent ${TICKET_STATUS[k].chip} ring-2 ring-mint-deep/40` : "border-line text-muted"}`}>
              {TICKET_STATUS[k].label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          {status === "external" ? "يصير الجهاز «في الصيانة»." : status === "resolved" ? "يعود الجهاز «يعمل» إن لم يبقَ له بلاغ مفتوح، ويُشعَر المعلم." : "يبقى الجهاز على حالته."}
        </p>
        <div>
          <label className="label" htmlFor="tk-note">الإجراء المتخذ</label>
          <textarea id="tk-note" className="field min-h-[70px]" value={note} maxLength={400}
                    placeholder="مثال: استُبدل كابل الشاشة" onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </Sheet>
  );
}
