import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import {
  PLC_STAGES, PLC_STATUS, PLC_INFO, PLC_CONTENT, MAX_PHOTOS, PLC_BUCKET, stageMissing, lines,
  useMyDepartment, headLabel, loadDeptTeachers, photoUrl, plcNotify,
} from "../lib/plc";

/* =====================================================================
   التطوير المهني ← تقرير جلسة مجتمع التعلم المهني (src/lib/plc.js).
   /plc: قائمة الجلسات بحسب الدور، و/plc/:id: الجلسة بمراحلها أو عرضها.
   ===================================================================== */

const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
  on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

const HeadTag = ({ d }) => headLabel(d)
  ? <span className="chip bg-mint-light font-semibold text-mint-deep">{headLabel(d)}</span> : null;

function useRoles() {
  const { adminRoles = [] } = useSession();
  const has = (...r) => r.some((x) => adminRoles.includes(x));
  return { isDeputy: has("deputy_academic", "tech_support"), isPrincipal: has("principal", "tech_support"),
           isTech: has("tech_support"), seesAll: has("principal", "deputy_academic", "tech_support") };
}

/* ------------------------------ القائمة ------------------------------ */
export default function Plc() {
  const { id } = useParams();
  return id ? <Session id={id} /> : <SessionList />;
}

