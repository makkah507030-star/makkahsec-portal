import { useEffect, useRef, useState } from "react";
import "./dfile.css";
import { fmtDate } from "../../lib/dates.js";
import {
  BANDS, BAND_COLOR, ELEMENTS, MADRASATI, actTotal, MODE_COLOR, MODE_LABEL, MODE_ORDER, PARTS, PERIOD_LABEL, RATING_LABEL,
  OPINION_ROLE, avgGain, subjectsOf, experience, hours, openDoc, pc, pct, pickedSentences, weekWord,
} from "../../lib/dfile.js";

/* =====================================================================
   تقرير ملف المعلم الرقمي — بتصميم العيّنة docs/teacher-digital-file/prototype.html.
   يُبنى من dfile_data وإعدادات المعلم، ويُخفي بصمت ما لا بيانات له.
   ===================================================================== */

const ICON = {
  win: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z",
  up: "M3 17l6-6 4 4 8-8M15 7h6v6",
  ok: "M20 6 9 17l-5-5",
  users: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  chev: "M6 9l6 6 6-6",
  medal: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4",
  file: "M14 3H6v18h12V7ZM14 3v4h4M9 13h6M9 17h4",
};
const Svg = ({ d, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d={d} />
  </svg>
);

/* «3 أنشطة صفية» و«11 نشاطًا صفيًا» */
const actWord = (n, k) => {
  const c = k === "class";
  if (n >= 3 && n <= 10) return c ? "أنشطة صفية" : "أنشطة لاصفية";
  if (n <= 2) return c ? "نشاط صفي" : "نشاط لاصفي";
  return c ? "نشاطًا صفيًا" : "نشاطًا لاصفيًا";
};

/* «3 شواهد» و«11 شاهدًا» */
const evLabel = (n) => `${n} ${n >= 3 && n <= 10 ? "شواهد" : "شاهدًا"}`;

const Src = ({ k = "auto", children }) => <span className={`df-src df-${k}`}>{children}</span>;

function CardH({ title, sub, src, srcKind }) {
  return (
    <div className="df-card-h">
      <div><h3>{title}</h3>{sub && <p className="df-sub">{sub}</p>}</div>
      {src && <Src k={srcKind}>{src}</Src>}
    </div>
  );
}

function Section({ id, title, sub, children }) {
  return (
    <section className="df-sec" id={`df-${id}`}>
      <div className="df-sec-h"><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {children}
    </section>
  );
}

function Fold({ id, title, line, open, onToggle, children }) {
  return (
    <section className="df-sec" id={`df-${id}`}>
      <details className="df-card df-fold" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
        <summary>
          <div className="df-fold-h">
            <div>
              <h2 className="df-fold-t">{title}</h2>
              <p className="df-sub">{line}</p>
              <p className="df-fold-note">الشواهد تُجمع طوال العام حتى موعد تقييم الأداء الوظيفي النهائي.</p>
              <span className="df-fold-cta">{open ? "إخفاء" : "عرض"}</span>
            </div>
            <span className="df-chev"><Svg d={ICON.chev} strokeWidth="2" /></span>
          </div>
        </summary>
        {children}
      </details>
    </section>
  );
}

/* شريط موزّع بالألوان والعدد أو النسبة تحت كل لون */
function Dist({ parts }) {
  const shown = parts.filter((p) => p.n > 0);
  return (
    <div className="df-dist">
      {shown.map((p) => (
        <span key={p.k} style={{ flex: p.n, "--c": p.c }}><i /><small className="df-num">{p.label}</small></span>
      ))}
    </div>
  );
}

function Hero({ d, s, code }) {
  const exp = experience(s, d.year);
  const rate = s?.perf_rating ? Number(s.perf_rating) : null;
  const classes = d.classes?.length ?? 0;
  return (
    <header className="df-hero">
      <div className="df-hero-top">
        <div>
          <p className="df-eyebrow">مدرسة مكة الثانوية، ملف المعلم الرقمي، {d.year}هـ</p>
          <h1>أ. {d.name}</h1>
          <p className="df-role">
            {[d.spec && `معلم ${d.spec}`, exp != null && `${exp} سنة خبرة`].filter(Boolean).join("، ")}
          </p>
          <div className="df-chips">
            {subjectsOf(d).length > 0 && <span className="df-hchip">{subjectsOf(d).join(" و")}</span>}
            {classes > 0 && <span className="df-hchip df-num">{classes} فصول، {d.students} طالبًا</span>}
            {d.weekly > 0 && <span className="df-hchip df-num">{d.weekly} حصة أسبوعيًا</span>}
            {s?.rank && <span className="df-hchip">{s.rank}</span>}
          </div>
        </div>
        {rate && (
          <div className="df-ring-wrap">
            <div className="df-ring" aria-label={`تقييم الأداء للعام السابق ${rate} من 5`}>
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.16)" strokeWidth="9" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="var(--mint)" strokeWidth="9" strokeLinecap="round"
                        strokeDasharray="263.9" strokeDashoffset={263.9 * (1 - rate / 5)} />
              </svg>
              <div className="df-lbl"><b className="df-num">{rate.toFixed(2)}</b><span>من 5</span></div>
            </div>
            <span className="df-ring-cap">{RATING_LABEL[Math.min(5, Math.max(1, Math.floor(rate)))]}</span>
            {s.perf_year && <span className="df-sub" style={{ color: "var(--hero-soft)", fontSize: 10.5 }}>تقييم أداء {s.perf_year}هـ</span>}
          </div>
        )}
      </div>
      <div className="df-hero-foot">
        <span>يُبنى مباشرة من البوابة</span>
        {code && <span>رمز التحقق <span className="df-code">{code}</span></span>}
      </div>
    </header>
  );
}

