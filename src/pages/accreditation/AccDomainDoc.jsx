// src/pages/accreditation/AccDomainDoc.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { fmtDate } from "../../lib/dates";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import {
  DOMAINS, STANDARDS, INDICATORS, EV_STATUS, LEVEL_T, LEVELS, roleT, levelOf, stdOf, progOf, fmtPct, domainSummary,
} from "../../lib/accreditation.js";
import { NAT_TESTS, NAT_BANDS, natSeries, signed } from "../../lib/accNational.js";
import { S, Kpis, Box, Bars, Highlights, Signs, Page, Cover, paginate } from "../../components/report/ReportKit.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";

/* =====================================================================
   تقرير المجال لمشرفه، والتقرير العام لمشرف اللجنة بالمجالات الأربعة، بهوية التقارير الشهرية:
   الغلاف ← الملخص (الأداء والإنجاز والشواهد والمعايير) ← المؤشرات ← الاختبارات الوطنية (لنواتج التعلم) ← برامج خطة التحسين بقياس
   نواتجها ← الشواهد المرفوعة ← غير المرفوعة ← مساهمة المشرفين ← الاعتماد والتوقيع والختم.
   ===================================================================== */

const short = (t, n = 80) => (t && t.length > n ? `${t.slice(0, n)}…` : t);
const L = { color: "var(--mr-ink2)" };

/* مساهمة كل مشرف: شواهده في مجالات التقرير ومعتمدها، وحضوره الاجتماعات، والقرارات المسندة إليه باسمه في المحضر */
function contribution(m, ds, data) {
  const ev = data.ev.filter((e) => e.created_by === m.user_id && ds.includes(e.domain));
  const first = m.full_name.split(" ")[0];
  const last = m.full_name.split(" ").slice(-1)[0];
  const tasks = data.meetings.flatMap((x) => x.decisions.filter((d) => d.owner && d.owner.includes(first) && d.owner.includes(last)));
  return { m, ev: ev.length, approved: ev.filter((e) => e.status === "approved").length,
    attended: data.meetings.filter((x) => x.attendees.includes(m.user_id)).length, tasks: tasks.length, done: tasks.filter((t) => t.done).length };
}

