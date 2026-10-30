// src/pages/accreditation/AccPlanDoc.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import { DOMAINS, STANDARDS, INDICATORS, LEVEL_T, analyze, levelOf, stdOf, progOf, fmtPct } from "../../lib/accreditation.js";
import { S, Kpis, Box, Bars, Highlights, Signs, Page, Cover, paginate } from "../../components/report/ReportKit.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";

/* =====================================================================
   تقرير خطة التحسين بطقم التقارير (components/report) على شكل ملف المدرسة:
   الغلاف ← لوحة النتائج ← ملخص البرامج ← صفحة لكل برنامج (المبادرة وأساليب التنفيذ بقياسها،
   والشواهد، ومؤشر القياس، والتوصيات) ← جدول الاستدامة ← المتابعة والاعتماد.
   ===================================================================== */

const short = (t, n = 70) => (t && t.length > n ? `${t.slice(0, n)}…` : t);

export function planPages({ plan, progs, rep, theme = "light", sigs = {} }) {
  const a = analyze(rep?.scores ?? {});
  const lv = levelOf(a.overall);
  const inPlan = progs.filter((p) => p.kind === "plan").sort((x, y) => x.code.localeCompare(y.code));
  const sustain = progs.filter((p) => p.kind === "sustain").sort((x, y) => x.code.localeCompare(y.code));
  const avgDone = inPlan.length ? Math.round(inPlan.reduce((s, p) => s + progOf(p).done, 0) / inPlan.length) : 0;
  const sumPages = paginate(inPlan, () => 38, 760, 820);
  const susPages = paginate(sustain, () => 34, 780, 820);
  const total = 3 + sumPages.length + inPlan.length + susPages.length;
  const doc = { title: "خطة التحسين والتطوير", meta: [`النسخة ${plan.version}`, plan.academic_year ? `${plan.academic_year}هـ` : null], foot: "التقويم والاعتماد المدرسي" };
  const common = { theme, doc, total };
  let pg = 2;
  const sumT = (rows) => (
    <table className="mr-table">
      <thead><tr><th style={{ width: 62 }}>الرمز</th><th>المؤشر والبرنامج</th><th style={{ width: 54 }}>الحالي</th><th style={{ width: 54 }}>المستهدف</th><th style={{ width: 54 }}>الإنجاز</th></tr></thead>
      <tbody>{rows.map((p) => (
        <tr key={p.id}><td className="c num"><b>{p.code}</b></td>
          <td><b>{p.initiative}</b><div style={{ color: "var(--mr-ink2)", fontSize: 10 }}>{short(INDICATORS[p.code], 90)}</div></td>
          <td className="c num" style={{ color: levelOf(p.current)?.c }}>{p.current == null ? "مستحدث" : `${p.current}%`}</td>
          <td className="c num">{fmtPct(p.target)}</td><td className="c num">{progOf(p).done}%</td></tr>))}</tbody>
    </table>
  );

  return [
    <Cover key="cover" theme={theme} c={{
      tag: ["chart", "التقويم والاعتماد المدرسي"], title: "خطة التحسين والتطوير", titleSize: 56, sub: plan.title,
      badge: { main: fmtPct(a.overall), sub: "الأداء العام" }, side: lv ? { main: lv.t, sub: "المستوى" } : null,
      rows: [["doc", "مصدر النتائج", plan.source === "external" ? "تقرير التقويم الخارجي" : "تقرير التقويم الذاتي"],
             ["list", "النسخة", `${plan.version} — ${plan.status === "active" ? "السارية" : plan.status === "draft" ? "مسودة" : "مؤرشفة"}`],
             ["check", "الاعتماد", plan.approved_at ? fmtDate(plan.approved_at) : "—"],
             ["users", "الإعداد", "لجنة التميز (فريق التقويم الذاتي)"]],
      note: ["spark", "وفق معايير هيئة تقويم التعليم والتدريب، الدليل الإجرائي للتقويم المدرسي الذاتي — الإصدار الثالث 1447هـ."],
      strip: [[a.measured, "مؤشرًا مقاسًا"], [inPlan.length, "ضمن الخطة"], [sustain.length, "للاستدامة"], [`${avgDone}%`, "إنجاز البرامج"]],
      foot: "التقويم والاعتماد المدرسي",
    }} />,

    <Page key="dash" {...common} page={pg++} sec={{ no: 1, title: "لوحة نتائج التقويم", sub: plan.source === "external" ? "من تقرير التقويم الخارجي" : "من تقرير التقويم الذاتي" }}>
      <Kpis cols={4} items={[
        { ic: "chart", t: "الأداء العام", v: fmtPct(a.overall), s: lv?.t, c: S[0] },
        { ic: "grid", t: "المؤشرات المقاسة", v: a.measured, s: "من 47 مؤشرًا", c: S[1] },
        { ic: "list", t: "ضمن خطة التحسين", v: inPlan.length, c: S[2] },
        { ic: "award", t: "للاستدامة", v: sustain.length, s: "تقدم وتميز", c: S[3] },
      ]} />
      <Box icon="chart" title="أداء المجالات الأربعة">
        <Bars full max={100} items={Object.keys(DOMAINS).map((d) => ({ t: DOMAINS[d], v: a.byDomain[d] ?? 0, c: levelOf(a.byDomain[d])?.c, note: fmtPct(a.byDomain[d]) }))} />
      </Box>
      <Box icon="list" title="المعايير">
        <Bars full max={100} items={Object.keys(STANDARDS).map((s) => ({ t: STANDARDS[s], v: a.byStd[s] ?? 0, c: levelOf(a.byStd[s])?.c, note: fmtPct(a.byStd[s]) }))} />
      </Box>
      <Highlights items={[
        a.low[0] && `أدنى مؤشر: \u2066${a.low[0]}\u2069 «${short(INDICATORS[a.low[0]], 60)}» بنسبة ${rep.scores[a.low[0]]}%.`,
        a.high[0] && `أعلى مؤشر: \u2066${a.high[0]}\u2069 بنسبة ${rep.scores[a.high[0]]}%.`,
        `${a.below.length} مؤشرًا دون مستوى التقدم (75%)، ومتوسط إنجاز برامج الخطة ${avgDone}%.`,
      ].filter(Boolean)} />
    </Page>,

    ...sumPages.map((rows, i) => (
      <Page key={`sum${i}`} {...common} page={pg++} sec={i ? null : { no: 2, title: "برامج خطة التحسين", sub: "لكل مؤشر دون المستهدف برنامج" }}>{sumT(rows)}</Page>
    )),

    ...inPlan.map((p) => {
      const pr = progOf(p); const l = levelOf(p.current);
      return (
        <Page key={p.id} {...common} page={pg++}>
          <Box tint title={`${p.code} · ${STANDARDS[stdOf(p.code)]}`} aside={p.semester}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{INDICATORS[p.code]}</div>
            <div className="num" style={{ marginTop: 6, fontSize: 11.5 }}>المستوى الحالي <b style={{ color: l?.c }}>{p.current == null ? "مستحدث بلا قياس" : `${p.current}% (${l?.t})`}</b> · المستهدف <b>{fmtPct(p.target)}</b>
              {p.current != null && p.target != null && <> · الفجوة <b>{Math.round((p.target - p.current) * 100) / 100}</b> نقطة</>}</div>
          </Box>
          <table className="mr-table">
            <tbody>
              <tr><td style={{ width: 120, color: "var(--mr-ink2)" }}>المبادرة</td><td><b>{p.initiative}</b></td></tr>
              <tr><td style={{ color: "var(--mr-ink2)" }}>الفريق المكلف</td><td>{p.team?.join("، ")}</td></tr>
              <tr><td style={{ color: "var(--mr-ink2)" }}>المتابعة</td><td>{p.follow} · {p.period}</td></tr>
              <tr><td style={{ color: "var(--mr-ink2)" }}>مؤشر القياس</td><td>{p.measure}</td></tr>
              {p.needs && <tr><td style={{ color: "var(--mr-ink2)" }}>الاحتياجات</td><td>{p.needs}</td></tr>}
              <tr><td style={{ color: "var(--mr-ink2)" }}>الأدلة والشواهد</td><td>{p.evidence?.join(" · ")}</td></tr>
            </tbody>
          </table>
          <Box icon="check" title="قياس نواتج المبادرات والبرامج" aside={`نُفّذ ${pr.done}% · تحققت ${pr.met}%`}>
            <table className="mr-table">
              <thead><tr><th>البرامج وأساليب التنفيذ</th><th style={{ width: 60 }}>التنفيذ</th><th style={{ width: 70 }}>الإنجاز</th><th style={{ width: 80 }}>الأهداف</th></tr></thead>
              <tbody>{(p.methods ?? []).map((m, i) => (
                <tr key={i}><td>{m.t}</td><td className="c">{m.done == null ? "—" : m.done ? "نعم" : "لا"}</td>
                  <td className="c">{LEVEL_T[m.level] ?? "—"}</td><td className="c">{m.met == null ? "—" : m.met ? "متحققة" : "غير متحققة"}</td></tr>))}</tbody>
            </table>
          </Box>
          {p.rec && <Box icon="spark" title="التوصيات والمقترحات العلاجية"><div className="mr-notes">{p.rec}</div></Box>}
        </Page>
      );
    }),

    ...susPages.map((rows, i) => (
      <Page key={`sus${i}`} {...common} page={pg++} sec={i ? null : { no: 3, title: "جدول الاستدامة", sub: "مؤشرات في مستوى التقدم والتميز تُستدام بإجراء موجز ويُعاد قياسها" }}>
        <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>المؤشر</th><th style={{ width: 50 }}>الحالي</th><th>إجراء الاستدامة</th><th style={{ width: 80 }}>المسؤول</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}><td className="c num"><b>{p.code}</b></td><td style={{ fontSize: 10 }}>{short(INDICATORS[p.code], 80)}</td>
              <td className="c num">{fmtPct(p.current)}</td><td>{p.initiative}</td><td className="c">{p.owner}</td></tr>))}</tbody>
        </table>
      </Page>
    )),

    <Page key="end" {...common} page={pg++} sec={{ no: 4, title: "المتابعة والاعتماد", sub: "تُراجع الخطة دوريًا في ضوء نتائج المتابعة" }}>
      <table className="mr-table">
        <thead><tr><th>محطة المتابعة</th><th style={{ width: 170 }}>الموعد</th><th style={{ width: 120 }}>المسؤول</th><th style={{ width: 70 }}>الحالة</th></tr></thead>
        <tbody>{(plan.milestones ?? []).map((m, i) => (
          <tr key={i}><td>{m.title}</td><td>{m.due}</td><td>{m.owner}</td><td className="c">{m.done_at ? `✓ ${fmtDate(m.done_at)}` : "—"}</td></tr>))}</tbody>
      </table>
      <Box icon="check" title="إقرار" tint>
        <div className="mr-notes">تُراجع هذه الخطة دوريًا، وتُحدَّث المستهدفات والإجراءات بما يضمن تحقيق أهدافها، وتُحدَّث بعد صدور تقرير التقويم الخارجي، وتُعتمد نسختها من مدير المدرسة بعد إقرارها من لجنة التميز.</div>
      </Box>
      <Signs stamp={sigs.stamp} people={[
        { title: "مشرف لجنة التميز", name: sigs.coord },
        { title: "مدير المدرسة · رئيس اللجنة", name: sigs.principalName, sig: sigs.principal },
      ]} />
    </Page>,
  ];
}

export default function AccPlanReport({ plan, progs, reports, members = [], onClose }) {
  const [theme, setTheme] = useState("official");
  const principal = usePrincipalSignature();
  const [stamp, setStamp] = useState(null);
  const rep = reports.find((r) => r.id === plan.report_id) ?? reports.find((r) => r.kind === "self");
  useEffect(() => {
    supabase.from("school_assets").select("path").eq("key", "stamp").maybeSingle().then(async ({ data }) => {
      if (!data?.path) return;
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(data.path, 3600);
      setStamp(s?.signedUrl ?? null);
    });
  }, []);
  const coord = members.find((m) => m.role === "coordinator")?.full_name;
  const pages = useMemo(() => planPages({ plan, progs, rep, theme, sigs: { principal: principal.url, principalName: principal.name, stamp, coord } }),
    [plan, progs, rep, theme, principal, stamp, coord]);
  return (
    <div className="space-y-3">
      <button className="text-sm font-semibold text-mint-deep" onClick={onClose}>→ العودة إلى الخطة</button>
      <ReportViewer id={`acc-plan-${plan.id}`} pages={pages} theme={theme} setTheme={setTheme} fileTitle={plan.title} />
    </div>
  );
}