function Kpis({ d }) {
  const g = d.grades ?? {};
  const modes = new Set((d.quizzes ?? []).map((q) => q.mode)).size;
  const h = hours(d);
  return (
    <div className="df-kpis">
      <div className="df-kpi"><span className="df-v df-num">{d.lessons}</span><span className="df-l">حصة حضّرها هذا العام</span>
        {d.ontime != null && <span className="df-d">في يومها {pc(d.ontime)}</span>}</div>
      <div className="df-kpi"><span className="df-v df-num">{d.plc}</span><span className="df-l">لقاءات مجتمع التعلم</span>
        {d.plc_led > 0 && <span className="df-d">قدّم منها {d.plc_led}</span>}</div>
      <div className="df-kpi"><span className="df-v df-num">{d.quizzes?.length ?? 0}</span><span className="df-l">اختبارًا وتقويمًا</span>
        {modes > 0 && <span className="df-d">{modes} أنواع تقويم</span>}</div>
      <div className="df-kpi"><span className="df-v df-num">{h}</span><span className="df-l">ساعة تطوير مهني</span>
        <span className="df-d">برامج تدريبية ومؤتمرات</span></div>
      <div className="df-kpi"><span className="df-v df-num">{d.guardian_msgs}</span><span className="df-l">تواصلًا مع أولياء الأمور</span>
        <span className="df-d">إشعارات وصلت أولياء الأمور</span></div>
      {g.n > 0 && (
        <div className="df-kpi df-grades">
          <div className="df-g-top"><span className="df-v df-num">{pc(g.avg)}</span><span className="df-l">متوسط درجات طلابه</span></div>
          <div className="df-g-bar" aria-hidden="true">
            {BANDS.map(([k]) => <i key={k} className={`df-${k}`} style={{ flex: g.bands?.[k] ?? 0 }} />)}
          </div>
          <div className="df-g-chips">
            {BANDS.map(([k, t]) => (
              <span key={k} className={`df-gc df-${k}`}><b className="df-num">{pc(pct(g.bands?.[k] ?? 0, g.n))}</b>{t}</span>
            ))}
          </div>
          <span className="df-d">من {d.quizzes?.length ?? 0} اختبارًا هذا العام، {g.n} طالبًا</span>
        </div>
      )}
    </div>
  );
}

