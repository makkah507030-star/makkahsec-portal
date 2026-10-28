// src/pages/media/MediaGallery.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { signedUrls } from "../../lib/media.js";
import Loader from "../../components/Loader.jsx";
import MediaViewer from "./MediaViewer.jsx";

/* =====================================================================
   معرض المدرسة (supabase/media_1.sql): صور المدرسة ومقاطعها لمن نُشرت لفئته وصفّه،
   بالألبومات، وتُفتح داخل البوابة فقط في العارض المحمي (MediaViewer).
   manage: تُستعمل في استوديو الوسائط لعرض كل المواد ومنها غير المنشورة.
   ===================================================================== */

export function useMedia(reloadKey = 0) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase.from("media_items").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (error) setErr(/media_items|schema cache|relation/i.test(error.message) ? "المعرض يحتاج تشغيل supabase/media_1.sql مرة واحدة في Supabase ← SQL Editor." : error.message);
        setRows(data ?? []);
      });
  }, [reloadKey]);
  return { rows, err };
}

export function MediaGrid({ rows, onOpen, extra }) {
  const [thumbs, setThumbs] = useState(new Map());
  const key = rows.map((r) => r.thumb ?? r.path).join("|");
  useEffect(() => {
    let live = true;
    signedUrls(rows.map((r) => r.thumb ?? (r.kind === "photo" ? r.path : null))).then((m) => { if (live) setThumbs(m); });
    return () => { live = false; };
  }, [key]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((r, i) => (
        <div key={r.id} className="overflow-hidden rounded-card border border-line bg-paper">
          <button className="relative block aspect-[4/3] w-full bg-canvas" onClick={() => onOpen(i)} onContextMenu={(e) => e.preventDefault()}>
            {thumbs.get(r.thumb ?? r.path) ? <img src={thumbs.get(r.thumb ?? r.path)} alt="" draggable={false} className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center text-xs text-muted">{r.kind === "video" ? "مقطع" : "صورة"}</span>}
            {r.kind === "video" && <span className="absolute inset-0 grid place-items-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg text-white">▶</span></span>}
            {!r.published && <span className="absolute right-1.5 top-1.5 rounded-pill bg-late px-2 py-0.5 text-[10px] font-bold text-white">مخفية</span>}
          </button>
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-semibold text-ink">{r.title}</p>
            {r.album && <p className="truncate text-[11px] text-muted">{r.album}</p>}
            {extra?.(r)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MediaGallery() {
  const { rows, err } = useMedia();
  const [album, setAlbum] = useState("all");
  const [kind, setKind] = useState("all");
  const [open, setOpen] = useState(null);
  const albums = useMemo(() => [...new Set((rows ?? []).map((r) => r.album).filter(Boolean))], [rows]);
  if (!rows) return <Loader />;
  const shown = rows.filter((r) => r.published && (album === "all" || r.album === album) && (kind === "all" || r.kind === kind));
  const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">معرض المدرسة</h1>
        <p className="mt-1 text-sm text-muted">صور المدرسة ومقاطعها من فعالياتها وبرامجها، تُعرض داخل البوابة فقط، ولا يُسمح بنشرها خارجها.</p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[["all", "الكل"], ["photo", "الصور"], ["video", "المقاطع"]].map(([k, t]) => <button key={k} className={pill(kind === k)} onClick={() => setKind(k)}>{t}</button>)}
          {albums.length > 0 && <span className="mx-1 w-px self-stretch bg-line" />}
          {albums.length > 0 && <button className={pill(album === "all")} onClick={() => setAlbum("all")}>كل الألبومات</button>}
          {albums.map((a) => <button key={a} className={pill(album === a)} onClick={() => setAlbum(a)}>{a}</button>)}
        </div>
      )}
      {shown.length ? <MediaGrid rows={shown} onOpen={setOpen} />
        : !err && <p className="card px-4 py-10 text-center text-sm text-muted">لا مواد في المعرض بعد.</p>}
      {open != null && shown[open] && (
        <MediaViewer item={shown[open]} onClose={() => setOpen(null)}
                     onPrev={open > 0 ? () => setOpen(open - 1) : null} onNext={open < shown.length - 1 ? () => setOpen(open + 1) : null} />
      )}
    </div>
  );
}
