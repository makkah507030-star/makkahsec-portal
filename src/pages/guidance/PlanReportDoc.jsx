// src/pages/guidance/PlanReportDoc.jsx
import { GRADE_NAMES } from "../../lib/schoolTime";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import {
  IC, S, n, pct, dmy, countAr, paginate, Ring, Donut, DonutLegend, Bars, Kpis, Highlights, Box, Signs, Page,
  Cover as KitCover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   الخطة الإرشادية وتقرير تنفيذها بطقم التقارير (components/report):
   الغلاف ← ملخص الخطة بمؤشراتها ← جدول برامج الخطة كاملًا (وتتمته) ←
   توثيق البرامج المنفّذة بصورها وأثرها (وتتمته) ← الاعتماد والتوقيعات.
   p = برنامج guidance_programs ومعه: st (programState) و photoUrls (روابط موقّتة)
   ===================================================================== */

export const KIND_ORDER = ["awareness", "preventive", "developmental", "remedial"];
const KIND_COLOR = { awareness: S[1], preventive: S[0], developmental: S[2], remedial: S[3] };
const KIND_PLURAL = { awareness: "التوعوية", preventive: "الوقائية", developmental: "النمائية", remedial: "العلاجية" };

const docOf = (info) => ({ title: "الخطة الإرشادية وتقرير تنفيذها", meta: [info.grade, info.year], foot: "التوجيه الطلابي" });

/** الأرقام المجمّعة للخطة */
export function planStats(rows) {
  const done = rows.filter((p) => p.st.done);
  const byKind = Object.fromEntries(KIND_ORDER.map((k) => [k, { total: 0, done: 0, ben: 0 }]));
  rows.forEach((p) => {
    const k = byKind[p.kind] ?? (byKind[p.kind] = { total: 0, done: 0, ben: 0 });
    k.total += 1;
    if (p.st.done) { k.done += 1; k.ben += Number(p.st.beneficiaries ?? 0); }
  });
  return {
    total: rows.length, done: done.length,
    inEvent: rows.filter((p) => !p.st.done && p.st.ev).length,
    pending: rows.filter((p) => !p.st.done && !p.st.ev).length,
    beneficiaries: done.reduce((a, p) => a + Number(p.st.beneficiaries ?? 0), 0),
    photos: done.reduce((a, p) => a + (p.photos?.length ?? 0), 0),
    byKind, doneList: done,
  };
}

const statusOf = (p, EV_STAGE) => (p.st.done
  ? { t: "نُفّذ", c: "var(--s1)" }
  : p.st.ev ? { t: `حدث: ${EV_STAGE[p.st.ev.stage] ?? p.st.ev.stage}`, c: "var(--s2)" }
  : { t: "لم يُنفَّذ", c: "#8A9A91" });

/* ============================ الأوراق ============================ */

function Cover({ theme, info, s }) {
  return (
    <KitCover theme={theme} c={{
      year: info.year, tag: ["chat", "التوجيه الطلابي"], title: "الخطة الإرشادية", sub: "وتقرير تنفيذها",
      badge: { main: info.grade, sub: info.termLabel }, side: { main: info.hijri, sub: "تاريخ الإصدار" },
      rows: [["user", "الموجه الطلابي", info.counselor || "—"], ["cap", "الصف", info.grade],
             ["calendar", "تاريخ الإصدار", info.issued], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["lock", "يوثّق برامج الخطة الإرشادية للصف وما نُفّذ منها، دون أسماء الطلاب."],
      strip: [[s.total, "برامج الخطة"], [s.done, "البرامج المنفّذة"], [s.beneficiaries, "المستفيدون"],
              [`${pct(s.done, s.total) ?? 0}%`, "نسبة التنفيذ"]],
      foot: "التوجيه الطلابي",
    }} />
  );
}

function highlights(s) {
  const out = [];
  out.push(`تضم الخطة ${countAr(s.total, "program")}، نُفّذ منها ${n(s.done)} بنسبة ${pct(s.done, s.total) ?? 0}%.`);
  if (s.beneficiaries) out.push(`استفاد من البرامج المنفّذة ${countAr(s.beneficiaries, "student")}.`);
  const top = KIND_ORDER.filter((k) => s.byKind[k].total).sort((a, b) => s.byKind[b].total - s.byKind[a].total)[0];
  if (top) out.push(`أكثر برامج الخطة البرامج ${KIND_PLURAL[top]}: ${n(s.byKind[top].total)} من ${n(s.total)}.`);
  if (s.inEvent) out.push(`برامج قيد التنفيذ عبر «الأحداث والمناسبات»: ${n(s.inEvent)}.`);
  if (s.pending) out.push(`برامج لم يبدأ تنفيذها بعد: ${n(s.pending)}.`);
  if (s.photos) out.push(`وُثّق التنفيذ بـ${s.photos === 1 ? "صورة واحدة" : s.photos === 2 ? "صورتين" : ` ${n(s.photos)} صور`}.`);
  return out.slice(0, 6);
}

function Summary({ theme, info, s, PROGRAM_KIND, page, total }) {
  const kindParts = KIND_ORDER.map((k) => ({ t: PROGRAM_KIND[k], v: s.byKind[k].total, c: KIND_COLOR[k] }));
  const ben = s.doneList.filter((p) => p.st.beneficiaries).sort((a, b) => b.st.beneficiaries - a.st.beneficiaries).slice(0, 7);
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 1, title: "ملخص الخطة", sub: "مؤشرات تنفيذ الخطة الإرشادية للصف وتوزيع برامجها" }}>
      <Kpis items={[
        { ic: "list", t: "برامج الخطة", v: s.total, s: `${n(s.byKind.awareness.total)} توعوي · ${n(s.byKind.preventive.total)} وقائي`, c: S[0] },
        { ic: "check", t: "برامج منفّذة", v: s.done, s: `بنسبة ${pct(s.done, s.total) ?? 0}% من الخطة`, c: S[0] },
        { ic: "calendar", t: "لم تُنفَّذ بعد", v: s.pending + s.inEvent, s: `منها ${n(s.inEvent)} قيد التنفيذ حدثًا`, c: S[2] },
        { ic: "users", t: "المستفيدون", v: s.beneficiaries, s: "من البرامج المنفّذة", c: S[1] },
      ]} />

      <Box icon="trophy" title="نسبة التنفيذ بحسب نوع البرنامج">
        <div className="mr-rings">
          {KIND_ORDER.map((k) => (
            <Ring key={k} value={s.byKind[k].total ? pct(s.byKind[k].done, s.byKind[k].total) : null} color={KIND_COLOR[k]}
                  label={`البرامج ${KIND_PLURAL[k]}`}
                  sub={`${n(s.byKind[k].done)} من ${n(s.byKind[k].total)}`} />
          ))}
        </div>
      </Box>

      <div className="mr-row c2">
        <Box icon="chart" title="البرامج بحسب النوع">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Donut parts={kindParts} total={s.total} label="برنامج" size={132} />
            <DonutLegend parts={kindParts} />
          </div>
        </Box>
        <Box icon="users" title="المستفيدون في البرامج المنفّذة" aside={n(s.beneficiaries)}>
          {ben.length ? <Bars wide items={ben.map((p) => ({ t: p.title, v: Number(p.st.beneficiaries), c: KIND_COLOR[p.kind] }))} />
                      : <div className="mr-empty">لم يُسجَّل عدد المستفيدين بعد.</div>}
        </Box>
      </div>

      <Highlights title="أبرز ما في الخطة" items={highlights(s)} />
    </Page>
  );
}

