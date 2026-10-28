// src/pages/globe/GlobeReportDoc.jsx
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { GLOBE_KIND, GLOBE_SPHERES, GLOBE_MEANING, sphereOf } from "../../lib/globe.js";
import {
  S, n, pct, dmy, countAr, paginate, Ring, Donut, DonutLegend, Bars, Kpis, Highlights, Box, Signs, Page,
  Cover as KitCover,
} from "../../components/report/ReportKit.jsx";
import { weekday, time12 } from "./GlobeMonitor.jsx";

/* =====================================================================
   خطة برنامج جلوب وتقرير تنفيذها بطقم التقارير (components/report):
   الغلاف ← الملخص بمؤشراته ← جدول برامج الخطة ← جدول جلسات الرصد ←
   توثيق المنفّذ بصوره ← الاعتماد والتوقيعات.
   programs و obs من globe_2.sql، ولكل منهما photoUrls (روابط موقّتة)
   ===================================================================== */

const KIND_ORDER = ["awareness", "training", "field", "research"];
const KIND_COLOR = { awareness: S[1], training: S[0], field: S[2], research: S[3] };
const KIND_PLURAL = { awareness: "التوعوية", training: "التدريبية", field: "الميدانية", research: "البحثية" };
const SPHERES = GLOBE_SPHERES.filter((s) => s.k !== "all");

const docOf = (info) => ({ title: "خطة برنامج جلوب وتقرير تنفيذها", meta: ["برنامج جلوب البيئي", info.year], foot: "برنامج جلوب البيئي العالمي" });

export function globeStats(programs, obs, today) {
  const live = obs.filter((o) => o.status !== "cancelled");
  const due = live.filter((o) => o.obs_date <= today);
  const pDone = programs.filter((p) => p.status === "done");
  const oDone = live.filter((o) => o.status === "done");
  const bySphere = Object.fromEntries(SPHERES.map((s) => [s.k, { total: 0, done: 0, due: 0 }]));
  live.forEach((o) => {
    const b = bySphere[o.sphere]; if (!b) return;
    b.total += 1; if (o.obs_date <= today) b.due += 1; if (o.status === "done") b.done += 1;
  });
  const byProtocol = {};
  oDone.forEach((o) => { byProtocol[o.protocol] = (byProtocol[o.protocol] ?? 0) + 1; });
  return {
    programs: programs.length, pDone: pDone.length,
    beneficiaries: pDone.reduce((a, p) => a + Number(p.beneficiaries ?? 0), 0),
    byKind: Object.fromEntries(KIND_ORDER.map((k) => [k, programs.filter((p) => p.kind === k).length])),
    sessions: live.length, due: due.length, oDone: oDone.length, uploaded: live.filter((o) => o.uploaded).length,
    missed: due.filter((o) => o.status === "planned").length, bySphere, byProtocol,
    commit: pct(due.filter((o) => o.status === "done").length, due.length),
    pDoneList: pDone, oDoneList: oDone,
    photos: [...pDone, ...oDone].reduce((a, x) => a + (x.photos?.length ?? 0), 0),
  };
}

function Cover({ theme, info, s }) {
  return (
    <KitCover theme={theme} c={{
      year: info.year, tag: ["globe", "برنامج جلوب البيئي العالمي"], title: "خطة برنامج جلوب", sub: "وتقرير تنفيذها",
      badge: { main: "البرنامج والرصد", sub: info.termLabel }, side: { main: info.hijri, sub: "تاريخ الإصدار" },
      rows: [["user", "منسق البرنامج", info.leader || "—"], ["users", "طلاب البرنامج", countAr(info.members, "student")],
             ["calendar", "تاريخ الإصدار", info.issued], ["building", "العام الدراسي", `${info.year} · ${info.termLabel}`]],
      note: ["globe", `GLOBE: ${GLOBE_MEANING} — يوثّق برامج الخطة وجلسات الرصد في ميادين البحث الخمسة وما رُفع إلى منصة GLOBE.`],
      strip: [[s.programs, "برامج الخطة"], [s.sessions, "جلسات الرصد"], [s.uploaded, "رُفعت إلى GLOBE"],
              [`${s.commit ?? 0}%`, "الالتزام بالرصد"]],
      foot: "برنامج جلوب البيئي العالمي",
    }} />
  );
}

