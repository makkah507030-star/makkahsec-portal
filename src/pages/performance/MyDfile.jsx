import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { useBackStep } from "../../lib/backStep.js";
import DfileReport from "../../components/dfile/DfileReport.jsx";
import DfileShare from "../../components/dfile/DfileShare.jsx";
import DfileDistribution from "../../components/dfile/DfileDistribution.jsx";
import {
  ACTIVITY_LABEL, ACTIVITY_PRESETS, COLORS, MADRASATI, PARTS, RANKS, OPINION_ROLE, actTotal, decideOpinion, dfileError, loadDfile, loadDfileData, loadMyOpinions, sentences,
} from "../../lib/dfile.js";

/* =====================================================================
   لوحة ملف المعلم الرقمي — صفحة مستقلة يراها المعلم وحده.
   التفعيل مرة واحدة، والإيقاف للدعم الفني فقط (نقل أو تقاعد أو عمل إداري).
   كل تعديل يُحفظ فورًا، و«معاينة كما يراها الزائر» تعرض التقرير بإعداداته.
   ===================================================================== */

const Block = ({ title, sub, children }) => (
  <div className="card space-y-3 p-4">
    <div><h2 className="text-base font-bold text-ink">{title}</h2>{sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}</div>
    {children}
  </div>
);

