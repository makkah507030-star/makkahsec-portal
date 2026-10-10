import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { loadActiveTerm } from "../lib/officialAttendance";
import { shrinkImage } from "../lib/imageResize.js";
import { fmtDate, fmtHijri } from "../lib/dates";
import { printThen } from "../lib/print.js";
import { PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import PrintPortal from "../components/PrintPortal.jsx";
import moeLogo from "../assets/moe-logo.png";
import { useMyDepartment, loadDeptTeachers, plcNotify } from "../lib/plc";
import { PD_KINDS, PD_KIND_KEYS, PD_STATUS, PD_BUCKET, PD_MAX_FILES, pdStages, pdMissing } from "../lib/pd";
import { HeadTag, useRoles, Chips, StageBar, C } from "./Plc.jsx";

/* =====================================================================
   التطوير المهني ← نماذج سجل التطوير المهني (src/lib/pd.js).
   /pd: أنواع النماذج والقوائم، و/pd/:id: النموذج بمراحله أو عرضه.
   ===================================================================== */

const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;
const add = (cur, t) => (cur?.trim() ? `${cur.trim()}\n${t}` : t);
const lines = (t) => String(t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const fileUrl = async (path) => (await supabase.storage.from(PD_BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;

export default function PdReports() {
  const { id } = useParams();
  return id ? <Report id={id} /> : <ReportList />;
}

/* ------------------------------ القائمة ------------------------------ */
function ReportList() {
  const { session, profile, isTeacher } = useSession();
  const uid = session?.user?.id;
  const dept = useMyDepartment();
  const roles = useRoles();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("pd_reports").select("*, pd_signatures(user_id)").order("created_at", { ascending: false }).limit(300)
      .then(({ data, error }) => {
        if (error) setErr(/pd_reports|schema cache/i.test(error.message) ? "لم تُفعَّل هذه النماذج بعد في قاعدة البيانات." : error.message);
        setRows(data ?? []);
      });
  }, [uid]);

  const attended = (r) => (r.attendees ?? []).some((a) => a.user_id === uid);
  const signed = (r) => (r.pd_signatures ?? []).some((g) => g.user_id === uid);
  const toSign = (r) => attended(r) && r.status === "signing" && !signed(r);
  const tabs = [
    isTeacher && { k: "mine", t: "نماذجي" },
    isTeacher && { k: "sign", t: "للتوقيع" },
    dept?.is_head && { k: "dept", t: "نماذج قسمي" },
    roles.isDeputy && { k: "pending", t: "بانتظار الاعتماد" },
    roles.seesAll && { k: "all", t: "كل النماذج" },
  ].filter(Boolean);
  // ?tab= من صندوق «بانتظار إجرائك» يفتح التبويب المطلوب إن كان متاحًا لصاحب الحساب
  const [params] = useSearchParams();
  const linked = tabs.some((x) => x.k === params.get("tab")) ? params.get("tab") : null;
  const cur = tab ?? linked ?? (roles.isDeputy ? "pending" : roles.seesAll ? "all" : tabs[0]?.k);
  const list = (rows ?? []).filter((r) => cur === "mine" ? r.owner_user_id === uid || attended(r)
    : cur === "sign" ? toSign(r) : cur === "dept" ? r.department_id === dept?.department_id
    : cur === "pending" ? r.status === "pending" : true);
  const count = (k) => (rows ?? []).filter((r) => k === "sign" ? toSign(r) : k === "pending" && r.status === "pending").length;

  const create = async (kind) => {
    const { year } = await loadActiveTerm();
    const { data, error } = await supabase.from("pd_reports").insert({
      kind, owner_user_id: uid, owner_name: profile?.full_name ?? "", academic_year: year,
      department_id: dept?.department_id ?? null, data: kind === "training" ? { provider: "مدرسة مكة الثانوية" } : {},
    }).select("id").single();
    if (error) { setErr(error.message); return; }
    navigate(`/pd/${data.id}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link to="/plc" className="text-xs text-muted hover:underline">النماذج ← التطوير المهني</Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">نماذج سجل التطوير المهني</h1>
          <HeadTag d={dept} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          وثّق مشاركتك، ويعتمدها وكيل الشؤون التعليمية، فتُضاف إلى سجل التطوير المهني في «شواهد الأداء الوظيفي».
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {isTeacher && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PD_KIND_KEYS.map((k) => (
            <button key={k} type="button" onClick={() => create(k)}
                    className="card flex flex-col items-start gap-1 p-3 text-right hover:bg-mint-tint/40">
              <span className="flex items-center gap-2">
                <span dir="ltr" className="num rounded-pill bg-mint-light px-2 text-[11px] font-bold text-mint-deep">{PD_KINDS[k].item}</span>
                <span className="text-sm font-semibold text-ink">{PD_KINDS[k].short}</span>
              </span>
              <span className="text-[11.5px] leading-relaxed text-muted">{PD_KINDS[k].hint}</span>
              <span className="mt-1 text-xs font-semibold text-mint-deep">+ نموذج جديد</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button key={t.k} className={pill(cur === t.k)} onClick={() => setTab(t.k)}>
            {t.t}{count(t.k) > 0 && <span className="num"> ({count(t.k)})</span>}
          </button>
        ))}
      </div>
      {!rows ? <Loader compact /> : list.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">لا نماذج هنا.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const st = PD_STATUS[r.status] ?? PD_STATUS.draft;
            return (
              <Link key={r.id} to={`/pd/${r.id}`} className="card flex flex-wrap items-center gap-2 p-3 hover:bg-canvas/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.data?.title || PD_KINDS[r.kind]?.short}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {r.serial} · {PD_KINDS[r.kind]?.short} · {r.owner_name}{r.data?.date ? ` · ${fmtDate(r.data.date)}` : ""}
                  </p>
                </div>
                {cur === "sign" ? <span className="chip bg-mint-deep text-white">وقّع الآن</span> : <span className={`chip ${st.c}`}>{st.t}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ النموذج ------------------------------ */
function Report({ id }) {
  const { session } = useSession();
  const uid = session?.user?.id;
  const roles = useRoles();
  const [r, setR] = useState(null);
  const [sigs, setSigs] = useState([]);
  const [err, setErr] = useState("");
  const load = async () => {
    const [{ data, error }, { data: g }] = await Promise.all([
      supabase.from("pd_reports").select("*").eq("id", id).maybeSingle(),
      supabase.from("pd_signatures").select("user_id, name, signed_at").eq("report_id", id),
    ]);
    if (error || !data) { setErr(error?.message ?? "النموذج غير موجود أو لا تملك صلاحية عرضه."); return; }
    setR(data); setSigs(g ?? []);
  };
  useEffect(() => { load(); }, [id]);
  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!r) return <Loader />;
  const editable = ((r.owner_user_id === uid && ["draft", "signing", "returned"].includes(r.status)) || roles.isTech)
    && !["pending", "approved"].includes(r.status);
  return editable ? <Editor r={r} setR={setR} sigs={sigs} reload={load} /> : <Viewer r={r} sigs={sigs} reload={load} uid={uid} roles={roles} />;
}

function Field({ f, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{f.t}{f.required && <span className="text-absent"> *</span>}</label>
      {f.type === "choice" ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {f.options.map((o) => <button key={o} type="button" className={pill(value === o)} onClick={() => onChange(o)}>{o}</button>)}
        </div>
      ) : (
        <>
          <input type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"} min={f.type === "number" ? 0 : undefined}
                 step={f.type === "number" ? 0.5 : undefined}
                 className={`field mt-1 w-full ${f.type === "date" || f.type === "number" ? "num" : ""}`}
                 value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
          <Chips items={f.presets} onPick={onChange} />
        </>
      )}
    </div>
  );
}

function Editor({ r, setR, sigs, reload }) {
  const { session } = useSession();
  const uid = session?.user?.id;
  const k = PD_KINDS[r.kind];
  const stages = pdStages(r.kind);
  const keys = stages.map((s) => s.key);
  const sent = r.status === "signing";
  const firstMissing = keys.findIndex((x) => ["info", "content", "attendees"].includes(x) && pdMissing(x, r).length);
  const lastEdit = keys.indexOf("files");
  const reached = sent ? keys.indexOf("signing") : firstMissing === -1 ? lastEdit + 1 : firstMissing;
  const [stage, setStage] = useState(sent ? keys.indexOf("signing") : Math.min(reached, lastEdit));
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [teachers, setTeachers] = useState(null);
  const [deptIds, setDeptIds] = useState([]);
  const [q, setQ] = useState("");
  const [urls, setUrls] = useState({});

  useEffect(() => {
    if (!k.attendees) return;
    supabase.from("teachers").select("id, user_id, full_name").not("user_id", "is", null).order("full_name")
      .then(({ data }) => setTeachers((data ?? []).filter((t) => t.user_id !== r.owner_user_id)));
    if (r.department_id) loadDeptTeachers(r.department_id).then((l) => setDeptIds(l.map((t) => t.user_id)));
  }, [r.kind, r.department_id]);
  useEffect(() => {
    (r.files ?? []).forEach((f) => { if (!urls[f.path] && f.type !== "pdf") fileUrl(f.path).then((u) => setUrls((m) => ({ ...m, [f.path]: u }))); });
  }, [r.files]);

  const save = async (patch) => {
    setR((x) => ({ ...x, ...patch }));
    const { error } = await supabase.from("pd_reports").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (error) setMsg({ ok: false, t: error.message });
    return !error;
  };
  const setData = (key, v) => setR((x) => ({ ...x, data: { ...x.data, [key]: v } }));
  const go = async (i) => { await save({ data: r.data }); setStage(i); setMsg(null); };
  const next = async () => {
    const miss = pdMissing(keys[stage], r);
    if (miss.length) { setMsg({ ok: false, t: `أكمل: ${miss.join("، ")}.` }); return; }
    if (await save({ data: r.data })) { setStage(stage + 1); setMsg(null); }
  };

  const picked = new Set((r.attendees ?? []).map((a) => a.user_id));
  const toggle = (t) => save({ attendees: picked.has(t.user_id) ? r.attendees.filter((a) => a.user_id !== t.user_id)
    : [...(r.attendees ?? []), { teacher_id: t.id, user_id: t.user_id, name: t.full_name }] });
  const addDept = () => save({ attendees: [...(r.attendees ?? []), ...(teachers ?? [])
    .filter((t) => deptIds.includes(t.user_id) && !picked.has(t.user_id))
    .map((t) => ({ teacher_id: t.id, user_id: t.user_id, name: t.full_name }))] });
  const shown = useMemo(() => (teachers ?? []).filter((t) => !q.trim() || t.full_name.includes(q.trim())), [teachers, q]);

  const upload = async (files) => {
    setBusy(true); setMsg(null);
    const list = [...(r.files ?? [])];
    for (const f of files) {
      if (list.length >= PD_MAX_FILES) { setMsg({ ok: false, t: `الحد ${PD_MAX_FILES} ملفات.` }); break; }
      const pdf = f.type === "application/pdf";
      if (!pdf && !(f.type || "").startsWith("image/")) continue;
      const body = pdf ? f : await shrinkImage(f, 1600, 0.85, { jpeg: true });
      if (body.size > 5 * 1024 * 1024) { setMsg({ ok: false, t: `«${f.name}» أكبر من 5 م.ب.` }); continue; }
      const path = `${uid}/${r.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${pdf ? "pdf" : "jpg"}`;
      const { error } = await supabase.storage.from(PD_BUCKET).upload(path, body, { contentType: pdf ? "application/pdf" : "image/jpeg" });
      if (error) { setMsg({ ok: false, t: error.message }); continue; }
      list.push({ path, name: f.name, type: pdf ? "pdf" : "image" });
    }
    await save({ files: list });
    setBusy(false);
  };
  const removeFile = async (f) => {
    await supabase.storage.from(PD_BUCKET).remove([f.path]);
    save({ files: r.files.filter((x) => x.path !== f.path) });
  };

  const notifyDeputy = async () => {
    const { data: dep } = await supabase.from("admin_roles").select("user_id").eq("role_type", "deputy_academic");
    await plcNotify((dep ?? []).map((d) => d.user_id), "نموذج تطوير مهني بانتظار اعتمادك",
      `رفع ${r.owner_name} «${k.short}: ${r.data?.title ?? ""}» للاعتماد.`, `/pd/${r.id}`);
  };
  const sendSign = async () => {
    setBusy(true);
    if (await save({ data: r.data, status: "signing", sent_at: new Date().toISOString() })) {
      await plcNotify(r.attendees.map((a) => a.user_id), `${k.t} للتوقيع`,
        `أرسل إليك ${r.owner_name} «${r.data?.title ?? ""}» لتوقيع حضورك.`, `/pd/${r.id}`);
      setMsg({ ok: true, t: "أُرسل للحاضرين للتوقيع." });
    }
    setBusy(false);
  };
  const remind = async () => {
    const left = r.attendees.filter((a) => !sigs.some((g) => g.user_id === a.user_id)).map((a) => a.user_id);
    await plcNotify(left, "تذكير: نموذج بانتظار توقيعك", `«${r.data?.title ?? ""}» بانتظار توقيع حضورك.`, `/pd/${r.id}`);
    setMsg({ ok: true, t: `أُرسل التذكير إلى ${left.length}.` });
  };
  const submit = async () => {
    setBusy(true); setMsg(null);
    await save({ data: r.data });
    const { error } = await supabase.rpc("pd_submit", { p_id: r.id });
    if (error) { setMsg({ ok: false, t: error.message }); setBusy(false); return; }
    await notifyDeputy();
    setBusy(false); reload();
  };
  const remove = async () => {
    if (!window.confirm("حذف المسودة نهائيًا؟")) return;
    await supabase.from("pd_reports").delete().eq("id", r.id);
    window.history.back();
  };

  const key = keys[stage];
  const allSigned = (r.attendees ?? []).every((a) => sigs.some((g) => g.user_id === a.user_id));
  const editStageEnd = lastEdit;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/pd" className="text-xs text-muted hover:underline">التطوير المهني ← نماذج سجل التطوير المهني</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">{k.t}</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {r.serial} · يُحتسب في البند <span dir="ltr">{k.item}</span>
          {k.attendeeItem && <> · وللحاضرين في <span dir="ltr">{k.attendeeItem}</span></>}
          <span className={`chip ${PD_STATUS[r.status]?.c}`}>{PD_STATUS[r.status]?.t}</span>
        </p>
      </div>
      {r.status === "returned" && r.decision_note && (
        <p className="rounded-sm2 bg-absent/5 px-3 py-2 text-sm text-absent"><b>ملاحظة وكيل الشؤون التعليمية: </b>{r.decision_note}</p>
      )}
      <StageBar stage={stage} reached={reached} onPick={go} stages={stages} />

      <section className="card space-y-4 p-4">
        {key === "info" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {k.info.map((f) => <Field key={f.key} f={f} value={r.data?.[f.key]} onChange={(v) => setData(f.key, v)} />)}
          </div>
        )}
        {key === "content" && (
          <div className="grid gap-4 md:grid-cols-2">
            {k.content.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-ink">{f.t}{f.required && <span className="text-absent"> *</span>}</label>
                <Chips items={f.presets} onPick={(t) => setData(f.key, add(r.data?.[f.key], t))} />
                <textarea rows={5} className="field mt-1.5 w-full text-sm leading-relaxed" value={r.data?.[f.key] ?? ""}
                          onChange={(e) => setData(f.key, e.target.value)} placeholder="كل بند في سطر — اختر من البطاقات أو اكتب" />
              </div>
            ))}
          </div>
        )}
        {key === "attendees" && (
          <div className="space-y-2">
            <p className="text-sm text-ink">أشّر على من حضر من المعلمين، فيصل كل منهم النموذج ليوقّع حضوره.</p>
            <div className="flex flex-wrap gap-2">
              <input className="field flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المعلم" />
              {deptIds.length > 0 && !sent && <button className="btn-ghost text-xs" onClick={addDept}>إضافة معلمي قسمي</button>}
            </div>
            {!teachers ? <Loader compact /> : (
              <div className="grid max-h-80 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {shown.map((t) => (
                  <label key={t.user_id} className={`flex cursor-pointer items-center gap-2 rounded-sm2 border px-3 py-2 text-sm ${
                    picked.has(t.user_id) ? "border-mint-deep bg-mint-tint" : "border-line bg-white"}`}>
                    <input type="checkbox" checked={picked.has(t.user_id)} disabled={sent} onChange={() => toggle(t)} />
                    <span className="text-ink">{t.full_name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted">الحاضرون: <b className="num text-ink">{(r.attendees ?? []).length}</b></p>
          </div>
        )}
        {key === "files" && (
          <div>
            <p className="text-sm text-ink">
              {k.attendees ? "صور للتنفيذ أو ملف العرض" : "الشهادة أو الشاهد"}: حتى <span className="num">{PD_MAX_FILES}</span> ملفات، صور أو PDF (اختياري).
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(r.files ?? []).map((f) => (
                <div key={f.path} className="relative overflow-hidden rounded-sm2 border border-line bg-canvas">
                  {f.type === "pdf" ? <div className="grid h-28 place-items-center p-2 text-center text-xs text-muted">📄 {f.name}</div>
                    : urls[f.path] ? <img src={urls[f.path]} alt="" className="h-28 w-full object-cover" /> : <div className="h-28" />}
                  <button type="button" onClick={() => removeFile(f)} className="absolute left-1 top-1 rounded-pill bg-white/90 px-2 text-xs text-absent">حذف</button>
                </div>
              ))}
            </div>
            {(r.files ?? []).length < PD_MAX_FILES && (
              <label className="mt-2 inline-block cursor-pointer rounded-pill border border-mint-deep px-4 py-1.5 text-xs font-semibold text-mint-deep">
                {busy ? "جارٍ الرفع…" : "إضافة ملف"}
                <input type="file" accept="image/*,application/pdf" multiple className="hidden"
                       onChange={(e) => { upload([...e.target.files]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        )}
        {key === "signing" && (
          !sent ? (
            <div className="space-y-2">
              <p className="text-sm text-ink">راجع النموذج ثم أرسله للحاضرين ليوقّع كل منهم حضوره.</p>
              <button className="btn-primary w-full" disabled={busy} onClick={sendSign}>إرسال للحاضرين للتوقيع</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {r.attendees.map((a) => {
                  const g = sigs.find((x) => x.user_id === a.user_id);
                  return (
                    <div key={a.user_id} className="flex items-center justify-between gap-2 rounded-sm2 border border-line bg-white px-3 py-2 text-sm">
                      <span className="text-ink">{a.name}</span>
                      <span className={`chip shrink-0 ${g ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>{g ? "وقّع" : "بانتظار التوقيع"}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                {!allSigned && <button className="rounded-pill border border-mint-deep px-4 py-1.5 text-xs font-semibold text-mint-deep" onClick={remind}>تذكير من لم يوقّع</button>}
                <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy || !allSigned} onClick={submit}>
                  رفع لوكيل الشؤون التعليمية للاعتماد{!allSigned && " (بعد اكتمال التوقيعات)"}
                </button>
              </div>
            </div>
          )
        )}
        {key === "approval" && !k.attendees && (
          <div className="space-y-2">
            <p className="text-sm text-ink">راجع النموذج ثم ارفعه لوكيل الشؤون التعليمية للاعتماد.</p>
            <button className="btn-primary w-full" disabled={busy} onClick={submit}>
              {r.status === "returned" ? "إعادة الرفع للاعتماد" : "رفع للاعتماد"}
            </button>
          </div>
        )}
        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
        {stage <= editStageEnd && (
          <div className="flex gap-2">
            {stage > 0 && <button className="btn-ghost" onClick={() => go(stage - 1)}>السابق</button>}
            <button className="btn-primary flex-1" onClick={next}>حفظ والانتقال إلى «{stages[stage + 1].t}»</button>
          </div>
        )}
        {r.status === "draft" && <button className="text-xs text-absent underline" onClick={remove}>حذف المسودة</button>}
      </section>
      <SheetPreview r={r} sigs={sigs} />
    </div>
  );
}

function Viewer({ r, sigs, reload, uid, roles }) {
  const k = PD_KINDS[r.kind];
  const [note, setNote] = useState("");
  const [pnote, setPnote] = useState(r.principal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const mine = (r.attendees ?? []).some((a) => a.user_id === uid);
  const signed = sigs.some((g) => g.user_id === uid);
  const st = PD_STATUS[r.status] ?? PD_STATUS.draft;
  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return false; }
    setMsg({ ok: true, t: ok }); reload(); return true;
  };
  const sign = () => run(() => supabase.from("pd_signatures").insert({ report_id: r.id, user_id: uid,
    name: r.attendees.find((a) => a.user_id === uid)?.name ?? "" }), "وُقّع حضورك. شكرًا لك.");
  const decide = async (approve) => {
    if (await run(() => supabase.rpc("pd_decide", { p_id: r.id, p_approve: approve, p_note: note }),
      approve ? "اعتُمد النموذج وأُضيف لسجل التطوير المهني." : "أُعيد لصاحبه بملاحظتك.")) {
      await plcNotify([r.owner_user_id, ...(approve ? (r.attendees ?? []).map((a) => a.user_id) : [])],
        approve ? `اعتُمد «${k.short}»` : "أُعيد نموذج التطوير المهني بملاحظة",
        approve ? `اعتُمد «${r.data?.title ?? ""}» وأُضيف إلى سجل التطوير المهني.` : `أعاد وكيل الشؤون التعليمية «${r.data?.title ?? ""}»: ${note}`,
        `/pd/${r.id}`);
    }
  };
  const savePrincipal = () => run(() => supabase.rpc("pd_principal_note", { p_id: r.id, p_note: pnote }), "حُفظت ملاحظتك.");

  return (
    <div className="space-y-4">
      <div>
        <Link to="/pd" className="text-xs text-muted hover:underline">التطوير المهني ← نماذج سجل التطوير المهني</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">{r.data?.title || k.t}</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {r.serial} · {k.short} · {r.owner_name} <span className={`chip ${st.c}`}>{st.t}</span>
        </p>
      </div>
      {mine && r.status === "signing" && !signed && (
        <section className="card space-y-2 p-4">
          <p className="text-sm text-ink">اطّلع على النموذج أدناه، ثم وقّع حضورك.</p>
          <button className="btn-primary w-full" disabled={busy} onClick={sign}>أوقّع حضوري</button>
        </section>
      )}
      {mine && signed && <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">وقّعت حضورك.</p>}
      {roles.isDeputy && r.status === "pending" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">الاعتماد</p>
          <textarea rows={2} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (مطلوبة عند الإعادة)" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>اعتماد</button>
            <button className="flex-1 rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent"
                    disabled={busy || !note.trim()} onClick={() => decide(false)}>إعادة لصاحبه</button>
          </div>
        </section>
      )}
      {roles.isPrincipal && r.status !== "draft" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">ملاحظة مدير المدرسة</p>
          <textarea rows={2} className="field w-full" value={pnote} onChange={(e) => setPnote(e.target.value)} />
          <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={savePrincipal}>حفظ الملاحظة</button>
        </section>
      )}
      {!roles.isPrincipal && r.principal_note && (
        <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-ink"><b className="text-mint-deep">ملاحظة مدير المدرسة: </b>{r.principal_note}</p>
      )}
      {r.decision_note && <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink"><b>ملاحظة وكيل الشؤون التعليمية: </b>{r.decision_note}</p>}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}
      <SheetPreview r={r} sigs={sigs} />
    </div>
  );
}

