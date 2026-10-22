// src/pages/circulars/CircularView.jsx
/* =====================================================================
   صفحة التعميم (/circulars/:id) — يصلها المستفيد من الإشعار، ومدير التعاميم من الأرشيف.
   • المستفيد (منسوب أو ولي أمر): التعميم بملفه والمطلوب وموعده، ويُسجَّل فتحه تلقائيًا، وزر
     «اطّلعت على التعميم» إن تطلّب الإقرار.
   • مدير التعاميم: نسب الاطلاع، والمستفيدون بحالاتهم، وتذكير من لم يطّلع، وإضافة مستفيدين،
     وكشف الاطلاع المطبوع بتوقيع كل منسوب أقرّ (من «توقيعي»، supabase/circulars_3.sql) وExcel،
     وإغلاق المتابعة، والحذف.
   ===================================================================== */
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDate, fmtDateTime } from "../../lib/dates";
import { printReport, exportStyledExcel, PRINCIPAL_NAME } from "../../lib/exportUtils";
import { confirmDanger } from "../../lib/danger";
import { refreshNavBadges } from "../../lib/navBadges.js";
import { countAr } from "../../lib/arabicCount.js";
import Loader from "../../components/Loader.jsx";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { Audience, emptyAudience, audienceEmpty, audienceText, sendAudience } from "./Circulars.jsx";
import {
  CIRC_BUCKET, DIRECTION, PRIORITY, recStatus, circStats, circNo, openCircularFile, setupMsg, isSetupErr,
} from "../../lib/circulars.js";

const chip = (on) => `rounded-pill border px-3 py-1 text-xs transition-colors ${
  on ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-muted hover:bg-canvas"}`;

