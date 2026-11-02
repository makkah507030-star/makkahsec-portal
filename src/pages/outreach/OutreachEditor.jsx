// src/pages/outreach/OutreachEditor.jsx
// إنشاء النشرة أو الاستبانة وتعديلها قبل الإرسال: العنوان والتصنيف والنص، والصور والمقاطع والملفات،
// والروابط (يوتيوب يُعرض داخل الصفحة)، وأسئلة الاستبانة بأنواعها، مع معاينة كما يراها المستلم.
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { notify } from "../../lib/notice";
import { KIND, QTYPES, TOPICS, mediaUrls, newQuestion, uploadMedia, youtubeId } from "../../lib/outreach.js";
import { ItemBody, SurveyForm } from "./OutreachView.jsx";

const L = ({ children, hint }) => <p className="mb-1 text-[12px] font-semibold text-muted">{children}{hint && <span className="font-normal text-faint"> · {hint}</span>}</p>;

export default function OutreachEditor({ item, onSaved, onCancel }) {
  const { session, profile, adminRoles } = useSession();
  const uid = session.user.id;
  const [x, setX] = useState(item);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);   // روابط الوسائط للمعاينة
  const [link, setLink] = useState({ t: "", url: "" });
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setQ = (i, patch) => set("questions", x.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i, d) => { const a = [...x.questions]; const [q] = a.splice(i, 1); a.splice(i + d, 0, q); set("questions", a); };
  const k = KIND[x.kind];

  const upload = async (files) => {
    setBusy("up");
    try {
      const added = [];
      for (const f of files) added.push(await uploadMedia(uid, f));
      set("media", [...x.media, ...added]);
    } catch (e) { notify({ ok: false, text: e.message }); }
    setBusy("");
  };
  const removeMedia = async (m) => {
    set("media", x.media.filter((y) => y.path !== m.path));
    if (!item.media.some((y) => y.path === m.path)) supabase.storage.from("outreach").remove([m.path]);
  };
  const addLink = () => {
    const url = link.url.trim();
    if (!/^https?:\/\//i.test(url)) { notify({ ok: false, text: "اكتب الرابط كاملًا يبدأ بـ https://" }); return; }
    set("links", [...x.links, { t: link.t.trim() || (youtubeId(url) ? "مقطع يوتيوب" : ""), url }]); setLink({ t: "", url: "" });
  };

  const save = async () => {
    if (!x.title.trim()) { notify({ ok: false, text: "اكتب العنوان." }); return null; }
    let qs = x.questions;
    if (x.kind === "survey") {
      qs = qs.map((q) => ({ ...q, q: q.q.trim(), options: QTYPES[q.type].opts ? q.options.map((o) => o.trim()).filter(Boolean) : [] }));
      const bad = qs.findIndex((q) => !q.q || (QTYPES[q.type].opts && q.options.length < 2));
      if (!qs.length) { notify({ ok: false, text: "أضف سؤالًا واحدًا على الأقل." }); return null; }
      if (bad >= 0) { notify({ ok: false, text: `أكمل السؤال ${bad + 1}: نصه، وخياران على الأقل.` }); return null; }
    }
    setBusy("save");
    const roleT = adminRoles.map((r) => ADMIN_ROLE_LABEL[r]).filter(Boolean)[0] ?? null;
    const row = { kind: x.kind, title: x.title.trim(), body: x.body?.trim() || null, topic: x.topic || null, media: x.media, links: x.links,
      questions: x.kind === "survey" ? qs : [], needs_ack: x.kind === "post" && !!x.needs_ack, anonymous: x.kind === "survey" && !!x.anonymous,
      closes_at: x.closes_at || null, updated_at: new Date().toISOString() };
    const { data, error } = x.id
      ? await supabase.from("outreach_items").update(row).eq("id", x.id).select().single()
      : await supabase.from("outreach_items").insert({ ...row, created_by_name: profile?.full_name ?? null, created_by_role: roleT }).select().single();
    setBusy("");
    if (error) { notify({ ok: false, text: error.message }); return null; }
    onSaved(data);
    return data;
  };

  if (preview) return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div className="flex items-center gap-2"><button className="btn-ghost" onClick={() => setPreview(null)}>رجوع للتعديل</button>
        <span className="text-sm text-muted">هكذا يراها المستلم</span></div>
      <ItemBody item={{ ...x, created_by_name: profile?.full_name }} urls={preview}>
        {x.kind === "survey" && <SurveyForm questions={x.questions} value={{}} onChange={() => {}} />}
        {x.kind === "post" && x.needs_ack && <button className="btn-primary w-full" disabled>تم الاطلاع</button>}
      </ItemBody>
    </div>
  );

  return (
    <div className="space-y-4">
      <section className="card space-y-4 p-4" style={{ borderTop: `4px solid ${k.c}` }}>
        <h2 className="text-base font-bold" style={{ color: k.c }}>{x.id ? "تعديل" : "إنشاء"} {k.t}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div><L>العنوان</L><input className="field" maxLength={140} value={x.title} onChange={(e) => set("title", e.target.value)} placeholder={x.kind === "survey" ? "مثل: الرضا عن خدمات التوجيه" : "مثل: الاستعداد النفسي للاختبارات"} /></div>
          <div><L>التصنيف</L><select className="field" value={x.topic ?? ""} onChange={(e) => set("topic", e.target.value)}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></div>
        </div>
        <div><L hint={x.kind === "survey" ? "مقدمة الاستبانة" : "يُحفظ تقسيم الأسطر"}>النص</L>
          <textarea className="field min-h-[130px] leading-relaxed" maxLength={6000} value={x.body ?? ""} onChange={(e) => set("body", e.target.value)} /></div>

        <div>
          <L hint={`صور ومقاطع فيديو وملفات PDF، حتى 50 م.ب للملف`}>الوسائط</L>
          {x.media.length > 0 && <div className="mb-2 flex flex-wrap gap-2">{x.media.map((m) => (
            <span key={m.path} className="chip gap-1.5 border border-line bg-canvas text-ink">{{ image: "🖼", video: "🎬", file: "📄" }[m.type]} <span className="max-w-[180px] truncate">{m.name}</span>
              <button className="text-danger" onClick={() => removeMedia(m)} aria-label="حذف">✕</button></span>))}</div>}
          <label className={`btn-ghost inline-flex cursor-pointer ${busy === "up" ? "opacity-60" : ""}`}>
            <input type="file" multiple hidden accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" disabled={busy === "up"}
                   onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; if (f.length) upload(f); }} />
            {busy === "up" ? "جارٍ الرفع…" : "+ إضافة صور أو مقاطع أو ملفات"}</label>
        </div>

        <div>
          <L hint="روابط يوتيوب تُعرض داخل الصفحة">الروابط</L>
          {x.links.length > 0 && <ul className="mb-2 space-y-1">{x.links.map((l, i) => (
            <li key={l.url + i} className="flex items-center gap-2 rounded-sm2 bg-canvas px-3 py-1.5 text-sm">
              <span className="text-mint-deep">{youtubeId(l.url) ? "▶" : "🔗"}</span><span className="min-w-0 flex-1 truncate">{l.t || l.url}</span>
              <button className="text-xs text-danger" onClick={() => set("links", x.links.filter((_, j) => j !== i))}>حذف</button></li>))}</ul>}
          <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
            <input className="field text-sm" value={link.t} onChange={(e) => setLink({ ...link, t: e.target.value })} placeholder="عنوان الرابط (اختياري)" />
            <input className="field text-sm" dir="ltr" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} placeholder="https://" />
            <button className="btn-ghost" onClick={addLink}>إضافة</button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {x.kind === "post" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-sm2 border border-line px-3 py-2 text-sm">
              <input type="checkbox" className="mt-1 accent-mint-deep" checked={!!x.needs_ack} onChange={(e) => set("needs_ack", e.target.checked)} />
              <span>يتطلب «تم الاطلاع»<span className="block text-[11.5px] text-muted">للتعليمات المهمة: تتابع من أقرّ بالاطلاع، وتذكّر البقية.</span></span></label>)}
          {x.kind === "survey" && (
            <label className="flex cursor-pointer items-start gap-2 rounded-sm2 border border-line px-3 py-2 text-sm">
              <input type="checkbox" className="mt-1 accent-mint-deep" checked={!!x.anonymous} onChange={(e) => set("anonymous", e.target.checked)} />
              <span>دون اسم<span className="block text-[11.5px] text-muted">لا يُحفظ صاحب الإجابة معها، ويبقى الصف والفصل للتحليل. يُنصح به للموضوعات الحساسة.</span></span></label>)}
          <div><L hint="اختياري">موعد الإغلاق</L>
            <input type="datetime-local" className="field num" value={x.closes_at ? x.closes_at.slice(0, 16) : ""}
                   onChange={(e) => set("closes_at", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
        </div>
      </section>

      {x.kind === "survey" && (
        <section className="card space-y-3 p-4">
          <h2 className="text-base font-bold text-ink">الأسئلة <span className="num text-sm font-normal text-muted">({x.questions.length})</span></h2>
          {x.questions.map((q, i) => (
            <div key={q.id} className="space-y-2 rounded-sm2 border border-line bg-canvas/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num grid h-7 w-7 place-items-center rounded-full bg-mint-deep text-xs font-bold text-white">{i + 1}</span>
                <select className="field w-auto py-1.5 text-sm" value={q.type} onChange={(e) => setQ(i, { type: e.target.value, options: QTYPES[e.target.value].opts ? (q.options.length ? q.options : ["", ""]) : [] })}>
                  {Object.entries(QTYPES).map(([t, v]) => <option key={t} value={t}>{v.t}</option>)}</select>
                <label className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" className="accent-mint-deep" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} />إلزامي</label>
                <span className="flex-1" />
                <button className="text-xs text-muted disabled:opacity-30" disabled={i === 0} onClick={() => moveQ(i, -1)}>▲</button>
                <button className="text-xs text-muted disabled:opacity-30" disabled={i === x.questions.length - 1} onClick={() => moveQ(i, 1)}>▼</button>
                <button className="text-xs text-danger" onClick={() => set("questions", x.questions.filter((_, j) => j !== i))}>حذف</button>
              </div>
              <input className="field text-sm" maxLength={300} value={q.q} onChange={(e) => setQ(i, { q: e.target.value })} placeholder="نص السؤال" />
              {QTYPES[q.type].opts && (
                <div className="space-y-1.5 pr-4">
                  {q.options.map((o, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="text-muted">{q.type === "single" ? "○" : "☐"}</span>
                      <input className="field py-1.5 text-sm" maxLength={120} value={o} onChange={(e) => setQ(i, { options: q.options.map((y, n) => (n === j ? e.target.value : y)) })} placeholder={`الخيار ${j + 1}`} />
                      {q.options.length > 2 && <button className="text-xs text-danger" onClick={() => setQ(i, { options: q.options.filter((_, n) => n !== j) })}>✕</button>}
                    </div>))}
                  <button className="text-xs font-semibold text-mint-deep" onClick={() => setQ(i, { options: [...q.options, ""] })}>+ خيار</button>
                </div>)}
              {q.type === "scale" && <p className="pr-4 text-[11.5px] text-muted">{QTYPES.scale.scale.join(" · ")}</p>}
              {q.type === "yesno" && <p className="pr-4 text-[11.5px] text-muted">نعم · لا</p>}
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">{Object.entries(QTYPES).map(([t, v]) => (
            <button key={t} className="chip border border-line bg-white text-muted hover:text-ink" onClick={() => set("questions", [...x.questions, newQuestion(t)])}>+ {v.t}</button>))}</div>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!!busy} onClick={save}>{busy === "save" ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button className="btn-ghost" disabled={!!busy} onClick={async () => setPreview(await mediaUrls(x.media))}>معاينة كما يراها المستلم</button>
        <button className="btn-ghost" disabled={!!busy} onClick={onCancel}>إلغاء</button>
      </div>
    </div>
  );
}
