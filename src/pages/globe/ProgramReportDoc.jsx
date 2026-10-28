// src/pages/globe/ProgramReportDoc.jsx
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  S, n, pct, dmy, countAr, paginate, Donut, DonutLegend, Bars, Kpis, Highlights, Box, Signs, Page,
  Cover as KitCover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   خطة برنامج وتقرير تنفيذها بطقم التقارير (عامّة، لبرامج بلا رصد كالموهوبين):
   الغلاف ← الملخص ← جدول برامج الخطة ← توثيق المنفّذ بصوره ← الاعتماد.
   cfg: { title, unit, tag (أيقونة الغلاف), kinds, kindPlural, domainOf, signer, membersLabel }
   programs: صفوف الخطة ومع كل منها photoUrls (روابط موقّتة)
   ===================================================================== */

const COLORS = [S[1], S[0], S[2], S[3]];
const kindColor = (cfg, k) => COLORS[Math.max(0, Object.keys(cfg.kinds).indexOf(k)) % COLORS.length];

function stats(cfg, programs) {
  const done = programs.filter((p) => p.status === "done");
  return {
    total: programs.length, done: done.length, doneList: done,
    beneficiaries: done.reduce((a, p) => a + Number(p.beneficiaries ?? 0), 0),
    byKind: Object.fromEntries(Object.keys(cfg.kinds).map((k) => [k, { total: programs.filter((p) => p.kind === k).length, done: done.filter((p) => p.kind === k).length }])),
    photos: done.reduce((a, p) => a + (p.photos?.length ?? 0), 0),
  };
}

const docH = (p) => 96 + (p.photoUrls?.length ? 150 : 0) + Math.ceil((p.outcome ?? "").length / 92) * 19;

