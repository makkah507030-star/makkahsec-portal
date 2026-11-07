// يعرض دليل مستخدم بهوية استوديو البوابة (الفاتحة) لطباعته PDF: guide.html?g=teacher
import React from "react";
import ReactDOM from "react-dom/client";
import { PROCS } from "../../../src/pages/Help.jsx";
import { GUIDES } from "./guides.js";
import logo from "../../../src/assets/icon-mint.png";
import "../../../src/fonts.css";
import "./guide.css";

window.__all = PROCS.map((p) => `${p.cat} | ${p.who.join("،")} | ${p.title} | ${p.path}`);
const g = GUIDES[new URLSearchParams(location.search).get("g") ?? "teacher"];
const img = (n) => `/img/${g.shotsOf ?? g.key}/${n}.png`;
const FIRST = "الدخول والحساب";
// إجراءات الفئة وحدها: ما يخص أدوارًا أو عضويات أخرى يُستبعد (skip وskipCats)، ونص الإجراء قد يُكيَّف للفئة (edit)
const list = PROCS.filter((p) => (!g.noBase && p.who.includes("الجميع")) || p.who.some((w) => g.who.includes(w)) || (g.pick ?? []).includes(p.title))
  .filter((p) => !g.onlyCats || g.onlyCats.includes(p.cat))
  .filter((p) => !(g.skipCats ?? []).includes(p.cat) && !(g.skip ?? []).includes(p.title))
  .map((p) => { const e = g.edit?.[p.title]; return e ? { ...p, ...(typeof e === "function" ? e(p) : e) } : p; });
const rank = (c) => { const i = (g.order ?? [FIRST]).indexOf(c); return i < 0 ? 99 : i; };
const cats = [...new Set(list.map((p) => p.cat))].sort((a, b) => rank(a) - rank(b));
const chapters = cats.map((c) => ({ c, items: list.filter((p) => p.cat === c) }));
window.__list = chapters.map((c) => "## " + c.c + "\n" + c.items.map((p) => `# ${p.title} [${p.path}]\n` + p.steps.map((x) => "- " + x).join("\n") + (p.note ? "\nملاحظة: " + p.note : "") + (p.warn ? "\nتنبيه: " + p.warn : "")).join("\n"));
const today = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

function Decor() {
  return (<div className="decor" aria-hidden><i className="lines" /><i className="blob" /><i className="cube a" /><i className="cube b" /></div>);
}

function Proc({ p, n }) {
  const shot = g.shots[p.title];
  return (
    <article className={`proc ${shot ? "has-shot" : ""}`}>
      {shot && <figure className="phone"><img src={img(shot)} /></figure>}
      <header><span className="pn">{n}</span><h3>{p.title}</h3></header>
      {p.path && <p className="path"><b>المسار</b>{p.path}</p>}
      <ol className="steps">{p.steps.map((s, i) => <li key={i}><i>{i + 1}</i><span>{s}</span></li>)}</ol>
      {p.note && <p className="note"><b>ملاحظة</b>{p.note}</p>}
      {p.warn && <p className="warn"><b>تنبيه</b>{p.warn}</p>}
    </article>
  );
}

function Guide() {
  return (
    <>
      <section className="cover">
        <Decor />
        <div className="brand"><img src={logo} /><span><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></span></div>
        <div className="cv-main">
          <div className="cv-text">
            <span className="kicker">{g.kicker ?? "دليل الاستخدام"}</span>
            <h1>{g.title}</h1>
            <p className="lead">{g.lead}</p>
            <ul>{g.points.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <figure className="phone big"><img src={img(g.cover)} /></figure>
        </div>
        <div className="cv-foot"><span>الإصدار الأول · {today}</span><span>makkahsec.com</span></div>
      </section>

      <section className="toc">
        <h2 className="sec">محتويات الدليل</h2>
        <ol>
          {g.start && <li><i>0</i><span>البداية: الرئيسية والقائمة</span></li>}
          {chapters.map((ch, i) => <li key={ch.c}><i>{i + 1}</i><span>{g.cats?.[ch.c] ?? ch.c}</span><small>{ch.items.length} إجراء</small></li>)}
        </ol>
        <div className="howto">
          <b>كيف تقرأ الدليل؟</b>
          <p>كل إجراء في بطاقة: عنوانه، ثم <span className="chip">المسار</span> إليه في القائمة، ثم خطواته مرقّمة، ثم ملاحظة أو تنبيه إن وُجد. والصور من البوابة نفسها ببيانات تجريبية.</p>
          <p>{g.appendix ? `هذا ملحق ${g.appendix}، يُقرأ مع الدليل الأساسي.` : "تجد الدليل نفسه داخل البوابة محدّثًا دائمًا: القائمة ← «دليل الاستخدام»."}</p>
        </div>
      </section>

      {g.start && <section className="chapter">
        <div className="ch-head"><span className="ch-n">0</span><div><small>البداية</small><h2>الرئيسية والقائمة</h2></div></div>
        <div className="start">{g.start.map((s) => (
          <article key={s.t} className="proc has-shot"><figure className="phone"><img src={img(s.shot)} /></figure>
            <header><h3>{s.t}</h3></header><p className="d">{s.d}</p></article>))}</div>
      </section>}

      {chapters.map((ch, i) => (
        <section key={ch.c} className="chapter">
          <div className="ch-head"><span className="ch-n">{i + 1}</span><div><small>القسم {i + 1}</small><h2>{g.cats?.[ch.c] ?? ch.c}</h2></div></div>
          {ch.items.map((p, j) => <Proc key={p.title} p={p} n={`${i + 1}.${j + 1}`} />)}
        </section>
      ))}
    </>
  );
}

g.key = new URLSearchParams(location.search).get("g") ?? "teacher";
// تذييل كل صفحة باسم الدليل
const foot = document.createElement("style");
foot.textContent = `@page { @bottom-center { content: "${g.title} · بوابة مكة الثانوية الرقمية   —   " counter(page); } } @page :first { @bottom-center { content: none; } }`;
document.head.appendChild(foot);
ReactDOM.createRoot(document.getElementById("root")).render(<Guide />);
document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => null)))).then(() => { window.__ready = true; });
