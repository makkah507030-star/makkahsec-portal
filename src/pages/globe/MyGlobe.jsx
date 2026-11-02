// src/pages/globe/MyGlobe.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import GlobeMark from "../../components/GlobeMark.jsx";
import { memberRole, sphereOf } from "../../lib/globe.js";
import { MAX_PHOTOS, pill, uploadPhotos, useSignedPhotos, Thumbs } from "./shared.jsx";
import { weekday, time12 } from "./GlobeMonitor.jsx";

/* =====================================================================
   «برنامج جلوب» للطالب العضو حين يسند له المشرف الدخول (supabase/globe_4.sql):
   صفته ومهامه (البروتوكولات المكلّف بها)، وجلسات الرصد المكلّف بها باسمه أو ببروتوكوله،
   وتوثيق ما حلّ موعده: القراءات والملاحظات، ورفعها إلى منصة GLOBE، والصور.
   ===================================================================== */

export default function MyGlobe() {
  const [me, setMe] = useState(undefined);
  const [tab, setTab] = useState("due");          // due | upcoming | done
  const [doc, setDoc] = useState(null);           // { o, readings, uploaded, files }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = () => supabase.rpc("globe_my").then(({ data, error }) => setMe(error ? null : data));
  useEffect(() => { load(); }, []);
  const sessions = useMemo(() => me?.sessions ?? [], [me]);
  const urls = useSignedPhotos(sessions);

  if (me === undefined) return <Loader />;
  if (!me) return <p className="card px-4 py-8 text-center text-sm text-muted">لم يُسند لك الدخول إلى برنامج جلوب. راجع مشرف البرنامج.</p>;

  const today = me.today;
  const due = sessions.filter((o) => o.status === "planned" && o.obs_date <= today);
  const upcoming = sessions.filter((o) => o.status === "planned" && o.obs_date > today);
  const done = sessions.filter((o) => o.status === "done").reverse();
  const list = tab === "due" ? due : tab === "upcoming" ? upcoming : done;

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const photos = await uploadPhotos("observations", doc.o.id, doc.files, doc.o.photos ?? []);
      const { error } = await supabase.rpc("globe_obs_save", { p_id: doc.o.id, p_readings: doc.readings, p_uploaded: doc.uploaded, p_photos: photos });
      if (error) throw error;
      setDoc(null); setMsg({ ok: true, t: `وُثّقت جلسة «${doc.o.protocol}». شكرًا لك.` }); load();
    } catch (e) { setMsg({ ok: false, t: e.message }); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-4 text-white" style={{ background: "linear-gradient(135deg, #0B3D5C, #2E7D32)" }}>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/15"><GlobeMark className="h-7 w-7" /></span>
          <div className="min-w-0">
            <p className="text-xs text-white/75">برنامج جلوب البيئي العالمي · مدرسة مكة الثانوية</p>
            <p className="truncate text-lg font-bold">{me.name}</p>
            <p className="text-xs text-white/85">{memberRole(me.role).t}</p>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs text-muted">مهامك في الرصد</p>
          {me.tasks?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {me.tasks.map((t) => <span key={t} className="chip bg-mint-tint text-mint-deep">{t}</span>)}
            </div>
          ) : <p className="mt-1 text-sm text-muted">الجلسات المسجّلة باسمك.</p>}
        </div>
      </section>

      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "due")} onClick={() => setTab("due")}>للتوثيق <span className="num">({due.length})</span></button>
        <button className={pill(tab === "upcoming")} onClick={() => setTab("upcoming")}>القادمة <span className="num">({upcoming.length})</span></button>
        <button className={pill(tab === "done")} onClick={() => setTab("done")}>المنفّذة <span className="num">({done.length})</span></button>
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

      {list.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          {tab === "due" ? "لا جلسات تنتظر التوثيق." : tab === "upcoming" ? "لا جلسات قادمة خلال شهر." : "لا جلسات منفّذة بعد."}
        </p>
      ) : list.map((o) => {
        const sp = sphereOf(o.sphere);
        const open = doc?.o.id === o.id;
        return (
          <section key={o.id} className="card overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="chip" style={{ background: `${sp.color}1A`, color: sp.color }}>{sp.t}</span>
                {o.mine && <span className="chip bg-mint-tint text-mint-deep">مكلّف باسمك</span>}
                {o.obs_date === today && o.status === "planned" && <span className="chip bg-late/10 text-late">اليوم</span>}
                {o.status === "done" && <span className="chip bg-present/10 text-present">✓ نُفّذ</span>}
                {o.uploaded && <span className="chip bg-excused/10 text-excused">رُفعت إلى GLOBE</span>}
              </div>
              <h3 className="mt-1.5 text-[15px] font-bold text-ink">{o.protocol}</h3>
              <p className="mt-0.5 text-xs text-muted">
                <span className="num">{weekday(o.obs_date)} {fmtDate(o.obs_date + "T00:00:00")}</span>
                {o.obs_time && <span className="num"> · {time12(o.obs_time)}</span>}
                {o.place && <> · {o.place}</>}
              </p>
              {o.status === "done" && o.readings && (
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-ink"><span className="font-semibold text-mint-deep">القراءات: </span>{o.readings}</p>
              )}
              {o.status === "done" && o.documented_by_name && <p className="mt-1 text-[11px] text-muted">وثّقها: {o.documented_by_name}</p>}
              {o.status === "done" && <Thumbs paths={o.photos} urls={urls} />}
            </div>
            {o.obs_date <= today && !open && (
              <div className="border-t border-line bg-canvas/50 px-4 py-2">
                <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                        onClick={() => setDoc({ o, readings: o.readings ?? "", uploaded: !!o.uploaded, files: [] })}>
                  {o.status === "done" ? "تعديل التوثيق" : "توثيق الرصد"}
                </button>
              </div>
            )}
            {open && (
              <div className="space-y-2 border-t border-line bg-canvas p-3">
                <textarea className="field w-full" rows={4} maxLength={1500} value={doc.readings}
                          placeholder="القراءات والملاحظات: مثل نوع الغيوم ونسبة الغطاء، أو درجة الحرارة والرطوبة…"
                          onChange={(e) => setDoc({ ...doc, readings: e.target.value })} />
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="accent-mint-deep" checked={doc.uploaded} onChange={(e) => setDoc({ ...doc, uploaded: e.target.checked })} />
                  رفعتُ البيانات إلى منصة GLOBE
                </label>
                {(o.photos?.length ?? 0) < MAX_PHOTOS && (
                  <label className="block text-xs text-muted">صور الرصد (حتى {MAX_PHOTOS - (o.photos?.length ?? 0)})
                    <input type="file" accept="image/*" multiple className="field mt-1 w-full"
                           onChange={(e) => setDoc({ ...doc, files: [...e.target.files] })} />
                  </label>
                )}
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy || !doc.readings.trim()} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ التوثيق"}</button>
                  <button className="btn-ghost" onClick={() => setDoc(null)}>إلغاء</button>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
