import { Link } from "react-router-dom";

export default function TrialBanner() {
  return (
    <div className="bg-[#9A7B22] text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center text-xs leading-relaxed sm:text-sm">
        <span className="font-semibold">نسخة تجريبية</span>
        <span className="opacity-60">·</span>
        <span className="opacity-95">
          البوابة قيد التجربة وسيبدأ العمل بها رسميًا قريبًا، وقد تتغيّر البيانات أو الخصائص خلال هذه المرحلة.
        </span>
        <Link
          to="/feedback"
          className="font-semibold underline underline-offset-2 hover:opacity-80"
        >
          أرسل ملاحظاتك للدعم الفني
        </Link>
      </div>
    </div>
  );
}
