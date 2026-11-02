// src/pages/accreditation/AccMinutes.jsx
import { Fragment, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate, fmtDateTime } from "../../lib/dates";
import { countAr } from "../../lib/arabicCount.js";
import { confirmDanger } from "../../lib/danger";
import { sendPush } from "../../lib/pushSend.js";
import { roleT } from "../../lib/accreditation.js";
import { PRINCIPAL_NAME } from "../../lib/signers.js";
import { usePrincipalSignature } from "../../lib/principalSignature";
import { useSignerImages } from "../../lib/userSignatures.js";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";

/* =====================================================================
   محاضر لجنة التميز (supabase/acc_3.sql، acc_8.sql) بصيغة «محضر اجتماع» الرسمية في البوابة:
   بيانات الاجتماع، والمحاور، ومتابعة توصيات الاجتماع السابق، وما نوقش، والقرارات والتوصيات،
   وجدول الحاضرين بتوقيعاتهم، ثم توقيع المقرر والمشرف واعتماد مدير المدرسة.
   المراحل: مسودة ← يرسله المشرف للتوقيع (إشعار للحاضرين) ← يوقّع كل حاضر بنفسه ← يعتمده المدير.
   ===================================================================== */

const STATUS = {
  draft: { t: "مسودة", c: "bg-canvas text-muted" },
  signing: { t: "بانتظار التوقيع", c: "bg-late/10 text-late" },
  approved: { t: "معتمد", c: "bg-present/10 text-present" },
};
const AGENDA = [
  "افتتاح الاجتماع ومتابعة توصيات الاجتماع السابق.",
  "متابعة تنفيذ برامج خطة التحسين ونسب إنجازها.",
  "مراجعة شواهد المؤشرات المرفوعة والمتبقية في كل مجال.",
  "توزيع مهام التقويم الذاتي وأدواته على الأعضاء.",
  "الاستعداد لزيارة التقويم الخارجي.",
  "مناقشة نتائج الاختبارات الوطنية وخطط رفعها.",
  "ما يستجد من أعمال.",
];
const PLACES = ["قاعة الاجتماعات", "مكتب مدير المدرسة", "مركز مصادر التعلم", "عن بُعد"];
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const weekday = (d) => (d ? WEEKDAYS[new Date(`${d}T12:00:00`).getDay()] : "");
const lines = (s) => String(s ?? "").split("\n").map((l) => l.replace(/^\s*(•|-|\d+[.)-])\s*/, "").trim()).filter(Boolean);
const today = () => new Date().toISOString().slice(0, 10);
const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };
const TH = { background: "#EDFAF2", ...INK };
const cell = "border border-[#9DB5A6] px-2 py-1";
const clock = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "ص" : "م"}`;
};

async function notify(ids, title, body) {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return;
  try {
    const { data: nid } = await supabase.rpc("send_notification", { p_title: title, p_body: body, p_kind: "general", p_link: "/accreditation?tab=team",
      p_roles: null, p_user_ids: u, p_grade: null, p_class_no: null, p_is_auto: true });
    if (nid) await sendPush(nid);
  } catch { /* الإجراء نفسه حُفظ */ }
}

export default function AccMinutes({ me, year, members, setMsg, by }) {
  const { profile, hasAdminRole } = useSession();
  const uid = profile?.id;
  const isPrincipal = hasAdminRole?.("principal");
  const [rows, setRows] = useState(null);
  const [ready, setReady] = useState(true);       // acc_8.sql منفَّذ
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const [printing, setPrinting] = useState(null);
  const load = async () => {
    const r = await supabase.from("acc_meetings").select("*, acc_meeting_signs(user_id, name, signed_at)").order("held_on", { ascending: false });
    if (!r.error) { setReady(true); setRows(r.data ?? []); return; }
    const p = await supabase.from("acc_meetings").select("*").order("held_on", { ascending: false });
    setReady(false); setRows((p.data ?? []).map((x) => ({ ...x, acc_meeting_signs: [] })));
  };
  useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <Loader />;
  const coord = members.find((m) => m.role === "coordinator");
  const signedBy = (m, u) => (m.acc_meeting_signs ?? []).some((g) => g.user_id === u);
  const mineToSign = rows.filter((m) => (m.status ?? "draft") === "signing" && m.attendees.includes(uid) && !signedBy(m, uid));

  const fresh = () => ({
    number: String(rows.length + 1), held_on: today(), time_from: "", time_to: "", place: PLACES[0],
    title: "اجتماع لجنة التميز المدرسي", chair_name: PRINCIPAL_NAME || "", secretary_name: coord?.full_name ?? "",
    attendees: members.map((m) => m.user_id), guests: [], agenda: "", followup: "", discussion: "", decisions: [], notes: "",
  });
  const print = (m) => { setPrinting(m); setTimeout(() => printThen(() => setPrinting(null)), 400); };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">محاضر الاجتماعات <span className="num text-muted">({rows.length})</span></h2>
        {mineToSign.length > 0 && <span className="chip bg-late/10 text-[11px] text-late">{countAr(mineToSign.length, "minutes")} بانتظار توقيعك</span>}
        {me.coord && !edit && ready && <button className="ms-auto rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={() => setEdit(fresh())}>+ محضر جديد</button>}
      </div>
      {!ready && <p className="border-b border-line bg-late/5 px-4 py-2 text-xs text-late">المحضر الجديد بتوقيعه الإلكتروني يحتاج تشغيل الملف <span dir="ltr">acc_8.sql</span> في Supabase.</p>}
      {edit && <Editor m={edit} members={members} year={year} by={by} setMsg={setMsg}
        onDone={(ok) => { setEdit(null); if (ok) { setMsg({ ok: true, text: "حُفظ المحضر مسودةً. راجعه ثم أرسله للتوقيع." }); load(); } }} />}
      {rows.length === 0 && !edit && <p className="px-4 py-6 text-sm text-muted">لا محاضر بعد.</p>}
      <div className="divide-y divide-line">{rows.map((m) => (
        <Row key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} members={members} coord={coord}
          uid={uid} me={me} isPrincipal={isPrincipal} ready={ready} setMsg={setMsg} reload={load}
          onEdit={() => { setEdit(m); setOpen(null); window.scrollTo({ top: 0, behavior: "smooth" }); }} onPrint={() => print(m)} />
      ))}</div>
      {printing && (
        <PrintPortal id="acc-minutes" margin="10mm 12mm">
          <Sheet m={printing} members={members} coord={coord} print />
        </PrintPortal>
      )}
    </section>
  );
}

function Row({ m, open, onToggle, members, coord, uid, me, isPrincipal, ready, setMsg, reload, onEdit, onPrint }) {
  const [busy, setBusy] = useState(false);
  const status = m.status ?? "draft";
  const signs = m.acc_meeting_signs ?? [];
  const att = m.attendees.filter((u) => members.some((x) => x.user_id === u));
  const signedN = att.filter((u) => signs.some((g) => g.user_id === u)).length;
  const iSign = status === "signing" && m.attendees.includes(uid) && !signs.some((g) => g.user_id === uid);
  const allSigned = att.length > 0 && signedN === att.length;
  const done = m.decisions.filter((d) => d.done).length;
  const run = async (fn, ok) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return false; }
    if (ok) setMsg({ ok: true, text: ok });
    reload(); return true;
  };
  const upd = (patch) => supabase.from("acc_meetings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", m.id);
  const send = async () => {
    if (!att.length) { setMsg({ ok: false, text: "حدّد الحاضرين أولًا." }); return; }
    if (await run(() => upd({ status: "signing", sent_at: new Date().toISOString() }), `أُرسل المحضر للتوقيع إلى ${countAr(att.length, "person")}.`))
      notify(att, "محضر لجنة التميز للتوقيع", `محضر «${m.title}» رقم ${m.number ?? ""} بتاريخ ${fmtDate(m.held_on)} ينتظر توقيعك.`);
  };
  const remind = () => {
    const left = att.filter((u) => !signs.some((g) => g.user_id === u));
    notify(left, "تذكير: محضر لجنة التميز ينتظر توقيعك", `محضر «${m.title}» رقم ${m.number ?? ""} ما زال ينتظر توقيعك.`);
    setMsg({ ok: true, text: `أُرسل التذكير إلى ${countAr(left.length, "person")}.` });
  };
  const back = async () => {
    if (signs.length && !(await confirmDanger({ title: "إعادة المحضر للتعديل", impact: [`تُمسح التوقيعات (${signs.length}) ويُعاد إرساله بعد التعديل.`], confirmLabel: "إعادة للتعديل" }))) return;
    if (signs.length) { const { error } = await supabase.from("acc_meeting_signs").delete().eq("meeting_id", m.id); if (error) { setMsg({ ok: false, text: error.message }); return; } }
    run(() => upd({ status: "draft", sent_at: null, approved_at: null, approved_name: null }), "أُعيد المحضر مسودة.");
  };
  const sign = () => run(() => supabase.from("acc_meeting_signs").insert({ meeting_id: m.id, user_id: uid, name: members.find((x) => x.user_id === uid)?.full_name ?? null }), "وقّعت على المحضر.");
  const approve = async () => {
    if (!allSigned && !(await confirmDanger({ title: "اعتماد المحضر قبل اكتمال التوقيعات", impact: [`وقّع ${signedN} من ${att.length}.`], confirmLabel: "اعتماد" }))) return;
    if (await run(() => upd({ status: "approved", approved_at: new Date().toISOString(), approved_name: PRINCIPAL_NAME || "مدير المدرسة" }), "اعتُمد المحضر."))
      notify(coord ? [coord.user_id] : [], "اعتُمد محضر لجنة التميز", `اعتمد مدير المدرسة محضر «${m.title}» رقم ${m.number ?? ""}.`);
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف محضر «${m.title}»`, impact: ["يُحذف المحضر وتوقيعاته وقراراته نهائيًا."], confirmLabel: "حذف" }))) return;
    run(() => supabase.from("acc_meetings").delete().eq("id", m.id), "حُذف المحضر.");
  };
  const toggle = (i) => run(() => upd({ decisions: m.decisions.map((d, k) => (k === i ? { ...d, done: !d.done } : d)) }));

  return (
    <div className={`px-4 py-3 ${iSign ? "bg-late/5" : ""}`}>
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 text-start">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-sm font-bold text-mint-deep"><span className="num">{m.number || "—"}</span></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{m.title}</span>
          <span className="num block text-[11.5px] text-muted">{weekday(m.held_on)} {fmtDate(m.held_on)} · {countAr(m.decisions.length, "decision")} · نُفّذ {done}</span></span>
        <span className={`chip text-[11px] ${STATUS[status].c}`}>{STATUS[status].t}{status === "signing" && `\u00A0· وقّع ${signedN} من ${att.length}`}</span>
        {iSign && <span className="chip bg-late text-[11px] text-white">وقّع الآن</span>}
        <span className="text-xs text-faint">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card"><Sheet m={m} members={members} coord={coord} /></div>
          {iSign && (
            <div className="space-y-2 rounded-card border border-late/30 bg-late/5 p-3">
              <p className="text-[12.5px] leading-relaxed text-ink">بالتوقيع تُقرّ بأنك حضرت الاجتماع واطّلعت على المحضر وما ورد فيه من قرارات وتوصيات. تظهر صورة توقيعك من «توقيعي» إن كنت رفعته، وإلا «✓ وُقّع إلكترونيًا».</p>
              <button className="btn-primary px-5 py-2 text-xs" disabled={busy} onClick={sign}>{busy ? "…" : "أوقّع على المحضر"}</button>
            </div>
          )}
          {me.coord && m.decisions.length > 0 && status !== "draft" && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-muted">متابعة التنفيذ:</span>{m.decisions.map((d, i) => (
            <button key={i} disabled={busy} onClick={() => toggle(i)} className={`rounded-pill border px-2.5 py-1 text-[11px] ${d.done ? "border-present/40 bg-present/10 text-present" : "border-line bg-white text-muted"}`}>{d.done ? "✓" : "○"} القرار {i + 1}</button>))}</div>}
          <div className="flex flex-wrap gap-2">
            <button onClick={onPrint} className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs font-semibold text-mint-deep">طباعة المحضر</button>
            {me.coord && status === "draft" && <>
              <button onClick={onEdit} className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink">تعديل</button>
              {ready && <button onClick={send} disabled={busy} className="rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white">إرسال للتوقيع</button>}
              <button onClick={remove} className="px-2 text-xs text-absent">حذف</button></>}
            {me.coord && status === "signing" && <>
              {!allSigned && <button onClick={remind} className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs font-semibold text-mint-deep">تذكير من لم يوقّع</button>}
              <button onClick={back} disabled={busy} className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs text-muted">إعادة للتعديل</button></>}
            {isPrincipal && status === "signing" && <button onClick={approve} disabled={busy} className="rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white">اعتماد المحضر</button>}
            {me.all && status === "approved" && <button onClick={back} disabled={busy} className="rounded-pill border border-line bg-white px-4 py-1.5 text-xs text-muted">إلغاء الاعتماد وإعادة للتعديل</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ورقة المحضر بصيغة «محضر اجتماع» الرسمية: على الشاشة وفي الطباعة */
export function Sheet({ m, members, coord, print }) {
  const principal = usePrincipalSignature();
  const signs = m.acc_meeting_signs ?? [];
  const sigOf = (u) => signs.find((g) => g.user_id === u);
  const img = useSignerImages(signs.map((g) => g.user_id));
  const byId = new Map(members.map((x) => [x.user_id, x]));
  const present = m.attendees.map((u) => byId.get(u)).filter(Boolean);
  const absent = members.filter((x) => !m.attendees.includes(x.user_id));
  const status = m.status ?? "draft";
  const time = m.time_from ? `من ${clock(m.time_from)}${m.time_to ? ` إلى ${clock(m.time_to)}` : ""}` : "";
  const info = [["رقم الاجتماع", m.number], ["العام الدراسي", m.academic_year ? `${m.academic_year} هـ` : ""], ["اليوم", weekday(m.held_on)], ["التاريخ", fmtDate(m.held_on)],
    ["الوقت", time], ["المكان", m.place], ["رئيس الاجتماع", m.chair_name], ["مقرر الاجتماع", m.secretary_name]];
  let n = 0;
  const agenda = lines(m.agenda);
  const follow = lines(m.followup);
  const coordSig = coord && sigOf(coord.user_id);

  return (
    <div dir="rtl" className={`relative bg-white text-ink ${print ? "" : "min-w-[640px] p-6 sm:p-8"}`} style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
      <div className="flex items-start justify-between gap-4">
        <div className="text-[10.5px] font-medium leading-[1.9]">
          <div>المملكة العربية السعودية</div><div>وزارة التعليم</div><div>الإدارة العامة للتعليم بمنطقة مكة المكرمة</div>
          <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
        </div>
        <div className="flex items-center gap-4"><img src={moeLogo} alt="" className="h-9 w-auto" /><img src={logoIcon} alt="" className="h-9 w-auto" /></div>
      </div>
      <div className="mt-2.5 h-[2px] w-full" style={{ background: "linear-gradient(90deg, transparent, #3E635022 12%, #3E6350 50%, #3E635022 88%, transparent)", ...INK }} />
      <h1 className="mt-2 text-center text-[20px] font-bold">محضر اجتماع</h1>
      <p className="mt-0.5 text-center text-[14px] font-semibold text-mint-deep">لجنة التميز المدرسي · التقويم والاعتماد المدرسي</p>
      {m.title && m.title !== "اجتماع لجنة التميز المدرسي" && <p className="mt-0.5 text-center text-[12.5px] text-muted">{m.title}</p>}

      <table className="mt-3 w-full border-collapse text-[12px]"><tbody>
        {[0, 2, 4, 6].map((i) => (
          <tr key={i}>{info.slice(i, i + 2).map(([k, v]) => (
            <Fragment key={k}><th className={`${cell} w-[16%] text-right font-semibold text-mint-deep`} style={TH}>{k}</th>
              <td className={`${cell} w-[34%]`}>{v || ""}</td></Fragment>))}</tr>
        ))}
      </tbody></table>

      <H n={++n}>محاور الاجتماع (جدول الأعمال)</H>
      {agenda.length ? <ol className="space-y-0.5 pr-5 text-[12.5px] leading-relaxed" style={{ listStyle: "arabic-indic" }}>{agenda.map((l, i) => <li key={i}>{l}</li>)}</ol>
        : <p className="text-[12px] text-faint">—</p>}
      {follow.length > 0 && <>
        <H n={++n}>متابعة توصيات الاجتماع السابق</H>
        <ul className="list-disc space-y-0.5 pr-5 text-[12.5px] leading-relaxed">{follow.map((l, i) => <li key={i}>{l}</li>)}</ul></>}
      {m.discussion && <>
        <H n={++n}>ما نوقش في الاجتماع</H>
        <p className="whitespace-pre-line text-[12.5px] leading-relaxed">{m.discussion}</p></>}

      <H n={++n}>القرارات والتوصيات</H>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr>{["م", "القرار أو التوصية", "المسؤول عن التنفيذ", "موعد التنفيذ", "الحالة"].map((c, i) => (
          <th key={c} className={`${cell} font-semibold text-mint-deep ${i === 0 ? "w-8" : i === 1 ? "" : "w-[17%]"}`} style={TH}>{c}</th>))}</tr></thead>
        <tbody>{(m.decisions.length ? m.decisions : [{}, {}]).map((d, i) => (
          <tr key={i}><td className={`${cell} text-center`}><span className="num">{i + 1}</span></td><td className={cell}>{d.text}</td>
            <td className={`${cell} text-center`}>{d.owner}</td><td className={`${cell} text-center`}><span className="num">{d.due ? fmtDate(d.due) : ""}</span></td>
            <td className={`${cell} text-center ${d.done ? "text-present" : "text-muted"}`}>{d.text ? (d.done ? "✓ نُفّذ" : "قيد التنفيذ") : ""}</td></tr>))}</tbody>
      </table>
      {m.notes && <><H n={++n}>ملاحظات</H><p className="whitespace-pre-line text-[12.5px] leading-relaxed">{m.notes}</p></>}

      <H n={++n}>الحاضرون والتوقيع</H>
      <table className="w-full border-collapse text-[12px]">
        <thead><tr>{["م", "الاسم", "الصفة في اللجنة", "التوقيع", "تاريخ التوقيع"].map((c, i) => (
          <th key={c} className={`${cell} font-semibold text-mint-deep ${i === 0 ? "w-8" : i === 1 ? "w-[32%]" : ""}`} style={TH}>{c}</th>))}</tr></thead>
        <tbody>
          {present.map((x, i) => { const g = sigOf(x.user_id); return (
            <tr key={x.user_id}><td className={`${cell} text-center`}><span className="num">{i + 1}</span></td><td className={cell}>{x.full_name}</td>
              <td className={cell}>{roleT(x)}{x.title ? ` · ${x.title}` : ""}</td>
              <td className={`${cell} h-[9mm] text-center`}>{g ? <SigImg url={img.get(x.user_id)} /> : !print && status === "signing" ? <span className="text-[11px] text-late">بانتظار التوقيع</span> : ""}</td>
              <td className={`${cell} text-center text-[11px]`}><span className="num">{g ? fmtDateTime(g.signed_at) : ""}</span></td></tr>); })}
          {(m.guests ?? []).filter((g) => g.name).map((g, i) => (
            <tr key={`g${i}`}><td className={`${cell} text-center`}><span className="num">{present.length + i + 1}</span></td><td className={cell}>{g.name}</td>
              <td className={cell}>ضيف{g.title ? ` · ${g.title}` : ""}</td><td className={cell} /><td className={cell} /></tr>))}
        </tbody>
      </table>
      {absent.length > 0 && <p className="mt-1.5 text-[11.5px] text-muted"><b className="text-ink">الغائبون أو المعتذرون: </b>{absent.map((x) => x.full_name).join("، ")}</p>}

      <div className="mt-6 grid grid-cols-3 items-end gap-4 text-center" style={{ breakInside: "avoid" }}>
        <SignBox role="مقرر الاجتماع" name={m.secretary_name} />
        <SignBox role="مشرف لجنة التميز" name={coord?.full_name} url={coordSig ? img.get(coord.user_id) : null} signed={!!coordSig} />
        <SignBox role="يُعتمد · مدير المدرسة" name={PRINCIPAL_NAME || principal.name} url={status === "approved" ? principal.url : null}
          signed={status === "approved"} note={status === "approved" && m.approved_at ? fmtDate(m.approved_at) : ""} />
      </div>
      <div className="mt-5 h-px w-full" style={{ background: "linear-gradient(90deg, transparent, #3E635022 12%, #3E6350 50%, #3E635022 88%, transparent)", ...INK }} />
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-faint">
        <span>بوابة مكة الثانوية الرقمية</span>
        <span>{status === "approved" ? "محضر معتمد وموقّع إلكترونيًا" : status === "signing" ? "محضر قيد التوقيع" : "مسودة محضر"}</span>
        <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
      </div>
    </div>
  );
}

function H({ n, children }) {
  return (
    <p className="mb-1.5 mt-4 flex items-center gap-2 text-[13px] font-bold text-mint-deep">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-mint-deep text-[10.5px] text-white" style={INK}><span className="num">{n}</span></span>{children}</p>);
}
const L = ({ children }) => <p className="mb-1 text-[11.5px] font-semibold text-muted">{children}</p>;

const SigImg = ({ url }) => (url
  ? <img src={url} alt="توقيع" style={{ height: 30, maxWidth: 110, objectFit: "contain", display: "inline-block" }} />
  : <span style={{ color: "#2f7a4f" }} className="text-[11px]">✓ وُقّع إلكترونيًا</span>);

function SignBox({ role, name, url, signed, note }) {
  return (
    <div>
      <p className="text-[12px] text-muted">{role}</p>
      <div className="grid h-14 place-items-center">{signed ? <SigImg url={url} /> : null}</div>
      <div className="mx-auto h-px w-36 bg-line" />
      <p className="mt-1 text-[12.5px] font-semibold">{name || "…"}</p>
      {note && <p className="num text-[10.5px] text-faint">{note}</p>}
    </div>
  );
}

function Editor({ m, members, year, by, onDone, setMsg }) {
  const [x, setX] = useState({ guests: [], followup: "", discussion: "", ...m });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setX((o) => ({ ...o, [k]: v }));
  const setD = (i, k, v) => set("decisions", x.decisions.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const setG = (i, k, v) => set("guests", x.guests.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const addAgenda = (t) => set("agenda", `${(x.agenda ?? "").trim() ? `${x.agenda.trim()}\n` : ""}${t}`);
  const save = async () => {
    if (!x.title?.trim()) { setMsg({ ok: false, text: "اكتب موضوع الاجتماع." }); return; }
    if (!lines(x.agenda).length) { setMsg({ ok: false, text: "اكتب محاور الاجتماع." }); return; }
    setBusy(true);
    const row = { held_on: x.held_on, title: x.title.trim(), number: x.number?.trim() || null, time_from: x.time_from || null, time_to: x.time_to || null,
      place: x.place?.trim() || null, chair_name: x.chair_name?.trim() || null, secretary_name: x.secretary_name?.trim() || null,
      agenda: x.agenda || null, followup: x.followup || null, discussion: x.discussion || null, attendees: x.attendees, notes: x.notes || null,
      guests: x.guests.filter((g) => g.name?.trim()), decisions: x.decisions.filter((d) => d.text?.trim()), updated_at: new Date().toISOString() };
    const { error } = x.id ? await supabase.from("acc_meetings").update(row).eq("id", x.id)
      : await supabase.from("acc_meetings").insert({ ...row, academic_year: year, created_by_name: by ?? null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    onDone(true);
  };
  return (
    <div className="space-y-4 border-b border-line bg-canvas/40 p-4">
      <datalist id="acc-names">{members.map((u) => <option key={u.user_id} value={u.full_name} />)}</datalist>
      <datalist id="acc-places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist>
      <div><L>بيانات الاجتماع</L>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className="field text-sm sm:col-span-3" value={x.title} onChange={(e) => set("title", e.target.value)} placeholder="موضوع الاجتماع" />
          <input className="field text-sm" value={x.number ?? ""} onChange={(e) => set("number", e.target.value)} placeholder="رقم الاجتماع" />
          <label className="text-[11px] text-muted">التاريخ<input type="date" className="field mt-0.5 w-full text-sm" value={x.held_on} onChange={(e) => set("held_on", e.target.value)} /></label>
          <label className="text-[11px] text-muted">من الساعة<input type="time" className="field mt-0.5 w-full text-sm" value={x.time_from ?? ""} onChange={(e) => set("time_from", e.target.value)} /></label>
          <label className="text-[11px] text-muted">إلى الساعة<input type="time" className="field mt-0.5 w-full text-sm" value={x.time_to ?? ""} onChange={(e) => set("time_to", e.target.value)} /></label>
          <label className="text-[11px] text-muted">المكان<input list="acc-places" className="field mt-0.5 w-full text-sm" value={x.place ?? ""} onChange={(e) => set("place", e.target.value)} /></label>
          <label className="text-[11px] text-muted sm:col-span-2">رئيس الاجتماع<input list="acc-names" className="field mt-0.5 w-full text-sm" value={x.chair_name ?? ""} onChange={(e) => set("chair_name", e.target.value)} /></label>
          <label className="text-[11px] text-muted sm:col-span-2">مقرر الاجتماع<input list="acc-names" className="field mt-0.5 w-full text-sm" value={x.secretary_name ?? ""} onChange={(e) => set("secretary_name", e.target.value)} /></label>
        </div></div>
      <div><L>الحاضرون من أعضاء اللجنة (يوقّعون إلكترونيًا)</L>
        <div className="flex flex-wrap gap-1.5">{members.map((u) => {
          const on = x.attendees.includes(u.user_id);
          return <button key={u.user_id} type="button" onClick={() => set("attendees", on ? x.attendees.filter((a) => a !== u.user_id) : [...x.attendees, u.user_id])}
            className={`rounded-pill border px-2.5 py-1 text-[11px] ${on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-faint"}`}>{on ? "✓ " : ""}{u.full_name}</button>;
        })}</div>
        <p className="mt-1 text-[10.5px] text-faint">من لم يُحدَّد يُكتب في المحضر «غائب أو معتذر».</p></div>
      <div><L>ضيوف من خارج اللجنة (اختياري)</L>
        {x.guests.map((g, i) => (
          <div key={i} className="mb-1.5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input className="field text-sm" value={g.name ?? ""} onChange={(e) => setG(i, "name", e.target.value)} placeholder="الاسم" />
            <input className="field text-sm" value={g.title ?? ""} onChange={(e) => setG(i, "title", e.target.value)} placeholder="الصفة: الموجه الطلابي، مشرف تربوي…" />
            <button onClick={() => set("guests", x.guests.filter((_, j) => j !== i))} className="text-xs text-absent">حذف</button>
          </div>))}
        <button onClick={() => set("guests", [...x.guests, { name: "", title: "" }])} className="text-xs font-semibold text-mint-deep">+ ضيف</button></div>
      <div><L>محاور الاجتماع (جدول الأعمال): سطر لكل محور</L>
        <div className="mb-1.5 flex flex-wrap gap-1.5">{AGENDA.filter((a) => !lines(x.agenda).includes(a)).map((a) => (
          <button key={a} onClick={() => addAgenda(a)} className="rounded-pill border border-line bg-white px-2.5 py-0.5 text-[11px] text-muted hover:bg-canvas">+ {a.replace(/\.$/, "")}</button>))}</div>
        <textarea className="field min-h-[96px] w-full text-sm" value={x.agenda ?? ""} onChange={(e) => set("agenda", e.target.value)} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><L>متابعة توصيات الاجتماع السابق (اختياري)</L>
          <textarea className="field min-h-[72px] w-full text-sm" value={x.followup ?? ""} onChange={(e) => set("followup", e.target.value)} placeholder="سطر لكل توصية وما تم فيها" /></div>
        <div><L>ما نوقش في الاجتماع (اختياري)</L>
          <textarea className="field min-h-[72px] w-full text-sm" value={x.discussion ?? ""} onChange={(e) => set("discussion", e.target.value)} /></div>
      </div>
      <div className="space-y-2"><L>القرارات والتوصيات</L>
        {x.decisions.map((d, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_150px_auto]">
            <input className="field text-sm" value={d.text} onChange={(e) => setD(i, "text", e.target.value)} placeholder={`القرار أو التوصية ${i + 1}`} />
            <input list="acc-names" className="field text-sm" value={d.owner ?? ""} onChange={(e) => setD(i, "owner", e.target.value)} placeholder="المسؤول عن التنفيذ" />
            <input type="date" className="field text-sm" value={d.due ?? ""} onChange={(e) => setD(i, "due", e.target.value)} />
            <button onClick={() => set("decisions", x.decisions.filter((_, j) => j !== i))} className="text-xs text-absent">حذف</button>
          </div>
        ))}
        <button onClick={() => set("decisions", [...x.decisions, { text: "", owner: "", due: "", done: false }])} className="text-xs font-semibold text-mint-deep">+ قرار أو توصية</button>
      </div>
      <div><L>ملاحظات (اختياري)</L>
        <textarea className="field min-h-[56px] w-full text-sm" value={x.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="rounded-pill bg-mint-deep px-4 py-2 text-xs font-semibold text-white">{busy ? "…" : "حفظ المحضر"}</button>
        <button onClick={() => onDone(false)} className="rounded-pill border border-line bg-white px-4 py-2 text-xs text-muted">إلغاء</button>
      </div>
    </div>
  );
}
