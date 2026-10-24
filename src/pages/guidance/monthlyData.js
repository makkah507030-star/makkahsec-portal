// src/pages/guidance/monthlyData.js
import { supabase } from "../../lib/supabase";
import { todayISO } from "../../lib/schoolTime";
import { loadRangeStart, loadFingerprintPublic } from "../../lib/officialAttendance";
import { reasonsOf } from "../../lib/guidanceWarning";
import { loadPrograms, programState, BUCKET } from "../GuidanceMore.jsx";
import { eventReach } from "../../lib/eventAudience.js";

/* =====================================================================
   بيانات التقرير الشهري للموجه الطلابي — كل أعماله في الشهر لصفه:
   الحالات وجلساتها، والبرامج المنفذة بصورها، وطلبات المقابلة، واستمارات
   المستوى، والإحالات التي وصلته، والنماذج التي أصدرها، والفعاليات التي
   نظّمها، ولقطة الإنذار المبكر. أرقام مجمّعة فقط: لا أسماء طلاب في التقرير.
   كل مصدر مستقل: ما لم يُفعَّل ملفه في Supabase يظهر صفرًا ولا يوقف التقرير.
   ===================================================================== */

const iso = (y, m, d = 1) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
const day = (t) => (t ? String(t).slice(0, 10) : null);
const quiet = (p) => Promise.resolve(p).then((r) => (r?.error ? { data: null } : r)).catch(() => ({ data: null }));

