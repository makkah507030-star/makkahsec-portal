// src/pages/lab/lessons/mocks.jsx
// واجهات محاكاة للبرامج في محطات «الخطوات»: كل عنصر قابل للضغط له معرّف (target)،
// والمحطة تحدد العنصر المطلوب في كل خطوة. الحالة (state) تأتي من بيانات الدرس.
// حاسبة ويندوز: الوضع القياسي ووضع المبرمج مع أسطر HEX وDEC وOCT وBIN.

const BASES = { hex: 16, dec: 10, oct: 8, bin: 2 };

/* زر في المحاكاة: يُبرَز عند التلميح، ويُبلَّغ بالضغط عليه */
function Hit({ id, onHit, hint, className = "", children, ...rest }) {
  return (
    <button type="button" data-target={id} onClick={() => onHit(id)} {...rest}
            className={`${className} ${hint === id ? "relative z-10 ring-4 ring-amber-400 ring-offset-1 animate-pulse" : ""}`}>
      {children}
    </button>
  );
}

function Calculator({ state, onHit, hint }) {
  const prog = state.mode === "programmer";
  const n = parseInt(state.display || "0", BASES[state.base] ?? 10) || 0;
  const group = (s, k) => s.replace(new RegExp(`\\B(?=(.{${k}})+$)`, "g"), " ");
  const rows = [
    ["hex", "HEX", n.toString(16).toUpperCase()],
    ["dec", "DEC", n.toLocaleString("en-US")],
    ["oct", "OCT", n.toString(8)],
    ["bin", "BIN", group(n.toString(2), 4)],
  ];
  const keys = prog
    ? ["A", "B", "7", "8", "9", "C", "D", "4", "5", "6", "E", "F", "1", "2", "3", "", "", "", "0", ""]
    : ["7", "8", "9", "4", "5", "6", "1", "2", "3", "", "0", ""];

  return (
    <div dir="ltr" className="relative mx-auto w-full max-w-[22rem] select-none overflow-hidden rounded-[10px] border border-[#cfd6d2] bg-[#f3f3f3] text-[#1b1b1b] shadow-card">
      <div className="flex items-center justify-between bg-[#e8e8e8] px-3 py-1.5 text-[11px] text-[#555]">
        <span>Calculator · الحاسبة</span><span>— ▢ ✕</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        <Hit id="menu" onHit={onHit} hint={hint} className="rounded px-2 py-1 text-lg hover:bg-black/5">☰</Hit>
        <span className="text-base font-semibold" dir="rtl">{prog ? "مبرمج" : "قياسية"}</span>
      </div>
      <div className="px-4 pb-2 text-right font-mono text-4xl font-semibold tracking-wide">{prog && state.base !== "dec" ? n.toString(BASES[state.base]).toUpperCase() : n.toLocaleString("en-US")}</div>
      {prog && (
        <div className="space-y-0.5 px-2 pb-2">
          {rows.map(([id, label, val]) => (
            <Hit key={id} id={`row-${id}`} onHit={onHit} hint={hint}
                 className={`flex w-full items-center gap-3 rounded px-2 py-1 text-left text-sm hover:bg-black/5 ${state.base === id ? "border-l-4 border-[#3E6350] bg-white" : ""}`}>
              <span className="w-9 font-semibold text-[#555]">{label}</span>
              <span className="font-mono">{val}</span>
            </Hit>
          ))}
        </div>
      )}
      <div className={`grid gap-1 p-2 ${prog ? "grid-cols-5" : "grid-cols-3"}`}>
        {keys.map((k, i) => (k
          ? <Hit key={i} id={`key-${k.toLowerCase()}`} onHit={onHit} hint={hint}
                 className="rounded bg-white py-2.5 font-mono text-base font-semibold shadow-sm hover:bg-[#fafafa]">{k}</Hit>
          : <span key={i} className="rounded bg-[#ececec] py-2.5" />))}
      </div>
      {state.menuOpen && (
        <div className="absolute inset-y-0 left-0 z-20 w-48 bg-white shadow-xl" dir="rtl">
          <p className="px-3 py-2 text-xs font-semibold text-[#777]">الحاسبة</p>
          {[["mode-standard", "قياسية"], ["mode-scientific", "علمية"], ["mode-programmer", "مبرمج"]].map(([id, label]) => (
            <Hit key={id} id={id} onHit={onHit} hint={hint} className="block w-full px-4 py-2.5 text-start text-sm hover:bg-black/5">{label}</Hit>
          ))}
        </div>
      )}
    </div>
  );
}

export const MOCKS = { calculator: Calculator };
