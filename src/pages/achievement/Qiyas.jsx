// src/pages/achievement/Qiyas.jsx
/* =====================================================================
   مركز تحليل النتائج ← اختبارات قياس: القدرات والتحصيلي وSTEP (supabase/qiyas_results.sql و _2).
   • الرسمي: تقرير يصل المدرسة من المركز ترفعه اللجنة بملف Excel، أو نتيجة طالب واحد (تُعتمد مباشرة،
     وتستبدل ما أدخله الطالب للمحاولة نفسها).
   • اختياريًا: يُدخل الطالب نتيجته من حسابه («نتائج قياس») فتُضاف مباشرة دون تحقق. وقسم «بانتظار
     التحقق» يظهر إن فُعّل التحقق لاحقًا (qiyas_submit بحالة pending).
   • التحليل على المعتمد وحده: أعلى درجة لكل طالب، والمتوسط والتوزيع والفصول، ومن لم يُدخل بعد.
   ===================================================================== */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { cleanIdentity } from "../../lib/importer";
import { useNotice } from "../../lib/useNotice.js";
import { ACH_ALL, useAchMember, stats, groupBy } from "../../lib/achievement";
import Loader from "../../components/Loader.jsx";
import { DistStrip, HBars, Stat, pctTxt } from "./Charts.jsx";

