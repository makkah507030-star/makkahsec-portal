// src/pages/GuardianMobiles.jsx
// متابعة حملة تحديث جوال ولي الأمر (supabase/guardian_mobile.sql): نسبة التأكيد لكل صف وفصل، وقوائم من لم يؤكد
// أو بلا جوال صحيح أو بلا حساب، وتعديل الرقم يدويًا بعد التأكد هاتفيًا، وتعليم ما حُدّث في نور (يدويًا هناك).
// لشؤون الطلاب والكتّاب بالصفوف كلها، وللموجه الطلابي بصفه وحده.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { GRADE_NAMES } from "../lib/schoolTime";
import { useNotice } from "../lib/useNotice.js";
import { friendlyError } from "../lib/friendlyError.js";
import Loader from "../components/Loader.jsx";
import PageIntro from "../components/PageIntro.jsx";

const dmy = (ts) => (ts ? new Date(ts).toLocaleDateString("ar-SA-u-nu-latn-ca-gregory", { day: "numeric", month: "numeric", year: "numeric", timeZone: "Asia/Riyadh" }) : "");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const FILTERS = [
  ["todo", "لم يؤكد", (r) => r.valid && r.has_account && !r.confirmed],
  ["bad", "بلا جوال أو رقم غير صحيح", (r) => !r.valid],
  ["noacc", "بلا حساب في البوابة", (r) => r.valid && !r.has_account],
  ["noor", "عُدّل ولم يُحدَّث في نور", (r) => r.changed_at && !r.noor_updated_at],
  ["ok", "مؤكد", (r) => r.confirmed],
  ["all", "الكل", () => true],
];

export const CAMPAIGN_TEXT = [
  "ولي أمر الطالب الكريم،",
  "حرصًا على وصول رسائل الغياب والتنبيهات إليك بواتساب، نأمل تأكيد رقم جوالك أو تحديثه في بوابة المدرسة:",
  "1. ادخل makkahsec.com بحساب ولي الأمر.",
  "2. ستظهر لك في الرئيسية بطاقة «تأكيد رقم جوالك».",
  "3. اضغط «نعم، رقمي صحيح» أو «تعديل الرقم» واكتب رقمك الجديد.",
  "واحفظ رقم المدرسة في جهات الاتصال لتصلك رسائلها.",
  "شاكرين تعاونكم — مدرسة مكة الثانوية",
].join("\n");

