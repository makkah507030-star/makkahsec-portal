// src/pages/activities/ActivityAdmin.jsx
// إدارة بنك الأنشطة (وكيل الشؤون التعليمية): استيراد البطاقات الجاهزة، وإضافة البطاقات
// وتعديلها بصورها وروابط الفيديو وأسئلة الألعاب، وتقرير الاستخدام.
// إلغاء التفعيل (published = false) يخفي البطاقة عن المعلمين ويبقيها بسجلها لتُفعَّل لاحقًا،
// بدل حذفها نهائيًا؛ والموقوفة في قائمة مستقلة.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GAMES, MEDIA_BUCKET, mediaUrl, sectionMeta, sectionsOf } from "../../lib/activities.js";
import Loader from "../../components/Loader.jsx";
import { Cover, CardView } from "./ActivityBank.jsx";

const EMPTY = { kind: "waiting", section: "games", title: "", summary: "", duration_min: 45, goals: "", materials: "",
  steps: [{ min: 5, text: "" }], grades: [], subject: "", video_url: "", cover_path: null, images: [], game: "", game_data: null, published: true };

// أسئلة الألعاب نصًّا: مسابقة الفرق «السؤال | خيار | خيار* | خيار» (* الصحيح)، وحروف «الحرف | السؤال | الجواب»
const quizToText = (d) => (d?.questions ?? []).map((q) => [q.q, ...q.options.map((o, k) => (k === q.answer ? `${o}*` : o))].join(" | ")).join("\n");
const textToQuiz = (t) => ({ questions: t.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p.length >= 3 && p[0])
  .map(([q, ...opts]) => ({ q, options: opts.map((o) => o.replace(/\*$/, "").trim()), answer: Math.max(0, opts.findIndex((o) => o.endsWith("*"))) })) });
const huroofToText = (d) => Object.entries(d?.letters ?? {}).flatMap(([l, qs]) => qs.map((q) => `${l} | ${q.q} | ${q.a}`)).join("\n");
const textToHuroof = (t) => {
  const letters = {};
  t.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((p) => p.length >= 3 && p[0])
    .forEach(([l, q, a]) => { (letters[l === "هـ" ? "ه" : l] ??= []).push({ q, a }); });
  return { letters };
};

