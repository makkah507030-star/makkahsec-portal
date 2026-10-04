// src/lib/teacherDay.js
import { todayISO } from "./schoolTime";

/* يوم المعلم العالمي (٥ أكتوبر):
   • الشريط الاحتفائي أعلى البوابة يظهر في اليوم نفسه فقط، ثم يعود الشريط المعتاد.
   • بطاقة الشكر في رئيسية المعلم تبقى حتى نهاية الأسبوع ليحفظها من فاته اليوم. */
const MONTH = "10";
const DAY = 5;
const CARD_LAST_DAY = 9;

function octDay() {
  const [, m, d] = todayISO().split("-");
  return m === MONTH ? Number(d) : null;
}

export function isTeacherDay() {
  return octDay() === DAY;
}

export function showTeacherDayCard() {
  const d = octDay();
  return d !== null && d >= DAY && d <= CARD_LAST_DAY;
}
