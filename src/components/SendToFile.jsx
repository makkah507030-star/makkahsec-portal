import { useEffect, useState } from "react";
import { useSession } from "../lib/session.jsx";
import { supabase } from "../lib/supabase";
import { loadPerfReference, sendFormToFile } from "../lib/performance";

/* =====================================================================
   «إرسال إلى ملف الشواهد» — يظهر للمعلم على نموذج صادر من إصداره، وعلى
   الشهادة الصادرة باسمه (حضور ورشة، شكر وتقدير) ليحتسبها شاهدًا في ملفه.
   يختار البند؛ أول إرسال يصبح شاهد البند، وما بعده يزيد عداده.
   في بنود سجل التطوير المهني يُضاف كل نموذج مشاركةً مستقلة.
   لا يظهر الزر لما يُحتسب تلقائيًا، وتظهر مكانه عبارة بذلك:
   • شهادة أصدرها المعلم لطالب (بند e05_10 في perf_auto_counts).
   • شهادة احتُسبت آليًا للمستلِم (cert_auto_evidence، مثل حضور الورشة) أو أُرسلت من قبل
     (لها شاهد في perf_evidence).
   ===================================================================== */

const DONE = ["draft", "pending", "rejected"];

export default function SendToFile({ doc }) {
  const { session, profile, isTeacher } = useSession();
  const [elements, setElements] = useState(null);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [auto, setAuto] = useState(null);   // نص «محتسب تلقائيًا» أو "" (يظهر الزر)، وnull أثناء الفحص

  const teacher = isTeacher || profile?.role === "teacher";
  const uid = session?.user?.id;
  // المُصدِر: أي نموذج من إصداره. المستلِم: الشهادة الصادرة باسمه فقط.
  const isCert = doc?.form_templates?.category === "certificate";
  const mine = !DONE.includes(doc?.status) &&
    (doc?.created_by === uid || (doc?.recipient_user_id === uid && isCert));

  useEffect(() => {
    if (!teacher || !mine) return;
    loadPerfReference().then((els) => setElements(els.filter((e) => !e.evaluator_only)), () => setElements([]));
  }, [teacher, mine]);

  useEffect(() => { setMsg(null); setItem(""); }, [doc?.id]);

  // هل الشاهد محتسب في الملف تلقائيًا أو مرسل من قبل؟
  useEffect(() => {
    if (!teacher || !mine) return;
    let live = true;
    setAuto(null);
    (async () => {
      if (isCert && doc.created_by === uid && doc.student_id) {
        live && setAuto("الشهادات التي تصدرها لطلابك تُحتسب تلقائيًا في ملف شواهدك (بند «شهادات أصدرتها لطلابك»).");
        return;
      }
      const [{ data: ev }, { data: ca }] = await Promise.all([
        supabase.from("perf_evidence").select("id").eq("teacher_user_id", uid)
          .or(`form_document_id.eq.${doc.id},form_docs.cs.{${doc.id}}`).limit(1),
        doc.recipient_user_id === uid && doc.form_templates?.key
          ? supabase.from("cert_auto_evidence").select("template_key").eq("template_key", doc.form_templates.key).eq("is_active", true).limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      if (!live) return;
      setAuto(ev?.length ? "هذا النموذج محتسب في ملف شواهدك."
        : ca?.length ? "هذه الشهادة تُحتسب تلقائيًا في ملف شواهدك فور صدورها."
        : "");
    })();
    return () => { live = false; };
  }, [teacher, mine, doc?.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!teacher || !mine || auto === null) return null;
  if (auto) return <p className="no-print rounded-sm2 bg-mint/10 px-3 py-2 text-xs text-mint-deep">✓ {auto}</p>;
  if (!elements?.length) return null;

  const send = async () => {
    if (!item) { setMsg({ ok: false, text: "اختر البند أولًا." }); return; }
    setBusy(true); setMsg(null);
    try {
      const n = await sendFormToFile(doc.id, item);
      setMsg({ ok: true, text: `أُضيف إلى ملفك · العداد ${n}` });
      setTimeout(() => setAuto("هذا النموذج محتسب في ملف شواهدك."), 1800);
    } catch (e) {
      setMsg({ ok: false, text: e.message ?? "تعذّر الإرسال." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="no-print space-y-2 rounded-sm2 border border-mint/40 bg-mint/10 px-3 py-2.5 text-sm">
      <p className="font-semibold text-mint-deep">إرسال إلى ملف الشواهد</p>
      <select className="field" value={item} onChange={(e) => setItem(e.target.value)}>
        <option value="">اختر البند الذي يشهد له هذا النموذج…</option>
        {elements.map((el) => (
          <optgroup key={el.key} label={el.title}>
            {el.items.map((it) => <option key={it.key} value={it.key}>{it.title}</option>)}
          </optgroup>
        ))}
      </select>
      <button className="btn-primary w-full" onClick={send} disabled={busy}>
        {busy ? "جارٍ الإرسال…" : "إرسال إلى ملف الشواهد"}
      </button>
      {msg && (
        <p className={`rounded-sm2 px-3 py-2 ${msg.ok ? "bg-mint-light text-mint-deep" : "bg-danger-light text-danger"}`}>{msg.text}</p>
      )}
    </div>
  );
}