export default function ActivityAdmin() {
  const [cards, setCards] = useState(null);
  const [uses, setUses] = useState([]);
  const [kind, setKind] = useState("waiting");
  const [state, setState] = useState("on");   // on: المفعّلة، off: الموقوفة
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data, error }, { data: u }] = await Promise.all([
      supabase.from("activity_cards").select("*").order("sort").order("created_at"),
      supabase.from("activity_uses").select("card_id, rating, used_on, context"),
    ]);
    if (error) setMsg({ ok: false, t: /activity_cards/.test(error.message) ? "يلزم تشغيل supabase/activities_1.sql و_2 أولًا." : error.message });
    setCards(data ?? []); setUses(u ?? []);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const m = {};
    uses.forEach((u) => { const s = (m[u.card_id] ??= { n: 0, up: 0, down: 0 }); s.n++; if (u.rating === 1) s.up++; if (u.rating === -1) s.down++; });
    return m;
  }, [uses]);

  const importSeed = async () => {
    setBusy(true); setMsg(null);
    const [{ default: w }, { default: c }] = await Promise.all([import("../../activity-content/waiting.js"), import("../../activity-content/classroom.js")]);
    const have = new Set((cards ?? []).map((x) => x.seed_key).filter(Boolean));
    const rows = [...w, ...c].filter((x) => !have.has(x.seed)).map((x, i) => ({
      kind: x.kind, section: x.section, title: x.title, summary: x.summary, duration_min: x.duration_min, goals: x.goals,
      materials: x.materials, steps: x.steps ?? [], grades: x.grades ?? [], game: x.game || null, game_data: x.game_data ?? null,
      seed_key: x.seed, sort: i, published: true }));
    const { error } = rows.length ? await supabase.from("activity_cards").insert(rows) : { error: null };
    setBusy(false);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: rows.length ? `استُوردت ${rows.length} بطاقة جاهزة ونُشرت للمعلمين.` : "البطاقات الجاهزة مستوردة من قبل." });
    load();
  };

  const toggle = async (c) => {
    const { error } = await supabase.from("activity_cards").update({ published: !c.published, updated_at: new Date().toISOString() }).eq("id", c.id);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: c.published
      ? `أُلغي تفعيل «${c.title}»: لا تظهر للمعلمين، وتجدها في «الموقوفة» لتفعيلها متى شئت.`
      : `فُعّلت «${c.title}» وعادت للمعلمين.` });
    load();
  };
  const remove = async (c) => {
    if (!window.confirm(`حذف «${c.title}»؟ يُحذف معه سجل استخدامه.`)) return;
    await supabase.from("activity_cards").delete().eq("id", c.id);
    const paths = [c.cover_path, ...(c.images ?? [])].filter(Boolean);
    if (paths.length) supabase.storage.from(MEDIA_BUCKET).remove(paths);
    load();
  };

  if (!cards) return <Loader compact />;
  if (form) return <Editor init={form} onClose={(saved) => { setForm(null); if (saved) { setMsg({ ok: true, t: "حُفظت البطاقة." }); load(); } }} />;

  const ofKind = cards.filter((c) => c.kind === kind);
  const offN = ofKind.filter((c) => !c.published).length;
  const list = ofKind.filter((c) => (state === "on" ? c.published : !c.published));
  const totalUses = uses.length;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {[["بطاقات الحقيبة", cards.filter((c) => c.kind === "waiting" && c.published).length], ["الأنشطة الصفية", cards.filter((c) => c.kind === "class" && c.published).length],
          ["مرات التنفيذ", totalUses], ["أعجب المعلمين", uses.filter((u) => u.rating === 1).length]].map(([k, v]) => (
          <div key={k} className="card p-3 text-center"><p className="num text-2xl font-bold text-ink">{v}</p><p className="text-xs text-muted">{k}</p></div>
        ))}
      </div>
      {msg && <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-card border border-line bg-paper p-1">
          {[["waiting", "حقيبة الانتظار"], ["class", "الأنشطة الصفية"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-pill px-4 py-1.5 text-[13px] ${kind === k ? "bg-mint-deep font-semibold text-white" : "text-muted"}`}>{l}</button>
          ))}
        </div>
        <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY, kind, section: sectionsOf(kind)[0].key, duration_min: kind === "waiting" ? 45 : 10 })}>+ بطاقة جديدة</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={importSeed}>{busy ? "جارٍ الاستيراد…" : "استيراد البطاقات الجاهزة"}</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[["on", "المفعّلة", ofKind.length - offN], ["off", "الموقوفة", offN]].map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setState(k)}
                  className={`rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium ${state === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {l} <span className="num">({n})</span>
          </button>
        ))}
        {state === "off" && <span className="self-center text-xs text-muted">الموقوفة لا تظهر للمعلمين، وتبقى بسجل استخدامها حتى تُفعَّل.</span>}
      </div>
      <div className="card divide-y divide-line/60">
        {!list.length && <p className="p-6 text-center text-sm text-muted">{state === "off" ? "لا بطاقات موقوفة."
          : ofKind.length ? "كل البطاقات موقوفة." : "لا بطاقات بعد — ابدأ بـ«استيراد البطاقات الجاهزة»."}</p>}
        {list.map((c) => {
          const s = stats[c.id], meta = sectionMeta(c.kind, c.section);
          return (
            <div key={c.id} className={`flex flex-wrap items-center gap-3 p-2.5 ${c.published ? "" : "opacity-70"}`}>
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[6px]"><Cover card={c} className="h-12" /></div>
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setView(c)}>
                <p className="truncate text-sm font-semibold text-ink">{c.title} {c.game && <span className="text-[11px] text-mint-deep">▶ {GAMES[c.game]}</span>}</p>
                <p className="text-[11px] text-muted">{meta.emoji} {meta.label}{s ? ` · نُفّذ ${s.n} · 👍 ${s.up} · 👎 ${s.down}` : " · لم يُنفَّذ بعد"}</p>
              </button>
              <button type="button" onClick={() => toggle(c)} title={c.published ? "تُخفى عن المعلمين وتبقى لتُفعَّل لاحقًا" : "تعود للمعلمين"}
                      className={`shrink-0 rounded-pill px-3 py-1 text-xs font-semibold ${c.published
                        ? "border border-late/40 text-late hover:bg-late/5" : "bg-mint-deep text-white"}`}>
                {c.published ? "إلغاء التفعيل" : "تفعيل"}
              </button>
              <button type="button" className="text-xs text-mint-deep underline" onClick={() => setForm({ ...EMPTY, ...c, subject: c.subject ?? "", video_url: c.video_url ?? "", game: c.game ?? "" })}>تعديل</button>
              <button type="button" className="text-xs text-absent underline" onClick={() => remove(c)}>حذف</button>
            </div>
          );
        })}
      </div>
      {view && <CardView card={view} onClose={() => setView(null)} />}
    </div>
  );
}

