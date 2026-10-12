// src/pages/admin/schoolMonthly.js
import { supabase } from "../../lib/supabase";
import { loadAffairsMonthly, monthBounds } from "../student-affairs/monthlyData";
import { eventPhase } from "../EventsReportDoc.jsx";

/* =====================================================================
   بيانات التقرير الشهري للمدرسة (لمدير المدرسة والدعم الفني): خلاصة الشهر
   من أقسام البوابة كلها — الحضور والسلوك (من تقرير شؤون الطلاب)، والتوجيه
   الطلابي، والأحداث، والتطوير المهني، والاختبارات، والنماذج الصادرة.
   كل مصدر مستقل: ما تعذّر جلبه يظهر صفرًا ولا يوقف التقرير.
   ===================================================================== */

const quiet = (p) => Promise.resolve(p).then((r) => (r?.error ? { data: null } : r)).catch(() => ({ data: null }));
const count = (rows, k) => rows.reduce((o, r) => { o[r[k]] = (o[r[k]] ?? 0) + 1; return o; }, {});

export async function loadSchoolMonthly(month) {
  const b = monthBounds(month);
  const inM = (q, col) => q.gte(col, b.from).lt(col, b.to);
  const recent = new Date(Date.UTC(b.y, b.m - 5, 1)).toISOString().slice(0, 10);
  // تاريخ نشاط التطوير المهني: تاريخه المكتوب، وإلا تاريخ إنشائه
  const actIn = (r) => { const d = String(r.data?.date || r.created_at || "").slice(0, 10); return d >= b.from && d < b.to; };
  const [affairs, cases, closed, sessions, programs, requests, events, pd, plc, visits, evidence, quizzes, forms] = await Promise.all([
    loadAffairsMonthly(month),
    quiet(inM(supabase.from("guidance_cases").select("id, grade"), "opened_at")),
    quiet(inM(supabase.from("guidance_cases").select("id, outcome"), "closed_at")),
    quiet(inM(supabase.from("guidance_sessions").select("id, kind"), "session_date")),
    quiet(inM(supabase.from("guidance_programs").select("id, beneficiaries").eq("status", "done"), "done_date")),
    quiet(inM(supabase.from("guidance_requests").select("id, status"), "created_at")),
    quiet(inM(supabase.from("school_events").select("id, title, category, event_date, stage, cancelled_at, event_participants(attended)").is("cancelled_at", null), "event_date")),
    // التطوير المهني: كل ما تجاوز المسودة، ويُؤرَّخ بتاريخ النشاط نفسه (data.date) لا باعتماده —
    // فيُجلب ما أُنشئ في الأشهر الأربعة السابقة ويُصفّى بتاريخه في الشهر
    quiet(supabase.from("pd_reports").select("id, kind, status, data, created_at").neq("status", "draft").gte("created_at", recent).lt("created_at", b.to)),
    quiet(supabase.from("plc_sessions").select("id, status, data, created_at").neq("status", "draft").gte("created_at", recent).lt("created_at", b.to)),
    quiet(supabase.from("exchange_visits").select("id, status, data, created_at").neq("status", "draft").gte("created_at", recent).lt("created_at", b.to)),
    quiet(inM(supabase.from("perf_evidence").select("id", { count: "exact", head: true }), "created_at")),
    // الاختبارات بتاريخها، وإن لم يُحدَّد فبتاريخ إنشائها — بكل حالاتها
    quiet(supabase.from("quizzes").select("id, mode, total_marks, status")
      .or(`and(exam_date.gte.${b.from},exam_date.lt.${b.to}),and(exam_date.is.null,created_at.gte.${b.from},created_at.lt.${b.to})`)),
    quiet(inM(supabase.from("form_documents").select("id, form_templates(title)").neq("status", "draft"), "created_at")),
  ]);

  // متوسط أداء الاختبارات المرصودة في الشهر (ما بدأ رصد درجاته أو أُقفل)
  const all = quizzes.data ?? [];
  const Q = all.filter((q) => ["marking", "closed"].includes(q.status));
  let quizAvg = null, sheets = 0;
  if (Q.length) {
    const total = Object.fromEntries(Q.map((q) => [q.id, Number(q.total_marks) || 0]));
    const ids = Q.map((q) => q.id);
    const subs = [];
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await quiet(supabase.from("quiz_submissions").select("quiz_id, score, absent").in("quiz_id", ids.slice(i, i + 100)));
      subs.push(...(data ?? []));
    }
    const g = subs.filter((s) => !s.absent && s.score != null && total[s.quiz_id] > 0);
    sheets = g.length;
    if (g.length) quizAvg = Math.round((g.reduce((a, s) => a + (Number(s.score) / total[s.quiz_id]) * 100, 0) / g.length) * 10) / 10;
  }

  // الأحداث المنفّذة وحدها (eventPhase): القادمة لم يحن موعدها، والمسودة التي مضى موعدها لم تُستكمل
  const E = (events.data ?? []).filter((e) => ["approved", "done"].includes(eventPhase(e)));
  const upcomingEvents = (events.data ?? []).filter((e) => eventPhase(e) === "upcoming").length;
  const F = forms.data ?? [];
  const formsBy = {};
  F.forEach((f) => { const t = f.form_templates?.title ?? "نموذج"; formsBy[t] = (formsBy[t] ?? 0) + 1; });

  return {
    ...affairs,
    guidance: {
      opened: (cases.data ?? []).length, closed: (closed.data ?? []).length,
      improved: (closed.data ?? []).filter((c) => c.outcome === "improved").length,
      sessions: (sessions.data ?? []).length, programs: (programs.data ?? []).length,
      beneficiaries: (programs.data ?? []).reduce((a, p) => a + (p.beneficiaries ?? 0), 0),
      requests: (requests.data ?? []).length, requestsDone: (requests.data ?? []).filter((r) => r.status === "done").length,
    },
    events: {
      total: E.length, approved: E.filter((e) => e.stage === "approved").length, upcoming: upcomingEvents,
      attended: E.reduce((a, e) => a + (e.event_participants ?? []).filter((p) => p.attended).length, 0),
      top: [...E].sort((a, c) => (c.event_participants ?? []).filter((p) => p.attended).length - (a.event_participants ?? []).filter((p) => p.attended).length)
        .slice(0, 5).map((e) => ({ title: e.title, date: e.event_date, attended: (e.event_participants ?? []).filter((p) => p.attended).length })),
    },
    pd: (() => {
      const R = (pd.data ?? []).filter(actIn), P = (plc.data ?? []).filter(actIn), V = (visits.data ?? []).filter(actIn);
      const all = [...R, ...P, ...V];
      return {
        reports: R.length, byKind: count(R, "kind"), plc: P.length, visits: V.length, total: all.length,
        approved: all.filter((x) => x.status === "approved").length,
        returned: all.filter((x) => x.status === "returned").length,
        pending: all.filter((x) => !["approved", "returned"].includes(x.status)).length,
        hours: R.reduce((a, r) => a + (Number(r.data?.hours) || 0), 0),
        evidence: evidence.count ?? 0,
      };
    })(),
    quizzes: {
      total: all.length, graded: Q.length, ready: all.filter((q) => q.status === "ready").length,
      draft: all.filter((q) => q.status === "draft").length, byMode: count(all, "mode"), avg: quizAvg, sheets,
    },
    forms: { total: F.length, by: Object.entries(formsBy).sort((a, c) => c[1] - a[1]) },
  };
}
