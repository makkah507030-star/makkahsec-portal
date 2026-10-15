// src/lib/backStep.js
import { useEffect, useRef, useSyncExternalStore } from "react";

/* =====================================================================
   خطوات الرجوع داخل الصفحة
   بعض الصفحات تفتح تفاصيلها داخلها (نموذج، ملف معلم، تصميم…) دون تغيّر
   الرابط، فكان زر الرجوع في الجوال والمتصفح يُخرج من الصفحة كلها.
   useBackStep(مفتوح, إغلاق) يسجّل خطوة في سجل التصفح ما دامت التفاصيل
   مفتوحة، فيغلقها زر الرجوع (أو السحب من حافة الجوال) ويبقى في الصفحة.
   وإغلاقها بزر «رجوع» داخل الصفحة يزيل الخطوة من السجل أيضًا.
   والخطوات المفتوحة يقرؤها الزر العائم في Layout عبر useBackSteps.
   ===================================================================== */

let seq = 0;
let leaving = null;           // خطوة أُغلقت وتنتظر إزالتها من السجل
let stack = [];               // الخطوات المفتوحة بترتيب فتحها: [{ id, label }]
const subs = new Set();
const emit = () => subs.forEach((f) => f());

const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
const snapshot = () => stack;

export function useBackSteps() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function goBack() {
  window.history.back();
}

export function useBackStep(active, close, label = "رجوع") {
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });

  useEffect(() => {
    if (!active) return;
    const id = `step-${++seq}`;
    // نُبقي حالة الموجّه (react-router) كما هي ونضيف إليها معرّف الخطوة.
    // وإن فُتحت خطوة فور إغلاق أخرى (كإعادة التشغيل في StrictMode) نأخذ مكانها في السجل
    const st = { ...window.history.state, backStep: id };
    if (leaving && window.history.state?.backStep === leaving) window.history.replaceState(st, "");
    else window.history.pushState(st, "");
    leaving = null;
    stack = [...stack, { id, label }];
    emit();

    let popped = false;
    const onPop = () => {
      // الرجوع من خطوة داخلية يبقينا في خطوتنا؛ غير ذلك فقد خرجنا منها
      if (window.history.state?.backStep === id || stack.at(-1)?.id !== id) return;
      popped = true;
      closeRef.current?.();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      stack = stack.filter((s) => s.id !== id);
      emit();
      // أُغلقت من داخل الصفحة والخطوة ما زالت آخر السجل: نزيلها منه
      if (popped) return;
      leaving = id;
      queueMicrotask(() => {
        if (leaving !== id) return;
        leaving = null;
        if (window.history.state?.backStep === id) window.history.back();
      });
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
}

/* خطوة بقيت في السجل بعد مغادرة الصفحة وتفاصيلها مفتوحة: الرجوع إليها
   لا يعرض شيئًا جديدًا، فنتخطاها إلى ما قبلها كي لا يُضغط الرجوع مرتين. */
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    const sid = window.history.state?.backStep;
    if (sid && !stack.some((s) => s.id === sid)) window.history.back();
  });
}
