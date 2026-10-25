// src/pages/admin/ScoutTeam.jsx
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
import { useScoutLeader } from "../../lib/scoutLeader.js";
import { usePrincipalSignature } from "../../lib/principalSignature.js";
import { PRINCIPAL_NAME } from "../../lib/signers.js";

/* =====================================================================
   الفريق الكشفي (supabase/scouts_1.sql):
   من له صلاحية «الفريق الكشفي» (القائد الكشفي من «الأدوار المخصّصة»،
   والمدير والدعم الفني) يضيف أعضاء الفريق من أي فصل ويحذفهم، ويطبع كشفهم.
   ===================================================================== */

const classLabel = (c) => (c ? `${GRADE_NAMES[c.grade] ?? ""} · فصل ${c.class_no}` : "—");
const GOV = ["المملكة العربية السعودية", "وزارة التعليم", "الإدارة العامة للتعليم بمنطقة مكة المكرمة"];

export default function ScoutTeam() {
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
  // توقيعا الكشف: القائد الكشفي (scouts_2.sql) ومدير المدرسة
  const leader = useScoutLeader();
  const principal = usePrincipalSignature();

  const load = async () => {
    const { data, error } = await supabase.from("scout_members")
      .select("student_id, added_at, added_by_name, students(full_name, national_id, student_enrollment(status, classes(grade, class_no)))");
    if (error) { setMissing(true); setMembers([]); return; }
    setMembers((data ?? []).map((r) => {
      const en = (r.students?.student_enrollment ?? []).find((e) => e.status === "active");
      return { id: r.student_id, full_name: r.students?.full_name ?? "—", national_id: r.students?.national_id,
               grade: en?.classes?.grade, class_no: en?.classes?.class_no, added_at: r.added_at, added_by_name: r.added_by_name };
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
    const { error } = await supabase.from("scout_members")
      .insert({ student_id: s.id, added_by_name: profile?.full_name ?? null });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `أُضيف ${s.full_name} إلى الفريق.` });
    load();
  };

  const remove = async (m) => {
    if (!(await confirmDanger({
      title: `حذف ${m.full_name} من الفريق الكشفي`,
      impact: ["يُحذف من كشف الفريق فقط، ولا يتأثر سجله في المدرسة.", "يمكن إضافته مرة أخرى في أي وقت."],
      confirmLabel: "حذف من الفريق",
    }))) return;
    setBusy(m.id);
    const { error } = await supabase.from("scout_members").delete().eq("student_id", m.id);
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `حُذف ${m.full_name} من الفريق.` });
    load();
  };

  const shown = useMemo(() => {
    const t = q.trim();
    return t ? (members ?? []).filter((m) => m.full_name.includes(t) || (m.national_id ?? "").includes(t)) : members ?? [];
  }, [members, q]);

  if (!members) return <Loader />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الفريق الكشفي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أعضاء الفريق الكشفي بالمدرسة من كل الفصول: أضف الطالب من فصله، واحذفه من الكشف متى شئت.
        </p>
      </div>

      {missing ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">
          الصفحة تحتاج تنفيذ ملف supabase/scouts_1.sql في قاعدة البيانات مرة واحدة.
        </div>
      ) : (
        <>
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">إضافة عضو</h2>
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
                      ? <span className="chip bg-present/10 text-present">في الفريق</span>
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
                أعضاء الفريق <span className="num text-muted">({members.length})</span>
              </h2>
              {members.length > 0 && (
                <button onClick={() => { setPrinting(true); setTimeout(() => printThen(() => setPrinting(false)), 150); }}
                        className="ms-auto text-xs font-semibold text-mint-deep">طباعة الكشف</button>
              )}
            </div>
            {members.length > 5 && (
              <div className="border-b border-line p-3">
                <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو رقم الهوية" />
              </div>
            )}
            {members.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا أعضاء بعد. اختر فصلًا وأضف الطلاب.</p>}
            <div className="divide-y divide-line">
              {shown.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{m.full_name}</p>
                    <p className="text-[11.5px] text-faint">
                      {m.grade ? classLabel(m) : "غير مسجّل في فصل"} · <span className="num" dir="ltr">{m.national_id}</span>
                    </p>
                  </div>
                  <button onClick={() => remove(m)} disabled={busy === m.id}
                          className="shrink-0 text-xs font-medium text-absent hover:underline">حذف</button>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* تحميل التوقيعين مسبقًا فيظهران في الطباعة فورًا */}
      <div className="hidden">
        {leader?.sig_url && <img src={leader.sig_url} alt="" />}
        {principal.url && <img src={principal.url} alt="" />}
      </div>

      {printing && (
        <PrintPortal id="scouts-print" margin="12mm 14mm">
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
            <h1 className="mt-5 text-center text-[17px] font-bold text-mint-deep">كشف أعضاء الفريق الكشفي</h1>
            <p className="num mt-1 text-center text-[11.5px] text-muted">عدد الأعضاء: {members.length} · {fmtDate(new Date().toISOString())}</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr>
                  {["م", "اسم الطالب", "رقم الهوية", "الصف والفصل"].map((h) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[12px]" style={{ breakInside: "avoid" }}>
              {[
                ["القائد الكشفي", leader?.full_name, leader?.sig_url],
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
