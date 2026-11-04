// src/pages/science/SciPlan.jsx
// الخطة الفصلية للتجارب العملية (و.م.ع.ن-08-03): تجارب كل مقرر بفصولها وصفحاتها وأدواتها كما أرسلها
// المحضر. يحدد المحضر أسبوع كل تجربة ويعدّل أدواتها، ويضيف تجربة أو يخفيها، ويطبع الخطة بالنموذج الرسمي.
import { useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { KIND, coursesOf, setupMsg } from "../../lib/sciLab.js";

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-[13px] font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`;
const KIND_TONE = { launch: "bg-excused/10 text-excused", main: "bg-mint-tint text-mint-deep", lab: "bg-late/10 text-late" };

export default function SciPlan({ lab, exps, isManager, onChanged, onPrint }) {
  const courses = coursesOf(exps);
  const [course, setCourse] = useState(courses[0] ?? "");
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const list = useMemo(() => exps.filter((e) => e.course === course && (isManager || e.is_active)), [exps, course, isManager]);
  const chapters = [...new Set(list.map((e) => e.chapter ?? ""))];

  const save = async () => {
    setBusy(true);
    const row = { title: edit.title.trim(), tools: edit.tools.trim() || null, week: Number(edit.week) || null,
      page: Number(edit.page) || null, kind: edit.kind, chapter: edit.chapter.trim() || null, chapter_title: edit.chapter_title.trim() || null };
    const { error } = edit.id
      ? await supabase.from("sci_experiments").update(row).eq("id", edit.id)
      : await supabase.from("sci_experiments").insert({ ...row, lab, course, grade: list[0]?.grade ?? 1, no: Math.max(0, ...list.map((e) => e.no)) + 1 });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: setupMsg(error) }); return; }
    setEdit(null); onChanged();
  };
  const toggle = async (e) => {
    const { error } = await supabase.from("sci_experiments").update({ is_active: !e.is_active }).eq("id", e.id);
    if (error) setMsg({ ok: false, text: setupMsg(error) }); else onChanged();
  };
  const blank = { title: "", tools: "", week: "", page: "", kind: "main", chapter: list.at(-1)?.chapter ?? "", chapter_title: list.at(-1)?.chapter_title ?? "" };

  if (!courses.length) return <p className="card px-4 py-8 text-center text-sm text-muted">لا تجارب في خطة هذا المختبر بعد.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {courses.map((c) => <button key={c} className={pill(c === course)} onClick={() => { setCourse(c); setEdit(null); }}>{c}</button>)}
        <span className="ms-auto flex gap-2">
          {isManager && !edit && <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setEdit(blank)}>+ تجربة</button>}
          <button className="btn-primary px-4 py-1.5 text-sm" onClick={() => onPrint(course)}>طباعة الخطة</button>
        </span>
      </div>
      <p className="text-xs text-muted">
        <span className="num">{list.filter((e) => e.is_active).length}</span> تجربة في خطة {course}
        {isManager && " · حدد أسبوع كل تجربة من «تعديل» ليظهر في الخطة المطبوعة"}
      </p>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.text}</p>}
      {edit && !edit.id && <Editor edit={edit} setEdit={setEdit} busy={busy} save={save} />}

      {chapters.map((ch) => {
        const rows = list.filter((e) => (e.chapter ?? "") === ch);
        return (
          <section key={ch} className="card overflow-hidden">
            <div className="border-b border-line/60 bg-canvas px-4 py-2">
              <p className="text-sm font-bold text-ink">الفصل {ch}{rows[0]?.chapter_title && <span className="font-medium text-muted"> · {rows[0].chapter_title}</span>}</p>
            </div>
            <div className="divide-y divide-line/60">
              {rows.map((e) => edit?.id === e.id ? <div key={e.id} className="p-3"><Editor edit={edit} setEdit={setEdit} busy={busy} save={save} /></div> : (
                <div key={e.id} className={`flex gap-3 px-4 py-3 ${e.is_active ? "" : "opacity-50"}`}>
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">{e.no}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink">{e.title}</p>
                      <span className={`chip ${KIND_TONE[e.kind]}`}>{KIND[e.kind]}</span>
                      {e.guide && <span className="chip bg-canvas text-muted">دليل التجارب{e.guide_page ? ` ص ${e.guide_page}` : ""}</span>}
                      {!e.is_active && <span className="chip bg-canvas text-muted">مخفية</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">صفحة الكتاب <span className="num">{e.page ?? "—"}</span>{e.week && <> · الأسبوع <span className="num">{e.week}</span></>}</p>
                    {e.tools && <p className="mt-1 text-xs leading-relaxed text-ink"><span className="text-muted">الأدوات: </span>{e.tools}</p>}
                  </div>
                  {isManager && (
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      <button className="font-semibold text-mint-deep" onClick={() => setEdit({ ...blank, ...e, week: e.week ?? "", page: e.page ?? "", tools: e.tools ?? "", chapter: e.chapter ?? "", chapter_title: e.chapter_title ?? "" })}>تعديل</button>
                      <button className="text-muted" onClick={() => toggle(e)}>{e.is_active ? "إخفاء" : "إظهار"}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Editor({ edit, setEdit, busy, save }) {
  const f = (k, label, props = {}) => (
    <label className="block text-xs text-muted">{label}
      <input className="field mt-1 w-full" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} {...props} />
    </label>
  );
  return (
    <div className="card space-y-2 p-3 ring-2 ring-mint-deep/40">
      {f("title", "اسم التجربة", { maxLength: 160 })}
      <div className="grid gap-2 sm:grid-cols-4">
        {f("chapter", "الفصل", { maxLength: 20 })}
        {f("chapter_title", "عنوان الفصل", { maxLength: 80 })}
        {f("page", "صفحة الكتاب", { inputMode: "numeric" })}
        {f("week", "الأسبوع", { inputMode: "numeric", placeholder: "1–20" })}
      </div>
      <label className="block text-xs text-muted">النوع
        <select className="field mt-1 w-full" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
          {Object.entries(KIND).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      <label className="block text-xs text-muted">أدوات التجربة
        <textarea className="field mt-1 w-full" rows={3} maxLength={1200} value={edit.tools} onChange={(e) => setEdit({ ...edit, tools: e.target.value })} />
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !edit.title.trim()} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button className="btn-ghost" onClick={() => setEdit(null)}>إلغاء</button>
      </div>
    </div>
  );
}
