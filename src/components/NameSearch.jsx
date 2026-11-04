// src/components/NameSearch.jsx
// مربع بحث لسرعة الوصول في القوائم الطويلة (الإنذارات، الغياب، المعلمين…): يطابق الاسم أو الهوية أو الفصل
// دون تفريق بين الهمزات (أ إ آ ا) ولا التاء المربوطة والهاء ولا الألف المقصورة والياء، وبأي جزء من الاسم.
// الاستخدام: const [q, setQ] = useState("");  list.filter((s) => matchQ(q, s.full_name, s.national_id))
import { normalizeArabic } from "../lib/importer.js";

const words = (q) => normalizeArabic(q).toLowerCase().split(" ").filter(Boolean);

/** هل يطابق البحث q أحد الحقول؟ كل كلمة في البحث يجب أن توجد في الحقول مجتمعة. البحث الفارغ يطابق الكل. */
export function matchQ(q, ...fields) {
  const w = words(q);
  if (!w.length) return true;
  const hay = normalizeArabic(fields.filter((x) => x != null && x !== "").join(" ")).toLowerCase();
  return w.every((x) => hay.includes(x));
}

export default function NameSearch({ value, onChange, placeholder = "ابحث بالاسم أو رقم الهوية…", count, total, className = "" }) {
  return (
    <div className={`no-print flex items-center gap-2 ${className}`}>
      <div className="relative min-w-0 flex-1">
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-faint" style={{ insetInlineStart: 12 }}
             fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" />
        </svg>
        <input type="search" className="field w-full" style={{ paddingInlineStart: 36 }} value={value}
               placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-label="بحث" />
      </div>
      {value && total != null && (
        <span className="num shrink-0 text-xs text-muted">{count ?? 0} من {total}</span>
      )}
    </div>
  );
}
