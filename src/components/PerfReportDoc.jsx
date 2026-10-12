// src/components/PerfReportDoc.jsx
import { GRADE_NAMES } from "../lib/schoolTime";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import { ITEM_HINT, elementColor, itemStatus } from "../lib/performance";
import {
  S, n, pct, countAr, paginate, Ring, Donut, DonutLegend, Kpis, Highlights, Box, Signs, Page, Cover,
} from "./report/ReportKit.jsx";

/* =====================================================================
   تقرير شواهد الأداء الوظيفي للمعلم بطقم التقارير (components/report):
   الغلاف ← ملخص الإنجاز (العناصر ومصادر الشواهد) ← تفاصيل البنود بشواهدها
   ← البنود الناقصة وكيف تُستكمل ← التنبيه والتوقيعات.
   عنصر «أداء الواجبات الوظيفية» للمقيِّم فلا يدخل في النسب.
   ===================================================================== */

const CAP = 800;   // ارتفاع محتوى الصفحة الداخلية تقريبًا (px)
const NOTE = "تخضع الشواهد لتقييم مدير المدرسة وتدقيقه، واكتمالها لا يعني الحصول على الدرجة الكاملة، وإنما هو خطوة متقدمة نحو تقدير عالٍ. وللمقيِّم أن يطلب مشاهدة أكثر من الشاهد المرفوع.";

// مصادر الشواهد في أربع فئات ثابتة الألوان
const SRC = [
  { k: "upload", t: "مرفوع من المعلم", c: S[0], of: ["upload"] },
  { k: "forms", t: "من نماذج البوابة", c: S[1], of: ["form", "pd"] },
  { k: "visits", t: "زيارات ومجتمعات تعلم", c: S[2], of: ["visit", "plc", "xvisit"] },
  { k: "auto", t: "يصل تلقائيًا من البوابة", c: S[3] },
];

const evText = (r) => {
  if (!r.st.ok) return "—";
  if (!r.st.list.length) return "شاهد آلي من عمل المعلم في البوابة";
  if (r.it.is_record) return r.st.list.map((e) => e.title).slice(0, 2).join("، ") + (r.st.list.length > 2 ? ` و${r.st.list.length - 2} أخرى` : "");
  return r.st.list[0].title;
};
const countText = (r) => (!r.st.ok ? "" : !r.st.list.length ? `العدد ${r.st.auto.cnt}` : r.it.is_record ? `المشاركات ${r.st.count}` : `العداد ${r.st.count}`);
// ارتفاع سطر البند تقديريًا: العنوان الطويل يلتف على سطرين
const rowH = (r) => Math.max(r.it.title.length > 50 ? 2 : 1, (evText(r).length > 34 ? 2 : 1) + (r.st.ok ? 1 : 0)) * 18 + 12;

export function perfModel(elements, evidence, auto) {
  const els = elements.filter((e) => !e.evaluator_only).map((el) => {
    const rows = el.items.map((it) => ({ el, it, st: itemStatus(it, evidence, auto) }));
    const ok = rows.filter((r) => r.st.ok).length;
    return { el, rows, ok, total: rows.length, p: pct(ok, rows.length) ?? 0, color: elementColor(el.key) };
  });
  const rows = els.flatMap((e) => e.rows);
  const ok = rows.filter((r) => r.st.ok).length;
  const src = Object.fromEntries(SRC.map((s) => [s.k, s.of ? evidence.filter((e) => s.of.includes(e.source)).length : 0]));
  src.auto = rows.filter((r) => r.st.auto && !r.st.list.length).length;
  return {
    els, rows, ok, total: rows.length, missing: rows.length - ok, p: pct(ok, rows.length) ?? 0, src,
    hours: evidence.reduce((a, e) => a + (Number(e.hours) || 0), 0),
  };
}