/* --------------------------- النموذج المطبوع --------------------------- */
function SheetPreview({ r, sigs }) {
  const [urls, setUrls] = useState([]);
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    Promise.all((r.files ?? []).filter((f) => f.type !== "pdf").map((f) => fileUrl(f.path))).then(setUrls);
  }, [r.files]);
  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 80); };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">معاينة النموذج</p>
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={print}>طباعة / حفظ PDF</button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-canvas p-3">
        <div style={{ width: 794, margin: "0 auto" }}><PdSheet r={r} sigs={sigs} urls={urls} /></div>
      </div>
      {printing && <PrintPortal id="pd-print"><div id="pd-print"><PdSheet r={r} sigs={sigs} urls={urls} /></div></PrintPortal>}
    </section>
  );
}

export function PdSheet({ r, sigs, urls = [] }) {
  const k = PD_KINDS[r.kind];
  const d = r.data ?? {};
  const box = { border: `1.3px solid ${C.line}`, borderRadius: 8, padding: "5px 9px" };
  const lbl = { display: "block", color: C.green, fontSize: 10.5, fontWeight: 700 };
  const cell = { border: "1px solid #d8e4dc", padding: "5px 7px" };
  const val = (f) => f.type === "date" ? (d[f.key] ? fmtHijri(d[f.key]) : "") : d[f.key];
  const people = r.attendees ?? [];
  const half = Math.ceil(people.length / 2);
  const signedOf = (p) => p ? (sigs.some((g) => g.user_id === p.user_id) ? "✓ وُقّع إلكترونيًا" : "—") : "";
  const pdfs = (r.files ?? []).filter((f) => f.type === "pdf");
  return (
    <>
      <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", background: "#fff", padding: "12mm 13mm",
        color: "#1f2a24", fontSize: 12.5, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${C.green}`, paddingBottom: 10 }}>
          <div style={{ fontSize: 12, lineHeight: 1.7, fontWeight: 600 }}>المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<br />مدرسة مكة الثانوية</div>
          <img src={moeLogo} alt="" style={{ height: 58 }} />
          <div style={{ fontSize: 12, lineHeight: 1.7, fontWeight: 600, textAlign: "left" }}>العام الدراسي {r.academic_year}هـ<br />الرقم: <span dir="ltr">{r.serial}</span></div>
        </div>
        <h1 style={{ textAlign: "center", fontSize: 20, color: C.green, margin: "14px 0 4px", fontWeight: 700 }}>{k.t}</h1>
        <p style={{ textAlign: "center", color: C.soft, fontSize: 12 }}>
          شاهد سجل التطوير المهني · البند <span dir="ltr">{k.item}</span>
          {k.attendeeItem && <> (وللحاضرين <span dir="ltr">{k.attendeeItem}</span>)</>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 12 }}>
          <div style={box}><span style={lbl}>{k.owner}</span>{r.owner_name}</div>
          {k.info.filter((f) => val(f)).map((f) => <div key={f.key} style={box}><span style={lbl}>{f.t}</span>{val(f)}</div>)}
          {k.attendees && <div style={box}><span style={lbl}>عدد الحاضرين</span>{people.length}</div>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
          {k.content.filter((f) => lines(d[f.key]).length).map((f) => (
            <div key={f.key} style={{ ...box, padding: "7px 10px" }}>
              <p style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{f.t}</p>
              <ol style={{ paddingRight: 16, lineHeight: 1.75 }}>{lines(d[f.key]).map((x, i) => <li key={i}>{x}</li>)}</ol>
            </div>
          ))}
        </div>
        {k.attendees && people.length > 0 && (
          <>
            <p style={{ marginTop: 10, color: C.green, fontWeight: 700, textAlign: "center" }}>أسماء وتواقيع الحاضرين</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 11.5 }}>
              <thead><tr>{["م", "الاسم", "التوقيع", "م", "الاسم", "التوقيع"].map((h, i) =>
                <th key={i} style={{ background: C.green, color: "#fff", padding: 5 }}>{h}</th>)}</tr></thead>
              <tbody>{Array.from({ length: half }, (_, i) => {
                const a = people[i]; const b = people[i + half];
                return (
                  <tr key={i}>
                    <td style={cell}>{i + 1}</td><td style={cell}>{a.name}</td>
                    <td style={{ ...cell, color: "#2f7a4f", fontSize: 10.5, textAlign: "center" }}>{signedOf(a)}</td>
                    <td style={cell}>{b ? i + half + 1 : ""}</td><td style={cell}>{b?.name ?? ""}</td>
                    <td style={{ ...cell, color: "#2f7a4f", fontSize: 10.5, textAlign: "center" }}>{signedOf(b)}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </>
        )}
        {pdfs.length > 0 && <p style={{ marginTop: 8, fontSize: 11, color: C.soft }}>المرفقات: {pdfs.map((f) => f.name).join("، ")}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 18, textAlign: "center" }}>
          {[[k.owner, r.owner_name], ["وكيل الشؤون التعليمية", r.status === "approved" ? `${r.decided_name ?? ""} ✓ اعتمد` : ""],
            ["مدير المدرسة", PRINCIPAL_NAME]].map(([t, n]) => (
            <div key={t} style={{ borderTop: "1.3px dashed #b8cbbf", paddingTop: 6, fontSize: 11.5, lineHeight: 1.7 }}>{t}<br /><b>{n}</b></div>
          ))}
        </div>
        {r.principal_note && <div style={{ ...box, marginTop: 10 }}><span style={lbl}>ملاحظة مدير المدرسة</span>{r.principal_note}</div>}
        <p style={{ marginTop: 14, textAlign: "center", color: "#8a978f", fontSize: 10 }}>
          صدر من بوابة مكة الثانوية الرقمية · makkahsec.com{urls.length ? " · الشواهد المصورة في الصفحة التالية" : ""}
        </p>
      </div>
      {urls.length > 0 && (
        <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", background: "#fff", padding: "12mm 13mm",
          boxSizing: "border-box", pageBreakBefore: "always", marginTop: 12 }}>
          <p style={{ color: C.green, fontWeight: 700, textAlign: "center", fontSize: 16, marginBottom: 10 }}>الشواهد — {d.title}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {urls.filter(Boolean).map((u) => <img key={u} src={u} alt="" style={{ width: "100%", maxHeight: "82mm", objectFit: "contain", border: `1px solid ${C.line}`, borderRadius: 8 }} />)}
          </div>
        </div>
      )}
    </>
  );
}
