// src/pages/accreditation/AccMemberFile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { fmtDate } from "../../lib/dates";
import { DOMAINS, DOMAIN_TONE, INDICATORS, EV_STATUS, TOOLS, fmtPct, levelOf, roleT, domainSummary } from "../../lib/accreditation.js";
import "../../components/dfile/dfile.css";
import logo from "../../assets/icon-white.png";

/* =====================================================================
   الملف الرقمي لعضو لجنة التميز بهوية ملفات المعلمين الرقمية (components/dfile/dfile.css):
   بطاقة العضو برمز يفتح ملفه داخل البوابة، وصفته ومجالاته، وأداء مجالاته وإنجاز برامجها،
   وما رفعه من شواهد وما بقي غير مرفوع، وحضوره الاجتماعات. لمشرف اللجنة كل المجالات.
   ===================================================================== */

const toolT = Object.fromEntries(TOOLS.map((t) => [t.key, t.t]));
const evWord = (n) => (n === 1 ? "شاهد" : n === 2 ? "شاهدان" : n >= 3 && n <= 10 ? "شواهد" : "شاهدًا");

export default function AccMemberFile({ m, data, reports, onBack, onReport }) {
  const rep = reports.find((r) => r.kind === "external") ?? reports.find((r) => r.kind === "self");
  const doms = useMemo(() => (m.role === "coordinator" ? [1, 2, 3, 4] : m.domains), [m]);
  const sm = useMemo(() => domainSummary(doms, { ...data, scores: rep?.scores ?? {} }), [doms, data, rep]);
  const per = useMemo(() => doms.map((d) => [d, domainSummary([d], { ...data, scores: rep?.scores ?? {} })]), [doms, data, rep]);
  const mine = data.ev.filter((e) => e.created_by === m.user_id);
  const attended = data.meetings.filter((x) => x.attendees.includes(m.user_id)).length;
  const first = m.full_name.split(" ")[0];
  const tasks = data.meetings.flatMap((x) => x.decisions.filter((d) => d.owner && d.owner.includes(first)).map((d) => ({ ...d, mt: x.title })));
  const tone = m.role === "coordinator" ? "science" : DOMAIN_TONE[doms[0]] ?? "slate";
  const link = `${location.origin}/accreditation?tab=team&file=${m.user_id}`;
  const ring = sm.done;
  const C = 2 * Math.PI * 40;

  return (
    <div className="space-y-3">
      <button className="text-sm font-semibold text-mint-deep" onClick={onBack}>→ العودة إلى اللجنة</button>
      <div className="dfile rounded-card" data-subject={tone} dir="rtl">
        <div className="df-wrap">
          <section className="df-hero">
            <div className="df-hero-top">
              <div>
                <p className="df-eyebrow">لجنة التميز · الملف الرقمي</p>
                <h1>أ. {m.full_name}</h1>
                <p className="df-role">{roleT(m)}{m.title && ` · ${m.title}`}</p>
                <div className="df-chips">{doms.map((d) => <span key={d} className="df-hchip">{DOMAINS[d]}</span>)}</div>
              </div>
              <div className="df-ring-wrap">
                <div className="df-ring">
                  <svg viewBox="0 0 92 92"><circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="8" />
                    <circle cx="46" cy="46" r="40" fill="none" stroke="var(--s-c)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(ring / 100) * C} ${C}`} /></svg>
                  <div className="df-lbl"><b className="df-num">{ring}%</b><span>الإنجاز</span></div>
                </div>
                <span className="df-ring-cap">برامج {m.role === "coordinator" ? "الخطة" : "مجالاته"}</span>
              </div>
            </div>
            <div className="df-hero-foot"><span>{rep ? `النتائج من ${rep.title}` : "لا تقرير بعد"}</span><span>أداء {m.role === "coordinator" ? "المدرسة" : "مجالاته"} <b className="df-num">{fmtPct(sm.perf)}</b> · {levelOf(sm.perf)?.t ?? "—"}</span></div>
          </section>

          <div className="df-kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Kpi v={mine.length} l="شواهد رفعها" d={`المعتمد منها ${mine.filter((e) => e.status === "approved").length}`} />
            <Kpi v={sm.inPlan.length} l={m.role === "coordinator" ? "برامج الخطة" : "برامج مجالاته"} d={`تحققت الأهداف ${sm.met}%`} />
            <Kpi v={sm.gaps.missing.length} l="شواهد غير مرفوعة" d={`من ${sm.gaps.required} مطلوبًا`} />
            <Kpi v={sm.gaps.uploaded} l="شواهد مجالاته" d={`${sm.codes.length} مؤشرًا`} />
            <Kpi v={attended} l="اجتماعات حضرها" d={`من ${data.meetings.length}`} />
            <Kpi v={tasks.length} l="قرارات مسندة إليه" d={`نُفّذ ${tasks.filter((t) => t.done).length}`} />
          </div>

          <div className="df-grid2">
            {per.map(([d, x]) => (
              <section key={d} className="df-card">
                <div className="df-card-h"><h3>{DOMAINS[d]}</h3><span className="df-sub df-num">{fmtPct(x.perf)} · {levelOf(x.perf)?.t ?? "—"}</span></div>
                <Bar t="إنجاز البرامج" v={x.done} note={`${x.inPlan.length} برامج`} />
                <Bar t="تحقق الأهداف" v={x.met} />
                <Bar t="الشواهد المطلوبة المرفوعة" v={x.gaps.required ? Math.round(((x.gaps.required - x.gaps.missing.filter((g) => g.title).length) / x.gaps.required) * 100) : 0}
                  note={`${x.gaps.uploaded} ${evWord(x.gaps.uploaded)}`} />
                <button className="justify-self-start text-[12.5px] font-semibold" style={{ color: "var(--deep)" }} onClick={() => onReport(d)}>تقرير المجال ←</button>
              </section>
            ))}
          </div>

          <section className="df-card">
            <div className="df-card-h"><h3>الشواهد التي رفعها</h3><span className="df-sub df-num">{mine.length}</span></div>
            {mine.length ? <div className="divide-y" style={{ borderColor: "var(--line)" }}>{mine.slice(0, 12).map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-1.5 text-[13px]">
                <span className="df-num font-bold">{e.code}</span><span className="min-w-0 flex-1">{e.title}<span className="block text-[11px]" style={{ color: "var(--faint)" }}>{[toolT[e.tool], fmtDate(e.created_at)].filter(Boolean).join(" · ")}</span></span>
                <span className="df-tag">{EV_STATUS[e.status].t}</span>
              </div>))}</div> : <p className="df-sub">لم يرفع شواهد بعد.</p>}
          </section>

          {sm.gaps.missing.length > 0 && (
            <section className="df-card">
              <div className="df-card-h"><h3>ما بقي من الشواهد</h3><span className="df-sub df-num">{sm.gaps.missing.length}</span></div>
              <div className="df-tags">{sm.gaps.missing.slice(0, 18).map((g, i) => <span key={i} className="df-tag" title={INDICATORS[g.code]}><b className="df-num">{g.code}</b> · {g.title ?? "لا شاهد للمؤشر"}</span>)}</div>
            </section>
          )}

          {tasks.length > 0 && (
            <section className="df-card">
              <div className="df-card-h"><h3>القرارات المسندة إليه</h3></div>
              {tasks.map((t, i) => <p key={i} className="text-[13px]">{t.done ? "✓" : "○"} {t.text} <span className="df-sub">· {t.mt}{t.due && ` · ${fmtDate(t.due)}`}</span></p>)}
            </section>
          )}

          <IdCard m={m} doms={doms} tone={tone} link={link} />
        </div>
      </div>
    </div>
  );
}

