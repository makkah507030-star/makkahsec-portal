// src/pages/ReferralView.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import ReferralSheet, { ReferralPrintArea } from "../components/ReferralSheet.jsx";

/* =====================================================================
   عرض ملف الإحالة لصاحبه: الطالب للاطّلاع، وولي الأمر للاطّلاع
   وتأكيد الاستلام وكتابة ردّه، فيعود الرد لوكيل شؤون الطلاب والموجه.
   ===================================================================== */

export default function ReferralView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();

  const [r, setR] = useState(null);
  const [stamp, setStamp] = useState(null);
  const [isGuardian, setIsGuardian] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState("");

  const box = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from("student_referrals").select("*").eq("id", id).maybeSingle();
      if (e || !data) { setError("الملف غير موجود أو لا تملك صلاحية عرضه."); return; }
      setR(data);
      setNote(data.guardian_note ?? "");

      const uid = session?.user?.id;
      if (uid) {
        const { data: g } = await supabase.from("guardians")
          .select("id").eq("user_id", uid).maybeSingle();
        if (g) {
          const { data: link } = await supabase.from("guardian_student")
            .select("student_id").eq("guardian_id", g.id)
            .eq("student_id", data.student_id).maybeSingle();
          setIsGuardian(Boolean(link));
        }
      }

      const { data: asset } = await supabase.from("school_assets")
        .select("path").eq("key", "stamp").maybeSingle();
      if (asset?.path) {
        const { data: su } = await supabase.storage
          .from("form-assets").createSignedUrl(asset.path, 3600);
        setStamp(su?.signedUrl ?? null);
      }
    })();
  }, [id, session]);

  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      if (w) setScale(Math.min(1, Math.max(0.3, (w - 8) / 794)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [r]);

  const acknowledge = async () => {
    setBusy(true);
    const { error: e } = await supabase.from("student_referrals").update({
      guardian_id: session?.user?.id ?? null,
      guardian_ack_at: new Date().toISOString(),
      guardian_note: note.trim() || null,
      status: "guardian_replied",
    }).eq("id", r.id);
    setBusy(false);
    if (e) { setMsg({ ok: false, text: `تعذّر الحفظ: ${e.message}` }); return; }
    setR((x) => ({ ...x, guardian_ack_at: new Date().toISOString(),
                   guardian_note: note.trim(), status: "guardian_replied" }));
    setMsg({ ok: true, text: "شكرًا لك. وصل إقرارك وردّك لوكيل شؤون الطلاب." });
  };

  if (error) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">تعذّر عرض الملف</p>
        <p className="mt-1.5 text-sm text-muted">{error}</p>
        <button onClick={() => navigate("/")}
                className="mt-4 rounded-pill border border-line px-4 py-1.5 text-sm text-muted">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  if (!r) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  const needsAck = isGuardian && !r.guardian_ack_at;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">إحالة {r.student_name}</h1>
          <p className="num mt-0.5 text-xs text-faint">{r.serial}</p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>طباعة / حفظ PDF</button>
      </div>

      {needsAck && (
        <section className="no-print card space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">تأكيد الاستلام</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              اطّلع على الإحالة أدناه، ثم أكّد استلامك واكتب ردّك إن رغبت.
            </p>
          </div>
          <textarea rows={4} className="field w-full" value={note}
                    placeholder="ردّك أو ملاحظتك (اختياري)"
                    onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full" onClick={acknowledge} disabled={busy}>
            {busy ? "جارٍ الإرسال…" : "أقرّ بالاطّلاع وإرسال الرد"}
          </button>
          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
        </section>
      )}

      {isGuardian && r.guardian_ack_at && (
        <p className="no-print rounded-card bg-present/10 px-4 py-3 text-sm text-present">
          وصل إقرارك بالاطّلاع، وردّك محفوظ في الملف.
        </p>
      )}

      <div ref={box} className="no-print overflow-hidden rounded-card border border-line bg-white">
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top right",
                      width: 794, height: 1123 * scale }}>
          <ReferralSheet r={r} stampUrl={stamp} />
        </div>
      </div>

      <div className="hidden print:block">
        <ReferralPrintArea>
          <ReferralSheet r={r} stampUrl={stamp} />
        </ReferralPrintArea>
      </div>

      <p className="no-print text-xs leading-relaxed text-faint">
        هذه نسخة إلكترونية من ملف الإحالة. للنسخة الرسمية راجع إدارة المدرسة.
      </p>
    </div>
  );
}