function highlights(s) {
  const out = [];
  if (s.programs) out.push(`تضم خطة البرنامج ${countAr(s.programs, "program")}، نُفّذ منها ${n(s.pDone)} بنسبة ${pct(s.pDone, s.programs) ?? 0}%.`);
  if (s.beneficiaries) out.push(`استفاد من البرامج المنفّذة ${countAr(s.beneficiaries, "beneficiary")}.`);
  if (s.sessions) out.push(`جُدولت ${countAr(s.sessions, "session")} رصد، نُفّذ منها ${n(s.oDone)}، ورُفعت بيانات ${n(s.uploaded)} إلى منصة GLOBE.`);
  if (s.due) out.push(`الالتزام بالرصد ${s.commit ?? 0}% من الجلسات التي حل موعدها${s.missed ? `، وفات موعد ${n(s.missed)} دون توثيق` : ""}.`);
  const top = Object.entries(s.byProtocol).sort((a, b) => b[1] - a[1])[0];
  if (top) out.push(`أكثر البروتوكولات رصدًا «${top[0]}»: ${countAr(top[1], "session")}.`);
  if (s.photos) out.push(`وُثّق التنفيذ بـ${s.photos === 1 ? "صورة واحدة" : s.photos === 2 ? "صورتين" : ` ${n(s.photos)} صور`}.`);
  return out.slice(0, 6);
}

function Summary({ theme, info, s, page, total }) {
  const kindParts = KIND_ORDER.map((k) => ({ t: GLOBE_KIND[k], v: s.byKind[k], c: KIND_COLOR[k] }));
  const prot = Object.entries(s.byProtocol).sort((a, b) => b[1] - a[1]).slice(0, 7);
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 1, title: "ملخص الخطة", sub: "مؤشرات تنفيذ برامج جلوب وجلسات الرصد في ميادين البحث الخمسة" }}>
      <Kpis items={[
        { ic: "list", t: "برامج الخطة", v: s.programs, s: `نُفّذ ${n(s.pDone)} بنسبة ${pct(s.pDone, s.programs) ?? 0}%`, c: S[0] },
        { ic: "calendar", t: "جلسات الرصد", v: s.sessions, s: `نُفّذ منها ${n(s.oDone)}`, c: S[1] },
        { ic: "check", t: "رُفعت إلى GLOBE", v: s.uploaded, s: `من ${n(s.oDone)} جلسة منفّذة`, c: S[2] },
        { ic: "users", t: "المستفيدون", v: s.beneficiaries, s: "من البرامج المنفّذة", c: S[3] },
      ]} />
      <Box icon="globe" title="الالتزام بالرصد في كل ميدان (المنفّذ من الجلسات التي حل موعدها)">
        <div className="mr-rings" style={{ gridTemplateColumns: `repeat(${SPHERES.length}, 1fr)` }}>
          {SPHERES.map((sp) => {
            const b = s.bySphere[sp.k];
            return <Ring key={sp.k} value={b.due ? pct(b.done, b.due) : null} color={sp.color} label={sp.t}
                         sub={`${n(b.done)} من ${n(b.due)} · ${countAr(b.total, "session")}`} />;
          })}
        </div>
      </Box>
      <div className="mr-row c2">
        <Box icon="chart" title="برامج الخطة بحسب النوع">
          {s.programs ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Donut parts={kindParts} total={s.programs} label="برنامج" size={132} />
              <DonutLegend parts={kindParts} />
            </div>
          ) : <div className="mr-empty">لا برامج في الخطة بعد.</div>}
        </Box>
        <Box icon="list" title="الجلسات المنفّذة بحسب البروتوكول" aside={n(s.oDone)}>
          {prot.length ? <Bars wide items={prot.map(([t, v]) => ({ t, v, c: S[1] }))} />
                       : <div className="mr-empty">لم تُوثَّق جلسات رصد بعد.</div>}
        </Box>
      </div>
      <Highlights title="أبرز ما في الخطة" items={highlights(s)} />
    </Page>
  );
}

const pStatus = (p) => (p.status === "done" ? { t: "نُفّذ", c: "var(--s1)" } : { t: "لم يُنفَّذ", c: "#8A9A91" });
const oStatus = (o, today) => (o.status === "done" ? { t: o.uploaded ? "نُفّذ ورُفع" : "نُفّذ", c: "var(--s1)" }
  : o.status === "cancelled" ? { t: "ملغاة", c: "#8A9A91" }
  : o.obs_date < today ? { t: "فات موعدها", c: "var(--s4)" } : { t: "مجدولة", c: "var(--s2)" });

