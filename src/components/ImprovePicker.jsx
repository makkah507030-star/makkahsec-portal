import { useEffect, useMemo } from "react";
import { ELEMENTS } from "../lib/dfile.js";
import { gradeTone } from "../lib/rubric.js";
import { SCORE_LABEL, SUGGEST_AT, FOLLOW_DAYS, merge, suggest } from "../lib/improve.js";

/* =====================================================================
   توصيات التحسين في زيارة الدعم وتقييم الأداء: تُقترح من البنود المقدَّرة 3 فأقل
   ومن نص «جوانب تحتاج دعمًا» (أو التوصيات)، ويؤكد الزائر ما يوصي به ويصحّح البند والنص.
   القيمة المحفوظة: [{ id, key, text, on, score, ek?, et?, manual? }] وتُنشأ التوصيات
   المؤكدة (on) في القاعدة عند صدور الزيارة أو إرسال التقييم (supabase/improvement_loop_3.sql).
   ===================================================================== */

export default function ImprovePicker({ scores, notes, text, textLabel, value, onChange, measuredBy = "الزيارة التالية" }) {
  const list = useMemo(() => merge(suggest(scores, text, notes), value, scores), [scores, notes, text, value]);

  // تبقى القيمة المحفوظة مطابقة للمقترحات كلما تغيّرت الدرجات أو النص
  useEffect(() => {
    if (JSON.stringify(list) !== JSON.stringify(value ?? [])) onChange(list);
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (id, patch) => onChange(list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addOne = () => onChange([...list, { id: `m:${Date.now()}`, key: "", text: "", on: true, manual: true, ek: true, et: true }]);
  const remove = (id) => onChange(list.filter((x) => x.id !== id));
  const allOn = list.length > 0 && list.every((x) => x.on);

  return (
    <div className="mt-1 space-y-2 rounded-sm2 border border-mint-deep/30 bg-mint-tint/40 p-3">
      <p className="text-xs leading-relaxed text-mint-deep">
        مقترحة من البنود المقدَّرة <span className="num">{SUGGEST_AT}</span> فأقل ومن «{textLabel}». أكّد ما توصي به:
        يكتب المعلم خطته لكل توصية بموعد متابعة (افتراضيًا بعد <span className="num">{FOLLOW_DAYS / 7}</span> أسابيع) وتعتمدها،
        ويُقاس الأثر آليًا من درجة البند نفسه في {measuredBy}.
      </p>

      {list.length === 0 && (
        <p className="rounded-sm2 bg-paper px-3 py-2 text-xs text-muted">
          لا توصيات مقترحة: لا بند مقدَّر بـ<span className="num">{SUGGEST_AT}</span> فأقل، ولا نص في «{textLabel}».
        </p>
      )}

      {list.map((x) => {
        const tone = x.score ? gradeTone(x.score) : null;
        return (
          <div key={x.id} className={`rounded-sm2 border bg-paper p-2.5 ${x.on ? "border-mint-deep/50" : "border-line"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink">
                <input type="checkbox" className="accent-[#3E6350]" checked={x.on} onChange={(e) => set(x.id, { on: e.target.checked })} />
                أوصي بها
              </label>
              <span className="chip mr-auto shrink-0 text-[11px]"
                    style={tone ? { background: tone.bg, color: tone.fg } : undefined}>
                {x.score ? <>خط الأساس <span className="num mx-1">{x.score}</span>· {SCORE_LABEL[x.score]}</> : "البند غير مقدَّر هنا"}
              </span>
              {x.manual && <button type="button" className="text-[11px] text-absent hover:underline" onClick={() => remove(x.id)}>حذف</button>}
            </div>
            <select className="field mt-2 w-full py-1.5 text-xs" value={x.key}
                    onChange={(e) => set(x.id, { key: e.target.value, ek: true })}>
              <option value="">اختر البند…</option>
              {ELEMENTS.map(([k, t], i) => <option key={k} value={k}>{i + 1}. {t}</option>)}
            </select>
            <textarea rows={2} className="field mt-2 w-full text-xs" placeholder="نص التوصية"
                      value={x.text} onChange={(e) => set(x.id, { text: e.target.value, et: true })} />
            {x.on && !x.key && <p className="mt-1 text-[11px] text-warning">اختر البند ليُقاس أثر التوصية.</p>}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {list.length > 0 && !allOn && (
          <button type="button" className="btn-ghost py-1 text-xs" onClick={() => onChange(list.map((x) => ({ ...x, on: true })))}>
            تأكيد كل المقترحات
          </button>
        )}
        <button type="button" className="btn-ghost py-1 text-xs" onClick={addOne}>إضافة توصية أخرى</button>
      </div>
    </div>
  );
}
