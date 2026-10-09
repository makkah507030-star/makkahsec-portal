import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/* =====================================================================
   نشر نتيجة الاختبار القصير (supabase/quiz_publish_1.sql):
   • نشر النتيجة: تظهر الدرجة للطالب وولي أمره في «نتائج الاختبارات القصيرة».
   • التغذية الراجعة: إحصائيات الاختبار في بطاقات مبسطة (درجته، ومتوسط فصله،
     وحال كل فقرة). لا تُتاح إلا مع نشر النتيجة.
   يقرّر المعلم كلًّا منهما، ويستطيع إخفاءه في أي وقت.
   ===================================================================== */

function Switch({ on, disabled, onClick, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors disabled:opacity-40 ${on ? "bg-mint-deep" : "bg-line"}`}>
      <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${on ? "left-[3px]" : "left-[23px]"}`} />
    </button>
  );
}

export default function QuizPublish({ q, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // الإلكتروني الذي اختار معلمه «النتيجة فور التسليم» ظاهرٌ دون نشر
  const [immediate, setImmediate] = useState(false);
  useEffect(() => {
    if (q.mode !== "online") return;
    supabase.from("quiz_online").select("show_result").eq("quiz_id", q.id).maybeSingle()
      .then(({ data }) => setImmediate(!!data?.show_result));
  }, [q.id, q.mode]);
  const pub = !!q.results_published;
  const fb = !!q.feedback_enabled;

  const save = async (fields) => {
    setBusy(true); setErr("");
    const { error } = await supabase.from("quizzes").update(fields).eq("id", q.id);
    setBusy(false);
    if (error) {
      setErr(/results_published|feedback_enabled|schema cache/i.test(error.message)
        ? "لم يُفعَّل نشر النتائج بعد في قاعدة البيانات." : error.message);
      return;
    }
    onChange?.(fields);
  };

  const togglePub = () => save(pub
    ? { results_published: false, feedback_enabled: false }
    : { results_published: true, results_published_at: new Date().toISOString(),
        ...(q.status === "ready" ? { status: "marking" } : {}) });

  const rows = [
    { k: "pub", on: pub, t: "نشر النتيجة للطلاب وأولياء الأمور",
      d: pub ? "الدرجة ظاهرة الآن في صفحة الطالب وولي أمره."
        : immediate ? "اخترت إظهار النتيجة فور التسليم، فالدرجة ظاهرة للطالب. انشرها لتتيح التغذية الراجعة."
        : "لا يرى الطالب درجته حتى تنشرها.",
      click: togglePub },
    { k: "fb", on: fb, t: "إتاحة التغذية الراجعة",
      d: !pub ? "تُتاح بعد نشر النتيجة." : fb
        ? "يرى الطالب درجته مقارنة بمتوسط فصله، وحال كل فقرة، دون مفتاح الإجابة."
        : "إحصائيات الاختبار في بطاقات مبسطة: درجته، ومتوسط فصله، وحال كل فقرة.",
      click: () => save({ feedback_enabled: !fb }), disabled: !pub },
  ];

  return (
    <section className="no-print card overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-ink">نتيجة الاختبار للطلاب</p>
      </div>
      {rows.map((r) => (
        <div key={r.k} className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3 last:border-b-0">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${r.disabled ? "text-faint" : "text-ink"}`}>{r.t}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{r.d}</p>
          </div>
          <Switch on={r.on} disabled={busy || r.disabled} onClick={r.click} label={r.t} />
        </div>
      ))}
      {err && <p className="border-t border-line px-4 py-2 text-xs text-absent">{err}</p>}
    </section>
  );
}
