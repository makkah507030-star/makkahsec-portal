import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { CARDS_BUCKET } from "../lib/quizCards.js";
import { confirmDanger } from "../lib/danger";

/* =====================================================================
   حذف صور بطاقات الإجابة بنهاية الفصل — للدعم الفني (supabase/quiz_cards_2.sql).
   يعرض عدد الصور وحجمها، ويحذف صور الفصول السابقة لكل المعلمين من المخزن،
   وتبقى الدرجات والإجابات.
   ===================================================================== */

const size = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} م.ب` : `${kb} ك.ب`);
// الرقم معزول باتجاهه، والوحدة بعده بالعربية
const Size = ({ kb }) => (kb >= 1024
  ? <><bdi className="num">{(kb / 1024).toFixed(1)}</bdi> م.ب</> : <><bdi className="num">{kb}</bdi> ك.ب</>);

export default function QuizCardsCleanup() {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  const load = () => supabase.rpc("quiz_cards_stats").then(({ data, error }) => {
    if (error) setErr(/quiz_cards_stats|schema cache/i.test(error.message)
      ? "يلزم تشغيل ملفي supabase/quiz_cards.sql وquiz_cards_2.sql." : error.message);
    else setSt(data?.[0] ?? { total: 0, total_kb: 0, old: 0, old_kb: 0 });
  });
  useEffect(() => { load(); }, []);

  const purge = async () => {
    if (!(await confirmDanger({
      title: "حذف صور بطاقات الإجابة للفصول السابقة",
      impact: [`تُحذف ${st.old} صورة نهائيًا (${size(st.old_kb)}) لكل المعلمين.`,
               "تبقى الدرجات والإجابات، ولا تظهر الصورة بعدها للمعلم ولا للطالب."],
      level: "high", confirmLabel: "حذف الصور",
    }))) return;
    setBusy(true); setDone(""); setErr("");
    const { data, error } = await supabase.rpc("quiz_cards_old");
    if (error) { setBusy(false); setErr(error.message); return; }
    let n = 0;
    for (let i = 0; i < (data ?? []).length; i += 100) {
      const part = data.slice(i, i + 100);
      const { error: e1 } = await supabase.storage.from(CARDS_BUCKET).remove(part.map((r) => r.card_path));
      if (e1) { setErr(e1.message); break; }
      await supabase.rpc("quiz_cards_cleared", { p_ids: part.map((r) => r.id) });
      n += part.length;
    }
    setBusy(false);
    setDone(`حُذفت ${n} صورة.`);
    load();
  };

  return (
    <section className="card space-y-3 p-5">
      <div>
        <p className="text-sm font-bold text-ink">صور بطاقات الإجابة</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          تُحفظ عند التصحيح بالكاميرا للرجوع إليها. احذف صور الفصول السابقة بنهاية كل فصل لتوفير المساحة،
          وتبقى الدرجات والإجابات.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">{err}</p>}
      {st && (
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-sm2 bg-canvas px-2 py-2.5">
            <p className="num text-lg font-bold text-ink">{st.total}</p>
            <p className="text-[11px] text-muted">كل الصور · <Size kb={st.total_kb} /></p>
          </div>
          <div className={`rounded-sm2 px-2 py-2.5 ${st.old ? "bg-warning-light" : "bg-canvas"}`}>
            <p className={`num text-lg font-bold ${st.old ? "text-warning" : "text-ink"}`}>{st.old}</p>
            <p className="text-[11px] text-muted">من الفصول السابقة · <Size kb={st.old_kb} /></p>
          </div>
        </div>
      )}
      {done && <p className="rounded-sm2 bg-present/10 px-3 py-2 text-xs text-present">{done}</p>}
      <button onClick={purge} disabled={busy || !st?.old}
              className="w-full rounded-sm2 bg-absent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40">
        {busy ? "جارٍ الحذف…" : "حذف صور الفصول السابقة"}
      </button>
    </section>
  );
}
