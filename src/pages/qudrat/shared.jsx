// src/pages/qudrat/shared.jsx
// ما تشترك فيه شاشة التدريب والاختبار المحاكي في مركز التدريب (القدرات)

export const LETTERS = ["أ", "ب", "ج", "د"];
export const pctOf = (c, t) => (t ? Math.round((c / t) * 100) : 0);

/* نص فيه **كلمة** بخط عريض كما في الأصل */
export function Rich({ text }) {
  return String(text ?? "").split(/(\*\*[^*]+\*\*)/).map((p, i) =>
    p.startsWith("**") ? <b key={i} className="font-bold text-ink underline decoration-mint decoration-2 underline-offset-4">{p.slice(2, -2)}</b> : p);
}

/* نص الخيار: الخيار الرقمي الخالي من الحروف العربية يُكتب من اليسار (57½% لا %½57) */
export function OptText({ text }) {
  return <span dir={/[\u0600-\u06FF]/.test(text) ? undefined : "ltr"} className="text-[15.5px] text-ink">{text}</span>;
}

/* نص السؤال وشكله وقيمتا المقارنة */
export function Stem({ q }) {
  return (
    <>
      <p className="text-[17px] font-semibold leading-loose text-ink"><Rich text={q.q} /></p>
      {q.img && <img src={q.img} alt="شكل السؤال" className="mx-auto mt-3 max-h-72 rounded-sm2 bg-white p-2" />}
      {q.cmp && (
        <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-sm2 border border-line text-center">
          <p className="border-b border-l border-line bg-canvas py-1.5 text-xs font-semibold text-muted">القيمة الأولى</p>
          <p className="border-b border-line bg-canvas py-1.5 text-xs font-semibold text-muted">القيمة الثانية</p>
          <p className="border-l border-line px-2 py-3 text-lg font-bold text-ink">{q.cmp[0]}</p>
          <p className="px-2 py-3 text-lg font-bold text-ink">{q.cmp[1]}</p>
        </div>
      )}
    </>
  );
}

/* القطعة أو المعطيات المشتركة، قابلة للطي */
export function Passage({ passage, open, onToggle }) {
  return (
    <section className="card overflow-hidden">
      <button className="flex w-full items-center justify-between px-4 py-2.5 text-right" onClick={onToggle}>
        <span className="text-sm font-bold text-ink">{passage.title ? `القطعة: ${passage.title}` : "المعطيات"}</span>
        <span className="text-xs text-mint-deep">{open ? "إخفاء" : "إظهار"}</span>
      </button>
      {open && (
        <div className="max-h-[50vh] space-y-2.5 overflow-y-auto border-t border-line/60 px-4 py-3 text-[15px] leading-loose text-ink">
          {passage.text.map((p, k) => <p key={k}><Rich text={p} /></p>)}
          {passage.img && <img src={passage.img} alt="" className="mx-auto max-h-80 rounded-sm2 bg-white p-2" />}
        </div>
      )}
    </section>
  );
}
