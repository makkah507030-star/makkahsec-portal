// src/pages/activities/ActivityReportDoc.jsx
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { sectionMeta, sectionsOf } from "../../lib/activities.js";
import {
  S, n, pct, dmy, paginate, Bars, Split, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   التقرير الشامل لبنك الأنشطة بطقم التقارير (components/report) وبهوية البوابة:
   الغلاف ← ملخص الاستخدام ← سجل البطاقات (كل بطاقة باستخدامها وتقييمها)
   ← ملاحظات المعلمين على البطاقات ← ما استخدمه كل معلم ← الاعتماد.
   البيانات من act_cards_report (supabase/activities_6.sql) للعام الدراسي.
   ===================================================================== */

const CAP = 800;   // ارتفاع محتوى الورقة التقديري بعد الترويسة
const KIND = { waiting: "حقيبة الانتظار", class: "نشاط صفي" };
const day = (s) => (s ? dmy(s) : "—");
// العدد مع المعدود: مرة واحدة، مرتان، 3 مرات، 11 مرة (وكذلك الملاحظة)
const ar = (v, [one, two, few, many]) => (v === 1 ? one : v === 2 ? two : v <= 10 ? `${v} ${few}` : `${n(v)} ${many}`);
const TIMES = ["مرة واحدة", "مرتان", "مرات", "مرة"], NOTES = ["ملاحظة واحدة", "ملاحظتان", "ملاحظات", "ملاحظة"],
      CARDS = ["بطاقة واحدة", "بطاقتان", "بطاقات", "بطاقة"];
const docOf = (info) => ({ title: "التقرير الشامل لبنك الأنشطة", meta: [info.year, info.date], foot: "الشؤون التعليمية" });

function highlights(cards, used, notes) {
  const out = [];
  if (!used.length) return ["لم تُسجَّل أي بطاقة منفّذة في هذا العام الدراسي بعد."];
  const top = used[0];
  out.push(`أكثر البطاقات استخدامًا: «${top.title}» (${ar(top.uses, TIMES)}).`);
  const liked = [...used].filter((c) => c.likes + c.dislikes >= 2).sort((a, b) => b.likes / (b.likes + b.dislikes) - a.likes / (a.likes + a.dislikes))[0];
  if (liked) out.push(`الأعلى إعجابًا: «${liked.title}» (👍 ${n(liked.likes)} من ${n(liked.likes + liked.dislikes)}).`);
  const unused = cards.filter((c) => c.published && !c.uses).length;
  if (unused) out.push(`بطاقات مفعّلة لم تُستخدم بعد: ${n(unused)}، فرصة للتعريف بها أو مراجعتها.`);
  const dis = used.filter((c) => c.dislikes > c.likes);
  if (dis.length) out.push(`بطاقات لم تناسب أكثر مما أعجبت: ${dis.slice(0, 3).map((c) => `«${c.title}»`).join("، ")}${dis.length > 3 ? "…" : ""}.`);
  if (notes) out.push(`كتب المعلمون على البطاقات: ${ar(notes, NOTES)}، وهي في قسم «ملاحظات المعلمين».`);
  return out.slice(0, 6);
}

/** أوراق التقرير بالترتيب — كل ورقة عنصر مستقل */
export function activityReportPages({ d, info, theme = "light", notes, sigs = {} }) {
  const doc = docOf(info);
  const cards = [...d.cards].sort((a, b) => b.uses - a.uses || a.title.localeCompare(b.title, "ar"));
  const used = cards.filter((c) => c.uses);
  const uses = used.reduce((a, c) => a + c.uses, 0);
  const likes = used.reduce((a, c) => a + c.likes, 0), dislikes = used.reduce((a, c) => a + c.dislikes, 0);
  const noteRows = cards.filter((c) => c.notes.length).flatMap((c) => [{ head: c }, ...c.notes.map((x) => ({ note: x, card: c }))]);
  const teachers = [...d.teachers].sort((a, b) => b.cards.reduce((s, x) => s + x.n, 0) - a.cards.reduce((s, x) => s + x.n, 0));
  const tRows = teachers.flatMap((t) => [{ head: t }, ...t.cards.map((x) => ({ card: x }))]);

  // الصفحات المقسّمة: سجل البطاقات، والملاحظات، والمعلمون
  const cardPages = paginate(cards, (c) => (c.title.length > 34 ? 38 : 27), CAP - 40);
  const notePages = noteRows.length ? paginate(noteRows, (r) => (r.head ? 34 : r.note.note.length > 90 ? 44 : 28), CAP - 20, CAP - 20, (r) => !!r.head) : [];
  const tPages = tRows.length ? paginate(tRows, (r) => (r.head ? 34 : 24), CAP - 20, CAP - 20, (r) => !!r.head) : [];
  const total = 3 + cardPages.length + notePages.length + tPages.length;
  const common = { theme, doc, total };
  let pg = 2, sec = 2;

  const bySection = (kind) => sectionsOf(kind).map((s, i) => ({
    t: `${s.emoji} ${s.label}`, v: cards.filter((c) => c.kind === kind && c.section === s.key).reduce((a, c) => a + c.uses, 0), c: S[i % 4],
  }));

  return [
    <Cover key="cover" theme={theme} c={{
      year: info.year, tag: ["award", "الشؤون التعليمية"], title: "التقرير الشامل", sub: "لبنك الأنشطة: البطاقات واستخدامها",
      badge: { main: n(used.length), sub: `بطاقة مستخدمة من ${n(cards.length)}` }, side: { main: info.date, sub: "تاريخ التقرير" },
      rows: [["user", "وكيل الشؤون التعليمية", info.deputy || "—"], ["calendar", "الفترة", `العام الدراسي ${info.year}`],
             ["users", "المعلمون المستخدمون", `${n(teachers.length)} من ${n(info.teachers)}`], ["check", "مرات التنفيذ", n(uses)]],
      note: ["check", "الأرقام من تسجيل المعلمين تنفيذ البطاقات في البوابة («نُفّذ وأعجبني» أو «لم يناسب») مع ملاحظاتهم."],
      strip: [[n(used.length), "بطاقة مستخدمة"], [n(uses), "مرة تنفيذ"], [n(teachers.length), "معلمًا"], [likes + dislikes ? `${pct(likes, likes + dislikes)}%` : "—", "نسبة الإعجاب"]],
      foot: "الشؤون التعليمية",
    }} />,

    <Page key="sum" {...common} page={2} sec={{ no: 1, title: "ملخص الاستخدام", sub: "البطاقات المستخدمة، والأقسام، وتقييم المعلمين" }}>
      <Kpis items={[
        { ic: "grid", t: "البطاقات المستخدمة", v: n(used.length), s: `من ${n(cards.length)} بطاقة`, c: S[0] },
        { ic: "check", t: "مرات التنفيذ", v: n(uses), s: `في ${n(used.reduce((a, c) => a + c.classes, 0))} فصلًا`, c: S[1] },
        { ic: "users", t: "المعلمون", v: n(teachers.length), s: `من ${n(info.teachers)} معلمًا`, c: S[2] },
        { ic: "award", t: "نسبة الإعجاب", v: likes + dislikes ? `${pct(likes, likes + dislikes)}%` : "—", s: `👍 ${n(likes)} · 👎 ${n(dislikes)}`, c: S[3] },
      ]} />
      <div className="mr-row c2" style={{ alignItems: "start" }}>
        <Box icon="chart" title="حقيبة الانتظار" aside="مرات التنفيذ"><Bars wide items={bySection("waiting")} /></Box>
        <Box icon="chart" title="الأنشطة الصفية" aside="مرات التنفيذ"><Bars wide items={bySection("class")} /></Box>
      </div>
      <Box icon="check" title="تقييم المعلمين" aside={n(uses)}>
        {uses ? <Split parts={[{ t: "أعجبني", v: likes, c: S[0] }, { t: "لم يناسب", v: dislikes, c: S[3] },
                               { t: "بلا تقييم", v: uses - likes - dislikes, c: "#B9C4BE" }]} /> : <div className="mr-empty">لا تنفيذ بعد.</div>}
      </Box>
      <Highlights title="أبرز ما في التقرير" items={highlights(cards, used, noteRows.filter((r) => !r.head).length)} />
    </Page>,

    ...cardPages.map((list, i) => {
      const start = cardPages.slice(0, i).reduce((a, p) => a + p.length, 0);
      return (
        <Page key={`c${i}`} {...common} page={++pg} sec={i ? null : { no: sec, title: "سجل البطاقات", sub: "كل بطاقة باستخدامها وتقييمها، الأكثر استخدامًا أولًا" }}>
          <table className="mr-table">
            <thead><tr><th className="c" style={{ width: 26 }}>م</th><th>البطاقة</th><th style={{ width: 110 }}>القسم</th>
              <th className="c" style={{ width: 46 }}>المرات</th><th className="c" style={{ width: 50 }}>المعلمون</th><th className="c" style={{ width: 44 }}>الفصول</th>
              <th className="c" style={{ width: 34 }}>👍</th><th className="c" style={{ width: 34 }}>👎</th><th className="c" style={{ width: 74 }}>آخر استخدام</th></tr></thead>
            <tbody>{list.map((c, j) => {
              const meta = sectionMeta(c.kind, c.section);
              return (
                <tr key={c.id} style={c.uses ? undefined : { color: "var(--mr-ink2)" }}>
                  <td className="c num">{start + j + 1}</td>
                  <td>{c.emoji ? `${c.emoji} ` : ""}{c.title}{!c.published && <span className="mr-chip no" style={{ marginRight: 6 }}>معطّلة</span>}</td>
                  <td style={{ fontSize: 10.5 }}>{KIND[c.kind] ?? c.kind} · {meta.label}</td>
                  <td className="c num">{c.uses || "—"}</td><td className="c num">{c.teachers || "—"}</td><td className="c num">{c.classes || "—"}</td>
                  <td className="c num">{c.likes || "—"}</td><td className="c num">{c.dislikes || "—"}</td><td className="c num">{day(c.last_on)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </Page>
      );
    }),

    ...notePages.map((list, i) => (
      <Page key={`n${i}`} {...common} page={++pg} sec={i ? null : { no: ++sec, title: "ملاحظات المعلمين على البطاقات", sub: "ما كتبه المعلمون عند تسجيل التنفيذ" }}>
        <table className="mr-table">
          <thead><tr><th>الملاحظة</th><th style={{ width: 150 }}>المعلم</th><th className="c" style={{ width: 70 }}>التاريخ</th><th className="c" style={{ width: 40 }}>التقييم</th></tr></thead>
          <tbody>{list.map((r, j) => r.head ? (
            <tr key={`h${j}`}><td colSpan={4} style={{ background: "var(--mr-tint)", fontWeight: 700, color: "var(--mr-deep)" }}>
              {r.head.emoji ? `${r.head.emoji} ` : ""}{r.head.title} <span style={{ fontWeight: 500, fontSize: 10.5, color: "var(--mr-ink2)" }}>· {ar(r.head.notes.length, NOTES)}</span></td></tr>
          ) : (
            <tr key={j}><td>{r.note.note}</td><td style={{ fontSize: 10.5 }}>{r.note.who ?? "—"}</td><td className="c num">{day(r.note.on)}</td>
              <td className="c">{r.note.rating === 1 ? "👍" : r.note.rating === -1 ? "👎" : "—"}</td></tr>
          ))}</tbody>
        </table>
      </Page>
    )),

    ...tPages.map((list, i) => (
      <Page key={`t${i}`} {...common} page={++pg} sec={i ? null : { no: ++sec, title: "ما استخدمه كل معلم", sub: "البطاقات التي نفّذها كل معلم وعدد مراتها" }}>
        <table className="mr-table">
          <thead><tr><th>البطاقة</th><th style={{ width: 110 }}>النوع</th><th className="c" style={{ width: 50 }}>المرات</th><th className="c" style={{ width: 80 }}>آخر استخدام</th></tr></thead>
          <tbody>{list.map((r, j) => r.head ? (
            <tr key={`h${j}`}><td colSpan={4} style={{ background: "var(--mr-tint)", fontWeight: 700, color: "var(--mr-deep)" }}>
              {r.head.name ?? "—"} <span style={{ fontWeight: 500, fontSize: 10.5, color: "var(--mr-ink2)" }}>· {ar(r.head.cards.length, CARDS)} · {ar(r.head.cards.reduce((a, x) => a + x.n, 0), TIMES)}</span></td></tr>
          ) : (
            <tr key={j}><td>{r.card.title}</td><td style={{ fontSize: 10.5 }}>{KIND[r.card.kind] ?? r.card.kind}</td>
              <td className="c num">{r.card.n}</td><td className="c num">{day(r.card.last_on)}</td></tr>
          ))}</tbody>
        </table>
      </Page>
    )),

    <Page key="end" {...common} page={++pg} sec={{ no: ++sec, title: "التوصيات والاعتماد", sub: "ملاحظات وكيل الشؤون التعليمية، وتوقيعه وتوقيع المدير" }}>
      <Box icon="pen" title="ملاحظات وكيل الشؤون التعليمية وتوصياته" tint style={{ minHeight: 220, maxHeight: 420, overflow: "hidden" }}>
        {notes?.trim() ? <div className="mr-notes">{notes.trim()}</div> : <div className="mr-lines">{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} />)}</div>}
      </Box>
      <Signs stamp={sigs.stamp} people={[{ title: "وكيل الشؤون التعليمية", name: info.deputy, sig: sigs.deputy }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
    </Page>,
  ];
}
