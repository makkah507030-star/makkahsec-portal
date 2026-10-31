// تقسيم المحتوى على صفحات A4 بالقياس: تُرسم الكتل مرة خارج الشاشة بعرض متن الصفحة نفسه، ويُقاس
// ارتفاع كل كتلة وارتفاع المتن المتاح (بعنوان القسم ودونه)، ثم تُوزَّع الكتل فلا تُقص ولا تنقسم.
import { useLayoutEffect, useRef, useState } from "react";
import { Page, Sec } from "../../../src/components/report/ReportKit.jsx";

const GAP = 12;   // فراغ mr-body بين الكتل

/* sections: [{ title, sub, blocks: [عنصر] }]؛ front: صفحات قبلها (الغلاف) وback: بعدها (الاعتماد)،
   كلٌّ دالة (رقم الصفحة، المجموع) ترجع الصفحة. عنوان القسم كتلة في المتن تلتصق بأول كتلة بعده،
   فيبدأ القسم في الصفحة نفسها إن اتسعت لعنوانه وأول كتلة، وإلا في صفحة جديدة. */
export default function Paged({ theme, doc, front = [], sections, back = [], numbering = (i) => i + 1 }) {
  const [plan, setPlan] = useState(null);
  const meas = useRef(null), withSec = useRef(null);

  useLayoutEffect(() => {
    let off = false;
    document.fonts.ready.then(() => {
      if (off) return;
      const bodyA = withSec.current.querySelector(".mr-body");
      meas.current.style.width = `${bodyA.clientWidth}px`;
      const H = bodyA.clientHeight;
      // عناصر متتالية: عنوان القسم ثم كتله؛ لكل منها ارتفاعه
      const items = [];
      sections.forEach((sct, si) => {
        items.push({ si, sec: true, h: meas.current.querySelector(`[data-sec="${si}"]`).offsetHeight + 10 });   // +10 فاصل العنوان وسط الصفحة
        [...meas.current.querySelectorAll(`[data-s="${si}"] > [data-b]`)].forEach((e, bi) => items.push({ si, bi, h: e.offsetHeight }));
      });
      const pages = [];
      let cur = [], used = 0;
      const add = (it) => { used += (cur.length ? GAP : 0) + it.h; cur.push(it); };
      items.forEach((it, k) => {
        // العنوان يحتاج مكانه ومكان أول كتلة بعده
        const need = (cur.length ? GAP : 0) + it.h + (it.sec && items[k + 1] ? GAP + items[k + 1].h : 0);
        if (cur.length && used + need > H) { pages.push(cur); cur = []; used = 0; }
        add(it);
      });
      if (cur.length) pages.push(cur);
      setPlan(pages);
      window.__pages = pages.length + front.length + back.length;
      requestAnimationFrame(() => { window.__ready = true; });
    });
    return () => { off = true; };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) {
    return (
      <div style={{ position: "absolute", left: -20000, top: 0 }}>
        <div ref={withSec}><Page theme={theme} doc={doc} page={1} total={1} /></div>
        <div className={`stu stu-${theme} mr`} style={{ height: "auto", width: "auto" }}>
          <div ref={meas}>
            {sections.map((s, si) => (
              <div key={si}>
                <div data-sec={si}><Sec no={s.no ?? numbering(si)} title={s.title} sub={s.sub} /></div>
                <div data-s={si} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                  {s.blocks.map((b, bi) => <div key={bi} data-b>{b}</div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  const total = front.length + plan.length + back.length;
  let pg = front.length;
  return (
    <div className="pg-sheets">
      {front.map((f, i) => <div key={`f${i}`}>{f(i + 1, total)}</div>)}
      {plan.map((items, i) => {
        pg += 1;
        return (
          <Page key={i} theme={theme} doc={doc} page={pg} total={total}>
            {items.map((it) => {
              const sct = sections[it.si];
              return it.sec ? <div key={`s${it.si}`} className="g-secw"><Sec no={sct.no ?? numbering(it.si)} title={sct.title} sub={sct.sub} /></div>
                : <div key={`${it.si}-${it.bi}`}>{sct.blocks[it.bi]}</div>;
            })}
          </Page>
        );
      })}
      {back.map((f, i) => <div key={`b${i}`}>{f(pg + i + 1, total)}</div>)}
    </div>
  );
}
