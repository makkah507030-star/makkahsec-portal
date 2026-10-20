// src/pages/activities/ActivityBank.jsx
// تصفّح بنك الأنشطة (حقيبة الانتظار أو الأنشطة الصفية): أقسام وبطاقات بصور الغلاف،
// وعرض البطاقة بخطواتها وصورها ورابط الفيديو، وتشغيل اللعبة على السبورة، وتسجيل التنفيذ.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { GAMES, mediaUrl, sectionMeta, sectionsOf, youtubeId } from "../../lib/activities.js";
import Loader from "../../components/Loader.jsx";
import GameHost from "./games/GameHost.jsx";
import { FloatPortal, canPin, useFloatWindow } from "./FloatWindow.jsx";
import { Timer } from "./ClassTools.jsx";

// غلاف البطاقة بلا صورة: أيقونة النشاط الملوّنة في دائرة بيضاء على لون قسمه الفاتح
export function Cover({ card, className = "h-28" }) {
  const meta = sectionMeta(card.kind, card.section);
  const img = mediaUrl(card.cover_path);
  const small = /\bh-(1[0-6]|[0-9])\b/.test(className);   // مصغّرات قائمة الإدارة
  return img ? <img src={img} alt="" className={`${className} w-full object-cover`} />
    : (
      <div className={`${className} relative grid w-full place-items-center overflow-hidden ${meta.soft}`}>
        {!small && <>
          <span className="absolute -left-6 -top-8 h-24 w-24 rounded-full bg-white/50" />
          <span className="absolute -bottom-10 -right-4 h-28 w-28 rounded-full bg-white/40" />
        </>}
        <span className={`relative grid place-items-center rounded-full bg-white ring-2 ${meta.ring} ${small ? "h-8 w-8 text-lg" : "h-[4.5rem] w-[4.5rem] text-4xl shadow-sm"}`}>
          {card.emoji || meta.emoji}
        </span>
      </div>
    );
}

export default function ActivityBank({ kind, teacher }) {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState("");
  const [sec, setSec] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [classes, setClasses] = useState([]);
  const [forClass, setForClass] = useState("");    // حصة الانتظار: الفصل الحالي لاقتراح ما لم يُقدَّم له
  const [used, setUsed] = useState(new Set());
  const float = useFloatWindow();
  const [floatCard, setFloatCard] = useState(null);
  const openFloat = async (card) => { if (await float.open(card.title, 400, 600)) setFloatCard(card); };

  useEffect(() => {
    supabase.from("activity_cards").select("*").eq("kind", kind).eq("published", true)
      .order("sort").order("created_at")
      .then(({ data, error }) => {
        if (error) setErr(/activity_cards/.test(error.message) ? "بنك الأنشطة لم يُفعَّل بعد (supabase/activities_1.sql)." : error.message);
        setCards(data ?? []);
      });
    supabase.from("classes").select("id, class_no, grade").eq("is_active", true).order("grade").order("class_no")
      .then(({ data }) => setClasses(data ?? []));
  }, [kind]);

  useEffect(() => {
    if (!forClass) { setUsed(new Set()); return; }
    supabase.rpc("activity_class_used", { p_class: forClass }).then(({ data }) => setUsed(new Set((data ?? []).map((x) => x.activity_class_used ?? x))));
  }, [forClass]);

  // الأقسام التي فيها بطاقات مفعّلة فقط: القسم المعطّل كله لا يظهر للمعلمين
  const secs = useMemo(() => sectionsOf(kind).filter((s) => (cards ?? []).some((c) => c.section === s.key)), [kind, cards]);
  const list = useMemo(() => {
    const t = q.trim();
    const order = (c) => secs.findIndex((s) => s.key === c.section);
    return (cards ?? [])
      .filter((c) => (sec === "all" || c.section === sec) && (!t || `${c.title} ${c.summary ?? ""}`.includes(t)))
      .sort((a, b) => (used.has(a.id) - used.has(b.id)) || (order(a) - order(b)) || (a.sort - b.sort));
  }, [cards, sec, q, used, secs]);

  if (!cards) return <Loader compact />;
  return (
    <div className="space-y-4">
      {kind === "waiting" && (
        <div className="rounded-card bg-mint-tint px-4 py-3 text-sm leading-relaxed text-ink">
          <b>حصة الانتظار للترفيه:</b> أنشطة تخفف عن الطلاب ضغط الحصص{secs.length ? ` — ${secs.map((s) => s.label).join("، و")}` : ""}. اختر واحدة وابدأ خلال دقيقة.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-1.5 overflow-x-auto">
          <Chip on={sec === "all"} onClick={() => setSec("all")}>الكل</Chip>
          {secs.map((s) => <Chip key={s.key} on={sec === s.key} onClick={() => setSec(s.key)}>{s.emoji} {s.label}</Chip>)}
        </div>
        <input className="field w-auto flex-1 py-1.5 text-sm sm:max-w-xs" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} />
        {kind === "waiting" && teacher && (
          <select className="field w-auto py-1.5 text-sm" value={forClass} onChange={(e) => setForClass(e.target.value)}>
            <option value="">الفصل الذي أنتظر فيه…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{GRADE_NAMES[c.grade] ?? ""} — {c.class_no}</option>)}
          </select>
        )}
      </div>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!list.length ? (
        <p className="card p-6 text-center text-sm text-muted">{cards.length ? "لا نتائج." : "لم تُنشر أنشطة بعد."}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const meta = sectionMeta(kind, c.section);
            return (
              <button key={c.id} type="button" onClick={() => setOpen(c)}
                      className={`card overflow-hidden text-start transition-shadow hover:shadow-lg ${used.has(c.id) ? "opacity-60" : ""}`}>
                <div className="relative">
                  <Cover card={c} />
                  {c.game && <span className="absolute right-2 top-2 rounded-pill bg-white/95 px-2 py-0.5 text-[11px] font-bold text-mint-deep">▶ {GAMES[c.game]}</span>}
                  {used.has(c.id) && <span className="absolute left-2 top-2 rounded-pill bg-black/60 px-2 py-0.5 text-[11px] text-white">قُدّمت لهذا الفصل</span>}
                </div>
                <div className="space-y-1 p-3">
                  <p className="font-bold text-ink">{c.title}</p>
                  {c.summary && <p className="line-clamp-2 text-xs leading-relaxed text-muted">{c.summary}</p>}
                  <p className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                    <span className="chip bg-canvas text-muted">{meta.emoji} {meta.label}</span>
                    {c.duration_min && <span className="chip bg-canvas text-muted">{c.duration_min} دقيقة</span>}
                    {c.video_url && <span className="chip bg-canvas text-muted">▶ فيديو</span>}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {float.win && floatCard && <FloatingCard key={floatCard.id} card={floatCard} win={float.win} />}
      {open && <CardView card={open} teacher={teacher} classes={classes} defaultClass={forClass}
                         onFloat={openFloat} floating={float.win && floatCard?.id === open.id}
                         onUsed={(cid) => cid === forClass && setUsed((s) => new Set([...s, open.id]))} onClose={() => setOpen(null)} />}
    </div>
  );
}

const Chip = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick}
          className={`shrink-0 whitespace-nowrap rounded-pill px-3 py-1 text-xs font-semibold ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:text-ink"}`}>
    {children}
  </button>
);

