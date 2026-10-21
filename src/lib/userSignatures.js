// src/lib/userSignatures.js
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/* =====================================================================
   توقيعات الموقّعين بالاسم — للتقارير المطبوعة التي تكتب اسم الموقّع
   (الموجه الطلابي، الوكيل، رئيس القسم…) لا حسابه.
   يُطابَق الاسم مع حسابات المعلمين والإداريين، ثم يُجلب توقيعه المرفوع من
   «توقيعي» (user_signatures). توقيعات أصحاب الأدوار الإدارية متاحة لكل
   منسوبي المدرسة، وتوقيع المعلم لصاحبه ولمديري النماذج؛ وما لا يُسمح
   بقراءته يبقى خانة توقيع يدوي.
   ===================================================================== */

/** توحيد الاسم للمطابقة: الهمزات والتاء المربوطة والياء، وحذف «بن» والمسافات الزائدة */
export function normName(s) {
  return String(s ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .split(/\s+/).filter((w) => w && w !== "بن" && w !== "ابن").join(" ");
}

const TTL = 50 * 60 * 1000;
let cache = null; // { at, promise: Map(normName → url) }

async function loadAll() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Map();
  // توقيعات يحق لي قراءتها: توقيعي (والجميع لمدير النماذج)، وتوقيعات أصحاب
  // الأدوار الإدارية لكل منسوبي المدرسة (supabase/staff_signatures_read.sql)
  const [{ data: own }, { data: staff }] = await Promise.all([
    supabase.from("user_signatures").select("user_id, path"),
    supabase.rpc("staff_signatures"),
  ]);
  const byUser = new Map();
  [...(staff ?? []), ...(own ?? [])].forEach((s) => byUser.set(s.user_id, s));
  const sigs = [...byUser.values()];
  if (!sigs.length) return new Map();
  const nameBy = new Map((staff ?? []).map((s) => [s.user_id, s.full_name]));
  const missing = sigs.map((s) => s.user_id).filter((id) => !nameBy.has(id));
  if (missing.length) {
    const { data: users } = await supabase.from("users").select("id, full_name").in("id", missing);
    (users ?? []).forEach((u) => nameBy.set(u.id, u.full_name));
  }
  // المستخدم يقرأ صفّه دائمًا؛ وإن حُجب الاسم احتياطًا نأخذه من ملفه
  if (!nameBy.has(user.id)) {
    const { data: me } = await supabase.from("users").select("full_name").eq("id", user.id).maybeSingle();
    if (me) nameBy.set(user.id, me.full_name);
  }
  // روابط موقّعة دفعة واحدة؛ ما لا يحق للمستخدم قراءته يعود بلا رابط
  const named = sigs.filter((s) => s.path && normName(nameBy.get(s.user_id)));
  const { data: links } = named.length
    ? await supabase.storage.from("form-assets").createSignedUrls(named.map((s) => s.path), 3600)
    : { data: [] };
  const out = new Map();
  named.forEach((s, i) => {
    const url = links?.[i]?.signedUrl;
    if (url) out.set(normName(nameBy.get(s.user_id)), url);
  });
  // توقيعي باسمي في جدول المعلمين أيضًا: كشوف المعلم (رصد الدرجات وسجل المتابعة) تكتب اسمه من
  // جدول المعلمين، وقد يختلف عن اسم حسابه (ثلاثي ورباعي أو بإملاء آخر) فيضيع توقيعه
  const mine = out.get(normName(nameBy.get(user.id)));
  if (mine) {
    const { data: t } = await supabase.from("teachers").select("full_name").eq("user_id", user.id).maybeSingle();
    if (normName(t?.full_name)) out.set(normName(t.full_name), mine);
  }
  return out;
}

/** رابط توقيع صاحب الاسم، أو null إن لم يرفع توقيعًا أو لا يحق للمستخدم رؤيته */
export async function signatureByName(name) {
  const n = normName(name);
  if (!n) return null;
  if (!cache || Date.now() - cache.at > TTL) cache = { at: Date.now(), promise: loadAll().catch(() => new Map()) };
  return (await cache.promise).get(n) ?? null;
}

/** يُستدعى بعد رفع توقيع جديد ليظهر فورًا */
export function clearSignatureCache() { cache = null; }

/** خطّاف React: رابط التوقيع المعطى، وإلا توقيع صاحب الاسم إن أمكن */
export function useSignatureByName(name, url) {
  const [found, setFound] = useState(null);
  useEffect(() => {
    if (url || !name) { setFound(null); return; }
    let alive = true;
    signatureByName(name).then((u) => { if (alive) setFound(u); });
    return () => { alive = false; };
  }, [name, url]);
  return url || found;
}

/** خطّاف React: صور توقيعات أشخاص بحساباتهم — Map(user_id → رابط) لمن رفع توقيعه
 *  ويحق للمستخدم رؤيته (supabase/pd_signer_signatures.sql)، ومن لا صورة له لا يُدرج */
export function useSignerImages(userIds) {
  const key = [...new Set((userIds ?? []).filter(Boolean))].sort().join(",");
  const [map, setMap] = useState(() => new Map());
  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc("signer_signatures", { p_users: key.split(",") });
      if (error || !data?.length) return;
      const { data: links } = await supabase.storage.from("form-assets").createSignedUrls(data.map((s) => s.path), 3600);
      const out = new Map();
      data.forEach((s, i) => { const u = links?.[i]?.signedUrl; if (u) out.set(s.user_id, u); });
      if (alive) setMap(out);
    })().catch(() => {});
    return () => { alive = false; };
  }, [key]);
  return map;
}

