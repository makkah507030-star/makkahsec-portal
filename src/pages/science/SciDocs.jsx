// src/pages/science/SciDocs.jsx
// مستندات مختبرات العلوم بطقم التقارير (هوية البوابة، والرسمية بترويسة الوزارة):
// • planPages: الخطة الفصلية للتجارب العملية (و.م.ع.ن-08-03)
// • logPages: سجل تنفيذ التجارب العملية (و.م.ع.ن-08-04)
// • inventoryPages: كشف عهدة المختبر
// • summaryPages: تقرير تشغيل المختبر (التنفيذ والحجز والعهدة)
import { n, pct, dmy, paginate, Box, Signs, Page, Kpis, Bars } from "../../components/report/ReportKit.jsx";
import { KIND, REASON, INV_KIND, INV_STATUS, PREP } from "../../lib/sciLab.js";

const SCHOOL_DEPUTY = "وكيل الشؤون المدرسية";
const signs = (s) => <Signs stamp={s.stamp} people={[{ title: "محضر المختبر", name: s.prep, sig: s.prepSig }, { title: SCHOOL_DEPUTY, name: s.deputy, sig: s.deputySig }]} />;
const lines = (t) => Math.max(1, Math.ceil(String(t ?? "").length / 70));
const cls = (c) => (c ? `${c.class_no}` : "");

/* الخطة الفصلية: كل تجربة بفصلها وصفحتها وأسبوعها وأدواتها ومعلمها */
export function planPages({ lab, course, exps, teachers, theme, year, s }) {
  const doc = { title: `الخطة الفصلية للتجارب العملية لمادة ${course}`, meta: [lab.name, `${year}هـ · (و.م.ع.ن-08-03)`], foot: lab.name };
  // ارتفاع الصف بأطول خلاياه: الأدوات (نحو 48 حرفًا في السطر)، والاسم والفصل في عمودين ضيقين
  const h = (e) => 14 + 13 * Math.max(Math.ceil(String(e.tools ?? "").length / 48), Math.ceil(e.title.length / 16) + 1,
    (e.chapter_title ? Math.ceil(e.chapter_title.length / 9) : 0) + 1);
  const pages = paginate(exps, h, 780, 780);
  // الصفحة الأخيرة تحتاج مكان التوقيعات
  if (pages.length && pages.at(-1).reduce((a, e) => a + h(e), 0) > 660) pages.push([]);
  return pages.map((rows, p) => (
    <Page key={p} theme={theme} doc={doc} page={p + 1} total={pages.length}>
      <table className="mr-table">
        <thead><tr><th className="c">م</th><th>الفصل</th><th>اسم التجربة</th><th className="c">الصفحة</th><th className="c">الأسبوع</th><th>أدوات التجربة</th><th>معلم المادة</th></tr></thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className="c num">{e.no}</td>
              <td>{e.chapter}{e.chapter_title && <div style={{ fontSize: 10, color: "#5E7268" }}>{e.chapter_title}</div>}</td>
              <td><b>{e.title}</b><div style={{ fontSize: 10, color: "#5E7268" }}>{KIND[e.kind]}{e.guide ? " · دليل التجارب" : ""}</div></td>
              <td className="c num">{e.page ?? "—"}{e.guide_page && <div style={{ fontSize: 10 }}>دليل ص {e.guide_page}</div>}</td>
              <td className="c num">{e.week ?? ""}</td>
              <td style={{ fontSize: 10.5 }}>{e.tools}</td>
              <td style={{ fontSize: 10.5 }}>{teachers}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p === pages.length - 1 && signs(s)}
    </Page>
  ));
}

