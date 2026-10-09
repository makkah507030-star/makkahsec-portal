import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { loadActiveTerm } from "../lib/officialAttendance";
import { GRADE_NAMES } from "../lib/schoolTime";
import { fmtDate, fmtHijri } from "../lib/dates";
import { printThen } from "../lib/print.js";
import Loader from "../components/Loader.jsx";
import PrintPortal from "../components/PrintPortal.jsx";
import moeLogo from "../assets/moe-logo.png";
import {
  XV_STAGES, XV_STATUS, XV_ELEMENTS, XV_ALL, XV_LEVELS, XV_PRESETS, xvMissing,
  useMyDepartment, loadDeptTeachers, plcNotify,
} from "../lib/plc";
import { HeadTag, useRoles, Chips, StageBar, C } from "./Plc.jsx";

/* =====================================================================
   التطوير المهني ← استمارة تبادل الزيارات بين معلمي القسم.
   يصدرها المعلم الزائر لزميل من قسمه، ويوقّعها المستضيف بتعقيبه، ويعتمدها
   وكيل الشؤون التعليمية، ويطّلع عليها رئيس القسم والمدير. والمعتمدة تُضاف
   للمستضيف في 2-3 وللزائر في 2-4 (supabase/plc_6_visits.sql، plc_7).
   ===================================================================== */

const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const add = (cur, t) => (cur?.trim() ? `${cur.trim()}\n${t}` : t);
const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

export default function ExchangeVisits() {
  const { id } = useParams();
  return id ? <Visit id={id} /> : <VisitList />;
}