function Kpi({ v, l, d }) {
  return <div className="df-kpi"><span className="df-v df-num">{v}</span><span className="df-l">{l}</span>{d && <span className="df-d">{d}</span>}</div>;
}
function Bar({ t, v, note }) {
  return (
    <div className="df-bar">
      <div className="df-row"><span>{t}</span><span className="df-num">{note ? `${note} · ` : ""}{v}%</span></div>
      <div className="df-track"><div className="df-fill" style={{ width: `${v}%` }} /></div>
    </div>
  );
}

/* بطاقة العضو بمقاس الجوال (9:16) تُنزَّل صورة 1080×1920، ورمزها يفتح ملفه داخل البوابة */
function IdCard({ m, doms, tone, link }) {
  const ref = useRef(null);
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 0, width: 600, errorCorrectionLevel: "M", color: { dark: "#1F3A2D", light: "#FFFFFF" } }).then(setQr, () => setQr(null));
  }, [link]);
  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      const url = await toPng(ref.current, { pixelRatio: 1080 / ref.current.offsetWidth, cacheBust: true });
      const a = document.createElement("a"); a.href = url; a.download = `لجنة-التميز-${m.full_name}.png`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { /* يبقى الزر متاحًا لإعادة المحاولة */ }
    setBusy(false);
  };
  return (
    <section className="df-card" style={{ justifyItems: "center" }}>
      <div className="df-card-h" style={{ width: "100%" }}><h3>بطاقة العضو</h3><button className="df-sub font-semibold" style={{ color: "var(--deep)" }} disabled={busy} onClick={download}>{busy ? "…" : "تنزيل البطاقة"}</button></div>
      <div className="df-cardwrap" data-subject={tone}>
        <div className="df-idcard" ref={ref}>
          <div className="df-id-top"><img src={logo} alt="" /><div><b>بوابة مكة الثانوية الرقمية</b><span>لجنة التميز · التقويم والاعتماد المدرسي</span></div></div>
          <div className="df-id-photo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1.2-3.8 4.1-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></svg>
          </div>
          <div className="df-id-name">أ. {m.full_name}</div>
          <div className="df-id-meta"><span className="df-id-rank">{roleT(m)}</span>{m.title && <span>{m.title}</span>}</div>
          <div className="df-id-meta">{doms.map((d) => <span key={d}>{DOMAINS[d]}</span>)}</div>
          <div className="df-id-qr">{qr && <img src={qr} alt={`رمز ملف ${m.full_name}`} />}</div>
          <div className="df-id-foot">امسح الرمز لعرض الملف الرقمي داخل البوابة</div>
        </div>
      </div>
    </section>
  );
}
