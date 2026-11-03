// src/pages/admin/MadrasatiRequests.jsx
// طلبات منصة مدرستي للدعم الفني (supabase/madrasati_requests.sql): ما أرسله الطلاب من «مركز الدعم والمساندة».
// لكل طلب ما يلزم لتنفيذه في لوحة مدرستي (الهوية والجوال أو الفصل)، ورد جاهز يعدَّل ثم يُرسل إشعارًا للطالب.
// كلمة المرور لا تمر بالمدرسة: يُحدَّث الجوال في المنصة وترسلها المنصة عليه برسالة نصية.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";
import { sendPush } from "../../lib/pushSend.js";
import Loader from "../../components/Loader.jsx";
import { MR_KINDS, MR_STATUS, kindOf } from "../../components/MadrasatiSupport.jsx";

const tail = (m) => String(m ?? "").slice(-3);
// الردود الجاهزة: لا تحمل كلمة مرور أبدًا
const READY = {
  password: (r) => `حُدّث جوالك في منصة مدرستي، وأُرسلت كلمة المرور الجديدة برسالة نصية إلى الرقم المنتهي بـ ${tail(r.mobile)}. ادخل بها ثم غيّرها من إعدادات حسابك.`,
  class: (r) => `نُقلت في منصة مدرستي إلى فصل ${r.target_class}. قد يتأخر ظهور التغيير قليلًا، فأعد الدخول للمنصة.`,
  other: () => "عولجت مشكلتك. إن استمرت فأرسل طلبًا جديدًا مع وصف ما يظهر لك.",
};
const REJECT = "تعذّر تنفيذ الطلب: ";