// خطوات النشاط الصفي ومؤقت في النافذة العائمة: يبقى مفتوحًا بعد إغلاق البطاقة
function FloatingCard({ card, win }) {
  const [step, setStep] = useState(0);
  const meta = sectionMeta(card.kind, card.section);
  return (
    <FloatPortal win={win}>
      <div className="space-y-2">
        <p className="px-1 text-base font-bold text-ink">{meta.emoji} {card.title}</p>
        <ol className="space-y-1.5">
          {(card.steps ?? []).map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => setStep(i)}
                      className={`flex w-full gap-2 rounded-card px-2.5 py-2 text-start text-sm ${i === step ? "bg-mint-deep text-white" : i < step ? "bg-paper text-faint line-through" : "bg-paper text-ink"}`}>
                <span className="num font-bold">{i + 1}</span>
                <span className="flex-1 leading-relaxed">{s.text}{s.min ? ` (${s.min} د)` : ""}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1 py-1.5 text-sm" disabled={step === 0} onClick={() => setStep((x) => x - 1)}>السابقة</button>
          <button type="button" className="btn-primary flex-1 py-1.5 text-sm" disabled={step >= (card.steps?.length ?? 1) - 1} onClick={() => setStep((x) => x + 1)}>التالية</button>
        </div>
        <Timer />
      </div>
    </FloatPortal>
  );
}

