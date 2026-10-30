// src/pages/accreditation/AccDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useSession } from "../../lib/session.jsx";
import { fmtDate } from "../../lib/dates";
import {
  CODES, DOMAINS, DOMAIN_COLOR, INDICATORS, LEVELS, PLAN_BELOW, analyze, domainOf, domainSummary, fmtPct, levelOf, loadAccData, progOf,
} from "../../lib/accreditation.js";
import { NAT_TESTS, natGrowth, natSeries, signed } from "../../lib/accNational.js";
import { NatCard } from "./AccNational.jsx";
import Loader from "../../components/Loader.jsx";

/* =====================================================================
   لوحة الأداء: ما يحتاجه القرار في صفحة واحدة بجداول واضحة.
   • الأداء العام على سلّم المستويات الأربعة، وأرقام الخطة والشواهد.
   • جدول المجالات: الأداء والمستوى، والمؤشرات ودون التقدم منها، وبرامج الخطة وإنجازها، والشواهد والمتبقي.
   • جدول أولويات التحسين: كل مؤشر دون التقدم بفجوته وبرنامجه وإنجازه وشواهده، مرتبًا من الأدنى.
   • الاختبارات الوطنية (القدرات والتحصيلي) لمن يرى مجال نواتج التعلم، وقياس المستحدثين على خط أساسها.
   • جوانب القوة، والمحطة القادمة في الخطة.
   ===================================================================== */

