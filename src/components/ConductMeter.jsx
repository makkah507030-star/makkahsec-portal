// src/components/ConductMeter.jsx
/* =====================================================================
   مؤشر السلوك — في رئيسية الطالب وولي الأمر (supabase/conduct_meter.sql). تقديري من سجل البوابة
   منذ بداية العام: السلوك الإيجابي من 80 بعد حسم المخالفات بدرجاتها، ومعه الجوانب الإيجابية.
   الدرجة الرسمية تُرصد في نور نهاية العام. لا يظهر نص المخالفة ولا شيء من التوجيه.
   ===================================================================== */
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDate } from "../lib/dates";
import { DEGREES } from "../lib/behavior.js";

const level = (s) =>
  s >= 80 ? { t: "سلوك مثالي", c: "#3E8A62", msg: "لا مخالفات مسجلة هذا العام. أحسنت، استمر على ذلك." }
  : s >= 75 ? { t: "سلوك جيد", c: "#B8912F", msg: "ملاحظات بسيطة يمكن تجاوزها بالالتزام والمشاركة الإيجابية." }
  : { t: "يحتاج اهتمامًا", c: "#A23B3B", msg: "راجع وكيل شؤون الطلاب لمعرفة فرص التعويض، وشارك في البرامج والأنشطة." };

function Ring({ value, max, color }) {
  const r = 42, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, value / max));
  return (
    <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E1EEE6" strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${c * f} ${c}`} />
      <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central"
            className="num" style={{ fontSize: 26, fontWeight: 700, fill: "#1C3328" }}>{value}</text>
    </svg>
  );
}

export default function ConductMeter({ studentId }) {
  const [m, setM] = useState(null);
  useEffect(() => {
    if (!studentId) return;
    supabase.rpc("student_conduct_meter", { p_student: studentId })
      .then(({ data, error }) => setM(error ? null : data));
  }, [studentId]);
  if (!m) return null;

  const lv = level(m.score);
  const plus = [
    ["شهادات شكر", m.certificates],
    ["فعاليات شارك فيها", m.events],
    ["ترشيحات مقبولة", m.nominations],
    ["نقاط دوري المادة", m.league],
  ].filter(([, n]) => n > 0);
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">مؤشر السلوك</h2>
        <p className="text-[11px] text-muted">تقديري من سجل البوابة منذ <span className="num">{fmtDate(m.from)}</span>، والدرجة الرسمية تُرصد في نور نهاية العام.</p>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-4 py-4">
        <Ring value={m.score} max={m.base} color={lv.c} />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold" style={{ color: lv.c }}>{lv.t}</p>
          <p className="text-xs text-muted">السلوك الإيجابي <span className="num font-semibold text-ink">{m.score}</span> من <span className="num">{m.base}</span>
            {m.deducted > 0 && <> · حُسم <span className="num">{m.deducted}</span></>}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{lv.msg}</p>
        </div>
      </div>

      {m.violations.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2.5">
          <span className="text-xs text-muted">المخالفات المسجلة:</span>
          {m.violations.map((v) => {
            const d = DEGREES.find((x) => x.n === v.degree);
            return (
              <span key={v.degree} className="chip" style={{ background: d?.bg, color: d?.tone }}>
                الدرجة {d?.name} × <span className="num">{v.count}</span>
              </span>
            );
          })}
          <span className="mr-auto text-[11px] text-muted">آخرها <span className="num">{fmtDate(m.violations.reduce((a, v) => (v.last > a ? v.last : a), ""))}</span></span>
        </div>
      )}

      <div className="border-t border-line bg-mint-tint/30 px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-mint-deep">الجوانب الإيجابية</p>
        {plus.length === 0 && !m.scout ? (
          <p className="text-xs text-muted">لا شيء بعد هذا العام. المشاركة في الأنشطة والبرامج والفرق تُحتسب لك هنا.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {plus.map(([t, n]) => (
              <span key={t} className="rounded-sm2 border border-mint-light bg-white px-3 py-1.5 text-center">
                <span className="num block text-base font-bold leading-none text-mint-deep">{n}</span>
                <span className="text-[11px] text-muted">{t}</span>
              </span>
            ))}
            {m.scout && <span className="self-center rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">عضو الفريق الكشفي</span>}
          </div>
        )}
        {m.recent?.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
            {m.recent.map((r, i) => <li key={i}>• {r.t} <span className="num">({fmtDate(r.d)})</span></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
