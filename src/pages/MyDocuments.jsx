// src/pages/MyDocuments.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { fmtDateTime } from "../lib/dates";

/* =====================================================================
   نماذجي — كل مستند صدر باسم المستخدم يظهر هنا.
   ولي الأمر يرى مستندات أبنائه أيضًا. تفتح بالضغط في صفحة العرض
   فتُطبع منها نسخة. القيود مفروضة في قاعدة البيانات لا في الواجهة.
   ===================================================================== */

const STATUS_CHIP = {
  issued:   { t: "صادر",            c: "bg-present/10 text-present" },
  approved: { t: "معتمد",           c: "bg-present/10 text-present" },
  pending:  { t: "بانتظار الاعتماد", c: "bg-warning/10 text-warning" },
  rejected: { t: "مُعاد للتعديل",    c: "bg-absent/10 text-absent" },
};

export default function MyDocuments() {
  const { session, profile } = useSession();
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) { setDocs([]); return; }

      // أبناء ولي الأمر — ليرى مستنداتهم
      let childIds = [];
      const { data: g } = await supabase
        .from("guardians").select("id").eq("user_id", uid).maybeSingle();
      if (g) {
        const { data: kids } = await supabase
          .from("guardian_student").select("student_id").eq("guardian_id", g.id);
        childIds = (kids ?? []).map((k) => k.student_id).filter(Boolean);
      }

      const filter = childIds.length
        ? `recipient_user_id.eq.${uid},student_id.in.(${childIds.join(",")})`
        : `recipient_user_id.eq.${uid}`;

      const { data } = await supabase
        .from("form_documents")
        .select("id, title, serial, recipient, status, created_at")
        .or(filter)
        .in("status", ["issued", "approved"])
        .order("created_at", { ascending: false })
        .limit(100);

      setDocs(data ?? []);
    })();
  }, [session]);

  if (docs === null) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">نماذجي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          الشهادات والنماذج الصادرة باسم
          {profile?.full_name ? ` ${profile.full_name}` : "ك"}. اضغط أيًّا منها لعرضه وطباعته.
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا توجد نماذج بعد</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
            ستظهر هنا أي شهادة أو نموذج يصدر لك من المدرسة.
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {docs.map((d) => (
            <Link key={d.id} to={`/doc/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-canvas">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                <p className="num mt-0.5 text-xs text-faint">
                  {d.serial}
                  {d.recipient ? ` · ${d.recipient}` : ""}
                  {d.created_at ? ` · ${fmtDateTime(d.created_at)}` : ""}
                </p>
              </div>
              <span className={`chip shrink-0 ${STATUS_CHIP[d.status]?.c ?? ""}`}>
                {STATUS_CHIP[d.status]?.t ?? d.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
