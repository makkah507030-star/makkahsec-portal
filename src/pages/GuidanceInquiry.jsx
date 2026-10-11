// src/pages/GuidanceInquiry.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { refreshNavBadges } from "../lib/navBadges.js";
import { confirmDanger } from "../lib/danger.js";
import { fmtDateTime } from "../lib/dates";
import { LEVELS, STATUS, isSetupErr, setupMsg } from "../lib/guidanceInquiry";
import Sticker from "../components/Sticker.jsx";
import InquirySheet, { InquiryPrintArea } from "../components/InquirySheet.jsx";
import Loader from "../components/Loader.jsx";

/* =====================================================================
   استمارة توضيح مستوى الطالب — صفحة واحدة لكل أطرافها بحسب دوره:
   • المعلم: يحدد مستوى الطالب في مادته (يرى سطره وحده).
   • الموجه: يتابع التعبئة ويكتب رأيه ويرسلها للوكيل، ثم يرسل نسخة لولي الأمر.
   • الوكيل: يكتب رأيه ويعيدها للموجه.
   • ولي الأمر: يطّلع على نسخته ويطبعها.
   ===================================================================== */

const DEPUTY_ROLES = ["deputy_students", "principal", "tech_support"];

export default function GuidanceInquiry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, adminRoles, effectiveRole } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];

  const [inq, setInq] = useState(null);
  const [items, setItems] = useState([]);
  const [sigs, setSigs] = useState({});
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [mine, setMine] = useState({ academic: "", behavior: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const box = useRef(null);
  const [scale, setScale] = useState(0.5);

  const load = async () => {
    const [{ data, error }, { data: rows }] = await Promise.all([
      supabase.from("guidance_inquiries").select("*").eq("id", id).maybeSingle(),
      supabase.from("guidance_inquiry_items").select("*").eq("inquiry_id", id).order("sort"),
    ]);
    if (error || !data) { setErr(isSetupErr(error) ? setupMsg : "الاستمارة غير موجودة أو لا تملك صلاحية عرضها."); return; }
    setInq(data); setItems(rows ?? []);
    const my = (rows ?? []).find((x) => x.teacher_user_id === uid);
    if (my) setMine({ academic: my.academic ?? "", behavior: my.behavior ?? "", note: my.note ?? "" });
    setNote((data.status === "deputy" ? data.deputy_note : data.counselor_note) ?? "");

    const paths = [...new Set([data.counselor_sig, data.deputy_sig, ...(rows ?? []).map((x) => x.sig)].filter(Boolean))];
    if (paths.length) {
      const { data: urls } = await supabase.storage.from("form-assets").createSignedUrls(paths, 3600);
      setSigs(Object.fromEntries((urls ?? []).filter((u) => u.signedUrl).map((u) => [u.path, u.signedUrl])));
    }
    // ولي الأمر اطّلع ← تختفي من «بانتظار إجرائك»
    if (effectiveRole === "guardian" && data.status === "sent" && !data.guardian_seen_at) {
      await supabase.rpc("guidance_inquiry_seen", { p_id: id });
      refreshNavBadges(true);
    }
  };
  useEffect(() => { if (uid) load(); }, [id, uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [inq]);

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: ok });
    refreshNavBadges(true);
    load();
  };

  if (err) return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold text-ink">تعذّر عرض الاستمارة</p>
      <p className="mt-1.5 text-sm text-muted">{err}</p>
      <button onClick={() => navigate("/")} className="mt-4 rounded-pill border border-line px-4 py-1.5 text-sm text-muted">العودة للرئيسية</button>
    </div>
  );
  if (!inq) return <Loader />;

  const counsel = roles.some((r) => DEPUTY_ROLES.includes(r) || r === `counselor_${inq.grade}`);
  const deputy = roles.some((r) => DEPUTY_ROLES.includes(r));
  const myItem = items.find((x) => x.teacher_user_id === uid);
  const teacherOnly = myItem && !counsel;
  const pending = items.filter((x) => x.teacher_user_id && !x.filled_at);
  const st = STATUS[inq.status];

  const toDeputy = async () => {
    if (pending.length && !(await confirmDanger({
      title: "إرسال الاستمارة للوكيل قبل اكتمال التعبئة؟",
      impact: [`لم يعبّئ ${pending.length} من المعلمين بعد: ${pending.map((x) => x.subject).join("، ")}.`,
               "تُقفل التعبئة بعد الإرسال وتبقى أسطرهم فارغة."],
      level: "medium", confirmLabel: "إرسال للوكيل",
    }))) return;
    run(() => supabase.rpc("guidance_inquiry_step", { p_id: id, p_action: "to_deputy", p_note: note }), "أُرسلت للوكيل.");
  };
  const remove = async () => {
    if (!(await confirmDanger({ title: "إلغاء الاستمارة وحذفها؟", impact: ["تُحذف معها تعبئة المعلمين."], level: "high", confirmLabel: "حذف" }))) return;
    const { error } = await supabase.from("guidance_inquiries").delete().eq("id", id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    refreshNavBadges(true);
    navigate("/guidance?tab=inquiry");
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">استمارة مستوى — {inq.student_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <Sticker flag={inq.flag} />
            {!teacherOnly && effectiveRole !== "guardian" && <span className={`chip ${st.c}`}>{st.t}</span>}
            <span>{inq.class_label}</span>
          </div>
        </div>
        {!teacherOnly && <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>}
      </div>

      {msg && <p className={`no-print rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      {/* المعلم: سطر مادته */}
      {myItem && (
        <section className="no-print card space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">مستوى الطالب في مادة {myItem.subject}</p>
            <p className="mt-0.5 text-xs text-muted">
              {inq.status === "teachers"
                ? "حدّد مستواه التحصيلي والسلوكي، ويُرفق توقيعك المحفوظ تلقائيًا."
                : "انتقلت الاستمارة من المعلمين، وهذه تعبئتك المحفوظة."}
            </p>
          </div>
          {[["academic", "المستوى التحصيلي"], ["behavior", "المستوى السلوكي"]].map(([k, t]) => (
            <div key={k}>
              <p className="mb-1.5 text-xs font-semibold text-muted">{t}</p>
              <div className="grid grid-cols-3 gap-2">
                {LEVELS.map((l) => (
                  <button key={l.k} type="button" disabled={inq.status !== "teachers"}
                          onClick={() => setMine((m) => ({ ...m, [k]: l.k }))}
                          className={`rounded-sm2 border px-3 py-2.5 text-sm font-semibold transition-colors ${
                            mine[k] === l.k ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-white text-ink hover:bg-canvas"}`}>
                    {l.t}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <textarea rows={2} className="field w-full" value={mine.note} disabled={inq.status !== "teachers"}
                    placeholder="ملاحظة للموجه (اختياري)" onChange={(e) => setMine((m) => ({ ...m, note: e.target.value }))} />
          {inq.status === "teachers" && (
            <button className="btn-primary w-full" disabled={busy || !mine.academic || !mine.behavior}
                    onClick={() => run(() => supabase.rpc("guidance_inquiry_fill", {
                      p_item: myItem.id, p_academic: mine.academic, p_behavior: mine.behavior, p_note: mine.note,
                    }), "وصلت تعبئتك للموجه الطلابي. شكرًا لك.")}>
              {busy ? "جارٍ الإرسال…" : myItem.filled_at ? "تحديث التعبئة" : "إرسال للموجه"}
            </button>
          )}
        </section>
      )}

      {/* الموجه: متابعة التعبئة ورأيه */}
      {counsel && inq.status === "teachers" && (
        <section className="no-print card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">
            تعبئة المعلمين <span className="num">{items.length - pending.length}</span> من <span className="num">{items.length}</span>
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {items.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 rounded-sm2 bg-canvas px-3 py-1.5 text-xs">
                <span className="truncate"><b className="text-ink">{x.subject}</b> · {x.teacher_name ?? "—"}</span>
                <span className={x.filled_at ? "text-present" : x.teacher_user_id ? "text-warning" : "text-faint"}>
                  {x.filled_at ? "✓ عبّأ" : x.teacher_user_id ? "لم يعبّئ" : "لا حساب له"}
                </span>
              </li>
            ))}
          </ul>
          <textarea rows={3} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="رأي الموجه الطلابي" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy || !note.trim()} onClick={toDeputy}>إرسال للوكيل</button>
            <button className="btn-ghost text-absent" disabled={busy} onClick={remove}>إلغاء الاستمارة</button>
          </div>
        </section>
      )}

      {/* الوكيل: رأيه ثم تعود للموجه */}
      {deputy && inq.status === "deputy" && (
        <section className="no-print card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">رأي وكيل شؤون الطلاب</p>
          <textarea rows={3} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="رأيك وتوجيهك" />
          <button className="btn-primary" disabled={busy || !note.trim()}
                  onClick={() => run(() => supabase.rpc("guidance_inquiry_step", { p_id: id, p_action: "deputy", p_note: note }), "عادت الاستمارة للموجه برأيك.")}>
            إعادتها للموجه
          </button>
        </section>
      )}

      {/* الموجه: نسخة ولي الأمر */}
      {counsel && inq.status === "counselor" && (
        <section className="no-print card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">إرسال نسخة لولي الأمر</p>
          <p className="text-xs text-muted">تصل الاستمارة لحساب ولي الأمر مع إشعار. يمكنك تعديل رأيك قبل الإرسال.</p>
          <textarea rows={3} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="رأي الموجه الطلابي" />
          <button className="btn-primary" disabled={busy}
                  onClick={() => run(() => supabase.rpc("guidance_inquiry_step", { p_id: id, p_action: "send", p_note: note }), "أُرسلت نسخة لولي الأمر.")}>
            إرسال لولي الأمر
          </button>
        </section>
      )}

      {counsel && inq.status === "sent" && (
        <p className="no-print rounded-card bg-present/10 px-4 py-3 text-sm text-present">
          أُرسلت لولي الأمر <span className="num">{fmtDateTime(inq.sent_at)}</span>
          {inq.guardian_seen_at ? <> · اطّلع عليها <span className="num">{fmtDateTime(inq.guardian_seen_at)}</span></> : " · لم يطّلع بعد"}
        </p>
      )}

      {!teacherOnly && (
        <>
          <div ref={box} className="no-print overflow-hidden rounded-card border border-line bg-white">
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top right", width: 794, height: 1123 * scale }}>
              <InquirySheet inq={inq} items={items} sigs={sigs} />
            </div>
          </div>
          <div className="hidden print:block">
            <InquiryPrintArea><InquirySheet inq={inq} items={items} sigs={sigs} /></InquiryPrintArea>
          </div>
        </>
      )}
    </div>
  );
}
