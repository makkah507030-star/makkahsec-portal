// src/pages/culture/CultReport.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import Loader from "../../components/Loader.jsx";
import { academicYearLabel } from "../studio/lib";
import { useSignedPhotos } from "../globe/shared.jsx";
import { programPages } from "../globe/ProgramReportDoc.jsx";
import { PROGRAMS, CULT_BUCKET } from "../../lib/culture.js";

/* تقرير الخطة التنفيذية لسفير الثقافة المؤسسية بهوية البوابة (ملوّن ورسمي): الغلاف، والملخص، وأنشطة الخطة
   ببرامجها، وتوثيق المنفّذ بصوره، والاعتماد بتوقيع السفير ومدير المدرسة. وأبرزه يضم سجلات البرامج. */

const KINDS = Object.fromEntries(Object.entries(PROGRAMS).map(([k, p]) => [k, p.t]));
const CFG = {
  title: "خطة سفير الثقافة المؤسسية", unit: "الثقافة المؤسسية", tag: "star", kinds: KINDS,
  kindPlural: Object.fromEntries(Object.entries(PROGRAMS).map(([k, p]) => [k, `في «${p.t}»`])),
  domainOf: (axis) => ({ t: axis || "—" }), colorOf: (k) => PROGRAMS[k]?.c,
  signer: "سفير الثقافة المؤسسية", membersLabel: "فريق الثقافة المؤسسية", membersNoun: "member", itemNoun: "activity",
  words: { pl: "أنشطة", al: "الأنشطة", sg: "النشاط", one: "نشاط", kind: "البرنامج", kindSg: "البرنامج", kindOf: "برامجها" },
};
const NOTES_KEY = "culture-plan-notes";
const readNotes = () => { try { return localStorage.getItem(NOTES_KEY) ?? ""; } catch { return ""; } };
const writeNotes = (v) => { try { if (v) localStorage.setItem(NOTES_KEY, v); else localStorage.removeItem(NOTES_KEY); } catch { /* تخزين محجوب */ } };
const few = (v, one, two, pl, many) => (v === 1 ? one : v === 2 ? two : v <= 10 ? `${v} ${pl}` : `${v} ${many}`);

export default function CultReport({ go }) {
  const [theme, setTheme] = useState("light");
  const [notes, setNotes] = useState(readNotes);
  const [data, setData] = useState(null);
  const [sigs, setSigs] = useState({ leader: null, principal: null, stamp: null });
  useEffect(() => {
    Promise.all([
      supabase.from("cult_activities").select("*").order("sort"),
      supabase.rpc("cult_team_list"),
      supabase.from("cult_meetings").select("id", { count: "exact", head: true }),
      supabase.from("cult_occasions").select("id", { count: "exact", head: true }).not("sent_at", "is", null),
      supabase.from("cult_onboard").select("id", { count: "exact", head: true }),
      supabase.from("cult_ideas").select("status"),
    ]).then(([a, t, m, o, b, i]) => {
      const team = t.data ?? [];
      const leader = team.find((x) => x.role === "ambassador")?.full_name ?? "";
      setData({ acts: a.data ?? [], members: team.length, leader, meet: m.count ?? 0, care: o.count ?? 0, onb: b.count ?? 0, ideas: i.data ?? [] });
      Promise.all([leader ? signatureByName(leader) : null, loadPrincipalSignature(), loadSchoolStamp()])
        .then(([l, p, s]) => setSigs({ leader: l, principal: p?.url ?? null, stamp: s }));
    });
  }, []);
  const done = useMemo(() => (data ? data.acts.filter((p) => p.status === "done") : null), [data]);
  const urls = useSignedPhotos(done, CULT_BUCKET);
  const info = useMemo(() => {
    const today = todayISO();
    if (!data) return null;
    const adopted = data.ideas.filter((x) => x.status === "adopted" || x.status === "honored").length;
    return {
      leader: data.leader, members: data.members, year: academicYearLabel(), termLabel: "العام 2026م",
      issued: `${today.slice(8, 10)}/${today.slice(5, 7)}/${today.slice(0, 4)}`,
      hijri: new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${today}T12:00:00`)),
      highlights: [
        data.meet && `عُقد في «التواصل الملهم» ${few(data.meet, "لقاء واحد", "لقاءان", "لقاءات", "لقاءً")}.`,
        data.care && `أُرسل في «نهتم بك» ${few(data.care, "بطاقة واحدة", "بطاقتان", "بطاقات", "بطاقة")} لمناسبات الموظفين.`,
        data.onb && `هُيّئ في «حيّاك» ${few(data.onb, "موظف جديد واحد", "موظفان جديدان", "موظفين جدد", "موظفًا جديدًا")}.`,
        data.ideas.length && `شارك الموظفون ${few(data.ideas.length, "فكرة واحدة", "فكرتين", "أفكار", "فكرة")}${adopted ? `، اعتُمد منها ${adopted}` : ""}.`,
      ].filter(Boolean),
    };
  }, [data]);
  const pages = useMemo(() => {
    if (!data || !urls || !info) return null;
    const programs = data.acts.map((a) => ({
      ...a, kind: a.program, domain: PROGRAMS[a.program]?.axis, planned_date: a.due_date, done_date: a.done_at,
      photoUrls: (a.photos ?? []).map((x) => urls.get(x)).filter(Boolean),
    }));
    return programPages({ cfg: CFG, programs, theme, info, notes, sigs });
  }, [data, urls, theme, info, notes, sigs]);
  if (!data) return <Loader />;
  return (
    <ReportViewer id="culture-plan-print" pages={pages} theme={theme} setTheme={setTheme} fileTitle="خطة سفير الثقافة المؤسسية وتقرير تنفيذها"
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={() => go("dash")}>رجوع للوحة</button>}>
      <div>
        <label className="text-xs text-muted">ملاحظات سفير الثقافة وتوصياته (تظهر في صفحة الاعتماد، وإن تُركت فارغة ظهرت أسطر للكتابة باليد)</label>
        <textarea className="field mt-1 w-full" rows={3} maxLength={700} value={notes} onChange={(e) => { setNotes(e.target.value); writeNotes(e.target.value); }} />
      </div>
    </ReportViewer>
  );
}
