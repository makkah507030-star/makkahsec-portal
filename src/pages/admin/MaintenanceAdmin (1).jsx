import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";

export default function MaintenanceAdmin() {
  const { profile, adminRoles } = useSession();
  const isTechSupport = adminRoles.includes("tech_support");

  const [row, setRow] = useState(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("maintenance_state")
      .select("is_enabled, message, updated_at, updated_by")
      .eq("id", 1)
      .maybeSingle();
    setRow(data ?? { is_enabled: false, message: null });
    setMessage(data?.message ?? "");
  };

  useEffect(() => { load(); }, []);

  if (!isTechSupport) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">هذه الصفحة مخصصة للدعم الفني فقط</p>
        <p className="mt-1.5 text-sm text-muted">لا تملك صلاحية الوصول إلى وضع الصيانة.</p>
      </div>
    );
  }

  const toggle = async (next) => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("maintenance_state")
      .update({
        is_enabled: next,
        message: message.trim() || null,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: next ? "تم تفعيل وضع الصيانة — البوابة محجوبة الآن عن جميع المستخدمين ما عداك." : "تم إلغاء وضع الصيانة — البوابة متاحة الآن للجميع." });
    await load();
  };

  const saveMessageOnly = async () => {
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from("maintenance_state")
      .update({
        message: message.trim() || null,
        updated_by: profile?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setSaving(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: "تم تحديث نص الرسالة." });
    await load();
  };

  if (!row) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">وضع الصيانة</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          عند التفعيل تُحجب البوابة عن جميع المستخدمين (بمن فيهم الإدارة) ويظهر لهم شاشة رسالة فقط،
          باستثناء حسابات الدعم الفني التي تبقى قادرة على الدخول لإلغاء الحجب.
        </p>
      </div>

      <section className={`card p-5 ${row.is_enabled ? "border-absent/40 bg-absent/5" : ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-ink">
              الحالة الحالية:{" "}
              <span className={row.is_enabled ? "text-absent" : "text-present"}>
                {row.is_enabled ? "مُفعّل — البوابة محجوبة" : "غير مُفعّل — البوابة متاحة"}
              </span>
            </p>
            {row.updated_at && (
              <p className="mt-1 text-xs text-muted">آخر تحديث: {fmtDateTime(row.updated_at)}</p>
            )}
          </div>
          <button
            onClick={() => toggle(!row.is_enabled)}
            disabled={saving}
            className={`rounded-sm2 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              row.is_enabled ? "bg-present hover:opacity-90" : "bg-absent hover:opacity-90"}`}
          >
            {saving ? "جارٍ الحفظ…" : row.is_enabled ? "إلغاء وضع الصيانة" : "تفعيل وضع الصيانة"}
          </button>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <label className="text-xs text-muted">رسالة تظهر للمستخدمين أثناء الصيانة (اختياري)</label>
        <textarea
          className="field"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="مثال: نعمل حاليًا على تحديث النظام، نعتذر عن الإزعاج."
        />
        <button
          onClick={saveMessageOnly}
          disabled={saving}
          className="btn-ghost"
        >
          حفظ نص الرسالة
        </button>
      </section>

      {msg && (
        <p className={`rounded-card px-4 py-3 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
