// src/pages/DocumentView.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import FormSheet, { PrintArea, SHEET_PX } from "../components/FormSheet.jsx";
import DateField from "../components/DateField.jsx";
import { useSession } from "../lib/session.jsx";

/* =====================================================================
   عرض مستند صادر لصاحبه: الطالب أو المنسوب أو ولي أمر الطالب،
   ومُصدِر المستند والدعم الفني ومدير المدرسة.
   صور التوقيع والختم تُجلب عبر دالة محميّة تتحقق من الصلاحية،
   فلا يُفتح مخزن التواقيع لبقية المستخدمين.
   ===================================================================== */

function SheetPreview({ landscape, children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      const sheet = landscape ? SHEET_PX.landscape : SHEET_PX.portrait;
      if (w) setScale(Math.min(1, Math.max(0.25, (w - 8) / sheet)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [landscape]);

  const h = (landscape ? SHEET_PX.portrait : 1123) * scale + 16;
  return (
    <div ref={box} className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="min-w-0" style={{ height: h }}>
        <div className="w-0 min-w-0" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div style={{ width: landscape ? SHEET_PX.landscape : SHEET_PX.portrait }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const [reply, setReply] = useState({});
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [doc, setDoc] = useState(null);
  const [assets, setAssets] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from("form_documents")
        .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
        .eq("id", id)
        .maybeSingle();

      if (e || !data) {
        setError("المستند غير موجود أو لا تملك صلاحية عرضه.");
        setLoading(false);
        return;
      }
      setDoc(data);
      setReply(data.data ?? {});

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/.netlify/functions/doc-assets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ document_id: id }),
        });
        const j = await res.json();
        if (res.ok) setAssets(j);
      } catch { /* يُعرض المستند بلا صور التوقيع */ }

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  if (error) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">تعذّر عرض المستند</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{error}</p>
        <button onClick={() => navigate("/")}
                className="mt-4 rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const template = { ...doc.form_templates, fields: doc.form_templates?.fields ?? [] };
  const myTurn =
    doc.status === "awaiting_reply" && doc.recipient_user_id === session?.user?.id;
  const replyFields = template.fields.filter((f) => f.by_recipient);

  const sendReply = async () => {
    const miss = replyFields.filter((f) => f.required && !String(reply[f.name] ?? "").trim());
    if (miss.length) {
      setMsg({ ok: false, text: `أكمل: ${miss.map((f) => f.label).join("، ")}` });
      return;
    }
    setSending(true);
    const { error } = await supabase
      .from("form_documents")
      .update({ data: { ...doc.data, ...reply }, status: "replied", reply_at: new Date().toISOString() })
      .eq("id", doc.id);
    setSending(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الإرسال: ${error.message}` }); return; }
    setDoc((d) => ({ ...d, status: "replied", data: { ...d.data, ...reply } }));
    setMsg({ ok: true, text: "أُرسل ردّك. ستصلك النتيجة بعد مراجعته." });
  };
  const printable = doc.status === "issued" || doc.status === "approved";
  const landscape = template.orientation === "landscape";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">{doc.title}</h1>
          <p className="num mt-0.5 text-xs text-faint">
            رقم المستند: {doc.serial}
            {doc.recipient ? ` · ${doc.recipient}` : ""}
          </p>
        </div>
        {printable ? (
          <button className="btn-primary" onClick={() => window.print()}>طباعة</button>
        ) : (
          <span className="chip bg-warning/10 text-warning">بانتظار الاعتماد</span>
        )}
      </div>

      {doc.decision_note && myTurn && (
        <div className="no-print rounded-card border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-semibold text-warning">ملاحظة على ردّك السابق</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{doc.decision_note}</p>
        </div>
      )}

      {myTurn && (
        <section className="no-print card space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">مطلوب ردّك</p>
            <p className="mt-0.5 text-xs text-muted">
              اكتب إفادتك ثم أرسلها، وستصل مُصدِر النموذج لمراجعتها.
            </p>
          </div>

          {replyFields.map((f) => (
            <div key={f.name}>
              <label className="text-xs text-muted">
                {f.label}{f.required && <span className="text-absent"> *</span>}
              </label>
              {f.type === "date" || f.type === "daterange" ? (
                <div className="mt-1">
                  <DateField range={f.type === "daterange"} value={reply[f.name] ?? ""}
                             onChange={(v) => setReply((r) => ({ ...r, [f.name]: v }))} />
                </div>
              ) : f.type === "textarea" ? (
                <textarea rows={4} className="field mt-1 w-full" value={reply[f.name] ?? ""}
                          onChange={(e) => setReply((r) => ({ ...r, [f.name]: e.target.value }))} />
              ) : (
                <input className="field mt-1 w-full" value={reply[f.name] ?? ""}
                       onChange={(e) => setReply((r) => ({ ...r, [f.name]: e.target.value }))} />
              )}
            </div>
          ))}

          <button className="btn-primary w-full" onClick={sendReply} disabled={sending}>
            {sending ? "جارٍ الإرسال…" : "إرسال الرد"}
          </button>

          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
        </section>
      )}

      {doc.status === "replied" && (
        <p className="no-print rounded-card bg-mint-tint px-4 py-3 text-sm text-mint-deep">
          وصل ردّك وهو قيد المراجعة.
        </p>
      )}

      <div className="no-print">
        <SheetPreview landscape={landscape}>
          <FormSheet
            template={template} values={doc.data} doc={doc}
            sigUrl={assets.signature} stampUrl={assets.stamp}
            principalSigUrl={assets.principal} principalName={assets.principal_name}
          />
        </SheetPreview>
      </div>

      {printable && (
        <div className="hidden print:block">
          <PrintArea landscape={landscape}>
            <FormSheet
              template={template} values={doc.data} doc={doc}
              sigUrl={assets.signature} stampUrl={assets.stamp}
              principalSigUrl={assets.principal} principalName={assets.principal_name}
            />
          </PrintArea>
        </div>
      )}

      <p className="no-print text-xs leading-relaxed text-faint">
        هذه نسخة إلكترونية من المستند. للنسخة الرسمية الموقّعة راجع إدارة المدرسة.
      </p>
    </div>
  );
}
