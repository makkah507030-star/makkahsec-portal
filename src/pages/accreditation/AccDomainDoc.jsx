// src/pages/accreditation/AccDomainDoc.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import {
  DOMAINS, STANDARDS, INDICATORS, TOOLS, EV_STATUS, LEVEL_T, LEVELS, levelOf, stdOf, progOf, fmtPct, domainSummary,
} from "../../lib/accreditation.js";
import { S, Kpis, Box, Bars, Highlights, Signs, Page, Cover, paginate } from "../../components/report/ReportKit.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";

/* =====================================================================
   تقرير المجال لمشرفه بهوية التقارير الشهرية: الغلاف ← ملخص المجال (الأداء والإنجاز والشواهد
   والمعايير) ← مؤشرات المجال ← برامج خطة التحسين بقياس نواتجها ← الشواهد المرفوعة ←
   الشواهد غير المرفوعة ← الاعتماد بتوقيع مشرف المجال ومدير المدرسة.
   ===================================================================== */

const toolT = Object.fromEntries(TOOLS.map((t) => [t.key, t.t]));
const short = (t, n = 80) => (t && t.length > n ? `${t.slice(0, n)}…` : t);
const L = { color: "var(--mr-ink2)" };

export function domainPages({ d, data, rep, supervisors, coord, theme = "light", sigs = {} }) {
  const sm = domainSummary([d], { ...data, scores: rep?.scores ?? {} });
  const sc = rep?.scores ?? {};
  const lv = levelOf(sm.perf);
  const stds = Object.keys(STANDARDS).filter((s) => +s[0] === d);
  const stdAvg = (s) => { const v = sm.codes.filter((c) => stdOf(c) === s).map((c) => sc[c]).filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null; };
  const evCount = (c) => sm.gaps.up[c]?.length ?? 0;
  const kindOf = (c) => data.progs.find((p) => p.code === c)?.kind;
  const progs = [...sm.inPlan].sort((a, b) => a.code.localeCompare(b.code));
  const low = [...sm.codes].filter((c) => sc[c] != null).sort((a, b) => sc[a] - sc[b])[0];
  const best = [...progs].sort((a, b) => progOf(b).done - progOf(a).done)[0];

  const indPages = paginate(sm.codes, () => 40, 720, 820);
  const prgPages = paginate(progs, (p) => 96 + (p.methods?.length ?? 0) * 24, 760, 830);
  const evPages = paginate(sm.evs, () => 40, 740, 820);
  const misPages = paginate(sm.gaps.missing, () => 44, 720, 800);
  const total = 3 + indPages.length + prgPages.length + Math.max(1, evPages.length) + Math.max(1, misPages.length);
  const doc = { title: `تقرير مجال ${DOMAINS[d]}`, meta: ["لجنة التميز", rep ? `${rep.academic_year}هـ` : null], foot: "التقويم والاعتماد المدرسي" };
  const common = { theme, doc, total };
  let pg = 2;
  const names = supervisors.map((m) => m.full_name).join("، ") || "—";

  return [
    <Cover key="cover" theme={theme} c={{
      tag: ["chart", "التقويم والاعتماد المدرسي"], title: `مجال ${DOMAINS[d]}`, titleSize: 58, sub: "تقرير مشرف المجال",
      badge: { main: fmtPct(sm.perf), sub: "أداء المجال" }, side: lv ? { main: lv.t, sub: "المستوى" } : null,
      rows: [["users", "مشرف المجال", names], ["user", "مشرف اللجنة", coord ?? "—"],
             ["doc", "مصدر النتائج", rep ? rep.title : "—"], ["clock", "تاريخ التقرير", fmtDate(new Date())]],
      note: ["check", "يعرض مؤشرات المجال وبرامجه وما رُفع من شواهده وما لم يُرفع، كما سُجّلت في البوابة."],
      strip: [[sm.codes.length, "مؤشرًا"], [progs.length, "برنامجًا"], [sm.gaps.uploaded, "شاهدًا مرفوعًا"], [sm.gaps.missing.length, "غير مرفوع"]],
      foot: "التقويم والاعتماد المدرسي",
    }} />,

    <Page key="sum" {...common} page={pg++} sec={{ no: 1, title: "ملخص المجال", sub: `${DOMAINS[d]} · ${stds.length} معايير` }}>
      <Kpis cols={4} items={[
        { ic: "chart", t: "أداء المجال", v: fmtPct(sm.perf), s: lv?.t, c: S[0] },
        { ic: "check", t: "إنجاز البرامج", v: `${sm.done}%`, s: `تحققت الأهداف ${sm.met}%`, c: S[1] },
        { ic: "folder", t: "الشواهد المرفوعة", v: sm.gaps.uploaded, s: `المعتمد ${sm.approved}`, c: S[2] },
        { ic: "alert", t: "غير المرفوعة", v: sm.gaps.missing.length, s: `من ${sm.gaps.required} مطلوبًا في الخطة`, c: S[3] },
      ]} />
      <Box icon="list" title="معايير المجال">
        <Bars full max={100} items={stds.map((s) => ({ t: STANDARDS[s], v: stdAvg(s) ?? 0, c: levelOf(stdAvg(s))?.c, note: fmtPct(stdAvg(s)) }))} />
      </Box>
      <Box icon="grid" title="المؤشرات على المستويات">
        <Bars full items={LEVELS.map((l) => ({ t: l.t, v: sm.codes.filter((c) => levelOf(sc[c]) === l).length, c: l.c }))} />
      </Box>
      <Highlights items={[
        low && `أدنى مؤشرات المجال ${low} «${short(INDICATORS[low], 60)}» بنسبة ${sc[low]}%.`,
        best && `أعلى البرامج إنجازًا «${best.initiative}» بنسبة ${progOf(best).done}%.`,
        `${progs.length} برنامجًا ضمن الخطة و${sm.sustain.length} للاستدامة.`,
        sm.gaps.missing.length ? `${sm.gaps.missing.length} شاهدًا مطلوبًا لم يُرفع بعد.` : "رُفعت كل الشواهد المطلوبة في الخطة.",
      ].filter(Boolean)} />
    </Page>,

    ...indPages.map((rows, i) => (
      <Page key={`ind${i}`} {...common} page={pg++} sec={i ? null : { no: 2, title: "مؤشرات المجال", sub: "النسبة في آخر تقرير وحالة الشواهد" }}>
        <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>المؤشر</th><th style={{ width: 54 }}>النسبة</th><th style={{ width: 58 }}>المستوى</th><th style={{ width: 62 }}>الخطة</th><th style={{ width: 46 }}>الشواهد</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c}><td className="c num"><b>{c}</b></td><td style={{ fontSize: 10.5 }}>{INDICATORS[c]}</td>
              <td className="c num" style={{ color: levelOf(sc[c])?.c }}>{fmtPct(sc[c])}</td><td className="c">{levelOf(sc[c])?.t ?? "مستحدث"}</td>
              <td className="c">{kindOf(c) === "plan" ? "برنامج" : kindOf(c) === "sustain" ? "استدامة" : "—"}</td><td className="c num">{evCount(c)}</td></tr>))}</tbody>
        </table>
      </Page>
    )),

    ...prgPages.map((rows, i) => (
      <Page key={`prg${i}`} {...common} page={pg++} sec={i ? null : { no: 3, title: "برامج خطة التحسين", sub: "قياس نواتج المبادرات والبرامج" }}>
        {rows.map((p) => { const pr = progOf(p); return (
          <Box key={p.id} title={`${p.code} · ${p.initiative}`} aside={`نُفّذ ${pr.done}% · تحققت ${pr.met}%`}>
            <div className="num" style={{ fontSize: 10.5, ...L, marginBottom: 4 }}>الحالي {p.current == null ? "مستحدث" : `${p.current}%`} · المستهدف {fmtPct(p.target)} · {p.team?.join("، ")}</div>
            <table className="mr-table">
              <tbody>{(p.methods ?? []).map((m, k) => (
                <tr key={k}><td>{m.t}</td><td className="c" style={{ width: 52 }}>{m.done == null ? "—" : m.done ? "نُفّذ" : "لم يُنفّذ"}</td>
                  <td className="c" style={{ width: 56 }}>{LEVEL_T[m.level] ?? "—"}</td><td className="c" style={{ width: 70 }}>{m.met == null ? "—" : m.met ? "متحققة" : "غير متحققة"}</td></tr>))}</tbody>
            </table>
          </Box>
        ); })}
        {!rows.length && <p>لا برامج في هذا المجال.</p>}
      </Page>
    )),

    ...(evPages.length ? evPages : [[]]).map((rows, i) => (
      <Page key={`ev${i}`} {...common} page={pg++} sec={i ? null : { no: 4, title: "الشواهد المرفوعة", sub: `${sm.gaps.uploaded} شاهدًا · المعتمد ${sm.approved}` }}>
        {rows.length ? <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>الشاهد</th><th style={{ width: 110 }}>الأداة</th><th style={{ width: 52 }}>الحالة</th><th style={{ width: 120 }}>رفعه</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}><td className="c num"><b>{e.code}</b></td><td>{e.title}</td><td style={{ fontSize: 10 }}>{toolT[e.tool] ?? "—"}</td>
              <td className="c">{EV_STATUS[e.status].t}</td><td style={{ fontSize: 10 }}>{e.created_by_name ?? "—"} · <span className="num">{fmtDate(e.created_at)}</span></td></tr>))}</tbody>
        </table> : <Box tint><div className="mr-notes">لم يُرفع شاهد لهذا المجال بعد.</div></Box>}
      </Page>
    )),

    ...(misPages.length ? misPages : [[]]).map((rows, i) => (
      <Page key={`mis${i}`} {...common} page={pg++} sec={i ? null : { no: 5, title: "الشواهد غير المرفوعة", sub: "المطلوبة في برامج الخطة، والمؤشرات التي لا شاهد لها" }}>
        {rows.length ? <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>الشاهد المطلوب</th><th style={{ width: 150 }}>البرنامج</th></tr></thead>
          <tbody>{rows.map((x, k) => (
            <tr key={k}><td className="c num"><b>{x.code}</b></td><td>{x.title ?? <span style={L}>لا شاهد للمؤشر بعد</span>}</td>
              <td style={{ fontSize: 10 }}>{data.progs.find((p) => p.code === x.code)?.initiative ?? "—"}</td></tr>))}</tbody>
        </table> : <Box tint><div className="mr-notes">رُفعت كل الشواهد المطلوبة في برامج المجال.</div></Box>}
      </Page>
    )),

    <Page key="end" {...common} page={pg++} sec={{ no: 6, title: "الاعتماد", sub: "إقرار مشرف المجال ومدير المدرسة" }}>
      <Box icon="check" title="إقرار" tint>
        <div className="mr-notes">بيانات هذا التقرير كما سجّلتها البوابة عند إعداده: نسب المؤشرات من {rep ? `«${rep.title}»` : "آخر تقرير"}، وقياس نواتج البرامج كما عبّأه الفريق المكلف، والشواهد كما رُفعت في القسم.</div>
      </Box>
      <Signs stamp={sigs.stamp} people={[
        { title: "مشرف المجال", name: names },
        { title: "مدير المدرسة · رئيس لجنة التميز", name: sigs.principalName, sig: sigs.principal },
      ]} />
    </Page>,
  ];
}

