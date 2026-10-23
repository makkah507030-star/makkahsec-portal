// src/pages/banners/BannersAdmin.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { normalizeImage } from "../../lib/imageResize";
import { todayISO } from "../../lib/schoolTime";
import { fmtGreg } from "../../lib/dates";
import { BANNER_BUCKET, BANNER_KIND, AUDIENCE, LINK_PAGES, isExternal, bannersSetupMsg } from "../../lib/banners.js";
import { Banner } from "../../components/HomeBanners.jsx";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   إعلانات الرئيسية — إدارة البطاقات المصوّرة أعلى رئيسية الطالب وولي الأمر (والمنسوبين):
   فرصة أو مناسبة أو إعلان عام، بصورة وعنوان ووصف، ورابط اختياري (صفحة في البوابة أو
   رابط خارجي)، ولمن تظهر، وفي أي صفوف، ومدة عرضها. ويُعبّأ من فرصة ترشيح أو حدث قائم.
   ===================================================================== */

// مقاس صورة الإعلان الإلزامي: عرضية 2:1، تُضبط على 1200 × 600 بالضبط قبل الرفع
const BANNER_W = 1200, BANNER_H = 600;
const imageSize = (file) => new Promise((ok) => {
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { ok({ w: img.width, h: img.height }); URL.revokeObjectURL(url); };
  img.onerror = () => { ok(null); URL.revokeObjectURL(url); };
  img.src = url;
});
// يُقبل ما قارب المقاس (نسبة 1.6 إلى 2.5 وعرض 900 فأكثر) ويُضبط عليه؛ وغيره يُرفض برسالة
async function checkBanner(file) {
  const s = await imageSize(file);
  if (!s) return "تعذّرت قراءة الصورة؛ اختر صورة JPG أو PNG.";
  const r = s.w / s.h;
  if (r < 1.6 || r > 2.5) return `الصورة ليست بالمقاس المطلوب (عرضها ${s.w} وارتفاعها ${s.h}). صمّمها بعرض ${BANNER_W} وارتفاع ${BANNER_H} بكسل.`;
  if (s.w < 900) return `الصورة صغيرة (عرضها ${s.w} بكسل) فتظهر باهتة. صمّمها بعرض ${BANNER_W} وارتفاع ${BANNER_H} بكسل.`;
  return null;
}

const blank = () => ({ kind: "opportunity", title: "", body: "", image_path: null, link: "", link_label: "",
  linkType: "none", audience: ["student", "guardian"], grades: [], starts_on: todayISO(), ends_on: "", is_active: true, sort: 0 });

const state = (b) => {
  const t = todayISO();
  if (!b.is_active) return { t: "موقوف", c: "bg-canvas text-muted" };
  if (b.starts_on > t) return { t: "مجدول", c: "bg-excused/10 text-excused" };
  if (b.ends_on && b.ends_on < t) return { t: "منتهٍ", c: "bg-canvas text-faint" };
  return { t: "يُعرض الآن", c: "bg-present/10 text-present" };
};

