// src/pages/outreach/OutreachView.jsx
// النشرة أو الاستبانة كما يراها المستلم (/o/:id): المحتوى بصوره ومقاطعه وروابطه، و«تم الاطلاع»،
// ونموذج الإجابة. يُسجَّل الفتح تلقائيًا. ويراها المرسل معاينةً بلا إجابة.
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate, fmtDateTime } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import { KIND, QTYPES, mediaUrls, setupMsg, youtubeId } from "../../lib/outreach.js";

/* المحتوى نفسه: للمستلم، ولمعاينة المرسل قبل الإرسال */
export function ItemBody({ item, urls = {}, children }) {
  const k = KIND[item.kind];
  const imgs = item.media.filter((m) => m.type === "image");
  const vids = item.media.filter((m) => m.type === "video");
  const files = item.media.filter((m) => m.type === "file");
  const yt = item.links.map((l) => ({ ...l, yt: youtubeId(l.url) }));
  return (
    <article className="overflow-hidden rounded-card border border-line bg-white shadow-card">
      <header className="px-5 pb-4 pt-5 text-white" style={{ background: `linear-gradient(135deg, ${k.c}, ${k.c}cc)` }}>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="rounded-pill bg-white/20 px-2.5 py-0.5 font-semibold">{k.t}</span>
          {item.topic && <span className="rounded-pill bg-white/10 px-2.5 py-0.5">{item.topic}</span>}
          {item.kind === "survey" && item.anonymous && <span className="rounded-pill bg-white/10 px-2.5 py-0.5">دون اسم</span>}
        </div>
        <h1 className="mt-2 text-xl font-bold leading-snug">{item.title || "العنوان"}</h1>
        <p className="mt-1 text-[12px] opacity-85">{[item.created_by_name, item.created_by_role, item.sent_at && fmtDate(item.sent_at)].filter(Boolean).join(" · ")}</p>
        {item.closes_at && <p className="mt-0.5 text-[11.5px] opacity-80">تُغلق في {fmtDateTime(item.closes_at)}</p>}
      </header>
      <div className="space-y-4 p-5">
        {item.body && <p className="whitespace-pre-line text-[14.5px] leading-[1.9] text-ink">{item.body}</p>}
        {imgs.length > 0 && (
          <div className={`grid gap-2 ${imgs.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {imgs.map((m) => urls[m.path] && <a key={m.path} href={urls[m.path]} target="_blank" rel="noreferrer">
              <img src={urls[m.path]} alt={m.name} className="w-full rounded-sm2 border border-line object-cover" style={{ maxHeight: 460 }} /></a>)}
          </div>
        )}
        {vids.map((m) => urls[m.path] && <video key={m.path} src={urls[m.path]} controls playsInline preload="metadata" className="w-full rounded-sm2 bg-black" />)}
        {yt.filter((l) => l.yt).map((l) => (
          <div key={l.url} className="overflow-hidden rounded-sm2 bg-black" style={{ aspectRatio: "16 / 9" }}>
            <iframe title={l.t || "مقطع"} src={`https://www.youtube-nocookie.com/embed/${l.yt}`} className="h-full w-full" allowFullScreen
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" />
          </div>
        ))}
        {(files.length > 0 || yt.some((l) => !l.yt)) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {files.map((m) => urls[m.path] && (
              <a key={m.path} href={urls[m.path]} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-sm2 border border-line bg-canvas px-3 py-2.5 text-sm text-ink hover:border-mint-light">
                <span className="grid h-8 w-8 place-items-center rounded-sm2 bg-white text-[10px] font-bold text-danger">PDF</span><span className="min-w-0 flex-1 truncate">{m.name}</span></a>))}
            {yt.filter((l) => !l.yt).map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-sm2 border border-line bg-canvas px-3 py-2.5 text-sm text-mint-deep hover:border-mint-light">
                <span className="grid h-8 w-8 place-items-center rounded-sm2 bg-white">🔗</span><span className="min-w-0 flex-1 truncate">{l.t || l.url}</span></a>))}
          </div>
        )}
        {children}
      </div>
    </article>
  );
}

