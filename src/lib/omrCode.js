// src/lib/omrCode.js
import { CARD } from "./omrLayout.js";

/* =====================================================================
   رمز الطالب في بطاقة الإجابة: صف من 24 مربعًا صغيرًا في الشريط السفلي بين
   العلامتين المرجعيتين السفليتين، المظلَّل منها «1». يُطبع في البطاقة باسم
   الطالب، فيعرف الماسح صاحبها دون أن يكتب الطالب شيئًا.
   • 20 بتًا: بصمة معرّف الطالب (FNV-1a)، تُطابَق مع طلاب الفصل عند القراءة.
   • 4 بتات تحقق: مجموع أنصاف البايتات + 5، فالبطاقة الخالية من الرمز (كلها
     أصفار) لا تُقرأ رمزًا صالحًا أبدًا.
   المربع 3.4 مم (أصغر بكثير من العلامة المرجعية 8 مم) وبينها فراغ، فلا يلتبس
   على كاشف العلامات، ولا يتصل مربعان متجاوران في كتلة واحدة.
   ===================================================================== */

export const CODE = { BITS: 24, DATA: 20, CELL: 3.4, PITCH: 4.6 };

/** بصمة 20 بتًا لمعرّف الطالب */
export function studentHash(id) {
  let h = 0x811c9dc5;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h ^ (h >>> 20)) & 0xfffff;
}

const check = (data) => {
  let s = 5;
  for (let i = 0; i < CODE.DATA; i += 4) s += (data >>> i) & 15;
  return s & 15;
};

/** بتات الرمز للطباعة: [1|0 × 24] */
export function studentCodeBits(id) {
  const data = studentHash(id);
  const v = data | (check(data) << CODE.DATA);
  return Array.from({ length: CODE.BITS }, (_, i) => (v >>> i) & 1);
}

/** من البتات المقروءة إلى البصمة، أو null إن لم يكن رمزًا صالحًا */
export function decodeBits(bits) {
  if (!bits || bits.length !== CODE.BITS || bits.some((b) => b == null)) return null;
  const v = bits.reduce((a, b, i) => a | (b << i), 0) >>> 0;
  const data = v & 0xfffff;
  return ((v >>> CODE.DATA) & 15) === check(data) ? data : null;
}

/** مراكز مربعات الرمز بالمليمتر في بطاقة بتخطيط layout (cardLayout) */
export function codeCells(layout) {
  const { W, H } = layout;
  const span = (CODE.BITS - 1) * CODE.PITCH;
  const x0 = (W - span) / 2;
  const y = H - CARD.PAD - CARD.MARK / 2;
  return Array.from({ length: CODE.BITS }, (_, i) => ({ x: x0 + i * CODE.PITCH, y }));
}

/** طلاب الفصل بحسب بصمتهم — البصمة المشتركة بين طالبين (نادرة جدًا) لا تُعتمد */
export function hashIndex(students) {
  const m = new Map();
  students.forEach((s) => {
    const h = studentHash(s.id);
    m.set(h, m.has(h) ? null : s);
  });
  return m;
}