/* d: رقم المجال لتقرير مشرفه، أو 0 للتقرير العام لمشرف اللجنة بالمجالات الأربعة */
export function domainPages({ d, data, rep, members, theme = "light", sigs = {} }) {
  const all = !d;
  const ds = all ? [1, 2, 3, 4] : [d];
  const supervisors = members.filter((m) => m.role !== "coordinator" && ds.some((x) => m.domains.includes(x)));
  const coordM = members.find((m) => m.role === "coordinator");
  const coord = coordM?.full_name;
  const people = all ? [...(coordM ? [coordM] : []), ...supervisors] : supervisors;
  const contrib = people.map((m) => contribution(m, ds, data));
  const W = all ? "المجالات" : "المجال";
  const sm = domainSummary(ds, { ...data, scores: rep?.scores ?? {} });
  const sc = rep?.scores ?? {};
  const lv = levelOf(all ? (rep?.scores?._overall ?? sm.perf) : sm.perf);
  const stds = Object.keys(STANDARDS).filter((s) => ds.includes(+s[0]));
  const domAvg = (x) => domainSummary([x], { ...data, scores: rep?.scores ?? {} }).perf;
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
  const conPages = paginate(contrib, () => 40, 700, 820);
  const nat = ds.includes(3) ? Object.keys(NAT_TESTS).map((k) => [k, natSeries(data.nat ?? [], k)]).filter(([, x]) => x.length) : [];
  const total = 3 + (nat.length ? 1 : 0) + Math.max(1, conPages.length) + indPages.length + prgPages.length + Math.max(1, evPages.length) + Math.max(1, misPages.length);
  const doc = { title: all ? "التقرير العام للجنة التميز" : `تقرير مجال ${DOMAINS[d]}`, meta: ["لجنة التميز", rep ? `${rep.academic_year}هـ` : null], foot: "التقويم والاعتماد المدرسي" };
  const common = { theme, doc, total };
  let pg = 2, no = 2;
  const names = supervisors.map((m) => m.full_name).join("، ") || "—";

  return [
    <Cover key="cover" theme={theme} c={{
      tag: ["chart", "التقويم والاعتماد المدرسي"], title: all ? "لجنة التميز" : `مجال ${DOMAINS[d]}`, titleSize: 58,
      sub: all ? "التقرير العام لمشرف اللجنة" : "تقرير مشرف المجال",
      badge: { main: fmtPct(all ? (rep?.scores?._overall ?? sm.perf) : sm.perf), sub: all ? "الأداء العام" : "أداء المجال" }, side: lv ? { main: lv.t, sub: "المستوى" } : null,
      rows: [["users", all ? "مشرفو المجالات" : "مشرف المجال", names], ["user", "مشرف اللجنة", coord ?? "—"],
             ["doc", "مصدر النتائج", rep ? rep.title : "—"], ["clock", "تاريخ التقرير", fmtDate(new Date())]],
      note: ["check", `يعرض مؤشرات ${W} وبرامجه وما رُفع من شواهده وما لم يُرفع، ومساهمة ${all ? "كل مشرف" : "مشرف المجال"}، كما سُجّلت في البوابة.`],
      strip: [[sm.codes.length, "مؤشرًا"], [progs.length, "برنامجًا"], [sm.gaps.uploaded, "شاهدًا مرفوعًا"], [sm.gaps.missing.length, "غير مرفوع"]],
      foot: "التقويم والاعتماد المدرسي",
    }} />,

    <Page key="sum" {...common} page={pg++} sec={{ no: 1, title: `ملخص ${W}`, sub: all ? `4 مجالات · ${stds.length} معيارًا` : `${DOMAINS[d]} · ${stds.length} معايير` }}>
      <Kpis cols={4} items={[
        { ic: "chart", t: all ? "متوسط المؤشرات" : "أداء المجال", v: fmtPct(sm.perf), s: lv?.t, c: S[0] },
        { ic: "check", t: "إنجاز البرامج", v: `${sm.done}%`, s: `تحققت الأهداف ${sm.met}%`, c: S[1] },
        { ic: "folder", t: "الشواهد المرفوعة", v: sm.gaps.uploaded, s: `المعتمد ${sm.approved}`, c: S[2] },
        { ic: "alert", t: "غير المرفوعة", v: sm.gaps.missing.length, s: `من ${sm.gaps.required} مطلوبًا في الخطة`, c: S[3] },
      ]} />
      {all && <Box icon="chart" title="أداء المجالات الأربعة">
        <Bars full max={100} items={ds.map((x) => ({ t: DOMAINS[x], v: domAvg(x) ?? 0, c: levelOf(domAvg(x))?.c, note: fmtPct(domAvg(x)) }))} />
      </Box>}
      <Box icon="list" title={`معايير ${W}`}>
        <Bars full max={100} items={stds.map((s) => ({ t: STANDARDS[s], v: stdAvg(s) ?? 0, c: levelOf(stdAvg(s))?.c, note: fmtPct(stdAvg(s)) }))} />
      </Box>
      <Box icon="grid" title="المؤشرات على المستويات">
        <Bars full items={LEVELS.map((l) => ({ t: l.t, v: sm.codes.filter((c) => levelOf(sc[c]) === l).length, c: l.c }))} />
      </Box>
      <Highlights items={[
        low && `أدنى مؤشرات ${W} ${low} «${short(INDICATORS[low], 60)}» بنسبة ${sc[low]}%.`,
        best && `أعلى البرامج إنجازًا «${best.initiative}» بنسبة ${progOf(best).done}%.`,
        `${progs.length} برنامجًا ضمن الخطة و${sm.sustain.length} للاستدامة.`,
        sm.gaps.missing.length ? `${sm.gaps.missing.length} شاهدًا مطلوبًا لم يُرفع بعد.` : "رُفعت كل الشواهد المطلوبة في الخطة.",
      ].filter(Boolean)} />
    </Page>,

    ...indPages.map((rows, i) => (
      <Page key={`ind${i}`} {...common} page={pg++} sec={i ? null : { no: no++, title: `مؤشرات ${W}`, sub: "النسبة في آخر تقرير وحالة الشواهد" }}>
        <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>المؤشر</th><th style={{ width: 54 }}>النسبة</th><th style={{ width: 58 }}>المستوى</th><th style={{ width: 62 }}>الخطة</th><th style={{ width: 46 }}>الشواهد</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c}><td className="c num"><b>{c}</b></td><td style={{ fontSize: 10.5 }}>{INDICATORS[c]}</td>
              <td className="c num" style={{ color: levelOf(sc[c])?.c }}>{fmtPct(sc[c])}</td><td className="c">{levelOf(sc[c])?.t ?? "مستحدث"}</td>
              <td className="c">{kindOf(c) === "plan" ? "برنامج" : kindOf(c) === "sustain" ? "استدامة" : "—"}</td><td className="c num">{evCount(c)}</td></tr>))}</tbody>
        </table>
      </Page>
    )),

    ...(nat.length ? [
      <Page key="nat" {...common} page={pg++} sec={{ no: no++, title: "الاختبارات الوطنية", sub: "بطاقات القدرات والتحصيلي من هيئة تقويم التعليم والتدريب" }}>
        {nat.map(([k, x]) => { const r = x[x.length - 1]; const T = NAT_TESTS[k]; return (
          <Box key={k} icon="chart" title={`${T.full} · ${r.academic_year}هـ`} aside={`${r.takers ?? "—"} مختبرًا`}>
            <table className="mr-table">
              <thead><tr><th>المتوسط</th><th>عن السابق</th><th>المدرسة / الإدارة / المملكة</th><th>الترتيب في المملكة</th><th>الترتيب في الإدارة</th></tr></thead>
              <tbody><tr><td className="c num"><b>{r.avg}</b></td><td className="c num">{r.change_pct == null ? "—" : `${signed(r.change_pct)}%`}</td>
                <td className="c num">{[r.school_avg, r.district_avg, r.kingdom_avg].map((v) => v ?? "—").join(" / ")}</td>
                <td className="c num">{r.kingdom_above != null ? `أعلى من ${r.kingdom_above}%` : "—"}{r.kingdom_rank ? ` (${r.kingdom_rank} من ${r.kingdom_total})` : ""}</td>
                <td className="c num">{r.district_above != null ? `أعلى من ${r.district_above}%` : "—"}{r.district_rank ? ` (${r.district_rank} من ${r.district_total})` : ""}</td></tr></tbody>
            </table>
            <Bars full max={100} items={NAT_BANDS.map((b) => ({ t: `${b.t} (${b.s})`, v: r[b.k] ?? 0, c: b.c, note: fmtPct(r[b.k]) }))} />
            {r.subs?.length > 0 && <Bars full max={100} items={[...r.subs].sort((a, b) => a.v - b.v).map((s2) => ({ t: s2.t, v: s2.v, c: S[2], note: `${r.subs_estimated ? "≈" : ""}${s2.v}` }))} />}
            <div className="mr-notes" style={{ fontSize: 10, ...L }}>
              {T.growth}: {r.isBase ? `هذا العام خط الأساس (المتوسط ${r.avg}).` : `المتوسط ${signed(r.dBase)} عن خط الأساس ${x.find((y) => y.isBase).academic_year}هـ (${x.find((y) => y.isBase).avg}).`}
              {x.length > 1 && ` المتوسط عبر الأعوام: ${x.map((y) => `${y.academic_year}هـ ${y.avg}`).join(" · ")}.`}
              {r.subs_estimated ? " المجالات الفرعية تقديرية من أطوال الأشرطة في البطاقة." : ""}
            </div>
          </Box>
        ); })}
      </Page>,
    ] : []),

    ...prgPages.map((rows, i) => (
      <Page key={`prg${i}`} {...common} page={pg++} sec={i ? null : { no: no++, title: "برامج خطة التحسين", sub: "قياس نواتج المبادرات والبرامج" }}>
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
        {!rows.length && <p>لا برامج.</p>}
      </Page>
    )),

    ...(evPages.length ? evPages : [[]]).map((rows, i) => (
      <Page key={`ev${i}`} {...common} page={pg++} sec={i ? null : { no: no++, title: "الشواهد المرفوعة", sub: `${sm.gaps.uploaded} شاهدًا · المعتمد ${sm.approved}` }}>
        {rows.length ? <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>الشاهد</th><th style={{ width: 52 }}>الحالة</th><th style={{ width: 120 }}>رفعه</th></tr></thead>
          <tbody>{rows.map((e) => (
            <tr key={e.id}><td className="c num"><b>{e.code}</b></td><td>{e.title}{e.link?.startsWith("portal:") && <span style={L}> · من أعمال البوابة</span>}</td>
              <td className="c">{EV_STATUS[e.status].t}</td><td style={{ fontSize: 10 }}>{e.created_by_name ?? "—"} · <span className="num">{fmtDate(e.created_at)}</span></td></tr>))}</tbody>
        </table> : <Box tint><div className="mr-notes">لم يُرفع شاهد بعد.</div></Box>}
      </Page>
    )),

    ...(misPages.length ? misPages : [[]]).map((rows, i) => (
      <Page key={`mis${i}`} {...common} page={pg++} sec={i ? null : { no: no++, title: "الشواهد غير المرفوعة", sub: "المطلوبة في برامج الخطة، والمؤشرات التي لا شاهد لها" }}>
        {rows.length ? <table className="mr-table">
          <thead><tr><th style={{ width: 62 }}>الرمز</th><th>الشاهد المطلوب</th><th style={{ width: 150 }}>البرنامج</th></tr></thead>
          <tbody>{rows.map((x, k) => (
            <tr key={k}><td className="c num"><b>{x.code}</b></td><td>{x.title ?? <span style={L}>لا شاهد للمؤشر بعد</span>}</td>
              <td style={{ fontSize: 10 }}>{data.progs.find((p) => p.code === x.code)?.initiative ?? "—"}</td></tr>))}</tbody>
        </table> : <Box tint><div className="mr-notes">رُفعت كل الشواهد المطلوبة في البرامج.</div></Box>}
      </Page>
    )),

    ...(conPages.length ? conPages : [[]]).map((rows, i) => (
      <Page key={`con${i}`} {...common} page={pg++} sec={i ? null : { no: no++, title: all ? "مساهمة مشرفي اللجنة" : "مساهمة مشرف المجال", sub: "الشواهد والاجتماعات والقرارات المسندة" }}>
        {rows.length ? <>
          <table className="mr-table">
            <thead><tr><th>الاسم</th><th style={{ width: 120 }}>الصفة</th><th style={{ width: 52 }}>الشواهد</th><th style={{ width: 52 }}>المعتمد</th><th style={{ width: 62 }}>الاجتماعات</th><th style={{ width: 70 }}>القرارات</th></tr></thead>
            <tbody>{rows.map((x) => (
              <tr key={x.m.user_id}><td><b>{x.m.full_name}</b><div style={{ fontSize: 9.5, ...L }}>{x.m.role === "coordinator" ? "كل المجالات" : x.m.domains.map((k) => DOMAINS[k]).join("، ")}</div></td>
                <td style={{ fontSize: 10 }}>{roleT(x.m)}{x.m.title && ` · ${x.m.title}`}</td>
                <td className="c num">{x.ev}</td><td className="c num">{x.approved}</td>
                <td className="c num">{x.attended} / {data.meetings.length}</td><td className="c num">{x.tasks ? `${x.done} / ${x.tasks}` : "—"}</td></tr>))}</tbody>
          </table>
          {i === 0 && <div className="mr-notes" style={{ marginTop: 8, fontSize: 10, ...L }}>القرارات: ما نُفّذ من القرارات المكتوب اسمه في خانة «المسؤول» بمحاضر اللجنة.</div>}
        </> : <Box tint><div className="mr-notes">لم يُسند هذا المجال إلى مشرف بعد.</div></Box>}
      </Page>
    )),

    <Page key="end" {...common} page={pg++} sec={{ no: no++, title: "الاعتماد", sub: all ? "إقرار مشرف اللجنة ومدير المدرسة" : "إقرار مشرف المجال ومدير المدرسة" }}>
      <Box icon="check" title="إقرار" tint>
        <div className="mr-notes">بيانات هذا التقرير كما سجّلتها البوابة عند إعداده: نسب المؤشرات من {rep ? `«${rep.title}»` : "آخر تقرير"}، وقياس نواتج البرامج كما عبّأه الفريق المكلف، والشواهد كما رُفعت في القسم.</div>
      </Box>
      <Signs stamp={sigs.stamp} people={[
        { title: all ? "مشرف اللجنة" : "مشرف المجال", name: all ? coord : names },
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
  const pages = useMemo(() => domainPages({ d, data, rep, members, theme, sigs: { principal: principal.url, principalName: principal.name, stamp } }),
    [d, data, rep, members, theme, principal, stamp]);
  return (
    <div className="space-y-3">
      <button className="text-sm font-semibold text-mint-deep" onClick={onClose}>→ العودة</button>
      <ReportViewer id={`acc-domain-${d}`} pages={pages} theme={theme} setTheme={setTheme} fileTitle={d ? `تقرير مجال ${DOMAINS[d]}` : "التقرير العام للجنة التميز"} />
    </div>
  );
}
