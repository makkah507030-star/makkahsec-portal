// src/pages/plc/PdHub.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../../lib/session.jsx";
import { useMyDepartment } from "../../lib/plc";
import { useNavBadges } from "../../lib/navBadges.js";
import { PD_KINDS, PD_KIND_KEYS, PD_META, PD_GROUPS, PD_LEVELS, PD_SCHOOL_EXTRA, PD_NO_CREATE, PD_PLAN_KINDS } from "../../lib/pd";
import { newPdReport } from "../../lib/pdCreate.js";
import { friendlyError } from "../../lib/friendlyError.js";
import PdNote from "../../components/PdNote.jsx";
import NiepdLink from "../../components/NiepdLink.jsx";
import { HeadTag, useRoles } from "../Plc.jsx";

/* =====================================================================
   التطوير المهني — الصفحة الرئيسة (/plc): ما ينتظر إجراءك، ثم الأنشطة بمستوى اعتمادها
   وفق «دليل اعتماد وتنفيذ أنشطة التطوير المهني التعليمي»:
   تُعتمد في المدرسة، أو من اللجنة المختصة في إدارة التعليم، أو حقائب يعتمدها المعهد، ثم ممارسات
   سجل الأداء (مجتمع التعلم والزيارات التبادلية والإنتاج المعرفي). ولكل نموذج ملاحظة من الدليل:
   من يعتمده، واشتراطاته، وسلسلة إجراءاته. وقوائم الجلسات والنماذج والزيارات في صفحاتها.
   ===================================================================== */

const PRE = { edu: true, inst: true };   // تعتمدها جهة خارج المدرسة
const PD_TASKS = ["plcSign", "pdSign", "xvHost", "plcPending", "pdPending", "xvPending", "plcBack", "pdBack", "xvBack"];

function Card({ item, title, hint, meta, edu, action }) {
  return (
    <div className={`card flex flex-col gap-2 p-3.5 ${edu ? "border-warning/30" : ""}`}>
      <div className="flex items-start gap-2">
        <span dir="ltr" className={`num shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold ${edu ? "bg-warning-light text-warning" : "bg-mint-light text-mint-deep"}`}>{item}</span>
        <p className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-ink">{title}</p>
      </div>
      {hint && <p className="text-[12px] leading-relaxed text-muted">{hint}</p>}
      <PdNote by={meta.by} notes={meta.notes} edu={edu} compact />
      {action && <div className="mt-auto pt-1">{action}</div>}
    </div>
  );
}

