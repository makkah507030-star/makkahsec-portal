// src/pages/activities/ActivityAdmin.jsx
// إدارة بنك الأنشطة (وكيل الشؤون التعليمية): استيراد البطاقات الجاهزة، وإضافة البطاقات
// وتعديلها بصورها وروابط الفيديو وأسئلة الألعاب، وتفعيلها وتعطيلها (بطاقةً أو قسمًا كاملًا)
// فتبقى المعطّلة محفوظة للاستفادة منها لاحقًا، وتقرير الاستخدام.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GAMES, MEDIA_BUCKET, mediaUrl, sectionMeta, sectionsOf } from "../../lib/activities.js";
import Loader from "../../components/Loader.jsx";
import { activeYear } from "../../lib/performance.js";
import { Cover, CardView } from "./ActivityBank.jsx";
import ActivityReport from "./ActivityReport.jsx";

const EMPTY = { kind: "waiting", section: "games", title: "", summary: "", duration_min: 45, goals: "", materials: "",
  steps: [{ min: 5, text: "" }], grades: [], subject: "", video_url: "", cover_path: null, images: [], game: "", game_data: null, published: true, emoji: "" };

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
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState("all");   // كل البطاقات، أو المفعّلة، أو المعطّلة

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
      emoji: x.emoji ?? null, seed_key: x.seed, sort: i, published: true }));
    const { error } = rows.length ? await supabase.from("activity_cards").insert(rows) : { error: null };
    setBusy(false);
    setMsg(error ? { ok: false, t: error.message } : { ok: true, t: rows.length ? `استُوردت ${rows.length} بطاقة جاهزة ونُشرت للمعلمين.` : "البطاقات الجاهزة مستوردة من قبل." });
    load();
  };

  // التفعيل والتعطيل: المعطّلة تختفي عن المعلمين وتبقى بكل محتواها وسجل استخدامها
  const setActive = async (ids, on) => {
    if (!ids.length) return;
    setCards((cs) => cs.map((c) => (ids.includes(c.id) ? { ...c, published: on } : c)));
    const { error } = await supabase.from("activity_cards").update({ published: on, updated_at: new Date().toISOString() }).in("id", ids);
    if (error) setMsg({ ok: false, t: error.message });
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

  const tabsBar = (
    <div className="inline-flex rounded-card border border-line bg-paper p-1">
      {[["waiting", "حقيبة الانتظار"], ["class", "الأنشطة الصفية"], ["usage", "استخدام المعلمين"]].map(([k, l]) => (
        <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-pill px-4 py-1.5 text-[13px] ${kind === k ? "bg-mint-deep font-semibold text-white" : "text-muted"}`}>{l}</button>
      ))}
    </div>
  );
  if (kind === "usage") return <div className="space-y-4">{tabsBar}<UsageReport /></div>;

  const all = cards.filter((c) => c.kind === kind);
  const list = all.filter((c) => show === "all" || (show === "on") === c.published);
  const groups = [...sectionsOf(kind).map((s) => s.key), ...new Set(all.map((c) => c.section))]
    .filter((k, i, a) => a.indexOf(k) === i)
    .map((k) => ({ meta: sectionMeta(kind, k), items: list.filter((c) => c.section === k), whole: all.filter((c) => c.section === k) }))
    .filter((g) => g.items.length);
  const totalUses = uses.length;
  const onOf = (k) => [cards.filter((c) => c.kind === k && c.published).length, cards.filter((c) => c.kind === k).length];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {[["بطاقات الحقيبة المفعّلة", ...onOf("waiting")], ["الأنشطة الصفية المفعّلة", ...onOf("class")],
          ["مرات التنفيذ", totalUses], ["أعجب المعلمين", uses.filter((u) => u.rating === 1).length]].map(([k, v, of]) => (
          <div key={k} className="card p-3 text-center"><p className="text-2xl font-bold text-ink"><span className="num">{v}</span>
            {of != null && <span className="text-sm font-normal text-muted"> من <span className="num">{of}</span></span>}</p><p className="text-xs text-muted">{k}</p></div>
        ))}
      </div>
      {msg && <p className={`rounded-card px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {tabsBar}
        <button type="button" className="btn-primary" onClick={() => setForm({ ...EMPTY, kind, section: sectionsOf(kind)[0].key, duration_min: kind === "waiting" ? 45 : 10 })}>+ بطاقة جديدة</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={importSeed}>{busy ? "جارٍ الاستيراد…" : "استيراد البطاقات الجاهزة"}</button>
        <select className="field ms-auto w-auto py-1.5 text-sm" value={show} onChange={(e) => setShow(e.target.value)}>
          <option value="all">كل البطاقات</option><option value="on">المفعّلة</option><option value="off">المعطّلة</option>
        </select>
      </div>
      <p className="text-xs text-muted">البطاقة المعطّلة تختفي عن المعلمين وتبقى محفوظة بمحتواها وسجل استخدامها، فتُفعَّل متى احتجتها. ويمكن تعطيل قسم كامل من زر القسم.</p>
      {!all.length && <p className="card p-6 text-center text-sm text-muted">لا بطاقات بعد — ابدأ بـ«استيراد البطاقات الجاهزة».</p>}
      {all.length > 0 && !groups.length && <p className="card p-6 text-center text-sm text-muted">لا بطاقات {show === "on" ? "مفعّلة" : "معطّلة"}.</p>}
      {groups.map(({ meta, items, whole }) => {
        const on = whole.filter((c) => c.published).length;
        return (
      <div key={meta.key} className="card divide-y divide-line/60">
        <div className="flex flex-wrap items-center gap-2 bg-canvas/60 px-3 py-2">
          <p className="flex-1 text-sm font-bold text-ink">{meta.emoji} {meta.label} <span className="text-xs font-normal text-muted">· مفعّلة {on} من {whole.length}</span></p>
          {on < whole.length && <button type="button" className="chip bg-present/10 text-present" onClick={() => setActive(whole.filter((c) => !c.published).map((c) => c.id), true)}>تفعيل القسم كله</button>}
          {on > 0 && <button type="button" className="chip bg-absent/10 text-absent" onClick={() => {
            if (window.confirm(`تعطيل قسم «${meta.label}» كله؟ تختفي بطاقاته (${on}) عن المعلمين وتبقى محفوظة لتفعيلها لاحقًا.`)) setActive(whole.filter((c) => c.published).map((c) => c.id), false);
          }}>تعطيل القسم كله</button>}
        </div>
        {items.map((c) => {
          const s = stats[c.id];
          return (
            <div key={c.id} className={`flex items-center gap-3 p-2.5 ${c.published ? "" : "bg-canvas/40"}`}>
              <div className={`h-12 w-16 shrink-0 overflow-hidden rounded-[6px] ${c.published ? "" : "opacity-40 grayscale"}`}><Cover card={c} className="h-12" /></div>
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => setView(c)}>
                <p className={`truncate text-sm font-semibold ${c.published ? "text-ink" : "text-muted"}`}>{c.title} {c.game && <span className="text-[11px] text-mint-deep">▶ {GAMES[c.game]}</span>}</p>
                <p className="text-[11px] text-muted">{s ? `نُفّذ ${s.n} · 👍 ${s.up} · 👎 ${s.down}` : "لم يُنفَّذ بعد"}</p>
              </button>
              <Switch on={c.published} onChange={(v) => setActive([c.id], v)} />
              <button type="button" className="text-xs text-mint-deep underline" onClick={() => setForm({ ...EMPTY, ...c, subject: c.subject ?? "", video_url: c.video_url ?? "", game: c.game ?? "", emoji: c.emoji ?? "" })}>تعديل</button>
              <button type="button" className="text-xs text-absent underline" onClick={() => remove(c)}>حذف</button>
            </div>
          );
        })}
      </div>
        );
      })}
      {view && <CardView card={view} onClose={() => setView(null)} />}
    </div>
  );
}

// تقرير الوكيل: استخدام كل معلم للأنشطة في العام الدراسي، وهو ما يُحتسب في شواهد أدائه
// (أيام لا مرات: 4-2 الصفية، و8-4 كل نشاط ونقاط الدوري، و9-5 التعاونية) — supabase/activities_4.sql
function UsageReport() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [sort, setSort] = useState("days");
  const [q, setQ] = useState("");
  const [cardsBy, setCardsBy] = useState({});   // البطاقات التي استخدمها كل معلم (activities_6.sql)
  const [open, setOpen] = useState(null);
  const [report, setReport] = useState(false);
  useEffect(() => {
    (async () => {
      const year = await activeYear();
      const [{ data, error }, { data: cr }] = await Promise.all([
        supabase.rpc("act_usage_report", { p_year: year }),
        supabase.rpc("act_cards_report", { p_year: year }),
      ]);
      if (error) setErr(/act_usage_report/.test(error.message) ? "التقرير يحتاج تشغيل supabase/activities_4.sql." : error.message);
      setCardsBy(Object.fromEntries((cr?.teachers ?? []).map((t) => [t.uid, t.cards])));
      setRows(data ?? []);
    })();
  }, []);
  const list = useMemo(() => {
    const m = new Map();   // معلم واحد لكل حساب
    (rows ?? []).forEach((r) => { if (!m.has(r.user_id) || r.days > m.get(r.user_id).days) m.set(r.user_id, r); });
    return [...m.values()].filter((r) => !q.trim() || (r.name ?? "").includes(q.trim()))
      .sort((a, b) => (sort === "name" ? (a.name ?? "").localeCompare(b.name ?? "", "ar") : (b[sort] ?? 0) - (a[sort] ?? 0) || (a.name ?? "").localeCompare(b.name ?? "", "ar")));
  }, [rows, sort, q]);
  if (!rows) return <Loader compact />;
  if (report) return <ActivityReport teachers={list.length} onBack={() => setReport(false)} />;
  const users = list.filter((r) => r.days > 0).length;
  const cols = [["days", "أيام الأنشطة"], ["class_days", "صفية (4-2)"], ["waiting_days", "انتظار"], ["coop_days", "تعاونية (9-5)"], ["league_days", "الدوري والكأس"], ["uses", "مرات التنفيذ"]];
  return (
    <div className="space-y-3">
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        {[["معلمون استخدموا الأنشطة", users, list.length], ["أيام أنشطة (للكل)", list.reduce((n, r) => n + r.days, 0)], ["لم يستخدموها بعد", list.length - users]].map(([k, v, of]) => (
          <div key={k} className="card p-3 text-center"><p className="text-2xl font-bold text-ink"><span className="num">{v}</span>
            {of != null && <span className="text-sm font-normal text-muted"> من <span className="num">{of}</span></span>}</p><p className="text-xs text-muted">{k}</p></div>
        ))}
      </div>
      <p className="text-xs text-muted">يُحتسب اليوم مرة واحدة مهما تعدّدت أنشطته، وهي الأرقام نفسها التي تظهر شواهدَ في ملف أداء المعلم: 4-2 تنويع الاستراتيجيات، و8-4 الأنشطة المتنوعة (كل نشاط ونقاط الدوري)، و9-5 العمل بالمجموعات.</p>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <input className="field w-auto flex-1 py-1.5 text-sm sm:max-w-xs" placeholder="بحث باسم المعلم…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn-ghost py-1.5 text-sm" onClick={() => window.print()}>طباعة</button>
        <button type="button" className="btn-primary py-1.5 text-sm" onClick={() => setReport(true)}>التقرير الشامل للبطاقات</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-xs text-muted">
            <tr>
              <th className="cursor-pointer p-2 text-start" onClick={() => setSort("name")}>المعلم{sort === "name" ? " ▾" : ""}</th>
              {cols.map(([k, l]) => <th key={k} className="cursor-pointer whitespace-nowrap p-2" onClick={() => setSort(k)}>{l}{sort === k ? " ▾" : ""}</th>)}
              <th className="whitespace-nowrap p-2">👍</th>
              <th className="whitespace-nowrap p-2">آخر نشاط</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {list.map((r) => {
              const used = cardsBy[r.user_id] ?? [];
              const isOpen = open === r.user_id;
              return [
              <tr key={r.user_id} className={`${r.days ? "" : "text-muted"} ${used.length ? "cursor-pointer hover:bg-canvas" : ""}`}
                  onClick={() => used.length && setOpen(isOpen ? null : r.user_id)}>
                <td className="p-2 font-semibold">
                  {r.name ?? "—"}
                  {used.length > 0 && <span className="mr-2 text-xs font-normal text-mint-deep">{isOpen ? "▴" : "▾"} {used.length === 1 ? "بطاقة واحدة" : used.length === 2 ? "بطاقتان"
                    : <><span className="num">{used.length}</span> {used.length <= 10 ? "بطاقات" : "بطاقة"}</>}</span>}
                </td>
                {cols.map(([k]) => <td key={k} className={`num p-2 text-center ${k === "days" && r.days ? "font-bold text-mint-deep" : ""}`}>{r[k] || "—"}</td>)}
                <td className="num p-2 text-center">{r.likes || "—"}</td>
                <td className="num whitespace-nowrap p-2 text-center text-xs">{r.last_on ? new Date(r.last_on).toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "short" }) : "—"}</td>
              </tr>,
              isOpen && (
                <tr key={`${r.user_id}-cards`} className="bg-mint-tint/40">
                  <td colSpan={cols.length + 3} className="p-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {used.map((c) => (
                        <span key={c.title} className="chip bg-white text-ink ring-1 ring-line">
                          {c.title}{c.n > 1 && <span className="mr-1 text-mint-deep">· {c.n === 2 ? "مرتان" : <><span className="num">{c.n}</span> {c.n <= 10 ? "مرات" : "مرة"}</>}</span>}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ),
              ];
            })}
          </tbody>
        </table>
        {!list.length && <p className="p-6 text-center text-sm text-muted">لا معلمين.</p>}
      </div>
    </div>
  );
}

// مفتاح التفعيل: مفعّلة تظهر للمعلمين، ومعطّلة محفوظة دون أن تظهر
function Switch({ on, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
            className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold" title={on ? "اضغط للتعطيل" : "اضغط للتفعيل"}>
      <span className={on ? "text-present" : "text-muted"}>{on ? "مفعّلة" : "معطّلة"}</span>
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-present" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "right-0.5" : "right-[18px]"}`} />
      </span>
    </button>
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
      images: f.images, game: f.game || null, game_data, published: f.published, emoji: f.emoji?.trim() || null, updated_at: new Date().toISOString() };
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
        <L t="أيقونة البطاقة (رمز تعبيري واحد، مثل 🎯 أو 🧪)"><input className="field text-xl" maxLength={8} placeholder={sectionMeta(f.kind, f.section).emoji} value={f.emoji ?? ""} onChange={(e) => set("emoji", e.target.value)} /></L>
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