export function CardView({ card, teacher, classes = [], defaultClass = "", onUsed, onClose, onFloat, floating }) {
  const [game, setGame] = useState(false);
  const [cls, setCls] = useState(defaultClass);
  const [done, setDone] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);   // بعد الخروج من اللعبة: تذكير بتسجيل التنفيذ ليُحتسب شاهدًا
  const meta = sectionMeta(card.kind, card.section);
  const yt = youtubeId(card.video_url);

  const markUsed = async (rating) => {
    setBusy(true);
    const { error } = await supabase.from("activity_uses").insert({ card_id: card.id, class_id: cls || null, context: card.kind, rating });
    setBusy(false);
    setDone(error ? { ok: false, t: error.message } : { ok: true, t: "سُجّل التنفيذ ✓ — يُحتسب في شواهد ملف أدائك." });
    if (!error) onUsed?.(cls);
  };

  if (game) return <GameHost card={card} onClose={() => { setGame(false); if (teacher && !done) setAsk(true); }} />;

  const record = (
    <>
      <select className="field text-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
        <option value="">الفصل (اختياري)</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{GRADE_NAMES[c.grade] ?? ""} — {c.class_no}</option>)}
      </select>
      {done ? <p className={`text-sm ${done.ok ? "text-present" : "text-absent"}`}>{done.t}</p> : (
        <div className="flex gap-2">
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={() => markUsed(1)}>👍 نُفّذ وأعجبني</button>
          <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={() => markUsed(-1)}>👎 نُفّذ ولم يناسب</button>
        </div>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-6" onClick={onClose}>
      <div className="card mx-auto max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="relative">
          <Cover card={card} className="h-44" />
          <button type="button" onClick={onClose} className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink">✕</button>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <p className="text-xs text-muted">{meta.emoji} {meta.label}{card.duration_min ? ` · ${card.duration_min} دقيقة` : ""}{card.subject ? ` · ${card.subject}` : ""}</p>
            <h2 className="mt-1 text-xl font-bold text-ink">{card.title}</h2>
            {card.summary && <p className="mt-1 text-sm leading-relaxed text-muted">{card.summary}</p>}
          </div>
          {card.kind === "class" && onFloat && (
            <button type="button" className="btn-primary w-full py-2.5" title="تبقى فوق عرض الدرس لتعود إليها متى احتجت"
                    onClick={() => onFloat(card)}>
              🪟 {floating ? "مفتوح في نافذة عائمة" : `افتح في نافذة عائمة${canPin() ? " فوق عرض الدرس" : ""}`}
            </button>
          )}
          {card.game && (
            <button type="button" className="btn-primary w-full py-3 text-base" onClick={() => setGame(true)}>▶ ابدأ «{GAMES[card.game]}» على السبورة</button>
          )}
          {(card.goals || card.materials) && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {card.goals && <div className="rounded-card bg-canvas p-3"><dt className="text-xs font-semibold text-muted">الهدف</dt><dd className="mt-1 whitespace-pre-line text-ink">{card.goals}</dd></div>}
              {card.materials && <div className="rounded-card bg-canvas p-3"><dt className="text-xs font-semibold text-muted">الأدوات</dt><dd className="mt-1 whitespace-pre-line text-ink">{card.materials}</dd></div>}
            </dl>
          )}
          {card.steps?.length > 0 && (
            <ol className="space-y-2">
              {card.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-deep text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 leading-relaxed text-ink">{s.text}{s.min ? <span className="num mr-1 text-xs text-faint">({s.min} د)</span> : null}</span>
                </li>
              ))}
            </ol>
          )}
          {card.images?.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {card.images.map((p) => <a key={p} href={mediaUrl(p)} target="_blank" rel="noreferrer"><img src={mediaUrl(p)} alt="" className="h-28 w-full rounded-card object-cover" /></a>)}
            </div>
          )}
          {card.video_url && (
            <a href={card.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-card border border-line p-2 hover:bg-canvas">
              {yt ? <img src={`https://img.youtube.com/vi/${yt}/mqdefault.jpg`} alt="" className="h-16 w-28 rounded-[6px] object-cover" />
                : <span className="grid h-16 w-28 place-items-center rounded-[6px] bg-canvas text-2xl">▶</span>}
              <span className="text-sm font-semibold text-mint-deep">مشاهدة الفيديو<span className="block text-xs font-normal text-muted">يحتاج إنترنت على جهاز العرض</span></span>
            </a>
          )}
          {teacher && (
            <div className="space-y-2 rounded-card border border-line p-3">
              <p className="text-sm font-semibold text-ink">نفّذت هذا النشاط؟ <span className="text-xs font-normal text-muted">سجّله ليُحتسب في شواهد ملف أدائك</span></p>
              {record}
            </div>
          )}
        </div>
      </div>
      {ask && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-black/50 p-4" onClick={(e) => { e.stopPropagation(); setAsk(false); }}>
          <div className="card w-full max-w-sm space-y-3 p-4" onClick={(e) => e.stopPropagation()} dir="rtl">
            <p className="font-bold text-ink">سجّل تنفيذ «{card.title}»</p>
            <p className="text-sm text-muted">ليُحتسب لك شاهدًا في ملف الأداء (الأنشطة المتنوعة). اختر الفصل وقيّم النشاط.</p>
            {record}
            <button type="button" className="w-full text-center text-sm text-muted underline" onClick={() => setAsk(false)}>{done?.ok ? "إغلاق" : "لاحقًا"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
