// src/pages/plc/DeptFileDoc.jsx
import { fmtDate, fmtHijri } from "../../lib/dates";
import { cmpAr } from "../../lib/sortAr.js";
import { PRINCIPAL_NAME } from "../../lib/exportUtils";
import { attendHours } from "../../lib/performance";
import {
  S, n, pct, countAr, paginate, Ring, Bars, Kpis, Highlights, Box, Signs, Page, Cover,
} from "../../components/report/ReportKit.jsx";

/* =====================================================================
   ملف التطوير المهني للقسم بطقم التقارير (components/report): شواهد عنصر
   «التفاعل مع المجتمع المهني» لمعلمي القسم من الدالة dept_pd_file
   (supabase/plc_5_dept_file.sql).
   الغلاف ← إحصائيات القسم ← مصفوفة الاستيفاء ← جلسات مجتمع التعلم (إن كثرت)
   ← النواقص ← سجل مشاركات المعلمين ثم التوقيعات.
   ===================================================================== */

const MISSING_TEXT = { e02_09: "لم يرفع الرخصة المهنية أو لا توجد لديه" };
const CAP = 800;   // ارتفاع محتوى الصفحة الداخلية تقريبًا (px)

/** المعلمون وشواهدهم ومؤشرات القسم */
export function deptModel(rows, items) {
  const teachers = [];
  for (const r of rows) {
    let t = teachers.find((x) => x.id === r.teacher_id);
    if (!t) teachers.push(t = { id: r.teacher_id, name: r.full_name, head: r.is_head, ev: [] });
    if (r.item_key) t.ev.push(r);
  }
  // رئيس القسم أولًا، ثم المعلمون أبجديًا
  teachers.sort((a, b) => (b.head - a.head) || cmpAr(a.name, b.name));
  const of = (t, k) => t.ev.filter((e) => e.item_key === k);
  teachers.forEach((t) => { t.filled = items.filter((i) => of(t, i.key).length).length; });
  const N = teachers.length;
  const evidence = rows.filter((r) => r.item_key);
  const cells = N * items.length;
  const filled = teachers.reduce((a, t) => a + t.filled, 0);
  const perItem = items.map((i) => ({ ...i, done: teachers.filter((t) => of(t, i.key).length).length, count: evidence.filter((r) => r.item_key === i.key).length }));
  return {
    teachers, of, N, perItem, total: evidence.length, filled, cells,
    hours: attendHours(rows),
    coverage: pct(filled, cells) ?? 0,
    head: teachers.find((t) => t.head)?.name ?? "",
    active: teachers.filter((t) => t.ev.length).length,
    complete: teachers.filter((t) => items.length && t.filled === items.length).length,
  };
}

function highlights(m, items, sessions) {
  const out = [];
  if (!m.N) return ["لا معلمين مسجلين في القسم بعد."];
  out.push(`سجّل معلمو القسم في البوابة ${countAr(m.total, "evidence", "g")}${m.hours ? `، وساعات حضور التدريب ${n(m.hours)}` : ""}.`);
  const best = [...m.perItem].sort((a, b) => b.done - a.done)[0];
  if (best?.done) out.push(`أكثر البنود استيفاءً: «${best.title}» (${best.done} من ${m.N}).`);
  const zero = m.perItem.filter((i) => !i.done);
  if (zero.length) out.push(`بنود لم يستوفها أحد بعد: ${zero.length} من ${items.length}، أولها «${zero[0].title}».`);
  const lic = m.perItem.find((i) => i.key === "e02_09");
  if (lic) out.push(`الرخصة المهنية: رفعها ${lic.done} من ${m.N}.`);
  out.push(`معلمون لهم شاهد واحد على الأقل: ${m.active} من ${m.N}${m.complete ? `، ومستوفون لكل البنود: ${m.complete}` : ""}.`);
  out.push(`جلسات مجتمع التعلم المهني المعتمدة للقسم: ${n(sessions.length)}.`);
  return out.slice(0, 6);
}

