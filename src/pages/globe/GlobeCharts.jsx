// src/pages/globe/GlobeCharts.jsx
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { GLOBE_MEMBER_ROLES } from "../../lib/globe.js";
import { n, Box, Signs, Page } from "../../components/report/ReportKit.jsx";

/* =====================================================================
   مستندات برنامج جلوب بطقم التقارير (هوية البوابة):
   • chartPages: هيكل فريق البرنامج: المشرف العام (مشرف البرنامج) ← نائبه ← مشرفو الرصد ← الأعضاء.
   • cvPages: السيرة الذاتية لمشرف البرنامج وشهادة اعتماد تدريبه.
   ===================================================================== */

const DEEP = "#2F5442";
const GOLD = "#B8912F";
const LINE = "#9CC9B0";
const cls = (m) => (m.grade ? `${GRADE_NAMES[m.grade] ?? ""} · ${m.class_no}` : "");

/* ---------------------------- هيكل الفريق ---------------------------- */

const LEVEL = {
  deputy:  { bg: "linear-gradient(150deg,#C9A443,#A9822A)", fg: "#fff", sub: "#FFF4D6", w: 220 },
  monitor: { bg: "#EAF6EF", fg: DEEP, sub: "#5E7268", w: 170, border: "1.5px solid #9CC9B0" },
};

function Card({ m, role, kind, full }) {
  const L = LEVEL[kind];
  return (
    <div style={{ position: "relative", width: full ? "100%" : L.w, maxWidth: "100%", boxSizing: "border-box", borderRadius: 14, padding: "9px 12px", textAlign: "center",
                  background: L.bg, color: L.fg, border: L.border ?? "none", boxShadow: "0 6px 14px -10px rgba(28,51,40,.6)" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: L.sub, letterSpacing: ".2px" }}>{role}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.45, marginTop: 2 }}>{m.full_name}</div>
      {cls(m) && <div style={{ fontSize: 10.5, color: L.sub, marginTop: 1 }}>{cls(m)}</div>}
    </div>
  );
}

const VLine = ({ h = 18 }) => <div style={{ width: 2, height: h, background: LINE, margin: "0 auto" }} />;

