// src/pages/globe/GlobeBadgesDoc.jsx
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { S, n, Box, Signs, Page, Bars, Cover as KitCover } from "../../components/report/ReportKit.jsx";

/* =====================================================================
   تقرير «إنجازات برنامج جلوب وأوسمته» بطقم التقارير (هوية البوابة):
   الغلاف ← صفحة لكل عام بأرباعه الأربعة (عدد الأوسمة ومجالاتها) ← الاعتماد.
   rows من globe_badges (supabase/globe_3.sql)
   ===================================================================== */

const Q_T = { 1: "الربع الأول", 2: "الربع الثاني", 3: "الربع الثالث", 4: "الربع الرابع" };
const GOLD = "#B8912F";
const doc = { title: "إنجازات برنامج جلوب وأوسمته", meta: ["برنامج جلوب البيئي", "لوحة شرف العلوم"], foot: "برنامج جلوب البيئي العالمي" };
const badgeWord = (v) => (v === 1 ? "وسام" : v === 2 ? "وسامان" : v >= 3 && v <= 10 ? "أوسمة" : "وسامًا");

const Medal = ({ size = 34 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="6" /><circle cx="12" cy="9" r="3" fill={GOLD} fillOpacity=".18" /><path d="M8.5 14L7 22l5-3 5 3-1.5-8" />
  </svg>
);

function domainCounts(rows) {
  const m = {};
  rows.forEach((r) => (r.domains ?? []).forEach((d) => { m[d] = (m[d] ?? 0) + 1; }));
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

function Quarter({ q, r }) {
  const v = r?.badges ?? 0;
  return (
    <div style={{ border: `1.5px solid ${v ? "#E7D3A0" : "#E3ECE6"}`, borderRadius: 14, padding: "12px 14px",
                  background: v ? "linear-gradient(160deg,#FFFBF0,#FFFFFF)" : "#FAFCFB", minHeight: 150, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ fontSize: 14, color: "var(--mr-deep)" }}>{Q_T[q]}</b>
        <span style={{ marginInlineStart: "auto" }}><Medal size={26} /></span>
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6 }}>
        <b className="num" style={{ fontSize: 34, lineHeight: 1, color: v ? GOLD : "#B5C2BA" }}>{n(v)}</b>
        <span style={{ fontSize: 12.5, color: "#5E7268" }}>{badgeWord(v)}</span>
      </div>
      {r?.domains?.length ? (
        <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: 5 }}>
          {r.domains.map((d) => (
            <span key={d} style={{ background: "#EDF7F1", color: "#2F5442", border: "1px solid #CFE7D9", borderRadius: 99, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{d}</span>
          ))}
        </div>
      ) : <div style={{ marginTop: 9, fontSize: 11.5, color: "#9AA8A0" }}>{r ? "لم تُحدد المجالات" : "لم يُدخل"}</div>}
      {r?.note && <div style={{ marginTop: "auto", paddingTop: 8, fontSize: 11, color: "#5E7268" }}>{r.note}</div>}
    </div>
  );
}

function YearPage({ theme, year, no, rows, page, total, last, sigs, leader }) {
  const of = (q) => rows.find((r) => r.quarter === q);
  const sum = rows.reduce((a, r) => a + r.badges, 0);
  const doms = domainCounts(rows);
  return (
    <Page theme={theme} doc={doc} page={page} total={total}
          sec={{ no, title: `أوسمة عام ${year}`, sub: `${n(sum)} ${badgeWord(sum)} في ${n(rows.filter((r) => r.badges).length)} من أرباع العام` }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[1, 2, 3, 4].map((q) => <Quarter key={q} q={q} r={of(q)} />)}
      </div>
      <Box icon="award" title="المجالات التي نال فيها البرنامج الأوسمة" aside={n(doms.length)}>
        {doms.length ? <Bars wide items={doms.slice(0, 10).map(([t, v]) => ({ t, v, c: S[2] }))} />
                     : <div className="mr-empty">لم تُحدد المجالات.</div>}
      </Box>
      {last && (
        <Signs stamp={sigs.stamp} people={[{ title: "منسق برنامج جلوب", name: leader, sig: sigs.leader },
                                           { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
      )}
    </Page>
  );
}

/** أوراق التقرير بالترتيب: الغلاف، ثم عام في كل صفحة (الأحدث أولًا) */
export function badgesPages({ rows, theme = "light", leader, sigs, today }) {
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a);
  const sum = rows.reduce((a, r) => a + r.badges, 0);
  const doms = domainCounts(rows);
  const best = years.map((y) => [y, rows.filter((r) => r.year === y).reduce((a, r) => a + r.badges, 0)]).sort((a, b) => b[1] - a[1])[0];
  const issued = `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`;
  const total = 1 + years.length;
  return [
    <KitCover key="cover" theme={theme} c={{
      year: years.length ? `${years[years.length - 1]}–${years[0]}` : "", tag: ["award", "برنامج جلوب البيئي العالمي"],
      title: "إنجازات البرنامج", sub: "وأوسمته في لوحة شرف العلوم",
      badge: { main: `${n(sum)} ${badgeWord(sum)}`, sub: "مجموع الأوسمة" }, side: { main: issued, sub: "تاريخ الإصدار" },
      rows: [["user", "منسق البرنامج", leader || "—"], ["calendar", "الأعوام", years.length ? years.join("، ") : "—"],
             ["award", "أكثر الأعوام أوسمة", best ? `${best[0]} (${n(best[1])})` : "—"],
             ["list", "أبرز المجالات", doms.slice(0, 3).map(([d]) => d).join("، ") || "—"]],
      note: ["lock", "المصدر: صفحة تقدير المدرسة في لوحة شرف العلوم ببرنامج GLOBE (globe.gov · Science Honor Roll)."],
      strip: [[sum, "الأوسمة"], [years.length, "الأعوام"], [rows.filter((r) => r.badges).length, "أرباع بأوسمة"], [doms.length, "المجالات"]],
      foot: "برنامج جلوب البيئي العالمي",
    }} />,
    ...years.map((y, i) => (
      <YearPage key={y} theme={theme} year={y} no={i + 1} rows={rows.filter((r) => r.year === y)} page={i + 2} total={total}
                last={i === years.length - 1} sigs={sigs} leader={leader} />
    )),
  ];
}

