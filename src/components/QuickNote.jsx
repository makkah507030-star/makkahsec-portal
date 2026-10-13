// src/components/QuickNote.jsx
import { useState } from "react";
import { useLocation } from "react-router-dom";
import NoteEditor from "./NoteEditor.jsx";

/* =====================================================================
   الإضافة السريعة إلى «مفكرتي» من أي صفحة: زر صغير ثابت أسفل الشاشة يفتح
   محرّر ملاحظة، وتُربط الملاحظة تلقائيًا بالصفحة المفتوحة (رابطها وعنوانها)
   ليعود إليها صاحبها بضغطة. للمعلمين والإداريين، ولا يظهر في صفحة المفكرة نفسها.
   ===================================================================== */
export default function QuickNote() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(null);   // { path, title } عند الفتح
  const [saved, setSaved] = useState(false);
  if (pathname === "/notebook") return null;

  const start = () => {
    // عنوان الصفحة: أول عنوان رئيسي فيها، وإلا رابطها
    const h = document.querySelector("main h1")?.textContent?.trim();
    setSaved(false);
    setOpen({ path: pathname + search, title: h || null });
  };

  return (
    <>
      <button onClick={start} title="ملاحظة جديدة في مفكرتي"
              className="fixed bottom-20 left-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-mint-deep text-lg text-white shadow-lg hover:bg-mint-hover lg:bottom-6 print:hidden">
        ✎
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4 print:hidden" dir="rtl"
             onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-white p-4 shadow-xl sm:rounded-card">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-ink">ملاحظة جديدة في مفكرتي</p>
              <button className="text-sm text-muted" onClick={() => setOpen(null)}>إغلاق</button>
            </div>
            {saved ? (
              <div className="space-y-3 text-center">
                <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">حُفظت في مفكرتي.</p>
                <div className="flex gap-2">
                  <button className="btn-primary flex-1" onClick={() => setSaved(false)}>ملاحظة أخرى</button>
                  <button className="rounded-pill border border-line px-4 text-sm text-muted" onClick={() => setOpen(null)}>إغلاق</button>
                </div>
              </div>
            ) : (
              <NoteEditor link={open} autoFocus onSaved={() => setSaved(true)} onCancel={() => setOpen(null)} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
