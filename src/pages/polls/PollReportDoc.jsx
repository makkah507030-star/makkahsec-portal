// src/pages/polls/PollReportDoc.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate, fmtDateTime } from "../../lib/dates";
import { AUDIENCE } from "../../lib/banners.js";
import { POLL_KIND, POLL_RESULTS } from "../../lib/polls.js";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import { S, n, pct, dmy, Kpis, Box, Bars, Donut, DonutLegend, Highlights, Signs, Page, Cover } from "../../components/report/ReportKit.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";

/* =====================================================================
   تقرير الاستطلاع أو الانتخاب بطقم التقارير (components/report) وهوية التقارير الشهرية:
   الغلاف ← بيانات التصويت والمشاركة وأبرز ما فيه ← النتائج بالأشرطة والكعكة وجدول الترتيب
   ← الاعتماد بتوقيع منشئ التصويت ومدير المدرسة والختم. بنسختين ملوّنة ورسمية موفّرة للحبر.
   ===================================================================== */

const COLORS = [...S, "#7A4FB5", "#C0573E", "#2F7F8A", "#8A6230"];
// المعدود بعدد الخيارات: 3–10 جمع، و11 فأكثر مفرد منصوب
const cnt = (v, one, few, many) => (v >= 3 && v <= 10 ? few : v > 10 ? many : one);
const who = (p) => p.audience.map((a) => AUDIENCE.find(([x]) => x === a)?.[1]).join("، ")
  + (p.grades?.length ? ` — الصف ${p.grades.map((g) => ["", "الأول", "الثاني", "الثالث"][g]).join(" و")}` : "");

