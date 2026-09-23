// src/pages/DocumentView.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import FormSheet, { PrintArea, SHEET_PX } from "../components/FormSheet.jsx";

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