function Results({ g }) {
  const imp = g.improve ?? [];
  const sup = g.support ?? {};
  const gain = avgGain(imp);
  const W = 340, n = imp.length, step = n ? (W - 20) / n : 0;
  return (
    <Section id="results" title="نتائج الطلاب" sub="دون أسماء الطلاب">
      {n > 0 && (
        <div className="df-card">
          <CardH title="تحسّن الطلاب من أول اختبار إلى آخره" sub="متوسط كل فصل من 100، يظهر عند وجود اختبارين فأكثر" src="تلقائي" />
          <div className="df-imp-sum"><span className="df-v df-num">{gain > 0 ? "+" : ""}{gain}</span>
            <span className="df-sub">درجة متوسط التحسّن في فصوله</span></div>
          <svg className="df-chart df-cols" viewBox={`0 0 ${W} 196`} role="img" aria-label="متوسط كل فصل في أول اختبار وآخره">
            <line className="df-axis" x1="6" y1="150" x2={W - 6} y2="150" />
            {imp.map((c, i) => {
              const cx = W - 10 - step * (i + 0.5), hb = c.first * 1.3, ha = c.last * 1.3, dlt = c.last - c.first;
              return (
                <g key={c.label}>
                  <rect className="df-cb" x={cx + 2} y={150 - hb} width="20" height={hb} rx="3" />
                  <rect className="df-ca" x={cx - 22} y={150 - ha} width="20" height={ha} rx="3" />
                  <text className="df-cv" x={cx + 12} y={145 - hb} textAnchor="middle">{c.first}</text>
                  <text className="df-cv df-a" x={cx - 12} y={145 - ha} textAnchor="middle">{c.last}</text>
                  <text className="df-cc" x={cx} y="168" textAnchor="middle">{c.label}</text>
                  <text className="df-cg" x={cx} y="188" textAnchor="middle">{dlt > 0 ? "+" : ""}{dlt}</text>
                </g>
              );
            })}
          </svg>
          <div className="df-keys"><span><i style={{ background: "var(--base)" }} />أول اختبار</span><span><i style={{ background: "var(--deep)" }} />آخر اختبار</span></div>
        </div>
      )}
      <div className="df-grid2">
        {g.classes?.length > 0 && (
          <div className="df-card">
            <CardH title="توزيع التقديرات لكل فصل" sub="متوسط كل طالب في اختبارات الفصل" src="تلقائي" />
            {g.classes.map((c) => {
              const tot = BANDS.reduce((a, [k]) => a + (c.bands?.[k] ?? 0), 0);
              return (
                <div className="df-cls" key={c.label}><span>{c.label}</span>
                  <Dist parts={BANDS.map(([k]) => ({ k, n: c.bands?.[k] ?? 0, c: BAND_COLOR[k], label: pc(pct(c.bands?.[k] ?? 0, tot)) }))} />
                </div>
              );
            })}
            <div className="df-keys">{BANDS.map(([k, t]) => <span key={k}><i style={{ background: BAND_COLOR[k] }} />{t}</span>)}</div>
          </div>
        )}
        {sup.used > 0 && (
          <div className="df-card">
            <CardH title="الدعم العلاجي والإثرائي" sub="من دورة الاختبار، والطالب يُحسب مرة واحدة" src="تلقائي" />
            {sup.need > 0 && <>
              <p className="df-grp">العلاجي: من نزل عن {pc(60)} في اختبار</p>
              <Bar label="شملتهم خطة علاجية" v={sup.planned} of={sup.need} />
              {sup.plans > 0 && <Bar label="الخطط العلاجية المنفّذة" v={sup.plans_done} of={sup.plans} />}
            </>}
            {sup.top > 0 && <>
              <p className="df-grp">الإثرائي: من بلغ {pc(90)} فأكثر</p>
              <Bar label="كُرّم من المتفوقين" v={sup.honored} of={sup.top} />
              {sup.enrich > 0 && <p className="df-sub df-num">الخطط الإثرائية: {sup.enrich}</p>}
            </>}
          </div>
        )}
      </div>
    </Section>
  );
}

function Bar({ label, v, of }) {
  return (
    <div className="df-bar">
      <div className="df-row"><span>{label}</span><span className="df-num">{v} من {of}</span></div>
      <div className="df-track"><div className="df-fill" style={{ width: `${pct(v, of)}%` }} /></div>
    </div>
  );
}

