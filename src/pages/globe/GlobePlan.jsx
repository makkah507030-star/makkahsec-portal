// src/pages/globe/GlobePlan.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { GLOBE_KIND, GLOBE_PRESETS, GLOBE_SPHERES, GLOBE_BUCKET, sphereOf } from "../../lib/globe.js";
import { MAX_PHOTOS, pill, setupErr, activeTerm, uploadPhotos, useSignedPhotos, Thumbs, Stats } from "./shared.jsx";

/* =====================================================================
   خطة برنامج جلوب (supabase/globe_2.sql): برامج العام بنوعها ومجالها
   البيئي وموعدها، وتوثيق تنفيذ كل برنامج بالمستفيدين والأثر وحتى 3 صور.
   ===================================================================== */

// لون كل نوع: الشريط الجانبي وشارة النوع
export const KIND_STYLE = {
  awareness: { border: "border-r-excused", chip: "bg-excused/10 text-excused" },
  training: { border: "border-r-present", chip: "bg-present/10 text-present" },
  field: { border: "border-r-late", chip: "bg-late/10 text-late" },
  research: { border: "border-r-absent", chip: "bg-absent/10 text-absent" },
};
const BLANK = { title: "", kind: "awareness", sphere: "all", target: "", planned_date: "" };

export default function GlobePlan({ me, onReport }) {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [nf, setNf] = useState(null);             // برنامج جديد
  const [doneFor, setDoneFor] = useState(null);   // توثيق التنفيذ
  const [busy, setBusy] = useState(false);
  const [kindF, setKindF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const urls = useSignedPhotos(rows);

  const load = () => supabase.from("globe_programs").select("*").order("planned_date", { ascending: true, nullsFirst: false })
    .then(({ data, error }) => { if (error) setErr(setupErr(error)); setRows(data ?? []); });
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!nf.title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("globe_programs").insert({
      title: nf.title.trim(), kind: nf.kind, sphere: nf.sphere, target: nf.target.trim() || null,
      planned_date: nf.planned_date || null, created_by_name: me ?? null, ...(await activeTerm()),
    });
    setBusy(false);
    if (error) { setErr(setupErr(error)); return; }
    setNf(null); load();
  };

  const saveDone = async () => {
    setBusy(true); setErr("");
    try {
      const p = doneFor.p;
      const photos = await uploadPhotos("programs", p.id, doneFor.files, p.photos ?? []);
      const { error } = await supabase.from("globe_programs").update({
        status: "done", done_date: doneFor.done_date || todayISO(),
        beneficiaries: Number(doneFor.beneficiaries) || null, outcome: doneFor.outcome.trim() || null, photos,
      }).eq("id", p.id);
      if (error) throw error;
      setDoneFor(null); load();
    } catch (e) { setErr(setupErr(e)); }
    setBusy(false);
  };

  const remove = async (p) => {
    if (!(await confirmDanger({
      title: `حذف برنامج «${p.title}»`,
      impact: ["يُحذف البرنامج من الخطة مع توثيق تنفيذه وصوره.", "لا يمكن التراجع."],
      confirmLabel: "حذف البرنامج",
    }))) return;
    if (p.photos?.length) await supabase.storage.from(GLOBE_BUCKET).remove(p.photos);
    await supabase.from("globe_programs").delete().eq("id", p.id);
    load();
  };

  if (!rows) return <Loader />;
  const list = rows;
  const doneN = list.filter((p) => p.status === "done").length;
  const benN = list.reduce((a, p) => a + (p.status === "done" ? Number(p.beneficiaries ?? 0) : 0), 0);
  const ratio = list.length ? Math.round((doneN / list.length) * 100) : 0;
  const shown = list.filter((p) => (kindF === "all" || p.kind === kindF)
    && (statusF === "all" || (statusF === "done" ? p.status === "done" : p.status !== "done")));

  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 bg-gradient-to-l from-mint-tint to-paper px-4 py-3">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="text-base font-bold text-ink">خطة برنامج جلوب</p>
            <p className="text-xs text-muted">برامج العام بموعدها، وتوثيق تنفيذها بالمستفيدين والأثر والصور.</p>
          </div>
          <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setNf(BLANK)}>+ برنامج</button>
          {list.length > 0 && <button className="btn-ghost px-4 py-1.5 text-xs" onClick={onReport}>تقرير الخطة وطباعتها</button>}
        </div>
        <Stats ratio={ratio} label="نسبة تنفيذ الخطة" items={[
          ["برامج الخطة", list.length, "text-ink"], ["نُفّذ", doneN, "text-present"],
          ["لم يُنفَّذ", list.length - doneN, "text-late"], ["المستفيدون", benN, "text-excused"]]} />
        <div className="flex flex-wrap gap-1.5 px-4 py-3">
          <button className={pill(kindF === "all")} onClick={() => setKindF("all")}>كل الأنواع</button>
          {Object.entries(GLOBE_KIND).map(([k, t]) => {
            const c = list.filter((p) => p.kind === k).length;
            return c ? <button key={k} className={pill(kindF === k)} onClick={() => setKindF(k)}>{t} <span className="num">({c})</span></button> : null;
          })}
          <span className="mx-1 w-px self-stretch bg-line" />
          {[["all", "الكل"], ["done", "المنفّذة"], ["pending", "غير المنفّذة"]].map(([k, t]) => (
            <button key={k} className={pill(statusF === k)} onClick={() => setStatusF(k)}>{t}</button>
          ))}
        </div>
      </section>

      {nf && (
        <section className="card space-y-3 p-4">
          <p className="font-semibold text-ink">برنامج جديد</p>
          <div>
            <p className="mb-1.5 text-xs text-muted">برامج جاهزة</p>
            <div className="flex flex-wrap gap-1.5">
              {GLOBE_PRESETS.map(([t, k]) => <button key={t} type="button" className={pill(nf.title === t)} onClick={() => setNf((x) => ({ ...x, title: t, kind: k }))}>{t}</button>)}
            </div>
          </div>
          <input className="field w-full" value={nf.title} placeholder="عنوان البرنامج" onChange={(e) => setNf((x) => ({ ...x, title: e.target.value }))} />
          <div>
            <p className="mb-1.5 text-xs text-muted">النوع</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(GLOBE_KIND).map(([k, t]) => <button key={k} type="button" className={pill(nf.kind === k)} onClick={() => setNf((x) => ({ ...x, kind: k }))}>{t}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">المجال البيئي</p>
            <div className="flex flex-wrap gap-1.5">
              {GLOBE_SPHERES.map((s) => <button key={s.k} type="button" className={pill(nf.sphere === s.k)} onClick={() => setNf((x) => ({ ...x, sphere: s.k }))}>{s.t}</button>)}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" value={nf.target} placeholder="الفئة المستهدفة (مثل: طلاب البرنامج)" onChange={(e) => setNf((x) => ({ ...x, target: e.target.value }))} />
            <input type="date" className="field num" value={nf.planned_date} onChange={(e) => setNf((x) => ({ ...x, planned_date: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !nf.title.trim()} onClick={add}>حفظ</button>
            <button className="btn-ghost" onClick={() => setNf(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {list.length === 0 && !nf ? (
        <div className="card px-6 py-10 text-center">
          <p className="text-3xl">🌍</p>
          <p className="mt-2 text-sm font-semibold text-ink">لا برامج في الخطة بعد</p>
          <p className="mt-1 text-xs text-muted">أضف برامج العام من «+ برنامج»، ومنها برامج جاهزة بضغطة.</p>
        </div>
      ) : shown.length === 0 ? (
        !nf && <p className="card px-4 py-6 text-center text-sm text-muted">لا برامج بهذه التصفية.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => {
            const kc = KIND_STYLE[p.kind] ?? KIND_STYLE.awareness;
            const sp = sphereOf(p.sphere);
            const done = p.status === "done";
            return (
              <article key={p.id} className={`card overflow-hidden border-r-4 ${kc.border}`}>
                <div className="px-4 pb-3 pt-3.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`chip ${kc.chip}`}>{GLOBE_KIND[p.kind]}</span>
                        <span className="chip" style={{ background: `${sp.color}1A`, color: sp.color }}>{sp.t}</span>
                        {done ? <span className="chip bg-present/10 text-present">✓ نُفّذ</span>
                              : <span className="chip bg-canvas text-muted">لم يُنفَّذ</span>}
                      </div>
                      <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{p.title}</h3>
                    </div>
                    <button className="text-xs text-faint hover:text-absent" onClick={() => remove(p)}>حذف</button>
                  </div>
                  <dl className="mt-2.5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    {[["الفئة المستهدفة", p.target || "—"],
                      ["الموعد في الخطة", p.planned_date ? fmtDate(p.planned_date + "T00:00:00") : "—"],
                      ["تاريخ التنفيذ", p.done_date ? fmtDate(p.done_date + "T00:00:00") : "—"],
                      ["المستفيدون", p.beneficiaries ?? "—"]].map(([k, v]) => (
                      <div key={k} className="rounded-sm2 bg-canvas px-2.5 py-1.5">
                        <dt className="text-[10.5px] text-faint">{k}</dt>
                        <dd className="num break-words text-[12px] font-semibold leading-snug text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {done && p.outcome && (
                    <p className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-ink">
                      <span className="font-semibold text-mint-deep">الأثر والملاحظات: </span>{p.outcome}
                    </p>
                  )}
                  {done && <Thumbs paths={p.photos} urls={urls} />}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line bg-canvas/50 px-4 py-2">
                  <button className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white"
                          onClick={() => setDoneFor({ p, done_date: p.done_date ?? todayISO(), beneficiaries: p.beneficiaries ?? "",
                                                      outcome: p.outcome ?? "", files: [] })}>
                    {done ? "تعديل التوثيق" : "توثيق التنفيذ"}
                  </button>
                </div>

                {doneFor?.p.id === p.id && (
                  <div className="space-y-2 border-t border-line bg-canvas p-3">
                    <p className="text-xs font-semibold text-ink">توثيق تنفيذ البرنامج</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-[11px] text-muted">تاريخ التنفيذ
                        <input type="date" className="field num mt-0.5" value={doneFor.done_date} onChange={(e) => setDoneFor((x) => ({ ...x, done_date: e.target.value }))} />
                      </label>
                      <label className="text-[11px] text-muted">عدد المستفيدين
                        <input className="field num mt-0.5" inputMode="numeric" value={doneFor.beneficiaries} placeholder="مثل: 25"
                               onChange={(e) => setDoneFor((x) => ({ ...x, beneficiaries: e.target.value.replace(/\D/g, "") }))} />
                      </label>
                    </div>
                    <textarea className="field w-full" rows={3} value={doneFor.outcome} placeholder="الأثر والملاحظات: ما تحقق من أهداف البرنامج، ومشاركة الطلاب…"
                              onChange={(e) => setDoneFor((x) => ({ ...x, outcome: e.target.value }))} />
                    {(p.photos?.length ?? 0) < MAX_PHOTOS && (
                      <label className="block text-xs text-muted">صور التنفيذ (حتى {MAX_PHOTOS - (p.photos?.length ?? 0)})
                        <input type="file" accept="image/*" multiple className="mt-1 block text-xs"
                               onChange={(e) => setDoneFor((x) => ({ ...x, files: [...e.target.files] }))} />
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button className="btn-primary" disabled={busy} onClick={saveDone}>{busy ? "جارٍ الحفظ…" : "حفظ التنفيذ"}</button>
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