/* ------------------------------ القائمة ------------------------------ */
function VisitList() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;
  const dept = useMyDepartment();
  const roles = useRoles();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("exchange_visits").select("*, departments(name)").order("created_at", { ascending: false }).limit(300)
      .then(({ data, error }) => {
        if (error) setErr(/exchange_visits|schema cache/i.test(error.message)
          ? "لم تُفعَّل الزيارات التبادلية بعد في قاعدة البيانات." : error.message);
        setRows(data ?? []);
      });
  }, [uid]);

  const tabs = [
    dept && { k: "mine", t: "زياراتي" },
    dept && { k: "host", t: "للتوقيع" },
    dept?.is_head && { k: "dept", t: "زيارات قسمي" },
    roles.isDeputy && { k: "pending", t: "بانتظار الاعتماد" },
    roles.seesAll && { k: "all", t: "كل الزيارات" },
  ].filter(Boolean);
  const cur = tab ?? (roles.isDeputy ? "pending" : roles.seesAll ? "all" : tabs[0]?.k);
  const pick = (r) => cur === "mine" ? r.visitor_user_id === uid || r.host_user_id === uid
    : cur === "host" ? r.host_user_id === uid && r.status === "hosting"
    : cur === "dept" ? r.department_id === dept?.department_id
    : cur === "pending" ? r.status === "pending" : true;
  const list = (rows ?? []).filter(pick);
  const count = (k) => (rows ?? []).filter((r) => k === "host" ? r.host_user_id === uid && r.status === "hosting"
    : k === "pending" && r.status === "pending").length;

  const create = async () => {
    const { year } = await loadActiveTerm();
    // المستضيف يُختار في المرحلة الأولى؛ يُحفظ مؤقتًا أول زميل ثم يُغيَّر
    const mates = (await loadDeptTeachers(dept.department_id)).filter((t) => t.user_id && t.user_id !== uid);
    if (!mates.length) { setErr("لا زملاء مرتبطين بقسمك بعد."); return; }
    const { data, error } = await supabase.from("exchange_visits").insert({
      department_id: dept.department_id, visitor_user_id: uid, visitor_name: profile?.full_name ?? "",
      host_user_id: mates[0].user_id, host_name: mates[0].name, academic_year: year, data: { host_pending: true },
    }).select("id").single();
    if (error) { setErr(error.message); return; }
    navigate(`/xvisits/${data.id}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/plc" className="text-xs text-muted hover:underline">النماذج ← التطوير المهني</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">الزيارات التبادلية بين المعلمين</h1>
          <HeadTag d={dept} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          يزور المعلم زميلًا من قسمه ويقيّم درسه، فيوقّعها المستضيف بتعقيبه ويعتمدها وكيل الشؤون التعليمية.
          والمعتمدة تُضاف للمستضيف في «تنفيذ زيارات تبادلية» وللزائر في «حضور الزيارات التبادلية».
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button key={t.k} className={pill(cur === t.k)} onClick={() => setTab(t.k)}>
            {t.t}{count(t.k) > 0 && <span className="num"> ({count(t.k)})</span>}
          </button>
        ))}
        {dept && <button className="btn-primary mr-auto" onClick={create}>زيارة جديدة</button>}
      </div>
      {!rows ? <Loader compact /> : list.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">لا زيارات هنا.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const st = XV_STATUS[r.status] ?? XV_STATUS.draft;
            return (
              <Link key={r.id} to={`/xvisits/${r.id}`} className="card flex flex-wrap items-center gap-2 p-3 hover:bg-canvas/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.data?.lesson || "زيارة بلا درس بعد"}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {r.serial} · الزائر {r.visitor_name} · المستضيف {r.host_name}{r.data?.date ? ` · ${fmtDate(r.data.date)}` : ""}
                  </p>
                </div>
                {cur === "host" ? <span className="chip bg-mint-deep text-white">وقّع الآن</span>
                  : <span className={`chip ${st.c}`}>{st.t}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ الزيارة ------------------------------ */
function Visit({ id }) {
  const { session } = useSession();
  const uid = session?.user?.id;
  const roles = useRoles();
  const [v, setV] = useState(null);
  const [err, setErr] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("exchange_visits").select("*, departments(name)").eq("id", id).maybeSingle();
    if (error || !data) { setErr(error?.message ?? "الزيارة غير موجودة أو لا تملك صلاحية عرضها."); return; }
    setV(data);
  };
  useEffect(() => { load(); }, [id]);
  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!v) return <Loader />;
  const editable = ((v.visitor_user_id === uid && ["draft", "returned"].includes(v.status)) || roles.isTech)
    && !["pending", "approved", "hosting"].includes(v.status);
  return editable ? <Editor v={v} setV={setV} reload={load} /> : <Viewer v={v} reload={load} uid={uid} roles={roles} />;
}

function Editor({ v, setV, reload }) {
  const firstMissing = ["info", "ratings", "notes"].findIndex((k) => xvMissing(k, v).length);
  const reached = firstMissing === -1 ? 3 : firstMissing;
  const [stage, setStage] = useState(Math.min(reached, 2));
  const [mates, setMates] = useState(null);
  const [sched, setSched] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const host = (mates ?? []).find((m) => m.user_id === v.host_user_id);

  useEffect(() => {
    loadDeptTeachers(v.department_id).then((l) => setMates(l.filter((t) => t.user_id && t.user_id !== v.visitor_user_id)));
  }, [v.department_id]);
  // فصول المستضيف وموادّه من جدوله في الفصل النشط
  useEffect(() => {
    if (!host?.teacher_id) return;
    loadActiveTerm().then(({ year, term }) => supabase.from("schedule")
      .select("class_id, period_no, classes(class_no, grade), subjects(name)")
      .eq("teacher_id", host.teacher_id).eq("academic_year", year).eq("term", term)
      .then(({ data }) => {
        const seen = new Map();
        (data ?? []).forEach((r) => {
          const label = `${GRADE_NAMES[r.classes?.grade] ?? ""} — فصل ${r.classes?.class_no ?? ""}`;
          const key = `${label}|${r.subjects?.name ?? ""}`;
          if (!seen.has(key)) seen.set(key, { label, subject: r.subjects?.name ?? "" });
        });
        setSched([...seen.values()]);
      }));
  }, [host?.teacher_id]);

  const save = async (patch) => {
    setV((x) => ({ ...x, ...patch }));
    const { error } = await supabase.from("exchange_visits").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", v.id);
    if (error) setMsg({ ok: false, t: error.message });
    return !error;
  };
  const setData = (k, val) => setV((x) => ({ ...x, data: { ...x.data, [k]: val } }));
  const persist = () => save({ data: v.data, ratings: v.ratings, strengths: v.strengths ?? null, recs: v.recs ?? null });
  const go = async (i) => { await persist(); setStage(i); setMsg(null); };
  const next = async () => {
    const miss = xvMissing(XV_STAGES[stage].key, v);
    if (miss.length) { setMsg({ ok: false, t: `أكمل: ${miss.join("، ")}.` }); return; }
    if (await persist()) { setStage(stage + 1); setMsg(null); }
  };
  const pickHost = (m) => {
    setV((x) => ({ ...x, host_user_id: m.user_id, host_name: m.name, data: { ...x.data, host_pending: false, class_label: "", subject: "" } }));
    save({ host_user_id: m.user_id, host_name: m.name, data: { ...v.data, host_pending: false, class_label: "", subject: "" } });
  };
  const send = async () => {
    setBusy(true);
    if (await save({ ...{ data: v.data, ratings: v.ratings, strengths: v.strengths, recs: v.recs },
                     status: "hosting", sent_at: new Date().toISOString() })) {
      await plcNotify([v.host_user_id], "استمارة زيارة تبادلية للتوقيع",
        `أرسل إليك ${v.visitor_name} استمارة زيارته لدرس «${v.data?.lesson ?? ""}» لتطّلع عليها وتوقّعها.`, `/xvisits/${v.id}`);
      reload();
    }
    setBusy(false);
  };
  const remove = async () => {
    if (!window.confirm("حذف المسودة نهائيًا؟")) return;
    await supabase.from("exchange_visits").delete().eq("id", v.id);
    window.history.back();
  };
  const key = XV_STAGES[stage].key;
  const d = v.data ?? {};

  return (
    <div className="space-y-4">
      <div>
        <Link to="/xvisits" className="text-xs text-muted hover:underline">التطوير المهني ← الزيارات التبادلية</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">استمارة تبادل الزيارات بين المعلمين</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {v.serial} · قسم {v.departments?.name} <span className={`chip ${XV_STATUS[v.status]?.c}`}>{XV_STATUS[v.status]?.t}</span>
        </p>
      </div>
      {v.status === "returned" && v.decision_note && (
        <p className="rounded-sm2 bg-absent/5 px-3 py-2 text-sm text-absent"><b>ملاحظة وكيل الشؤون التعليمية: </b>{v.decision_note}</p>
      )}
      <StageBar stage={stage} reached={reached} onPick={go} stages={XV_STAGES} />

      <section className="card space-y-4 p-4">
        {key === "info" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink">المعلم المستضيف (من قسمك) <span className="text-absent">*</span></label>
              {!mates ? <Loader compact /> : (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {mates.map((m) => (
                    <button key={m.user_id} type="button" onClick={() => pickHost(m)} className={pill(!d.host_pending && m.user_id === v.host_user_id)}>{m.name}</button>
                  ))}
                </div>
              )}
            </div>
            {!d.host_pending && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-ink">الصف / الفصل والمادة <span className="text-absent">*</span></label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {sched.map((c) => (
                      <button key={c.label + c.subject} type="button" className={pill(d.class_label === c.label && d.subject === c.subject)}
                              onClick={() => setV((x) => ({ ...x, data: { ...x.data, class_label: c.label, subject: c.subject } }))}>
                        {c.label} · {c.subject}
                      </button>
                    ))}
                    {sched.length === 0 && <p className="text-xs text-muted">لا جدول للمستضيف في الفصل الحالي.</p>}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">الحصة</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button key={n} type="button" className={`num ${pill(Number(d.period) === n)}`} onClick={() => setData("period", n)}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">التاريخ <span className="text-absent">*</span></label>
                  <input type="date" className="field num mt-1 w-full" value={d.date ?? ""} onChange={(e) => setData("date", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">الوحدة / عنوان الدرس <span className="text-absent">*</span></label>
                  <input className="field mt-1 w-full" value={d.lesson ?? ""} onChange={(e) => setData("lesson", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}

        {key === "ratings" && (
          <div className="space-y-3">
            <p className="text-xs text-muted">لكل مؤشر: متحقق، أو متحقق جزئيًا، أو غير متحقق.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {XV_ELEMENTS.map((el) => (
                <div key={el.t} className="rounded-card border border-line bg-white px-3 py-2">
                  <p className="text-sm font-semibold text-mint-deep">عنصر {el.t}</p>
                  {el.items.map((it) => (
                    <div key={it.k} className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 py-2 text-sm">
                      <span className="text-ink">{it.t}</span>
                      <div className="flex gap-1">
                        {XV_LEVELS.map((l) => (
                          <button key={l.k} type="button" onClick={() => setV((x) => ({ ...x, ratings: { ...x.ratings, [it.k]: l.k } }))}
                            className={`rounded-pill px-3 py-1 text-[11.5px] ${v.ratings?.[it.k] === l.k ? l.on : "border border-line bg-white text-muted"}`}>
                            {l.t}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {key === "notes" && (
          <div className="grid gap-4 md:grid-cols-2">
            {[["strengths", "نقاط تميّز أداء المعلم المستضيف"], ["recs", "التوصيات"]].map(([k, t]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-ink">{t} <span className="text-absent">*</span></label>
                <Chips items={XV_PRESETS[k]} onPick={(x) => setV((y) => ({ ...y, [k]: add(y[k], x) }))} />
                <textarea rows={5} className="field mt-1.5 w-full text-sm leading-relaxed" value={v[k] ?? ""}
                          onChange={(e) => setV((y) => ({ ...y, [k]: e.target.value }))} placeholder="كل بند في سطر — اختر من البطاقات أو اكتب" />
              </div>
            ))}
          </div>
        )}

        {key === "host" && (
          <div className="space-y-2">
            <p className="text-sm text-ink">راجع الاستمارة ثم أرسلها إلى {v.host_name} ليطّلع عليها ويكتب تعقيبه ويوقّع. توقيعك يُثبت بالإرسال.</p>
            <button className="btn-primary w-full" disabled={busy} onClick={send}>
              {v.status === "returned" ? "إعادة الإرسال للمستضيف" : "إرسال للمستضيف للتوقيع"}
            </button>
          </div>
        )}

        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
        {stage < 3 && (
          <div className="flex gap-2">
            {stage > 0 && <button className="btn-ghost" onClick={() => go(stage - 1)}>السابق</button>}
            <button className="btn-primary flex-1" onClick={next}>حفظ والانتقال إلى «{XV_STAGES[stage + 1].t}»</button>
          </div>
        )}
        {v.status === "draft" && <button className="text-xs text-absent underline" onClick={remove}>حذف المسودة</button>}
      </section>
      <SheetPreview v={v} />
    </div>
  );
}

function Viewer({ v, reload, uid, roles }) {
  const [comment, setComment] = useState(v.host_comment ?? "");
  const [note, setNote] = useState("");
  const [pnote, setPnote] = useState(v.principal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const st = XV_STATUS[v.status] ?? XV_STATUS.draft;
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return false; }
    setMsg({ ok: true, t: ok }); reload(); return true;
  };
  const sign = async () => {
    if (await run(() => supabase.rpc("xv_host_sign", { p_id: v.id, p_comment: comment }), "وُقّعت الاستمارة ورُفعت للاعتماد.")) {
      const { data: dep } = await supabase.from("admin_roles").select("user_id").eq("role_type", "deputy_academic");
      await plcNotify([v.visitor_user_id, ...(dep ?? []).map((d) => d.user_id)], "استمارة زيارة تبادلية بانتظار الاعتماد",
        `وقّع ${v.host_name} استمارة زيارة ${v.visitor_name} لدرس «${v.data?.lesson ?? ""}».`, `/xvisits/${v.id}`);
    }
  };
  const decide = async (approve) => {
    if (await run(() => supabase.rpc("xv_decide", { p_id: v.id, p_approve: approve, p_note: note }),
      approve ? "اعتُمدت الزيارة وأُضيفت لسجل التطوير المهني للاثنين." : "أُعيدت للمعلم الزائر بملاحظتك.")) {
      await plcNotify(approve ? [v.visitor_user_id, v.host_user_id] : [v.visitor_user_id],
        approve ? "اعتُمدت الزيارة التبادلية" : "أُعيدت استمارة الزيارة بملاحظة",
        approve ? `اعتُمدت زيارة درس «${v.data?.lesson ?? ""}» وأُضيفت إلى سجل التطوير المهني.`
                : `أعاد وكيل الشؤون التعليمية الاستمارة: ${note}`, `/xvisits/${v.id}`);
    }
  };
  const savePrincipal = () => run(() => supabase.rpc("xv_principal_note", { p_id: v.id, p_note: pnote }), "حُفظت ملاحظتك.");

  return (
    <div className="space-y-4">
      <div>
        <Link to="/xvisits" className="text-xs text-muted hover:underline">التطوير المهني ← الزيارات التبادلية</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">{v.data?.lesson || "استمارة تبادل الزيارات"}</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {v.serial} · الزائر {v.visitor_name} · المستضيف {v.host_name} <span className={`chip ${st.c}`}>{st.t}</span>
        </p>
      </div>
      {v.host_user_id === uid && v.status === "hosting" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm text-ink">اطّلع على تقييم زميلك أدناه، واكتب تعقيبك إن رغبت، ثم وقّع.</p>
          <textarea rows={2} className="field w-full" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تعقيب المعلم المستضيف (اختياري)" />
          <button className="btn-primary w-full" disabled={busy} onClick={sign}>أوقّع على الاستمارة</button>
        </section>
      )}
      {roles.isDeputy && v.status === "pending" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">الاعتماد</p>
          <textarea rows={2} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (مطلوبة عند الإعادة)" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>اعتماد الزيارة</button>
            <button className="flex-1 rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent"
                    disabled={busy || !note.trim()} onClick={() => decide(false)}>إعادة للمعلم الزائر</button>
          </div>
        </section>
      )}
      {roles.isPrincipal && v.status !== "draft" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">ملاحظة مدير المدرسة</p>
          <textarea rows={2} className="field w-full" value={pnote} onChange={(e) => setPnote(e.target.value)} />
          <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={savePrincipal}>حفظ الملاحظة</button>
        </section>
      )}
      {!roles.isPrincipal && v.principal_note && (
        <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-ink"><b className="text-mint-deep">ملاحظة مدير المدرسة: </b>{v.principal_note}</p>
      )}
      {v.decision_note && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink"><b>ملاحظة وكيل الشؤون التعليمية: </b>{v.decision_note}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <SheetPreview v={v} />
    </div>
  );
}

/* --------------------------- الاستمارة المطبوعة --------------------------- */
function SheetPreview({ v }) {
  const [printing, setPrinting] = useState(false);
  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 80); };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">معاينة الاستمارة</p>
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={print}>طباعة / حفظ PDF</button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-canvas p-3">
        <div style={{ width: 794, margin: "0 auto" }}><VisitSheet v={v} /></div>
      </div>
      {printing && <PrintPortal id="xv-print"><div id="xv-print"><VisitSheet v={v} /></div></PrintPortal>}
    </section>
  );
}

export function VisitSheet({ v }) {
  const d = v.data ?? {};
  const day = d.date ? new Date(`${d.date}T12:00:00`).toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long" }) : "";
  const box = { border: `1.3px solid ${C.line}`, borderRadius: 8, padding: "5px 9px" };
  const lbl = { display: "block", color: C.green, fontSize: 10.5, fontWeight: 700 };
  const th = { background: C.green, color: "#fff", padding: 4 };
  const td = { border: "1px solid #d8e4dc", padding: "4px 6px" };
  const lvl = (k) => XV_LEVELS.find((l) => l.k === v.ratings?.[k]);
  const sum = XV_LEVELS.map((l) => ({ ...l, n: XV_ALL.filter((i) => v.ratings?.[i.k] === l.k).length }));
  const signed = (ok) => ok ? <span style={{ color: "#2f7a4f" }}>✓ وُقّع إلكترونيًا</span> : "—";
  return (
    <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", background: "#fff", padding: "11mm 12mm",
      color: "#1f2a24", fontSize: 12, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${C.green}`, paddingBottom: 10 }}>
        <div style={{ fontSize: 11.5, lineHeight: 1.7, fontWeight: 600 }}>المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<br />مدرسة مكة الثانوية</div>
        <img src={moeLogo} alt="" style={{ height: 56 }} />
        <div style={{ fontSize: 11.5, lineHeight: 1.7, fontWeight: 600, textAlign: "left" }}>العام الدراسي {v.academic_year}هـ<br />الرقم: <span dir="ltr">{v.serial}</span></div>
      </div>
      <h1 style={{ textAlign: "center", fontSize: 19, color: C.green, margin: "12px 0 2px", fontWeight: 700 }}>استمارة تبادل الزيارات بين المعلمين</h1>
      <p style={{ textAlign: "center", color: C.soft, fontSize: 11.5 }}>قسم {v.departments?.name} · شاهد للبندين «تنفيذ زيارات تبادلية» و«حضور الزيارات التبادلية»</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 10 }}>
        {[["المعلم الزائر", v.visitor_name], ["المعلم المستضيف", d.host_pending ? "" : v.host_name],
          ["اليوم / التاريخ", d.date ? `${day} ${fmtHijri(d.date)}` : ""], ["الصف / الفصل", d.class_label],
          ["المادة / الحصة", [d.subject, d.period ? `الحصة ${d.period}` : ""].filter(Boolean).join(" — ")], ["الوحدة / عنوان الدرس", d.lesson]]
          .map(([t, val]) => <div key={t} style={box}><span style={lbl}>{t}</span>{val}</div>)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {sum.map((s) => <span key={s.k} style={{ flex: 1, textAlign: "center", borderRadius: 8, padding: 6, fontWeight: 700,
          color: s.print, background: `${s.print}14` }}>{s.t} {s.n}</span>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}>
        {XV_ELEMENTS.map((el) => (
          <div key={el.t}>
            <p style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>عنصر {el.t}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead><tr><th style={th}>م</th><th style={th}>المؤشر</th><th style={th}>التقدير</th></tr></thead>
              <tbody>{el.items.map((it, i) => (
                <tr key={it.k}><td style={{ ...td, textAlign: "center" }}>{i + 1}</td><td style={td}>{it.t}</td>
                  <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap", fontWeight: 600, color: lvl(it.k)?.print }}>{lvl(it.k)?.t ?? ""}</td></tr>
              ))}</tbody>
            </table>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 10 }}>
        {[["نقاط تميّز أداء المعلم المستضيف", v.strengths], ["التوصيات", v.recs]].map(([t, txt]) => (
          <div key={t} style={{ ...box, padding: "7px 10px" }}>
            <p style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{t}</p>
            <ol style={{ paddingRight: 16, lineHeight: 1.75 }}>{lines(txt).map((x, i) => <li key={i}>{x}</li>)}</ol>
          </div>
        ))}
      </div>
      {v.host_comment && (
        <div style={{ ...box, marginTop: 9, padding: "7px 10px" }}><span style={lbl}>تعقيب المعلم المستضيف</span>{v.host_comment}</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16, textAlign: "center" }}>
        {[["المعلم المستضيف", v.host_name, signed(!!v.host_signed_at)], ["المعلم الزائر", v.visitor_name, signed(v.status !== "draft")],
          ["وكيل الشؤون التعليمية", v.status === "approved" ? v.decided_name : "", v.status === "approved" ? <span style={{ color: "#2f7a4f" }}>✓ اعتمد</span> : ""]]
          .map(([t, n, s]) => (
            <div key={t} style={{ borderTop: "1.3px dashed #b8cbbf", paddingTop: 6, fontSize: 11, lineHeight: 1.7 }}>{t}<br /><b>{n}</b><br />{s}</div>
          ))}
      </div>
      {v.principal_note && <div style={{ ...box, marginTop: 10 }}><span style={lbl}>ملاحظة مدير المدرسة</span>{v.principal_note}</div>}
      <p style={{ marginTop: 12, textAlign: "center", color: "#8a978f", fontSize: 10 }}>صدر من بوابة مكة الثانوية الرقمية · makkahsec.com</p>
    </div>
  );
}
