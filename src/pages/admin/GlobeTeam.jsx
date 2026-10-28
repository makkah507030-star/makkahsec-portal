// src/pages/admin/GlobeTeam.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate } from "../../lib/dates";
import { byClassName } from "../../lib/sortAr.js";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import PrintPortal from "../../components/PrintPortal.jsx";
import { printThen } from "../../lib/print.js";
import moeLogo from "../../assets/moe-logo.png";
import logoIcon from "../../assets/icon-mint.png";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import { PRINCIPAL_NAME } from "../../lib/signers.js";
import { ROLE_PERSON_NAME } from "../../lib/session.jsx";
import { cleanMobile } from "../../lib/importer";
import GlobeMark from "../../components/GlobeMark.jsx";
import { GLOBE_FULL, GLOBE_MEANING } from "../../lib/globe.js";
import GlobePlan from "../globe/GlobePlan.jsx";
import GlobeMonitor from "../globe/GlobeMonitor.jsx";
import GlobeReport from "../globe/GlobeReport.jsx";

/* =====================================================================
   طلاب برنامج جلوب البيئي العالمي (supabase/globe_1.sql):
   من له صلاحية «برنامج جلوب» (حساب البرنامج، والمدير والدعم الفني) يضيف
   طلاب البرنامج من أي فصل ويحذفهم، ويتواصل معهم ومع أولياء أمورهم بالواتساب،
   ويطبع كشفهم. وبطاقاتهم في الاستوديو (قالب «بطاقة جلوب»).
   وتبويبا «خطة البرنامج» و«خطة الرصد» وتقريرهما في pages/globe.
   ===================================================================== */

const classLabel = (c) => (c ? `${GRADE_NAMES[c.grade] ?? ""} · فصل ${c.class_no}` : "—");
// 966XXXXXXXXX ← 05XXXXXXXX للعرض
const localMobile = (m) => (m?.startsWith("966") ? "0" + m.slice(3) : m ?? "");

const WA_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1.1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);

// خانة جوال: الرقم، ثم زرا اتصال وواتساب للتواصل العاجل وخارج الدوام
function Phone({ mobile, text }) {
  if (!mobile) return <span className="text-faint">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <a href={`tel:+${mobile}`} className="num font-medium text-ink hover:text-mint-deep" dir="ltr">{localMobile(mobile)}</a>
      <a href={`https://wa.me/${mobile}${text ? `?text=${encodeURIComponent(text)}` : ""}`} target="_blank" rel="noopener noreferrer" title="مراسلة على واتساب"
         className="inline-flex items-center gap-1 rounded-pill bg-[#25D366]/12 px-2 py-0.5 text-[11px] font-semibold text-[#128C7E] hover:bg-[#25D366]/20">
        {WA_ICON}واتساب
      </a>
    </span>
  );
}

function Cell({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-medium text-faint">{label}</p>
      <div className="mt-0.5 text-[12.5px] text-ink">{children}</div>
    </div>
  );
}

const GLOBE_URL = "https://www.globe.gov";

const GOV = ["المملكة العربية السعودية", "وزارة التعليم", "الإدارة العامة للتعليم بمنطقة مكة المكرمة"];