/** حدود الشهر: from شامل و to غير شامل، وبداية نافذة الأشهر الستة */
export function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  return { y, m, from: iso(y, m), to: iso(y, m + 1), trendFrom: iso(y, m - 5), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/** أسبوع الشهر (1–5) لتاريخ داخله */
const weekOf = (d) => Math.min(5, Math.floor((Number(d.slice(8, 10)) - 1) / 7) + 1);

export async function loadMonthly({ grade, month, uid, isCounselor }) {
  const b = monthBounds(month);
  const inM = (t) => { const d = day(t); return !!d && d >= b.from && d < b.to; };

  const [cases, sessions, progs, reqs, inq, refs, refsPending, events, counselor, term, students] = await Promise.all([
    quiet(supabase.from("guidance_cases").select("id, status, outcome, opened_at, closed_at, source").eq("grade", grade)),
    quiet(supabase.from("guidance_sessions").select("id, kind, session_date, guidance_cases!inner(grade)")
      .eq("guidance_cases.grade", grade).gte("session_date", b.trendFrom).lt("session_date", b.to)),
    quiet(loadPrograms(grade)),
    quiet(supabase.from("guidance_requests").select("id, status, requester, created_at").eq("grade", grade)
      .gte("created_at", b.from).lt("created_at", b.to)),
    quiet(supabase.from("guidance_inquiries").select("id, status, flag, created_at, sent_at").eq("grade", grade)
      .or(`and(created_at.gte.${b.from},created_at.lt.${b.to}),and(sent_at.gte.${b.from},sent_at.lt.${b.to})`)),
    // الإحالات التي حُوّلت للموجه في الشهر (deputy_at) أو أجرى فيها إجراءه (counselor_at)
    quiet(supabase.from("student_referrals").select("id, kind, status, counselor_id, counselor_at, deputy_at, closed_at").eq("grade", grade)
      .or(`and(deputy_at.gte.${b.from},deputy_at.lt.${b.to}),and(counselor_at.gte.${b.from},counselor_at.lt.${b.to})`)),
    quiet(supabase.from("student_referrals").select("id", { count: "exact", head: true }).eq("grade", grade)
      .in("status", ["with_counselor", "returned_to_counselor"])),
    uid ? quiet(supabase.from("school_events").select("*, event_participants(count)")
      .eq("organizer_id", uid).gte("event_date", b.from).lt("event_date", b.to).is("cancelled_at", null)) : { data: [] },
    quiet(supabase.from("admin_roles").select("user_id, users(full_name)").eq("role_type", `counselor_${grade}`).limit(1).maybeSingle()),
    quiet(supabase.from("settings").select("key, value").in("key", ["active_year", "active_term"])),
    isCounselor ? { data: null } : quiet(supabase.from("v_active_students").select("student_id").eq("grade", grade)),
  ]);

  // النماذج: الموجه يرى ما أصدره بنفسه من كل الأقسام، وغيره يرى نماذج قسم التوجيه لطلاب الصف
  let fq = supabase.from("form_documents").select("id, status, student_id, created_at, form_templates!inner(key, title, department)")
    .neq("status", "draft").gte("created_at", b.from).lt("created_at", b.to);
  fq = isCounselor ? fq.eq("created_by", uid) : fq.eq("form_templates.department", "guidance");
  const forms = await quiet(fq);
  const gradeIds = students.data ? new Set(students.data.map((s) => s.student_id)) : null;
  const formRows = (forms.data ?? []).filter((f) => !gradeIds || !f.student_id || gradeIds.has(f.student_id));

  // الحالات
  const C = cases.data ?? [];
  const opened = C.filter((x) => inM(x.opened_at));
  const closed = C.filter((x) => inM(x.closed_at));
  const bySource = count(opened, "source");
  const byOutcome = count(closed, "outcome");

  // الجلسات: الشهر، وأسابيعه، ونافذة الأشهر الستة
  const S = sessions.data ?? [];
  const sMonth = S.filter((x) => inM(x.session_date));
  const kinds = { individual: 0, group: 0, guardian: 0, teacher: 0, ...count(sMonth, "kind") };

  // البرامج
  const P = (progs.data ?? []).map((x) => ({ ...x, st: programState(x) }));
  const done = P.filter((x) => x.st.done && inM(x.st.date))
    .sort((a, c) => (a.st.date < c.st.date ? -1 : 1));
  const upcoming = P.filter((x) => !x.st.done && x.planned_date && x.planned_date >= b.to && x.planned_date < monthBounds(b.to.slice(0, 7)).to);
  const photoPaths = done.flatMap((x) => (x.photos ?? []).slice(0, 1));
  const signed = photoPaths.length ? await quiet(supabase.storage.from(BUCKET).createSignedUrls(photoPaths, 3600)) : { data: [] };
  const photoBy = new Map(photoPaths.map((p, i) => [p, signed.data?.[i]?.signedUrl ?? null]));
  done.forEach((x) => { x.photo = x.photos?.[0] ? photoBy.get(x.photos[0]) : null; });

  // طلبات المقابلة
  const R = reqs.data ?? [];
  // استمارات المستوى والإحالات
  const I = inq.data ?? [];
  const F = refs.data ?? [];
  // وصلت الموجه: حُوّلت إليه في الشهر، ولم يوجّهها الوكيل لولي الأمر مباشرة أو يُعِدها للمعلم
  const reached = (x) => !!x.counselor_at || ["with_counselor", "returned_to_counselor"].includes(x.status);
  const refsIn = F.filter((x) => inM(x.deputy_at) && reached(x));

  // النماذج مجمّعة بالقالب
  const formsBy = {};
  formRows.forEach((f) => { const t = f.form_templates?.title ?? "نموذج"; formsBy[t] = (formsBy[t] ?? 0) + 1; });

  // الأسابيع: أعمال الموجه في كل أسبوع من الشهر
  const weeks = Array.from({ length: Math.ceil(b.days / 7) }, (_, i) => ({
    label: `الأسبوع ${i + 1}`, range: `${i * 7 + 1}–${Math.min(b.days, i * 7 + 7)}`, sessions: 0, programs: 0, forms: 0, meetings: 0,
  }));
  const bump = (d, k) => { if (d && inM(d)) weeks[weekOf(day(d)) - 1][k] += 1; };
  sMonth.forEach((x) => bump(x.session_date, "sessions"));
  done.forEach((x) => bump(x.st.date, "programs"));
  formRows.forEach((x) => bump(x.created_at, "forms"));
  R.filter((x) => x.status === "done").forEach((x) => bump(x.created_at, "meetings"));

  // الأشهر الستة: الجلسات والحالات الجديدة
  const trend = Array.from({ length: 6 }, (_, i) => {
    const k = iso(b.y, b.m - 5 + i).slice(0, 7);
    return {
      key: k, label: new Date(`${k}-15T12:00:00`).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { month: "short" }),
      sessions: S.filter((x) => x.session_date.startsWith(k)).length,
      cases: C.filter((x) => day(x.opened_at)?.startsWith(k)).length,
    };
  });

  const st = Object.fromEntries((term.data ?? []).map((r) => [r.key, r.value]));

  return {
    month, ...b,
    counselorName: counselor.data?.users?.full_name ?? null,
    term: Number(st.active_term ?? 1),
    cases: {
      opened: opened.length, closed: closed.length, openNow: C.filter((x) => x.status === "open").length,
      improved: byOutcome.improved ?? 0, bySource, byOutcome, total: C.length,
    },
    sessions: { total: sMonth.length, kinds },
    programs: {
      done, upcoming, beneficiaries: done.reduce((a, x) => a + (x.st.beneficiaries ?? 0), 0),
      byKind: count(done, "kind"), planTotal: P.length, planDone: P.filter((x) => x.st.done).length,
    },
    requests: {
      total: R.length, byStatus: count(R, "status"), guardian: R.filter((x) => x.requester === "guardian").length,
      student: R.filter((x) => x.requester !== "guardian").length,
    },
    inquiries: {
      created: I.filter((x) => inM(x.created_at)).length, sent: I.filter((x) => inM(x.sent_at)).length,
      urgent: I.filter((x) => inM(x.created_at) && x.flag === "urgent").length,
    },
    referrals: {
      received: refsIn.length, handled: F.filter((x) => inM(x.counselor_at)).length,
      pending: refsPending.count ?? 0,
      behavior: refsIn.filter((x) => x.kind === "behavior").length,
    },
    forms: { total: formRows.length, by: Object.entries(formsBy).sort((a, c) => c[1] - a[1]) },
    // المشاركون: المسمَّون، وفئات الحدث للمدرسة كلها (lib/eventAudience.js)
    events: (events.data ?? []).map((e) => {
      const named = e.event_participants?.[0]?.count ?? 0;
      return { ...e, participants: eventReach(e, { total: named, attended: named }).attended };
    }),
    weeks, trend,
  };
}

/** لقطة الإنذار المبكر عند إصدار التقرير — منفصلة لأنها أبطأ المصادر */
export async function loadWarningSnapshot(grade) {
  try {
    const [start, f] = await Promise.all([loadRangeStart(todayISO()), loadFingerprintPublic()]);
    const lateFrom = f.on ? (f.since && f.since > start ? f.since : start) : null;
    const { data, error } = await supabase.rpc("guidance_early_warning", { p_grade: grade, p_from: start, p_late_from: lateFrom });
    if (error) return null;
    const rows = (data ?? []).map((r) => ({ ...r, reasons: reasonsOf(r) })).filter((r) => r.reasons.length);
    const c = { flagged: rows.length, covered: rows.filter((r) => r.open_case).length, absence: 0, late: 0, study: 0, behavior: 0, lateOn: f.on, from: start };
    rows.forEach((r) => r.reasons.forEach((x) => { c[x.k] += 1; }));
    return c;
  } catch { return null; }
}

function count(rows, key) {
  const o = {};
  rows.forEach((r) => { if (r[key] != null) o[r[key]] = (o[r[key]] ?? 0) + 1; });
  return o;
}
