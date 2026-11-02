import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useBackStep } from "../../lib/backStep.js";
import { LabDfileReport } from "../../components/dfile/DfileReport.jsx";
import DfileShare from "../../components/dfile/DfileShare.jsx";
import { COLORS, LAB_PARTS, dfileError, loadPublic } from "../../lib/dfile.js";

/* =====================================================================
   لوحة ملف محضر المعمل الرقمي — بنظام لوحة ملف المعلم نفسه (supabase/lab_dfile_*.sql):
   التفعيل مرة واحدة، واللون، والبيانات، والأقسام الظاهرة، والإنجازات، والرابط وبطاقته وسجل
   الزوار، و«معاينة كما يراها الزائر». كل تعديل يُحفظ فورًا.
   ===================================================================== */

const Block = ({ title, sub, children }) => (
  <div className="card space-y-3 p-4">
    <div><h2 className="text-base font-bold text-ink">{title}</h2>{sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}</div>
    {children}
  </div>
);

export default function MyLabDfile() {
  const { session, profile } = useSession();
  const uid = session.user.id;
  const [s, setS] = useState(undefined);       // undefined: يُحمَّل، null: لم يُفعَّل
  const [pub, setPub] = useState(null);        // بيانات الملف كما يراها الزائر
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [preview, setPreview] = useState(false);
  const [win, setWin] = useState({ t: "", d: "" });
  useBackStep(preview, () => setPreview(false), "لوحة الملف");

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("lab_dfiles").select("*").eq("user_id", uid).maybeSingle();
    if (error) { setErr(/lab_dfiles/.test(error.message) ? "ملف المحضر الرقمي يحتاج تشغيل الملفين lab_dfile_1.sql وlab_dfile_2.sql في Supabase." : dfileError(error)); setS(null); return; }
    setS(data ?? null);
    if (data) loadPublic(data.code).then((r) => setPub(r?.status === "ok" ? r : null), () => setPub(null));
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const save = async (patch) => {
    setS((o) => ({ ...o, ...patch }));
    setSaved("");
    const { error } = await supabase.from("lab_dfiles").update(patch).eq("user_id", uid);
    if (error) setErr(dfileError(error)); else { setSaved("حُفظ"); load(); }
  };
  const enable = async () => {
    setErr("");
    const { data, error } = await supabase.from("lab_dfiles").insert({ user_id: uid, code: "-" }).select().single();
    if (error) setErr(dfileError(error)); else { setS(data); load(); }
  };

  const year = parseInt(String(pub?.data?.year ?? "1448").match(/\d{4}/)?.[0] ?? "1448", 10);
  if (s === undefined) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  if (preview && s && pub) {
    return (
      <div className="-mx-4 -my-4 sm:mx-0 sm:my-0">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-canvas/95 px-4 py-2 backdrop-blur">
          <button className="btn-ghost" onClick={() => setPreview(false)}>رجوع إلى اللوحة</button>
          <span className="text-sm text-muted">هكذا يرى الزائر ملفك</span>
        </div>
        <LabDfileReport data={pub.data} settings={{ ...pub.settings, hidden: s.hidden }} code={s.code} />
      </div>
    );
  }

  const head = (
    <div>
      <h1 className="text-lg font-bold text-ink">ملف محضر المعمل الرقمي</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        تقرير تفاعلي عن عملك في معمل الحاسب الآلي يُبنى لحظة فتحه من بيانات البوابة: التشغيل والأجهزة والصيانة والسلامة
        والمعمل الرقمي وعناصر الأداء. تعرضه برمز على مشرف أو لجنة، ولا يعرض أسماء الطلاب. هذه الصفحة تراها أنت وحدك.
      </p>
    </div>
  );

  if (!s) {
    return (
      <div className="space-y-4">
        {head}
        {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
        {!err && (
          <div className="card space-y-3 p-5 text-center">
            <p className="text-sm leading-relaxed text-ink">ملفك غير مفعّل. التفعيل اختياري، وبعده تختار ما يظهر للزائر ولون ملفك.</p>
            <button className="btn-primary" onClick={enable}>فعّل ملفي</button>
          </div>
        )}
      </div>
    );
  }

  const hidden = new Set(s.hidden ?? []);
  const wins = s.other_wins ?? [];
  return (
    <div className="space-y-4">
      {head}
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      {s.disabled_at && <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">أوقف الدعم الفني ملفك. لا يفتحه أحد بالرابط حتى يُعاد تفعيله.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setPreview(true)} disabled={!pub}>معاينة كما يراها الزائر</button>
        <span className="text-xs text-muted">{saved}</span>
      </div>

      <Block title="لون ملفك" sub="الأخضر لون البوابة هو الافتراضي، ويمكنك اختيار غيره.">
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((c) => (
            <button key={c.key} type="button" onClick={() => save({ color: c.key })} aria-pressed={s.color === c.key}
                    className={`grid justify-items-center gap-1 rounded-sm2 border p-2 text-xs ${s.color === c.key ? "border-ink font-bold text-ink ring-1 ring-ink" : "border-line text-muted"}`}>
              <span className="h-6 w-6 rounded-full" style={{ background: c.c }} />{c.t}
            </button>
          ))}
        </div>
      </Block>

      <Block title="بياناتك" sub="تُدخل مرة واحدة، وما تتركه فارغًا لا يظهر.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">سنة التعيين (هجري)</label>
            <select className="field" value={s.appoint_year ?? ""} onChange={(e) => save({ appoint_year: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {Array.from({ length: 45 }, (_, i) => year - i).map((y) => <option key={y} value={y}>{y}هـ</option>)}
            </select></div>
          <div><label className="label">تقييم الأداء الوظيفي للعام السابق (من 5)</label>
            <input className="field num" inputMode="decimal" defaultValue={s.perf_rating ?? ""} placeholder="مثل 4.62"
                   onBlur={(e) => {
                     const v = parseFloat(e.target.value.replace("٫", ".").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)));
                     save({ perf_rating: v >= 1 && v <= 5 ? Math.round(v * 100) / 100 : null, perf_year: v >= 1 && v <= 5 ? year - 1 : null });
                   }} /></div>
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-sm2 border border-line bg-white px-3 py-2 text-sm text-ink">
          <input type="checkbox" className="mt-1 accent-mint-deep" checked={!!s.lab_author} onChange={(e) => save({ lab_author: e.target.checked })} />
          <span>أنا من أعدّ دروس المعمل الرقمي في البوابة
            <span className="block text-[11.5px] text-muted">يعرض قسم «المعمل الرقمي» مكتبة الدروس التفاعلية بمحطاتها وتدريباتها باسمك.</span></span>
        </label>
      </Block>

      <Block title="ماذا يرى الزائر؟" sub="الأقسام غير المختارة لا تظهر في ملفك.">
        <div className="flex flex-wrap gap-2">
          {LAB_PARTS.map((p) => (
            <label key={p.key} className={`chip cursor-pointer gap-1.5 border ${hidden.has(p.key) ? "border-line bg-canvas text-muted line-through" : "border-mint-deep/40 bg-mint-tint text-mint-deep"}`}>
              <input type="checkbox" className="accent-mint-deep" checked={!hidden.has(p.key)}
                     onChange={(e) => save({ hidden: e.target.checked ? [...hidden].filter((k) => k !== p.key) : [...hidden, p.key] })} />
              {p.t}
            </label>
          ))}
        </div>
        {pub && !(pub.data?.docs?.length) && !hidden.has("docs") && (
          <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm leading-relaxed text-warning">
            «الشواهد من خارج البوابة» لا تظهر في ملفك لأنك لم ترفع شاهدًا بملف هذا العام. ارفعها من{" "}
            <Link to="/lab-performance" className="font-semibold underline">شواهد أداء محضر المعمل</Link> ← العنصر ← «رفع شاهد» لتظهر للزائر.
          </p>
        )}
      </Block>

      <Block title="إنجازات أخرى" sub="ما تكتبه هنا يظهر في قسم الإنجازات. اذكر المستوى (المنطقة أو المملكة) إن وُجد.">
        {wins.length > 0 && (
          <ul className="divide-y divide-line/60 rounded-sm2 border border-line/60">
            {wins.map((w, i) => (
              <li key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
                <div className="flex-1"><b className="text-ink">{w.t}</b>{w.d && <p className="text-muted">{w.d}</p>}</div>
                <button className="text-xs text-danger" onClick={() => save({ other_wins: wins.filter((_, j) => j !== i) })}>حذف</button>
              </li>
            ))}
          </ul>
        )}
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
          e.preventDefault();
          if (!win.t.trim()) return;
          save({ other_wins: [...wins, { t: win.t.trim(), ...(win.d.trim() ? { d: win.d.trim() } : {}) }] });
          setWin({ t: "", d: "" });
        }}>
          <input className="field" placeholder="الإنجاز، مثل: تجهيز معمل…" value={win.t} onChange={(e) => setWin({ ...win, t: e.target.value })} />
          <input className="field" placeholder="تفصيل اختياري" value={win.d} onChange={(e) => setWin({ ...win, d: e.target.value })} />
          <button className="btn-primary" type="submit">إضافة</button>
        </form>
      </Block>

      <Block title="رابط ملفك" sub="رابط ثابت طوال العام، وبطاقته بهوية البوابة لتعرضها أو تطبعها.">
        {/* الاسم من الملف العام، وإلا من الحساب (حين يكون الملف مخفيًا عن الزوار أو لم يُحمَّل بعد) */}
        <DfileShare uid={uid} s={s} d={{ ...(pub?.data ?? {}), name: pub?.data?.name || profile?.full_name || "" }} onSave={save} kind="lab" />
      </Block>
    </div>
  );
}
