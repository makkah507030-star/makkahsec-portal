// src/pages/media/MyMediaTeam.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import NoPhotoList from "./NoPhotoList.jsx";

/* =====================================================================
   فريقي الإعلامي للطالب العضو (supabase/media_3.sql): فرعه، وضوابط التصوير، وقائمة
   «لا يُصوَّر» يراجعها قبل كل تصوير.
   ===================================================================== */

const RULES = [
  "أصوّر بأجهزة المدرسة فقط، ولا أصوّر بجوالي الشخصي.",
  "أصوّر في الأماكن والأوقات المأذون بها، وبحضور المشرف أو بإذنه.",
  "أراجع قائمة «لا يُصوَّر» قبل كل تصوير، ولا يظهر أحد منها في أي صورة أو مقطع.",
  "أسلّم المواد للمشرف ولا أحتفظ بنسخة، ولا أنشر شيئًا خارج البوابة.",
];

export default function MyMediaTeam() {
  const [me, setMe] = useState(undefined);
  useEffect(() => { supabase.rpc("media_team_my").then(({ data }) => setMe(data?.[0] ?? null)); }, []);
  if (me === undefined) return <Loader />;
  if (!me) return <p className="card px-4 py-8 text-center text-sm text-muted">لست عضوًا في الفريق الإعلامي.</p>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">فريقي الإعلامي</h1>
        <p className="mt-1 text-sm text-muted">{me.branch ? `فرع ${me.branch} · ` : ""}عضو منذ {fmtDate(me.joined_at)}</p>
      </div>
      <section className="card space-y-2 p-4">
        <p className="text-sm font-semibold text-ink">ضوابط التصوير</p>
        <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed text-muted">{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      </section>
      <section className="space-y-2">
        <p className="text-sm font-semibold text-ink">لا يُصوَّر <span className="font-normal text-muted">— لم يوافق أولياء أمورهم على التصوير هذا العام</span></p>
        <NoPhotoList member />
      </section>
    </div>
  );
}
