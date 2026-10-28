// src/pages/globe/GlobeMonitor.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { GLOBE_SPHERES, GLOBE_PROTOCOLS, GLOBE_BUCKET, sphereOf } from "../../lib/globe.js";
import { MAX_PHOTOS, pill, setupErr, activeTerm, uploadPhotos, useSignedPhotos, Thumbs, Stats } from "./shared.jsx";

/* =====================================================================
   خطة الرصد البيئي (supabase/globe_2.sql): جلسات الرصد بالبروتوكول والموعد
   والمكان والطلاب المكلّفين، وتكرارها أسبوعيًا. لكل جلسة تذكير واتساب
   جاهز للطلاب وأولياء أمورهم، وتوثيقها بالقراءات ورفعها إلى منصة GLOBE.
   members: طلاب البرنامج من GlobeTeam (id, full_name, student_mobile, mobile)
   ===================================================================== */

const PLACES = ["ساحة المدرسة", "حديقة المدرسة", "مختبر العلوم", "محطة الرصد"];
const MAX_REPEAT = 30;
const SPHERES = GLOBE_SPHERES.filter((s) => s.k !== "all");

export const weekday = (iso) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long" }).format(new Date(`${iso}T12:00:00`));
export const time12 = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
};
// الاسم الأول واسم العائلة
const shortName = (n) => { const w = n.trim().split(/\s+/); return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : n; };
const addDays = (iso, d) => { const x = new Date(`${iso}T12:00:00`); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

const WA_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);
function Wa({ mobile, text, label }) {
  if (!mobile) return <span className="text-[11px] text-faint">{label}: لا جوال</span>;
  return (
    <a href={`https://wa.me/${mobile}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
       className="inline-flex items-center gap-1 rounded-pill bg-[#25D366]/12 px-2.5 py-1 text-[11px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20">
      {WA_ICON}{label}
    </a>
  );
}

const reminder = (o, name, guardian) => [
  `${guardian ? "ولي أمر الطالب" : "الطالب"} ${name}، السلام عليكم ورحمة الله.`,
  `تذكير من برنامج جلوب البيئي بمدرسة مكة الثانوية: ${guardian ? "ابنكم مكلّف بجلسة" : "أنت مكلّف بجلسة"} رصد «${o.protocol}»`,
  `يوم ${weekday(o.obs_date)} ${fmtDate(o.obs_date + "T00:00:00")}${o.obs_time ? ` الساعة ${time12(o.obs_time)}` : ""}${o.place ? ` في ${o.place}` : ""}.`,
].join("\n");

const BLANK = { sphere: "atmo", protocol: "", obs_date: "", obs_time: "", place: "", ids: [], repeat: false, until: "" };

export default function GlobeMonitor({ me, members, onReport }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [nf, setNf] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("upcoming");      // upcoming | done | all
  const [remindFor, setRemindFor] = useState(null);
  const [doneFor, setDoneFor] = useState(null);
  const urls = useSignedPhotos(rows);
  const today = todayISO();
  const byId = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members]);

  const load = () => supabase.from("globe_observations").select("*").order("obs_date").order("obs_time")
    .then(({ data, error }) => { if (error) setErr(setupErr(error)); setRows(data ?? []); });
  useEffect(() => { load(); }, []);

  // التكرار الأسبوعي: الجلسة وما بعدها كل 7 أيام حتى التاريخ المحدد
  const dates = (f) => {
    if (!f.obs_date) return [];
    if (!f.repeat || !f.until || f.until <= f.obs_date) return [f.obs_date];
    const out = [];
    for (let d = f.obs_date; d <= f.until && out.length < MAX_REPEAT; d = addDays(d, 7)) out.push(d);
    return out;
  };

  const add = async () => {
    const ds = dates(nf);
    if (!nf.protocol.trim() || !ds.length) return;
    setBusy(true);
    const term = await activeTerm();
    const { error } = await supabase.from("globe_observations").insert(ds.map((d) => ({
      sphere: nf.sphere, protocol: nf.protocol.trim(), obs_date: d, obs_time: nf.obs_time || null,
      place: nf.place.trim() || null, student_ids: nf.ids, created_by_name: me ?? null, ...term,
    })));
    setBusy(false);
    if (error) { setErr(setupErr(error)); return; }
    setNf(null); setTab("upcoming"); load();
  };

  const saveDone = async () => {
    setBusy(true); setErr("");
    try {
      const o = doneFor.o;
      const photos = await uploadPhotos("observations", o.id, doneFor.files, o.photos ?? []);
      const { error } = await supabase.from("globe_observations").update({
        status: "done", readings: doneFor.readings.trim() || null, uploaded: doneFor.uploaded, photos,
      }).eq("id", o.id);
      if (error) throw error;
      setDoneFor(null); load();
    } catch (e) { setErr(setupErr(e)); }
    setBusy(false);
  };

  const setStatus = async (o, status) => {
    const { error } = await supabase.from("globe_observations").update({ status }).eq("id", o.id);
    if (error) setErr(setupErr(error)); else load();
  };

  const remove = async (o) => {
    if (!(await confirmDanger({
      title: `حذف جلسة رصد «${o.protocol}»`,
      impact: [`جلسة ${weekday(o.obs_date)} ${fmtDate(o.obs_date + "T00:00:00")} مع قراءاتها وصورها.`, "لا يمكن التراجع."],
      confirmLabel: "حذف الجلسة",
    }))) return;
    if (o.photos?.length) await supabase.storage.from(GLOBE_BUCKET).remove(o.photos);
    await supabase.from("globe_observations").delete().eq("id", o.id);
    load();
  };

  if (!rows) return <Loader />;
  const live = rows.filter((o) => o.status !== "cancelled");
  const due = live.filter((o) => o.obs_date <= today);
  const doneN = live.filter((o) => o.status === "done").length;
  const upN = live.filter((o) => o.uploaded).length;
  const ratio = due.length ? Math.round((due.filter((o) => o.status === "done").length / due.length) * 100) : 0;
  const shown = tab === "upcoming" ? rows.filter((o) => o.status === "planned")
    : tab === "done" ? rows.filter((o) => o.status === "done").reverse() : rows;
  const count = dates(nf ?? {}).length;

  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-l from-[#E3F1F7] to-paper px-4 py-3">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="text-base font-bold text-ink">خطة الرصد البيئي</p>
            <p className="text-xs text-muted">جلسات الرصد بمواعيدها وطلابها، والتذكير بالواتساب، وتوثيق القراءات ورفعها إلى منصة GLOBE.</p>
          </div>
          <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setNf({ ...BLANK, obs_date: today })}>+ جلسة رصد</button>
          {rows.length > 0 && <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onReport}>تقرير الخطة وطباعتها</button>}
        </div>
        <Stats ratio={ratio} label="الالتزام بالرصد (المنفّذ من الجلسات التي حل موعدها)" items={[
          ["جلسات الرصد", live.length, "text-ink"], ["نُفّذت", doneN, "text-present"],
          ["رُفعت إلى GLOBE", upN, "text-excused"], ["القادمة", live.filter((o) => o.status === "planned" && o.obs_date >= today).length, "text-late"]]} />
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          {[["upcoming", "المجدولة"], ["done", "المنفّذة"], ["all", "الكل"]].map(([k, t]) => (
            <button key={k} className={pill(tab === k)} onClick={() => setTab(k)}>{t}</button>
          ))}
        </div>
      </section>

      {nf && (
        <section className="card space-y-3 p-4">
          <p className="font-semibold text-ink">جلسة رصد جديدة</p>
          <div className="flex flex-wrap gap-1.5">
            {SPHERES.map((s) => (
              <button key={s.k} type="button" className={pill(nf.sphere === s.k)}
                      onClick={() => setNf((x) => ({ ...x, sphere: s.k, protocol: "" }))}>{s.t}</button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">البروتوكول</p>
            <div className="flex flex-wrap gap-1.5">
              {GLOBE_PROTOCOLS[nf.sphere].map((t) => (
                <button key={t} type="button" className={pill(nf.protocol === t)} onClick={() => setNf((x) => ({ ...x, protocol: t }))}>{t}</button>
              ))}
            </div>
            <input className="field mt-2 w-full" value={nf.protocol} placeholder="أو اكتب البروتوكول"
                   onChange={(e) => setNf((x) => ({ ...x, protocol: e.target.value }))} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] text-muted">التاريخ
              <input type="date" className="field num mt-0.5" value={nf.obs_date} onChange={(e) => setNf((x) => ({ ...x, obs_date: e.target.value }))} />
            </label>
            <label className="text-[11px] text-muted">الوقت
              <input type="time" className="field num mt-0.5" value={nf.obs_time} onChange={(e) => setNf((x) => ({ ...x, obs_time: e.target.value }))} />
            </label>
            <label className="text-[11px] text-muted">المكان
              <input className="field mt-0.5" list="globe-places" value={nf.place} placeholder="ساحة المدرسة"
                     onChange={(e) => setNf((x) => ({ ...x, place: e.target.value }))} />
              <datalist id="globe-places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist>
            </label>
          </div>
          <div className="rounded-sm2 border border-line p-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={nf.repeat} onChange={(e) => setNf((x) => ({ ...x, repeat: e.target.checked }))} />
              تكرار أسبوعي في اليوم نفسه
            </label>
            {nf.repeat && (
              <label className="mt-2 block text-[11px] text-muted">حتى تاريخ
                <input type="date" className="field num mt-0.5" value={nf.until} min={nf.obs_date}
                       onChange={(e) => setNf((x) => ({ ...x, until: e.target.value }))} />
              </label>
            )}
          </div>
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <p className="text-xs text-muted">الطلاب المكلّفون <span className="num">({nf.ids.length})</span></p>
              {members.length > 0 && (
                <button type="button" className="text-[11px] font-semibold text-mint-deep"
                        onClick={() => setNf((x) => ({ ...x, ids: x.ids.length === members.length ? [] : members.map((m) => m.id) }))}>
                  {nf.ids.length === members.length ? "إلغاء التحديد" : "تحديد الكل"}
                </button>
              )}
            </div>
            {members.length === 0 ? <p className="text-xs text-muted">أضف طلاب البرنامج أولًا من تبويب «الطلاب».</p> : (
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-sm2 border border-line p-2 sm:grid-cols-2">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-sm2 px-2 py-1 text-sm text-ink hover:bg-canvas">
                    <input type="checkbox" checked={nf.ids.includes(m.id)}
                           onChange={(e) => setNf((x) => ({ ...x, ids: e.target.checked ? [...x.ids, m.id] : x.ids.filter((i) => i !== m.id) }))} />
                    <span className="truncate">{m.full_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" disabled={busy || !nf.protocol.trim() || !count} onClick={add}>
              {count > 1 ? `حفظ ${count} جلسات` : "حفظ"}
            </button>
            <button className="btn-ghost" onClick={() => setNf(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {shown.length === 0 ? (
        !nf && (
          <div className="card px-6 py-10 text-center">
            <p className="text-3xl">🔭</p>
            <p className="mt-2 text-sm font-semibold text-ink">{rows.length ? "لا جلسات هنا" : "لا جلسات رصد بعد"}</p>
            {!rows.length && <p className="mt-1 text-xs text-muted">أضف جلسة من «+ جلسة رصد»، وكرّرها أسبوعيًا للرصد المنتظم.</p>}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {shown.map((o) => {
            const sp = sphereOf(o.sphere);
            const kids = (o.student_ids ?? []).map((id) => byId.get(id)).filter(Boolean);
            const late = o.status === "planned" && o.obs_date < today;
            return (
              <article key={o.id} className={`card overflow-hidden border-r-4 ${o.status === "cancelled" ? "opacity-60" : ""}`}
                       style={{ borderRightColor: sp.color }}>
                <div className="px-4 pb-3 pt-3.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="chip" style={{ background: `${sp.color}1A`, color: sp.color }}>{sp.t}</span>
                        {o.status === "done" ? <span className="chip bg-present/10 text-present">✓ نُفّذ</span>
                          : o.status === "cancelled" ? <span className="chip bg-canvas text-muted">ملغاة</span>
                          : late ? <span className="chip bg-absent/10 text-absent">فات موعدها</span>
                          : o.obs_date === today ? <span className="chip bg-late/10 text-late">اليوم</span>
                          : <span className="chip bg-canvas text-muted">مجدولة</span>}
                        {o.uploaded && <span className="chip bg-excused/10 text-excused">رُفعت إلى GLOBE</span>}
                      </div>
                      <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{o.protocol}</h3>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className="num">{weekday(o.obs_date)} {fmtDate(o.obs_date + "T00:00:00")}</span>
                        {o.obs_time && <span className="num"> · {time12(o.obs_time)}</span>}
                        {o.place && <> · {o.place}</>}
                      </p>
                    </div>
                    <button className="text-xs text-faint hover:text-absent" onClick={() => remove(o)}>حذف</button>
                  </div>
                  {kids.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {kids.map((k) => <span key={k.id} className="rounded-pill bg-canvas px-2 py-0.5 text-[11px] text-ink">{shortName(k.full_name)}</span>)}
                    </div>
                  )}
                  {o.status === "done" && o.readings && (
                    <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                      <span className="font-semibold text-mint-deep">القراءات والملاحظات: </span>{o.readings}
                    </p>
                  )}
                  {o.status === "done" && <Thumbs paths={o.photos} urls={urls} />}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/50 px-4 py-2">
                  {o.status === "planned" && kids.length > 0 && (
                    <button className="inline-flex items-center gap-1 rounded-pill bg-[#25D366]/15 px-3 py-1 text-xs font-semibold text-[#128C7E]"
                            onClick={() => setRemindFor(remindFor === o.id ? null : o.id)}>{WA_ICON}تذكير الطلاب</button>
                  )}
                  {o.status !== "cancelled" && (
                    <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                            onClick={() => setDoneFor({ o, readings: o.readings ?? "", uploaded: o.uploaded, files: [] })}>
                      {o.status === "done" ? "تعديل التوثيق" : "توثيق الرصد"}
                    </button>
                  )}
                  {o.status === "planned" && <button className="text-xs text-muted underline" onClick={() => setStatus(o, "cancelled")}>إلغاء الجلسة</button>}
                  {o.status === "cancelled" && <button className="text-xs text-mint-deep underline" onClick={() => setStatus(o, "planned")}>إعادة الجدولة</button>}
                </div>

                {remindFor === o.id && (
                  <div className="divide-y divide-line border-t border-line bg-[#25D366]/5">
                    <p className="px-4 py-2 text-[11px] text-muted">تُفتح كل محادثة برسالة تذكير جاهزة بالموعد والمكان، ويبقى الإرسال بيدك.</p>
                    {kids.map((k) => (
                      <div key={k.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{k.full_name}</span>
                        <Wa mobile={k.student_mobile} text={reminder(o, k.full_name, false)} label="الطالب" />
                        <Wa mobile={k.mobile} text={reminder(o, k.full_name, true)} label="ولي الأمر" />
                      </div>
                    ))}
                  </div>
                )}

                {doneFor?.o.id === o.id && (
                  <div className="space-y-2 border-t border-line bg-canvas p-3">
                    <p className="text-xs font-semibold text-ink">توثيق جلسة الرصد</p>
                    <textarea className="field w-full" rows={3} value={doneFor.readings}
                              placeholder="القراءات والملاحظات: مثل درجة الحرارة العظمى 34° والصغرى 26°، والسماء صافية…"
                              onChange={(e) => setDoneFor((x) => ({ ...x, readings: e.target.value }))} />
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={doneFor.uploaded} onChange={(e) => setDoneFor((x) => ({ ...x, uploaded: e.target.checked }))} />
                      رُفعت البيانات إلى منصة GLOBE
                    </label>
                    {(o.photos?.length ?? 0) < MAX_PHOTOS && (
                      <label className="block text-xs text-muted">صور الرصد (حتى {MAX_PHOTOS - (o.photos?.length ?? 0)})
                        <input type="file" accept="image/*" multiple className="mt-1 block text-xs"
                               onChange={(e) => setDoneFor((x) => ({ ...x, files: [...e.target.files] }))} />
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busy} onClick={saveDone}>{busy ? "جارٍ الحفظ…" : "حفظ التوثيق"}</button>
                      <button className="btn-ghost" onClick={() => setDoneFor(null)}>إلغاء</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