function Assess({ d }) {
  const qs = d.quizzes ?? [];
  const by = (k, f) => qs.filter((q) => q[f] === k).length;
  return (
    <Section id="assess" title="التقويم والاختبارات" sub="من «اختباراتي» في البوابة">
      <div className="df-card">
        <CardH title="تنوّع أساليب التقويم" sub={`${qs.length} اختبارًا هذا العام`} src="تلقائي" />
        <Dist parts={MODE_ORDER.map((m) => ({ k: m, n: by(m, "mode"), c: MODE_COLOR[m], label: String(by(m, "mode")) }))} />
        <div className="df-keys">{MODE_ORDER.filter((m) => by(m, "mode")).map((m) => (
          <span key={m}><i style={{ background: MODE_COLOR[m] }} />{MODE_LABEL[m]}</span>))}</div>
        <div className="df-tiles">{Object.entries(PERIOD_LABEL).map(([k, t]) => (
          <span key={k}><b className="df-num">{by(k, "period")}</b>{t}</span>))}</div>
      </div>
      <div className="df-card">
        <CardH title="اختباراته" sub="العنوان والنوع وعدد الأسئلة، دون نص الأسئلة" src="تلقائي" />
        <ul className="df-qlist">
          {qs.slice(0, 4).map((q, i) => (
            <li key={i}><b>{q.title}</b>
              <span className="df-num">{MODE_LABEL[q.mode] ?? ""}{q.mode !== "external" && q.q > 0 ? `، ${q.q} سؤالًا` : ""}</span></li>
          ))}
        </ul>
        {qs.length > 4 && <p className="df-sub df-num">و{qs.length - 4} اختبارات أخرى</p>}
      </div>
    </Section>
  );
}