function highlights(m, visits) {
  const out = [];
  const sorted = [...m.els].sort((a, b) => b.p - a.p);
  out.push(`نسبة الإنجاز الكلية ${m.p}%: ${countAr(m.ok, "item")} متوفر من ${m.total}.`);
  if (sorted[0]) out.push(`أعلى العناصر اكتمالًا: «${sorted[0].el.title}» بنسبة ${sorted[0].p}%.`);
  const low = sorted.filter((e) => e.p < 100).slice(-1)[0];
  if (low) out.push(`أكثرها حاجة للاستكمال: «${low.el.title}» (${low.ok} من ${low.total}).`);
  if (m.src.auto) out.push(`${countAr(m.src.auto, "item")} تصل شواهدها تلقائيًا من عمل المعلم في البوابة.`);
  if (m.hours) out.push(`ساعات التطوير المهني المسجلة: ${n(m.hours)} ساعة.`);
  if (visits.length) out.push(`زيارات الدعم الواردة من الإدارة: ${n(visits.length)}.`);
  return out.slice(0, 6);
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function perfReportPages({ elements, evidence, auto, visits = [], info, name, year, theme = "light", sigs = {} }) {
  const m = perfModel(elements, evidence, auto);
  const teacher = info?.full_name ?? name ?? "";
  const doc = { title: "شواهد الأداء الوظيفي", meta: [teacher, `${year}هـ`], foot: "الأداء الوظيفي" };
  const subjects = info?.subjects?.length ? info.subjects.join("، ") : info?.specialization ?? "—";
  const grades = [...new Set((info?.classes ?? []).map((c) => c.grade))].map((g) => GRADE_NAMES[g]).filter(Boolean).join("، ");

  // تفاصيل البنود: سطر عنوان لكل عنصر ثم بنوده
  const lines = m.els.flatMap((e) => [{ e, head: true }, ...e.rows.map((r) => ({ e, r }))]);
  const detailPages = paginate(lines, (x) => (x.head ? 80 : rowH(x.r)), CAP, CAP, (x) => x.head);
  // الناقص: البنود غير المتوفرة تحت عنصرها، ولكل بند تلميح استكماله
  const missEls = m.els.filter((e) => e.rows.some((r) => !r.st.ok));
  const miss = missEls.flatMap((e) => [{ e, head: true }, ...e.rows.filter((r) => !r.st.ok).map((r) => ({ e, r }))]);
  const missH = (x) => (x.head ? 42 : 30 + Math.ceil((ITEM_HINT[x.r.it.key]?.length ?? 0) / 120) * 15);
  const missPages = miss.length ? paginate(miss, missH, CAP, CAP, (x) => x.head) : [[]];
  // التنبيه والتوقيعات في آخر صفحة إن اتسعت، وإلا في صفحة خاصة
  const missLast = missPages[missPages.length - 1].reduce((a, x) => a + missH(x), 0);
  if (miss.length && missLast + 220 > CAP) missPages.push([]);

  const total = 2 + detailPages.length + missPages.length;
  let pg = 2;
  const common = { theme, doc, total };

  return [
    <Cover key="cover" theme={theme} c={{
      year: `${year}هـ`, tag: ["award", "ملف الأداء الوظيفي للمعلم"], title: "شواهد الأداء الوظيفي", sub: teacher,
      titleSize: 72, subSize: teacher.length > 28 ? 30 : 36,
      badge: { main: `${m.p}%`, sub: "نسبة الإنجاز" }, side: { main: `${m.ok} من ${m.total} بندًا`, sub: "بنود شواهدها متوفرة" },
      rows: [["user", "المعلم", teacher || "—"], ["book", "المادة", subjects],
             ["cap", "الصفوف والفصول", `${grades || "—"}${info?.classes?.length ? ` · ${countAr(info.classes.length, "cls")}` : ""}`],
             ["calendar", "العام الدراسي", `${year}هـ`]],
      note: ["check", "الشواهد كما في ملف المعلم بالبوابة: المرفوعة، والواردة من النماذج والزيارات، والآلية من عمله."],
      strip: [[m.ok, "بندًا متوفرًا"], [m.missing, "بندًا غير متوفر"], [evidence.length, "شاهدًا في الملف"], [m.src.auto, "بندًا يصل تلقائيًا"]],
      foot: "الأداء الوظيفي",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "ملخص الإنجاز", sub: "اكتمال شواهد عناصر نموذج تقييم الأداء" }}>
      <Kpis items={[
        { ic: "check", t: "بنود متوفرة", v: m.ok, s: `من ${m.total} بندًا`, c: S[0] },
        { ic: "alert", t: "بنود غير متوفرة", v: m.missing, s: "تُستكمل قبل التقييم", c: S[3] },
        { ic: "doc", t: "شواهد في الملف", v: evidence.length, s: `مرفوع ${m.src.upload} · نماذج ${m.src.forms}`, c: S[1] },
        { ic: "clock", t: "ساعات التطوير", v: m.hours, s: `زيارات الدعم ${visits.length}`, c: S[2] },
      ]} />
      <Box icon="chart" title="اكتمال العناصر" aside="الوزن · البنود المتوفرة">
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Ring value={m.p} label="الإنجاز الكلي" sub={`${m.ok} من ${m.total}`} color="var(--mr-deep)" size={118} />
          <div className="mr-bars" style={{ flex: 1, minWidth: 0 }}>
            {m.els.map((e) => (
              <div key={e.el.key} className="mr-bar" style={{ gridTemplateColumns: "210px 1fr 74px" }}>
                <span className="t"><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: e.color, marginLeft: 6 }} />{e.el.title}</span>
                <span className="tr"><i style={{ width: `${e.p}%`, "--c": e.color, opacity: e.ok ? 1 : 0 }} /></span>
                <span className="n num" style={{ fontSize: 11 }}>{e.el.weight}% · {e.ok}/{e.total}</span>
              </div>
            ))}
          </div>
        </div>
      </Box>
      <Box icon="folder" title="مصادر الشواهد">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Donut parts={SRC.map((s) => ({ t: s.t, v: m.src[s.k], c: s.c }))} label="شاهد وبند" size={130} />
          <DonutLegend parts={SRC.map((s) => ({ t: s.t, v: m.src[s.k], c: s.c }))} />
        </div>
      </Box>
      <Highlights title="خلاصة الملف" items={highlights(m, visits)} />
    </Page>,

    ...detailPages.map((list, i) => {
      const blocks = [];
      list.forEach((x) => {
        if (x.head || !blocks.length || blocks[blocks.length - 1].e !== x.e) blocks.push({ e: x.e, head: !!x.head, rows: [] });
        if (x.r) blocks[blocks.length - 1].rows.push(x.r);
      });
      return (
        <Page key={`det${i}`} {...common} page={++pg} sec={i ? null : { no: 2, title: "تفاصيل البنود", sub: "كل بند بحالته وشاهده" }}>
          {blocks.map((b) => (
            <div key={b.e.el.key + b.head}>
              <div className="mr-who" style={{ color: b.e.color }}>
                <span className="av" style={{ background: b.e.color, color: "#fff" }}>{b.e.el.sort_order}</span>{b.e.el.title}{!b.head && " (تتمة)"}
                <span className="aside num">الوزن {b.e.el.weight}% · متوفر {b.e.ok} من {b.e.total}</span>
              </div>
              {b.rows.length > 0 && (
                <table className="mr-table">
                  <thead><tr><th className="c" style={{ width: 30, background: b.e.color }}>م</th><th style={{ background: b.e.color }}>البند</th>
                    <th style={{ width: 210, background: b.e.color }}>الشاهد</th><th className="c" style={{ width: 82, background: b.e.color }}>الحالة</th></tr></thead>
                  <tbody>{b.rows.map((r) => (
                    <tr key={r.it.key}>
                      <td className="c num">{r.it.sort_order}</td><td>{r.it.title}</td>
                      <td style={{ color: "var(--mr-ink2)", fontSize: 10.5 }}>{evText(r)}{countText(r) && <span className="num" style={{ display: "block", color: "var(--mr-ink)", fontWeight: 600 }}>{countText(r)}</span>}</td>
                      <td className="c"><span className={`mr-chip ${r.st.ok ? (r.st.list.length ? "ok" : "auto") : "no"}`}>{r.st.ok ? (r.st.list.length ? "متوفر" : "آلي") : "غير متوفر"}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          ))}
        </Page>
      );
    }),

    ...missPages.map((list, i) => {
      const last = i === missPages.length - 1;
      return (
        <Page key={`miss${i}`} {...common} page={++pg} sec={i ? null : { no: 3, title: "البنود الناقصة", sub: "ما يحتاج شاهدًا، ومن أين يُجمع في البوابة" }}>
          {miss.length === 0 ? (
            <Box icon="trophy" title="اكتمل الملف"><p className="mr-notes">كل بنود العناصر لها شواهد متوفرة. أحسنت!</p></Box>
          ) : list.length > 0 && (
            <div>
              {list.map((x) => x.head ? (
                <div key={x.e.el.key} className="mr-who" style={{ color: x.e.color, marginTop: 8 }}>
                  <span className="av" style={{ background: x.e.color, color: "#fff" }}>{x.e.el.sort_order}</span>{x.e.el.title}
                  <span className="aside num">ينقصه {x.e.total - x.e.ok} من {x.e.total}</span>
                </div>
              ) : (
                <div key={x.r.it.key} className="mr-miss" style={{ "--c": x.e.color }}>
                  <b>{x.r.it.title}</b>
                  {ITEM_HINT[x.r.it.key] && <span>{ITEM_HINT[x.r.it.key]}</span>}
                </div>
              ))}
            </div>
          )}
          {last && (
            <>
              <Box icon="alert" title="تنبيه" tint style={{ marginTop: 4 }}><p className="mr-note" style={{ fontSize: 12 }}>{NOTE}</p></Box>
              <Signs showStamp={false} people={[{ title: "المعلم", name: teacher, sig: sigs.teacher }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
            </>
          )}
        </Page>
      );
    }),
  ];
}
