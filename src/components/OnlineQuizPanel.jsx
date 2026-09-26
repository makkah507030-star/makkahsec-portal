// src/components/OnlineQuizPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { GRADE_NAMES } from "../lib/schoolTime";

/* =====================================================================
   تبويب «اختبار إلكتروني» في محرّر الاختبار (للمعلم).
   • يختار المعلم الطلاب (فصلًا كاملًا أو بعض طلابه)، وموعد الفتح والإغلاق،
     والمدة، وهل تظهر النتيجة للطالب فور التسليم.
   • «نشر وإرسال» يُسند الاختبار ويُرسل إشعار الجرس والجوال برابط الاختبار
     للطلاب المختارين فقط.
   • بعد النشر: متابعة حيّة لمن بدأ ومن سلّم ودرجته، مع التذكير والإغلاق والتعديل.
   • التسليم يُصحَّح آليًا ويظهر في «التصحيح والدرجات» وكشف الرصد كالورقي.
   ===================================================================== */

const pad = (n) => String(n).padStart(2, "0");
const toLocal = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
};
const nextFive = () => {
  const d = new Date(); d.setSeconds(0, 0);
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 5) * 5);
  return d;
};
const mins = (ms) => Math.max(0, Math.ceil(ms / 60000));

export default function OnlineQuizPanel({ quiz, linked, questionsCount, marksOk, onStatus }) {
  const [online, setOnline] = useState(undefined);   // undefined = تحميل، null = غير منشور
  const [assigns, setAssigns] = useState([]);
  const [subs, setSubs] = useState({});
  const [roster, setRoster] = useState({});          // class_id → [{id, full_name}]
  const [form, setForm] = useState(null);            // عند الإنشاء أو التعديل
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [tick, setTick] = useState(Date.now());

  const classLabel = (cid) => {
    const l = linked.find((x) => x.class_id === cid);
    return l ? `${GRADE_NAMES[l.classes?.grade] ?? ""} — ${l.classes?.class_no}` : "";
  };

  const load = async () => {
    await supabase.rpc("refresh_online_quiz", { p_quiz: quiz.id });   // تسليم من انتهى وقته
    const [{ data: o, error: e1 }, { data: a }, { data: s }] = await Promise.all([
      supabase.from("quiz_online").select("*").eq("quiz_id", quiz.id).maybeSingle(),
      supabase.from("quiz_assignments")
        .select("id, student_id, class_id, started_at, deadline_at, submitted_at, notified_at, students(full_name)")
        .eq("quiz_id", quiz.id),
      supabase.from("quiz_submissions").select("student_id, score, absent").eq("quiz_id", quiz.id),
    ]);
    if (e1) { setMsg({ ok: false, text: `تعذّر التحميل — هل نُفّذ ملف online_quiz.sql؟ (${e1.message})` }); setOnline(null); return; }
    setOnline(o ?? null);
    setAssigns((a ?? []).sort((x, y) => (x.students?.full_name ?? "").localeCompare(y.students?.full_name ?? "", "ar")));
    setSubs(Object.fromEntries((s ?? []).map((r) => [r.student_id, r])));
  };

  useEffect(() => { load(); }, [quiz.id]);

  // طلاب الفصول المسند إليها الاختبار
  useEffect(() => {
    const ids = linked.map((l) => l.class_id);
    if (!ids.length) { setRoster({}); return; }
    supabase.from("student_enrollment")
      .select("class_id, students(id, full_name)").in("class_id", ids).eq("status", "active")
      .then(({ data }) => {
        const r = {};
        (data ?? []).forEach((x) => {
          if (!x.students) return;
          (r[x.class_id] ??= []).push(x.students);
        });
        Object.values(r).forEach((l) => l.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
        setRoster(r);
      });
  }, [linked]);

  // متابعة حيّة أثناء فترة الاختبار
  const isOpen = online && new Date(online.closes_at).getTime() > Date.now();
  useEffect(() => {
    if (!isOpen || form) return;
    const t1 = setInterval(() => setTick(Date.now()), 15000);
    const t2 = setInterval(load, 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [isOpen, form]);

  const openForm = () => {
    const allIds = Object.values(roster).flat().map((s) => s.id);
    if (online) {
      setForm({
        opens: toLocal(online.opens_at), closes: toLocal(online.closes_at),
        duration: online.duration_min, show: online.show_result,
        selected: new Set(assigns.map((a) => a.student_id)),
      });
    } else {
      const o = nextFive();
      setForm({
        opens: toLocal(o), closes: toLocal(new Date(o.getTime() + 24 * 3600e3)),
        duration: quiz.duration_min || 20, show: true, selected: new Set(allIds),
      });
    }
    setMsg(null);
  };

  const locked = useMemo(() => new Set(assigns.filter((a) => a.started_at).map((a) => a.student_id)), [assigns]);

  const publish = async (renotify = false, f = form) => {
    const opens = new Date(f.opens), closes = new Date(f.closes);
    if (isNaN(opens) || isNaN(closes)) { setMsg({ ok: false, text: "حدّد موعد الفتح والإغلاق." }); return; }
    if (closes <= opens) { setMsg({ ok: false, text: "موعد الإغلاق يجب أن يكون بعد موعد الفتح." }); return; }
    if (closes <= new Date()) { setMsg({ ok: false, text: "موعد الإغلاق مضى." }); return; }
    if (!f.selected.size) { setMsg({ ok: false, text: "اختر طالبًا واحدًا على الأقل." }); return; }
    setBusy(true); setMsg(null);
    const { data: n, error } = await supabase.rpc("publish_online_quiz", {
      p_quiz: quiz.id, p_students: [...f.selected],
      p_opens: opens.toISOString(), p_closes: closes.toISOString(),
      p_duration: Number(f.duration) || 20, p_show_result: !!f.show, p_renotify: renotify,
    });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (quiz.status === "draft") onStatus?.("ready", true);
    setForm(null);
    setMsg({ ok: true, text: n
      ? `${renotify ? "أُرسل التذكير" : "نُشر الاختبار وأُرسل الإشعار"} إلى ${n === 1 ? "طالب واحد" : n === 2 ? "طالبين" : `${n} ${n <= 10 ? "طلاب" : "طالبًا"}`} في الجرس وعلى الجوال.`
      : "حُفظت التعديلات." });
    load();
  };

  const remind = () => {
    if (!window.confirm("إرسال تذكير لكل من لم يسلّم بعد؟")) return;
    publish(true, {
      opens: toLocal(online.opens_at), closes: toLocal(online.closes_at),
      duration: online.duration_min, show: online.show_result,
      selected: new Set(assigns.map((a) => a.student_id)),
    });
  };

  const closeNow = async () => {
    if (!window.confirm("إغلاق الاختبار الآن؟\n\nمن يؤدّيه الآن تُسلَّم إجاباته المحفوظة، ومن لم يبدأ يُسجَّل غائبًا.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("close_online_quiz", { p_quiz: quiz.id });
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: "أُغلق الاختبار." });
    load();
  };

  if (online === undefined) return <p className="card p-4 text-sm text-muted">جارٍ التحميل…</p>;

  const box = (m) => m && (
    <p className={`rounded-sm2 px-3 py-2 text-sm ${m.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
      {m.text}
    </p>
  );

  /* ——— نموذج النشر / التعديل ——— */
  if (form || !online) {
    const blockers = [
      !questionsCount && "أضف أسئلة الاختبار أولًا.",
      !linked.length && "أسند الاختبار لفصل من تبويب «الفصول» أولًا.",
    ].filter(Boolean);

    if (!form) {
      return (
        <section className="card space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">إجراء الاختبار إلكترونيًا</p>
          <p className="text-xs leading-relaxed text-muted">
            يؤدّي الطلاب الاختبار من البوابة على الجوال أو الحاسب بدل الورقة: يصلهم إشعار في الجرس وعلى الجوال
            برابط الاختبار، ولكلٍّ منهم وقت محدّد يبدأ من لحظة دخوله، ويُصحَّح آليًا فور التسليم وتنتقل درجته
            إلى «التصحيح والدرجات» وكشف الرصد.
          </p>
          {box(msg)}
          {blockers.length > 0 ? (
            <ul className="list-disc space-y-1 pr-5 text-sm text-warning">
              {blockers.map((b) => <li key={b}>{b}</li>)}
            </ul>
          ) : (
            <>
              {!marksOk && (
                <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
                  مجموع درجات الأسئلة لا يساوي درجة الاختبار — راجع تبويب «الأسئلة» قبل النشر.
                </p>
              )}
              <button className="btn-primary w-full" onClick={openForm}>إعداد الاختبار الإلكتروني</button>
            </>
          )}
        </section>
      );
    }

    const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggle = (ids, on) => setForm((f) => {
      const s = new Set(f.selected);
      ids.forEach((id) => { if (locked.has(id)) return; on ? s.add(id) : s.delete(id); });
      return { ...f, selected: s };
    });

    return (
      <section className="card space-y-4 p-4">
        <p className="text-sm font-semibold text-ink">{online ? "تعديل الاختبار الإلكتروني" : "إعداد الاختبار الإلكتروني"}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">يُفتح
            <input type="datetime-local" className="field mt-1" value={form.opens} onChange={(e) => setF("opens", e.target.value)} />
          </label>
          <label className="block text-xs text-muted">يُغلق
            <input type="datetime-local" className="field mt-1" value={form.closes} onChange={(e) => setF("closes", e.target.value)} />
          </label>
          <label className="block text-xs text-muted">مدة الاختبار لكل طالب (دقيقة)
            <input type="number" min={1} max={300} className="field num mt-1" value={form.duration}
                   onChange={(e) => setF("duration", e.target.value)} />
          </label>
          <label className="flex items-center gap-2 self-end rounded-sm2 border border-line px-3 py-2.5 text-sm text-ink">
            <input type="checkbox" checked={form.show} onChange={(e) => setF("show", e.target.checked)} />
            إظهار الدرجة للطالب فور التسليم
          </label>
        </div>
        <p className="text-[11px] leading-relaxed text-faint">
          يبدأ الطالب متى شاء بين موعدي الفتح والإغلاق، ووقته يبدأ من لحظة دخوله ولا يتجاوز موعد الإغلاق.
        </p>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink">
            الطلاب <span className="num text-muted">({form.selected.size} مختار)</span>
          </p>
          {linked.map((l) => {
            const list = roster[l.class_id] ?? [];
            const ids = list.map((s) => s.id);
            const n = ids.filter((id) => form.selected.has(id)).length;
            const all = list.length > 0 && n === list.length;
            return (
              <details key={l.class_id} className="rounded-card border border-line" open={linked.length === 1}>
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
                  <span className="flex-1 font-medium text-ink">{classLabel(l.class_id)}</span>
                  <span className="num text-xs text-muted">{n}/{list.length}</span>
                  <button type="button" onClick={(e) => { e.preventDefault(); toggle(ids, !all); }}
                          className={`rounded-pill px-3 py-1 text-xs font-semibold ${
                            all ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>
                    {all ? "كل الفصل ✓" : "كل الفصل"}
                  </button>
                </summary>
                <div className="grid gap-1 border-t border-line px-3 py-2 sm:grid-cols-2">
                  {list.map((s) => (
                    <label key={s.id} className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                      locked.has(s.id) ? "text-faint" : "text-ink"}`}>
                      <input type="checkbox" checked={form.selected.has(s.id)} disabled={locked.has(s.id)}
                             onChange={(e) => toggle([s.id], e.target.checked)} />
                      {s.full_name}
                      {locked.has(s.id) && <span className="text-[10px]">(بدأ)</span>}
                    </label>
                  ))}
                  {!list.length && <p className="text-xs text-muted">لا طلاب في هذا الفصل.</p>}
                </div>
              </details>
            );
          })}
        </div>

        {box(msg)}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary flex-1" disabled={busy} onClick={() => publish(false)}>
            {busy ? "جارٍ النشر…" : online ? "حفظ (ويُشعَر المضافون الجدد)" : "نشر وإرسال الإشعار"}
          </button>
          <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted"
                  onClick={() => { setForm(null); setMsg(null); }}>إلغاء</button>
        </div>
      </section>
    );
  }

  /* ——— المتابعة بعد النشر ——— */
  const now = tick;
  const opens = new Date(online.opens_at).getTime();
  const closes = new Date(online.closes_at).getTime();
  const phase = now < opens ? ["لم يُفتح بعد", "bg-canvas text-muted"]
    : now < closes ? ["مفتوح الآن", "bg-mint-deep text-white"] : ["مُغلق", "bg-present/10 text-present"];

  const rowState = (a) => {
    const sub = subs[a.student_id];
    if (a.submitted_at) return { t: "سلّم", c: "text-present", score: sub?.score };
    if (a.started_at) return { t: `يؤدّيه الآن — بقي ${mins(new Date(a.deadline_at).getTime() - now)} د`, c: "text-warning" };
    if (sub?.absent) return { t: "غائب", c: "text-absent" };
    return { t: now >= closes ? "لم يبدأ" : "لم يبدأ بعد", c: "text-muted" };
  };
  const done = assigns.filter((a) => a.submitted_at).length;
  const going = assigns.filter((a) => a.started_at && !a.submitted_at).length;

  return (
    <section className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm font-semibold text-ink">الاختبار الإلكتروني</p>
        <span className={`chip ${phase[1]}`}>{phase[0]}</span>
      </div>

      <dl className="grid gap-1.5 text-xs text-muted sm:grid-cols-2">
        <div>يُفتح: <span className="text-ink">{fmtDateTime(online.opens_at)}</span></div>
        <div>يُغلق: <span className="text-ink">{fmtDateTime(online.closes_at)}</span></div>
        <div>المدة: <bdi className="num text-ink">{online.duration_min}</bdi> دقيقة لكل طالب</div>
        <div>النتيجة للطالب: <span className="text-ink">{online.show_result ? "فور التسليم" : "بعد اعتمادك"}</span></div>
      </dl>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[["سلّم", `${done}/${assigns.length}`], ["يؤدّيه الآن", going], ["لم يبدأ", assigns.length - done - going]]
          .map(([k, v]) => (
            <div key={k} className="rounded-card bg-canvas px-2 py-2">
              <p className="num text-base font-bold text-ink">{v}</p>
              <p className="text-[11px] text-muted">{k}</p>
            </div>
          ))}
      </div>

      {box(msg)}

      <div className="flex flex-wrap gap-2">
        <button className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-canvas"
                onClick={() => { setTick(Date.now()); load(); }}>تحديث</button>
        <button className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-muted hover:bg-canvas"
                onClick={openForm}>تعديل المواعيد والطلاب</button>
        {now < closes && (
          <>
            <button className="rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1.5 text-xs font-semibold text-mint-deep"
                    disabled={busy} onClick={remind}>تذكير من لم يسلّم</button>
            <button className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs font-semibold text-absent hover:bg-absent hover:text-white"
                    disabled={busy} onClick={closeNow}>إغلاق الآن</button>
          </>
        )}
        {!online.show_result && !["marking", "closed"].includes(quiz.status) && done > 0 && (
          <button className="rounded-pill bg-mint-deep px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => onStatus?.("marking")}>إظهار النتائج للطلاب</button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-right text-xs text-muted">
              <th className="py-1.5 font-medium">الطالب</th>
              {linked.length > 1 && <th className="py-1.5 font-medium">الفصل</th>}
              <th className="py-1.5 font-medium">الحالة</th>
              <th className="py-1.5 text-center font-medium">الدرجة</th>
            </tr>
          </thead>
          <tbody>
            {assigns.map((a) => {
              const s = rowState(a);
              return (
                <tr key={a.id} className="border-b border-line/50">
                  <td className="py-1.5 text-ink">{a.students?.full_name}</td>
                  {linked.length > 1 && <td className="py-1.5 text-xs text-muted">{classLabel(a.class_id)}</td>}
                  <td className={`py-1.5 text-xs ${s.c}`}>{s.t}</td>
                  <td className="num py-1.5 text-center font-semibold text-ink">
                    {s.score != null ? <>{Number(s.score)}<span className="text-faint">/{Number(quiz.total_marks)}</span></> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] leading-relaxed text-faint">
        الدرجات تظهر كذلك في «التصحيح والدرجات» ويمكن تعديلها هناك، وتنتقل تلقائيًا إلى كشف رصد الدرجات.
        من لم يبدأ حتى الإغلاق يُسجَّل غائبًا.
      </p>
    </section>
  );
}