function SessionList() {
  const { session, profile } = useSession();
  const uid = session?.user?.id;
  const dept = useMyDepartment();
  const roles = useRoles();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("plc_sessions").select("*, departments(name), plc_signatures(user_id)")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data, error }) => {
        if (error) setErr(/plc_sessions|schema cache/i.test(error.message)
          ? "لم يُفعَّل التطوير المهني بعد في قاعدة البيانات." : error.message);
        setRows(data ?? []);
      });
  }, [uid]);

  const tabs = useMemo(() => {
    const t = [];
    if (dept?.is_head) t.push({ k: "mine", t: "جلسات قسمي" });
    t.push({ k: "sign", t: "للتوقيع" }, { k: "attended", t: "جلسات حضرتها" });
    if (roles.isDeputy) t.push({ k: "pending", t: "بانتظار الاعتماد" });
    if (roles.seesAll) t.push({ k: "all", t: "كل الجلسات" });
    return t;
  }, [dept, roles.isDeputy, roles.seesAll]);
  const cur = tab ?? (roles.isDeputy ? "pending" : roles.seesAll ? "all" : tabs[0]?.k);

  const attended = (r) => (r.attendees ?? []).some((a) => a.user_id === uid);
  const signed = (r) => (r.plc_signatures ?? []).some((g) => g.user_id === uid);
  const list = (rows ?? []).filter((r) =>
    cur === "mine" ? r.head_user_id === uid
    : cur === "sign" ? attended(r) && r.status === "signing" && !signed(r)
    : cur === "attended" ? attended(r)
    : cur === "pending" ? r.status === "pending" : true);
  const count = (k) => (rows ?? []).filter((r) =>
    k === "sign" ? attended(r) && r.status === "signing" && !signed(r) : k === "pending" && r.status === "pending").length;

  const create = async () => {
    const { year } = await loadActiveTerm();
    const { data, error } = await supabase.from("plc_sessions").insert({
      department_id: dept.department_id, head_user_id: uid, head_name: profile?.full_name ?? "",
      academic_year: year, data: { target: `معلمو قسم ${dept.department_name}` },
    }).select("id").single();
    if (error) { setErr(error.message); return; }
    navigate(`/plc/${data.id}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted">النماذج ← التطوير المهني</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">تقارير جلسات مجتمع التعلم المهني</h1>
          <HeadTag d={dept} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          يصدرها رئيس القسم ويوقّعها الحاضرون من معلمي قسمه، ويعتمدها وكيل الشؤون التعليمية، ويطّلع عليها
          مدير المدرسة. والمعتمدة تُضاف لكل من وقّع في سجل التطوير المهني (البند 2-6).
        </p>
      </div>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((t) => (
          <button key={t.k} className={pill(cur === t.k)} onClick={() => setTab(t.k)}>
            {t.t}{count(t.k) > 0 && <span className="num"> ({count(t.k)})</span>}
          </button>
        ))}
        {dept?.is_head && <button className="btn-primary mr-auto" onClick={create}>جلسة جديدة</button>}
        {roles.seesAll && <Link className="btn-ghost" to="/plc-departments">الأقسام وأعضاؤها</Link>}
      </div>

      {!rows ? <Loader compact /> : list.length === 0 ? (
        <p className="card px-4 py-6 text-sm text-muted">لا جلسات هنا.</p>
      ) : (
        <div className="space-y-2">
          {list.map((r) => {
            const st = PLC_STATUS[r.status] ?? PLC_STATUS.draft;
            const n = (r.attendees ?? []).length;
            const sg = (r.plc_signatures ?? []).length;
            return (
              <Link key={r.id} to={`/plc/${r.id}`} className="card flex flex-wrap items-center gap-2 p-3 hover:bg-canvas/50">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{r.data?.topic || "جلسة بلا موضوع بعد"}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {r.serial} · قسم {r.departments?.name}{r.data?.date ? ` · ${fmtDate(r.data.date)}` : ""} · {r.head_name}
                  </p>
                </div>
                {r.status === "signing" && <span className="chip bg-canvas text-muted">وقّع <span className="num mx-1">{sg}</span>من <span className="num mr-1">{n}</span></span>}
                {cur === "sign" ? <span className="chip bg-mint-deep text-white">وقّع الآن</span>
                  : <span className={`chip ${st.c}`}>{st.t}</span>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ الجلسة ------------------------------ */
function Session({ id }) {
  const { session, profile } = useSession();
  const uid = session?.user?.id;
  const roles = useRoles();
  const dept = useMyDepartment();
  const [s, setS] = useState(null);
  const [sigs, setSigs] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    const [{ data, error }, { data: g }] = await Promise.all([
      supabase.from("plc_sessions").select("*, departments(name)").eq("id", id).maybeSingle(),
      supabase.from("plc_signatures").select("user_id, name, signed_at").eq("session_id", id),
    ]);
    if (error || !data) { setErr(error?.message ?? "الجلسة غير موجودة أو لا تملك صلاحية عرضها."); return; }
    setS(data); setSigs(g ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (err) return <p className="card px-4 py-6 text-sm text-absent">{err}</p>;
  if (!s) return <Loader />;

  const isHead = s.head_user_id === uid;
  const editable = (isHead && ["draft", "signing", "returned"].includes(s.status)) || roles.isTech;
  return editable && s.status !== "approved" && s.status !== "pending"
    ? <Editor s={s} setS={setS} sigs={sigs} reload={load} dept={dept} />
    : <Viewer s={s} sigs={sigs} reload={load} uid={uid} roles={roles} profile={profile} />;
}

/* بطاقات: تُضيف سطرًا (متعدد) أو تضع القيمة (حقل واحد) */
function Chips({ items, onPick }) {
  if (!items?.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button key={t} type="button" onClick={() => onPick(t)}
                className="rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1 text-[11.5px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
          + {t}
        </button>
      ))}
    </div>
  );
}

function StageBar({ stage, reached, onPick }) {
  return (
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
      {PLC_STAGES.map((st, i) => {
        const ok = i < reached;
        const active = i === stage;
        return (
          <button key={st.key} type="button" disabled={i > reached} onClick={() => onPick(i)}
            className={`flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-[12.5px] font-medium transition-colors ${
              active ? "bg-mint-deep text-white"
              : i <= reached ? "border border-[#CCF2DB] bg-mint-tint text-mint-deep"
              : "border border-line bg-white text-faint"}`}>
            <span className={`num grid h-4 w-4 place-items-center rounded-full text-[10px] ${
              active ? "bg-white/25" : i <= reached ? "bg-white" : "bg-canvas"}`}>{ok ? "✓" : i + 1}</span>
            {st.t}
          </button>
        );
      })}
    </div>
  );
}

function Editor({ s, setS, sigs, reload, dept }) {
  const { session } = useSession();
  const uid = session?.user?.id;
  const sent = s.status !== "draft";
  // أبعد مرحلة وصلتها الجلسة: المكتمل من البداية، ثم التوقيع بعد الإرسال
  const firstMissing = ["info", "content", "attendees"].findIndex((k) => stageMissing(k, s).length);
  const reached = sent ? 5 : firstMissing === -1 ? 4 : firstMissing;
  const [stage, setStage] = useState(sent ? 4 : Math.min(reached, 3));
  const [teachers, setTeachers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [urls, setUrls] = useState({});

  useEffect(() => { loadDeptTeachers(s.department_id).then(setTeachers); }, [s.department_id]);
  useEffect(() => {
    (s.photos ?? []).forEach((p) => { if (!urls[p.path]) photoUrl(p.path).then((u) => setUrls((m) => ({ ...m, [p.path]: u }))); });
  }, [s.photos]);

  const save = async (patch) => {
    const next = { ...s, ...patch };
    setS(next);
    const { error } = await supabase.from("plc_sessions")
      .update({ ...patch, updated_at: new Date().toISOString() }).eq("id", s.id);
    if (error) setMsg({ ok: false, t: error.message });
    return !error;
  };
  const setData = (k, v) => setS((x) => ({ ...x, data: { ...x.data, [k]: v } }));
  const saveData = () => save({ data: s.data });
  const add = (k, t) => setData(k, s.data?.[k]?.trim() ? `${s.data[k].trim()}\n${t}` : t);

  const go = async (i) => { await saveData(); setStage(i); setMsg(null); };
  const next = async () => {
    const miss = stageMissing(PLC_STAGES[stage].key, s);
    if (miss.length) { setMsg({ ok: false, t: `أكمل: ${miss.join("، ")}.` }); return; }
    if (await saveData()) { setStage(stage + 1); setMsg(null); }
  };

  const others = (teachers ?? []).filter((t) => t.user_id !== s.head_user_id && t.user_id);
  const picked = new Set((s.attendees ?? []).map((a) => a.user_id));
  const toggle = (t) => save({ attendees: picked.has(t.user_id)
    ? s.attendees.filter((a) => a.user_id !== t.user_id)
    : [...(s.attendees ?? []), { teacher_id: t.teacher_id, user_id: t.user_id, name: t.name }] });

  const upload = async (files) => {
    setBusy(true); setMsg(null);
    const list = [...(s.photos ?? [])];
    for (const f of files) {
      if (list.length >= MAX_PHOTOS) { setMsg({ ok: false, t: `الحد ${MAX_PHOTOS} صور.` }); break; }
      if (!(f.type || "").startsWith("image/")) continue;
      const img = await shrinkImage(f, 1600, 0.85, { jpeg: true });
      const path = `${uid}/${s.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from(PLC_BUCKET).upload(path, img, { contentType: "image/jpeg" });
      if (error) { setMsg({ ok: false, t: error.message }); continue; }
      list.push({ path, name: f.name });
    }
    await save({ photos: list });
    setBusy(false);
  };
  const removePhoto = async (p) => {
    await supabase.storage.from(PLC_BUCKET).remove([p.path]);
    save({ photos: s.photos.filter((x) => x.path !== p.path) });
  };

  const send = async () => {
    setBusy(true);
    if (await save({ status: "signing", sent_at: new Date().toISOString() })) {
      await plcNotify(s.attendees.map((a) => a.user_id), "تقرير جلسة مجتمع التعلم المهني للتوقيع",
        `أرسل إليك رئيس القسم تقرير جلسة «${s.data?.topic ?? ""}» لتوقيعه.`, `/plc/${s.id}`);
      setMsg({ ok: true, t: "أُرسل التقرير للحاضرين للتوقيع." });
    }
    setBusy(false);
  };
  const remind = async () => {
    const left = s.attendees.filter((a) => !sigs.some((g) => g.user_id === a.user_id)).map((a) => a.user_id);
    await plcNotify(left, "تذكير: تقرير جلسة بانتظار توقيعك", `تقرير جلسة «${s.data?.topic ?? ""}» بانتظار توقيعك.`, `/plc/${s.id}`);
    setMsg({ ok: true, t: `أُرسل التذكير إلى ${left.length}.` });
  };
  const submit = async () => {
    setBusy(true); setMsg(null);
    if (s.status === "returned") await save({ status: "signing" });
    const { error } = await supabase.rpc("plc_submit", { p_id: s.id });
    if (error) { setMsg({ ok: false, t: error.message }); setBusy(false); return; }
    const { data: dep } = await supabase.from("admin_roles").select("user_id").eq("role_type", "deputy_academic");
    await plcNotify((dep ?? []).map((d) => d.user_id), "تقرير جلسة مجتمع تعلم بانتظار اعتمادك",
      `رفع ${s.head_name} تقرير جلسة «${s.data?.topic ?? ""}» للاعتماد.`, `/plc/${s.id}`);
    setBusy(false);
    reload();
  };
  const remove = async () => {
    if (!window.confirm("حذف المسودة نهائيًا؟")) return;
    await supabase.from("plc_sessions").delete().eq("id", s.id);
    window.history.back();
  };

  const allSigned = (s.attendees ?? []).every((a) => sigs.some((g) => g.user_id === a.user_id));
  const key = PLC_STAGES[stage].key;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/plc" className="text-xs text-muted hover:underline">النماذج ← التطوير المهني</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">تقرير جلسة مجتمع التعلم المهني</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {s.serial} · قسم {s.departments?.name} <HeadTag d={dept} />
          <span className={`chip ${PLC_STATUS[s.status]?.c}`}>{PLC_STATUS[s.status]?.t}</span>
        </p>
      </div>

      {s.status === "returned" && s.decision_note && (
        <p className="rounded-sm2 bg-absent/5 px-3 py-2 text-sm text-absent">
          <b>ملاحظة وكيل الشؤون التعليمية: </b>{s.decision_note}
        </p>
      )}

      <StageBar stage={stage} reached={reached} onPick={go} />

      <section className="card space-y-4 p-4">
        {key === "info" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {PLC_INFO.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-semibold text-ink">{f.t}{f.required && <span className="text-absent"> *</span>}</label>
                <input type={f.type ?? "text"} className={`field mt-1 w-full ${f.type === "date" ? "num" : ""}`}
                       value={s.data?.[f.key] ?? ""} onChange={(e) => setData(f.key, e.target.value)} />
                <Chips items={f.presets} onPick={(t) => setData(f.key, t)} />
              </div>
            ))}
          </div>
        )}

        {key === "content" && (
          <div className="grid gap-4 md:grid-cols-2">
            {PLC_CONTENT.map((f) => (
              <div key={f.key} className={f.key === "intro" ? "md:col-span-2" : ""}>
                <label className="text-xs font-semibold text-ink">{f.t} <span className="text-absent">*</span></label>
                <Chips items={f.presets} onPick={(t) => add(f.key, t)} />
                <textarea rows={f.key === "intro" ? 2 : 5} className="field mt-1.5 w-full text-sm leading-relaxed"
                          value={s.data?.[f.key] ?? ""} onChange={(e) => setData(f.key, e.target.value)}
                          placeholder={f.key === "intro" ? "اختر صيغة أو اكتب" : "كل بند في سطر — اختر من البطاقات أو اكتب"} />
              </div>
            ))}
            <p className="text-[11.5px] text-muted md:col-span-2">البطاقة تضيف سطرًا دون أن تمسح ما كُتب.</p>
          </div>
        )}

        {key === "attendees" && (
          <div>
            <p className="text-sm text-ink">أشّر على من حضر من معلمي القسم. يصل كل حاضر التقرير ليوقّعه.</p>
            {!teachers ? <Loader compact /> : others.length === 0 ? (
              <p className="mt-2 text-sm text-muted">لا معلمين مرتبطين بالقسم بعد. تضيفهم الإدارة من «الأقسام وأعضاؤها».</p>
            ) : (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {others.map((t) => (
                  <label key={t.user_id} className={`flex cursor-pointer items-center gap-2 rounded-sm2 border px-3 py-2 text-sm ${
                    picked.has(t.user_id) ? "border-mint-deep bg-mint-tint" : "border-line bg-white"}`}>
                    <input type="checkbox" checked={picked.has(t.user_id)} disabled={sent} onChange={() => toggle(t)} />
                    <span className="text-ink">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted">
              عدد الحضور: <b className="num text-ink">{(s.attendees ?? []).length + 1}</b> (مع رئيس القسم)
              {sent && " · لا يُعدَّل الحاضرون بعد الإرسال للتوقيع."}
            </p>
          </div>
        )}

        {key === "photos" && (
          <div>
            <p className="text-sm text-ink">شواهد مصورة للجلسة: <span className="num">{MAX_PHOTOS}</span> صور كحد أقصى (اختياري).</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(s.photos ?? []).map((p) => (
                <div key={p.path} className="relative overflow-hidden rounded-sm2 border border-line">
                  {urls[p.path] ? <img src={urls[p.path]} alt="" className="h-28 w-full object-cover" /> : <div className="h-28 bg-canvas" />}
                  <button type="button" onClick={() => removePhoto(p)}
                          className="absolute left-1 top-1 rounded-pill bg-white/90 px-2 text-xs text-absent">حذف</button>
                </div>
              ))}
            </div>
            {(s.photos ?? []).length < MAX_PHOTOS && (
              <label className="mt-2 inline-block cursor-pointer rounded-pill border border-mint-deep px-4 py-1.5 text-xs font-semibold text-mint-deep">
                {busy ? "جارٍ الرفع…" : "إضافة صور"}
                <input type="file" accept="image/*" multiple className="hidden"
                       onChange={(e) => { upload([...e.target.files]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        )}

        {key === "signing" && (
          <div className="space-y-3">
            {!sent ? (
              <>
                <p className="text-sm text-ink">راجع التقرير ثم أرسله للحاضرين ليوقّع كل منهم بنفسه.</p>
                <button className="btn-primary w-full" disabled={busy} onClick={send}>إرسال للحاضرين للتوقيع</button>
              </>
            ) : (
              <>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {s.attendees.map((a) => {
                    const g = sigs.find((x) => x.user_id === a.user_id);
                    return (
                      <div key={a.user_id} className="flex items-center justify-between gap-2 rounded-sm2 border border-line bg-white px-3 py-2 text-sm">
                        <span className="text-ink">{a.name}</span>
                        <span className={`chip shrink-0 ${g ? "bg-present/10 text-present" : "bg-warning-light text-warning"}`}>
                          {g ? "وقّع" : "بانتظار التوقيع"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!allSigned && <button className="rounded-pill border border-mint-deep px-4 py-1.5 text-xs font-semibold text-mint-deep" onClick={remind}>تذكير من لم يوقّع</button>}
                  <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy || !allSigned} onClick={submit}>
                    {s.status === "returned" ? "إعادة الرفع للاعتماد" : "رفع لوكيل الشؤون التعليمية للاعتماد"}
                    {!allSigned && " (بعد اكتمال التوقيعات)"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

        {stage < 4 && (
          <div className="flex gap-2">
            {stage > 0 && <button className="btn-ghost" onClick={() => go(stage - 1)}>السابق</button>}
            <button className="btn-primary flex-1" onClick={next}>حفظ والانتقال إلى «{PLC_STAGES[stage + 1].t}»</button>
          </div>
        )}
        {s.status === "draft" && <button className="text-xs text-absent underline" onClick={remove}>حذف المسودة</button>}
      </section>

      <SheetPreview s={s} sigs={sigs} />
    </div>
  );
}

/* --------------------------- العرض والإجراءات --------------------------- */
function Viewer({ s, sigs, reload, uid, roles }) {
  const [note, setNote] = useState("");
  const [pnote, setPnote] = useState(s.principal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const mine = (s.attendees ?? []).some((a) => a.user_id === uid);
  const signed = sigs.some((g) => g.user_id === uid);
  const st = PLC_STATUS[s.status] ?? PLC_STATUS.draft;

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    if (error) { setMsg({ ok: false, t: error.message }); return false; }
    setMsg({ ok: true, t: ok }); reload();
    return true;
  };
  const sign = () => run(() => supabase.from("plc_signatures").insert({ session_id: s.id, user_id: uid,
    name: s.attendees.find((a) => a.user_id === uid)?.name ?? "" }), "وُقّع التقرير. شكرًا لك.");
  const decide = async (approve) => {
    if (await run(() => supabase.rpc("plc_decide", { p_id: s.id, p_approve: approve, p_note: note }),
      approve ? "اعتُمد التقرير، وأُضيف لسجل التطوير المهني لمن وقّع." : "أُعيد التقرير لرئيس القسم بملاحظتك.")) {
      await plcNotify([s.head_user_id, ...(approve ? s.attendees.map((a) => a.user_id) : [])],
        approve ? "اعتُمد تقرير جلسة مجتمع التعلم المهني" : "أُعيد تقرير الجلسة بملاحظة",
        approve ? `اعتُمد تقرير جلسة «${s.data?.topic ?? ""}» وأُضيف إلى سجل التطوير المهني.`
                : `أعاد وكيل الشؤون التعليمية تقرير «${s.data?.topic ?? ""}»: ${note}`, `/plc/${s.id}`);
    }
  };
  const savePrincipal = async () => {
    if (await run(() => supabase.rpc("plc_principal_note", { p_id: s.id, p_note: pnote }), "حُفظت ملاحظتك.")) {
      await plcNotify([s.head_user_id], "ملاحظة مدير المدرسة على تقرير جلسة",
        `كتب مدير المدرسة ملاحظة على تقرير «${s.data?.topic ?? ""}».`, `/plc/${s.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/plc" className="text-xs text-muted hover:underline">النماذج ← التطوير المهني</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">{s.data?.topic || "تقرير جلسة مجتمع التعلم المهني"}</h1>
        <p className="num mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {s.serial} · قسم {s.departments?.name} · {s.head_name} <span className={`chip ${st.c}`}>{st.t}</span>
        </p>
      </div>

      {mine && s.status === "signing" && !signed && (
        <section className="card space-y-2 p-4">
          <p className="text-sm text-ink">اطّلع على التقرير أدناه، ثم وقّع بحضورك الجلسة.</p>
          <button className="btn-primary w-full" disabled={busy} onClick={sign}>أوقّع على التقرير</button>
        </section>
      )}
      {mine && signed && <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm text-present">وقّعت على هذا التقرير.</p>}

      {roles.isDeputy && s.status === "pending" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">الاعتماد</p>
          <textarea rows={2} className="field w-full" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder="ملاحظة (مطلوبة عند الإعادة)" />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>اعتماد التقرير</button>
            <button className="flex-1 rounded-pill border border-absent/40 py-2 text-sm font-semibold text-absent"
                    disabled={busy || !note.trim()} onClick={() => decide(false)}>إعادة لرئيس القسم</button>
          </div>
        </section>
      )}

      {roles.isPrincipal && s.status !== "draft" && (
        <section className="card space-y-2 p-4">
          <p className="text-sm font-semibold text-ink">ملاحظة مدير المدرسة <span className="font-normal text-muted">— توجيه أو تغذية راجعة لرئيس القسم</span></p>
          <textarea rows={2} className="field w-full" value={pnote} onChange={(e) => setPnote(e.target.value)} />
          <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy} onClick={savePrincipal}>حفظ الملاحظة وإشعار رئيس القسم</button>
        </section>
      )}
      {!roles.isPrincipal && s.principal_note && (
        <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-sm text-ink"><b className="text-mint-deep">ملاحظة مدير المدرسة: </b>{s.principal_note}</p>
      )}
      {s.decision_note && (
        <p className="rounded-sm2 bg-canvas px-3 py-2 text-sm text-ink"><b>ملاحظة وكيل الشؤون التعليمية: </b>{s.decision_note}</p>
      )}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.t}</p>}

      <SheetPreview s={s} sigs={sigs} />
    </div>
  );
}

/* --------------------------- التقرير المطبوع --------------------------- */
function SheetPreview({ s, sigs }) {
  const [urls, setUrls] = useState([]);
  const [printing, setPrinting] = useState(false);
  useEffect(() => { Promise.all((s.photos ?? []).map((p) => photoUrl(p.path))).then(setUrls); }, [s.photos]);
  const print = () => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 80); };
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">معاينة التقرير</p>
        <button className="btn-ghost px-4 py-1.5 text-xs" onClick={print}>طباعة / حفظ PDF</button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-canvas p-3">
        <div style={{ width: 794, margin: "0 auto" }}><PlcSheet s={s} sigs={sigs} urls={urls} /></div>
      </div>
      {printing && <PrintPortal id="plc-print"><div id="plc-print"><PlcSheet s={s} sigs={sigs} urls={urls} /></div></PrintPortal>}
    </section>
  );
}

const C = { green: "#3e6350", line: "#cfe0d6", soft: "#6b7a72" };
const box = { border: `1.3px solid ${C.line}`, borderRadius: 8, padding: "6px 10px" };
const lbl = { display: "block", color: C.green, fontSize: 10.5, fontWeight: 700 };

function PlcSheet({ s, sigs, urls }) {
  const d = s.data ?? {};
  const day = d.date ? new Date(`${d.date}T12:00:00`).toLocaleDateString("ar-SA-u-ca-islamic", { weekday: "long" }) : "";
  const signedAt = (uidv) => sigs.find((g) => g.user_id === uidv);
  const people = [{ user_id: s.head_user_id, name: s.head_name, head: true }, ...(s.attendees ?? [])];
  const half = Math.ceil(people.length / 2);
  const cell = { border: "1px solid #d8e4dc", padding: "5px 7px" };
  const sigCell = (p) => p ? (p.head || signedAt(p.user_id) ? "✓ وُقّع إلكترونيًا" : "—") : "";
  const Box = ({ t, k }) => (
    <div style={box}>
      <p style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{t}</p>
      <ol style={{ paddingRight: 16, lineHeight: 1.75 }}>{lines(d[k]).map((x, i) => <li key={i}>{x}</li>)}</ol>
    </div>
  );
  return (
    <>
      <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", background: "#fff", padding: "12mm 13mm",
        color: "#1f2a24", fontSize: 12.5, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `2.5px solid ${C.green}`, paddingBottom: 10 }}>
          <div style={{ fontSize: 12, lineHeight: 1.7, fontWeight: 600 }}>المملكة العربية السعودية<br />وزارة التعليم<br />الإدارة العامة للتعليم بمنطقة مكة المكرمة<br />مدرسة مكة الثانوية</div>
          <img src={moeLogo} alt="" style={{ height: 58 }} />
          <div style={{ fontSize: 12, lineHeight: 1.7, fontWeight: 600, textAlign: "left" }}>
            العام الدراسي {s.academic_year}هـ<br />الرقم: <span dir="ltr">{s.serial}</span>
          </div>
        </div>
        <h1 style={{ textAlign: "center", fontSize: 20, color: C.green, margin: "14px 0 4px", fontWeight: 700 }}>تقرير جلسة مجتمع التعلم المهني</h1>
        <p style={{ textAlign: "center", color: C.soft, fontSize: 12 }}>قسم {s.departments?.name} · شاهد للبند «تفعيل دوره في مجتمعات التعلم المهنية»</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7, marginTop: 12 }}>
          {PLC_INFO.map((f) => (
            <div key={f.key} style={box}>
              <span style={lbl}>{f.key === "date" ? "اليوم / التاريخ" : f.t}</span>
              {f.key === "date" ? (d.date ? `${day} ${fmtHijri(d.date)}` : "") : d[f.key]}
            </div>
          ))}
          <div style={box}><span style={lbl}>عدد الحضور</span>{people.length}</div>
        </div>

        <div style={{ ...box, marginTop: 8 }}>
          <p style={{ color: C.green, fontWeight: 700, fontSize: 12, marginBottom: 3 }}>مقدمة</p>{d.intro}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <Box t="أهداف الجلسة" k="goals" /><Box t="المناقشات" k="talks" />
          <Box t="نتائج الجلسة" k="results" /><Box t="التوصيات" k="recs" />
        </div>

        <p style={{ marginTop: 10, color: C.green, fontWeight: 700, textAlign: "center" }}>أسماء وتواقيع الحاضرين</p>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 11.5 }}>
          <thead><tr>{["م", "الاسم", "التوقيع", "م", "الاسم", "التوقيع"].map((h, i) =>
            <th key={i} style={{ background: C.green, color: "#fff", padding: 5 }}>{h}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: half }, (_, i) => {
              const a = people[i]; const b = people[i + half];
              return (
                <tr key={i}>
                  <td style={cell}>{i + 1}</td><td style={cell}>{a.name}{a.head ? " (رئيس القسم)" : ""}</td>
                  <td style={{ ...cell, color: "#2f7a4f", fontSize: 10.5, textAlign: "center" }}>{sigCell(a)}</td>
                  <td style={cell}>{b ? i + half + 1 : ""}</td><td style={cell}>{b?.name ?? ""}</td>
                  <td style={{ ...cell, color: "#2f7a4f", fontSize: 10.5, textAlign: "center" }}>{sigCell(b)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 16, textAlign: "center" }}>
          {[["رئيس القسم (المنفّذ)", s.head_name],
            ["وكيل الشؤون التعليمية", s.status === "approved" ? `${s.decided_name ?? ""} ✓ اعتمد` : ""],
            ["مدير المدرسة", PRINCIPAL_NAME]].map(([t, n]) => (
            <div key={t} style={{ borderTop: "1.3px dashed #b8cbbf", paddingTop: 6, fontSize: 11.5, lineHeight: 1.7 }}>
              {t}<br /><b>{n}</b>
            </div>
          ))}
        </div>
        {s.principal_note && (
          <div style={{ ...box, marginTop: 10 }}><span style={lbl}>ملاحظة مدير المدرسة</span>{s.principal_note}</div>
        )}
        <p style={{ marginTop: 14, textAlign: "center", color: "#8a978f", fontSize: 10 }}>
          صدر من بوابة مكة الثانوية الرقمية · makkahsec.com{urls.length ? " · الشواهد المصورة في الصفحة التالية" : ""}
        </p>
      </div>
      {urls.length > 0 && (
        <div className="sheet" dir="rtl" style={{ width: "210mm", minHeight: "297mm", background: "#fff", padding: "12mm 13mm",
          boxSizing: "border-box", pageBreakBefore: "always", marginTop: 12 }}>
          <p style={{ color: C.green, fontWeight: 700, textAlign: "center", fontSize: 16, marginBottom: 10 }}>الشواهد المصورة — {d.topic}</p>
          <div style={{ display: "grid", gap: 10 }}>
            {urls.filter(Boolean).map((u) => <img key={u} src={u} alt="" style={{ width: "100%", maxHeight: "82mm", objectFit: "contain", border: `1px solid ${C.line}`, borderRadius: 8 }} />)}
          </div>
        </div>
      )}
    </>
  );
}

/* ----------------------- الأقسام وأعضاؤها (للإدارة) -----------------------
   المدير ووكيل الشؤون التعليمية والدعم الفني: نقل معلم بين الأقسام، وتعيين الرئيس. */
export function PlcDepartments() {
  const roles = useRoles();
  const [depts, setDepts] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    const [d, t, m] = await Promise.all([
      supabase.from("departments").select("id, name").order("sort_order"),
      supabase.from("teachers").select("id, full_name").order("full_name"),
      supabase.from("department_members").select("department_id, teacher_id, is_head"),
    ]);
    if (d.error) setErr(d.error.message);
    setDepts(d.data ?? []); setTeachers(t.data ?? []); setMembers(m.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const act = async (q) => { const { error } = await q; if (error) setErr(error.message); else { setErr(""); load(); } };
  const assign = (deptId, teacherId) => act(supabase.from("department_members")
    .upsert({ department_id: deptId, teacher_id: teacherId, is_head: false }, { onConflict: "teacher_id" }));
  const removeM = (m) => act(supabase.from("department_members").delete().eq("teacher_id", m.teacher_id));
  const makeHead = async (m) => {
    await supabase.from("department_members").update({ is_head: false }).eq("department_id", m.department_id);
    act(supabase.from("department_members").update({ is_head: true }).eq("teacher_id", m.teacher_id));
  };

  if (!roles.seesAll) return <p className="card px-4 py-6 text-sm text-muted">هذه الصفحة للإدارة.</p>;
  if (!depts) return <Loader />;
  const name = (id) => teachers.find((t) => t.id === id)?.full_name ?? "—";
  const free = teachers.filter((t) => !members.some((m) => m.teacher_id === t.id));

  return (
    <div className="space-y-4">
      <div>
        <Link to="/plc" className="text-xs text-muted hover:underline">التطوير المهني</Link>
        <h1 className="mt-0.5 text-lg font-bold text-ink">الأقسام وأعضاؤها</h1>
        <p className="mt-1 text-sm text-muted">
          الأسماء من سجل المعلمين في البوابة. المعلم في قسم واحد، ولكل قسم رئيس واحد يصدر تقارير الجلسات.
          غير المرتبطين: <b className="num text-ink">{free.length}</b>
        </p>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {depts.map((d) => {
          const list = members.filter((m) => m.department_id === d.id)
            .sort((a, b) => (b.is_head - a.is_head) || name(a.teacher_id).localeCompare(name(b.teacher_id), "ar"));
          return (
            <section key={d.id} className="card p-3">
              <p className="font-semibold text-ink">{d.name} <span className="num text-xs font-normal text-muted">({list.length})</span></p>
              <ul className="mt-2 space-y-1">
                {list.map((m) => (
                  <li key={m.teacher_id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 text-ink">{name(m.teacher_id)}</span>
                    {m.is_head ? <span className="chip bg-mint-light font-semibold text-mint-deep">رئيس قسم {d.name}</span>
                      : <button className="text-xs text-mint-deep underline" onClick={() => makeHead(m)}>تعيين رئيسًا</button>}
                    <button className="text-xs text-absent underline" onClick={() => removeM(m)}>إزالة</button>
                  </li>
                ))}
              </ul>
              <select className="field mt-2 w-full text-sm" value="" onChange={(e) => e.target.value && assign(d.id, e.target.value)}>
                <option value="">+ إضافة معلم غير مرتبط…</option>
                {free.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </section>
          );
        })}
      </div>
    </div>
  );
}