export function pollReportPages({ p, rows, theme = "light", sigs = {} }) {
  const total = rows.reduce((a, r) => a + r.votes, 0);
  const ranked = [...rows].sort((a, b) => b.votes - a.votes);
  const { voters = 0, eligible } = rows[0] ?? {};
  const turnout = eligible ? pct(voters, eligible) : null;
  const kind = POLL_KIND[p.kind]?.t ?? "استطلاع";
  const top = ranked[0], second = ranked[1];
  const tie = top && second && top.votes === second.votes && top.votes > 0;
  const doc = { title: `تقرير ${kind}`, meta: [p.title], foot: "التصويت والاستطلاعات" };
  const common = { theme, doc, total: 4 };
  const high = [
    top && top.votes ? (tie ? `تعادل في الصدارة بين «${top.label}» و«${second.label}» بـ${n(top.votes)} صوتًا لكل منهما.`
      : `تصدّر «${top.label}» بـ${n(top.votes)} صوتًا (${pct(top.votes, total)}% من الأصوات)${second ? `، بفارق ${n(top.votes - second.votes)} عن «${second.label}»` : ""}.`) : "لم تُسجَّل أصوات.",
    turnout != null ? `شارك ${n(voters)} من ${n(eligible)} يحق لهم التصويت، بنسبة مشاركة ${turnout}%.` : `شارك ${n(voters)}.`,
    p.max_choices > 1 ? `أمكن لكل مصوّت اختيار حتى ${p.max_choices === 2 ? "خيارين" : `${n(p.max_choices)} ${cnt(p.max_choices, "خيار", "خيارات", "خيارًا")}`}، فمجموع الأصوات ${n(total)}.` : `لكل مصوّت صوت واحد${p.kind === "election" ? " في اقتراع سري" : ""}.`,
  ];

  return [
    <Cover key="cover" theme={theme} c={{
      tag: ["check", "التصويت والاستطلاعات"], title: `تقرير ${kind}`, sub: p.title,
      badge: { main: fmtDate(p.closes_at), sub: "تاريخ الإغلاق" }, side: turnout != null ? { main: `${turnout}%`, sub: "المشاركة" } : null,
      rows: [["user", "أنشأه", p.created_by_name || "—"], ["users", "الفئة المستهدفة", who(p)],
             ["clock", "الفترة", `من ${dmy(p.opens_at.slice(0, 10))} إلى ${dmy(p.closes_at.slice(0, 10))}`],
             ["lock", "ظهور النتائج", POLL_RESULTS[p.results]?.t ?? "—"]],
      note: ["check", p.kind === "election" ? "اقتراع سري: يُعرف من صوّت لمنع التكرار، ولا يُعرف لمن صوّت أحد." : "صوت واحد لكل حساب، تضمنه قاعدة البيانات."],
      strip: [[voters, "مصوّتًا"], [eligible ?? "—", "يحق لهم"], [turnout != null ? `${turnout}%` : "—", "المشاركة"], [rows.length, p.kind === "election" ? cnt(rows.length, "مرشح", "مرشحين", "مرشحًا") : cnt(rows.length, "خيار", "خيارات", "خيارًا")]],
      foot: "التصويت والاستطلاعات",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "بيانات التصويت والمشاركة", sub: "كما سُجّلت في البوابة" }}>
      <table className="mr-table">
        <tbody>
          {[["النوع", kind, "الحالة", p.cancelled_at ? "ملغى" : new Date(p.closes_at) <= new Date() ? "مغلق" : "مفتوح"],
            ["يُفتح", fmtDateTime(p.opens_at), "يُغلق", fmtDateTime(p.closes_at)],
            ["الفئة", who(p), "ظهور النتائج", POLL_RESULTS[p.results]?.t ?? "—"]].map((r) => (
            <tr key={r[0]}><td style={{ width: 90, color: "var(--mr-ink2)" }}>{r[0]}</td><td>{r[1]}</td>
              <td style={{ width: 90, color: "var(--mr-ink2)" }}>{r[2]}</td><td>{r[3]}</td></tr>
          ))}
          {p.body && <tr><td style={{ color: "var(--mr-ink2)" }}>التوضيح</td><td colSpan={3}>{p.body}</td></tr>}
        </tbody>
      </table>
      <Kpis cols={4} items={[
        { ic: "users", t: "المصوّتون", v: voters, c: S[0] },
        { ic: "grid", t: "يحق لهم", v: eligible ?? "—", c: S[1] },
        { ic: "chart", t: "نسبة المشاركة", v: turnout != null ? `${turnout}%` : "—", c: S[2] },
        { ic: "list", t: "مجموع الأصوات", v: total, c: S[3] },
      ]} />
      <Highlights items={high} />
    </Page>,

    <Page key="res" {...common} page={3} sec={{ no: 2, title: "النتائج", sub: "مرتبة بعدد الأصوات" }}>
      <Box icon="chart" title={p.kind === "election" ? "أصوات المرشحين" : "أصوات الخيارات"}>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Donut total={total} label="صوتًا" parts={ranked.map((r, i) => ({ t: r.label, v: r.votes, c: COLORS[i % COLORS.length] }))} />
          <DonutLegend parts={ranked.map((r, i) => ({ t: r.label, v: r.votes, c: COLORS[i % COLORS.length] }))} />
        </div>
      </Box>
      <Box icon="list" title="الترتيب">
        <Bars full items={ranked.map((r, i) => ({ t: r.label, v: r.votes, c: COLORS[i % COLORS.length], note: `${pct(r.votes, total) ?? 0}%` }))} />
      </Box>
      <table className="mr-table">
        <thead><tr><th style={{ width: 30 }}>م</th><th>{p.kind === "election" ? "المرشح" : "الخيار"}</th><th style={{ width: 70 }}>الأصوات</th><th style={{ width: 70 }}>النسبة</th></tr></thead>
        <tbody>{ranked.map((r, i) => (
          <tr key={r.option_id}><td className="c num">{i + 1}</td><td>{r.label}{r.note && <span style={{ color: "var(--mr-ink2)", fontSize: 10.5 }}> · {r.note}</span>}</td>
            <td className="c num">{n(r.votes)}</td><td className="c num">{pct(r.votes, total) ?? 0}%</td></tr>
        ))}</tbody>
      </table>
    </Page>,

    <Page key="end" {...common} page={4} sec={{ no: 3, title: "الاعتماد", sub: "توقيع منشئ التصويت ومدير المدرسة" }}>
      <Box icon="check" title="إقرار" tint>
        <div className="mr-notes">نتائج هذا التقرير كما سجّلتها البوابة آليًا عند {new Date(p.closes_at) <= new Date() ? "إغلاق التصويت" : "إعداد التقرير"}، دون تدخل يدوي في الأصوات.</div>
      </Box>
      <Signs stamp={sigs.stamp} people={[
        { title: "منشئ التصويت", name: p.created_by_name },
        { title: "مدير المدرسة", name: sigs.principalName, sig: sigs.principal },
      ]} />
    </Page>,
  ];
}

/** عرض التقرير وطباعته وحفظه PDF */
export default function PollReport({ p, rows }) {
  const [theme, setTheme] = useState("light");
  const principal = usePrincipalSignature();
  const [stamp, setStamp] = useState(null);
  useEffect(() => {
    supabase.from("school_assets").select("path").eq("key", "stamp").maybeSingle().then(async ({ data }) => {
      if (!data?.path) return;
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(data.path, 3600);
      setStamp(s?.signedUrl ?? null);
    });
  }, []);
  const pages = useMemo(() => pollReportPages({ p, rows, theme, sigs: { principal: principal.url, principalName: principal.name, stamp } }),
    [p, rows, theme, principal, stamp]);
  return <ReportViewer id={`poll-report-${p.id}`} pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير ${p.title}`} />;
}