function ProgramsPage({ theme, info, chunk, start, cont, page, total }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total}
          sec={{ no: 2, title: cont ? "برامج الخطة (تتمة)" : "برامج الخطة", sub: cont ? null : "برامج العام بنوعها ومجالها وموعدها وحالة تنفيذها" }}>
      {chunk.length ? (
        <table className="mr-table">
          <thead><tr>
            <th className="c" style={{ width: 24 }}>م</th><th>البرنامج</th><th className="c" style={{ width: 54 }}>النوع</th>
            <th className="c" style={{ width: 80 }}>المجال</th><th className="c" style={{ width: 68 }}>الموعد</th>
            <th className="c" style={{ width: 64 }}>الحالة</th><th className="c" style={{ width: 68 }}>التنفيذ</th>
            <th className="c" style={{ width: 50 }}>المستفيدون</th>
          </tr></thead>
          <tbody>{chunk.map((p, i) => {
            const st = pStatus(p);
            return (
              <tr key={p.id}>
                <td className="c num">{start + i + 1}</td>
                <td style={{ fontWeight: 600 }}>{p.title}</td>
                <td className="c" style={{ color: KIND_COLOR[p.kind], fontWeight: 700 }}>{GLOBE_KIND[p.kind]}</td>
                <td className="c">{sphereOf(p.sphere).t}</td>
                <td className="c num">{p.planned_date ? dmy(p.planned_date) : "—"}</td>
                <td className="c" style={{ color: st.c, fontWeight: 700 }}>{st.t}</td>
                <td className="c num">{p.done_date && p.status === "done" ? dmy(p.done_date) : "—"}</td>
                <td className="c num">{p.beneficiaries ?? "—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      ) : <div className="mr-empty">لا برامج في الخطة بعد.</div>}
    </Page>
  );
}

function ObsPage({ theme, info, chunk, start, cont, page, total, today }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total}
          sec={{ no: 3, title: cont ? "خطة الرصد (تتمة)" : "خطة الرصد البيئي", sub: cont ? null : "جلسات الرصد بالبروتوكول والموعد والمكان وعدد الطلاب" }}>
      {chunk.length ? (
        <table className="mr-table">
          <thead><tr>
            <th className="c" style={{ width: 24 }}>م</th><th>البروتوكول</th><th className="c" style={{ width: 76 }}>المجال</th>
            <th className="c" style={{ width: 104 }}>اليوم والتاريخ</th><th className="c" style={{ width: 52 }}>الوقت</th>
            <th className="c" style={{ width: 82 }}>المكان</th><th className="c" style={{ width: 40 }}>الطلاب</th>
            <th className="c" style={{ width: 70 }}>الحالة</th>
          </tr></thead>
          <tbody>{chunk.map((o, i) => {
            const st = oStatus(o, today);
            return (
              <tr key={o.id}>
                <td className="c num">{start + i + 1}</td>
                <td style={{ fontWeight: 600 }}>{o.protocol}</td>
                <td className="c" style={{ color: sphereOf(o.sphere).color, fontWeight: 700 }}>{sphereOf(o.sphere).t}</td>
                <td className="c num">{weekday(o.obs_date)} {dmy(o.obs_date)}</td>
                <td className="c num">{time12(o.obs_time) || "—"}</td>
                <td className="c">{o.place || "—"}</td>
                <td className="c num">{o.student_ids?.length || "—"}</td>
                <td className="c" style={{ color: st.c, fontWeight: 700 }}>{st.t}</td>
              </tr>
            );
          })}</tbody>
        </table>
      ) : <div className="mr-empty">لا جلسات رصد بعد.</div>}
    </Page>
  );
}

const docH = (x) => 96 + (x.photoUrls?.length ? 150 : 0) + Math.ceil((x.text ?? "").length / 92) * 19;

function DocCard({ x }) {
  const photos = x.photoUrls ?? [];
  return (
    <div className="mr-box" style={{ borderRight: `4px solid ${x.color}`, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="mr-pill" style={{ color: x.color, borderColor: x.color }}>{x.tag}</span>
        <b style={{ fontSize: 14.5, flex: 1, minWidth: 0 }}>{x.title}</b>
      </div>
      <div className="mr-tiles" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 8 }}>
        {x.tiles.map(([k, v]) => (
          <div key={k} className="mr-tile" style={{ padding: "6px 8px" }}>
            <b className="num" style={{ fontSize: String(v).length > 12 ? 12.5 : 16 }}>{v}</b><span>{k}</span>
          </div>
        ))}
      </div>
      {x.text && <p style={{ marginTop: 8, fontSize: 12, lineHeight: 1.75 }}><b style={{ color: "var(--mr-deep)" }}>{x.label}: </b>{x.text}</p>}
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

function DocsPage({ theme, info, chunk, cont, page, total }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total}
          sec={{ no: 4, title: cont ? "توثيق التنفيذ (تتمة)" : "توثيق التنفيذ", sub: cont ? null : "البرامج المنفّذة وجلسات الرصد بقراءاتها وصورها" }}>
      {chunk.length ? chunk.map((x) => <DocCard key={x.id} x={x} />) : <div className="mr-empty">لم يُوثَّق تنفيذ بعد.</div>}
    </Page>
  );
}

function ApprovalPage({ theme, info, next, page, total, notes, sigs }) {
  return (
    <Page theme={theme} doc={docOf(info)} page={page} total={total} sec={{ no: 5, title: "الاعتماد", sub: "القادم في الخطة، وملاحظات المنسق، والتوقيعات" }}>
      <Box icon="calendar" title="القادم في الخطة" aside={n(next.length)}>
        {next.length ? (
          <div className="mr-list">{next.map((x) => <div key={x.id}><span>{x.t}</span><span className="num">{x.d ? dmy(x.d) : "بلا موعد"}</span></div>)}</div>
        ) : <div className="mr-empty">لا برامج ولا جلسات متبقية.</div>}
      </Box>
      <Box icon="pen" title="ملاحظات منسق البرنامج وتوصياته" tint style={{ minHeight: 170 }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3, 4].map((i) => <i key={i} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "منسق برنامج جلوب", name: info.leader, sig: sigs.leader },
                                         { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>
  );
}

/** أوراق التقرير بالترتيب */
export function globePages({ programs, obs, theme = "light", info, notes, sigs, today }) {
  const s = globeStats(programs, obs, today);
  const docs = [
    ...s.pDoneList.map((p) => ({ id: p.id, color: KIND_COLOR[p.kind], tag: GLOBE_KIND[p.kind], title: p.title,
      tiles: [["تاريخ التنفيذ", dmy(p.done_date)], ["المجال", sphereOf(p.sphere).t], ["المستفيدون", p.beneficiaries ?? "—"], ["الفئة المستهدفة", p.target || "—"]],
      label: "الأثر والملاحظات", text: p.outcome, photoUrls: p.photoUrls, d: p.done_date })),
    ...s.oDoneList.map((o) => ({ id: o.id, color: sphereOf(o.sphere).color, tag: `رصد · ${sphereOf(o.sphere).t}`, title: o.protocol,
      tiles: [["التاريخ", dmy(o.obs_date)], ["المكان", o.place || "—"], ["الطلاب", o.student_ids?.length || "—"], ["منصة GLOBE", o.uploaded ? "رُفعت" : "لم تُرفع"]],
      label: "القراءات والملاحظات", text: o.readings, photoUrls: o.photoUrls, d: o.obs_date })),
  ].sort((a, b) => (a.d ?? "").localeCompare(b.d ?? ""));
  const next = [
    ...programs.filter((p) => p.status !== "done").map((p) => ({ id: p.id, t: p.title, d: p.planned_date })),
    ...obs.filter((o) => o.status === "planned" && o.obs_date >= today).map((o) => ({ id: o.id, t: `رصد: ${o.protocol}`, d: o.obs_date })),
  ].sort((a, b) => (a.d ?? "9").localeCompare(b.d ?? "9")).slice(0, 8);

  const pt = paginate(programs, (p) => 27 + (p.title.length > 34 ? 15 : 0), 790, 860);
  const ot = paginate(obs, (o) => 27 + (o.protocol.length > 26 ? 15 : 0), 790, 860);
  const dp = docs.length ? paginate(docs, docH, 800, 870) : [[]];
  const total = 3 + pt.length + ot.length + dp.length;
  const common = { theme, info, total };
  let pg = 2;
  let a = 0;
  let b = 0;
  return [
    <Cover key="cover" theme={theme} info={info} s={s} />,
    <Summary key="sum" {...common} s={s} page={pg++} />,
    ...pt.map((c, i) => { const el = <ProgramsPage key={`p${i}`} {...common} chunk={c} start={a} cont={i > 0} page={pg++} />; a += c.length; return el; }),
    ...ot.map((c, i) => { const el = <ObsPage key={`o${i}`} {...common} chunk={c} start={b} cont={i > 0} page={pg++} today={today} />; b += c.length; return el; }),
    ...dp.map((c, i) => <DocsPage key={`d${i}`} {...common} chunk={c} cont={i > 0} page={pg++} />),
    <ApprovalPage key="ok" {...common} next={next} page={pg++} notes={notes} sigs={sigs} />,
  ];
}
