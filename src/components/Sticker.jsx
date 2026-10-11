// src/components/Sticker.jsx
import { FLAGS } from "../lib/flags.js";

/* ملصق النموذج (lib/flags.js): Sticker للعرض، وFlagPicker لاختيار المرسل */

// مائل قليلًا كالملصق الورقي على الملف
export default function Sticker({ flag }) {
  const f = FLAGS[flag];
  if (!f) return null;
  return <span className={`shrink-0 -rotate-3 rounded-sm px-1.5 py-0.5 text-[10.5px] font-bold shadow-sm ${f.c}`}>{f.t}</span>;
}

export function FlagPicker({ value, onChange, hint = "يظهر للمستلم على المهمة، والعاجل في أول قائمته" }) {
  const off = "border border-line bg-white text-muted hover:bg-canvas";
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-muted">الملصق <span className="font-normal text-faint">({hint})</span></p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange(null)}
                className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium ${!value ? "bg-mint-deep text-white" : off}`}>
          بلا ملصق
        </button>
        {Object.entries(FLAGS).map(([k, f]) => (
          <button key={k} type="button" onClick={() => onChange(k)}
                  className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-semibold ${value === k ? f.c : off}`}>
            {f.t}
          </button>
        ))}
      </div>
    </div>
  );
}