export default function CircularView() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { session, can } = useSession();
  const uid = session?.user?.id;
  const manager = can("circulars");
  const [c, setC] = useState(undefined);
  const [mine, setMine] = useState(null);
  const [recs, setRecs] = useState([]);
  const [hasSig, setHasSig] = useState(true);
  const [msg, setMsg] = useState(params.get("sent") ? { ok: true, text: "أُرسل التعميم، ووصل المستفيدين إشعار به." } : null);

  const load = async () => {
    const { data, error } = await supabase.from("circulars").select("*").eq("id", id).maybeSingle();
    if (error) { setMsg({ ok: false, text: isSetupErr(error) ? setupMsg : error.message }); setC(null); return; }
    setC(data ?? null);
    if (!data) return;
    const { data: me } = await supabase.from("circular_recipients").select("*").eq("circular_id", id).eq("user_id", uid).maybeSingle();
    if (me && !me.read_at) {
      await supabase.rpc("circular_mark", { p_id: id, p_ack: false });
      me.read_at = new Date().toISOString();
      refreshNavBadges(true);
    }
    setMine(me ?? null);
    // توقيعي: للمنسوب المستفيد، ليُنبَّه إن لم يرفع توقيعه قبل الإقرار
    if (me?.kind === "staff") {
      const { data: sig } = await supabase.from("user_signatures").select("path").eq("user_id", uid).maybeSingle();
      setHasSig(!!sig?.path);
    }
    if (manager) {
      const { data: all } = await supabase.from("circular_recipients").select("*").eq("circular_id", id);
      // صور توقيعات من أقرّ من المنسوبين (supabase/circulars_3.sql)
      const paths = [...new Set((all ?? []).map((r) => r.ack_sig).filter(Boolean))];
      const urls = new Map();
      if (paths.length) {
        const { data: links } = await supabase.storage.from("form-assets").createSignedUrls(paths, 3600);
        (links ?? []).forEach((l, i) => { if (l?.signedUrl) urls.set(paths[i], l.signedUrl); });
      }
      setRecs((all ?? []).map((r) => ({ ...r, sigUrl: urls.get(r.ack_sig) ?? null }))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "ar")));
    }
  };
  useEffect(() => { load(); }, [id, uid, manager]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (c === undefined) return <Loader />;
  if (!c) return (
    <div className="card px-4 py-8 text-center text-sm text-muted">
      {msg?.text ?? "لم يُعثر على التعميم، أو ليس لك الاطلاع عليه."}
      <div className="mt-3"><Link to="/my-circulars" className="text-mint-deep underline">تعاميمي</Link></div>
    </div>
  );

  const ack = async () => {
    const { error } = await supabase.rpc("circular_mark", { p_id: id, p_ack: true });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMine((m) => ({ ...m, ack_at: new Date().toISOString() }));
    refreshNavBadges(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Link to={manager ? "/circulars" : "/my-circulars"} className="text-mint-deep hover:underline">← {manager ? "التعاميم" : "تعاميمي"}</Link>
      </div>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-success/10 text-success" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      <article className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded-sm2 bg-canvas px-2 py-0.5 text-xs font-bold text-ink">قيد {circNo(c)}</span>
          <span className={`chip ${DIRECTION[c.direction]?.c}`}>تعميم {DIRECTION[c.direction]?.t}</span>
          {c.priority !== "normal" && <span className={`chip ${PRIORITY[c.priority].c}`}>{PRIORITY[c.priority].t}</span>}
          {c.category && <span className="chip bg-canvas text-muted">{c.category}</span>}
          <span className="mr-auto text-[11px] text-muted">{fmtDateTime(c.sent_at ?? c.created_at)}</span>
        </div>
        <h1 className="text-lg font-bold text-ink">{c.subject}</h1>
        <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {c.source && <div><dt className="inline text-muted">الجهة: </dt><dd className="inline text-ink">{c.source}</dd></div>}
          {(c.ref_no || c.ref_date) && <div><dt className="inline text-muted">رقمه وتاريخه: </dt>
            <dd className="num inline text-ink">{[c.ref_no, c.ref_date].filter(Boolean).join(" · ")}</dd></div>}
          {c.created_by_name && <div><dt className="inline text-muted">أرسله: </dt><dd className="inline text-ink">{c.created_by_name}</dd></div>}
        </dl>
        {c.body && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{c.body}</p>}
        {(c.action_required || c.due_date) && (
          <div className="rounded-sm2 border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-ink">
            {c.action_required && <p><b>المطلوب: </b>{c.action_required}</p>}
            {c.due_date && <p className="text-xs"><b>آخر موعد: </b><span className="num">{fmtDate(c.due_date)}</span></p>}
          </div>
        )}
        {c.file_path && (
          <button className="btn-ghost" onClick={() => openCircularFile(c.file_path).catch((e) => setMsg({ ok: false, text: e.message }))}>
            فتح ملف التعميم {c.file_name ? <span className="text-[11px] text-muted">({c.file_name})</span> : null}
          </button>
        )}
        {mine && c.needs_ack && (
          mine.ack_at
            ? <p className="rounded-sm2 bg-success/10 px-3 py-2 text-sm text-success">أقررت بالاطلاع على هذا التعميم في <span className="num">{fmtDateTime(mine.ack_at)}</span>.</p>
            : <div className="space-y-1.5">
                <button className="btn-primary w-full" onClick={ack}>اطّلعت على التعميم</button>
                {mine.kind === "staff" && (hasSig
                  ? <p className="text-center text-[11px] text-muted">يظهر توقيعك من «توقيعي» في سجل التوقيع على التعاميم.</p>
                  : <p className="text-center text-[11px] text-warning">لم ترفع توقيعك بعد: ارفعه من <Link to="/my-signature" className="underline">«توقيعي»</Link> قبل الإقرار ليظهر في سجل التوقيع على التعاميم.</p>)}
              </div>
        )}
      </article>

      {manager && <Tracking c={c} recs={recs} onChange={load} setMsg={setMsg} />}
    </div>
  );
}

/* ------------------------------ متابعة الاطلاع (مدير التعاميم) ------------------------------ */
function Tracking({ c, recs, onChange, setMsg }) {
  const navigate = useNavigate();
  const [f, setF] = useState("all");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [aud, setAud] = useState(emptyAudience);
  const [busy, setBusy] = useState(false);
  const s = circStats(recs, c.needs_ack);
  const opened = recs.filter((r) => recStatus(r, c.needs_ack).k === "opened").length;
  const shown = recs.filter((r) => (f === "all" || recStatus(r, c.needs_ack).k === f) && (!kind || r.kind === kind)
    && (!q.trim() || String(r.name ?? "").includes(q.trim())));
  const hasGuardians = recs.some((r) => r.kind === "guardian");

  const remind = async () => {
    if (!(await confirmDanger({ title: "تذكير من لم يطّلع", impact: [`يصل إشعار تذكير لـ${countAr(s.pending, "person", { acc: true })} على الجرس والجوال.`], confirmLabel: "إرسال التذكير" }))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("circular_remind", { p_id: c.id });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: `أُرسل التذكير إلى ${countAr(data, "person", { acc: true })}.` });
    onChange();
  };
  const add = async () => {
    if (audienceEmpty(aud)) return;
    setBusy(true);
    const { data, error } = await sendAudience(c.id, aud);
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: data ? `أُضيف ${countAr(data, "person")} ووصلهم الإشعار.` : "لا جديد: كلهم مستفيدون من قبل." });
    if (data) await supabase.from("circulars").update({ audience: { text: [c.audience?.text, audienceText(aud)].filter(Boolean).join(" + ") } }).eq("id", c.id);
    setAdding(false); setAud(emptyAudience()); onChange();
  };
  const close = async () => {
    await supabase.from("circulars").update({ closed_at: c.closed_at ? null : new Date().toISOString() }).eq("id", c.id);
    onChange();
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: `حذف التعميم «${c.subject}»`, level: "high",
      impact: ["يُحذف التعميم وملفه وسجل الاطلاع عليه نهائيًا، ويختفي عند كل المستفيدين."], confirmLabel: "حذف" }))) return;
    if (c.file_path) await supabase.storage.from(CIRC_BUCKET).remove([c.file_path]);
    const { error } = await supabase.from("circulars").delete().eq("id", c.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    navigate("/circulars");
  };

  const HEAD = ["م", "الاسم", "الصفة", "فتحه", c.needs_ack ? "أقرّ بالاطلاع" : "الحالة", "التوقيع"];
  const kindT = (r) => (r.kind === "guardian" ? "ولي أمر" : "منسوب");
  // خانة التوقيع: صورة توقيع المنسوب الذي أقرّ، أو «أقرّ إلكترونيًا»، وإلا فارغة للتوقيع باليد
  const sigCell = (r) => (r.sigUrl ? `<img src="${r.sigUrl}" alt="" style="height:30px;max-width:110px;object-fit:contain" />`
    : r.ack_at ? "✓ أقرّ إلكترونيًا" : "");
  const line = (r, i) => [i + 1, r.name ?? "—", kindT(r), r.read_at ? fmtDateTime(r.read_at) : "—",
    c.needs_ack ? (r.ack_at ? fmtDateTime(r.ack_at) : "—") : recStatus(r, false).t, sigCell(r)];
  const printSheet = () => printReport({
    title: "كشف الاطلاع على تعميم",
    subtitle: `قيد ${circNo(c)} · ${c.subject}`,
    logoUrl: new URL(logoIcon, window.location.origin).href, moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    headers: HEAD, rows: shown.map(line),
    note: [c.source && `الجهة: ${c.source}`, c.ref_no && `رقم التعميم: ${c.ref_no}`, c.ref_date && `تاريخه: ${c.ref_date}`,
      `اطّلع ${s.done} من ${s.total} (${s.pct}%)`].filter(Boolean).join(" · "),
    signatures: [{ title: "معدّ الكشف", name: c.created_by_name ?? "" }, { title: "مدير المدرسة", name: PRINCIPAL_NAME }],
    signOnLastPageOnly: true,
  });
  const excel = () => exportStyledExcel({ title: "كشف الاطلاع على تعميم", subtitle: `قيد ${circNo(c)} · ${c.subject}`,
    headers: HEAD.slice(0, 5), rows: shown.map((r, i) => line(r, i).slice(0, 5)), fileName: `اطلاع-تعميم-${c.seq ?? ""}`, sheetName: "الاطلاع" });

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["المستفيدون", s.total, "text-ink"], [c.needs_ack ? "اطّلع وأقرّ" : "اطّلع", `${s.done} · ${s.pct}%`, "text-success"],
          ["فتحه ولم يقرّ", c.needs_ack ? opened : "—", "text-warning"], ["لم يطّلع", s.total - s.done - (c.needs_ack ? opened : 0), "text-absent"]]
          .map(([t, v, cl]) => (
            <div key={t} className="rounded-card border border-line bg-white px-3 py-2.5 text-center">
              <p className={`num text-xl font-bold leading-none ${cl}`}>{v}</p><p className="mt-1 text-[11px] text-muted">{t}</p>
            </div>
          ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || !s.pending || !!c.closed_at} onClick={remind}>
          تذكير من لم يطّلع{s.pending ? ` (${s.pending})` : ""}</button>
        <button className="btn-ghost" onClick={() => setAdding((v) => !v)} disabled={!!c.closed_at}>إضافة مستفيدين</button>
        <button className="btn-ghost" onClick={printSheet} disabled={!recs.length}>طباعة كشف الاطلاع</button>
        <button className="btn-ghost" onClick={excel} disabled={!recs.length}>Excel</button>
        <button className="btn-ghost" onClick={close}>{c.closed_at ? "إعادة فتح المتابعة" : "إغلاق المتابعة"}</button>
        <button className="mr-auto text-xs text-absent hover:underline" onClick={remove}>حذف التعميم</button>
      </div>
      {c.closed_at && <p className="text-[11px] text-muted">أُغلقت متابعة هذا التعميم في <span className="num">{fmtDateTime(c.closed_at)}</span>: لا تذكير ولا يظهر في «بانتظار إجرائك»، ويبقى في الأرشيف.</p>}
      {adding && (
        <div className="card space-y-3 p-3">
          <Audience value={aud} onChange={setAud} />
          <button className="btn-primary" disabled={busy || audienceEmpty(aud)} onClick={add}>إرسال للمستفيدين الجدد</button>
          <p className="text-[11px] text-muted">من وصله التعميم من قبل لا يتكرر عنده.</p>
        </div>
      )}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2.5">
          {[["all", "الكل"], ["pending", "لم يطّلع"], ...(c.needs_ack ? [["opened", "فتحه ولم يقرّ"]] : []), ["done", c.needs_ack ? "أقرّ" : "اطّلع"]].map(([k, t]) => (
            <button key={k} className={chip(f === k)} onClick={() => setF(k)}>{t}</button>
          ))}
          {hasGuardians && <>
            <span className="mx-1 h-4 w-px bg-line" />
            {[["", "الجميع"], ["staff", "المنسوبون"], ["guardian", "أولياء الأمور"]].map(([k, t]) => (
              <button key={k} className={chip(kind === k)} onClick={() => setKind(k)}>{t}</button>
            ))}
          </>}
          <input className="field mr-auto w-40 py-1 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم" />
        </div>
        {shown.length === 0 ? <p className="px-4 py-5 text-sm text-muted">لا أحد هنا.</p> : (
          <div className="max-h-[28rem] divide-y divide-line overflow-y-auto">
            {shown.map((r) => {
              const st = recStatus(r, c.needs_ack);
              return (
                <div key={r.user_id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.name ?? "—"}
                    <span className="mr-2 text-[11px] text-muted">{kindT(r)}</span></span>
                  {r.sigUrl && <img src={r.sigUrl} alt="توقيعه" className="h-7 max-w-[90px] object-contain" />}
                  {r.remind_count > 0 && <span className="text-[11px] text-faint">ذُكّر {countAr(r.remind_count, "time")}</span>}
                  {(c.needs_ack ? r.ack_at ?? r.read_at : r.read_at) && <span className="num text-[11px] text-muted">{fmtDateTime(c.needs_ack ? r.ack_at ?? r.read_at : r.read_at)}</span>}
                  <span className={`chip ${st.c}`}>{st.t}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
