// src/pages/media/MyMediaTeam.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import NoPhotoList from "./NoPhotoList.jsx";
import MediaPressCard, { TeamStrength } from "../../components/MediaPressCard.jsx";
import { useSession } from "../../lib/session.jsx";

/* =====================================================================
   فريقي الإعلامي للطالب العضو وقائد الفريق من المعلمين (supabase/media_3.sql وmedia_4.sql):
   البطاقة الإعلامية وقوة الفريق، وضوابط التصوير، وقائمة «لا يُصوَّر» يراجعها قبل كل تصوير.
   ===================================================================== */

const RULES = [
  "أصوّر بأجهزة المدرسة فقط، ولا أصوّر بجوالي الشخصي.",
  "أصوّر في الأماكن والأوقات المأذون بها، وبحضور المشرف أو بإذنه.",
  "أراجع قائمة «لا يُصوَّر» قبل كل تصوير، ولا يظهر أحد منها في أي صورة أو مقطع.",
  "أسلّم المواد للمشرف ولا أحتفظ بنسخة، ولا أنشر شيئًا خارج البوابة.",
];

export default function MyMediaTeam() {
  const { session, can } = useSession();
  const [me, setMe] = useState(undefined);
  const [year, setYear] = useState("");
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    supabase.rpc("media_card_me").then(({ data }) => setMe(data ?? null));
    supabase.rpc("media_year").then(({ data }) => setYear(data ? `${data}هـ` : ""));
  }, []);
  // صورة القائد من صورة حسابه (staff_avatars.sql)؛ والطالب برمز الكاميرا
  useEffect(() => {
    if (me?.kind !== "staff" || !session?.user?.id) return;
    supabase.from("users").select("avatar_path").eq("id", session.user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_path) setPhoto(supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data.publicUrl);
    });
  }, [me?.kind, session?.user?.id]);
  if (me === undefined) return <Loader />;
  if (!me) return <p className="card px-4 py-8 text-center text-sm text-muted">لست عضوًا في الفريق الإعلامي.</p>;
  const staff = me.kind === "staff";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">فريقي الإعلامي</h1>
        <p className="mt-1 text-sm text-muted">{staff ? me.role : `فرع ${me.role}`} · منذ {fmtDate(me.joined_at)}</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <MediaPressCard c={me} photo={photo} year={year} />
        <TeamStrength c={me} />
      </div>
      <section className="card space-y-2 p-4">
        <p className="text-sm font-semibold text-ink">ضوابط التصوير</p>
        <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed text-muted">{RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      </section>
      {(!staff || can("media")) && (
        <section className="space-y-2">
          <p className="text-sm font-semibold text-ink">لا يُصوَّر <span className="font-normal text-muted">— لم يوافق أولياء أمورهم على التصوير هذا العام</span></p>
          <NoPhotoList member={!staff} />
        </section>
      )}
    </div>
  );
}