export function programPages({ cfg, programs, theme = "light", info, notes, sigs }) {
  const s = stats(cfg, programs);
  const doc = { title: `${cfg.title} وتقرير تنفيذها`, meta: [cfg.unit, info.year], foot: cfg.unit };
  const kinds = Object.keys(cfg.kinds);
  const tables = paginate(programs, (p) => 27 + (p.title.length > 34 ? 15 : 0), 790, 860);
  const docs = s.doneList.length ? paginate(s.doneList, docH, 800, 870) : [[]];
  const total = 3 + tables.length + docs.length;
  const next = programs.filter((p) => p.status !== "done").slice(0, 8);
  const hl = [
    s.total && `تضم الخطة ${countAr(s.total, "program")}، نُفّذ منها ${n(s.done)} بنسبة ${pct(s.done, s.total) ?? 0}%.`,
    s.beneficiaries && `استفاد من البرامج المنفّذة ${countAr(s.beneficiaries, "beneficiary")}.`,
    info.members && `${cfg.membersLabel}: ${countAr(info.members, "student")}.`,
    s.photos && `وُثّق التنفيذ بـ${s.photos === 1 ? "صورة واحدة" : s.photos === 2 ? "صورتين" : ` ${n(s.photos)} صور`}.`,
  ].filter(Boolean);
  const parts = kinds.map((k) => ({ t: cfg.kinds[k], v: s.byKind[k].total, c: kindColor(cfg, k) }));
  const ben = s.doneList.filter((p) => p.beneficiaries).sort((a, b) => b.beneficiaries - a.beneficiaries).slice(0, 7);
  let pg = 2, start = 0;

  return [
    <KitCover key="cover" theme={theme} c={{
      year: info.year, tag: [cfg.tag, cfg.unit], title: cfg.title, sub: "وتقرير تنفيذها",
      badge: { main: info.termLabel, sub: info.year }, side: { main: info.hijri, sub: "تاريخ الإصدار" },
      rows: [["user", cfg.signer, info.leader || "—"], ["users", cfg.membersLabel, countAr(info.members ?? 0, "student")],
             ["calendar", "تاريخ الإصدار", info.issued], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["lock", "يوثّق برامج الخطة وما نُفّذ منها بمستفيديه وأثره وصوره."],
      strip: [[s.total, "برامج الخطة"], [s.done, "البرامج المنفّذة"], [s.beneficiaries, "المستفيدون"], [`${pct(s.done, s.total) ?? 0}%`, "نسبة التنفيذ"]],
      foot: cfg.unit,
    }} />,
    <Page key="sum" theme={theme} doc={doc} page={pg++} total={total} sec={{ no: 1, title: "ملخص الخطة", sub: "مؤشرات تنفيذ الخطة وتوزيع برامجها" }}>
      <Kpis items={[
        { ic: "list", t: "برامج الخطة", v: s.total, s: `نُفّذ ${n(s.done)}`, c: S[0] },
        { ic: "check", t: "نسبة التنفيذ", v: `${pct(s.done, s.total) ?? 0}%`, s: `${n(s.total - s.done)} لم تُنفَّذ`, c: S[1] },
        { ic: "users", t: "المستفيدون", v: s.beneficiaries, s: "من البرامج المنفّذة", c: S[2] },
        { ic: "award", t: cfg.membersLabel, v: info.members ?? 0, s: cfg.unit, c: S[3] },
      ]} />
      <div className="mr-row c2">
        <Box icon="chart" title="البرامج بحسب النوع">
          {s.total ? (<div style={{ display: "flex", alignItems: "center", gap: 14 }}><Donut parts={parts} total={s.total} label="برنامج" size={132} /><DonutLegend parts={parts} /></div>)
                   : <div className="mr-empty">لا برامج في الخطة بعد.</div>}
        </Box>
        <Box icon="users" title="المستفيدون في البرامج المنفّذة" aside={n(s.beneficiaries)}>
          {ben.length ? <Bars wide items={ben.map((p) => ({ t: p.title, v: Number(p.beneficiaries), c: kindColor(cfg, p.kind) }))} />
                      : <div className="mr-empty">لم يُسجَّل عدد المستفيدين بعد.</div>}
        </Box>
      </div>
      <Box icon="list" title="التنفيذ بحسب النوع">
        <div className="mr-list">{kinds.map((k) => <div key={k}><span>البرامج {cfg.kindPlural[k]}</span><span className="num">{n(s.byKind[k].done)} من {n(s.byKind[k].total)}</span></div>)}</div>
      </Box>
      {hl.length > 0 && <Highlights title="أبرز ما في الخطة" items={hl} />}
    </Page>,
    ...tables.map((chunk, i) => { const st = start; start += chunk.length; return (
      <Page key={`t${i}`} theme={theme} doc={doc} page={pg++} total={total} sec={{ no: 2, title: i ? "برامج الخطة (تتمة)" : "برامج الخطة", sub: i ? null : "البرامج بنوعها ومجالها وموعدها وحالة تنفيذها" }}>
        {chunk.length ? (
          <table className="mr-table">
            <thead><tr><th className="c" style={{ width: 24 }}>م</th><th>البرنامج</th><th className="c" style={{ width: 56 }}>النوع</th><th className="c" style={{ width: 84 }}>المجال</th>
              <th className="c" style={{ width: 68 }}>الموعد</th><th className="c" style={{ width: 60 }}>الحالة</th><th className="c" style={{ width: 68 }}>التنفيذ</th><th className="c" style={{ width: 50 }}>المستفيدون</th></tr></thead>
            <tbody>{chunk.map((p, j) => (
              <tr key={p.id}><td className="c num">{st + j + 1}</td><td style={{ fontWeight: 600 }}>{p.title}</td>
                <td className="c" style={{ color: kindColor(cfg, p.kind), fontWeight: 700 }}>{cfg.kinds[p.kind]}</td><td className="c">{cfg.domainOf(p.domain).t}</td>
                <td className="c num">{p.planned_date ? dmy(p.planned_date) : "—"}</td>
                <td className="c" style={{ color: p.status === "done" ? "var(--s1)" : "#8A9A91", fontWeight: 700 }}>{p.status === "done" ? "نُفّذ" : "لم يُنفَّذ"}</td>
                <td className="c num">{p.status === "done" && p.done_date ? dmy(p.done_date) : "—"}</td><td className="c num">{p.beneficiaries ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="mr-empty">لا برامج في الخطة بعد.</div>}
      </Page>
    ); }),
    ...docs.map((chunk, i) => (
      <Page key={`d${i}`} theme={theme} doc={doc} page={pg++} total={total} sec={{ no: 3, title: i ? "توثيق التنفيذ (تتمة)" : "توثيق التنفيذ", sub: i ? null : "تاريخ كل برنامج ومستفيدوه وأثره وصور تنفيذه" }}>
        {chunk.length ? chunk.map((p) => (
          <div key={p.id} className="mr-box" style={{ borderRight: `4px solid ${kindColor(cfg, p.kind)}`, padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="mr-pill" style={{ color: kindColor(cfg, p.kind), borderColor: kindColor(cfg, p.kind) }}>{cfg.kinds[p.kind]}</span>
              <b style={{ fontSize: 14.5, flex: 1, minWidth: 0 }}>{p.title}</b>
            </div>
            <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 8 }}>
              {[["تاريخ التنفيذ", dmy(p.done_date)], ["المجال", cfg.domainOf(p.domain).t], ["المستفيدون", p.beneficiaries ?? "—"], ["الفئة المستهدفة", p.target || "—"]].map(([k, v]) => (
                <div key={k} className="mr-tile" style={{ padding: "6px 8px" }}><b className="num" style={{ fontSize: String(v).length > 12 ? 12.5 : 16 }}>{v}</b><span>{k}</span></div>
              ))}
            </div>
            {p.outcome && <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.75 }}><b style={{ color: "var(--mr-deep)" }}>الأثر والملاحظات: </b>{p.outcome}</p>}
            {p.photoUrls?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${p.photoUrls.length}, 1fr)`, gap: 8, marginTop: 9 }}>
                {p.photoUrls.map((u) => <div key={u} style={{ height: 140, borderRadius: 10, overflow: "hidden", background: "#EEF4F0" }}>
                  <img src={u} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /></div>)}
              </div>
            )}
          </div>
        )) : <div className="mr-empty">لم يُوثَّق تنفيذ بعد.</div>}
      </Page>
    )),
    <Page key="ok" theme={theme} doc={doc} page={pg++} total={total} sec={{ no: 4, title: "الاعتماد", sub: "البرامج المتبقية، والملاحظات، والتوقيعات" }}>
      <Box icon="calendar" title="البرامج المتبقية في الخطة" aside={n(s.total - s.done)}>
        {next.length ? <div className="mr-list">{next.map((p) => <div key={p.id}><span>{p.title}</span><span className="num">{p.planned_date ? dmy(p.planned_date) : "بلا موعد"}</span></div>)}</div>
                     : <div className="mr-empty">نُفّذت برامج الخطة كلها.</div>}
      </Box>
      <Box icon="pen" title={`ملاحظات ${cfg.signer} وتوصياته`} tint style={{ minHeight: 170 }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: cfg.signer, name: info.leader, sig: sigs.leader }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}