export default function PdHub() {
  const { session, profile, isTeacher, effectiveRole, adminRoles } = useSession();
  const uid = session?.user?.id;
  const dept = useMyDepartment();
  const roles = useRoles();
  const navigate = useNavigate();
  const badges = useNavBadges(uid, effectiveRole === "admin" ? adminRoles : [], effectiveRole);
  const tasks = (badges._tasks ?? []).filter((t) => PD_TASKS.includes(t.key) && t.n > 0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [levels, setLevels] = useState(false);

  const create = async (kind) => {
    setBusy(kind); setErr("");
    const r = await newPdReport({ kind, uid, name: profile?.full_name, deptId: dept?.department_id });
    setBusy("");
    if (r.error) setErr(friendlyError(r.error.message)); else navigate(`/pd/${r.id}`);
  };
  const isEdu = (k) => PD_META[k].group === "edu" || k === "training";
  const btn = (edu) => `rounded-pill px-4 py-1.5 text-xs font-semibold ${edu ? "border border-warning/50 bg-white text-warning" : "bg-mint-deep text-white"}`;
  // الأنشطة الخارجية للتعريف فقط، والأنشطة ذات الخطة تبدأ بخطة قبل التنفيذ
  const newBtn = (k) => PD_NO_CREATE.includes(k)
    ? <p className="rounded-sm2 bg-canvas px-3 py-1.5 text-[11.5px] text-muted">للتعريف فقط: لا يُوثَّق في البوابة، فاعتماده من الجهة المختصة.</p>
    : isTeacher && (
      <button className={btn(isEdu(k))} disabled={!!busy} onClick={() => create(k)}>
        {busy === k ? "…" : PD_PLAN_KINDS.includes(k) ? "+ خطة قبل التنفيذ" : "+ نموذج جديد"}
      </button>);
  const kindCard = (k) => (
    <Card key={k} item={PD_KINDS[k].item} title={PD_KINDS[k].short} hint={PD_KINDS[k].hint} meta={PD_META[k]} edu={!!PRE[PD_META[k].group]} action={newBtn(k)} />);
  const group = (g) => PD_KIND_KEYS.filter((k) => PD_META[k].group === g);
  const link = (to, t, n) => (
    <Link key={to} to={to} className="rounded-pill border border-line bg-white px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-canvas">
      {t}{n ? <span className="num text-absent"> ({n})</span> : null}</Link>);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">التطوير المهني</h1>
          <HeadTag d={dept} />
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          أنشطة التطوير المهني بمستوى اعتمادها وفق دليل اعتماد وتنفيذ أنشطة التطوير المهني التعليمي. ما تعتمده المدرسة
          يُضاف بعد اعتماده إلى سجل التطوير المهني في «شواهد الأداء الوظيفي».
        </p>
      </div>

      {/* الدليل ومستويات الاعتماد أولًا: مرجع كل ما في الصفحة */}
      <NiepdLink />
      {/* مستويات الاعتماد في الدليل */}
      <section className="card p-4">
        <button className="flex w-full items-center justify-between text-sm font-bold text-ink" onClick={() => setLevels(!levels)}>
          مستويات اعتماد أنشطة التطوير المهني في الدليل <span className="text-xs font-semibold text-mint-deep">{levels ? "إخفاء" : "عرض"}</span>
        </button>
        {levels && (
          <div className="mt-3 space-y-2">{PD_LEVELS.map((l) => (
            <div key={l.n} className="flex gap-3 rounded-sm2 border border-line bg-white px-3 py-2">
              <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mint-tint text-xs font-bold text-mint-deep">{l.n}</span>
              <span className="min-w-0"><b className="block text-[13px] text-ink">يعتمدها: {l.t}</b>
                <span className="text-[12px] leading-relaxed text-muted">{l.items}</span></span>
            </div>))}
            <p className="text-[11.5px] leading-relaxed text-faint">
              المصدر: دليل اعتماد وتنفيذ أنشطة التطوير المهني التعليمي، المعهد الوطني للتطوير المهني التعليمي (الإصدار 1). ومستوى
              كل نشاط في بطاقته كما في قسم «مستوى الاعتماد» منه.
            </p>
          </div>
        )}
      </section>

      {/* ما ينتظر إجراءك: التوقيع، والاعتماد (لوكيل الشؤون التعليمية)، والمُعاد بملاحظة */}
      <section className="card space-y-2 p-4">
        <p className="text-sm font-bold text-ink">بانتظار إجرائك</p>
        {tasks.length ? (
          <div className="grid gap-2 sm:grid-cols-2">{tasks.map((t) => (
            <Link key={t.key} to={t.to} className={`flex items-center gap-2 rounded-sm2 border px-3 py-2 text-[13px] hover:bg-canvas ${t.tone === "absent" ? "border-absent/30" : "border-warning/30"}`}>
              <span className="num grid h-7 min-w-7 place-items-center rounded-full bg-warning-light px-1.5 text-xs font-bold text-warning">{t.n}</span>
              <span className="min-w-0 flex-1 text-ink">{t.label}</span><span className="text-mint-deep">←</span>
            </Link>))}</div>
        ) : <p className="text-[12.5px] text-muted">لا شيء بانتظارك الآن.</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {isTeacher && link("/pd?tab=mine", "نماذجي")}
          {link(dept?.is_head ? "/plc?tab=mine" : "/plc?tab=attended", "جلسات مجتمع التعلم")}
          {link("/xvisits", "الزيارات التبادلية")}
          {roles.isDeputy && link("/pd?tab=pending", "نماذج بانتظار الاعتماد")}
          {roles.isDeputy && link("/plc?tab=pending", "جلسات بانتظار الاعتماد")}
          {roles.isDeputy && link("/xvisits?tab=pending", "زيارات بانتظار الاعتماد")}
          {roles.seesAll && link("/pd?tab=all", "كل النماذج")}
          {(dept?.is_head || roles.seesAll) && link("/plc-file", "ملف التطوير المهني للقسم")}
        </div>
      </section>

      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}

      {/* أنشطة الدليل بمستوى اعتمادها، ثم ممارسات سجل الأداء */}
      {["school", "edu", "inst"].map((g) => (
        <section key={g} className="space-y-2.5">
          <div><h2 className={`text-[15px] font-bold ${PRE[g] ? "text-warning" : "text-mint-deep"}`}>{PD_GROUPS[g].t}</h2>
            <p className="text-[12px] leading-relaxed text-muted">{PD_GROUPS[g].sub}</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{group(g).map(kindCard)}</div>
        </section>
      ))}

      <section className="space-y-2.5">
        <div><h2 className="text-[15px] font-bold text-ink">{PD_GROUPS.record.t}</h2><p className="text-[12px] text-muted">{PD_GROUPS.record.sub}</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card item={PD_SCHOOL_EXTRA.plc.item} title={PD_SCHOOL_EXTRA.plc.t} meta={PD_SCHOOL_EXTRA.plc}
            hint={dept?.is_head ? `أنت رئيس قسم ${dept.department_name}: أصدر جلسات قسمك ووثّقها.` : "يصدرها رئيس القسم، وتوقّع حضورك فيها."}
            action={<Link className={btn(false)} to={dept?.is_head ? "/plc?tab=mine" : "/plc?tab=sign"}>{dept?.is_head ? "جلسات قسمي" : "جلسات للتوقيع"}</Link>} />
          <Card item={PD_SCHOOL_EXTRA.xvisits.item} title={PD_SCHOOL_EXTRA.xvisits.t} meta={PD_SCHOOL_EXTRA.xvisits}
            action={<Link className={btn(false)} to="/xvisits">{isTeacher ? "زيارة جديدة أو متابعة" : "فتح الزيارات"}</Link>} />
          {group("record").map(kindCard)}
        </div>
      </section>

    </div>
  );
}