export default function AccDomainReport({ d, data, reports, members, onClose }) {
  const [theme, setTheme] = useState("light");
  const principal = usePrincipalSignature();
  const [stamp, setStamp] = useState(null);
  const rep = reports.find((r) => r.kind === "external") ?? reports.find((r) => r.kind === "self");
  useEffect(() => {
    supabase.from("school_assets").select("path").eq("key", "stamp").maybeSingle().then(async ({ data: a }) => {
      if (!a?.path) return;
      const { data: s } = await supabase.storage.from("form-assets").createSignedUrl(a.path, 3600);
      setStamp(s?.signedUrl ?? null);
    });
  }, []);
  const supervisors = useMemo(() => members.filter((m) => m.role !== "coordinator" && m.domains.includes(d)), [members, d]);
  const coord = members.find((m) => m.role === "coordinator")?.full_name;
  const pages = useMemo(() => domainPages({ d, data, rep, supervisors, coord, theme, sigs: { principal: principal.url, principalName: principal.name, stamp } }),
    [d, data, rep, supervisors, coord, theme, principal, stamp]);
  return (
    <div className="space-y-3">
      <button className="text-sm font-semibold text-mint-deep" onClick={onClose}>→ العودة</button>
      <ReportViewer id={`acc-domain-${d}`} pages={pages} theme={theme} setTheme={setTheme} fileTitle={`تقرير مجال ${DOMAINS[d]}`} />
    </div>
  );
}
