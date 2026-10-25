// src/pages/achievement/AchievementCenter.jsx
/* =====================================================================
   مركز تحليل النتائج (src/lib/achievement.js): تحليل «إشعار الفترة» على درجات الاختبارات
   وحدها، بلوحة ورسوم، وفحوصات جماعية آلية في صفحة «الملاحظات»، وقوائم الطلاب.
   • وكيل الشؤون التعليمية والمدير والدعم الفني ووكيل شؤون الطلاب: المدرسة كلها.
   • الموجه الطلابي: صفه وحده (counselor_N للصف N).
   ===================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { cmpAr } from "../../lib/sortAr.js";
import { fmtDateTime } from "../../lib/dates";
import Loader from "../../components/Loader.jsx";
import {
  loadNoticeKeys, loadAchievement, noticeTitle, termName, periodOf, PERIODS, stats, groupBy, studentSummaries, runChecks, weakTeachers,
  SEV, WEAK, bandOf, ACH_ALL, useAchMember,
} from "../../lib/achievement";
import { supabase } from "../../lib/supabase";
import { buildFormRows, syncForms, setupMsg as formsSetup, isSetupErr } from "../../lib/achForms";
import { FormsTab, DeputyReport } from "./FormsTab.jsx";
import { DistStrip, HBars, Histogram, Heat, Stat, pctTxt, useTip as useTipLocal } from "./Charts.jsx";


const TABS = [
  { k: "dash", t: "لوحة التحليل" },
  { k: "notes", t: "الملاحظات" },
  { k: "students", t: "الطلاب" },
  { k: "forms", t: "النماذج والخطط" },
  { k: "report", t: "تقرير الوكيل" },
];

const chip = (on) => `rounded-pill px-3 py-1.5 text-xs font-semibold transition ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function AchievementCenter() {
  const { adminRoles = [], profile } = useSession();
  const member = useAchMember(profile?.id);     // أعضاء لجنة التحصيل: المدرسة كلها للاطلاع
  const seesAll = member || adminRoles.some((r) => ACH_ALL.includes(r));
  const canSync = adminRoles.some((r) => ["principal", "deputy_academic", "tech_support", "counselor_1", "counselor_2", "counselor_3"].includes(r));
  const myGrades = [1, 2, 3].filter((g) => seesAll || adminRoles.includes(`counselor_${g}`));
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.k === params.get("tab")) ? params.get("tab") : "dash";
  const setTab = (k) => setParams((p) => { p.set("tab", k); return p; }, { replace: true });

  const [keys, setKeys] = useState(null);
  const [year, setYear] = useState("");
  const [key, setKey] = useState("");
  const cache = useRef(new Map());              // بيانات كل إشعار حُمّل: للمقارنة بين الفترات
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [grade, setGrade] = useState(0);        // 0 = كل الصفوف المتاحة
  const [subject, setSubject] = useState("");

  useEffect(() => {
    loadNoticeKeys().then(({ year: y, keys: k }) => { setYear(y); setKeys(k); setKey(k[0]?.key ?? ""); })
      .catch((e) => { setErr(e.message); setKeys([]); });
  }, []);
  useEffect(() => {
    if (!key) return;
    setData(null);
    const load = (k) => cache.current.get(k) ?? cache.current.set(k, loadAchievement(year, k)).get(k);
    load(key).then(setData).catch((e) => setErr(e.message));
  }, [key, year]);

  // الفصل الدراسي، وأقسامه الرئيسية: الفترة الأولى والثانية والاختبار النهائي
  const term = termName(key);
  const terms = useMemo(() => [...new Set((keys ?? []).map((k) => termName(k.key)))], [keys]);
  const termKeys = useMemo(() => (keys ?? []).filter((k) => termName(k.key) === term), [keys, term]);
  const keyOfPeriod = (p) => termKeys.find((k) => periodOf(k.key) === p);   // الأحدث أولًا
  const others = termKeys.filter((k) => !periodOf(k.key));

  // مقارنة الفترات المرفوعة في الفصل نفسه
  const [trend, setTrend] = useState(null);     // [{ p, recs }]
  useEffect(() => {
    setTrend(null);
    const ks = PERIODS.map((p) => ({ p, k: keyOfPeriod(p.k) })).filter((x) => x.k);
    if (ks.length < 2) return;
    let live = true;
    Promise.all(ks.map(({ p, k }) => (cache.current.get(k.key) ?? cache.current.set(k.key, loadAchievement(year, k.key)).get(k.key))
      .then((d) => ({ p, recs: d.recs }))))
      .then((r) => live && setTrend(r)).catch(() => {});
    return () => { live = false; };
  }, [termKeys, year]);   // eslint-disable-line react-hooks/exhaustive-deps

  // السجلات في نطاق المستخدم والمرشّحات
  const scoped = useMemo(() => (data?.recs ?? []).filter((r) => myGrades.includes(r.grade)), [data, myGrades.join()]);  // eslint-disable-line react-hooks/exhaustive-deps
  const recs = useMemo(() => scoped.filter((r) => (!grade || r.grade === grade) && (!subject || r.subject === subject)), [scoped, grade, subject]);
  const subjects = useMemo(() => [...new Set(scoped.filter((r) => !grade || r.grade === grade).map((r) => r.subject))].sort(cmpAr), [scoped, grade]);
  const checks = useMemo(() => (data ? runChecks(scoped, data.teacherOf, data.classSize) : []), [scoped, data]);

  // نماذج ملاحظة التحصيل: تُنشأ مسوداتها آليًا من التحليل عند الفتح، ثم تُقرأ
  const [forms, setForms] = useState(null);
  const [formsErr, setFormsErr] = useState("");
  useEffect(() => {
    if (!data || !key) return;
    let live = true;
    setForms(null); setFormsErr("");
    (async () => {
      if (canSync && periodOf(key)) await syncForms(year, key, buildFormRows(scoped, checks)).catch((e) => { if (isSetupErr(e)) setFormsErr(formsSetup); });
      const { data: fs, error } = await supabase.from("ach_forms").select("*").eq("academic_year", year).eq("report_key", key);
      if (!live) return;
      if (error) { setFormsErr(isSetupErr(error) ? formsSetup : error.message); setForms([]); return; }
      setForms(fs ?? []);
    })();
    return () => { live = false; };
  }, [data]);   // eslint-disable-line react-hooks/exhaustive-deps
  const shownForms = useMemo(() => forms?.filter((f) => (!grade || f.grade === grade) && (!subject || f.subject === subject)), [forms, grade, subject]);
  // الصفوف التي رُفع لها الإشعار، والتي لم يُرفع لها بعد
  const dataGrades = useMemo(() => myGrades.filter((g) => scoped.some((r) => r.grade === g)), [scoped, myGrades.join()]);  // eslint-disable-line react-hooks/exhaustive-deps
  const missingGrades = data ? myGrades.filter((g) => !dataGrades.includes(g)) : [];
  const shownChecks = useMemo(() => checks.filter((c) => (!grade || c.grade === grade) && (!subject || !c.subject || c.subject === subject)), [checks, grade, subject]);

  if (!myGrades.length) return <p className="card px-4 py-6 text-sm text-muted">مركز تحليل النتائج لوكيل الشؤون التعليمية والموجهين الطلابيين ووكيل شؤون الطلاب ومدير المدرسة.</p>;
  if (!keys) return <Loader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">مركز تحليل النتائج</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          تحليل نتائج الطلاب من «إشعار الفترة» المنشور في «نتائج الطلاب»، على <b className="text-ink">درجات الاختبارات وحدها</b> دون
          المهام الأدائية والمشاركة، مع فحوصات جماعية آلية ترصد مواضع الخلل.
          {!seesAll && <> يظهر لك {myGrades.map((g) => GRADE_NAMES[g]).join(" و")}.</>}
        </p>
      </div>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {keys.length === 0 && !err && (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          لا إشعارات فترة منشورة في العام الحالي. ارفعها أولًا من «نتائج الطلاب ← إشعار الفترة».
        </div>
      )}

      {keys.length > 0 && (
        <>
          {/* المرشّحات في صف واحد أعلى الرسوم */}
          <div className="card flex flex-wrap items-center gap-2 p-3">
            {terms.length > 1 && (
              <select className="field w-auto text-sm" value={term}
                      onChange={(e) => setKey(keys.find((k) => termName(k.key) === e.target.value)?.key ?? "")}>
                {terms.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {dataGrades.length > 1 && (
              <select className="field w-auto text-sm" value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setSubject(""); }}>
                <option value={0}>كل الصفوف</option>
                {dataGrades.map((g) => <option key={g} value={g}>{GRADE_NAMES[g]}</option>)}
              </select>
            )}
            <select className="field w-auto text-sm" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">كل المواد</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="ms-auto text-[11px] text-faint">{term} · آخر تحديث: {fmtDateTime(keys.find((k) => k.key === key)?.last)}</span>
          </div>

          {/* الأقسام الرئيسية: الفترة الأولى والثانية والاختبار النهائي */}
          <div className="grid grid-cols-3 gap-2">
            {PERIODS.map((p) => {
              const k = keyOfPeriod(p.k);
              const on = k && k.key === key;
              return (
                <button key={p.k} disabled={!k} onClick={() => k && setKey(k.key)}
                        className={`rounded-card border px-3 py-3 text-start transition ${on ? "border-mint-deep bg-mint-deep text-white shadow-card"
                          : k ? "border-line bg-white hover:border-mint-light" : "cursor-not-allowed border-dashed border-line bg-canvas/60"}`}>
                  <span className={`block text-sm font-bold ${on ? "text-white" : k ? "text-ink" : "text-faint"}`}>{p.t}</span>
                  <span className={`mt-0.5 block text-[11px] ${on ? "text-white/80" : "text-faint"}`}>
                    {k ? `${k.count} طالبًا · ${fmtDateTime(k.last)}` : "لم يُرفع بعد"}
                  </span>
                </button>
              );
            })}
          </div>
          {others.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {others.map((k) => <button key={k.key} onClick={() => setKey(k.key)} className={chip(k.key === key)}>{noticeTitle(k.key)}</button>)}
            </div>
          )}

          {missingGrades.length > 0 && (
            <p className="rounded-sm2 border border-line bg-white px-3 py-2 text-[12.5px] text-muted">
              لم يُرفع إشعار هذه الفترة بعد في <b className="text-ink">{missingGrades.map((g) => GRADE_NAMES[g]).join(" و")}</b>؛
              {dataGrades.length ? " فالتحليل الآن على " + dataGrades.map((g) => GRADE_NAMES[g]).join(" و") + " وحده، ويُضاف غيره تلقائيًا عند رفعه." : " ويظهر التحليل تلقائيًا عند رفعه."}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k)} className={chip(tab === t.k)}>
                {t.t}{t.k === "notes" && shownChecks.length > 0 && <span className="num ms-1.5 opacity-80">({shownChecks.length})</span>}
                {t.k === "forms" && shownForms?.length > 0 && <span className="num ms-1.5 opacity-80">({shownForms.length})</span>}
              </button>
            ))}
          </div>

          {!data ? <Loader /> : tab === "dash" ? <Dashboard recs={recs} checks={shownChecks} classSize={data.classSize}
                                                              trend={trend?.map((t) => ({ ...t, recs: t.recs.filter((r) => myGrades.includes(r.grade) && (!grade || r.grade === grade)) }))} grade={grade} subject={subject}
                                                              onSubject={setSubject} onNotes={() => setTab("notes")} />
            : tab === "notes" ? <Notes checks={shownChecks} />
            : tab === "forms" ? <FormsTab forms={shownForms} err={formsErr} />
            : tab === "report" ? <DeputyReport forms={shownForms} keyName={key} checks={shownChecks} />
            : <Students recs={recs} />}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* لوحة التحليل                                                       */