export default function GuardianMobiles() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("todo");
  const [grade, setGrade] = useState(0);
  const [cls, setCls] = useState(0);
  const [editing, setEditing] = useState(null);
  const [val, setVal] = useState("");
  const [msg, setMsg] = useNotice(null);

  const load = async () => {
    const { data, error } = await supabase.rpc("gm_campaign");
    if (error) setMsg({ ok: false, text: /gm_campaign|schema cache|function/i.test(error.message) ? "نفّذ supabase/guardian_mobile.sql في قاعدة البيانات أولًا." : friendlyError(error.message) });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const scoped = useMemo(() => (rows ?? []).filter((r) => (!grade || r.grade === grade) && (!cls || r.class_no === cls)), [rows, grade, cls]);
  const fn = FILTERS.find((f) => f[0] === filter)[2];
  const list = scoped.filter(fn);
  const grades = [...new Set((rows ?? []).map((r) => r.grade))].sort();
  const classes = [...new Set((rows ?? []).filter((r) => !grade || r.grade === grade).map((r) => r.class_no))].sort((a, b) => a - b);
  const byClass = useMemo(() => {
    const m = new Map();
    for (const r of rows ?? []) {
      if (grade && r.grade !== grade) continue;
      const c = m.get(r.class_no) ?? { class_no: r.class_no, grade: r.grade, n: 0, ok: 0, bad: 0 };
      c.n += 1; if (r.confirmed) c.ok += 1; if (!r.valid) c.bad += 1;
      m.set(r.class_no, c);
    }
    return [...m.values()].sort((a, b) => a.class_no - b.class_no);
  }, [rows, grade]);

  const setMobile = async (r) => {
    const { error } = await supabase.rpc("gm_admin_set", { p_guardian: r.guardian_id, p_mobile: val });
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setEditing(null); setVal(""); setMsg({ ok: true, text: "حُفظ الرقم وتأكد. حدّثه في نور يدويًا ثم اضغط «حُدّث في نور»." });
    load();
  };
  const markNoor = async (r) => {
    const { error } = await supabase.rpc("gm_admin_set", { p_guardian: r.guardian_id, p_noor: true });
    if (error) { setMsg({ ok: false, text: friendlyError(error.message) }); return; }
    setRows((rs) => rs.map((x) => (x.guardian_id === r.guardian_id ? { ...x, noor_updated_at: new Date().toISOString() } : x)));
  };
  const copyText = async () => {
    try { await navigator.clipboard.writeText(CAMPAIGN_TEXT); setMsg({ ok: true, text: "نُسخت رسالة الحملة، الصقها في مجموعات الفصول." }); }
    catch { setMsg({ ok: false, text: "تعذّر النسخ، انسخ النص يدويًا." }); }
  };

  const n = scoped.length, ok = scoped.filter((r) => r.confirmed).length;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">حملة تحديث جوال ولي الأمر</h1>
        <PageIntro className="mt-1 text-sm leading-relaxed text-muted">
          يظهر لولي الأمر في رئيسيته طلب تأكيد رقمه أو تعديله مرة كل فصل دراسي. تابع هنا النسب لكل فصل، ومن لم يؤكد،
          ومن بلا جوال صحيح أو بلا حساب. ويمكنك تعديل الرقم بعد التأكد هاتفيًا. الأرقام المعدّلة تُحدَّث في نور يدويًا،
          ثم يُضغط «حُدّث في نور» أمامها.
        </PageIntro>
      </div>

      {rows === null ? <Loader /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["طلاب", n, "text-ink"], ["مؤكد", `${pct(ok, n)}%`, "text-present"], ["لم يؤكد", scoped.filter(FILTERS[0][2]).length, "text-late"],
              ["بلا جوال صحيح", scoped.filter(FILTERS[1][2]).length, "text-absent"], ["ينتظر نور", scoped.filter(FILTERS[3][2]).length, "text-excused"]].map(([t, v, c]) => (
              <div key={t} className="card px-3 py-2.5 text-center"><p className={`num text-xl font-bold ${c}`}>{v}</p><p className="text-xs text-muted">{t}</p></div>
            ))}
          </div>

          <div className="card space-y-3 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {grades.length > 1 && [0, ...grades].map((g) => (
                <button key={g} type="button" onClick={() => { setGrade(g); setCls(0); }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${grade === g ? "bg-mint-deep text-white" : "bg-canvas text-muted"}`}>{g ? GRADE_NAMES[g] : "كل الصفوف"}</button>
              ))}
              <button type="button" className="btn-ghost ms-auto px-3 py-1 text-xs" onClick={copyText}>نسخ رسالة الحملة</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {byClass.map((c) => (
                <button key={c.class_no} type="button" onClick={() => setCls(cls === c.class_no ? 0 : c.class_no)}
                  className={`rounded-lg border px-2 py-1.5 text-center text-xs ${cls === c.class_no ? "border-mint bg-mint/10" : "border-line"}`}>
                  <span className="num block font-bold text-ink">{c.class_no}</span>
                  <span className="num block text-present">{pct(c.ok, c.n)}%</span>
                  <span className="block h-1 overflow-hidden rounded bg-canvas"><span className="block h-full bg-present" style={{ width: `${pct(c.ok, c.n)}%` }} /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([k, t, f]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === k ? "bg-ink text-white" : "bg-canvas text-muted"}`}>
                {t} <span className="num">{scoped.filter(f).length}</span></button>
            ))}
          </div>

          <div className="card divide-y divide-line">
            {!list.length && <p className="px-4 py-6 text-center text-sm text-muted">لا طلاب في هذه القائمة.</p>}
            {list.map((r) => (
              <div key={r.student_id} className="space-y-1.5 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.full_name}</p>
                    <p className="text-xs text-muted">{GRADE_NAMES[r.grade]} · فصل <span className="num">{r.class_no}</span> · ولي الأمر: {r.guardian_name ?? "غير مرتبط"}</p>
                  </div>
                  <span dir="ltr" className={`num text-xs ${r.valid ? "text-ink" : "text-absent"}`}>{r.mobile || "لا جوال"}</span>
                  {r.confirmed ? <span className="rounded-full bg-present/10 px-2 py-0.5 text-xs text-present">مؤكد {dmy(r.confirmed_at)}</span>
                    : !r.has_account && r.guardian_id ? <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs text-warning">بلا حساب</span> : null}
                  {r.guardian_id && <button type="button" className="text-xs text-mint underline" onClick={() => { setEditing(r.student_id); setVal(r.mobile ?? ""); }}>تعديل</button>}
                </div>
                {r.changed_at && (
                  <p className="text-xs text-muted">
                    عُدّل {dmy(r.changed_at)} بواسطة {r.changed_by}{r.mobile_prev ? <> · السابق <span dir="ltr" className="num">{r.mobile_prev}</span></> : null} ·{" "}
                    {r.noor_updated_at ? <span className="text-present">حُدّث في نور {dmy(r.noor_updated_at)}</span>
                      : <button type="button" className="font-semibold text-excused underline" onClick={() => markNoor(r)}>حُدّث في نور</button>}
                  </p>
                )}
                {editing === r.student_id && (
                  <div className="flex flex-wrap gap-2">
                    <input className="field w-44 py-1 text-sm" dir="ltr" inputMode="numeric" placeholder="05xxxxxxxx" value={val} onChange={(e) => setVal(e.target.value)} />
                    <button type="button" className="btn-primary px-4 py-1 text-xs" onClick={() => setMobile(r)}>حفظ بعد التأكد هاتفيًا</button>
                    <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => setEditing(null)}>إلغاء</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