export default function MyDfile() {
  const { session } = useSession();
  const uid = session.user.id;
  const [s, setS] = useState(undefined);       // undefined: يُحمَّل، null: لم يُفعَّل
  const [d, setD] = useState(null);
  const [ops, setOps] = useState([]);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState("");
  const [preview, setPreview] = useState(false);
  const [win, setWin] = useState({ t: "", d: "" });
  const [custom, setCustom] = useState({ class: "", extra: "" });
  useBackStep(preview, () => setPreview(false), "لوحة الملف");

  const load = useCallback(async () => {
    try {
      const [row, data, mine] = await Promise.all([loadDfile(uid), loadDfileData(uid), loadMyOpinions(uid)]);
      setS(row ?? null); setD(data); setOps(mine);
    } catch (e) { setErr(dfileError(e)); setS(null); }
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  const save = async (patch) => {
    setS((o) => ({ ...o, ...patch }));
    setSaved("");
    const { error } = await supabase.from("teacher_dfiles").update(patch).eq("teacher_user_id", uid);
    if (error) setErr(dfileError(error)); else setSaved("حُفظ");
  };

  const enable = async () => {
    setErr("");
    const { data, error } = await supabase.from("teacher_dfiles").insert({ teacher_user_id: uid, code: "-" }).select().single();
    if (error) setErr(dfileError(error)); else setS(data);
  };

  const all = useMemo(() => (d ? sentences(d, s) : []), [d, s]);
  const year = parseInt(String(d?.year ?? "").match(/\d{4}/)?.[0] ?? "1448", 10);

  if (s === undefined) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  if (preview && s && d) {
    return (
      <div className="-mx-4 -my-4 sm:mx-0 sm:my-0">
        <div className="sticky top-0 z-10 flex items-center gap-2 bg-canvas/95 px-4 py-2 backdrop-blur">
          <button className="btn-ghost" onClick={() => setPreview(false)}>رجوع إلى اللوحة</button>
          <span className="text-sm text-muted">هكذا يرى الزائر ملفك</span>
        </div>
        <DfileReport data={d} settings={s} code={s.code} />
      </div>
    );
  }

  const head = (
    <div>
      <h1 className="text-lg font-bold text-ink">ملف المعلم الرقمي</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        تقرير تفاعلي عن أعمالك يُبنى لحظة فتحه من بيانات البوابة، تعرضه برمز على مشرف أو لجنة.
        لا يعرض أسماء الطلاب ولا يقارنك بأي زميل. هذه الصفحة تراها أنت وحدك.
      </p>
    </div>
  );

  if (!s) {
    return (
      <div className="space-y-4">
        {head}
        {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
        <div className="card space-y-3 p-5 text-center">
          <p className="text-sm leading-relaxed text-ink">ملفك غير مفعّل. التفعيل اختياري، وبعده تختار ما يظهر للزائر ولون ملفك.</p>
          <button className="btn-primary" onClick={enable} disabled={!!err && !d}>فعّل ملفي</button>
        </div>
      </div>
    );
  }

  const hidden = new Set(s.hidden ?? []);
  const picked = s.sentences ?? [];
  const wins = s.other_wins ?? [];
  const mad = s.madrasati ?? {};
  const act = s.activities ?? {};
  const num = (v) => {
    const n = parseInt(String(v).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)), 10);
    return n > 0 ? Math.min(n, 9999) : null;
  };
  const setMad = (patch) => save({ madrasati: { ...mad, ...patch, at: new Date().toISOString().slice(0, 10) } });
  const setAct = (k, list) => save({ activities: { ...act, [k]: list } });
  const addAct = (k, t) => {
    const list = act[k] ?? [];
    if (!t.trim() || list.some((x) => x.t === t.trim())) return;
    setAct(k, [...list, { t: t.trim(), n: 1 }]);
  };

  return (
    <div className="space-y-4">
      {head}
      {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-danger">{err}</p>}
      {s.disabled_at && (
        <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">
          أوقف الدعم الفني ملفك{s.disabled_reason ? `: ${s.disabled_reason}` : ""}. لا يفتحه أحد بالرابط حتى يُعاد تفعيله.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setPreview(true)} disabled={!d}>معاينة كما يراها الزائر</button>
        <span className="text-xs text-muted">{saved}</span>
      </div>

      <Block title="لون ملفك" sub="الأخضر لون البوابة هو الافتراضي لكل المعلمين، ويمكنك اختيار غيره.">
        <div className="grid grid-cols-4 gap-2">
          {COLORS.map((c) => (
            <button key={c.key} type="button" onClick={() => save({ color: c.key })} aria-pressed={s.color === c.key}
                    className={`grid justify-items-center gap-1 rounded-sm2 border p-2 text-xs ${s.color === c.key ? "border-ink font-bold text-ink ring-1 ring-ink" : "border-line text-muted"}`}>
              <span className="h-6 w-6 rounded-full" style={{ background: c.c }} />{c.t}
            </button>
          ))}
        </div>
      </Block>

      {ops.length > 0 && (
        <Block title="آراء الإدارة" sub="لا يظهر الرأي للزائر إلا إذا اخترت «إظهار»، ولا يمكنك تعديل نصه. وإذا عدّله كاتبه عاد إليك لتختار.">
          {ops.map((o) => (
            <div key={o.id} className="space-y-2 rounded-sm2 border border-line/60 bg-canvas p-3">
              <p className="text-sm leading-relaxed text-ink">«{o.body}»</p>
              <p className="text-xs text-muted">{[o.author_name, OPINION_ROLE[o.author_role]].filter(Boolean).join("، ")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button className={o.decision === "shown" ? "btn-primary" : "btn-ghost"} onClick={async () => { await decideOpinion(o.id, true); load(); }}>إظهار</button>
                <button className={o.decision === "hidden" ? "btn-primary" : "btn-ghost"} onClick={async () => { await decideOpinion(o.id, false); load(); }}>إخفاء</button>
                <span className="text-xs text-muted">{{ pending: "بانتظار اختيارك", shown: "يظهر للزائر", hidden: "مخفي عن الزائر" }[o.decision]}</span>
              </div>
            </div>
          ))}
        </Block>
      )}

      <Block title="بياناتك" sub="تُدخل مرة واحدة، وما تتركه فارغًا لا يظهر.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">سنة التعيين (هجري)</label>
            <select className="field" value={s.appoint_year ?? ""} onChange={(e) => save({ appoint_year: e.target.value ? Number(e.target.value) : null })}>
              <option value="">—</option>
              {Array.from({ length: 45 }, (_, i) => year - i).map((y) => <option key={y} value={y}>{y}هـ</option>)}
            </select></div>
          <div><label className="label">رتبة المعلم</label>
            <select className="field" value={s.rank ?? ""} onChange={(e) => save({ rank: e.target.value || null })}>
              <option value="">—</option>{RANKS.map((r) => <option key={r}>{r}</option>)}
            </select></div>
          <div><label className="label">تقييم الأداء الوظيفي للعام السابق (من 5)</label>
            <input className="field num" inputMode="decimal" defaultValue={s.perf_rating ?? ""} placeholder="مثل 4.62"
                   onBlur={(e) => {
                     const v = parseFloat(e.target.value.replace("٫", ".").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)));
                     save({ perf_rating: v >= 1 && v <= 5 ? Math.round(v * 100) / 100 : null, perf_year: v >= 1 && v <= 5 ? year - 1 : null });
                   }} /></div>
        </div>
      </Block>

      <Block title="منصة مدرستي" sub="انقل الأرقام من إحصاءاتك في المنصة. ما تتركه فارغًا لا يظهر.">
        <div className="grid grid-cols-2 gap-3">
          {MADRASATI.map((m) => (
            <div key={m.key}><label className="label">{m.t}</label>
              <input className="field num" inputMode="numeric" defaultValue={mad[m.key] ?? ""}
                     onBlur={(e) => { const v = num(e.target.value); if (v !== (mad[m.key] ?? null)) setMad({ [m.key]: v }); }} /></div>
          ))}
        </div>
        <div>
          <p className="label">إرسال الخطة الأسبوعية</p>
          <div className="flex gap-2">
            {[[true, "نعم"], [false, "لا"]].map(([v, t]) => (
              <button key={t} type="button" onClick={() => setMad({ weekly_plan: v })}
                      className={mad.weekly_plan === v ? "btn-primary" : "btn-ghost"}>{t}</button>
            ))}
          </div>
        </div>
      </Block>

      <Block title="الأنشطة" sub="اختر نوع النشاط من البطاقات أو اكتب غيره، ثم اكتب عدده.">
        {["class", "extra"].map((k) => {
          const list = act[k] ?? [];
          return (
            <div key={k} className="space-y-2 border-t border-line/60 pt-3 first:border-0 first:pt-0">
              <p className="text-sm font-bold text-ink">{ACTIVITY_LABEL[k]} <span className="num font-normal text-muted">({actTotal(list)})</span></p>
              {list.length > 0 && (
                <ul className="space-y-1.5">
                  {list.map((x, i) => (
                    <li key={x.t} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-ink">{x.t}</span>
                      <input className="field num w-20 py-1.5 text-center" inputMode="numeric" defaultValue={x.n} aria-label={`عدد ${x.t}`}
                             onBlur={(e) => { const v = num(e.target.value) ?? 0; if (v !== x.n) setAct(k, list.map((y, j) => (j === i ? { ...y, n: v } : y))); }} />
                      <button type="button" className="text-xs text-danger" onClick={() => setAct(k, list.filter((_, j) => j !== i))}>حذف</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_PRESETS[k].filter((t) => !list.some((x) => x.t === t)).map((t) => (
                  <button key={t} type="button" className="chip border border-line bg-canvas text-muted hover:text-ink" onClick={() => addAct(k, t)}>+ {t}</button>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); addAct(k, custom[k]); setCustom({ ...custom, [k]: "" }); }}>
                <input className="field" placeholder="نوع آخر…" value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: e.target.value })} />
                <button className="btn-ghost" type="submit">إضافة</button>
              </form>
            </div>
          );
        })}
      </Block>

      <Block title="ماذا يرى الزائر؟" sub="الأقسام غير المختارة لا تظهر في ملفك.">
        <div className="flex flex-wrap gap-2">
          {PARTS.map((p) => (
            <label key={p.key} className={`chip cursor-pointer gap-1.5 border ${hidden.has(p.key) ? "border-line bg-canvas text-muted line-through" : "border-mint-deep/40 bg-mint-tint text-mint-deep"}`}>
              <input type="checkbox" className="accent-mint-deep" checked={!hidden.has(p.key)}
                     onChange={(e) => save({ hidden: e.target.checked ? [...hidden].filter((k) => k !== p.key) : [...hidden, p.key] })} />
              {p.t}
            </label>
          ))}
        </div>
        {!(d?.quizzes?.length) && (
          <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm leading-relaxed text-warning">
            نتائج طلابك لا تظهر لأنه لا اختبارات لك هذا العام. أضف اختبارك من «اختباراتي» ← «اختبار من خارج البوابة» وارصد درجات طلابك لتظهر.
          </p>
        )}
      </Block>

      <Block title="قراءة في 30 ثانية" sub="اختر 3 جمل تظهر للزائر. تظهر هنا الجمل التي تستحقها بياناتك فقط، وأرقامها تتحدّث تلقائيًا. إن لم تختر تظهر أعلاها أولوية.">
        {all.length === 0 && <p className="text-sm text-muted">لا جمل مستحقة بعد، وتظهر هنا كلما اكتملت بياناتك.</p>}
        <div className="space-y-2">
          {all.map((x) => {
            const on = picked.includes(x.key);
            return (
              <label key={x.key} className={`flex cursor-pointer items-start gap-2 rounded-sm2 border px-3 py-2 text-sm ${on ? "border-mint-deep bg-mint-tint" : "border-line"} ${!on && picked.length >= 3 ? "opacity-50" : ""}`}>
                <input type="checkbox" className="mt-1 accent-mint-deep" checked={on} disabled={!on && picked.length >= 3}
                       onChange={() => save({ sentences: on ? picked.filter((k) => k !== x.key) : [...picked, x.key] })} />
                <span>{x.t}</span>
              </label>
            );
          })}
        </div>
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
          <input className="field" placeholder="الإنجاز، مثل: المركز الأول في مسابقة…" value={win.t} onChange={(e) => setWin({ ...win, t: e.target.value })} />
          <input className="field" placeholder="تفصيل اختياري" value={win.d} onChange={(e) => setWin({ ...win, d: e.target.value })} />
          <button className="btn-primary" type="submit">إضافة</button>
        </form>
      </Block>

      <Block title="توزيع المنهج" sub="ارفع ملف التوزيع لكل مادة مرة واحدة (Excel أو PDF). تقرؤه البوابة أسابيع تراجعها، ويرى الزائر دروس الأسبوع الدراسي الحالي فقط.">
        <DfileDistribution s={s} d={d} onSave={save} />
      </Block>

      <Block title="رابط ملفك" sub="رابط ثابت طوال العام، وبطاقته بهوية البوابة لتعرضها أو تطبعها.">
        <DfileShare uid={uid} s={s} d={d} onSave={save} />
      </Block>
    </div>
  );
}