/* ------------------------------------------------------------------ */
function Dashboard({ recs, checks, classSize, trend, subject, onSubject, onNotes }) {
  const s = useMemo(() => stats(recs), [recs]);
  const studs = useMemo(() => studentSummaries(recs), [recs]);
  const bySubject = useMemo(() => [...groupBy(recs, (r) => r.subject)].map(([k, rs]) => {
    const x = stats(rs); return { key: k, label: k, value: x.avg, tip: `${x.n} درجة · دون ${WEAK}%: ${x.weak}` };
  }).filter((r) => r.value != null).sort((a, b) => a.value - b.value), [recs]);
  const byClass = useMemo(() => [...groupBy(recs, (r) => r.class_id)].map(([k, rs]) => {
    const x = stats(rs); return { key: k, label: `${GRADE_NAMES[rs[0].grade]?.split(" ")[0] ?? ""} ${rs[0].class_no}`, grade: rs[0].grade, class_no: rs[0].class_no, value: x.avg, tip: `${x.n} درجة · دون ${WEAK}%: ${x.weak}` };
  }).filter((r) => r.value != null).sort((a, b) => a.grade - b.grade || a.class_no - b.class_no), [recs]);
  const heat = useMemo(() => {
    const cols = [...new Set(recs.map((r) => r.subject))].sort(cmpAr);
    const g = groupBy(recs, (r) => `${r.class_id}|${r.subject}`);
    const cache = new Map([...g].map(([k, rs]) => [k, stats(rs)]));
    return { cols, get: (row, c) => { const x = cache.get(`${row.key}|${c}`); return x?.n ? x : null; } };
  }, [recs]);
  const crit = checks.filter((c) => c.sev === "critical").length;
  const teachers = useMemo(() => new Set(weakTeachers(checks).map((x) => x.teacher.teacher_id)).size, [checks]);
  const multi = studs.filter((x) => x.weakSubjects.length >= 3).length;

  // اكتمال رصد الاختبارات في كل مادة: من رُصدت درجته من طلاب الفصول المرفوعة
  const coverage = useMemo(() => {
    const classes = [...new Set(recs.map((r) => r.class_id))];
    const total = classes.reduce((t, c) => t + (classSize.get(c) ?? 0), 0);
    return [...groupBy(recs.filter((r) => r.testPct != null), (r) => r.subject)].map(([k, rs]) => {
      const n = new Set(rs.map((r) => r.sid)).size;
      return { key: k, label: k, n, total, value: total ? Math.round((n / total) * 100) : null };
    }).sort((a, b) => a.value - b.value);
  }, [recs, classSize]);
  const partial = coverage.filter((c) => c.value != null && c.value < 90);

  if (!s.n) return <div className="card px-6 py-10 text-center text-sm text-muted">لا درجات اختبارات مرصودة في هذا النطاق بعد.</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="متوسط الاختبارات" value={pctTxt(s.avg)} sub={`الوسيط ${pctTxt(s.median)} · ${s.n} درجة لـ ${studs.length} طالبًا`} />
        <Stat label={`دون ${WEAK}%`} value={pctTxt(s.weakPct)} sub={`${s.weak} درجة · ${multi} طالبًا متعثرًا في 3 مواد فأكثر`} tone={s.weakPct >= 25 ? "bad" : null} />
        <Stat label="ممتاز (90% فأكثر)" value={pctTxt(s.exPct)} sub={`${s.ex} درجة`} />
        <button onClick={onNotes} className="text-start">
          <Stat label="الملاحظات" value={checks.length} sub={`${crit} حرجة · ${teachers} معلمًا بضعف واضح ←`} tone={crit ? "bad" : null} />
        </button>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">توزيع التقديرات في الاختبارات</h2>
        <DistStrip dist={s.dist} n={s.n} />
      </section>

      {partial.length > 0 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-ink">اكتمال رصد الاختبارات</h2>
          <p className="mb-3 text-[11.5px] text-muted">
            نسبة من رُصدت درجة اختباراته من طلاب الفصول المرفوعة · المواد غير المكتملة يتغيّر تحليلها بعد اكتمال الرصد وإعادة رفع الإشعار
          </p>
          <HBars rows={partial.map((c) => ({ ...c, tip: `${c.n} من ${c.total} طالبًا` }))} refLine={70}
                 note="الخط الرأسي: 70% · دونه لا تُفحص الفصول في المادة ويظهر لها «رصد غير مكتمل»" />
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-ink">{subject ? `الفصول في ${subject}` : "متوسط الفصول"}</h2>
          <p className="mb-3 text-[11.5px] text-muted">متوسط درجات الاختبارات لكل فصل</p>
          <HBars rows={byClass} />
        </section>
        <section className="card p-4">
          {subject ? (
            <>
              <h2 className="text-sm font-semibold text-ink">مدرّج نسب {subject}</h2>
              <p className="mb-3 text-[11.5px] text-muted">عدد الطلاب في كل عشر درجات · <button className="font-semibold text-mint-deep" onClick={() => onSubject("")}>كل المواد</button></p>
              <Histogram values={recs.map((r) => r.testPct).filter((v) => v != null)} />
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-ink">متوسط المواد</h2>
              <p className="mb-3 text-[11.5px] text-muted">من الأضعف إلى الأقوى · اضغط مادة لتفصيلها</p>
              <HBars rows={bySubject} onPick={(r) => onSubject(r.key)} />
            </>
          )}
        </section>
      </div>

      {trend?.length > 1 && <PeriodTrend trend={trend} subject={subject} />}

      {!subject && heat.cols.length > 1 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-ink">خريطة الفصول والمواد</h2>
          <p className="mb-3 text-[11.5px] text-muted">متوسط الاختبارات لكل فصل في كل مادة · اضغط الخلية لتفصيل المادة</p>
          <Heat rows={byClass} cols={heat.cols} get={heat.get} onPick={(_, c) => onSubject(c)} />
        </section>
      )}
    </div>
  );
}