function Growth({ d }) {
  const visits = d.visits ?? [];
  return (
    <Section id="growth" title="التطوير المهني والزيارات" sub="ما تعلّمه وما طبّقه">
      <div className="df-grid2">
        <div className="df-card">
          <CardH title="التطوير المهني" sub="هذا العام" src="بوابة + المعلم" srcKind="mix" />
          <div className="df-imp-sum"><span className="df-v df-num">{hours(d)}</span><span className="df-sub">ساعة حضور</span></div>
          <div className="df-tiles df-t2">
            <span><b className="df-num">{d.hours_train} <small>ساعة</small></b>برامج تدريبية</span>
            <span><b className="df-num">{d.hours_conf} <small>ساعة</small></b>مؤتمرات وورش</span>
            <span><b className="df-num">{d.plc}</b>لقاءات مجتمع التعلم</span>
            <span><b className="df-num">{d.xvisits}</b>زيارات تبادلية</span>
          </div>
        </div>
        {visits.length > 0 && (
          <div className="df-card">
            <CardH title="زيارات الدعم" sub="من الإدارة المدرسية، نقاط القوة فقط" src="تلقائي" />
            <ol className="df-tl">
              {visits.map((v, i) => (
                <li key={i}><span className="df-dot" />
                  <div><b>الزيارة {visits.length - i}{v.cls ? `: ${v.cls}` : ""}</b>
                    <p className="df-when df-num">{[v.date && fmtDate(v.date), v.by].filter(Boolean).join("، ")}</p>
                    <div className="df-tags">{(v.strengths ?? "").split(/\n|،|\.(?=\s)/).map((t) => t.trim()).filter(Boolean).slice(0, 4)
                      .map((t) => <span key={t} className="df-tag">{t}</span>)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Section>
  );
}

function Wins({ d, s }) {
  const ev = d.events ?? [], other = s?.other_wins ?? [];
  if (!ev.length && !other.length) return null;
  return (
    <Section id="wins" title="المبادرات والإنجازات" sub="ما صنعه المعلم خارج الحصة">
      {ev.length > 0 && (
        <div className="df-wins">
          {ev.map((e, i) => (
            <div className="df-win" key={i}><span className="df-medal"><Svg d={ICON.medal} /></span>
              <b>{e.title}</b><p className="df-num">{fmtDate(e.date)}</p>{e.n > 0 && <p className="df-num">شارك {e.n} طالبًا</p>}<Src>من الأحداث</Src></div>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <div className="df-card">
          <CardH title="إنجازات أخرى" sub="يكتبها المعلم بنفسه" src="يكتبه المعلم" srcKind="up" />
          <ul className="df-qlist">{other.map((w, i) => <li key={i}><b>{w.t}</b>{w.d && <span>{w.d}</span>}</li>)}</ul>
        </div>
      )}
    </Section>
  );
}

export default function DfileReport({ data: d, settings: s, code }) {
  const hidden = new Set(s?.hidden ?? []);
  const show = (k) => !hidden.has(k);
  const [open, setOpen] = useState({});
  const [cur, setCur] = useState(null);
  const root = useRef(null);
  const brief = pickedSentences(d, s);
  const ev = d.evidence ?? {};
  const evTotal = ELEMENTS.slice(1).reduce((a, [k]) => a + Number(ev[k] ?? 0), 0);
  const evMax = Math.max(1, ...ELEMENTS.map(([k]) => Number(ev[k] ?? 0)));

  // دروس الأسبوع الدراسي الحالي من توزيع المنهج، لكل مادة
  const lessons = d.week ? (s?.distribution?.items ?? [])
    .map((it) => ({ s: it.subject, c: it.classes ?? [], t: (it.weeks ?? []).find((w) => w.n === d.week.n)?.t }))
    .filter((x) => x.t) : [];
  const opinions = d.opinions ?? [];
  const [docErr, setDocErr] = useState("");
  const viewDoc = async (id) => {
    setDocErr("");
    const w = window.open("about:blank", "_blank");   // تُفتح النافذة فور الضغط حتى لا يمنعها المتصفح
    try { const url = await openDoc(code, id); if (w) w.location.replace(url); else window.location.assign(url); }
    catch (e) { if (w) w.close(); setDocErr(e.message); }
  };

  const mad = s?.madrasati ?? {};
  const madOn = MADRASATI.some((m) => Number(mad[m.key]) > 0) || mad.weekly_plan === true;
  const act = s?.activities ?? {};
  const actOn = actTotal(act.class) > 0 || actTotal(act.extra) > 0;

  const has = {
    teach: d.lessons > 0 || d.subs > 0 || madOn || actOn || lessons.length > 0,
    results: (d.grades?.n ?? 0) > 0,
    assess: (d.quizzes?.length ?? 0) > 0,
    growth: true,
    wins: (d.events?.length ?? 0) > 0 || (s?.other_wins?.length ?? 0) > 0,
    elements: true,
    docs: (d.docs?.length ?? 0) > 0,
  };
  const tabs = PARTS.filter((p) => show(p.key) && has[p.key]);

  // التبويب يتتبّع القسم الظاهر
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setCur(e.target.id.slice(3))),
      { rootMargin: "-30% 0px -60% 0px" });
    root.current?.querySelectorAll(".df-sec[id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [d, s]);

  const go = (k) => {
    if (k === "elements" || k === "docs") setOpen((o) => ({ ...o, [k]: true }));
    root.current?.querySelector(`#df-${k}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="dfile" dir="rtl" data-subject={s?.color || "science"} ref={root}>
      <div className="df-wrap">
        <Hero d={d} s={s} code={code} />
        {show("quote") && opinions.length > 0 && (
          <figure className="df-quote" style={{ margin: 0 }}>
            {opinions.map((o, i) => (
              <div key={o.role} className={i ? "df-more" : "df-q1"}>
                <span className={`df-qm${i ? " df-sm" : ""}`} aria-hidden="true">”</span>
                <div>
                  <blockquote>{o.body}</blockquote>
                  <figcaption className="df-by"><span>{o.name ? `${o.name}، ` : ""}{OPINION_ROLE[o.role]}، {fmtDate(o.at)}</span>
                    <span className="df-sig">موقّع إلكترونيًا</span></figcaption>
                </div>
              </div>
            ))}
          </figure>
        )}
        <Kpis d={d} />
        {brief.length > 0 && (
          <aside className="df-brief"><h2>قراءة في 30 ثانية</h2>
            <ul>{brief.map((b) => <li key={b.key}><Svg d={ICON[b.icon]} strokeWidth="2" /><span>{b.t}</span></li>)}</ul>
          </aside>
        )}
        {tabs.length > 0 && (
          <nav className="df-tabs" aria-label="أقسام الملف">
            {tabs.map((t) => <button key={t.key} type="button" className="df-tab" aria-current={cur === t.key} onClick={() => go(t.key)}>{t.t}</button>)}
          </nav>
        )}
        {show("teach") && has.teach && (
          <Section id="teach" title="التخطيط والتدريس" sub="التحضير والمتابعة">
            {lessons.length > 0 && (
              <div className="df-card">
                <CardH title="دروس هذا الأسبوع" src="من توزيع المنهج" srcKind="mix"
                       sub={`الأسبوع ${weekWord(d.week.n)}، من ${fmtDate(d.week.from)} إلى ${fmtDate(d.week.to)}`} />
                <div className="df-lcards">
                  {lessons.map((x) => (
                    <div className="df-lcard" key={x.s}><span className="df-sb">{x.s}</span>
                      {x.c.length > 0 && <small className="df-lcls df-num">الفصول {x.c.join(" و")}</small>}
                      {x.t.split(/،|\n/).map((t) => t.trim()).filter(Boolean).map((t) => <p key={t}>{t}</p>)}</div>
                  ))}
                </div>
              </div>
            )}
            {(d.lessons > 0 || d.subs > 0) && (
              <div className="df-card">
                <CardH title="الحصص والتحضير" sub="التحضير اليومي في البوابة هذا العام" src="تلقائي" />
                <div className="df-tiles">
                  <span><b className="df-num">{d.lessons}</b>حصة حضّرها</span>
                  <span><b className="df-num">{pc(d.ontime ?? 0)}</b>في يومها</span>
                  <span><b className="df-num">{d.subs}</b>حصة انتظار</span>
                </div>
              </div>
            )}
            {madOn && (
              <div className="df-card">
                <CardH title="منصة مدرستي" sub="من إحصاءات المنصة هذا الفصل" src="يكتبه المعلم" srcKind="up" />
                <div className="df-tiles df-t2">
                  {MADRASATI.filter((m) => Number(mad[m.key]) > 0).map((m) => (
                    <span key={m.key}><b className="df-num">{mad[m.key]}</b>{m.t}</span>
                  ))}
                </div>
                {mad.weekly_plan === true && <p className="df-ok"><Svg d={ICON.ok} strokeWidth="2.2" />يرسل الخطة الأسبوعية</p>}
              </div>
            )}
            {actOn && (
              <div className="df-card">
                <CardH title="الأنشطة" sub="الصفية واللاصفية ونوع كل نشاط" src="يكتبه المعلم" srcKind="up" />
                {["class", "extra"].filter((k) => actTotal(act[k]) > 0).map((k) => (
                  <div key={k} className="df-actg">
                    <div className="df-imp-sum"><span className="df-v df-num" style={{ direction: "rtl" }}>{actTotal(act[k])}</span>
                      <span className="df-sub">{actWord(actTotal(act[k]), k)}</span></div>
                    <div className="df-tags">{act[k].filter((x) => Number(x.n) > 0).map((x) => (
                      <span key={x.t} className="df-tag df-num">{x.t}، {x.n}</span>))}</div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}
        {show("results") && has.results && <Results g={d.grades} />}
        {show("assess") && has.assess && <Assess d={d} />}
        {show("growth") && <Growth d={d} />}
        {show("wins") && <Wins d={d} s={s} />}
        {show("elements") && (
          <Fold id="elements" title="عناصر الأداء الوظيفي" open={!!open.elements} onToggle={(v) => setOpen((o) => ({ ...o, elements: v }))}
                line={`${evTotal} شاهدًا في ${ELEMENTS.length - 1} عناصر، والعنصر الأول يقدّره مدير المدرسة`}>
            <div className="df-els">
              {ELEMENTS.map(([k, t], i) => (
                <div className="df-el" key={k}>
                  <span className="df-k" style={{ background: `var(--${k})` }}>{k.slice(1)}</span>
                  <div className="df-t"><p>{t}</p><div className="df-track" style={{ marginTop: 4 }}>
                    <div className="df-fill" style={{ width: `${(100 * Number(ev[k] ?? 0)) / evMax}%`, background: `var(--${k})` }} /></div></div>
                  <span className="df-n df-num">{i === 0 ? "يقدّره المدير" : evLabel(Number(ev[k] ?? 0))}</span>
                </div>
              ))}
            </div>
          </Fold>
        )}
        {show("docs") && has.docs && (
          <Fold id="docs" title="الشواهد من خارج البوابة" line={`${d.docs.length} ملفات رفعها المعلم`}
                open={!!open.docs} onToggle={(v) => setOpen((o) => ({ ...o, docs: v }))}>
            <div className="df-docs">
              {d.docs.map((f) => (
                <button type="button" className="df-doc" key={f.id} onClick={() => viewDoc(f.id)}>
                  <span className="df-ic"><Svg d={ICON.file} /></span><b>{f.title}</b>
                  <span className="df-num">{f.date ? fmtDate(f.date) : f.name ?? ""}</span></button>
              ))}
            </div>
            {docErr && <p className="df-sub" style={{ color: "var(--warn)", marginTop: 8 }}>{docErr}</p>}
          </Fold>
        )}
        <footer className="df-foot">
          <span>صادر من بوابة مكة الثانوية الرقمية، يتحدّث تلقائيًا مع كل عمل جديد للمعلم</span>
          <span>لا يعرض أسماء الطلاب ولا بياناتهم الشخصية</span>
        </footer>
      </div>
    </div>
  );
}
