// src/pages/achievement/AchGate.jsx
/* =====================================================================
   بوابة مركز تحليل النتائج: المركز مغلق افتراضيًا حتى اكتمال رصد الدرجات،
   فلا تُعرض تحليلات ولا تصدر أعمال بدرجات ناقصة. يفتحه وكيل الشؤون التعليمية
   أو المدير أو الدعم الفني بزرّ هنا (settings.ach_center_enabled).
   يُستخدم كغلاف: <AchGate> ... محتوى المركز ... </AchGate>
   ===================================================================== */
import { useState } from "react";
import { useSession } from "../../lib/session.jsx";
import Loader from "../../components/Loader.jsx";
import { useAchOpen, setAchOpen, ACH_GATE_ROLES } from "../../lib/achievement";

/* زرّ الفتح/الإغلاق — لمن يملكه فقط، في أعلى صفحات المركز حين يكون مفتوحًا */
export function AchGateSwitch() {
  const { adminRoles = [] } = useSession();
  const [open, setOpen] = useAchOpen();
  const canToggle = adminRoles.some((r) => ACH_GATE_ROLES.includes(r));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!canToggle || open == null) return null;
  const flip = async () => {
    setBusy(true); setErr("");
    try { await setAchOpen(!open); setOpen(!open); }
    catch (e) { setErr(e.message ?? String(e)); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={flip} disabled={busy}
        className={`rounded-pill border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          open ? "border-present/40 bg-present/10 text-present hover:bg-present/15"
               : "border-warning/40 bg-warning-light text-warning hover:bg-warning-light/70"}`}>
        {open ? "المركز مفتوح للمستفيدين — اضغط للإغلاق" : "المركز مغلق — اضغط لفتحه"}
      </button>
      {err && <span className="text-xs text-absent">تعذّر الحفظ: {err}</span>}
    </div>
  );
}

export default function AchGate({ children }) {
  const { adminRoles = [] } = useSession();
  const [open, setOpen] = useAchOpen();
  const canToggle = adminRoles.some((r) => ACH_GATE_ROLES.includes(r));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (open == null) return <Loader />;
  if (open) return children;

  const openNow = async () => {
    setBusy(true); setErr("");
    try { await setAchOpen(true); setOpen(true); }
    catch (e) { setErr(e.message ?? String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="card mx-auto max-w-xl px-6 py-10 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-light text-warning">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <h1 className="text-lg font-bold text-ink">مركز تحليل النتائج مغلق مؤقتًا</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        يُفتح المركز بعد اكتمال رصد درجات الفترة، كي لا تصدر تحليلات أو أعمال بدرجات ناقصة.
      </p>
      {canToggle ? (
        <div className="mt-6">
          <button onClick={openNow} disabled={busy}
            className="rounded-pill bg-mint-deep px-5 py-2 text-sm font-semibold text-white hover:bg-mint-deep/90 disabled:opacity-50">
            فتح المركز الآن
          </button>
          <p className="mt-2 text-xs text-faint">يراه بعدها كل المستفيدين. يمكنك إغلاقه لاحقًا من أعلى المركز.</p>
          {err && <p className="mt-2 text-xs text-absent">تعذّر الفتح: {err}</p>}
        </div>
      ) : (
        <p className="mt-6 text-xs text-faint">سيتاح لك حين يفتحه وكيل الشؤون التعليمية.</p>
      )}
    </div>
  );
}
