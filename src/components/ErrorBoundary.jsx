import { Component } from "react";

// حدود خطأ عامة: تمنع «الشاشة البيضاء» عند أي استثناء أثناء العرض.
// السلوك: عند أول خطأ نُعيد تحميل الصفحة تلقائيًا مرة واحدة (غالبًا يكون
// الخطأ عابرًا — مثل لحظة انتقال حالة الدخول قبل اكتمال بيانات الجلسة —
// فيزول بإعادة تحميل نظيفة). إن تكرر الخطأ خلال ثوانٍ (خطأ ثابت لا عابر)
// نعرض رسالة ودّية بزر إعادة محاولة بدل حلقة إعادة تحميل لا نهائية.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, message: String(error?.message || error || "خطأ غير معروف") };
  }

  componentDidCatch(error, info) {
    // تسجيل للاطلاع في أدوات المطوّر
    console.error("ErrorBoundary caught:", error, info);

    let last = 0;
    try { last = Number(sessionStorage.getItem("mk_eb_reload") || 0); } catch { /* تجاهل */ }

    // أُعيد التحميل خلال آخر 15 ثانية؟ إذن الخطأ ثابت — لا نُعيد التحميل ثانيةً
    if (Date.now() - last < 15000) return;

    try { sessionStorage.setItem("mk_eb_reload", String(Date.now())); } catch { /* تجاهل */ }
    window.location.reload();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    // تظهر فقط إذا فشلت إعادة التحميل التلقائية (خطأ متكرر) — واجهة تعافٍ ودّية
    return (
      <div className="flex min-h-screen items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">تعذّر عرض الصفحة</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            حدث خلل مؤقت. جرّب إعادة المحاولة، وإن تكرّر فأبلغ الدعم الفني.
          </p>
          <button
            onClick={() => { try { sessionStorage.removeItem("mk_eb_reload"); } catch { /* تجاهل */ } window.location.href = "/"; }}
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[#3E6350] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#345343]"
          >
            إعادة المحاولة
          </button>
          {this.state.message && (
            <p className="mt-4 break-words rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-400" dir="ltr">
              {this.state.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
