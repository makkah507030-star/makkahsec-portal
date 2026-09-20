import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/session.jsx";
import logoIcon from "../assets/icon-mint.png";

export default function MaintenanceScreen({ message }) {
  const { signOut } = useSession();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-tint p-6">
      <div className="card w-full max-w-md p-7 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mint-tint">
          <img src={logoIcon} alt="" className="h-8 w-8 object-contain" />
        </span>

        <p className="mt-4 text-lg font-bold text-ink">البوابة قيد الصيانة حاليًا</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {message?.trim() || "نعمل حاليًا على تحديث النظام. نعتذر عن الإزعاج، وستعود البوابة للعمل قريبًا."}
        </p>

        <button
          onClick={async () => { await signOut(); navigate("/login"); }}
          className="mt-6 rounded-sm2 border border-line bg-paper px-5 py-2 text-sm font-medium text-ink hover:bg-canvas"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
