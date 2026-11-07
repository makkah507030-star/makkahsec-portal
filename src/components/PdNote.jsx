// src/components/PdNote.jsx
/* ملاحظة النموذج من دليل اعتماد أنشطة التطوير المهني: من يعتمده، وما يشترط له. compact للبطاقات */
export default function PdNote({ by, notes, edu = false, compact = false }) {
  if (!notes?.length) return null;
  const tone = edu ? "border-warning/40 bg-warning-light/60" : "border-mint-light bg-mint-tint/50";
  return (
    <div className={`rounded-sm2 border ${tone} ${compact ? "px-2.5 py-2" : "px-3 py-2.5"}`}>
      {by && <p className={`font-semibold ${edu ? "text-warning" : "text-mint-deep"} ${compact ? "text-[11px]" : "text-xs"}`}>الاعتماد: {by}</p>}
      <ul className={`mt-1 list-disc space-y-0.5 ps-4 leading-relaxed text-muted ${compact ? "text-[11px]" : "text-[12.5px]"}`}>
        {notes.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}
