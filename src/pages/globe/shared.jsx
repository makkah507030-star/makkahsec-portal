// src/pages/globe/shared.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { shrinkImage } from "../../lib/imageResize.js";
import { GLOBE_BUCKET } from "../../lib/globe.js";

/* أدوات مشتركة بين خطة البرنامج وخطة الرصد (supabase/globe_2.sql) */

export const MAX_PHOTOS = 3;
export const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
export const setupErr = (e) => (/globe_|schema cache|relation|bucket/i.test(e?.message ?? "")
  ? "لم تُفعَّل الخطة بعد: يلزم تشغيل ملف supabase/globe_2.sql مرة واحدة في Supabase ← SQL Editor." : e?.message);

export async function activeTerm() {
  const { data } = await supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"]);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return { academic_year: m.active_year ?? null, term: Number(m.active_term ?? 1) };
}

/** يرفع الصور مصغّرة إلى globe-files/<folder>/<id>/ ويعيد مساراتها */
export async function uploadPhotos(folder, id, files, have = []) {
  const paths = [...have];
  for (const f of files.slice(0, MAX_PHOTOS - paths.length)) {
    const img = await shrinkImage(f, 1600, 0.8, { jpeg: true });
    const path = `${folder}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
    const { error } = await supabase.storage.from(GLOBE_BUCKET).upload(path, img, { contentType: "image/jpeg" });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

/** روابط موقّتة لصور القائمة كلها بطلب واحد: مسار ← رابط */
export function useSignedPhotos(rows) {
  const [map, setMap] = useState(null);
  const key = (rows ?? []).flatMap((r) => r.photos ?? []).join("|");
  useEffect(() => {
    let live = true;
    const paths = key ? key.split("|") : [];
    if (!paths.length) { setMap(new Map()); return undefined; }
    supabase.storage.from(GLOBE_BUCKET).createSignedUrls(paths, 3600).then(({ data }) => {
      if (live) setMap(new Map(paths.map((p, i) => [p, data?.[i]?.signedUrl ?? null])));
    });
    return () => { live = false; };
  }, [key]);
  return map;
}

export function Thumbs({ paths, urls }) {
  if (!paths?.length) return null;
  return (
    <div className="mt-2.5 flex gap-2">
      {paths.map((ph, i) => (
        <a key={ph} href={urls?.get(ph) ?? undefined} target="_blank" rel="noopener noreferrer" title={`صورة ${i + 1}`}
           className="grid h-20 w-28 place-items-center overflow-hidden rounded-sm2 border border-line bg-canvas">
          {urls?.get(ph) ? <img src={urls.get(ph)} alt="" className="h-full w-full object-cover" />
                         : <span className="text-xs text-muted">صورة {i + 1}</span>}
        </a>
      ))}
    </div>
  );
}

// مؤشرات أعلى الخطة: أرقام ثم شريط نسبة التنفيذ
export function Stats({ items, ratio, label }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
        {items.map(([t, v, c]) => (
          <div key={t} className="bg-paper px-4 py-3 text-center">
            <p className={`num text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-[11.5px] text-muted">{t}</p>
          </div>
        ))}
      </div>
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{label}</span><span className="num font-bold text-mint-deep">{ratio}%</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-canvas">
          <div className="h-full rounded-full bg-mint-deep transition-all" style={{ width: `${ratio}%` }} />
        </div>
      </div>
    </>
  );
}
