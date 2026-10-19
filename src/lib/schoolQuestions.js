// src/lib/schoolQuestions.js
// «من مدرستي»: أسئلة تُولَّد من معلومات المدرسة العامة (act_school_facts في
// supabase/activities_3.sql) وتُدمج في ألعاب الحقيبة: مسابقة الفرق وحروف.
import { supabase } from "./supabase";
import { GRADE_NAMES } from "./schoolTime";

const ROLE = { principal: "مدير المدرسة", deputy_academic: "وكيل الشؤون التعليمية", deputy_students: "وكيل شؤون الطلاب",
  deputy_school: "وكيل الشؤون المدرسية", activity_leader: "رائد النشاط" };
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const uniq = (a) => [...new Set(a)];

// سؤال بخيارات: الصحيح وحتى ثلاثة خاطئة، بترتيب عشوائي
function mcq(q, right, wrong) {
  const opts = shuffle([right, ...shuffle(uniq(wrong.filter((w) => w !== right))).slice(0, 3)]);
  return opts.length >= 2 ? { q, options: opts, answer: opts.indexOf(right), school: true } : null;
}
const addMin = (hm, m) => {
  const [h, mm] = hm.split(":").map(Number);
  const t = (h * 60 + mm + m + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
const nums = (n, deltas) => uniq(deltas.map((d) => n + d).filter((x) => x > 0)).map(String);

// الاسم الأول واسم العائلة فقط (أوضح على السبورة): «سلطان علي يحي هزازي» ← «سلطان هزازي»
export const shortName = (n) => {
  const w = String(n ?? "").replace(/[-–—]/g, " ").split(/\s+/).filter((x) => x && !["بن", "ابن"].includes(x));
  return w.length > 2 ? `${w[0]} ${w[w.length - 1]}` : w.join(" ");
};
const named = (f) => ({ ...f,
  teachers: (f.teachers ?? []).map((t) => ({ ...t, name: shortName(t.name) })),
  admins: (f.admins ?? []).map((a) => ({ ...a, name: shortName(a.name) })) });

let cache = null;
/** معلومات المدرسة مرة واحدة لكل تحميل للصفحة؛ null إن تعذّرت (دون إنترنت مثلًا) */
export function loadSchoolFacts() {
  cache ??= supabase.rpc("act_school_facts").then(({ data, error }) => (error || !data ? null : named(data))).catch(() => null);
  return cache;
}

/** أسئلة مسابقة الفرق من معلومات المدرسة */
export function schoolQuiz(f) {
  if (!f) return [];
  const out = [];
  const teachers = (f.teachers ?? []).filter((t) => t.name && t.subjects?.length);
  const names = teachers.map((t) => t.name);
  const subjects = uniq(teachers.flatMap((t) => t.subjects));
  for (const sub of shuffle(subjects).slice(0, 6)) {
    const who = teachers.filter((t) => t.subjects.includes(sub)).map((t) => t.name);
    const q = Math.random() < 0.5 ? `من معلمي مادة «${sub}» في مدرستنا؟` : `أي هؤلاء يدرّس مادة «${sub}» في مدرستنا؟`;
    out.push(mcq(q, shuffle(who)[0], names.filter((n) => !who.includes(n))));
  }
  for (const t of shuffle(teachers).slice(0, 3)) {
    out.push(mcq(`الأستاذ ${t.name} يدرّس في مدرستنا مادة:`, shuffle(t.subjects)[0], subjects.filter((s) => !t.subjects.includes(s))));
  }
  for (const a of f.admins ?? []) {
    if (ROLE[a.role]) out.push(mcq(`من ${ROLE[a.role]} في مدرسة مكة الثانوية؟`, a.name, [...names, ...(f.admins ?? []).map((x) => x.name)].filter((n) => n !== a.name)));
  }
  for (const [g, n] of Object.entries(f.classes ?? {})) {
    out.push(mcq(`كم عدد فصول ${GRADE_NAMES[g] ?? `الصف ${g}`} في مدرستنا؟`, String(n), nums(n, [-2, -1, 1, 2])));
  }
  const periods = f.periods ?? [];
  const first = periods.find((p) => p.kind === "period" && p.no === 1);
  if (first) out.push(mcq("متى تبدأ الحصة الأولى في مدرستنا؟", first.start, [-15, 15, 30].map((d) => addMin(first.start, d))));
  const brk = periods.find((p) => p.kind !== "period");
  if (brk) out.push(mcq(`متى تبدأ «${brk.label}» في مدرستنا؟`, brk.start, [-20, 20, 40].map((d) => addMin(brk.start, d))));
  const last = [...periods].reverse().find((p) => p.kind === "period");
  if (last && last !== first) out.push(mcq("متى ينتهي اليوم الدراسي (آخر حصة) في مدرستنا؟", last.end, [-30, -15, 15].map((d) => addMin(last.end, d))));
  if (f.lab_devices) out.push(mcq("كم جهازًا في معمل الحاسب الآلي بمدرستنا؟", String(f.lab_devices), nums(f.lab_devices, [-6, -2, 4, 8])));
  for (const e of (f.events ?? []).slice(0, 2)) {
    const d = new Date(e.date);
    const fmt = (x) => x.toLocaleDateString("ar-SA-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long" });
    out.push(mcq(`متى موعد «${e.title}» في مدرستنا؟`, fmt(d), [-7, -3, 4].map((k) => fmt(new Date(d.getTime() + k * 864e5)))));
  }
  return shuffle(out.filter(Boolean));
}

// الحرف الأول من الاسم بمفتاح بنك حروف: الألف بأشكالها «أ»، والهاء «ه»
const letterOf = (name) => {
  const c = String(name ?? "").trim().replace(/^(ال)/, "")[0];
  return c && "اأإآ".includes(c) ? "أ" : c === "ة" ? "ه" : c;
};

/** أسئلة حروف من المدرسة: { "ف": [{ q, a, school }] } — جوابها اسم معلم أو إداري يبدأ بالحرف */
export function schoolHuroof(f) {
  const m = {};
  if (!f) return m;
  const add = (l, q, a) => l && (m[l] ??= []).push({ q, a, school: true });
  const bySub = {};
  (f.teachers ?? []).forEach((t) => (t.subjects ?? []).forEach((s) => (bySub[s] ??= []).push(t.name)));
  for (const [s, list] of Object.entries(bySub)) {
    const byL = {};
    list.forEach((n) => (byL[letterOf(n)] ??= []).push(n));
    for (const [l, ns] of Object.entries(byL)) add(l, `معلم «${s}» في مدرستنا يبدأ اسمه بهذا الحرف، من هو؟`, ns.join(" أو "));
  }
  for (const a of f.admins ?? []) if (ROLE[a.role]) add(letterOf(a.name), `${ROLE[a.role]} في مدرستنا يبدأ اسمه بهذا الحرف، من هو؟`, a.name);
  return m;
}