export default function BannersAdmin() {
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);       // الإعلان المفتوح للتعديل (أو جديد)
  const [file, setFile] = useState(null);       // صورة جديدة لم تُرفع بعد
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [sources, setSources] = useState({ calls: [], events: [] });

  const load = () => supabase.from("home_banners").select("*").order("sort").order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setMsg({ ok: false, text: bannersSetupMsg }); setRows(data ?? []); });
  useEffect(() => {
    load();
    // مصادر التعبئة: فرص الترشيح المنشورة المفتوحة، والأحداث القادمة المعتمدة
    const t = todayISO();
    Promise.all([
      supabase.from("nom_calls").select("id, title, body, closes_on, grades").eq("published", true).is("cancelled_at", null).gte("closes_on", t).limit(20),
      supabase.from("school_events").select("id, title, event_date, venue").gte("event_date", t).neq("stage", "draft").is("cancelled_at", null).order("event_date").limit(20),
    ]).then(([a, b]) => setSources({ calls: a.data ?? [], events: b.data ?? [] }));
  }, []);

  const open = (b) => {
    setFile(null); setPreview(null); setMsg(null);
    setEdit(b ? { ...b, ends_on: b.ends_on ?? "", link: b.link ?? "", link_label: b.link_label ?? "", body: b.body ?? "",
                  linkType: !b.link ? "none" : isExternal(b.link) ? "url" : "page" } : blank());
  };
  const set = (k, v) => setEdit((e) => ({ ...e, [k]: v }));
  const toggle = (k, v) => setEdit((e) => ({ ...e, [k]: e[k].includes(v) ? e[k].filter((x) => x !== v) : [...e[k], v] }));

  const fill = (src) => {
    if (!src) return;
    const [type, id] = src.split(":");
    if (type === "call") {
      const c = sources.calls.find((x) => x.id === id);
      setEdit((e) => ({ ...e, kind: "opportunity", title: c.title, body: (c.body ?? "").slice(0, 160), linkType: "page", link: "/opportunities",
        link_label: "قدّم الآن", grades: c.grades?.length === 3 ? [] : c.grades ?? [], audience: ["student", "guardian"], ends_on: c.closes_on }));
    } else {
      const ev = sources.events.find((x) => x.id === id);
      setEdit((e) => ({ ...e, kind: "event", title: ev.title, body: [fmtGreg(ev.event_date), ev.venue].filter(Boolean).join(" · "),
        ends_on: ev.event_date, linkType: "none", link: "" }));
    }
  };

  const save = async () => {
    if (!edit.title.trim()) { setMsg({ ok: false, text: "اكتب عنوان الإعلان." }); return; }
    if (!edit.audience.length) { setMsg({ ok: false, text: "اختر لمن يظهر الإعلان." }); return; }
    if (edit.linkType === "url" && !isExternal(edit.link)) { setMsg({ ok: false, text: "الرابط الخارجي يبدأ بـ https://" }); return; }
    setBusy(true); setMsg(null);
    let image_path = edit.image_path;
    if (file) {
      const img = await normalizeImage(file, BANNER_W, BANNER_H, 0.86);
      image_path = `${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from(BANNER_BUCKET).upload(image_path, img, { contentType: "image/jpeg" });
      if (error) { setBusy(false); setMsg({ ok: false, text: `تعذّر رفع الصورة: ${error.message}` }); return; }
    }
    const row = { kind: edit.kind, title: edit.title.trim(), body: edit.body.trim() || null, image_path,
      link: edit.linkType === "none" ? null : edit.link.trim() || null,
      link_label: edit.linkType === "none" ? null : edit.link_label.trim() || null,
      audience: edit.audience, grades: edit.grades, starts_on: edit.starts_on || todayISO(), ends_on: edit.ends_on || null,
      is_active: edit.is_active, sort: Number(edit.sort) || 0 };
    const { error } = edit.id
      ? await supabase.from("home_banners").update(row).eq("id", edit.id)
      : await supabase.from("home_banners").insert(row);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (file && edit.image_path && edit.image_path !== image_path) supabase.storage.from(BANNER_BUCKET).remove([edit.image_path]);
    setEdit(null); setMsg({ ok: true, text: "حُفظ الإعلان." }); load();
  };

  const quick = async (b, patch) => { await supabase.from("home_banners").update(patch).eq("id", b.id); load(); };
  const remove = async (b) => {
    if (!window.confirm(`حذف إعلان «${b.title}»؟`)) return;
    await supabase.from("home_banners").delete().eq("id", b.id);
    if (b.image_path) supabase.storage.from(BANNER_BUCKET).remove([b.image_path]);
    load();
  };

  const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">إعلانات الرئيسية</h1>
          <p className="mt-1 text-sm text-muted">بطاقات مصوّرة للفرص والمناسبات أعلى الصفحة الرئيسية، تتقلب وحدها، والضغط عليها يفتح رابطها إن وُجد.</p>
        </div>
        {!edit && <button className="btn-primary" onClick={() => open(null)}>+ إعلان جديد</button>}
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {edit && (
        <section className="card grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-3">
            {!edit.id && (sources.calls.length > 0 || sources.events.length > 0) && (
              <select className="field w-full" defaultValue="" onChange={(e) => fill(e.target.value)}>
                <option value="">تعبئة من فرصة أو مناسبة قائمة (اختياري)</option>
                {sources.calls.length > 0 && <optgroup label="فرص المشاركة المفتوحة">
                  {sources.calls.map((c) => <option key={c.id} value={`call:${c.id}`}>{c.title}</option>)}</optgroup>}
                {sources.events.length > 0 && <optgroup label="الأحداث والمناسبات القادمة">
                  {sources.events.map((v) => <option key={v.id} value={`event:${v.id}`}>{v.title} · {fmtGreg(v.event_date)}</option>)}</optgroup>}
              </select>
            )}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(BANNER_KIND).map(([k, v]) => <button key={k} className={pill(edit.kind === k)} onClick={() => set("kind", k)}>{v.t}</button>)}
            </div>
            <input className="field w-full" placeholder="العنوان" value={edit.title} onChange={(e) => set("title", e.target.value)} maxLength={80} />
            <textarea className="field w-full" rows={2} placeholder="وصف مختصر (اختياري)" value={edit.body} onChange={(e) => set("body", e.target.value)} maxLength={180} />
            <label className="block text-xs text-muted">الصورة
              <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-xs"
                     onChange={async (e) => {
                       const f = e.target.files?.[0] ?? null; e.target.value = "";
                       if (!f) return;
                       const bad = await checkBanner(f);
                       if (bad) { setMsg({ ok: false, text: bad }); return; }
                       setMsg(null); setFile(f); setPreview(URL.createObjectURL(f));
                     }} />
            </label>
            <p className="-mt-1.5 rounded-sm2 bg-canvas px-2.5 py-1.5 text-[11px] leading-relaxed text-muted">
              المقاس المطلوب: عرض <b className="num text-ink">{BANNER_W}</b> وارتفاع <b className="num text-ink">{BANNER_H}</b> بكسل (العرض ضعف الارتفاع)، JPG أو PNG.
              ضع الشعار والكتابة في الوسط بعيدًا عن الحواف، ولا تكتب العنوان داخل الصورة.
            </p>

            <div className="space-y-1.5">
              <p className="text-xs text-muted">عند الضغط على البطاقة</p>
              <div className="flex flex-wrap gap-1.5">
                {[["none", "بلا رابط"], ["page", "صفحة في البوابة"], ["url", "رابط خارجي"]].map(([k, t]) => (
                  <button key={k} className={pill(edit.linkType === k)} onClick={() => setEdit((e) => ({ ...e, linkType: k, link: k === "page" ? LINK_PAGES[0][0] : "" }))}>{t}</button>
                ))}
              </div>
              {edit.linkType === "page" && (
                <select className="field w-full" value={edit.link} onChange={(e) => set("link", e.target.value)}>
                  {LINK_PAGES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              )}
              {edit.linkType === "url" && (
                <input className="field w-full" dir="ltr" placeholder="https://" value={edit.link} onChange={(e) => set("link", e.target.value)} />
              )}
              {edit.linkType !== "none" && (
                <input className="field w-full" placeholder="نص الزر (اختياري، مثل: قدّم الآن)" value={edit.link_label} onChange={(e) => set("link_label", e.target.value)} maxLength={24} />
              )}
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted">يظهر لـ</p>
              <div className="flex flex-wrap gap-1.5">
                {AUDIENCE.map(([k, t]) => <button key={k} className={pill(edit.audience.includes(k))} onClick={() => toggle("audience", k)}>{t}</button>)}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button className={pill(!edit.grades.length)} onClick={() => set("grades", [])}>كل الصفوف</button>
                {[[1, "الأول"], [2, "الثاني"], [3, "الثالث"]].map(([g, t]) => <button key={g} className={pill(edit.grades.includes(g))} onClick={() => toggle("grades", g)}>{t}</button>)}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 text-xs text-muted">
              <label>من<input type="date" className="field num mt-1 block" value={edit.starts_on} onChange={(e) => set("starts_on", e.target.value)} /></label>
              <label>إلى (اختياري)<input type="date" className="field num mt-1 block" value={edit.ends_on} onChange={(e) => set("ends_on", e.target.value)} /></label>
              <label>الترتيب<input type="number" className="field num mt-1 block w-20" value={edit.sort} onChange={(e) => set("sort", e.target.value)} /></label>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الإعلان"}</button>
              <button className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted">معاينة كما تظهر في الرئيسية</p>
            <Banner preview b={{ ...edit, link: edit.linkType === "none" ? null : edit.link, image_url: preview ?? undefined }} />
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        !edit && <p className="card px-4 py-8 text-center text-sm text-muted">لا إعلانات بعد. اضغط «+ إعلان جديد».</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => {
            const st = state(b);
            return (
              <article key={b.id} className="card space-y-2 p-3">
                <Banner preview b={b} />
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`chip ${st.c}`}>{st.t}</span>
                  <span className="text-muted">{b.audience.map((a) => AUDIENCE.find((x) => x[0] === a)?.[1]).filter(Boolean).join("، ")}
                    {b.grades?.length ? ` · الصف ${b.grades.join(" و")}` : ""}</span>
                  <span className="num text-faint">{fmtGreg(b.starts_on)}{b.ends_on ? ` ← ${fmtGreg(b.ends_on)}` : ""}</span>
                  <span className="flex-1" />
                  <button className="text-mint-deep underline" onClick={() => open(b)}>تعديل</button>
                  <button className="text-muted underline" onClick={() => quick(b, { is_active: !b.is_active })}>{b.is_active ? "إيقاف" : "تفعيل"}</button>
                  <button className="text-absent underline" onClick={() => remove(b)}>حذف</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
