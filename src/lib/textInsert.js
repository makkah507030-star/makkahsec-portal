// src/lib/textInsert.js

// يكتب القيمة عبر الـ setter الأصلي للعنصر ثم يُطلق حدث "input" حقيقيًا،
// فتلتقطه React كأن المستخدم كتب بنفسه (onChange العادي لا يكفي لأن
// value هنا محكوم بحالة React، وتعديله مباشرة عبر el.value لا يُشعرها).
function nativeValueSetter(el) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, "value")?.set;
}

/** يُدرج نصًا في موضع المؤشر داخل حقل إدخال أو textarea محكوم من React. */
export function insertAtCursor(el, text) {
  if (!el || typeof el.value !== "string") return false;

  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);

  const setter = nativeValueSetter(el);
  if (setter) setter.call(el, next); else el.value = next;

  el.dispatchEvent(new Event("input", { bubbles: true }));

  el.focus();
  const pos = start + text.length;
  requestAnimationFrame(() => {
    try { el.setSelectionRange(pos, pos); } catch { /* حقول بعض الأنواع لا تدعم التحديد */ }
  });
  return true;
}
