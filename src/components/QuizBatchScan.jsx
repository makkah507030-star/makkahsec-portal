// src/components/QuizBatchScan.jsx
import { useMemo, useRef, useState } from "react";
import { rowsToAnswers } from "../lib/omrLayout.js";
import { cardLayouts, readCardFile } from "../lib/omrScan.js";
import { hashIndex } from "../lib/omrCode.js";
import { saveQuizCard } from "../lib/quizCards.js";
import { CardRows } from "./QuizScan.jsx";

/* =====================================================================
   التصحيح الجماعي لبطاقات الإجابة.
   يختار المعلم صور بطاقات الفصل كلها دفعة واحدة، فتُقرأ واحدة بعد أخرى داخل
   الجهاز (لا تُرفع الصور)، ويُعرف صاحب كل بطاقة من رمزه المطبوع (lib/omrCode.js).
   ما قُرئ بوضوح لطالب معروف لم يُرصد بعد يُحفظ ويُصحَّح فورًا، وما سواه يبقى في
   قائمة «تحتاج مراجعة» ليراجعه المعلم ويختار الطالب ويحفظ. وفي الأسفل من لم تصل
   بطاقته، ليُسجَّل غيابه.
   ===================================================================== */

let seq = 0;

export default function QuizBatchScan({ quiz, questions, students, subs, onSave, onAbsent, onClose }) {
  const ltr = quiz?.lang === "en";
  const shapes = useMemo(() => cardLayouts(questions, ltr), [questions, ltr]);
  const byHash = useMemo(() => hashIndex(students), [students]);
  const before = useRef(subs);          // المرصودون قبل هذه الدفعة: لا يُستبدل رصدهم آليًا
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const running = useRef(false);
  const [open, setOpen] = useState(null);        // البطاقة المفتوحة للمراجعة
  const galRef = useRef(null);
  const camRef = useRef(null);

  const update = (id, patch) => {
    itemsRef.current = itemsRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x));
    setItems(itemsRef.current);
  };

  const add = (files) => {
    const list = [...(files ?? [])].map((file) => ({ id: ++seq, file, name: file.name, state: "queued" }));
    if (!list.length) return;
    itemsRef.current = [...itemsRef.current, ...list];
    setItems(itemsRef.current);
    run();
  };

  // المعالجة واحدة بعد أخرى حتى لا يثقل الجوال
  const run = async () => {
    if (running.current) return;
    running.current = true;
    for (;;) {
      const it = itemsRef.current.find((x) => x.state === "queued");
      if (!it) break;
      update(it.id, { state: "reading" });
      try {
        await handle(it);
      } catch (e) {
        update(it.id, { state: "error", reason: e?.message || "تعذّرت قراءة الصورة." });
      }
    }
    running.current = false;
  };

  const handle = async (it) => {
    const r = await readCardFile(it.file, shapes);
    if (!r.ok) { update(it.id, { state: "error", reason: r.error, file: null }); return; }
    const { layout, result } = r;
    const h = result.studentHash;
    const owner = h != null ? byHash.get(h) : undefined;
    const taken = owner && itemsRef.current.some((x) => x.id !== it.id && x.student?.id === owner.id
      && ["saved", "review"].includes(x.state));
    const unsure = result.rows.filter((x) => x.status === "faint" || x.status === "multi").length;
    const reason =
        h == null ? "بطاقة بلا رمز طالب (طُبعت بلا أسماء): اختر الطالب."
      : owner === undefined ? "رمز البطاقة لطالب ليس في هذا الفصل."
      : owner === null ? "تعذّر تمييز الطالب من الرمز: اختره."
      : taken ? "صورة أخرى لبطاقة الطالب نفسه."
      : before.current[owner.id] ? "مرصود قبل هذه الدفعة: الحفظ يستبدل رصده."
      : unsure ? `تظليل يحتاج تأكيدًا في ${unsure} ${unsure === 1 ? "فقرة" : "فقرات"}.`
      : null;
    if (reason) {
      update(it.id, { state: "review", reason, student: owner || null, layout, result, picks: result.picks, file: null });
      return;
    }
    const fresh = await onSave(owner, rowsToAnswers(layout.rows, result.picks));
    await saveQuizCard(quiz.id, fresh, result.preview);
    update(it.id, { state: "saved", student: owner, score: fresh?.score ?? null, result: null, file: null,
                    blanks: result.rows.filter((x) => x.status === "blank").length });
  };

  const [busy, setBusy] = useState(false);
  const saveReviewed = async (it) => {
    if (!it.student) return;
    setBusy(true);
    const fresh = await onSave(it.student, rowsToAnswers(it.layout.rows, it.picks));
    await saveQuizCard(quiz.id, fresh, it.result?.preview);
    setBusy(false);
    update(it.id, { state: "saved", score: fresh?.score ?? null, result: null, reason: null });
    setOpen(null);
  };

  // من وصلت بطاقته (محفوظة أو بانتظار المراجعة) لا يُعدّ غائبًا
  const savedIds = new Set(items.filter((x) => ["saved", "review"].includes(x.state)).map((x) => x.student?.id));
  const missing = students.filter((s) => !subs[s.id] && !savedIds.has(s.id));
  const count = (st) => items.filter((x) => x.state === st).length;
  const pending = count("queued") + count("reading");
  const reviewing = items.find((x) => x.id === open);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas" dir="rtl">
      <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
        <button onClick={onClose} disabled={pending > 0} className="text-sm font-semibold text-muted disabled:opacity-40">إغلاق</button>
        <div className="min-w-0 flex-1 text-center">
          <p className="text-sm font-bold text-ink">التصحيح الجماعي</p>
          <p className="text-[11px] text-muted">
            حُفظ <span className="num">{count("saved")}</span> · يحتاج مراجعة <span className="num">{count("review")}</span>
            {count("error") > 0 && <> · لم تُقرأ <span className="num">{count("error")}</span></>}
            {pending > 0 && <> · جارٍ <span className="num">{pending}</span></>}
          </p>
        </div>
        <span className="w-10" />
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-3 overflow-y-auto p-4">
        {reviewing ? (
          <ReviewCard it={reviewing} students={students} subs={subs} ltr={ltr} busy={busy}
                      onPick={(k, v) => update(reviewing.id, { picks: { ...reviewing.picks, [k]: reviewing.picks[k] === v ? null : v } })}
                      onStudent={(s) => update(reviewing.id, { student: s })}
                      onSave={() => saveReviewed(reviewing)}
                      onDiscard={() => { update(reviewing.id, { state: "discarded", result: null }); setOpen(null); }}
                      onBack={() => setOpen(null)} />
        ) : (
          <>
            <section className="card space-y-3 p-4 text-center">
              <p className="text-sm leading-relaxed text-muted">
                صوّر بطاقات الفصل كلها أولًا بكاميرا الجوال، ثم اخترها هنا <b className="text-ink">دفعة واحدة</b>.
                تُعرف كل بطاقة من <b className="text-ink">رمز الطالب</b> المطبوع فيها (أوراق «بأسماء الطلاب»)، وتُصحَّح وتُحفظ.
              </p>
              <input ref={galRef} type="file" accept="image/*" multiple className="hidden"
                     onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
                     onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
              <button className="btn-primary w-full py-3 text-base" onClick={() => galRef.current?.click()}>
                🖼️ اختيار صور البطاقات
              </button>
              <button className="w-full rounded-pill border border-line py-2 text-sm text-muted" onClick={() => camRef.current?.click()}>
                📷 تصوير بطاقة وإضافتها
              </button>
              <p className="text-[11px] text-faint">تُقرأ الصور داخل جهازك ولا تُرفع لأي خادم.</p>
            </section>

            {count("review") > 0 && (
              <section className="card overflow-hidden">
                <p className="border-b border-line bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">تحتاج مراجعة</p>
                <div className="divide-y divide-line">
                  {items.filter((x) => x.state === "review").map((x) => (
                    <div key={x.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{x.student?.full_name ?? "طالب غير محدد"}</p>
                        <p className="text-xs text-warning">{x.reason}</p>
                      </div>
                      <button className="shrink-0 rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                              onClick={() => setOpen(x.id)}>مراجعة</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {count("error") > 0 && (
              <section className="card overflow-hidden">
                <p className="border-b border-line bg-absent/10 px-4 py-2 text-sm font-semibold text-absent">لم تُقرأ — أعد تصويرها</p>
                <div className="divide-y divide-line">
                  {items.filter((x) => x.state === "error").map((x) => (
                    <p key={x.id} className="px-4 py-2 text-xs text-muted"><span className="font-medium text-ink">{x.name}</span>: {x.reason}</p>
                  ))}
                </div>
              </section>
            )}

            {count("saved") > 0 && (
              <section className="card overflow-hidden">
                <p className="border-b border-line bg-present/10 px-4 py-2 text-sm font-semibold text-present">حُفظت وصُحّحت</p>
                <div className="divide-y divide-line">
                  {items.filter((x) => x.state === "saved").map((x) => (
                    <div key={x.id} className="flex items-center gap-3 px-4 py-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-ink">{x.student?.full_name}</p>
                      {x.blanks > 0 && <span className="text-[11px] text-muted">بلا إجابة: <span className="num">{x.blanks}</span></span>}
                      <span className="num shrink-0 text-sm font-bold text-mint-deep">{x.score ?? "—"} / {quiz?.total_marks}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {items.length > 0 && pending === 0 && missing.length > 0 && (
              <section className="card overflow-hidden">
                <p className="border-b border-line px-4 py-2 text-sm font-semibold text-ink">
                  لم تصل بطاقتهم (<span className="num">{missing.length}</span>)
                </p>
                <div className="divide-y divide-line">
                  {missing.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2">
                      <p className="min-w-0 flex-1 truncate text-sm text-ink">{s.full_name}</p>
                      <button className="shrink-0 rounded-pill border border-absent/40 px-3 py-1 text-xs font-semibold text-absent"
                              onClick={() => onAbsent(s)}>غائب</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ it, students, subs, ltr, busy, onPick, onStudent, onSave, onDiscard, onBack }) {
  return (
    <>
      <button onClick={onBack} className="text-sm text-muted">← القائمة</button>
      <p className="rounded-card bg-warning/10 px-3 py-2 text-sm text-warning">{it.reason}</p>
      <section className="card overflow-hidden p-2">
        <img src={it.result.preview} alt="البطاقة كما قُرئت" className="w-full rounded-sm2" />
      </section>
      <section className="card space-y-1.5 p-3">
        <label className="text-xs text-muted">الطالب صاحب البطاقة</label>
        <select className="field w-full" value={it.student?.id ?? ""}
                onChange={(e) => onStudent(students.find((s) => s.id === e.target.value) ?? null)}>
          <option value="">اختر الطالب…</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.full_name}{subs[s.id] ? " ✓ (مرصود)" : ""}</option>
          ))}
        </select>
      </section>
      <CardRows layout={it.layout} result={it.result} picks={it.picks} toggle={onPick} ltr={ltr} />
      <div className="sticky bottom-0 flex gap-2 bg-canvas pb-2 pt-1">
        <button className="btn-primary flex-1 py-3" disabled={busy || !it.student} onClick={onSave}>
          {busy ? "جارٍ الحفظ…" : "حفظ وتصحيح"}
        </button>
        <button className="rounded-pill border border-line px-4 text-sm text-muted" disabled={busy} onClick={onDiscard}>
          تجاهل الصورة
        </button>
      </div>
    </>
  );
}