function SessionsBox({ list, total, cont }) {
  return (
    <Box icon="users" title={cont ? "جلسات مجتمع التعلم المهني (تتمة)" : "جلسات مجتمع التعلم المهني المعتمدة"} aside={n(total)}>
      {total ? (
        <table className="mr-table">
          <thead><tr><th className="c" style={{ width: 110 }}>الرقم</th><th>الموضوع</th><th className="c" style={{ width: 100 }}>التاريخ</th></tr></thead>
          <tbody>{list.map((x) => (
            <tr key={x.serial}><td className="c num" style={{ whiteSpace: "nowrap" }}>{x.serial}</td><td>{x.data?.topic ?? "—"}</td>
              <td className="c num">{x.data?.date ? fmtHijri(x.data.date) : "—"}</td></tr>
          ))}</tbody>
        </table>
      ) : <div className="mr-empty">لا جلسات معتمدة بعد.</div>}
    </Box>
  );
}

/** أوراق الملف بالترتيب — كل ورقة عنصر مستقل */
export function deptFilePages({ rows, items, sessions, deptName, year, theme = "light", sigs = {} }) {
  const m = deptModel(rows, items);
  const doc = { title: "ملف التطوير المهني", meta: [`قسم ${deptName}`, `${year}هـ`], foot: "التطوير المهني" };
  const L = items.length;

  // الجلسات: في صفحة المصفوفة إن اتسعت، وإلا في صفحات خاصة
  const matrixH = 60 + m.N * 22 + 60 + m.N * 27;
  const sessOnMatrix = matrixH + 80 + sessions.length * 26 <= CAP;
  const sessPages = sessOnMatrix ? [] : paginate(sessions, () => 26, CAP - 70);

  // النواقص: بطاقة لكل معلم
  const gaps = m.teachers.map((t) => ({ t, miss: items.filter((i) => !m.of(t, i.key).length) }));
  const gapPages = paginate(gaps, (g) => (g.miss.length ? 44 + Math.ceil(g.miss.length / 3) * 22 : 34), CAP);

  // سجل المشاركات: سطر للمعلم ثم سطر لكل مشاركة، وتبقى مساحة التوقيعات في الأخيرة
  const lines = m.teachers.flatMap((t) => [{ t, head: true }, ...(t.ev.length ? t.ev.map((e) => ({ t, e })) : [{ t, none: true }])]);
  const logPages = paginate(lines, (x) => (x.head ? 62 : x.none ? 22 : 30), CAP, CAP, (x) => x.head);
  const lastUsed = logPages[logPages.length - 1].reduce((a, x) => a + (x.head ? 62 : x.none ? 22 : 30), 0);
  const signsApart = lastUsed + 150 > CAP;

  const total = 3 + sessPages.length + gapPages.length + logPages.length + (signsApart ? 1 : 0);
  let pg = 1;
  const common = { theme, doc, total };
  const signs = (
    <Signs stamp={sigs.stamp} people={[{ title: "رئيس القسم", name: m.head, sig: sigs.head }, { title: "مدير المدرسة", name: PRINCIPAL_NAME, sig: sigs.principal }]} />
  );

  return [
    <Cover key="cover" theme={theme} c={{
      year: `${year}هـ`, tag: ["award", "عنصر «التفاعل مع المجتمع المهني»"], title: "ملف التطوير المهني", sub: `قسم ${deptName}`,
      titleSize: 76, badge: { main: `${year}هـ`, sub: "العام الدراسي" }, side: { main: countAr(m.total, "evidence"), sub: "مسجلة في البوابة لمعلمي القسم" },
      rows: [["user", "رئيس القسم", m.head || "—"], ["users", "معلمو القسم", countAr(m.N, "teacher")],
             ["book", "بنود العنصر", countAr(L, "item")], ["calendar", "تاريخ الإصدار", fmtDate(new Date())]],
      note: ["check", "شواهد المعلمين كما سُجّلت في البوابة، من ملفات الأداء الوظيفي ونماذج التطوير المهني."],
      strip: [[m.N, "معلمو القسم"], [m.total, "الشواهد والمشاركات"], [m.hours, "ساعات حضور التدريب"], [`${m.coverage}%`, "استيفاء البنود"]],
      foot: "التطوير المهني",
    }} />,

    <Page key="stats" {...common} page={++pg} sec={{ no: 1, title: "إحصائيات القسم", sub: "استيفاء بنود العنصر لدى معلمي القسم" }}>
      <Kpis items={[
        { ic: "users", t: "معلمو القسم", v: m.N, s: `لهم شواهد ${m.active}`, c: S[0] },
        { ic: "doc", t: "الشواهد والمشاركات", v: m.total, s: `في ${m.perItem.filter((i) => i.count).length} من ${L} بنود`, c: S[1] },
        { ic: "clock", t: "ساعات حضور التدريب", v: m.hours, s: "حضور البرامج والمؤتمرات", c: S[2] },
        { ic: "chat", t: "جلسات مجتمع التعلم", v: sessions.length, s: "معتمدة للقسم", c: S[3] },
      ]} />
      <Box icon="trophy" title="مؤشرات الإنجاز">
        <div className="mr-rings">
          <Ring value={m.cells ? m.coverage : null} label="استيفاء البنود" sub={`${m.filled} من ${m.cells} خانة`} color={S[0]} />
          <Ring value={pct(m.active, m.N)} label="معلمون لهم شواهد" sub={`${m.active} من ${m.N}`} color={S[1]} />
          <Ring value={pct(m.perItem.filter((i) => i.done).length, L)} label="بنود فيها مشاركة" sub={`${m.perItem.filter((i) => i.done).length} من ${L}`} color={S[2]} />
          <Ring value={pct(m.complete, m.N)} label="مستوفون لكل البنود" sub={`${m.complete} من ${m.N}`} color={S[3]} />
        </div>
      </Box>
      <Box icon="chart" title="استيفاء كل بند" aside="المستوفون من معلمي القسم">
        <div className="mr-bars">
          {m.perItem.map((i) => (
            <div key={i.key} className="mr-bar xwide">
              <span className="t"><b className="num" style={{ color: "var(--mr-ink2)", marginLeft: 5 }}>{i.sort_order}.</b>{i.title}</span>
              <span className="tr"><i style={{ width: `${m.N ? (i.done / m.N) * 100 : 0}%`, opacity: i.done ? 1 : 0 }} /></span>
              <span className="n num">{i.done}/{m.N}</span>
            </div>
          ))}
        </div>
      </Box>
      <Highlights title="خلاصة القسم" items={highlights(m, items, sessions)} />
    </Page>,

    <Page key="matrix" {...common} page={++pg} sec={{ no: 2, title: "مصفوفة الاستيفاء", sub: "عدد الشواهد لكل معلم في كل بند" }}>
      <Box icon="users" title="إنجاز المعلمين" aside={`من ${countAr(L, "item", "g")}`}>
        <Bars items={m.teachers.map((t) => ({ t: `${t.name}${t.head ? " (الرئيس)" : ""}`, v: t.filled, note: `${t.filled}/${L}` }))} max={L} wide />
      </Box>
      <Box icon="grid" title="المصفوفة" aside="الأعمدة أرقام البنود في صفحة الإحصائيات">
        <table className="mr-matrix">
          <thead><tr><th className="nm">المعلم</th>{items.map((i) => <th key={i.key} className="num">{i.sort_order}</th>)}</tr></thead>
          <tbody>{m.teachers.map((t) => (
            <tr key={t.id}><td className="nm">{t.name}</td>
              {items.map((i) => { const c = m.of(t, i.key).length; return <td key={i.key} className={`num ${c ? `ok${c > 1 ? " hi" : ""}` : "no"}`}>{c || "✗"}</td>; })}
            </tr>
          ))}</tbody>
        </table>
      </Box>
      {sessOnMatrix && <SessionsBox list={sessions} total={sessions.length} />}
    </Page>,

    ...sessPages.map((list, i) => (
      <Page key={`sess${i}`} {...common} page={++pg} sec={i ? null : { no: 3, title: "مجتمعات التعلم المهني", sub: "جلسات القسم المعتمدة في العام" }}>
        <SessionsBox list={list} total={sessions.length} cont={i > 0} />
      </Page>
    )),

    ...gapPages.map((list, i) => (
      <Page key={`gap${i}`} {...common} page={++pg} sec={{ no: sessPages.length ? 4 : 3, title: i ? "النواقص (تتمة)" : "النواقص", sub: i ? null : "ما ينقص كل معلم من بنود العنصر" }}>
        <div>
          {list.map(({ t, miss }) => {
            const warn = miss.filter((x) => MISSING_TEXT[x.key]);
            const rest = miss.filter((x) => !MISSING_TEXT[x.key]);
            return (
              <div key={t.id} className="mr-gap" style={{ "--c": miss.length ? "var(--s4)" : "var(--s1)" }}>
                <h4>{t.name}{t.head ? " (الرئيس)" : ""}<span className="aside">{miss.length ? `ينقصه ${miss.length} من ${L}` : "مستوفٍ لكل البنود ✓"}</span></h4>
                {warn.length > 0 && <p className="warn">⚠ {warn.map((x) => MISSING_TEXT[x.key]).join(" · ")}</p>}
                {rest.length > 0 && <ul>{rest.map((x) => <li key={x.key}><b className="num">{x.sort_order}.</b>{x.title}</li>)}</ul>}
              </div>
            );
          })}
        </div>
      </Page>
    )),

    ...logPages.map((list, i) => {
      const last = i === logPages.length - 1;
      // تجميع الأسطر المتتالية لكل معلم في جدول واحد
      const blocks = [];
      list.forEach((x) => {
        if (x.head || !blocks.length || blocks[blocks.length - 1].t !== x.t) blocks.push({ t: x.t, head: !!x.head, rows: [], none: false });
        const b = blocks[blocks.length - 1];
        if (x.e) b.rows.push(x.e); else if (x.none) b.none = true;
      });
      return (
        <Page key={`log${i}`} {...common} page={++pg}
              sec={{ no: (sessPages.length ? 5 : 4), title: i ? "سجل مشاركات المعلمين (تتمة)" : "سجل مشاركات المعلمين", sub: i ? null : "كل شاهد بجهته وتاريخه وساعاته" }}>
          {blocks.map((b, k) => (
            <div key={k}>
              <div className="mr-who"><span className="av">{b.t.name.trim().charAt(0)}</span>{b.t.name}{!b.head && " (تتمة)"}
                <span className="aside">{countAr(b.t.ev.length, "evidence")}</span></div>
              {b.none ? <div className="mr-empty" style={{ padding: "6px" }}>لا شواهد مسجلة في البوابة.</div> : (
                <table className="mr-table">
                  <thead><tr><th className="c" style={{ width: 44 }}>البند</th><th>المشاركة</th><th style={{ width: 130 }}>الجهة</th><th className="c" style={{ width: 86 }}>التاريخ</th><th className="c" style={{ width: 52 }}>الساعات</th></tr></thead>
                  <tbody>{b.rows.map((e, j) => (
                    <tr key={j}><td className="c num">{items.find((x) => x.key === e.item_key)?.sort_order}</td><td>{e.title}</td>
                      <td>{e.provider ?? ""}</td><td className="c num">{e.event_date ? fmtHijri(e.event_date) : ""}</td><td className="c num">{e.hours ?? ""}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          ))}
          {last && !signsApart && signs}
        </Page>
      );
    }),

    ...(signsApart ? [
      <Page key="signs" {...common} page={++pg} sec={{ no: "✓", title: "الاعتماد", sub: "توقيع رئيس القسم ومدير المدرسة" }}>
        <Box icon="check" title="إقرار">
          <p className="mr-notes">أُعدّ هذا الملف من شواهد معلمي قسم {deptName} المسجلة في بوابة مكة الثانوية الرقمية للعام الدراسي {year}هـ.</p>
        </Box>
        {signs}
      </Page>,
    ] : []),
  ];
}

