// src/pages/outreach/OutreachAdmin.jsx
// «النشرات والاستبانات» للمرسل (الموجهون الطلابيون ومن له الصلاحية): القائمة بحالة كل نشرة ونسب
// الاستجابة، والقوالب الجاهزة، وصفحة كل نشرة بتبويباتها: المحتوى، والإرسال والمشاركة، والمتابعة، والنتائج.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import { notify } from "../../lib/notice";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { KIND, TEMPLATES, blankItem, fromTemplate, mediaUrls, setupMsg, statusOf } from "../../lib/outreach.js";
import OutreachEditor from "./OutreachEditor.jsx";
import OutreachSend from "./OutreachSend.jsx";
import { Follow, Results } from "./OutreachResults.jsx";
import { ItemBody, SurveyForm } from "./OutreachView.jsx";

const Icon = ({ d, className = "h-5 w-5" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

export default function OutreachAdmin() {
  const { session, hasAdminRole } = useSession();
  const uid = session.user.id;
  const [sp, setSp] = useSearchParams();
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState({});
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null);     // نشرة جديدة قيد الإنشاء
  const [mine, setMine] = useState(true);
  const openId = sp.get("id");
  const all = hasAdminRole("principal", "tech_support");

  const load = async () => {
    let q = supabase.from("outreach_items").select("*").order("created_at", { ascending: false }).limit(200);
    if (!all || mine) q = q.eq("created_by", uid);
    const { data, error } = await q;
    if (error) { setErr(setupMsg(error)); setItems([]); return; }
    setItems(data ?? []);
    const ids = (data ?? []).filter((i) => i.sent_at).map((i) => i.id);
    if (!ids.length) return;
    const { data: r } = await supabase.from("outreach_recipients").select("item_id, read_at, ack_at, answered_at").in("item_id", ids);
    const m = {};
    (r ?? []).forEach((x) => { const s = (m[x.item_id] ??= { n: 0, read: 0, ack: 0, ans: 0 }); s.n++; if (x.read_at) s.read++; if (x.ack_at) s.ack++; if (x.answered_at) s.ans++; });
    setStats(m);
  };
  useEffect(() => { load(); }, [mine]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!items) return <Loader />;
  const go = (id, tab) => setSp(id ? { id, ...(tab ? { tab } : {}) } : {}, { replace: false });

  if (draft) return <OutreachEditor item={draft} onCancel={() => setDraft(null)}
    onSaved={(row) => { setDraft(null); load(); go(row.id, "send"); notify({ ok: true, text: "حُفظت. اختر المستفيدين ثم أرسل." }); }} />;
  const cur = openId && items.find((i) => i.id === openId);
  if (openId && cur) return <ItemPage item={cur} tab={sp.get("tab")} setTab={(t) => go(cur.id, t)} onBack={() => go(null)} reload={load} />;

  const surveys = items.filter((i) => i.kind === "survey" && i.sent_at).length;
  const posts = items.filter((i) => i.kind === "post" && i.sent_at).length;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">النشرات والاستبانات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          نشرات توعوية وتعليمات بالصور والمقاطع والروابط، واستبانات بأسئلة متنوعة، للطلاب وأولياء الأمور والموظفين.
          تصل إشعارًا في الجرس والجوال، وتُشارك عبر واتساب أو برمز QR، وتتابع من اطّلع وأجاب، وتحلّل النتائج.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">{err}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {["post", "survey"].map((k) => (
          <button key={k} disabled={!!err} onClick={() => setDraft(blankItem(k))} className="card flex items-center gap-3 p-4 text-right transition-shadow hover:shadow-md"
                  style={{ background: `linear-gradient(135deg, ${KIND[k].c}12, #fff 60%)`, borderTop: `4px solid ${KIND[k].c}` }}>
            <span className="grid h-11 w-11 place-items-center rounded-sm2 text-white" style={{ background: KIND[k].c }}><Icon d={KIND[k].icon} /></span>
            <span><b className="block text-ink">+ {KIND[k].t} جديدة</b>
              <span className="text-[12.5px] text-muted">{k === "post" ? "نص وصور ومقاطع وروابط، مع «تم الاطلاع» للتعليمات المهمة" : "اختيار، ومقياس، ونعم ولا، وإجابات نصية؛ باسم أو دون اسم"}</span></span>
          </button>))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-ink">ابدأ من قالب جاهز</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">{TEMPLATES.map((t) => (
          <button key={t.title} disabled={!!err} onClick={() => setDraft(fromTemplate(t))}
                  className="w-56 shrink-0 rounded-card border border-line bg-white p-3 text-right hover:border-mint-light">
            <span className="text-[11px] font-semibold" style={{ color: KIND[t.kind].c }}>{KIND[t.kind].t} · {t.topic}</span>
            <b className="mt-0.5 block text-[13px] leading-snug text-ink">{t.title}</b>
            {t.questions && <span className="num text-[11px] text-muted">{t.questions().length} أسئلة{t.anonymous ? " · دون اسم" : ""}</span>}
          </button>))}</div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-ink">{mine ? "نشراتي واستباناتي" : "كل النشرات والاستبانات"}</h2>
          <span className="text-xs text-muted">المرسل: نشرات <span className="num">{posts}</span> · استبانات <span className="num">{surveys}</span></span>
          {all && <button className="ms-auto text-xs font-semibold text-mint-deep" onClick={() => setMine(!mine)}>{mine ? "عرض الكل" : "نشراتي فقط"}</button>}
        </div>
        {items.length === 0 && <p className="card px-4 py-8 text-center text-sm text-muted">لا شيء بعد. ابدأ بنشرة أو استبانة أو من قالب.</p>}
        <div className="grid gap-3 lg:grid-cols-2">{items.map((i) => {
          const k = KIND[i.kind], s = stats[i.id], st = statusOf(i);
          const done = s ? (i.kind === "survey" ? s.ans : i.needs_ack ? s.ack : s.read) : 0;
          const p = s?.n ? Math.round((100 * done) / s.n) : 0;
          return (
            <button key={i.id} onClick={() => go(i.id)} className="card flex flex-col gap-2 p-4 text-right transition-shadow hover:shadow-md" style={{ borderRight: `5px solid ${k.c}` }}>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold" style={{ color: k.c }}>{k.t}</span>{i.topic && <span className="text-muted">· {i.topic}</span>}
                <span className={`chip ms-auto text-[10.5px] ${st.c}`}>{st.t}</span></div>
              <b className="text-[14.5px] leading-snug text-ink">{i.title}</b>
              {s ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-pill bg-line/50"><div className="h-full rounded-pill" style={{ width: `${p}%`, background: k.c }} /></div>
                  <span className="text-[11.5px] text-muted">{i.kind === "survey" ? "أجاب" : i.needs_ack ? "أقرّ" : "اطّلع"} <span className="num">{done}</span> من <span className="num">{s.n}</span></span>
                </div>) : <span className="text-[11.5px] text-faint">لم تُرسل بعد</span>}
              <span className="num text-[11px] text-faint">{[!mine && i.created_by_name, fmtDate(i.sent_at ?? i.created_at)].filter(Boolean).join(" · ")}</span>
            </button>
          );
        })}</div>
      </section>
    </div>
  );
}

