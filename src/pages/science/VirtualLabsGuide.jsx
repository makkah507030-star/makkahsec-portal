// src/pages/science/VirtualLabsGuide.jsx
// دليل تثبيت واستخدام المختبرات الافتراضية عبر منصة مدرستي (الإدارة العامة للتجهيزات المدرسية):
// للمحضرين ومعلمي العلوم في «مختبرات العلوم». الملف في public/docs/science، وروابط الأقسام تفتح صفحتها.
import { useState } from "react";

export const VLAB_GUIDE = "/docs/science/virtual-labs-guide.pdf";
const PARTS = [
  { t: "المختبرات الافتراضية: أهميتها ومميزاتها وطرق استخدامها", p: 4 },
  { t: "مختبر الفيزياء الافتراضي: وصفه وإمكاناته", p: 10 },
  { t: "مختبر الكيمياء الافتراضي: وصفه وإمكاناته", p: 14 },
  { t: "التثبيت من حساب الطالب في مدرستي", p: 18 },
  { t: "التثبيت من حساب المعلم في مدرستي، وإضافة التجربة نشاطًا", p: 24 },
  { t: "طريقة استخدام مختبر الفيزياء الافتراضي", p: 29 },
  { t: "طريقة استخدام مختبر الكيمياء الافتراضي", p: 35 },
];

export default function VirtualLabsGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="card overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
              className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-canvas">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-excused/10 text-[11px] font-bold text-excused">PDF</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">دليل تثبيت واستخدام المختبرات الافتراضية عبر منصة مدرستي</span>
          <span className="block text-xs text-muted">الإدارة العامة للتجهيزات المدرسية · مختبرا الفيزياء والكيمياء الافتراضيان (كروكودايل) · 41 صفحة</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-mint-deep">{open ? "إخفاء" : "الأقسام"}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-line/60 px-4 py-3">
          <ul className="space-y-1">
            {PARTS.map((x) => (
              <li key={x.p}>
                <a href={`${VLAB_GUIDE}#page=${x.p}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-ink hover:text-mint-deep">
                  <span className="num w-10 shrink-0 text-xs text-muted">ص {x.p}</span>{x.t}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <a className="btn-primary px-4 py-1.5 text-sm" href={VLAB_GUIDE} target="_blank" rel="noopener">فتح الدليل</a>
            <a className="btn-ghost px-4 py-1.5 text-sm" href={VLAB_GUIDE} download="دليل المختبرات الافتراضية.pdf">تنزيل</a>
          </div>
          <p className="text-[11px] text-muted">التجربة المنفّذة في المختبر الافتراضي تُسجَّل في «سجل التنفيذ» بخيار «مختبرات افتراضية».</p>
        </div>
      )}
    </section>
  );
}