/* صف من البطاقات بفرع أفقي يصلها بما فوقها */
function Row({ list, role, kind }) {
  if (!list.length) return null;
  const k = list.length;
  return (
    <div>
      <VLine />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-around", gap: 10 }}>
        {k > 1 && <div style={{ position: "absolute", top: 0, height: 2, background: LINE, insetInlineStart: `${50 / k}%`, insetInlineEnd: `${50 / k}%` }} />}
        {list.map((m) => (
          <div key={m.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
            {k > 1 && <VLine h={12} />}
            <Card m={m} role={role} kind={kind} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Members({ list, start }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
      {list.map((m, i) => (
        <div key={m.id} style={{ border: "1px solid #DCE8E1", background: "#fff", borderRadius: 10, padding: "7px 8px", display: "flex", gap: 7, alignItems: "flex-start" }}>
          <span className="num" style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", background: "#EAF6EF", color: DEEP, fontSize: 10.5, fontWeight: 700, display: "grid", placeItems: "center" }}>{start + i + 1}</span>
          <span style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 11.5, lineHeight: 1.45, color: "#1C3328" }}>{m.full_name}</b>
            {cls(m) && <span style={{ fontSize: 10, color: "#5E7268" }}>{cls(m)}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function chartPages({ members, leader, theme = "light", sigs, year }) {
  const by = (k) => members.filter((m) => (m.role ?? "member") === k);
  const deputy = by("deputy"), monitor = by("monitor"), rest = by("member");
  const doc = { title: "هيكل فريق برنامج جلوب", meta: ["برنامج جلوب البيئي", year], foot: "برنامج جلوب البيئي العالمي" };
  // الأعضاء: بقية الصفحة الأولى بحسب ما فوقهم، ثم 56 في كل صفحة
  const topRows = [deputy, monitor].filter((x) => x.length).length;
  // صف مشرفي الرصد المتفرّع يأخذ مكان صف أعضاء، ومجموعتهم (أكثر من أربعة) مكان صف لكل ثلاثة وعنوانها
  const monRows = monitor.length > 4 ? Math.ceil(monitor.length / 3) + 1 : monitor.length ? 1 : 0;
  const firstCap = Math.max(8, 4 * Math.floor((36 - topRows * 4 - monRows * 4) / 4));
  const chunks = [rest.slice(0, firstCap)];
  for (let i = firstCap; i < rest.length; i += 56) chunks.push(rest.slice(i, i + 56));
  const total = chunks.length;
  const counts = GLOBE_MEMBER_ROLES.map((r) => [r.t, by(r.k).length]);

  return chunks.map((chunk, p) => (
    <Page key={p} theme={theme} doc={doc} page={p + 1} total={total}
          sec={p === 0 ? { no: 1, title: "هيكل الفريق", sub: `${n(members.length)} طالبًا · ${counts.filter(([, v]) => v).map(([t, v]) => `${t} ${n(v)}`).join(" · ")}` }
                       : { no: 1, title: "هيكل الفريق (تتمة الأعضاء)" }}>
      {p === 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ borderRadius: 16, padding: "11px 22px", textAlign: "center", background: "linear-gradient(150deg,#264536,#1C3328)", color: "#fff", minWidth: 250 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#89D7AD" }}>المشرف العام · مشرف البرنامج</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{leader || "…………………"}</div>
            </div>
          </div>
          <Row list={deputy} role="نائب المشرف العام" kind="deputy" />
          {monitor.length > 0 && (
            monitor.length <= 4 ? <Row list={monitor} role="مشرف رصد" kind="monitor" /> : (
              /* أكثر من أربعة: مجموعة واحدة متصلة بالفرع، ثلاث بطاقات في الصف بعرض متساوٍ لا يتجاوز الصفحة */
              <div>
                <VLine />
                <div style={{ border: `1.5px dashed ${LINE}`, borderRadius: 16, padding: "8px 10px 10px", background: "#F7FBF8" }}>
                  <div style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: "#5E7268", marginBottom: 7 }}>
                    مشرفو الرصد <span className="num">({n(monitor.length)})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                    {monitor.map((m) => <Card key={m.id} m={m} role="مشرف رصد" kind="monitor" full />)}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
      {chunk.length > 0 && (
        <Box icon="users" title={p === 0 ? "أعضاء الفريق" : "أعضاء الفريق (تتمة)"} aside={n(rest.length)}>
          <Members list={chunk} start={p === 0 ? 0 : firstCap + (p - 1) * 56} />
        </Box>
      )}
      {p === total - 1 && (
        <Signs stamp={sigs.stamp} people={[{ title: "المشرف العام لبرنامج جلوب", name: leader, sig: sigs.leader },
                                           { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
      )}
    </Page>
  ));
}

/* ---------------------------- السيرة الذاتية ---------------------------- */

const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

function List({ items }) {
  return (
    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.85 }}>
      {items.map((x) => <li key={x}>{x}</li>)}
    </ul>
  );
}

export function cvPages({ d, theme = "light", cert, sig, principal, stamp, hasPdfCert }) {
  const doc = { title: "السيرة الذاتية لمشرف برنامج جلوب", meta: ["برنامج جلوب البيئي", d.name], foot: "برنامج جلوب البيئي العالمي" };
  const facts = [["المؤهل العلمي", d.degree], ["العمل الحالي", d.job], ["سنوات الخبرة", d.years],
                 ["الإشراف على البرنامج منذ", d.globe_since], ["البريد الإلكتروني", d.email]].filter(([, v]) => v);
  const blocks = [["award", "الدورات والاعتمادات", lines(d.training)], ["list", "الخبرات", lines(d.experience)],
                  ["check", "الإنجازات", lines(d.achievements)]].filter(([, , v]) => v.length);
  const total = cert ? 2 : 1;
  const signs = <Signs stamp={stamp} people={[{ title: "مشرف برنامج جلوب", name: d.name, sig }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: principal }]} />;
  return [
    <Page key="cv" theme={theme} doc={doc} page={1} total={total}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", borderRadius: 16, padding: "16px 20px",
                    background: "linear-gradient(150deg,#3E6350,#2F5442)", color: "#fff" }}>
        <div style={{ flex: "none", width: 64, height: 64, borderRadius: "50%", background: "rgba(137,215,173,.22)", display: "grid", placeItems: "center" }}>
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#89D7AD" strokeWidth="1.8"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>{d.name || "…………………"}</div>
          <div style={{ fontSize: 13, color: "#CFE9DA", marginTop: 2 }}>{d.title || "المشرف العام لبرنامج جلوب البيئي العالمي"} · مدرسة مكة الثانوية</div>
        </div>
      </div>
      {facts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ border: "1px solid #DCE8E1", borderRadius: 10, padding: "7px 11px", background: "#FAFCFB" }}>
              <div style={{ fontSize: 10.5, color: "#5E7268" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C3328", direction: k === "البريد الإلكتروني" ? "ltr" : undefined, textAlign: "right" }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      {d.about?.trim() && <Box icon="user" title="نبذة"><p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.9 }}>{d.about.trim()}</p></Box>}
      {blocks.map(([ic, t, v]) => <Box key={t} icon={ic} title={t} aside={n(v.length)}><List items={v} /></Box>)}
      {hasPdfCert && <Box icon="doc" title="شهادة اعتماد التدريب"><p style={{ margin: 0, fontSize: 12 }}>مرفقة ملف PDF في البوابة.</p></Box>}
      {!cert && signs}
    </Page>,
    ...(cert ? [
      <Page key="cert" theme={theme} doc={doc} page={2} total={2} sec={{ no: 2, title: "شهادة اعتماد التدريب" }}>
        <div style={{ border: "1px solid #DCE8E1", borderRadius: 12, padding: 8, background: "#fff", display: "flex", justifyContent: "center" }}>
          <img src={cert} alt="" crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: 640, objectFit: "contain", display: "block" }} />
        </div>
        {signs}
      </Page>,
    ] : []),
  ];
}