const rowH = (p) => 27 + (p.title.length > 30 ? 15 : 0) + ((p.target ?? "").length > 22 ? 15 : 0);

function TablePage({ theme, info, chunk, start, cont, page, total, PROGRAM_KIND, EV_STAGE }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total}
          sec={{ no: 2, title: cont ? "برامج الخطة (تتمة)" : "برامج الخطة الإرشادية", sub: cont ? null : "كل برامج الخطة بموعدها وحالة تنفيذها" }}>
      <table className="mr-table">
        <thead><tr>
          <th className="c" style={{ width: 24 }}>م</th><th>البرنامج</th><th className="c" style={{ width: 54 }}>النوع</th>
          <th style={{ width: 112 }}>الفئة المستهدفة</th><th className="c" style={{ width: 68 }}>الموعد</th>
          <th className="c" style={{ width: 84 }}>الحالة</th><th className="c" style={{ width: 68 }}>التنفيذ</th>
          <th className="c" style={{ width: 50 }}>المستفيدون</th>
        </tr></thead>
        <tbody>{chunk.map((p, i) => {
          const st = statusOf(p, EV_STAGE);
          return (
            <tr key={p.id}>
              <td className="c num">{start + i + 1}</td>
              <td style={{ fontWeight: 600 }}>{p.title}</td>
              <td className="c" style={{ color: KIND_COLOR[p.kind], fontWeight: 700 }}>{PROGRAM_KIND[p.kind]}</td>
              <td>{p.target || "—"}</td>
              <td className="c num">{p.planned_date ? dmy(p.planned_date) : "—"}</td>
              <td className="c" style={{ color: st.c, fontWeight: 700 }}>{st.t}</td>
              <td className="c num">{p.st.date ? dmy(p.st.date) : "—"}</td>
              <td className="c num">{p.st.beneficiaries ?? "—"}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </Page>
  );
}

const docH = (p) => 96 + (p.photoUrls?.length ? 150 : 0) + Math.ceil((p.outcome ?? "").length / 92) * 19;

function DocCard({ p, PROGRAM_KIND }) {
  const photos = p.photoUrls ?? [];
  return (
    <div className="mr-box" style={{ borderRight: `4px solid ${KIND_COLOR[p.kind]}`, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mr-pill" style={{ color: KIND_COLOR[p.kind], borderColor: KIND_COLOR[p.kind] }}>{PROGRAM_KIND[p.kind]}</span>
        <b style={{ fontSize: 14.5, flex: 1, minWidth: 0 }}>{p.title}</b>
        {p.st.ev && <span className="num" style={{ fontSize: 11, color: "var(--mr-ink2)" }}>حدث {p.st.ev.serial}</span>}
      </div>
      <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 8 }}>
        {[["تاريخ التنفيذ", p.st.date ? dmy(p.st.date) : "—"], ["الموعد في الخطة", p.planned_date ? dmy(p.planned_date) : "—"],
          ["المستفيدون", p.st.beneficiaries ?? "—"], ["الفئة المستهدفة", p.target || "—"]].map(([k, v]) => (
          <div key={k} className="mr-tile" style={{ padding: "6px 8px" }}>
            <b className="num" style={{ fontSize: String(v).length > 12 ? 12.5 : 16 }}>{v}</b><span>{k}</span>
          </div>
        ))}
      </div>
      {p.outcome && (
        <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.75 }}><b style={{ color: "var(--mr-deep)" }}>الأثر والملاحظات: </b>{p.outcome}</p>
      )}
      {photos.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${photos.length}, 1fr)`, gap: 8, marginTop: 9 }}>
          {photos.map((u) => (
            <div key={u} style={{ height: 140, borderRadius: 10, overflow: "hidden", background: "#EEF4F0" }}>
              <img src={u} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocsPage({ theme, info, chunk, cont, page, total, PROGRAM_KIND }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total}
          sec={{ no: 3, title: cont ? "توثيق التنفيذ (تتمة)" : "توثيق البرامج المنفّذة", sub: cont ? null : "تاريخ كل برنامج ومستفيدوه وأثره وصور تنفيذه" }}>
      {chunk.length ? chunk.map((p) => <DocCard key={p.id} p={p} PROGRAM_KIND={PROGRAM_KIND} />)
                    : <div className="mr-empty">لم يُنفَّذ أي برنامج من الخطة بعد.</div>}
    </Page>
  );
}

function ApprovalPage({ theme, info, s, rows, page, total, notes, sigs }) {
  const next = rows.filter((p) => !p.st.done).slice(0, 8);
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 4, title: "الاعتماد", sub: "البرامج المتبقية، وملاحظات الموجه، والتوقيعات" }}>
      <Box icon="calendar" title="البرامج المتبقية في الخطة" aside={n(s.pending + s.inEvent)}>
        {next.length ? (
          <div className="mr-list">{next.map((p) => <div key={p.id}><span>{p.title}</span><span className="num">{p.planned_date ? dmy(p.planned_date) : "بلا موعد"}</span></div>)}</div>
        ) : <div className="mr-empty">نُفّذت برامج الخطة كلها.</div>}
      </Box>
      <Box icon="pen" title="ملاحظات الموجه وتوصياته" tint style={{ minHeight: 170 }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "الموجه الطلابي", name: info.counselor, sig: sigs.counselor },
                                         { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>
  );
}

/** أوراق التقرير بالترتيب. rows: برامج الصف مع st و photoUrls */
export function planPages({ rows, theme = "light", info, notes, sigs, PROGRAM_KIND, EV_STAGE }) {
  const s = planStats(rows);
  const tables = paginate(rows, rowH, 790, 860);
  const docs = s.doneList.length ? paginate(s.doneList, docH, 800, 870) : [[]];
  const total = 3 + tables.length + docs.length;
  const common = { theme, info, total, PROGRAM_KIND, EV_STAGE };
  let pg = 2;
  let start = 0;
  return [
    <Cover key="cover" theme={theme} info={info} s={s} />,
    <Summary key="sum" {...common} s={s} page={pg++} />,
    ...tables.map((c, i) => { const el = <TablePage key={`t${i}`} {...common} chunk={c} start={start} cont={i > 0} page={pg++} />; start += c.length; return el; }),
    ...docs.map((c, i) => <DocsPage key={`d${i}`} {...common} chunk={c} cont={i > 0} page={pg++} />),
    <ApprovalPage key="ok" {...common} s={s} rows={rows} page={pg++} notes={notes} sigs={sigs} />,
  ];
}

export const planInfo = ({ grade, counselor, yearLabel, termLabel, today }) => {
  const d = new Date(`${today}T12:00:00`);
  return {
    grade: GRADE_NAMES[grade] ?? "", counselor, year: yearLabel, termLabel,
    issued: dmy(today),
    hijri: `${new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d)}`,
  };
};