function Copy({ v }) {
  const [ok, setOk] = useState(false);
  if (!v) return null;
  return (
    <button type="button" className="num rounded-sm2 border border-line bg-white px-2 py-0.5 text-[12px] text-ink hover:bg-canvas" dir="ltr"
            title="نسخ" onClick={() => { navigator.clipboard?.writeText(v); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {v} <span className="text-faint">{ok ? "✓" : "⧉"}</span>
    </button>
  );
}

export default function MadrasatiRequests() {
  const { profile } = useSession();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [view, setView] = useState("open");      // open | done | all
  const [kind, setKind] = useState("all");
  const [act, setAct] = useState(null);           // { id, status, reply }
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    supabase.from("madrasati_requests").select("*").order("created_at", { ascending: false }).limit(500)
      .then(({ data, error }) => { setErr(error ? error.message : ""); setRows(data ?? []); });
  }, []);
  useEffect(() => { load(); }, [load]);

  const isOpen = (r) => r.status === "new" || r.status === "in_progress";
  const list = useMemo(() => (rows ?? []).filter((r) => (view === "all" || (view === "open" ? isOpen(r) : !isOpen(r)))
    && (kind === "all" || r.kind === kind)), [rows, view, kind]);
  const counts = (k) => (rows ?? []).filter((r) => isOpen(r) && (k === "all" || r.kind === k)).length;
  const avgH = useMemo(() => {
    const d = (rows ?? []).filter((r) => r.handled_at && r.status === "done");
    return d.length ? Math.round(d.reduce((s, r) => s + (new Date(r.handled_at) - new Date(r.created_at)), 0) / d.length / 36e5) : null;
  }, [rows]);

  const save = async (r, status, reply) => {
    setBusy(true);
    const patch = { status, reply: reply?.trim() || null, handled_by: profile?.id ?? null, handled_by_name: profile?.full_name ?? null,
                    handled_at: status === "in_progress" ? null : new Date().toISOString() };
    const { error } = await supabase.from("madrasati_requests").update(patch).eq("id", r.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    if (status !== "in_progress") {
      const { data: nid } = await supabase.rpc("send_notification", {
        p_title: status === "done" ? "تم طلبك لمنصة مدرستي" : "طلبك لمنصة مدرستي",
        p_body: patch.reply ?? kindOf(r.kind).t, p_kind: "general", p_link: "/contact#madrasati",
        p_roles: null, p_user_ids: [r.user_id], p_grade: null, p_class_no: null, p_is_auto: true,
      });
      if (nid) { try { await sendPush(nid); } catch { /* الإشعار في البوابة وصل */ } }
    }
    setBusy(false); setAct(null); load();
  };

  if (!rows) return <Loader />;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">طلبات منصة مدرستي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          طلبات الطلاب من «مركز الدعم والمساندة». نفّذ الطلب في لوحة منصة مدرستي، ثم أرسل الرد فيصل الطالب إشعارًا.
          كلمة المرور لا تُكتب في الرد: حدّث الجوال في المنصة وأرسلها منها على الجوال.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">
        {/does not exist|schema cache/.test(err) ? "نفّذ supabase/madrasati_requests.sql في قاعدة البيانات أولًا." : err}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["all", "مفتوحة"], ...MR_KINDS.map((k) => [k.k, k.t])].map(([k, t]) => (
          <button key={k} onClick={() => { setKind(k); setView("open"); }}
                  className={`card px-3 py-2.5 text-start ${kind === k && view === "open" ? "ring-2 ring-mint-deep" : ""}`}>
            <span className="num block text-xl font-bold text-ink">{counts(k)}</span>
            <span className="block text-[11.5px] text-muted">{k === "all" ? "كل الطلبات المفتوحة" : t}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {[["open", "المفتوحة"], ["done", "المنتهية"], ["all", "الكل"]].map(([k, t]) => (
          <button key={k} onClick={() => setView(k)} className={`rounded-pill px-3 py-1 text-xs font-semibold ${view === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>{t}</button>
        ))}
        <select className="field ms-auto py-1 text-xs" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">كل الأنواع</option>
          {MR_KINDS.map((k) => <option key={k.k} value={k.k}>{k.t}</option>)}
        </select>
        {avgH !== null && <span className="num w-full text-[11.5px] text-muted sm:w-auto">متوسط زمن الحل: {avgH < 1 ? "أقل من ساعة" : `${avgH} ساعة`}</span>}
      </div>

      {list.length === 0 ? <p className="card px-4 py-8 text-center text-sm text-muted">لا طلبات هنا.</p> : (
        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">{kindOf(r.kind).icon} {kindOf(r.kind).t}</span>
                <span className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${MR_STATUS[r.status]?.c}`}>{MR_STATUS[r.status]?.t}</span>
                <span className="num ms-auto text-[11px] text-faint">{fmtDateTime(r.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
                <b className="text-ink">{r.student_name}</b>
                <span>الهوية <Copy v={r.national_id} /></span>
                {r.class_label && <span>فصله: {r.class_label}</span>}
                {r.kind === "password" && <span>الجوال المطلوب <Copy v={r.mobile} /></span>}
                {r.kind === "class" && <span>الفصل الصحيح: <b className="text-ink">{r.target_class}</b></span>}
              </div>
              {r.details && <p className="rounded-sm2 bg-canvas px-3 py-2 text-[12.5px] leading-relaxed text-ink">{r.details}</p>}
              {r.reply && <p className="text-[12px] text-muted">الرد{r.handled_by_name ? ` (${r.handled_by_name})` : ""}: {r.reply}</p>}

              {isOpen(r) && (act?.id === r.id ? (
                <div className="space-y-2 rounded-sm2 border border-line bg-canvas/50 p-3">
                  <textarea className="field min-h-[70px] w-full text-sm" value={act.reply} onChange={(e) => setAct({ ...act, reply: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy || !act.reply.trim()} onClick={() => save(r, act.status, act.reply)}>
                      {act.status === "done" ? "تم، وأرسل الرد" : "أرسل سبب التعذّر"}</button>
                    <button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => setAct(null)}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary px-4 py-1.5 text-xs" onClick={() => setAct({ id: r.id, status: "done", reply: READY[r.kind](r) })}>تم التنفيذ</button>
                  {r.status === "new" && <button className="btn-ghost px-4 py-1.5 text-xs" disabled={busy} onClick={() => save(r, "in_progress")}>قيد المعالجة</button>}
                  <button className="px-3 py-1.5 text-xs text-absent" onClick={() => setAct({ id: r.id, status: "rejected", reply: REJECT })}>تعذّر</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
