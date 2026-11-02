// src/pages/globe/GlobeLibrary.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import { useNotice } from "../../lib/useNotice.js";
import Loader from "../../components/Loader.jsx";
import { GLOBE_BUCKET, YT_ID } from "../../lib/globe.js";
import { pill, uploadDoc, signedUrl, MAX_DOC_MB } from "./shared.jsx";

/* =====================================================================
   مكتبة برنامج جلوب (supabase/globe_3.sql ← globe_library) بقسمين:
   • المرئيات: رابط المقطع من قناة البرنامج في يوتيوب، دون رفع فيديو.
   • التقارير والمنشورات: صورة أو ملف PDF يُرفع إلى globe-files/library.
   ===================================================================== */

const setup = (e) => (/globe_library|schema cache|relation/i.test(e?.message ?? "")
  ? "المكتبة تحتاج تشغيل ملف supabase/globe_3.sql مرة واحدة في Supabase ← SQL Editor." : e?.message);
const BLANK = { title: "", url: "", item_date: "", note: "", file: null };

export default function GlobeLibrary({ me }) {
  const [kind, setKind] = useState("video");          // video | doc
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const load = () => supabase.from("globe_library").select("*")
    .order("item_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setMsg({ ok: false, text: setup(error) }); setRows(data ?? []); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const list = (rows ?? []).filter((r) => r.kind === kind);
  const vid = form ? YT_ID(form.url) : null;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      let file = {};
      if (kind === "doc") file = await uploadDoc("library", form.file);
      const { error } = await supabase.from("globe_library").insert({
        kind, title: form.title.trim(), url: kind === "video" ? `https://www.youtube.com/watch?v=${vid}` : null,
        path: file.path ?? null, mime: file.mime ?? null, item_date: form.item_date || null,
        note: form.note.trim() || null, created_by_name: me ?? null,
      });
      if (error) {
        if (file.path) await supabase.storage.from(GLOBE_BUCKET).remove([file.path]);
        throw error;
      }
      setForm(null); setMsg({ ok: true, text: "أُضيف إلى المكتبة." }); load();
    } catch (e) { setMsg({ ok: false, text: setup(e) }); }
    setBusy(false);
  };

  const remove = async (r) => {
    if (!(await confirmDanger({ title: `حذف «${r.title}» من المكتبة`, impact: [r.kind === "doc" ? "يُحذف الملف المرفوع نهائيًا." : "يُحذف الرابط من المكتبة فقط، ويبقى المقطع في يوتيوب."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("globe_library").delete().eq("id", r.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (r.path) await supabase.storage.from(GLOBE_BUCKET).remove([r.path]);
    load();
  };

  const open = async (r) => {
    const w = window.open("", "_blank");
    const u = await signedUrl(r.path);
    if (w && u) w.location.href = u; else if (u) window.location.href = u;
  };

  const ok = form && form.title.trim() && (kind === "video" ? !!vid : !!form.file);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <button className={pill(kind === "video")} onClick={() => { setKind("video"); setForm(null); }}>المرئيات</button>
        <button className={pill(kind === "doc")} onClick={() => { setKind("doc"); setForm(null); }}>التقارير والمنشورات</button>
        {!form && <button className="btn-primary ms-auto px-4 py-1.5 text-sm" onClick={() => setForm(BLANK)}>
          {kind === "video" ? "+ إضافة مقطع" : "+ رفع تقرير أو منشور"}</button>}
      </div>
      <p className="text-xs leading-relaxed text-muted">
        {kind === "video"
          ? "مقاطع البرنامج من قناته في يوتيوب: يُضاف رابط المقطع فقط، دون رفع فيديو إلى البوابة."
          : `تقارير البرنامج ومنشوراته صورةً أو ملف PDF (حتى ${MAX_DOC_MB} م.ب).`}
      </p>

      {form && (
        <section className="card space-y-3 p-4">
          <input className="field w-full" placeholder={kind === "video" ? "عنوان المقطع" : "عنوان التقرير أو المنشور"} maxLength={120}
                 value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          {kind === "video" ? (
            <div>
              <input className="field w-full" dir="ltr" placeholder="https://www.youtube.com/watch?v=…" value={form.url}
                     onChange={(e) => setForm({ ...form, url: e.target.value })} />
              {form.url && !vid && <p className="mt-1 text-xs text-absent">الرابط ليس رابط مقطع يوتيوب صحيحًا.</p>}
              {vid && <img src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`} alt="" className="mt-2 h-28 rounded-sm2 border border-line" />}
            </div>
          ) : (
            <label className="block text-xs text-muted">الملف (صورة أو PDF)
              <input type="file" accept="image/*,application/pdf" className="field mt-1 w-full"
                     onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} />
            </label>
          )}
          <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <label className="text-xs text-muted">التاريخ (اختياري)
              <input type="date" className="field num mt-1 w-full" value={form.item_date} onChange={(e) => setForm({ ...form, item_date: e.target.value })} />
            </label>
            <label className="text-xs text-muted">وصف مختصر (اختياري)
              <input className="field mt-1 w-full" maxLength={200} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!ok || busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>إلغاء</button>
          </div>
        </section>
      )}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {!rows ? <Loader /> : list.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">{kind === "video" ? "لا مقاطع بعد." : "لا تقارير ولا منشورات بعد."}</p>
      ) : kind === "video" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => {
            const id = YT_ID(r.url);
            return (
              <div key={r.id} className="card overflow-hidden">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-canvas">
                  {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute inset-0 grid place-items-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#FF0000]/90 text-white shadow">
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </span>
                </a>
                <Info r={r} onRemove={() => remove(r)} />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {list.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-sm2 text-[11px] font-bold ${
                r.mime === "application/pdf" ? "bg-absent/10 text-absent" : "bg-mint-tint text-mint-deep"}`}>
                {r.mime === "application/pdf" ? "PDF" : "صورة"}
              </span>
              <div className="min-w-0 flex-1"><Info r={r} bare /></div>
              <button className="text-xs font-semibold text-mint-deep" onClick={() => open(r)}>عرض</button>
              <button className="text-xs text-absent" onClick={() => remove(r)}>حذف</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ r, bare, onRemove }) {
  return (
    <div className={bare ? "" : "p-3"}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-ink">{r.title}</p>
        {onRemove && <button className="shrink-0 text-xs text-absent" onClick={onRemove}>حذف</button>}
      </div>
      {r.note && <p className="mt-0.5 text-xs text-muted">{r.note}</p>}
      {r.item_date && <p className="mt-0.5 text-[11px] text-faint">{fmtDate(r.item_date + "T12:00:00")}</p>}
    </div>
  );
}