// خارج المحرّر: تعريفه داخله يعيد إنشاء الحقول مع كل حرف فتفقد التركيز
const L = ({ t, children, className = "" }) => <label className={`block text-xs text-muted ${className}`}>{t}<div className="mt-1">{children}</div></label>;

function Editor({ init, onClose }) {
  const [f, setF] = useState(init);
  const [gameText, setGameText] = useState(() => (init.game === "huroof" ? huroofToText(init.game_data) : quizToText(init.game_data)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setStep = (i, k, v) => set("steps", f.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  const upload = async (file) => {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${f.kind}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type });
    if (error) { setErr(`تعذّر رفع الصورة: ${error.message}`); return null; }
    return path;
  };

  const save = async () => {
    if (!f.title.trim()) { setErr("اكتب عنوان البطاقة."); return; }
    if (f.video_url && !/^https?:\/\//.test(f.video_url)) { setErr("رابط الفيديو يبدأ بـ https://"); return; }
    const game_data = f.game === "huroof" ? textToHuroof(gameText) : f.game === "teams_quiz" ? textToQuiz(gameText) : null;
    if (f.game === "huroof" && Object.keys(game_data.letters).length < 25) { setErr("لعبة حروف تحتاج أسئلة لـ25 حرفًا على الأقل."); return; }
    if (f.game === "teams_quiz" && !game_data.questions.length) { setErr("أضف أسئلة المسابقة."); return; }
    const row = { kind: f.kind, section: f.section, title: f.title.trim(), summary: f.summary || null, duration_min: Number(f.duration_min) || null,
      goals: f.goals || null, materials: f.materials || null, steps: f.steps.filter((s) => s.text?.trim()).map((s) => ({ min: Number(s.min) || null, text: s.text.trim() })),
      grades: f.grades, subject: f.kind === "class" ? f.subject || null : null, video_url: f.video_url || null, cover_path: f.cover_path,
      images: f.images, game: f.game || null, game_data, published: f.published, updated_at: new Date().toISOString() };
    setBusy(true); setErr("");
    const { error } = f.id ? await supabase.from("activity_cards").update(row).eq("id", f.id) : await supabase.from("activity_cards").insert(row);
    setBusy(false);
    if (error) setErr(error.message); else onClose(true);
  };

  return (
    <div className="card space-y-4 p-4">
      <p className="font-bold text-ink">{f.id ? "تعديل بطاقة" : "بطاقة جديدة"} — {f.kind === "waiting" ? "حقيبة الانتظار" : "الأنشطة الصفية"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <L t="القسم"><select className="field" value={f.section} onChange={(e) => set("section", e.target.value)}>
          {sectionsOf(f.kind).map((s) => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}</select></L>
        <L t="المدة (دقيقة)"><input type="number" className="field num" value={f.duration_min ?? ""} onChange={(e) => set("duration_min", e.target.value)} /></L>
        <L t="العنوان" className="sm:col-span-2"><input className="field" value={f.title} onChange={(e) => set("title", e.target.value)} /></L>
        <L t="وصف مختصر" className="sm:col-span-2"><input className="field" value={f.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></L>
        <L t="الهدف"><textarea rows={2} className="field" value={f.goals ?? ""} onChange={(e) => set("goals", e.target.value)} /></L>
        <L t="الأدوات"><textarea rows={2} className="field" value={f.materials ?? ""} onChange={(e) => set("materials", e.target.value)} /></L>
        <L t="الصفوف (بلا اختيار = الكل)"><div className="flex gap-1.5">{[1, 2, 3].map((g) => (
          <button key={g} type="button" onClick={() => set("grades", f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g])}
            className={`rounded-pill px-3 py-1 text-xs ${f.grades.includes(g) ? "bg-mint-deep text-white" : "border border-line"}`}>{["", "الأول", "الثاني", "الثالث"][g]}</button>))}</div></L>
        {f.kind === "class" && <L t="المادة (فارغ = كل المواد)"><input className="field" value={f.subject} onChange={(e) => set("subject", e.target.value)} /></L>}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-ink">الخطوات</p>
        {f.steps.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input type="number" className="field num w-20" placeholder="د" value={s.min ?? ""} onChange={(e) => setStep(i, "min", e.target.value)} />
            <input className="field flex-1" value={s.text} onChange={(e) => setStep(i, "text", e.target.value)} />
            <button type="button" className="text-absent" onClick={() => set("steps", f.steps.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="text-xs text-mint-deep underline" onClick={() => set("steps", [...f.steps, { min: "", text: "" }])}>+ خطوة</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <L t="صورة الغلاف">
          <div className="flex items-center gap-2">
            <div className="h-14 w-20 overflow-hidden rounded-[6px]"><Cover card={f} className="h-14" /></div>
            <input type="file" accept="image/*" className="text-xs" onChange={async (e) => { const p = e.target.files?.[0] && await upload(e.target.files[0]); if (p) set("cover_path", p); }} />
          </div>
        </L>
        <L t="رابط فيديو (يوتيوب أو غيره)"><input className="field" dir="ltr" placeholder="https://youtu.be/…" value={f.video_url} onChange={(e) => set("video_url", e.target.value)} /></L>
        <L t="صور إضافية" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {f.images.map((p) => (
              <span key={p} className="relative"><img src={mediaUrl(p)} alt="" className="h-14 w-20 rounded-[6px] object-cover" />
                <button type="button" className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-absent text-[10px] text-white" onClick={() => set("images", f.images.filter((x) => x !== p))}>✕</button></span>
            ))}
            <input type="file" accept="image/*" multiple className="text-xs" onChange={async (e) => {
              const ps = []; for (const file of e.target.files ?? []) { const p = await upload(file); if (p) ps.push(p); }
              set("images", [...f.images, ...ps]);
            }} />
          </div>
        </L>
      </div>

      {f.kind === "waiting" && (
        <div className="space-y-2 rounded-card border border-line p-3">
          <L t="لعبة على السبورة"><select className="field" value={f.game} onChange={(e) => { set("game", e.target.value); setGameText(""); }}>
            <option value="">بلا لعبة</option>{Object.entries(GAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></L>
          {f.game && (
            <L t={f.game === "huroof" ? "الأسئلة: سطر لكل سؤال «الحرف | السؤال | الجواب» — جواب يبدأ بالحرف، ولـ25 حرفًا على الأقل"
              : "الأسئلة: سطر لكل سؤال «السؤال | خيار | خيار* | خيار» — ضع * بعد الخيار الصحيح"}>
              <textarea rows={10} className="field font-mono text-xs" value={gameText} onChange={(e) => setGameText(e.target.value)} />
            </L>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} /> مفعّلة (تظهر للمعلمين)</label>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
        <button type="button" className="btn-ghost" onClick={() => onClose(false)}>إلغاء</button>
      </div>
    </div>
  );
}