const TESTS = [
  { k: "qudrat", t: "القدرات العامة", d: "اختبار القدرات العامة (اللفظي والكمي)" },
  { k: "tahsili", t: "التحصيلي", d: "الاختبار التحصيلي للتخصصات العلمية" },
  { k: "step", t: "STEP", d: "اختبار كفايات اللغة الإنجليزية" },
];
const SRC = { official: "تقرير المركز", staff: "اللجنة", student: "الطالب" };
const setupMsg = "اختبارات قياس تحتاج تشغيل supabase/qiyas_results.sql في Supabase ← SQL Editor.";
const chip = (on) => `rounded-pill px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

export default function Qiyas() {
  const { profile, adminRoles = [] } = useSession();
  const member = useAchMember(profile?.id);
  const canWrite = member || adminRoles.some((r) => ["principal", "deputy_academic", "tech_support"].includes(r));
  const myGrades = [1, 2, 3].filter((g) => member || adminRoles.some((r) => ACH_ALL.includes(r)) || adminRoles.includes(`counselor_${g}`));
  const [test, setTest] = useState("qudrat");
  const [rows, setRows] = useState(null);
  const [students, setStudents] = useState([]);
  const [year, setYear] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useNotice(null);
  const [upload, setUpload] = useState(false);

  const load = async () => {
    const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
    const y = st?.value ?? "";
    setYear(y);
    const [{ data, error }, { data: vs }] = await Promise.all([
      supabase.from("qiyas_results").select("id, student_id, test, attempt, score, taken_on, status, source, proof_path, reject_reason, created_at").limit(20000),
      supabase.from("v_active_students").select("student_id, full_name, national_id, grade, class_no").eq("academic_year", y).eq("status", "active").limit(5000),
    ]);
    if (error) { setErr(/qiyas_results/.test(error.message) ? setupMsg : error.message); setRows([]); return; }
    setRows(data ?? []); setStudents(vs ?? []);
  };
  useEffect(() => { load(); }, []);

  const stu = useMemo(() => new Map(students.map((s) => [s.student_id, s])), [students]);
  // أعلى درجة لكل طالب في الاختبار المختار، لطلاب الصفوف المتاحة
  const best = useMemo(() => {
    const m = new Map();
    (rows ?? []).filter((r) => r.test === test && r.status === "verified").forEach((r) => {
      const s = stu.get(r.student_id);
      if (!s || !myGrades.includes(s.grade)) return;
      const x = m.get(r.student_id);
      if (!x || Number(r.score) > x.score) m.set(r.student_id, { ...s, score: Number(r.score), attempts: (x?.attempts ?? 0) + 1, attempt: r.attempt, source: r.source });
      else x.attempts++;
    });
    return [...m.values()];
  }, [rows, stu, test, myGrades.join()]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!myGrades.length) return <p className="card px-4 py-6 text-sm text-muted">صفحة اختبارات قياس لوكيل الشؤون التعليمية ولجنة التحصيل والموجهين.</p>;
  if (!rows) return <Loader />;
  const T = TESTS.find((t) => t.k === test);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">اختبارات قياس: القدرات والتحصيلي واختبار STEP</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ترفع اللجنة تقرير المركز الرسمي متى وصل المدرسة، وللطالب اختياريًا إدخال نتيجته من حسابه («نتائج قياس») فتُضاف
          مباشرة. والتحليل بأعلى درجة لكل طالب، ومتوسط الفصول، ومن لم تُسجَّل نتيجته بعد.
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}

      <div className="grid grid-cols-3 gap-2">
        {TESTS.map((t) => {
          const n = new Set((rows ?? []).filter((r) => r.test === t.k && r.status === "verified").map((r) => r.student_id)).size;
          const p = (rows ?? []).filter((r) => r.test === t.k && r.status === "pending").length;
          const on = t.k === test;
          return (
            <button key={t.k} onClick={() => setTest(t.k)}
                    className={`rounded-card border px-3 py-3 text-start transition ${on ? "border-mint-deep bg-mint-deep text-white shadow-card" : "border-line bg-white hover:border-mint-light"}`}>
              <span className={`block text-sm font-bold ${on ? "text-white" : "text-ink"}`}>{t.t}</span>
              <span className={`mt-0.5 block text-[11px] ${on ? "text-white/80" : "text-faint"}`}>{n ? `${n} طالبًا` : "لا نتائج بعد"}{p ? ` · ${p} بانتظار التحقق` : ""}</span>
            </button>
          );
        })}
      </div>

      {canWrite && !err && (
        <div className="flex gap-2">
          <button onClick={() => setUpload(!upload)} className={chip(upload)}>{upload ? "إغلاق" : `رفع تقرير ${T.t} الرسمي أو إدخال نتيجة`}</button>
        </div>
      )}
      {upload && <Upload test={T} year={year} students={students} me={profile?.full_name}
                         onDone={(text) => { setUpload(false); setMsg({ ok: true, text }); load(); }} setMsg={setMsg} />}

      {!err && <Pending rows={(rows ?? []).filter((r) => r.test === test && r.status === "pending" && myGrades.includes(stu.get(r.student_id)?.grade))}
                        stu={stu} canWrite={canWrite} onChange={load} setMsg={setMsg} />}

      {!err && <Analysis best={best} test={T} students={students.filter((s) => myGrades.includes(s.grade))} />}
    </div>
  );
}

/* بانتظار التحقق: ما أدخله الطلاب بإثباته */
function Pending({ rows, stu, canWrite, onChange, setMsg }) {
  const [reason, setReason] = useState({});
  const [busy, setBusy] = useState(null);
  if (!rows.length) return null;
  const proof = async (path) => {
    const { data } = await supabase.storage.from("qiyas-proofs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  const verify = async (r, ok) => {
    setBusy(r.id);
    const { error } = await supabase.rpc("qiyas_verify", { p_id: r.id, p_ok: ok, p_reason: reason[r.id] ?? "" });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    onChange();
  };
  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">بانتظار التحقق <span className="num text-muted">({rows.length})</span></h2>
      <div className="divide-y divide-line">
        {rows.map((r) => {
          const s = stu.get(r.student_id);
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-ink">{s?.full_name} <span className="num text-[12px] font-bold text-mint-deep">· {r.score}</span></span>
                <span className="block text-[11.5px] text-muted">{GRADE_NAMES[s?.grade]?.split(" ")[0]} · {s?.class_no} · {r.attempt}</span>
              </span>
              {r.proof_path ? <button onClick={() => proof(r.proof_path)} className="text-xs font-semibold text-mint-deep">عرض الإثبات</button>
                            : <span className="text-[11px] text-absent">بلا إثبات</span>}
              {canWrite && (
                <>
                  <input className="field !h-8 w-40 text-xs" value={reason[r.id] ?? ""} onChange={(e) => setReason({ ...reason, [r.id]: e.target.value })} placeholder="سبب الرفض" />
                  <button onClick={() => verify(r, true)} disabled={busy === r.id} className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">اعتماد</button>
                  <button onClick={() => verify(r, false)} disabled={busy === r.id} className="rounded-pill border border-line px-3 py-1 text-xs text-absent">رفض</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Analysis({ best, test, students }) {
  const [q, setQ] = useState("");
  const s = useMemo(() => stats(best.map((b) => ({ testPct: b.score }))), [best]);
  const byClass = useMemo(() => [...groupBy(best, (b) => `${b.grade}|${b.class_no}`)].map(([k, bs]) => {
    const [g, c] = k.split("|");
    const x = stats(bs.map((b) => ({ testPct: b.score })));
    return { key: k, g: Number(g), c: Number(c), label: `${GRADE_NAMES[g]?.split(" ")[0] ?? ""} ${c}`, value: x.avg, tip: `${x.n} طالبًا` };
  }).sort((a, b) => a.g - b.g || a.c - b.c), [best]);
  const third = students.filter((x) => x.grade === 3);
  const missing = test.k === "step" ? null : third.filter((x) => !best.some((b) => b.student_id === x.student_id)).length;
  const list = useMemo(() => {
    const t = q.trim();
    const l = [...best].sort((a, b) => b.score - a.score);
    return t ? l.filter((b) => b.full_name.includes(t) || (b.national_id ?? "").includes(t)) : l;
  }, [best, q]);

  if (!best.length) return <div className="card px-6 py-10 text-center text-sm text-muted">لا نتائج {test.t} مسجّلة بعد: ترفعها اللجنة من تقرير المركز، أو يُدخلها الطلاب من «نتائج قياس».</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="متوسط الدرجات" value={s.avg ?? "—"} sub={`الوسيط ${s.median ?? "—"} · من 100`} />
        <Stat label="نتائج مسجّلة" value={s.n} sub={missing != null ? `${missing} من طلاب الثالث لم تُسجَّل لهم نتيجة بعد` : "أعلى درجة لكل طالب"} />
        <Stat label="90 فأكثر" value={pctTxt(s.exPct)} sub={`${s.ex} طالبًا`} />
        <Stat label="أعلى درجة" value={s.max ?? "—"} sub={`أدنى درجة ${s.min ?? "—"}`} />
      </div>
      <section className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">توزيع الدرجات</h2>
        <DistStrip dist={s.dist} n={s.n} />
      </section>
      {byClass.length > 1 && (
        <section className="card p-4">
          <h2 className="text-sm font-semibold text-ink">متوسط الفصول</h2>
          <p className="mb-3 text-[11.5px] text-muted">بأعلى درجة لكل طالب</p>
          <HBars rows={byClass} unit="" note="الخط الرأسي: 60 · البرتقالي دونه" />
        </section>
      )}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <h2 className="text-sm font-semibold text-ink">الطلاب</h2>
          <input className="field !h-8 ms-auto w-48 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهوية" />
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-canvas text-muted"><tr>
              {["م", "الطالب", "الفصل", "أعلى درجة", "المصدر", "المحاولات"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-line">
              {list.map((b, i) => (
                <tr key={b.student_id}>
                  <td className="num px-3 py-1.5 text-faint">{i + 1}</td>
                  <td className="px-3 py-1.5 font-medium text-ink">{b.full_name}</td>
                  <td className="px-3 py-1.5 text-muted">{GRADE_NAMES[b.grade]?.split(" ")[0]} · {b.class_no}</td>
                  <td className="num px-3 py-1.5 font-semibold text-ink">{b.score}</td>
                  <td className="px-3 py-1.5 text-[11.5px] text-muted">{SRC[b.source] ?? "—"}</td>
                  <td className="num px-3 py-1.5 text-muted">{b.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* رفع ملف Excel أو إدخال طالب واحد */
function Upload({ test, year, students, me, onDone, setMsg }) {
  const [sheet, setSheet] = useState(null);      // { head: [...], body: [[...]] }
  const [idCol, setIdCol] = useState(-1);
  const [scoreCol, setScoreCol] = useState(-1);
  const [attempt, setAttempt] = useState("المحاولة الأولى");
  const [busy, setBusy] = useState(false);
  const [one, setOne] = useState({ nid: "", score: "" });
  const byNid = useMemo(() => new Map(students.map((s) => [cleanIdentity(s.national_id), s])), [students]);

  const onFile = async (file) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const all = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
    // صف العناوين: أول صف فيه عمود هوية
    const hi = all.findIndex((r) => r.some((v) => /هوية|السجل|إقامة|اقامة|national|id/i.test(String(v))));
    if (hi < 0) { setMsg({ ok: false, text: "لم أجد عمود رقم الهوية في الملف." }); return; }
    const head = all[hi].map((v) => String(v).trim());
    setSheet({ head, body: all.slice(hi + 1).filter((r) => r.some((v) => String(v).trim())) });
    setIdCol(head.findIndex((v) => /هوية|السجل|إقامة|اقامة|national|id/i.test(v)));
    const sc = [/الموزونة/, /الدرجة|النتيجة|score|المجموع/i];
    setScoreCol(sc.map((re) => head.findIndex((v) => re.test(v))).find((i) => i >= 0) ?? -1);
  };

  const preview = useMemo(() => {
    if (!sheet || idCol < 0 || scoreCol < 0) return null;
    const ok = [], bad = [];
    sheet.body.forEach((r) => {
      const nid = cleanIdentity(r[idCol]);
      const score = Number(String(r[scoreCol]).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.]/g, ""));
      const s = byNid.get(nid);
      if (s && Number.isFinite(score) && score >= 0 && score <= 100 && String(r[scoreCol]).trim() !== "") ok.push({ s, score });
      else bad.push({ nid: nid || String(r[idCol]), why: !s ? "غير مطابق" : "درجة غير صالحة" });
    });
    return { ok, bad };
  }, [sheet, idCol, scoreCol, byNid]);

  const save = async (list, source) => {
    setBusy(true);
    const payload = list.map(({ s, score }) => ({ student_id: s.student_id, test: test.k, attempt: attempt.trim() || "المحاولة الأولى",
      score, academic_year: year, uploader_name: me ?? null, source, status: "verified", reject_reason: null,
      verified_by_name: me ?? null, verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await supabase.from("qiyas_results").upsert(payload.slice(i, i + 500), { onConflict: "student_id,test,attempt" });
      if (error) { setBusy(false); setMsg({ ok: false, text: /qiyas_results/.test(error.message) ? setupMsg : error.message }); return; }
    }
    setBusy(false);
    onDone(`حُفظت نتائج ${test.t} لـ ${payload.length} طالبًا (${attempt}) معتمدة.`);
  };

  const saveOne = () => {
    const s = byNid.get(cleanIdentity(one.nid));
    const score = Number(one.score);
    if (!s) { setMsg({ ok: false, text: "رقم الهوية غير مطابق لطالب في المدرسة." }); return; }
    if (!(score >= 0 && score <= 100)) { setMsg({ ok: false, text: "الدرجة من 0 إلى 100." }); return; }
    save([{ s, score }], "staff");
  };

  return (
    <section className="card space-y-4 p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
        <div>
          <p className="text-sm font-semibold text-ink">تقرير المركز الرسمي ({test.t}) بملف Excel</p>
          <p className="mt-0.5 text-[11.5px] text-muted">متى وصل المدرسة تقرير من المركز: يكفي عمود رقم الهوية وعمود الدرجة. يُعتمد مباشرة، ويستبدل ما أدخله الطالب للمحاولة نفسها.</p>
        </div>
        <label className="text-[11.5px] text-muted">المحاولة أو الفترة<input className="field mt-1 w-full text-sm" value={attempt} onChange={(e) => setAttempt(e.target.value)} /></label>
      </div>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-sm" />
      {sheet && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-[11.5px] text-muted">عمود رقم الهوية
            <select className="field mt-1 w-full text-sm" value={idCol} onChange={(e) => setIdCol(Number(e.target.value))}>
              <option value={-1}>اختر…</option>{sheet.head.map((h, i) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}
            </select></label>
          <label className="text-[11.5px] text-muted">عمود الدرجة
            <select className="field mt-1 w-full text-sm" value={scoreCol} onChange={(e) => setScoreCol(Number(e.target.value))}>
              <option value={-1}>اختر…</option>{sheet.head.map((h, i) => <option key={i} value={i}>{h || `عمود ${i + 1}`}</option>)}
            </select></label>
        </div>
      )}
      {preview && (
        <div className="space-y-2">
          <p className="text-[12.5px] text-ink">مطابق: <b className="num">{preview.ok.length}</b> · غير مطابق أو بلا درجة: <b className="num text-absent">{preview.bad.length}</b></p>
          {preview.bad.length > 0 && <p className="text-[11.5px] text-muted">أمثلة: {preview.bad.slice(0, 6).map((b) => `${b.nid} (${b.why})`).join("، ")}</p>}
          <button onClick={() => save(preview.ok, "official")} disabled={busy || !preview.ok.length}
                  className="rounded-pill bg-mint-deep px-4 py-2 text-xs font-semibold text-white">{busy ? "…" : `حفظ ${preview.ok.length} نتيجة`}</button>
        </div>
      )}
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-[12.5px] font-semibold text-ink">أو إدخال نتيجة طالب واحد (يقدّمها الطالب أو من التقرير)</p>
        <div className="flex flex-wrap gap-2">
          <input className="field num w-44 text-sm" dir="ltr" value={one.nid} onChange={(e) => setOne({ ...one, nid: e.target.value })} placeholder="رقم الهوية" />
          <input className="field num w-28 text-sm" dir="ltr" inputMode="decimal" value={one.score} onChange={(e) => setOne({ ...one, score: e.target.value })} placeholder="الدرجة" />
          <button onClick={saveOne} disabled={busy} className="rounded-pill border border-line bg-white px-4 py-2 text-xs font-semibold text-mint-deep">حفظ</button>
          {one.nid && byNid.get(cleanIdentity(one.nid)) && <span className="self-center text-[12px] text-muted">{byNid.get(cleanIdentity(one.nid)).full_name}</span>}
        </div>
      </div>
    </section>
  );
}

