// src/components/StaffHeader.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../lib/session.jsx";
import { shrinkImage } from "../lib/imageResize";
import { NameCard } from "./StudentHeader.jsx";

/* =====================================================================
   بطاقة الاسم للمعلم والإداري أعلى الرئيسية (بهوية الاستوديو كبطاقة الطالب):
   رمز السبورة للمعلم والحقيبة للإداري، أو صورته إن رفعها بالضغط على الرمز
   (supabase/staff_avatars.sql)، وتحت الاسم تخصصه أو أدواره.
   ===================================================================== */
const AVATARS = "avatars";

export default function StaffHeader({ kicker = null }) {
  const { session, profile, effectiveRole, adminRoles = [] } = useSession();
  const uid = session?.user?.id;
  const teacherView = effectiveRole === "teacher";
  const [avatar, setAvatar] = useState(null);
  const [spec, setSpec] = useState("");
  const [ready, setReady] = useState(false);   // العمود موجود (بعد تشغيل ملف SQL)
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) return;
    // الصورة من عمود avatar_path؛ قبل تشغيل ملفها يفشل الطلب بصمت فلا يظهر زر الرفع
    supabase.from("users").select("avatar_path").eq("id", uid).maybeSingle().then(({ data, error }) => {
      if (error) return;
      setReady(true);
      if (data?.avatar_path) setAvatar(supabase.storage.from(AVATARS).getPublicUrl(data.avatar_path).data.publicUrl);
    });
    if (teacherView) supabase.from("teachers").select("specialization").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setSpec(data?.specialization ?? ""));
  }, [uid, teacherView]);

  const pick = async (file) => {
    setBusy(true); setErr("");
    try {
      const img = await shrinkImage(file, 480, 0.85, { jpeg: true });
      const path = `${uid}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(AVATARS).upload(path, img, { contentType: "image/jpeg" });
      if (error) throw error;
      const { error: e2 } = await supabase.rpc("set_my_avatar", { p_path: path });
      if (e2) throw e2;
      setAvatar(supabase.storage.from(AVATARS).getPublicUrl(path).data.publicUrl);
    } catch (e) { setErr(`تعذّر رفع الصورة: ${e.message}`); }
    setBusy(false);
  };

  const chips = teacherView
    ? [{ t: "معلم", strong: true }, spec && { t: spec }].filter(Boolean)
    : adminRoles.map((r, i) => ({ t: ADMIN_ROLE_LABEL[r] ?? r, strong: i === 0 })).slice(0, 3);

  return (
    <div className="space-y-1">
      <NameCard name={profile?.full_name ?? profile?.username} kicker={kicker} icon={teacherView ? "teacher" : "admin"}
                chips={chips} avatar={avatar} onPick={ready ? pick : null} busy={busy} />
      {err && <p className="text-xs text-absent">{err}</p>}
    </div>
  );
}