/* سجل التنفيذ: لكل تجربة فصلها وتاريخها ومعلمها ومكانها أو سبب عدم تنفيذها */
export function logPages({ lab, course, klass, exps, runs, theme, year, s }) {
  const doc = { title: `سجل تنفيذ التجارب العملية لمادة ${course}`, meta: [`${lab.name}${klass ? ` · فصل ${cls(klass)}` : ""}`, `${year}هـ · (و.م.ع.ن-08-04)`], foot: lab.name };
  const rows = exps.flatMap((e) => {
    const rs = runs.filter((r) => r.experiment_id === e.id);
    return rs.length ? rs.map((r) => ({ e, r })) : [{ e, r: null }];
  });
  const pages = paginate(rows, () => 26, 600, 680);
  const mark = (on) => (on ? "✓" : "");
  return pages.map((list, p) => (
    <Page key={p} theme={theme} doc={doc} page={p + 1} total={pages.length}>
      <table className="mr-table" style={{ fontSize: 10.5 }}>
        <thead>
          <tr><th className="c">م</th><th>اسم التجربة</th><th className="c">الفصل</th><th className="c">تاريخ الإجراء</th><th>المعلم</th>
            <th className="c">المختبر</th><th className="c">افتراضية</th><th>لم تُنفّذ (السبب)</th><th className="c">اعتماد المحضر</th></tr>
        </thead>
        <tbody>
          {list.map(({ e, r }, i) => (
            <tr key={`${e.id}-${r?.id ?? i}`}>
              <td className="c num">{e.no}</td><td>{e.title}</td>
              <td className="c num">{r?.classes ? cls(r.classes) : ""}</td>
              <td className="c num">{r ? dmy(r.run_date) : ""}</td>
              <td>{r?.teachers?.full_name ?? ""}</td>
              <td className="c">{mark(r?.outcome === "lab")}</td><td className="c">{mark(r?.outcome === "virtual")}</td>
              <td style={{ fontSize: 10 }}>{r?.outcome === "not_done" ? `${REASON[r.reason] ?? ""}${r.reason_note ? ` — ${r.reason_note}` : ""}` : ""}</td>
              <td className="c" style={{ fontSize: 10 }}>{r?.confirmed_at ? "✓" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p === pages.length - 1 && signs(s)}
    </Page>
  ));
}

/* كشف العهدة بأنواعها */
export function inventoryPages({ lab, items, theme, year, s }) {
  const doc = { title: `كشف عهدة ${lab.name}`, meta: [lab.name, `${year}هـ`], foot: lab.name };
  const pages = paginate(items, (x) => 24 + lines(x.note) * 8, 600, 680);
  return pages.map((list, p) => (
    <Page key={p} theme={theme} doc={doc} page={p + 1} total={pages.length}>
      <table className="mr-table">
        <thead><tr><th className="c">م</th><th>الصنف</th><th>النوع</th><th className="c">الكمية</th><th className="c">الحالة</th><th className="c">الصلاحية</th><th>الموقع</th><th>ملاحظات</th></tr></thead>
        <tbody>
          {list.map((x, i) => (
            <tr key={x.id}>
              <td className="c num">{pages.slice(0, p).reduce((a, y) => a + y.length, 0) + i + 1}</td>
              <td><b>{x.name}</b></td><td>{INV_KIND[x.kind]}</td>
              <td className="c num">{n(x.qty)} {x.unit ?? ""}</td>
              <td className="c" style={{ color: x.status === "ok" ? undefined : "#A33A3A" }}>{INV_STATUS[x.status]}</td>
              <td className="c num">{x.expiry ? dmy(x.expiry) : ""}</td>
              <td>{x.location ?? ""}</td><td style={{ fontSize: 10 }}>{x.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {p === pages.length - 1 && signs(s)}
    </Page>
  ));
}

/* تقرير تشغيل المختبر: التنفيذ لكل مقرر، وأسباب عدم التنفيذ، والحجز والتجهيز، وحالة العهدة */
export function summaryPages({ lab, st, theme, year, s }) {
  const doc = { title: `تقرير تشغيل ${lab.name}`, meta: [lab.name, `${year}هـ`], foot: lab.name };
  return [
    <Page key="s" theme={theme} doc={doc} page={1} total={1} sec={{ no: 1, title: "تنفيذ التجارب العملية", sub: "من سجل التنفيذ في البوابة" }}>
      <Kpis items={[
        { ic: "check", v: st.done, t: "تجربة نُفّذت", s: `من ${n(st.planned)} مخططة لفصول المادة` },
        { ic: "chart", v: `${pct(st.done, st.planned) ?? 0}%`, t: "نسبة التنفيذ" },
        { ic: "spark", v: st.virtual, t: "منها افتراضية" },
        { ic: "grid", v: st.bookings, t: "حصة محجوزة", s: `جُهّز منها ${n(st.ready)}` },
      ]} />
      <Box icon="list" title="التنفيذ لكل مقرر">
        <table className="mr-table">
          <thead><tr><th>المقرر</th><th className="c">التجارب</th><th className="c">الفصول</th><th className="c">في المختبر</th><th className="c">افتراضية</th><th className="c">لم تُنفّذ</th><th className="c">النسبة</th></tr></thead>
          <tbody>{st.courses.map((c) => (
            <tr key={c.course}><td><b>{c.course}</b></td><td className="c num">{c.exps}</td><td className="c num">{c.classes}</td>
              <td className="c num">{c.lab}</td><td className="c num">{c.virtual}</td><td className="c num">{c.not}</td>
              <td className="c num">{pct(c.lab + c.virtual, c.exps * c.classes) ?? 0}%</td></tr>
          ))}</tbody>
        </table>
      </Box>
      {st.reasons.some((r) => r.v) && (
        <Box icon="alert" title="أسباب عدم التنفيذ"><Bars wide items={st.reasons.filter((r) => r.v).map((r) => ({ t: r.l, v: r.v }))} /></Box>
      )}
      <Box icon="folder" title="العهدة" aside={`${n(st.inv.total)} صنفًا`}>
        <Kpis cols={4} items={[
          { ic: "check", v: st.inv.ok, t: INV_STATUS.ok }, { ic: "alert", v: st.inv.damaged, t: INV_STATUS.damaged, c: "var(--s4)" },
          { ic: "alert", v: st.inv.missing, t: INV_STATUS.missing, c: "var(--s3)" }, { ic: "lock", v: st.inv.expiring, t: "صلاحية تنتهي خلال 60 يومًا" },
        ]} />
      </Box>
      {st.prep.issue > 0 && <Box icon="alert" title="حجوزات ينقصها شيء"><p style={{ margin: 0, fontSize: 12 }}>{n(st.prep.issue)} حجزًا سجّل فيه المحضر «{PREP.issue}».</p></Box>}
      {signs(s)}
    </Page>,
  ];
}
