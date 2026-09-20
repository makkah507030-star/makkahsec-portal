import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { fmtDateTime } from "../lib/dates";

const CAT_LABEL = {
  bug: "مشكلة تقنية",
  suggestion: "اقتراح",
  data: "خطأ بيانات",
  other: "أخرى",
};

const STATUS = [
  { key: "new",         label: "جديدة",        cls: "bg-warning-light text-warning" },
  { key: "in_progress", label: "قيد المعالجة",  cls: "bg-late/10 text-late" },
  { key: "done",        label: "تمت",          cls: "bg-present/10 text-present" },
];

export default function TicketDetail() {
  const { id } = useParams();
  const { profile, can } = useSession();
  const isSupport = can("feedback");

  const [ticket, setTicket] = useState(undefined); // undefined = يحمّل، null = غير موجود/غير مصرّح
  const [replies, setReplies] = useState([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const load = async () => {
    const { data: t } = await supabase.from("feedback").select("*").eq("id", id).maybeSingle();
    setTicket(t ?? null);
    if (t) {
      const { data: r } = await supabase
        .from("feedback_replies")
        .select("*")
        .eq("feedback_id", id)
        .order("created_at", { ascending: true });
      setReplies(r ?? []);
    }
  };

  useEffect(() => { load(); }, [id]);

  const setStatus = async (status) => {
    await supabase.from("feedback").update({ status }).eq("id", id);
    load();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!message.trim() && !file) {
      setError("اكتب ردًا أو أرفق صورة.");
      return;
    }
    setSending(true);

    let attachment_url = null;
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ticket-attachments")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) {
        setSending(false);
        setError("تعذّر رفع الصورة: " + upErr.message);
        return;
      }
      attachment_url = supabase.storage.from("ticket-attachments").getPublicUrl(path).data.publicUrl;
    }

    const senderRole = isSupport ? "support" : "user";
    const { error: err } = await supabase.from("feedback_replies").insert({
      feedback_id: id,
      sender_id: profile.id,
      sender_role: senderRole,
      message: message.trim(),
      attachment_url,
    });

    if (err) {
      setSending(false);
      setError("تعذّر إرسال الرد: " + err.message);
      return;
    }

    // إشعار الطرف الآخر داخل الموقع
    if (senderRole === "support") {
      if (ticket.status === "new") {
        await supabase.from("feedback").update({ status: "in_progress" }).eq("id", id);
      }
      supabase.rpc("send_notification", {
        p_title: "رد جديد من الدعم الفني",
        p_body: (message.trim() || "تم إرفاق صورة").slice(0, 140),
        p_kind: "alert",
        p_link: `/ticket/${id}`,
        p_roles: null,
        p_user_ids: [ticket.user_id],
        p_grade: null,
        p_class_no: null,
        p_is_auto: true,
      }).then(() => {});
    } else {
      supabase.rpc("notify_ticket_support", {
        p_feedback_id: id,
        p_title: "رد جديد على تذكرة دعم",
        p_body: (message.trim() || "تم إرفاق صورة").slice(0, 140),
        p_link: `/ticket/${id}`,
      }).then(() => {});
    }

    setMessage("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setSending(false);
    load();
  };

  if (ticket === undefined) {
    return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  }

  if (ticket === null) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">التذكرة غير موجودة</p>
        <p className="mt-1 text-sm text-muted">
          إمّا أنها حُذفت أو أنّك لا تملك صلاحية الاطّلاع عليها.
        </p>
        <Link to="/contact" className="btn-primary mt-5 inline-block">
          مركز الدعم والمساندة
        </Link>
      </div>
    );
  }

  const st = STATUS.find((s) => s.key === ticket.status) ?? STATUS[0];

  // دمج نص الطلب الأصلي كأول رسالة في المحادثة، ثم الردود بترتيبها
  const thread = [
    {
      id: "root",
      sender_role: "user",
      message: ticket.message,
      attachment_url: null,
      created_at: ticket.created_at,
    },
    ...replies,
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link to={isSupport ? "/feedback-admin" : "/contact"} className="text-xs font-medium text-muted hover:text-mint-deep">
          ← العودة
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-ink">تذكرة دعم</h1>
          <span className="chip bg-mint-tint text-mint-deep">
            {CAT_LABEL[ticket.category] ?? ticket.category}
          </span>
          <span className={`chip ${st.cls}`}>{st.label}</span>
        </div>
        {(ticket.name || ticket.contact || ticket.role_label) && (
          <p className="mt-1.5 text-xs text-muted">
            {ticket.name}
            {ticket.name && ticket.role_label && " · "}
            {ticket.role_label}
            {(ticket.name || ticket.role_label) && ticket.contact && " · "}
            {ticket.contact && <span className="num">{ticket.contact}</span>}
          </p>
        )}
      </div>

      {isSupport && (
        <div className="flex flex-wrap gap-3 text-xs font-medium">
          {STATUS.filter((s) => s.key !== ticket.status).map((s) => (
            <button key={s.key} onClick={() => setStatus(s.key)} className="text-mint-deep hover:underline">
              وضع كـ{s.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {thread.map((m) => {
          const mine = m.sender_role === (isSupport ? "support" : "user");
          return (
            <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[85%] rounded-card px-4 py-3 text-sm leading-relaxed ${
                  m.sender_role === "support"
                    ? "bg-mint-tint text-ink"
                    : "border border-line bg-white text-ink"
                }`}
              >
                <p className="text-[11px] font-semibold text-muted">
                  {m.sender_role === "support" ? "فريق الدعم الفني" : "صاحب الطلب"}
                </p>
                {m.message && <p className="mt-1 whitespace-pre-wrap">{m.message}</p>}
                {m.attachment_url && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" className="mt-2 block">
                    <img
                      src={m.attachment_url}
                      alt="مرفق"
                      className="max-h-56 rounded-sm2 border border-line object-cover"
                    />
                  </a>
                )}
                <p className="mt-1.5 text-[11px] text-faint">{fmtDateTime(m.created_at)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="card space-y-3 p-4">
        <textarea
          className="field"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="اكتب ردّك هنا…"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-xs text-muted"
          />
          <button className="btn-primary" disabled={sending}>
            {sending ? "جارٍ الإرسال…" : "إرسال الرد"}
          </button>
        </div>
        {error && (
          <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{error}</p>
        )}
      </form>
    </div>
  );
}
