// src/components/StudentNoteChips.jsx
import { useState } from "react";
import { KIND_ORDER, NOTE_KINDS } from "../lib/studentNotes.js";
import { fmtDate } from "../lib/dates";

/* =====================================================================
   شارات ملاحظات الطالب تحت اسمه في كشف التحضير: شارة لكل نوع (صحية،
   سلوكية، نفسية) بلا نص، فلا يقرؤها الطلاب على شاشة المعلم. الضغط يفتح
   نافذة بالملاحظات وما يفعله المعلم، واسم كاتبها وتاريخها.
   ===================================================================== */

function KindIcon({ kind }) {
  const p = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2,
              strokeLinecap: "round", strokeLinejoin: "round", className: "h-3 w-3" };
  if (kind === "health") return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>;
  if (kind === "behavior") return <svg {...p}><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>;
  return <svg {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>;
}

export function NoteChip({ kind, count, onClick }) {
  const k = NOTE_KINDS[kind];
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-semibold ${k.chip}`}>
      <KindIcon kind={kind} />{k.label}{count > 1 && <span className="num">({count})</span>}
    </button>
  );
}

export function NotesModal({ name, notes, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card max-h-[80vh] w-full max-w-md overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-faint">ملاحظات للمعلم</p>
            <h3 className="text-sm font-bold text-ink">{name}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-muted hover:text-ink">إغلاق</button>
        </div>
        <div className="mt-3 space-y-2.5">
          {KIND_ORDER.flatMap((kind) => notes.filter((n) => n.kind === kind)).map((n) => (
            <div key={n.id} className="rounded-sm2 border border-line p-3">
              <NoteChip kind={n.kind} />
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">{n.body}</p>
              <p className="mt-2 text-[11px] text-faint">
                {n.created_by_name || "—"}{n.updated_at && <> · {fmtDate(n.updated_at)}</>}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          هذه معلومات خاصة بالطالب: لا تُعرض أمام زملائه، ولا تُشارك خارج البوابة.
        </p>
      </div>
    </div>
  );
}

/** شارات طالب واحد — notes: ملاحظاته السارية */
export default function StudentNoteChips({ name, notes }) {
  const [open, setOpen] = useState(false);
  if (!notes?.length) return null;
  const kinds = KIND_ORDER.filter((k) => notes.some((n) => n.kind === k));
  return (
    <>
      <div className="mt-1 flex flex-wrap gap-1">
        {kinds.map((k) => (
          <NoteChip key={k} kind={k} count={notes.filter((n) => n.kind === k).length} onClick={() => setOpen(true)} />
        ))}
      </div>
      {open && <NotesModal name={name} notes={notes} onClose={() => setOpen(false)} />}
    </>
  );
}

/** زر أعلى الكشف: من لهم ملاحظات في هذا الفصل — للاطلاع عليها دفعة واحدة */
export function ClassNotesButton({ students, notesBy }) {
  const [open, setOpen] = useState(false);
  const withNotes = (students ?? []).filter((s) => notesBy[s.id]?.length);
  if (!withNotes.length) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-pill border border-[#CCF2DB] bg-white px-3 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-tint">
        ملاحظات الطلاب <span className="num">({withNotes.length})</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" onClick={() => setOpen(false)}>
          <div className="card max-h-[80vh] w-full max-w-lg overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">طلاب الفصل الذين لهم ملاحظات</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-muted hover:text-ink">إغلاق</button>
            </div>
            <div className="mt-3 divide-y divide-line">
              {withNotes.map((s) => (
                <div key={s.id} className="py-2.5">
                  <p className="text-sm font-semibold text-ink">{s.full_name}</p>
                  {KIND_ORDER.flatMap((k) => notesBy[s.id].filter((n) => n.kind === k)).map((n) => (
                    <div key={n.id} className="mt-1.5 flex items-start gap-2">
                      <NoteChip kind={n.kind} />
                      <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink">{n.body}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-faint">
              هذه معلومات خاصة بالطلاب: لا تُعرض أمام زملائهم، ولا تُشارك خارج البوابة.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
