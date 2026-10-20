// src/pages/EventsReports.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import Loader from "../components/Loader.jsx";
import ReportViewer from "../components/report/ReportViewer.jsx";
import { signatureByName } from "../lib/userSignatures";
import { loadPrincipalSignature, loadSchoolStamp } from "../lib/principalSignature";
import { academicYearLabel } from "./studio/lib";
import { eventsReportPages, eventPhase, STAGE_AR } from "./EventsReportDoc.jsx";
import { eventDateRange, lastDay } from "../lib/eventDates.js";

/* =====================================================================
   تقارير الأحداث والمناسبات.
   • المنظّم يرى ما نفّذه، والإدارة ترى كل الأحداث.
   • تقرير مصمّم بهوية استوديو البوابة (EventsReportDoc.jsx): غلاف وملخص
     بالمؤشرات والرسوم، وأبرز الأحداث بصورها، وسجل الأحداث والتوقيعات.
   ===================================================================== */

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};


export default function EventsReports() {
  const { session, profile, adminRoles } = useSession();
  const uid = session?.user?.id;
  const roles = adminRoles ?? [];
  const isManager = roles.some((r) =>
    ["principal", "tech_support", "deputy_students", "deputy_academic"].includes(r));

  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [scope, setScope] = useState(isManager ? "all" : "mine");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState("list");
  const [theme, setTheme] = useState("light");
  const [photos, setPhotos] = useState({});
  const [sigs, setSigs] = useState({});
  const [news, setNews] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_events")
        .select("*").order("event_date", { ascending: false });
      setRows(data ?? []);

      const ids = (data ?? []).map((e) => e.id);
      if (!ids.length) return;
      const { data: ps } = await supabase.from("event_participants")
        .select("event_id, attended, cert_issued_at, consent_at").in("event_id", ids);
      const c = {};
      (ps ?? []).forEach((p) => {
        const x = (c[p.event_id] ??= { total: 0, attended: 0, certs: 0, consent: 0 });
        x.total++;
        if (p.attended) x.attended++;
        if (p.cert_issued_at) x.certs++;
        if (p.consent_at) x.consent++;
      });
      setCounts(c);
    })();
  }, [uid]);

  const shown = useMemo(() => {
    // الأحداث الملغاة لا تظهر في التقارير أصلًا
    let list = (rows ?? []).filter((e) => !e.cancelled_at);
    if (scope === "mine") list = list.filter((e) => e.organizer_id === uid);
    if (from) list = list.filter((e) => lastDay(e) >= from);   // الممتد يدخل ما دامت فترته تمسّ المدى
    if (to) list = list.filter((e) => e.event_date <= to);
    return list;
  }, [rows, scope, uid, from, to]);

  const totals = useMemo(() => {
    // الإجماليات من الأحداث المنفّذة وحدها (eventPhase): القادمة وما لم يُستكمل تظهر في القائمة بحالتها
    const live = shown.filter((e) => ["approved", "done"].includes(eventPhase(e)));
    const t = { events: live.length, students: 0, certs: 0, approved: 0 };
    live.forEach((e) => {
      t.students += counts[e.id]?.attended ?? 0;
      t.certs += counts[e.id]?.certs ?? 0;
      if (e.stage === "approved") t.approved++;
    });
    return t;
  }, [shown, counts]);

  // التقرير النهائي: صورة أولى لكل حدث معتمد، والتوقيعات والختم
  useEffect(() => {
    if (view !== "report") return;
    const withPhoto = shown.filter((e) => e.stage === "approved" && e.report_photos?.length && !(e.id in photos)).slice(0, 12);
    if (!withPhoto.length) return;
    supabase.storage.from("event-reports").createSignedUrls(withPhoto.map((e) => e.report_photos[0]), 3600)
      .then(({ data }) => setPhotos((p) => ({ ...p, ...Object.fromEntries(withPhoto.map((e, i) => [e.id, data?.[i]?.signedUrl ?? null])) })));
  }, [view, shown]);   // eslint-disable-line react-hooks/exhaustive-deps
  const organizer = scope === "mine" ? profile?.full_name ?? "" : null;
  // أخبار البوابة المنشورة في الفترة — لتقرير كل الأحداث وحده (الأخبار للمدرسة لا لمنظّم بعينه)
  useEffect(() => {
    if (view !== "report" || organizer) { setNews([]); return; }
    let q = supabase.from("news").select("id, title, excerpt, cover_url, published_at, created_at").eq("is_published", true);
    if (from) q = q.gte("published_at", from);
    if (to) q = q.lt("published_at", `${to}T23:59:59`);
    q.order("published_at", { ascending: false }).limit(6).then(({ data }) => setNews(data ?? []));
  }, [view, organizer, from, to]);
  useEffect(() => {
    if (view !== "report") return;
    let live = true;
    Promise.all([organizer ? signatureByName(organizer) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([o, p, st]) => { if (live) setSigs({ organizer: o, principal: p?.url ?? null, stamp: st }); });
    return () => { live = false; };
  }, [view, organizer]);
  const pages = useMemo(() => (view === "report" && rows ? eventsReportPages({
    events: shown, counts, photos, news, organizer, from, to, theme, sigs, year: academicYearLabel(),
    scopeLabel: organizer ? "ما نفّذته" : "كل الأحداث",
  }) : null), [view, rows, shown, counts, photos, news, organizer, from, to, theme, sigs]);

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  if (!rows) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="no-print">
        <h1 className="text-lg font-bold text-ink">تقارير الأحداث والمناسبات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          حصر بالأحداث المنفَّذة ومشاركيها، لتوثيق العمل وطباعته عند الحاجة.
        </p>
      </div>

      <div className="no-print flex flex-wrap items-end gap-2">
        {isManager && (
          <div className="flex gap-1.5">
            <button className={pill(scope === "all")} onClick={() => setScope("all")}>كل الأحداث</button>
            <button className={pill(scope === "mine")} onClick={() => setScope("mine")}>ما نفّذته</button>
          </div>
        )}
        <div>
          <label className="text-xs text-muted">من</label>
          <input type="date" className="field num mt-1" value={from}
                 onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted">إلى</label>
          <input type="date" className="field num mt-1" value={to}
                 onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="mr-auto flex gap-1.5">
          <button className={pill(view === "list")} onClick={() => setView("list")}>القائمة</button>
          <button className={pill(view === "report")} onClick={() => setView("report")}>التقرير النهائي</button>
        </div>
      </div>

      {view === "report" ? (
        <ReportViewer id="ev-report" pages={pages} theme={theme} setTheme={setTheme}
          fileTitle={`تقرير الأحداث والمناسبات${organizer ? ` - ${organizer}` : ""}`} />
      ) : (
        <>
      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["الأحداث المنفّذة", totals.events], ["الطلاب المشاركون", totals.students],
          ["الشهادات الصادرة", totals.certs], ["المعتمدة", totals.approved]].map(([t, v]) => (
          <div key={t} className="card px-4 py-3 text-center">
            <p className="num text-2xl font-bold text-mint-deep">{v}</p>
            <p className="mt-0.5 text-[11px] text-muted">{t}</p>
          </div>
        ))}
      </div>

      <div className="no-print space-y-2">
        {shown.length === 0 && (
          <p className="card px-4 py-8 text-center text-sm text-muted">لا أحداث في هذا النطاق.</p>
        )}
        {shown.map((e) => {
          const c = counts[e.id] ?? { total: 0, attended: 0, certs: 0 };
          return (
            <div key={e.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">{e.title}</p>
                {(() => {
                  const p = eventPhase(e);
                  const [cls, label] = p === "cancelled" ? ["bg-absent/10 text-absent", "ملغى"]
                    : p === "incomplete" ? ["bg-absent/10 text-absent", "لم يُستكمل"]
                    : p === "upcoming" ? ["bg-excused/10 text-excused", `قادم · ${STAGE_AR[e.stage] ?? e.stage}`]
                    : p === "approved" ? ["bg-present/10 text-present", "معتمد"] : ["bg-mint-tint text-mint-deep", STAGE_AR[e.stage] ?? e.stage];
                  return <span className={`chip shrink-0 ${cls}`}>{label}</span>;
                })()}
              </div>
              <p className="num mt-1 text-xs text-faint">
                {e.serial} · {eventDateRange(e, fmtG)}
                {e.venue ? ` · ${e.venue}` : ""}
                {e.organizer_name ? ` · ${e.organizer_name}` : ""}
              </p>
              <p className="num mt-1.5 text-xs text-muted">
                المرشّحون {c.total} · الحاضرون {c.attended} · الشهادات {c.certs}
              </p>
            </div>
          );
        })}
      </div>

        </>
      )}
    </div>
  );
}
