// src/lib/qudratPlan.js
// Copyright © 2026 محمد بن حسن الحازمي — جميع الحقوق محفوظة (انظر LICENSE).
// Author: محمد بن حسن الحازمي
// خطة التدريب اليومية لمركز التدريب (القدرات): من موعد الاختبار ووقت التدريب اليومي
// ومستوى الطالب في كل مهارة. الأيام الباقية ثلاث مراحل:
//   التأسيس (40%): مهارة كمية ومهارة لفظية كل يوم بالتناوب، الأضعف أولًا.
//   التدريب المكثف (40%): أضعف مهارتين في كل قسم، مع محاكاة كل أسبوع.
//   المحاكاة والمراجعة (20%): اختبار محاكٍ كل ثلاثة أيام، ومراجعة الأخطاء بينها.
// واليوم الأخير قبل الاختبار مراجعة خفيفة وراحة. وإن قلّت الأيام سقط التأسيس أولًا.
import { SKILLS } from "../qudrat-content/index.js";

const DAY = 86400000;
export const isoDay = (d = new Date()) => new Date(new Date(d).getTime() + 3 * 3600000).toISOString().slice(0, 10);  // توقيت الرياض
export const addDays = (s, n) => new Date(new Date(`${s}T12:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / DAY);

export const PHASES = {
  base: { t: "التأسيس", c: "bg-mint-tint text-mint-deep" },
  drill: { t: "التدريب المكثف", c: "bg-late/10 text-late" },
  mock: { t: "المحاكاة والمراجعة", c: "bg-excused/10 text-excused" },
  rest: { t: "مراجعة خفيفة", c: "bg-present/10 text-present" },
};

// ترتيب مهارات القسم من الأضعف: التي لم يُتدرَّب عليها كالأضعف
const weakest = (sec, bySkill) => Object.keys(SKILLS).filter((k) => SKILLS[k].sec === sec)
  .map((k) => { const s = bySkill[k]; return { k, p: s?.t ? s.c / s.t : -1 }; })
  .sort((a, b) => a.p - b.p).map((x) => x.k);

/* أيام الخطة من اليوم إلى ما قبل الاختبار: [{ date, i, phase, kind:"practice"|"mock"|"rest", skills, count }] */
export function buildPlan({ exam_date, daily_minutes = 30 }, bySkill = {}, today = isoDay()) {
  const left = daysBetween(today, exam_date);
  if (left <= 0) return [];
  const count = Math.max(8, Math.round(daily_minutes * 0.8));   // نحو دقيقة وربع للسؤال مع قراءة الحل
  const q = weakest("quant", bySkill), v = weakest("verbal", bySkill);
  const nBase = left >= 10 ? Math.round(left * 0.4) : 0;
  const nMock = Math.max(1, Math.round(left * 0.2));
  const days = [];
  for (let i = 0; i < left; i++) {
    const date = addDays(today, i);
    let d;
    if (i === left - 1 && left > 1) d = { phase: "rest", kind: "rest", skills: [], count: Math.round(count / 2) };
    else if (i < nBase) d = { phase: "base", kind: "practice", skills: [q[i % q.length], v[i % v.length]], count };
    else if (i < left - nMock) {
      const j = i - nBase;
      d = (j + 1) % 7 === 0 ? { phase: "drill", kind: "mock", skills: [], count: 96 }
        : { phase: "drill", kind: "practice", skills: [q[j % 2], v[j % 2], q[(j + 1) % 2]], count };
    } else {
      const j = i - (left - nMock);
      d = j % 3 === 0 ? { phase: "mock", kind: "mock", skills: [], count: 96 }
        : { phase: "mock", kind: "practice", skills: [], review: true, count };
    }
    days.push({ date, i, ...d });
  }
  return days;
}

// خيارات الموعد التقريبي لمن لا يعرف موعده
export const APPROX = [["بعد أسبوعين", 14], ["بعد شهر", 30], ["بعد شهرين", 60], ["بعد ثلاثة أشهر", 90], ["بعد ستة أشهر", 180]];