export default function GlobeTeam() {
  const { profile } = useSession();
  const [members, setMembers] = useState(null);
  const [missing, setMissing] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [pool, setPool] = useState(null);       // طلاب الفصل المختار
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);       // student_id قيد الإضافة أو الحذف
  const [msg, setMsg] = useNotice(null);
  const [printing, setPrinting] = useState(false);
  const [mobEdit, setMobEdit] = useState(null); // { id, v } جوال الطالب قيد التعديل
  const [tab, setTabRaw] = useState("students"); // students | plan | monitor | report
  const [prevTab, setPrevTab] = useState("plan");
  const setTab = (t) => { if (t === "report") setPrevTab(tab); setTabRaw(t); };
  const [waText, setWaText] = useState("");     // نص جاهز يُفتح به الواتساب لكل طالب وولي أمر
  // توقيعا الكشف: منسق البرنامج ومدير المدرسة
  const leaderName = (ROLE_PERSON_NAME.globe_program ?? "").replace(/^الأستاذ:\s*/, "");
  const principal = usePrincipalSignature();

  const load = async () => {
    const { data, error } = await supabase.from("globe_members")
      .select("*, students(full_name, national_id, student_enrollment(status, classes(grade, class_no)))");
    if (error) { setMissing(true); setMembers([]); return; }
    // جوال ولي الأمر للتواصل
    const { data: mob, error: mobErr } = await supabase.rpc("globe_roster");
    if (mobErr) setMsg({ ok: false, text: `تعذّر جلب جوالات أولياء الأمور: ${mobErr.message}` });
    const mobileOf = Object.fromEntries((mob ?? []).map((x) => [x.student_id, x.mobile]));
    setMembers((data ?? []).map((r) => {
      const en = (r.students?.student_enrollment ?? []).find((e) => e.status === "active");
      return { id: r.student_id, full_name: r.students?.full_name ?? "—", national_id: r.students?.national_id,
               grade: en?.classes?.grade, class_no: en?.classes?.class_no, added_at: r.added_at, added_by_name: r.added_by_name,
               mobile: mobileOf[r.student_id] ?? null,
               student_mobile: r.student_mobile ?? null };
    }).sort(byClassName()));
  };

  useEffect(() => {
    load();
    (async () => {
      const { data: st } = await supabase.from("settings").select("value").eq("key", "active_year").maybeSingle();
      const { data } = await supabase.from("classes").select("id, grade, class_no")
        .eq("academic_year", st?.value ?? "").eq("is_active", true);
      setClasses((data ?? []).sort((a, b) => a.grade - b.grade || a.class_no - b.class_no));
    })();
  }, []);

  useEffect(() => {
    setPool(null);
    if (!classId) return;
    (async () => {
      const { data } = await supabase.from("student_enrollment")
        .select("students(id, full_name, national_id)").eq("class_id", classId).eq("status", "active");
      setPool((data ?? []).map((r) => r.students).filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    })();
  }, [classId]);

  const inTeam = useMemo(() => new Set((members ?? []).map((m) => m.id)), [members]);

  const add = async (s) => {
    setBusy(s.id);
    const { error } = await supabase.from("globe_members")
      .insert({ student_id: s.id, added_by_name: profile?.full_name ?? null });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `أُضيف ${s.full_name} إلى البرنامج.` });
    load();
  };

  const remove = async (m) => {
    if (!(await confirmDanger({
      title: `حذف ${m.full_name} من برنامج جلوب`,
      impact: ["يُحذف من كشف البرنامج فقط، ولا يتأثر سجله في المدرسة.", "يمكن إضافته مرة أخرى في أي وقت."],
      confirmLabel: "حذف من البرنامج",
    }))) return;
    setBusy(m.id);
    const { error } = await supabase.from("globe_members").delete().eq("student_id", m.id);
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `حُذف ${m.full_name} من البرنامج.` });
    load();
  };

  // جوال الطالب نفسه للتواصل
  const saveMobile = async (m) => {
    const raw = mobEdit?.v?.trim() ?? "";
    const mobile = raw ? cleanMobile(raw) : null;
    if (raw && !mobile) { setMsg({ ok: false, text: "رقم الجوال غير صحيح؛ اكتبه بصيغة 05XXXXXXXX." }); return; }
    setBusy(m.id);
    const { error } = await supabase.from("globe_members").update({ student_mobile: mobile }).eq("student_id", m.id);
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMobEdit(null);
    setMsg({ ok: true, text: mobile ? `حُفظ جوال ${m.full_name}.` : `حُذف جوال ${m.full_name}.` });
    load();
  };

  const shown = useMemo(() => {
    const t = q.trim();
    return t ? (members ?? []).filter((m) => m.full_name.includes(t) || (m.national_id ?? "").includes(t)) : members ?? [];
  }, [members, q]);

  if (!members) return <Loader />;
  if (tab === "report") return <GlobeReport leader={leaderName} members={members} onBack={() => setTab(prevTab)} />;

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0B5394]/10 text-[#0B5394]"><GlobeMark className="h-7 w-7" /></span>
        <div>
          <h1 className="text-lg font-bold text-ink">طلاب برنامج جلوب</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            طلاب برنامج جلوب البيئي العالمي من كل الفصول: أضف الطالب من فصله، واحفظ جواله، وتواصل معه
            ومع ولي أمره بالواتساب. وبطاقاتهم الطولية في «استوديو البوابة» ← بطاقة طالب جلوب.
          </p>
        </div>
      </div>

      <a href={GLOBE_URL} target="_blank" rel="noopener noreferrer"
         className="card flex items-center gap-3 px-4 py-3 transition-colors hover:border-mint-light hover:bg-mint-tint/50">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#2E7D32]/10 text-[#2E7D32]"><GlobeMark className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">برنامج GLOBE العالمي</span>
          <span className="block text-xs text-muted">{GLOBE_MEANING} — الموقع الرسمي</span>
          <span className="block text-[10.5px] text-faint" dir="ltr">{GLOBE_FULL}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-mint-deep">زيارة الموقع ←</span>
      </a>

      <div className="flex gap-1 overflow-x-auto rounded-pill border border-line bg-paper p-1">
        {[["students", `الطلاب (${members.length})`], ["plan", "خطة البرنامج"], ["monitor", "خطة الرصد"]].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 whitespace-nowrap rounded-pill px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    tab === k ? "bg-mint-deep text-white" : "text-muted hover:bg-canvas"}`}>{t}</button>
        ))}
      </div>

      {tab === "plan" && <GlobePlan me={profile?.full_name} onReport={() => setTab("report")} />}
      {tab === "monitor" && <GlobeMonitor me={profile?.full_name} members={members} onReport={() => setTab("report")} />}
      {tab === "students" && (missing ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          الصفحة تحتاج تنفيذ ملف supabase/globe_1.sql في قاعدة البيانات مرة واحدة.
        </div>
      ) : (
        <>
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">إضافة طالب</h2>
            <select className="field w-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">اختر الفصل…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
            {classId && !pool && <Loader />}
            {pool?.length === 0 && <p className="text-sm text-muted">لا طلاب في هذا الفصل.</p>}
            {pool?.length > 0 && (
              <div className="max-h-80 divide-y divide-line overflow-y-auto rounded-sm2 border border-line">
                {pool.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">{s.full_name}</p>
                    <span className="num text-xs text-muted" dir="ltr">{s.national_id}</span>
                    {inTeam.has(s.id)
                      ? <span className="chip bg-present/10 text-present">في البرنامج</span>
                      : <button onClick={() => add(s)} disabled={busy === s.id}
                                className="rounded-pill bg-mint-deep px-3 py-1 text-xs font-semibold text-white">
                          {busy === s.id ? "…" : "إضافة"}
                        </button>}
                  </div>
                ))}
              </div>
            )}
            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                طلاب البرنامج <span className="num text-muted">({members.length})</span>
              </h2>
              {members.length > 0 && (
                <button onClick={() => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 150); }}
                        className="ms-auto text-xs font-semibold text-mint-deep">طباعة الكشف</button>
              )}
            </div>
            {members.length > 0 && (
              <div className="border-b border-line bg-[#25D366]/5 p-3">
                <label className="text-[11px] font-semibold text-[#128C7E]">رسالة واتساب جاهزة (اختياري)</label>
                <textarea className="field mt-1 min-h-[3.5rem] w-full text-sm" value={waText} onChange={(e) => setWaText(e.target.value)}
                          placeholder="مثال: نذكّركم بموعد الرصد البيئي غدًا بعد الحصة السادسة في ساحة المدرسة." />
                <p className="mt-1 text-[11px] text-muted">يُفتح بها زر «واتساب» عند كل طالب وولي أمر، ويبقى الإرسال بيدك.</p>
              </div>
            )}
            {members.length > 5 && (
              <div className="border-b border-line p-3">
                <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو رقم الهوية" />
              </div>
            )}
            {members.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا طلاب بعد. اختر فصلًا وأضف الطلاب.</p>}
            <div className="divide-y divide-line">
              {shown.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{m.full_name}</p>
                    <button onClick={() => remove(m)} disabled={busy === m.id}
                            className="shrink-0 text-xs font-medium text-absent hover:underline">حذف</button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-sm2 border border-line bg-canvas px-3 py-2.5 sm:grid-cols-4">
                    <Cell label="الصف والفصل">{m.grade ? classLabel(m) : <span className="text-faint">غير مسجّل في فصل</span>}</Cell>
                    <Cell label="رقم الهوية"><span className="num" dir="ltr">{m.national_id ?? "—"}</span></Cell>
                    <Cell label="جوال الطالب">
                      {mobEdit?.id === m.id ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <input className="field num !h-7 w-full max-w-[8.5rem] !px-2 !py-0 text-xs" dir="ltr" inputMode="tel" autoFocus
                                 value={mobEdit.v} placeholder="05XXXXXXXX"
                                 onChange={(e) => setMobEdit({ id: m.id, v: e.target.value })}
                                 onKeyDown={(e) => { if (e.key === "Enter") saveMobile(m); if (e.key === "Escape") setMobEdit(null); }} />
                          <button onClick={() => saveMobile(m)} disabled={busy === m.id}
                                  className="text-[11px] font-semibold text-mint-deep">حفظ</button>
                          <button onClick={() => setMobEdit(null)} className="text-[11px] text-muted">إلغاء</button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {m.student_mobile && <Phone mobile={m.student_mobile} text={waText} />}
                          <button onClick={() => setMobEdit({ id: m.id, v: localMobile(m.student_mobile) })}
                                  className="text-[11px] font-semibold text-mint-deep hover:underline">
                            {m.student_mobile ? "تعديل" : "+ إضافة"}
                          </button>
                        </span>
                      )}
                    </Cell>
                    <Cell label="جوال ولي الأمر"><Phone mobile={m.mobile} text={waText} /></Cell>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ))}

      {/* تحميل توقيع المدير مسبقًا فيظهر في الطباعة فورًا */}
      <div className="hidden">
        {principal.url && <img src={principal.url} alt="" />}
      </div>

      {printing && (
        <PrintPortal id="globe-print" landscape margin="12mm 14mm">
          <div dir="rtl" className="text-ink" style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontSize: 12.5 }}>
            <div className="flex items-start justify-between gap-4">
              <div className="text-[11px] font-medium leading-[1.9]">
                {GOV.map((l) => <div key={l}>{l}</div>)}
                <div className="font-bold text-mint-deep">مدرسة مكة الثانوية</div>
              </div>
              <div className="flex items-center gap-4">
                <img src={moeLogo} alt="" className="h-10 w-auto" />
                <img src={logoIcon} alt="" className="h-10 w-auto" />
              </div>
            </div>
            <h1 className="mt-5 text-center text-[17px] font-bold text-mint-deep">كشف طلاب برنامج جلوب البيئي العالمي</h1>
            <p className="num mt-1 text-center text-[11.5px] text-muted">عدد الطلاب: {members.length} · {fmtDate(new Date().toISOString())}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr>
                  {["م", "اسم الطالب", "رقم الهوية", "الصف والفصل", "جوال الطالب", "جوال ولي الأمر"].map((h) => (
                    <th key={h} style={{ border: "1px solid #d8e4dc", padding: "6px 8px", background: "#EEF6F1",
                      WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id}>
                    <td className="num" style={{ border: "1px solid #d8e4dc", padding: "5px 8px", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #d8e4dc", padding: "5px 8px" }}>{m.full_name}</td>
                    <td className="num" style={{ border: "1px solid #d8e4dc", padding: "5px 8px", textAlign: "center" }}>{m.national_id}</td>
                    <td style={{ border: "1px solid #d8e4dc", padding: "5px 8px", textAlign: "center" }}>{m.grade ? classLabel(m) : "—"}</td>
                    <td className="num" dir="ltr" style={{ border: "1px solid #d8e4dc", padding: "5px 8px", textAlign: "center" }}>{localMobile(m.student_mobile) || "—"}</td>
                    <td className="num" dir="ltr" style={{ border: "1px solid #d8e4dc", padding: "5px 8px", textAlign: "center" }}>{localMobile(m.mobile) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px]" style={{ breakInside: "avoid" }}>
              {[
                ["منسق برنامج جلوب", leaderName, null],
                ["مدير المدرسة", principal.name || PRINCIPAL_NAME, principal.url],
              ].map(([role, name, url]) => (
                <div key={role}>
                  <p className="font-bold text-mint-deep">{role}</p>
                  <p className="mt-1">{name || "...................................."}</p>
                  <div className="mx-auto mt-1 flex h-14 items-center justify-center">
                    {url ? <img src={url} alt="" className="max-h-14 max-w-[150px] object-contain" />
                         : <span className="text-faint">التوقيع: ....................</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-[10px] text-faint">صدر من بوابة مكة الثانوية الرقمية · makkahsec.com</p>
          </div>
        </PrintPortal>
      )}
    </div>
  );
}
