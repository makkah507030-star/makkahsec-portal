import { useEffect, useState } from "react";
import { useSession } from "../lib/session.jsx";
import { loadPerfReference, sendFormToFile } from "../lib/performance";

/* =====================================================================
   «إرسال إلى ملف الشواهد» — يظهر للمعلم على نموذج صادر من إصداره.
   يختار البند؛ أول إرسال يصبح شاهد البند، وما بعده يزيد عداده.
   في بنود سجل التطوير المهني يُضاف كل نموذج مشاركةً مستقلة.
   ===================================================================== */

const DONE = ["draft", "pending", "rejected"];

export default function SendToFile({ doc }) {
  const { session, profile, isTeacher } = useSession();
  const [elements, setElements] = useState(null);
  const [item, setItem] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const teacher = isTeacher || profile?.role === "teacher";
  const mine = doc?.created_by === session?.user?.id && !DONE.includes(doc?.status);

  useEffect(() => {
    if (!teacher || !mine) return;
    loadPerfReference().then((els) => setElements(els.filter((e) => !e.evaluator_only)), () => setElements([]));
  }, [teacher, mine]);

  useEffect(() => { setMsg(null); setItem(""); }, [doc?.id]);

  if (!teacher || !mine || !elements?.length) return null;

  const send = async () => {
    if (!item) { setMsg({ ok: false, text: "اختر البند أولًا." }); return; }
    setBusy(true); setMsg(null);
    try {
      const n = await sendFormToFile(doc.id, item);
      setMsg({ ok: true, text: `أُضيف إلى ملفك · العداد ${n}` });
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
