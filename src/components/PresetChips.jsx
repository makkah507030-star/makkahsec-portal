// src/components/PresetChips.jsx
// بطاقات صيغ جاهزة فوق حقل نصي: الضغط يضيف الصيغة سطرًا جديدًا ولا يمسح ما
// كُتب، ولا تتكرر الصيغة إن أُضيفت من قبل. (replace: تستبدل النص بدل الإضافة)

export function addPreset(current, text, replace = false) {
  if (replace) return text;
  const cur = String(current ?? "").trim();
  if (cur.split("\n").some((l) => l.trim() === text)) return cur;
  return cur ? `${cur}\n${text}` : text;
}

export default function PresetChips({ items = [], value, onChange, replace = false, hint = true }) {
  if (!items.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {hint && !replace && (
        <span className="w-full text-[11px] text-faint">اضغط البطاقة لإضافتها سطرًا، ويمكن الجمع والتعديل بعدها.</span>
      )}
      {items.map((t) => {
        const used = String(value ?? "").split("\n").some((l) => l.trim() === t);
        return (
          <button key={t} type="button" title={t} onClick={() => onChange(addPreset(value, t, replace))}
            className={`max-w-full truncate rounded-pill border px-3 py-1 text-[11.5px] font-medium transition-colors ${
              used ? "border-mint-deep bg-mint-deep text-white"
                   : "border-[#CCF2DB] bg-mint-tint text-mint-deep hover:bg-[#CCF2DB]"}`}>
            {used ? "✓ " : ""}{t.length > 48 ? t.slice(0, 48) + "…" : t}
          </button>
        );
      })}
    </div>
  );
}