function ItemPage({ item, tab, setTab, onBack, reload }) {
  const { session } = useSession();
  const own = item.created_by === session.user.id;
  const [editing, setEditing] = useState(false);
  const [urls, setUrls] = useState({});
  useEffect(() => { mediaUrls(item.media).then(setUrls); }, [item.media]);
  const survey = item.kind === "survey", st = statusOf(item);
  const TABS = [["content", "المحتوى"], ...(own ? [["send", item.sent_at ? "المشاركة والإضافة" : "الإرسال"]] : []),
    ...(item.sent_at ? [["follow", "المتابعة"]] : []), ...(survey && item.sent_at ? [["results", "النتائج"]] : [])];
  const t = TABS.some(([k]) => k === tab) ? tab : item.sent_at && survey ? "results" : own && !item.sent_at ? "send" : "content";

  const close = async () => {
    const { error } = await supabase.from("outreach_items").update({ closed_at: item.closed_at ? null : new Date().toISOString() }).eq("id", item.id);
    if (error) notify({ ok: false, text: error.message }); else reload();
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف «${item.title}»`, impact: ["تُحذف النشرة ووسائطها ومتابعتها وكل إجاباتها نهائيًا، وتختفي عند المستفيدين."], confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("outreach_items").delete().eq("id", item.id);
    if (error) { notify({ ok: false, text: error.message }); return; }
    if (item.media.length) supabase.storage.from("outreach").remove(item.media.map((m) => m.path));
    onBack(); reload();
  };

  if (editing) return <OutreachEditor item={item} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" onClick={onBack}>رجوع للقائمة</button>
        <span className={`chip ${st.c}`}>{st.t}</span>
        <span className="flex-1" />
        {own && !item.sent_at && <button className="btn-ghost" onClick={() => setEditing(true)}>تعديل</button>}
        {own && item.sent_at && survey && <button className="btn-ghost" onClick={close}>{item.closed_at ? "إعادة فتح الاستبانة" : "إغلاق الاستبانة"}</button>}
        {own && <button className="text-sm text-danger" onClick={remove}>حذف</button>}
      </div>
      <h1 className="text-lg font-bold text-ink">{item.title}</h1>
      <div className="flex gap-2 overflow-x-auto">{TABS.map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`w-36 shrink-0 rounded-sm2 py-2 text-sm font-semibold ${t === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-ink"}`}>{l}</button>))}</div>
      {item.sent_at && item.audience && Object.values(item.audience).some(Boolean) && (
        <p className="text-[12.5px] text-muted">المستفيدون: {[item.audience.students, item.audience.picked && `${item.audience.picked} طلاب بأسمائهم`, item.audience.guardians, item.audience.staff].filter(Boolean).join("، ")}</p>)}
      {t === "content" && <div className="mx-auto max-w-3xl"><ItemBody item={item} urls={urls}>
        {survey && <SurveyForm questions={item.questions} value={{}} onChange={() => {}} disabled />}</ItemBody></div>}
      {t === "send" && <OutreachSend item={item} onSent={() => { reload(); setTab("follow"); }} />}
      {t === "follow" && <Follow item={item} />}
      {t === "results" && <Results item={item} />}
    </div>
  );
}