/* مقارنة الفترات: متوسط الاختبارات لكل مادة (أو لكل فصل في المادة المختارة) في كل فترة */
function PeriodTrend({ trend, subject }) {
  const [bind, tip] = useTipLocal();
  const keyFn = subject ? (r) => `${GRADE_NAMES[r.grade]?.split(" ")[0] ?? ""} ${r.class_no}` : (r) => r.subject;
  const rows = useMemo(() => {
    const per = trend.map(({ p, recs }) => ({ p, m: new Map([...groupBy(recs.filter((r) => !subject || r.subject === subject), keyFn)].map(([k, rs]) => [k, stats(rs)])) }));
    const labels = [...new Set(per.flatMap((x) => [...x.m.keys()]))].sort(cmpAr);
    return labels.map((l) => ({ l, vals: per.map((x) => ({ p: x.p, s: x.m.get(l) })) }));
  }, [trend, subject]);   // eslint-disable-line react-hooks/exhaustive-deps
  const overall = trend.map(({ p, recs }) => ({ p, s: stats(recs.filter((r) => !subject || r.subject === subject)) }));
  return (
    <section className="card p-4">
      <h2 className="text-sm font-semibold text-ink">تطوّر المتوسط بين الفترات{subject ? ` · ${subject}` : ""}</h2>
      <p className="mb-3 text-[11.5px] text-muted">متوسط درجات الاختبارات في كل فترة مرفوعة من الفصل نفسه</p>
      <div className="mb-4 flex flex-wrap gap-4">
        {overall.map(({ p, s }, i) => (
          <div key={p.k} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-[12.5px] text-muted">{p.t}</span>
            <span className="num text-sm font-bold text-ink">{pctTxt(s.avg)}</span>
            {i > 0 && overall[i - 1].s.avg != null && s.avg != null && (
              <span className={`num text-[11.5px] font-semibold ${s.avg >= overall[i - 1].s.avg ? "text-present" : "text-absent"}`}>
                {s.avg >= overall[i - 1].s.avg ? "▲" : "▼"} {Math.abs(Math.round((s.avg - overall[i - 1].s.avg) * 10) / 10)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        {rows.map(({ l, vals }) => (
          <div key={l} className="grid grid-cols-[minmax(84px,26%)_1fr] items-center gap-2">
            <span className="truncate text-[12.5px] text-ink">{l}</span>
            <div className="space-y-[2px]">
              {vals.map(({ p, s }) => (
                <div key={p.k} className="flex items-center gap-2 outline-none" {...bind(<><b>{l}</b> · {p.t}<br />المتوسط {pctTxt(s?.avg)}{s ? ` · ${s.n} درجة` : ""}</>)}>
                  <span className="relative h-2.5 flex-1 rounded-[4px] bg-canvas">
                    {s?.avg != null && <span className="absolute inset-y-0 start-0 rounded-e-[4px]" style={{ width: `${Math.min(100, s.avg)}%`, background: p.color }} />}
                  </span>
                  <span className="num w-11 text-end text-[11px] text-muted">{s?.avg != null ? `${s.avg}%` : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {tip}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* الملاحظات: نتائج الفحوصات الجماعية                                 */
/* ------------------------------------------------------------------ */
const KIND_T = {
  low_avg: "متوسط متدنٍّ", many_weak: "نسبة ضعف كبيرة", no_top: "لا تقدير مرتفع", gap_peers: "فارق عن الفصول",
  incomplete: "رصد غير مكتمل", low_perf: "المهام الأدائية", perf_gap: "فجوة الأدائية والاختبار", subject_grade: "ضعف المادة في الصف", multi_weak: "تعثر متعدد",
};

function Notes({ checks }) {
  const [sev, setSev] = useState("");
  const [kind, setKind] = useState("");
  const [more, setMore] = useState(false);
  const shown = checks.filter((c) => (!sev || c.sev === sev) && (!kind || c.kind === kind));
  // بطاقة لكل نطاق (فصل ومادة، أو صف ومادة، أو فصل) تجمع ملاحظاته
  const cards = useMemo(() => [...groupBy(shown, (c) => `${c.class_id ?? "g" + c.grade}|${c.subject ?? ""}`).values()]
    .map((cs) => ({ cs: [...cs].sort((a, b) => SEV[a.sev].rank - SEV[b.sev].rank), top: Math.min(...cs.map((c) => SEV[c.sev].rank)) }))
    .sort((a, b) => a.top - b.top || b.cs.length - a.cs.length), [shown]);
  const kinds = Object.keys(KIND_T).filter((k) => checks.some((c) => c.kind === k));
  if (!checks.length) return <div className="card px-6 py-10 text-center text-sm text-muted">لا ملاحظات في هذا النطاق: لم يرصد الفحص خللًا جماعيًا.</div>;
  const list = more ? cards : cards.slice(0, 12);
  return (
    <div className="space-y-3">
      {/* ملخص الفحوصات: كل نوع بعدده، والضغط يرشّح */}
      <div className="card grid grid-cols-2 gap-px overflow-hidden bg-line p-0 sm:grid-cols-4">
        {kinds.map((k) => {
          const cs = checks.filter((c) => c.kind === k);
          return (
            <button key={k} onClick={() => setKind(kind === k ? "" : k)}
                    className={`bg-white px-3 py-2.5 text-start transition hover:bg-canvas ${kind === k ? "!bg-mint-tint" : ""}`}>
              <span className="block text-[11.5px] text-muted">{KIND_T[k]}</span>
              <span className="num text-lg font-bold text-ink">{cs.length}</span>
              {cs.some((c) => c.sev === "critical") && <span className="num ms-1.5 text-[11px] font-semibold" style={{ color: SEV.critical.c }}>● {cs.filter((c) => c.sev === "critical").length} حرجة</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setSev("")} className={chip(!sev)}>الكل ({checks.length})</button>
        {Object.entries(SEV).map(([k, v]) => {
          const n = checks.filter((c) => c.sev === k).length;
          return n > 0 && <button key={k} onClick={() => setSev(k)} className={chip(sev === k)}>{v.t} ({n})</button>;
        })}
        {kind && <button onClick={() => setKind("")} className="ms-auto text-xs font-semibold text-mint-deep">إلغاء ترشيح «{KIND_T[kind]}» ×</button>}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map(({ cs }) => {
          const c0 = cs[0];
          return (
            <article key={c0.id} className="card overflow-hidden">
              <div className="flex items-start gap-2 border-b border-line px-4 py-2.5" style={{ borderInlineStart: `4px solid ${SEV[c0.sev].c}` }}>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-ink">
                    {c0.class_no ? `${GRADE_NAMES[c0.grade]} · فصل ${c0.class_no}` : GRADE_NAMES[c0.grade]}
                    {c0.subject && <> · {c0.subject}</>}
                  </h3>
                  {c0.teachers.length > 0 && <p className="text-[11.5px] text-muted">المعلم: {c0.teachers.map((t) => t.name).join("، ")}</p>}
                </div>
                <span className="num shrink-0 text-[11px] text-faint">{c0.n} طالبًا</span>
              </div>
              <ul className="divide-y divide-line">
                {cs.map((c) => (
                  <li key={c.id} className="px-4 py-2.5">
                    <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <span className="chip text-[10.5px]" style={{ background: SEV[c.sev].bg, color: SEV[c.sev].c }}>
                        {c.sev === "critical" ? "●" : c.sev === "warning" ? "▲" : "◆"} {SEV[c.sev].t}
                      </span>
                      {c.title}
                    </p>
                    <p className="mt-1 text-[12.5px] text-muted">{c.detail}</p>
                    <p className="mt-1 text-[12px] text-muted"><b className="font-semibold text-mint-deep">المقترح:</b> {c.rec}</p>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {cards.length > 12 && (
        <button onClick={() => setMore(!more)} className="w-full rounded-card border border-line bg-white py-2.5 text-sm font-semibold text-mint-deep hover:bg-canvas">
          {more ? "عرض أقل" : `عرض كل البطاقات (${cards.length})`}
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* الطلاب: المتعثرون والمتفوقون                                        */
/* ------------------------------------------------------------------ */
function Students({ recs }) {
  const [view, setView] = useState("weak");
  const [q, setQ] = useState("");
  const all = useMemo(() => studentSummaries(recs), [recs]);
  const list = useMemo(() => {
    const t = q.trim();
    const base = view === "weak"
      ? all.filter((s) => s.weakSubjects.length).sort((a, b) => b.weakSubjects.length - a.weakSubjects.length || a.avg - b.avg)
      : all.filter((s) => s.avg >= 90).sort((a, b) => b.avg - a.avg);
    return t ? base.filter((s) => s.name.includes(t) || (s.nid ?? "").includes(t)) : base;
  }, [all, view, q]);
  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <button onClick={() => setView("weak")} className={chip(view === "weak")}>المتعثرون (دون {WEAK}% في مادة فأكثر)</button>
        <button onClick={() => setView("top")} className={chip(view === "top")}>المتفوقون (90% فأكثر)</button>
        <input className="field !h-8 ms-auto w-48 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهوية" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-canvas text-muted">
            <tr>
              <th className="px-3 py-2 text-start font-medium">م</th>
              <th className="px-3 py-2 text-start font-medium">الطالب</th>
              <th className="px-3 py-2 text-start font-medium">الفصل</th>
              <th className="px-3 py-2 text-center font-medium">متوسط الاختبارات</th>
              <th className="px-3 py-2 text-start font-medium">{view === "weak" ? "مواد الضعف" : "التقدير"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.map((s, i) => (
              <tr key={s.sid}>
                <td className="num px-3 py-2 text-faint">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-ink">{s.name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted">{GRADE_NAMES[s.grade]?.split(" ")[0]} · {s.class_no}</td>
                <td className="num px-3 py-2 text-center font-semibold text-ink">{s.avg}%</td>
                <td className="px-3 py-2">
                  {view === "weak" ? (
                    <span className="flex flex-wrap gap-1">
                      {s.weakSubjects.map((w) => (
                        <span key={w.subject} className="chip bg-absent/10 text-[11px] text-absent">{w.subject} <span className="num">{w.pct}%</span></span>
                      ))}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: bandOf(s.avg)?.color }} />{bandOf(s.avg)?.t}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">لا طلاب.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