/* نموذج الاستبانة: سؤال في بطاقة، والإلزامي معلَّم */
export function SurveyForm({ questions, value, onChange, disabled }) {
  const set = (id, v) => onChange({ ...value, [id]: v });
  return (
    <div className="space-y-3">
      {questions.map((x, n) => {
        const v = value[x.id];
        const opts = x.type === "yesno" ? QTYPES.yesno.fixed : x.options.filter((o) => o.trim());
        return (
          <fieldset key={x.id} className="rounded-sm2 border border-line bg-canvas/50 p-3.5" disabled={disabled}>
            <legend className="sr-only">{x.q}</legend>
            <p className="mb-2.5 text-[14px] font-semibold leading-relaxed text-ink"><span className="num ml-1.5 text-mint-deep">{n + 1}.</span>{x.q || "نص السؤال"}
              {x.required && <span className="mr-1 text-danger">*</span>}</p>
            {(x.type === "single" || x.type === "yesno") && <div className="grid gap-1.5 sm:grid-cols-2">{opts.map((o) => (
              <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-sm2 border px-3 py-2 text-sm ${v === o ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-ink"}`}>
                <input type="radio" className="accent-mint-deep" checked={v === o} onChange={() => set(x.id, o)} />{o}</label>))}</div>}
            {x.type === "multi" && <div className="grid gap-1.5 sm:grid-cols-2">{opts.map((o) => {
              const on = (v ?? []).includes(o);
              return <label key={o} className={`flex cursor-pointer items-center gap-2 rounded-sm2 border px-3 py-2 text-sm ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-ink"}`}>
                <input type="checkbox" className="accent-mint-deep" checked={on} onChange={() => set(x.id, on ? v.filter((y) => y !== o) : [...(v ?? []), o])} />{o}</label>;
            })}</div>}
            {x.type === "scale" && <div className="grid grid-cols-5 gap-1.5">{QTYPES.scale.scale.map((t, i) => (
              <button key={t} type="button" onClick={() => set(x.id, i + 1)}
                      className={`rounded-sm2 border px-1 py-2 text-center text-[11px] leading-tight ${v === i + 1 ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-muted"}`}>
                <b className="num block text-base">{i + 1}</b>{t}</button>))}</div>}
            {x.type === "text" && <input className="field text-sm" maxLength={300} value={v ?? ""} onChange={(e) => set(x.id, e.target.value)} placeholder="إجابتك" />}
            {x.type === "long" && <textarea className="field min-h-[96px] text-sm" maxLength={2000} value={v ?? ""} onChange={(e) => set(x.id, e.target.value)} placeholder="إجابتك" />}
          </fieldset>
        );
      })}
    </div>
  );
}

export const missingRequired = (questions, a) => questions.findIndex((x) => x.required && (a[x.id] == null || a[x.id] === "" || (Array.isArray(a[x.id]) && !a[x.id].length)));

export default function OutreachView() {
  const { id } = useParams();
  const { session } = useSession();
  const uid = session?.user?.id;
  const [item, setItem] = useState(undefined);
  const [me, setMe] = useState(null);       // صف المستلم
  const [urls, setUrls] = useState({});
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("outreach_items").select("*").eq("id", id).maybeSingle();
      if (error) { setErr(setupMsg(error)); setItem(null); return; }
      setItem(data ?? null);
      if (!data) return;
      setUrls(await mediaUrls(data.media));
      const { data: r } = await supabase.from("outreach_recipients").select("*").eq("item_id", id).eq("user_id", uid).maybeSingle();
      setMe(r ?? null);
      if (r && !r.read_at) supabase.rpc("outreach_mark", { p_id: id, p_ack: false }).then(() => {});
    })();
  }, [id, uid]);

  const open = useMemo(() => item && !item.closed_at && !(item.closes_at && new Date(item.closes_at) <= new Date()), [item]);
  if (item === undefined) return <Loader />;
  if (!item) return <p className="card px-4 py-6 text-sm text-muted">{err || "هذه النشرة غير متاحة لك، أو حُذفت."}</p>;

  const ack = async () => { setBusy(true); await supabase.rpc("outreach_mark", { p_id: id, p_ack: true }); setMe((m) => ({ ...m, ack_at: new Date().toISOString() })); setBusy(false); };
  const submit = async () => {
    const miss = missingRequired(item.questions, ans);
    if (miss >= 0) { setMsg({ ok: false, t: `أجب عن السؤال ${miss + 1}، فهو إلزامي.` }); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc("outreach_answer", { p_id: id, p_answers: ans });
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return; }
    setMe((m) => ({ ...m, answered_at: new Date().toISOString() }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/my-outreach" className="text-sm text-mint-deep">→ النشرات والاستبانات</Link>
      <ItemBody item={item} urls={urls}>
        {item.kind === "post" && me && item.needs_ack && (
          me.ack_at ? <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">✓ تم الاطلاع في {fmtDateTime(me.ack_at)}</p>
            : <button className="btn-primary w-full" disabled={busy} onClick={ack}>تم الاطلاع</button>
        )}
        {item.kind === "survey" && me && (me.answered_at
          ? <div className="rounded-sm2 bg-present/10 px-4 py-5 text-center"><p className="text-lg font-bold text-present">شكرًا لك</p>
              <p className="mt-1 text-sm text-ink">وصلت إجابتك في {fmtDateTime(me.answered_at)}{item.anonymous ? "، دون اسمك" : ""}.</p></div>
          : !open ? <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">أُغلقت الاستبانة.</p>
          : <>
              {item.anonymous && <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-[12.5px] text-mint-deep">إجابتك دون اسم: لا يُحفظ اسمك مع إجاباتك، ويُحفظ صفك وفصلك فقط للتحليل.</p>}
              <SurveyForm questions={item.questions} value={ans} onChange={setAns} disabled={busy} />
              {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-danger-light text-danger"}`}>{msg.t}</p>}
              <button className="btn-primary w-full py-2.5" disabled={busy} onClick={submit}>{busy ? "جارٍ الإرسال…" : "إرسال الإجابة"}</button>
            </>)}
        {!me && item.kind === "survey" && <>
          <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-muted">معاينة: هكذا يرى المستلم نموذج الإجابة.</p>
          <SurveyForm questions={item.questions} value={ans} onChange={setAns} />
        </>}
      </ItemBody>
    </div>
  );
}
