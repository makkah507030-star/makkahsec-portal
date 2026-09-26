// src/pages/EventsReports.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   تقارير الأحداث والمناسبات.
   • المنظّم يرى ما نفّذه، والإدارة ترى كل الأحداث.
   • تقرير حصر بالأحداث ومشاركيها، جاهز للطباعة بهوية المدرسة.
   ===================================================================== */

const GOV = [
  "المملكة العربية السعودية",
  "وزارة التعليم",
  "الإدارة العامة للتعليم بمنطقة مكة المكرمة",
];

const INK = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" };

const fmtG = (s) => {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const STAGE_AR = {
  draft: "مسودة", participants: "اختيار الطلاب", consent: "الموافقات",
  permission: "الاستئذان", attendance: "الحضور", certificates: "الشهادات",
  report: "التقرير", approved: "معتمد",
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
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("school_events")
        .select("*").order("event_date", { ascending: false });
      setRows(data ?? []);

      const ids = (data ?? []).map((e) => e.id);
      if (!ids.length) return;
      const { data: ps } = await supabase.from("event_participants")
        .select("event_id, attended, cert_issued_at").in("event_id", ids);
      const c = {};
      (ps ?? []).forEach((p) => {
        const x = (c[p.event_id] ??= { total: 0, attended: 0, certs: 0 });
        x.total++;
        if (p.attended) x.attended++;
        if (p.cert_issued_at) x.certs++;
      });
      setCounts(c);
    })();
  }, [uid]);

  const shown = useMemo(() => {
    let list = rows ?? [];
    if (scope === "mine") list = list.filter((e) => e.organizer_id === uid);
    if (from) list = list.filter((e) => e.event_date >= from);
    if (to) list = list.filter((e) => e.event_date <= to);
    return list;
  }, [rows, scope, uid, from, to]);

  const totals = useMemo(() => {
    const t = { events: shown.length, students: 0, certs: 0, approved: 0 };
    shown.forEach((e) => {
      t.students += counts[e.id]?.attended ?? 0;
      t.certs += counts[e.id]?.certs ?? 0;
      if (e.stage === "approved") t.approved++;
    });
    return t;
  }, [shown, counts]);

  const pill = (on) =>
    `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
      on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  if (!rows) return <p className="py-8 text-center text-sm text-muted">جارٍ التحميل…</p>;

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
        <button className="btn-primary mr-auto" disabled={shown.length === 0}
                onClick={() => { setPrinting(true); setTimeout(() => window.print(), 60); }}>
          طباعة / حفظ PDF
        </button>
      </div>

      <div className="no-print grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["الأحداث", totals.events], ["الطلاب المشاركون", totals.students],
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
                <span className={`chip shrink-0 ${
                  e.stage === "approved" ? "bg-present/10 text-present" : "bg-mint-tint text-mint-deep"}`}>
                  {STAGE_AR[e.stage] ?? e.stage}
                </span>
              </div>
              <p className="num mt-1 text-xs text-faint">
                {e.serial} · {fmtG(e.event_date)}
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

      {printing && (
        <>
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * { visibility: hidden !important; }
              #ev-report, #ev-report * { visibility: visible !important; }
              #ev-report { position: absolute; inset: 0; background: #fff; }
              #ev-report tr { break-inside: avoid; }
              .no-print { display: none !important; }
            }
            @page { size: 210mm 297mm; margin: 0; }
          ` }} />
          <div id="ev-report" className="hidden print:block">
            <div className="mx-auto bg-white text-ink"
                 style={{ width: "210mm", minHeight: "297mm", padding: "13mm 14mm",
                          fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="text-[11px] font-medium leading-[1.9]">
                  {GOV.map((l) => <div key={l}>{l}</div>)}
                  <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
                </div>
                <div className="flex items-center gap-4">
                  <img src={moeLogo} alt="" className="h-10 w-auto" />
                  <img src={logoIcon} alt="" className="h-10 w-auto" />
                </div>
              </div>
              <div className="mt-2.5 h-px w-full" style={{
                background: "linear-gradient(90deg,transparent,#3E635022 12%,#3E6350 50%,#3E635022 88%,transparent)",
                ...INK }} />

              <div className="mt-5 text-center">
                <span className="rounded-pill px-5 py-1.5 text-[12.5px] font-semibold"
                      style={{ background: "#EDFAF2", color: "#3E6350", ...INK }}>
                  تقرير الأحداث والمناسبات
                </span>
                {scope === "mine" && (
                  <p className="mt-2 text-[13px] text-muted">
                    ما نفّذه: {profile?.full_name ?? ""}
                  </p>
                )}
                {(from || to) && (
                  <p className="num mt-1 text-[12px] text-muted">
                    {from ? fmtG(from) : "من البداية"} — {to ? fmtG(to) : "حتى اليوم"}
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[["الأحداث", totals.events], ["الطلاب المشاركون", totals.students],
                  ["الشهادات", totals.certs], ["المعتمدة", totals.approved]].map(([t, v]) => (
                  <div key={t} className="rounded-[10px] border border-line py-2.5">
                    <p className="num text-[20px] font-bold text-mint-deep">{v}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted">{t}</p>
                  </div>
                ))}
              </div>

              <table className="mt-5 w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {["م", "الحدث", "التاريخ", "المكان", "المنظّم", "الحاضرون", "الشهادات", "الحالة"]
                      .map((h) => (
                      <th key={h} className="border border-line px-1.5 py-2 text-center font-semibold text-mint-deep"
                          style={{ background: "#EDFAF2", ...INK }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e, i) => {
                    const c = counts[e.id] ?? { attended: 0, certs: 0 };
                    return (
                      <tr key={e.id}>
                        <td className="num border border-line px-1.5 py-1.5 text-center">{i + 1}</td>
                        <td className="border border-line px-1.5 py-1.5">{e.title}</td>
                        <td className="num border border-line px-1.5 py-1.5 text-center">
                          {fmtG(e.event_date)}
                        </td>
                        <td className="border border-line px-1.5 py-1.5">{e.venue || "—"}</td>
                        <td className="border border-line px-1.5 py-1.5">{e.organizer_name || "—"}</td>
                        <td className="num border border-line px-1.5 py-1.5 text-center">{c.attended}</td>
                        <td className="num border border-line px-1.5 py-1.5 text-center">{c.certs}</td>
                        <td className="border border-line px-1.5 py-1.5 text-center text-[10.5px]">
                          {STAGE_AR[e.stage] ?? e.stage}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-10 grid grid-cols-2 gap-8 text-center">
                <div>
                  <p className="text-[12px] text-muted">المنظّم</p>
                  <div className="h-8" />
                  <div className="mx-auto h-px w-44 bg-line" />
                  <p className="mt-1.5 text-[12.5px] font-semibold">
                    {scope === "mine" ? (profile?.full_name ?? "…") : "…"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-muted">مدير المدرسة</p>
                  <div className="h-8" />
                  <div className="mx-auto h-px w-44 bg-line" />
                  <p className="mt-1.5 text-[12.5px] font-semibold">عبدالله بن حسن سليمان الفيفي</p>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-2.5 text-[10px] text-faint">
                <span>بوابة مكة الثانوية الرقمية</span>
                <span className="font-semibold text-mint-deep" dir="ltr">makkahsec.com</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