const lvChip = (v) => { const l = levelOf(v); return l ? <span className="inline-block rounded-pill px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: `${l.c}1A`, color: l.c }}>{l.t}</span> : <span className="text-xs text-faint">مستحدث</span>; };
const pctColor = (p) => (p >= 75 ? "rgb(var(--c-present))" : p >= 40 ? "rgb(var(--c-late))" : "rgb(var(--c-absent))");

/* شريط بنسبة مع علامتي حد التقدم (75) والتميز (90) */
function Meter({ v, color, h = "h-2.5" }) {
  return (
    <span className={`relative block ${h} w-full overflow-hidden rounded-pill bg-canvas`}>
      <span className="absolute inset-y-0 start-0 rounded-pill" style={{ width: `${v ?? 0}%`, background: color }} />
      <span className="absolute inset-y-0 w-px bg-ink/30" style={{ insetInlineStart: "75%" }} />
      <span className="absolute inset-y-0 w-px bg-ink/30" style={{ insetInlineStart: "90%" }} />
    </span>
  );
}

export default function AccDashboard({ me, reports, plans, members, go }) {
  const { profile } = useSession();
  const self = members.find((m) => m.user_id === profile?.id);
  const ext = reports.find((r) => r.kind === "external");
  const base = ext ?? reports.find((r) => r.kind === "self");
  const sc = useMemo(() => base?.scores ?? {}, [base]);
  const a = useMemo(() => analyze(sc), [sc]);
  const [data, setData] = useState(null);
  const [allLow, setAllLow] = useState(false);
  useEffect(() => { loadAccData(plans).then(setData); }, [plans]);
  const doms = Object.keys(DOMAINS).map(Number).filter((d) => me.coord || me.domains.includes(d));
  const rows = useMemo(() => (data ? doms.map((d) => [d, domainSummary([d], { ...data, scores: sc })]) : []), [data, sc]);   // eslint-disable-line react-hooks/exhaustive-deps
  const tot = useMemo(() => (data ? domainSummary(doms, { ...data, scores: sc }) : null), [data, sc]);   // eslint-disable-line react-hooks/exhaustive-deps

  const reportsBar = (me.coord || self?.domains.length > 0) && (
    <div className="flex flex-wrap gap-2">
      {me.coord && <button className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white" onClick={() => go("dash", { report: "all" })}>التقرير العام للجنة</button>}
      {(me.coord ? [1, 2, 3, 4] : self.domains).map((d) => <button key={d} className="rounded-pill border bg-white px-3 py-1.5 text-xs font-semibold" style={{ borderColor: `${DOMAIN_COLOR[d]}55`, color: DOMAIN_COLOR[d] }} onClick={() => go("dash", { report: String(d) })}>تقرير مجال {DOMAINS[d]}</button>)}
    </div>
  );

  if (!base) return (
    <div className="space-y-4">{reportsBar}
      <div className="card space-y-2 p-5 text-sm">
        <p className="font-semibold text-ink">ابدأ من تقرير التقويم الذاتي</p>
        <p className="text-muted">ارفع تقرير الأداء المدرسي وأدخل نسب مؤشراته، أو استورد بيانات 1448هـ من ملف خطة المدرسة، فتظهر هنا النتائج والخطة.</p>
        {me.coord && <div className="flex flex-wrap gap-2"><button className="btn-primary px-4 py-1.5 text-xs" onClick={() => go("plan")}>استيراد خطة 1448هـ</button>
          <button className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted" onClick={() => go("self")}>رفع تقرير التقويم الذاتي</button></div>}
      </div>
    </div>
  );
  if (!data) return <Loader />;

  const lv = levelOf(a.overall);
  const plan = data.plan;
  const progBy = Object.fromEntries(data.progs.map((p) => [p.code, p]));
  const evBy = {}; data.ev.forEach((e) => { (evBy[e.code] ??= []).push(e); });
  const reqDone = (c) => { const p = progBy[c]; const req = p?.kind === "plan" ? p.evidence ?? [] : [];
    return [req.filter((t) => (evBy[c] ?? []).some((e) => e.title.trim() === t.trim())).length, req.length]; };
  const visible = CODES.filter((c) => doms.includes(domainOf(c)));
  const low = visible.filter((c) => sc[c] != null && sc[c] < PLAN_BELOW).sort((x, y) => sc[x] - sc[y]);
  const fresh = visible.filter((c) => sc[c] == null);
  const high = visible.filter((c) => sc[c] != null).sort((x, y) => sc[y] - sc[x]).slice(0, 4);
  const next = (plan?.milestones ?? []).find((m) => !m.done_at);
  const evPct = tot.gaps.required ? Math.round(((tot.gaps.required - tot.gaps.missing.filter((g) => g.title).length) / tot.gaps.required) * 100) : 0;
  const th = "px-3 py-2.5 text-start text-[11.5px] font-semibold text-muted";

  return (
    <div className="space-y-4">
      {reportsBar}

      {/* الأداء العام على سلّم المستويات */}
      <section className="card grid gap-5 p-5 md:grid-cols-[220px_1fr]">
        <div className="text-center md:border-e md:border-line md:pe-5">
          <p className="text-xs font-semibold text-muted">الأداء العام للمدرسة</p>
          <p className="num mt-1 text-5xl font-bold" style={{ color: lv?.c }}>{fmtPct(a.overall)}</p>
          <span className="mt-2 inline-block rounded-pill px-4 py-1 text-sm font-bold text-white" style={{ background: lv?.c }}>{lv?.t}</span>
          <p className="mt-2 text-[11px] text-faint">{base.title}{base.report_date && ` · ${fmtDate(base.report_date)}`}</p>
        </div>
        <div className="space-y-4">
          <div>
            <div className="relative flex h-9 overflow-hidden rounded-sm2 text-[11px] font-bold text-white">
              {[...LEVELS].reverse().map((l, i, arr) => { const to = i < arr.length - 1 ? arr[i + 1].min : 100;
                return <span key={l.t} className="grid place-items-center" style={{ width: `${to - l.min}%`, background: l.c, opacity: lv === l ? 1 : 0.35 }}>{l.t}</span>; })}
              <span className="absolute inset-y-0 w-1 rounded-pill bg-ink" style={{ insetInlineStart: `calc(${Math.min(a.overall ?? 0, 100)}% - 2px)` }} />
            </div>
            <div className="relative mt-1 h-4 text-[10.5px] text-faint">{[0, 50, 75, 90, 100].map((t) => (
              <span key={t} className="num absolute translate-x-1/2" style={{ right: `${t}%` }}>{t}</span>))}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat v={`${a.measured}/47`} t="مؤشرًا مقاسًا" s={fresh.length ? `${fresh.length} مستحدث بلا قياس` : null} />
            <Stat v={low.length} t="دون مستوى التقدم" c="rgb(var(--c-absent))" s="مرشحة لخطة التحسين" />
            <Stat v={`${tot.done}%`} t="إنجاز برامج الخطة" c={pctColor(tot.done)} s={`${tot.inPlan.length} برنامجًا · تحقق ${tot.met}%`} />
            <Stat v={`${evPct}%`} t="الشواهد المطلوبة" c={pctColor(evPct)} s={`بقي ${tot.gaps.missing.filter((g) => g.title).length} من ${tot.gaps.required}`} />
          </div>
          {next && <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs text-mint-deep">المحطة القادمة في الخطة: <b>{next.title}</b> — {next.due} · {next.owner}</p>}
        </div>
      </section>

      {/* جدول المجالات */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-ink">أداء المجالات</h2>
          <span className="text-[11px] text-faint">الخطان على الشريط: حد التقدم 75% وحد التميز 90%</span>
        </div>
        <div className="divide-y divide-line/70 md:hidden">{rows.map(([d, x]) => {
          const below = x.codes.filter((c) => sc[c] != null && sc[c] < PLAN_BELOW).length;
          const left = x.gaps.missing.filter((g) => g.title).length;
          return (
            <button key={d} className="block w-full space-y-2 px-4 py-3 text-start" style={{ borderInlineStart: `5px solid ${DOMAIN_COLOR[d]}` }} onClick={() => go("dash", { report: String(d) })}>
              <div className="flex items-center gap-2"><b className="flex-1" style={{ color: DOMAIN_COLOR[d] }}>{DOMAINS[d]}</b>{lvChip(x.perf)}
                <b className="num text-lg" style={{ color: levelOf(x.perf)?.c }}>{fmtPct(x.perf)}</b></div>
              <Meter v={x.perf} color={levelOf(x.perf)?.c} />
              <div className="grid grid-cols-4 gap-1 text-center">
                <Mini v={x.codes.length} t="مؤشرات" />
                <Mini v={below} t="دون 75%" c={below ? "rgb(var(--c-absent))" : "rgb(var(--c-present))"} />
                <Mini v={`${x.done}%`} t={`إنجاز ${x.inPlan.length} برامج`} c={pctColor(x.done)} />
                <Mini v={x.gaps.required ? `${x.gaps.required - left}/${x.gaps.required}` : "—"} t={left ? `شواهد · بقي ${left}` : "شواهد"} c={x.gaps.required ? pctColor(((x.gaps.required - left) / x.gaps.required) * 100) : undefined} />
              </div>
            </button>
          );
        })}</div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-canvas"><tr>
              <th className={th}>المجال</th><th className={`${th} w-56`}>الأداء</th><th className={th}>المستوى</th>
              <th className={`${th} text-center`}>المؤشرات</th><th className={`${th} text-center`}>دون 75%</th>
              <th className={`${th} text-center`}>برامج الخطة</th><th className={`${th} text-center`}>إنجاز البرامج</th>
              <th className={`${th} text-center`}>الشواهد المطلوبة</th><th className={th} />
            </tr></thead>
            <tbody className="divide-y divide-line/70">{rows.map(([d, x]) => {
              const below = x.codes.filter((c) => sc[c] != null && sc[c] < PLAN_BELOW).length;
              const left = x.gaps.missing.filter((g) => g.title).length;
              const ep = x.gaps.required ? Math.round(((x.gaps.required - left) / x.gaps.required) * 100) : null;
              return (
                <tr key={d} className="align-middle">
                  <td className="px-3 py-3"><span className="flex items-center gap-2 font-bold" style={{ color: DOMAIN_COLOR[d] }}>
                    <span className="h-8 w-1.5 rounded-pill" style={{ background: DOMAIN_COLOR[d] }} />{DOMAINS[d]}</span></td>
                  <td className="px-3 py-3"><div className="flex items-center gap-2">
                    <b className="num w-16 text-base" style={{ color: levelOf(x.perf)?.c }}>{fmtPct(x.perf)}</b><Meter v={x.perf} color={levelOf(x.perf)?.c} /></div></td>
                  <td className="px-3 py-3">{lvChip(x.perf)}</td>
                  <td className="num px-3 py-3 text-center font-semibold text-ink">{x.codes.length}</td>
                  <td className="num px-3 py-3 text-center"><b style={{ color: below ? "rgb(var(--c-absent))" : "rgb(var(--c-present))" }}>{below}</b></td>
                  <td className="num px-3 py-3 text-center text-ink">{x.inPlan.length}<span className="block text-[10.5px] text-faint">استدامة {x.sustain.length}</span></td>
                  <td className="px-3 py-3 text-center"><b className="num" style={{ color: pctColor(x.done) }}>{x.done}%</b>
                    <span className="block text-[10.5px] text-faint">تحقق الأهداف {x.met}%</span></td>
                  <td className="px-3 py-3 text-center">{ep == null ? <span className="text-xs text-faint">—</span> : <>
                    <b className="num" style={{ color: pctColor(ep) }}>{x.gaps.required - left}/{x.gaps.required}</b>
                    <span className="block text-[10.5px]" style={{ color: left ? "rgb(var(--c-late))" : "rgb(var(--c-present))" }}>{left ? `بقي ${left}` : "مكتملة"}</span></>}</td>
                  <td className="px-3 py-3 text-end"><button className="whitespace-nowrap text-xs font-semibold" style={{ color: DOMAIN_COLOR[d] }} onClick={() => go("dash", { report: String(d) })}>التقرير ←</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>

      {/* جدول أولويات التحسين */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-bold text-ink">أولويات التحسين <span className="num font-normal text-muted">— {low.length} مؤشرًا دون {PLAN_BELOW}%، من الأدنى</span></h2>
          {low.length > 8 && <button className="text-xs font-semibold text-mint-deep" onClick={() => setAllLow(!allLow)}>{allLow ? "أهم 8 فقط" : `عرض الكل (${low.length})`}</button>}
        </div>
        {low.length === 0 ? <p className="px-4 py-6 text-center text-sm text-present">لا مؤشرات دون مستوى التقدم.</p> : (
          <>
          <div className="divide-y divide-line/70 md:hidden">{(allLow ? low : low.slice(0, 8)).map((c, i) => {
            const p = progBy[c]; const pr = p?.kind === "plan" ? progOf(p) : null; const [dn, rq] = reqDone(c); const col = DOMAIN_COLOR[domainOf(c)];
            return (
              <button key={c} className="block w-full space-y-1.5 px-4 py-3 text-start" onClick={() => go("ind", { code: c })}>
                <div className="flex items-center gap-2"><span className="num text-xs text-faint">{i + 1}</span>
                  <span className="num rounded-sm2 px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: col }}>{c}</span>
                  <span className="flex-1" />{lvChip(sc[c])}<b className="num text-base" style={{ color: levelOf(sc[c])?.c }}>{sc[c]}%</b></div>
                <p className="text-[13px] leading-snug text-ink">{INDICATORS[c]}</p>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <Mini v={Math.round((PLAN_BELOW - sc[c]) * 100) / 100} t="الفجوة إلى 75%" c="rgb(var(--c-absent))" />
                  <Mini v={pr ? `${pr.done}%` : "—"} t={pr ? "إنجاز البرنامج" : "لا برنامج"} c={pr ? pctColor(pr.done) : "rgb(var(--c-absent))"} />
                  <Mini v={rq ? `${dn}/${rq}` : evBy[c]?.length ?? 0} t="الشواهد" c={rq ? pctColor((dn / rq) * 100) : undefined} />
                </div>
              </button>
            );
          })}</div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-canvas"><tr>
                <th className={`${th} w-8`}>#</th><th className={th}>المؤشر</th><th className={`${th} text-center`}>النسبة</th><th className={th}>المستوى</th>
                <th className={`${th} text-center`}>الفجوة إلى 75%</th><th className={th}>برنامج الخطة</th><th className={`${th} text-center`}>الإنجاز</th>
                <th className={`${th} text-center`}>الشواهد</th><th className={th} />
              </tr></thead>
              <tbody className="divide-y divide-line/70">{(allLow ? low : low.slice(0, 8)).map((c, i) => {
                const p = progBy[c]; const pr = p?.kind === "plan" ? progOf(p) : null; const [dn, rq] = reqDone(c); const col = DOMAIN_COLOR[domainOf(c)];
                return (
                  <tr key={c}>
                    <td className="num px-3 py-3 text-xs text-faint">{i + 1}</td>
                    <td className="px-3 py-3"><span className="num me-2 inline-block rounded-sm2 px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: col }}>{c}</span>
                      <span className="text-[13px] leading-snug text-ink">{INDICATORS[c]}</span></td>
                    <td className="num px-3 py-3 text-center text-base font-bold" style={{ color: levelOf(sc[c])?.c }}>{sc[c]}%</td>
                    <td className="px-3 py-3">{lvChip(sc[c])}</td>
                    <td className="num px-3 py-3 text-center font-bold text-absent">{Math.round((PLAN_BELOW - sc[c]) * 100) / 100}</td>
                    <td className="px-3 py-3 text-[12.5px]">{pr ? <span className="text-ink">{p.initiative}</span> : <span className="font-semibold text-absent">لا برنامج له في الخطة</span>}</td>
                    <td className="px-3 py-3 text-center">{pr ? <b className="num" style={{ color: pctColor(pr.done) }}>{pr.done}%</b> : <span className="text-faint">—</span>}</td>
                    <td className="num px-3 py-3 text-center">{rq ? <b style={{ color: pctColor((dn / rq) * 100) }}>{dn}/{rq}</b> : <span className="text-faint">{evBy[c]?.length ?? 0}</span>}</td>
                    <td className="px-3 py-3 text-end"><button className="whitespace-nowrap text-xs font-semibold" style={{ color: col }} onClick={() => go("ind", { code: c })}>الشواهد ←</button></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          </>
        )}
      </section>

      {/* الاختبارات الوطنية */}
      {doms.includes(3) && data.nat.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">الاختبارات الوطنية <span className="font-normal text-muted">— بطاقات هيئة تقويم التعليم والتدريب</span></h2>
            <button className="text-xs font-semibold text-mint-deep" onClick={() => go("nat")}>التفاصيل ←</button>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">{Object.keys(NAT_TESTS).map((k) => <NatCard key={k} test={k} series={natSeries(data.nat, k)} me={me} compact />)}</div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* جوانب القوة */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-ink">جوانب القوة <span className="font-normal text-muted">— الأعلى</span></h2>
          <div className="divide-y divide-line/70">{high.map((c) => (
            <div key={c} className="flex items-center gap-3 px-4 py-2.5">
              <span className="num rounded-sm2 px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: DOMAIN_COLOR[domainOf(c)] }}>{c}</span>
              <span className="min-w-0 flex-1 text-[13px] text-ink">{INDICATORS[c]}</span>
              <b className="num text-present">{sc[c]}%</b>
            </div>))}</div>
        </section>
        {/* المستحدثة بلا قياس */}
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-ink">مؤشرات مستحدثة بلا قياس سابق <span className="font-normal text-muted">— تحتاج خط أساس وشواهد</span></h2>
          {fresh.length ? <div className="divide-y divide-line/70">{fresh.map((c) => { const [dn, rq] = reqDone(c);
            const tk = Object.keys(NAT_TESTS).find((k) => NAT_TESTS[k].growth === c); const g = tk && natGrowth(data.nat, tk); return (
            <div key={c} className="flex items-center gap-3 px-4 py-2.5">
              <span className="num rounded-sm2 px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: DOMAIN_COLOR[domainOf(c)] }}>{c}</span>
              <span className="min-w-0 flex-1 text-[13px] text-ink">{INDICATORS[c]}
                {g && <span className="block text-[11px] text-muted">{g.only ? <>خط الأساس {g.base.academic_year}هـ: المتوسط <b className="num text-ink">{g.base.avg}</b></>
                  : <>المتوسط {g.last.academic_year}هـ <b className="num text-ink">{g.last.avg}</b> · عن خط الأساس <b className="num" style={{ color: g.delta > 0 ? "rgb(var(--c-present))" : "rgb(var(--c-absent))" }}>{signed(g.delta)}</b></>}</span>}</span>
              {rq > 0 && <b className="num text-xs" style={{ color: pctColor((dn / rq) * 100) }}>شواهد {dn}/{rq}</b>}
            </div>); })}</div> : <p className="px-4 py-6 text-center text-sm text-muted">لا مؤشرات مستحدثة في مجالاتك.</p>}
        </section>
      </div>
    </div>
  );
}

function Stat({ v, t, s, c }) {
  return (
    <div className="rounded-sm2 border border-line bg-white px-3 py-2.5">
      <p className="num text-2xl font-bold leading-tight" style={{ color: c ?? "rgb(var(--c-ink))" }}>{v}</p>
      <p className="text-[12px] font-semibold text-ink">{t}</p>
      {s && <p className="text-[10.5px] text-faint">{s}</p>}
    </div>
  );
}

function Mini({ v, t, c }) {
  return (
    <div className="rounded-sm2 bg-canvas px-1 py-1.5">
      <p className="num text-sm font-bold" style={{ color: c ?? "rgb(var(--c-ink))" }}>{v}</p>
      <p className="text-[10px] leading-tight text-muted">{t}</p>
    </div>
  );
}
