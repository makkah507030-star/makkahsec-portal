// src/pages/globe/GlobeCardsView.jsx
// بطاقات طلاب جلوب داخل قسم البرنامج (بدل «استوديو البوابة» الذي لا يظهر لمشرف البرنامج):
// بطاقة طولية 5.4 × 8.6 سم لكل طالب من كشف البرنامج بصفته وفصله، تسع بطاقات في ورقة A4،
// بالثيم الفاتح افتراضيًا. التصميم نفسه في الاستوديو (studio/Sheets.jsx ← GlobeCards).
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { GLOBE_MEMBER_ROLES, memberRole } from "../../lib/globe.js";
import { GlobeCards } from "../studio/Sheets.jsx";
import { academicYearLabel } from "../studio/lib";

const SHEET_W = 794;   // عرض ورقة A4 في الاستوديو بالبكسل
const rank = (k) => Math.max(0, GLOBE_MEMBER_ROLES.findIndex((r) => r.k === k));

/* معاينة الورقة مصغّرة بعرض الشاشة */
function Fit({ children }) {
  const box = useRef(null);
  const inner = useRef(null);
  const [s, setS] = useState(0.5);
  const [h, setH] = useState(1123);
  useLayoutEffect(() => {
    const fit = () => {
      setS(Math.min(1, (box.current?.clientWidth ?? SHEET_W) / SHEET_W));
      setH(inner.current?.offsetHeight || 1123);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="w-full overflow-hidden" style={{ height: h * s }}>
      <div ref={inner} style={{ width: SHEET_W, transform: `scale(${s})`, transformOrigin: "top right" }}>{children}</div>
    </div>
  );
}

export default function GlobeCardsView({ members, onBack }) {
  const [theme, setTheme] = useState("light");
  const [who, setWho] = useState("all");          // all أو رقم الطالب لبطاقة واحدة
  const [printing, setPrinting] = useState(false);
  const year = useMemo(() => academicYearLabel(), []);

  // الترتيب: نائب المشرف العام، ثم مشرفو الرصد، ثم الأعضاء، وكلٌّ بترتيب فصله في الكشف
  const all = useMemo(() => (members ?? [])
    .map((m, i) => ({ m, i })).sort((a, b) => rank(a.m.role) - rank(b.m.role) || a.i - b.i)
    .map(({ m }, i) => ({
      id: m.id, name: m.full_name, role: memberRole(m.role).t, no: i + 1,
      cls: m.grade ? `${GRADE_NAMES[m.grade] ?? ""} · ${m.class_no ?? ""}` : "",
    })), [members]);
  const list = who === "all" ? all : all.filter((c) => c.id === who);
  const pages = [];
  for (let i = 0; i < list.length; i += 9) pages.push(list.slice(i, i + 9));

  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 300); };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-2 p-3">
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع للطلاب</button>
        <div className="flex gap-1 rounded-pill border border-line bg-paper p-1">
          {[["light", "فاتح"], ["dark", "داكن"]].map(([k, t]) => (
            <button key={k} onClick={() => setTheme(k)}
                    className={`rounded-pill px-3 py-1 text-xs font-semibold ${theme === k ? "bg-mint-deep text-white" : "text-muted"}`}>{t}</button>
          ))}
        </div>
        <select className="field order-last w-full text-sm sm:order-none sm:w-auto sm:min-w-0 sm:max-w-xs sm:flex-1" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="all">كل طلاب البرنامج ({all.length})</option>
          {all.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.role}</option>)}
        </select>
        <button className="btn-primary ms-auto px-4 py-1.5 text-xs" disabled={!list.length} onClick={print}>
          طباعة / حفظ PDF {pages.length > 1 && <span className="num">({pages.length} أوراق)</span>}
        </button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        بطاقة لكل طالب باسمه وصفته في الفريق وفصله من كشف البرنامج، تسع في الورقة. اطبعها على ورق مقوّى بمقاس A4
        دون تصغير («الحجم الفعلي»)، ثم قصّها على الخط المتقطع. الصفة تُعدَّل من قائمة الطلاب.
      </p>

      {list.length === 0 ? <p className="card px-4 py-8 text-center text-sm text-muted">لا طلاب في البرنامج بعد.</p> : (
        pages.map((cards, i) => (
          <div key={i} className="card overflow-hidden p-2">
            <Fit><GlobeCards theme={theme} d={{ cards, year }} /></Fit>
          </div>
        ))
      )}

      {printing && (
        <PrintPortal id="globe-cards-print"
          extraCss="#globe-cards-print .sheet { break-after: page; } #globe-cards-print .sheet:last-child { break-after: auto; }">
          {pages.map((cards, i) => <GlobeCards key={i} theme={theme} d={{ cards, year }} />)}
        </PrintPortal>
      )}
    </div>
  );
}
