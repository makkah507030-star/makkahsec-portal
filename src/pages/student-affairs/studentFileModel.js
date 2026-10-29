// src/pages/student-affairs/studentFileModel.js
/* =====================================================================
   نموذج ملف الطالب الشامل: يحوّل ما تعيده الدوال الثلاث (supabase/student_file_1..3.sql)
   إلى مؤشرات بحالة لونية (سليم/انتباه/ملاحظات)، ونقاط تحتاج انتباهًا، وسجل زمني موحّد.
   الحدود هنا وحدها، فيسهل ضبطها.
   ===================================================================== */
import { WARNING_STAGES } from "../../lib/officialAttendance";
import { STATUS as REF_STATUS, OPEN_STATUSES, BEHAVIOR_STEPS, ACADEMIC_ITEMS } from "../../lib/referrals.js";
import { countAr } from "../../lib/arabicCount.js";

/** إجراء المعلم بالعربية: نوعه (سلوكي/دراسي…) ونص خطوته بدل مفاتيح القاعدة (behavior، verbal) */
const ACTION_KIND = { behavior: "إجراء سلوكي", academic: "إجراء دراسي", performance: "إجراء أدائي" };
export const actionLabel = (a) => ({
  kind: ACTION_KIND[a.category] ?? (a.category && !/^[a-z_]+$/.test(a.category) ? a.category : "إجراء"),
  text: a.detail || [...BEHAVIOR_STEPS, ...ACADEMIC_ITEMS].find((x) => x.key === a.action)?.t || (/^[a-z_]+$/.test(a.action ?? "") ? "" : a.action) || "",
});

export const TONE = {
  ok:   { t: "سليم",   long: "وضع سليم",       bar: "bg-present", text: "text-present", soft: "bg-present/10", ring: "#2E8B57" },
  warn: { t: "انتباه", long: "يحتاج انتباهًا", bar: "bg-late",    text: "text-late",    soft: "bg-late/10",    ring: "#C08A1E" },
  bad:  { t: "ملاحظات", long: "يحتاج متابعة", bar: "bg-absent",  text: "text-absent",  soft: "bg-absent/10",  ring: "#B02A2A" },
  info: { t: "",       long: "",               bar: "bg-mint-deep", text: "text-mint-deep", soft: "bg-mint-tint", ring: "#3E6350" },
  none: { t: "لا بيانات", long: "لا بيانات كافية", bar: "bg-line", text: "text-muted",  soft: "bg-canvas",     ring: "#C9D3CE" },
};

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const weekdayName = (d) => WEEKDAYS[new Date(d + "T12:00:00").getDay()];
const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const by = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]);

