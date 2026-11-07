// src/pages/performance/StaffRowButtons.jsx
import { dfileLink } from "../../lib/dfile.js";

/* زرّا صف الموظف: شواهده، وملفه الرقمي (رابطه العام في تبويب جديد، أو «لا ملف رقمي» إن لم ينشئه) */
export default function StaffRowButtons({ code, onEvidence }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <button className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={onEvidence}>الشواهد</button>
      {code
        ? <a className="rounded-pill border border-mint-deep/40 bg-white px-3 py-1.5 text-xs font-semibold text-mint-deep" href={dfileLink(code)} target="_blank" rel="noreferrer">الملف الرقمي</a>
        : <span className="rounded-pill border border-line px-3 py-1.5 text-xs text-faint" title="لم ينشئ ملفه الرقمي بعد">لا ملف رقمي</span>}
    </span>
  );
}