export function buildModel(att, con, aca, today) {
  const days = att?.days ?? [];
  const schoolDays = att?.school_days ?? [];
  const absent = days.filter((d) => d.s === "absent");
  const excusedDays = days.filter((d) => d.s === "excused");
  const late = days.filter((d) => d.late > 0);
  const pAbsent = (att?.periods ?? []).filter((p) => p.s === "absent");
  const pLate = (att?.periods ?? []).filter((p) => p.s === "late");
  const present = Math.max(0, schoolDays.length - absent.length - excusedDays.length);
  const attendPct = pct(present, schoolDays.length);
  const bySubject = top(by(pAbsent, (p) => p.subject ?? "—"));
  const byWeekday = by(absent, (d) => weekdayName(d.d));
  const warnings = att?.warnings ?? [];
  const lastWarn = WARNING_STAGES.filter((s) => warnings.some((w) => w.stage === s.key)).pop();

  const behavior = con?.behavior ?? [];
  const actions = con?.actions ?? [];
  const maxDeg = Math.max(0, ...behavior.map((b) => b.degree ?? 0), ...actions.map((a) => a.degree ?? 0));
  const referrals = con?.referrals ?? [];
  const openRefs = referrals.filter((r) => OPEN_STATUSES.includes(r.status));

  const quizzes = (aca?.quizzes ?? []).filter((q) => !q.absent && q.score != null && Number(q.total) > 0)
    .map((q) => ({ ...q, pct: Math.round((100 * q.score) / q.total), avgPct: q.class_avg != null ? Math.round((100 * q.class_avg) / q.total) : null }));
  const quizAvg = quizzes.length ? Math.round(quizzes.reduce((a, q) => a + q.pct, 0) / quizzes.length) : null;
  const classAvg = quizzes.filter((q) => q.avgPct != null);
  const classAvgPct = classAvg.length ? Math.round(classAvg.reduce((a, q) => a + q.avgPct, 0) / classAvg.length) : null;
  const result = (aca?.results ?? [])[0] ?? null;
  const docs = aca?.documents ?? [];
  const certs = docs.filter((d) => d.category === "certificate");
  const events = aca?.events ?? [];
  const attended = events.filter((e) => e.attended);
  const leaguePts = (aca?.league ?? []).reduce((a, l) => a + Number(l.points || 0), 0);

  const kpis = [
    { key: "attend", label: "نسبة الحضور", icon: "userCheck", value: attendPct == null ? "—" : `${attendPct}%`,
      sub: schoolDays.length ? `${present} من ${schoolDays.length} يومًا دراسيًا` : "لا أيام معتمدة في الفترة",
      tone: attendPct == null ? "none" : attendPct >= 95 ? "ok" : attendPct >= 90 ? "warn" : "bad" },
    { key: "absent", label: "الغياب بلا عذر", icon: "userX", value: absent.length,
      sub: `بعذر ${excusedDays.length}${lastWarn ? ` · ${lastWarn.label}` : ""}`,
      tone: absent.length >= WARNING_STAGES[0].days || warnings.length ? "bad" : absent.length >= 3 ? "warn" : "ok" },
    { key: "late", label: "التأخر الصباحي", icon: "clock", value: late.length,
      sub: late.length ? `${countAr(late.length, "time")} · ${countAr(late.reduce((a, d) => a + d.late, 0), "minute")} إجمالًا` : "لا تأخر",
      tone: late.length > 5 ? "bad" : late.length > 2 ? "warn" : "ok" },
    { key: "periods", label: "غياب الحصص", icon: "grid", value: pAbsent.length,
      sub: bySubject[0] ? `أكثرها: ${bySubject[0][0]} (${bySubject[0][1]})` : `تأخر عن ${pLate.length} حصة`,
      tone: pAbsent.length > 10 ? "bad" : pAbsent.length > 3 ? "warn" : "ok" },
    { key: "behavior", label: "السلوك", icon: "flag", value: behavior.length + actions.length,
      sub: maxDeg ? `أعلى درجة مخالفة: ${maxDeg}` : "لا مخالفات",
      tone: !behavior.length && !actions.length ? "ok" : maxDeg >= 3 ? "bad" : "warn" },
    { key: "referrals", label: "الإحالات", icon: "send", value: referrals.length,
      sub: referrals.length ? `مفتوحة ${openRefs.length} · مغلقة ${referrals.length - openRefs.length}` : "لا إحالات",
      tone: openRefs.length ? "bad" : referrals.length ? "warn" : "ok" },
    { key: "academic", label: "المستوى الدراسي", icon: "award", value: quizAvg == null ? (result?.average ?? "—") : `${quizAvg}%`,
      sub: quizAvg != null ? `${quizzes.length} اختبارات${classAvgPct != null ? ` · متوسط فصله ${classAvgPct}%` : ""}`
        : result ? `نتيجة نور${result.rank_class ? ` · ترتيبه ${result.rank_class} من ${result.class_count}` : ""}` : "لا درجات منشورة",
      tone: quizAvg == null ? (result ? "info" : "none") : quizAvg >= 85 ? "ok" : quizAvg >= 65 ? "warn" : "bad" },
    { key: "achieve", label: "الإنجازات", icon: "certificate", value: certs.length,
      sub: `شهادات · فعاليات ${attended.length}${leaguePts ? ` · ${leaguePts} نقطة دوري` : ""}`,
      tone: certs.length || attended.length || leaguePts ? "info" : "none" },
  ];

  // مؤشر الحالة العام: سليم=2، انتباه=1، ملاحظات=0 من المؤشرات ذات الحكم
  const judged = kpis.filter((k) => ["ok", "warn", "bad"].includes(k.tone));
  const score = judged.length ? Math.round((100 * judged.reduce((a, k) => a + (k.tone === "ok" ? 2 : k.tone === "warn" ? 1 : 0), 0)) / (2 * judged.length)) : null;
  const overall = score == null ? "none" : score >= 80 ? "ok" : score >= 55 ? "warn" : "bad";

  // نقاط تحتاج انتباهًا: أهم ما يستدعي المتابعة، الأشد أولًا
  const alerts = [];
  const add = (tone, text) => alerts.push({ tone, text });
  if (att?.student?.dropout && att.student.dropout.status !== "returned") add("bad", "مسجّل في سجل الطلاب المنقطعين");
  if (lastWarn) add("bad", `صدر له ${lastWarn.label} في الغياب`);
  else if (absent.length >= 5) add("warn", `غاب ${absent.length} أيام بلا عذر، يقترب من حد الإنذار الأول (${WARNING_STAGES[0].days} أيام)`);
  top(byWeekday).filter(([, c]) => c >= 2).slice(0, 2).forEach(([d, c]) => add("warn", `يتكرر غيابه يوم ${d} (${c} مرات)`));
  bySubject.filter(([, c]) => c >= 3).slice(0, 2).forEach(([s, c]) => add("warn", `غاب عن حصص ${s} ${c} مرات`));
  openRefs.forEach((r) => {
    const age = Math.round((new Date(today) - new Date(r.d)) / 864e5);
    add(age > 14 ? "bad" : "warn", `إحالة ${r.serial ?? ""} مفتوحة منذ ${age} يومًا (${REF_STATUS[r.status]?.t ?? r.status})`);
  });
  if (maxDeg >= 3) add("bad", `مخالفة سلوكية من الدرجة ${maxDeg}`);
  const noAck = behavior.filter((b) => !b.ack && b.kind !== "incident" && b.kind !== "statement").length;
  if (noAck) add("warn", `${noAck} من نماذج السلوك لم يطّلع عليها ولي الأمر بعد`);
  quizzes.filter((q) => q.avgPct != null && q.avgPct - q.pct >= 20).slice(-2)
    .forEach((q) => add("warn", `أقل من متوسط فصله بفارق كبير في ${q.subject ? `مادة ${q.subject}، ` : ""}«${q.title}»: ${q.pct}% ومتوسط الفصل ${q.avgPct}%`));
  if (quizAvg != null && quizAvg < 60) add("bad", `متوسط اختباراته ${quizAvg}% فقط`);
  if ((con?.notes ?? []).some((n) => n.kind === "health")) add("info", "له ملاحظة صحية مسجّلة");
  if (!att?.student?.guardian?.mobile) add("warn", "لا رقم جوال لولي أمره في البوابة");
  if ((con?.cases ?? []).some((c) => c.status === "open")) add("info", "له حالة توجيه مفتوحة لدى الموجه");

  // السجل الزمني الموحّد: كل حدث بتاريخه ولونه
  const tl = [];
  const push = (d, kind, text, tone, extra = "") => d && tl.push({ d: String(d).slice(0, 10), kind, text, tone, extra });
  absent.forEach((x) => push(x.d, "غياب", "غياب بلا عذر", "bad"));
  excusedDays.forEach((x) => push(x.d, "غياب", "غياب بعذر", "info"));
  late.forEach((x) => push(x.d, "تأخر", `تأخر صباحي ${countAr(x.late, "minute")}`, "warn"));
  warnings.forEach((w) => push(w.on, "إنذار", WARNING_STAGES.find((s) => s.key === w.stage)?.label ?? w.stage, "bad"));
  (att?.permissions ?? []).forEach((p) => push(p.d, "استئذان", p.note || "استئذان", "info"));
  behavior.forEach((b) => push(b.d, "سلوك", `${b.type || b.text || "نموذج سلوك"}${b.degree ? ` · الدرجة ${b.degree}` : ""}`, (b.degree ?? 0) >= 3 ? "bad" : "warn", b.by));
  actions.forEach((a) => { const l = actionLabel(a); push(a.d, "إجراء", `${l.text || l.kind}${a.degree ? ` · الدرجة ${a.degree}` : ""}`, "warn", a.by); });
  referrals.forEach((r) => push(r.d, "إحالة", r.reason ?? "إحالة", OPEN_STATUSES.includes(r.status) ? "bad" : "warn", [r.subject, r.teacher].filter(Boolean).join(" · ")));
  (con?.cases ?? []).forEach((c) => push(c.opened, "توجيه", c.title, "info"));
  quizzes.forEach((q) => push(q.d, "اختبار", `${q.title}: ${q.pct}%${q.avgPct != null ? ` (متوسط الفصل ${q.avgPct}%)` : ""}`, q.pct >= 85 ? "ok" : q.pct >= 65 ? "warn" : "bad", q.subject));
  docs.forEach((d) => push(d.d, d.category === "certificate" ? "شهادة" : "نموذج", d.title, d.category === "certificate" ? "ok" : "info"));
  attended.forEach((e) => push(e.d, "فعالية", e.title, "ok"));
  tl.sort((a, b) => b.d.localeCompare(a.d));

  return { schoolDays, days, absent, excusedDays, late, pAbsent, pLate, attendPct, bySubject, byWeekday, warnings,
    behavior, actions, maxDeg, referrals, openRefs, quizzes, quizAvg, classAvgPct, result, docs, certs, events, attended,
    leaguePts, kpis, score, overall, alerts, timeline: tl };
}
