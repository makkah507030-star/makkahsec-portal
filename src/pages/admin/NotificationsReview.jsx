import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { KIND_META } from "../../lib/useNotifications";
import { fmtDateTime } from "../../lib/dates";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { ADMIN_ROLE_LABEL, ROLE_LABEL } from "../../lib/session.jsx";

const roleLabel = (r) => ADMIN_ROLE_LABEL[r] ?? ROLE_LABEL[r] ?? r;

// وصف مختصر للفئة المستهدفة
function targetText(d) {
  if (d.target_mode === "people") return `${(d.target_user_ids ?? []).length} مستخدمًا محددًا`;
  const roles = (d.target_roles ?? []).map(roleLabel).join(" و");
  if (d.target_mode === "class") {
    const parts = [];
    if (d.target_grade) parts.push(GRADE_NAMES[d.target_grade] ?? `الصف ${d.target_grade}`);
    if (d.target_class_no) parts.push(`فصل ${d.target_class_no}`);
    return `${roles}${parts.length ? " · " + parts.join(" · ") : ""}`;
  }
  return roles || "—";
}

export default function NotificationsReview() {
  const { session } = useSession();
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("notification_drafts")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  // إشعار المُرسِل بنتيجة الاعتماد/الرفض
  const notifySender = async (senderId, title, body, kind) => {
    if (!senderId) return;
    try {
      await supabase.rpc("send_notification", {
        p_title: title, p_body: body || null, p_kind: kind, p_link: null,
        p_roles: null, p_user_ids: [senderId], p_grade: null, p_class_no: null, p_is_auto: true,
      });
    } catch { /* تجاهل */ }
  };

  const approve = async (d) => {
    setBusyId(d.id); setMsg(null);

    // 1) إرسال الإشعار فعليًا بنفس فئته المستهدفة
    const args = {
      p_title: d.title, p_body: d.body || null, p_kind: d.kind || "general", p_link: null,
      p_roles: null, p_user_ids: null, p_grade: null, p_class_no: null, p_is_auto: false,
    };
    if (d.target_mode === "people") args.p_user_ids = d.target_user_ids;
    else {
      args.p_roles = d.target_roles;
      if (d.target_grade) args.p_grade = d.target_grade;
      if (d.target_class_no) args.p_class_no = d.target_class_no;
    }

    const { data: nid, error } = await supabase.rpc("send_notification", args);
    if (error || !nid) {
      setBusyId(null);
      setMsg({ ok: false, text: error ? error.message : "لا يوجد مستلمون مطابقون." });
      return;
    }

    // 2) ربط الاسم/الصورة/المرفق/اليوتيوب ثم الدفع للجوالات
    try {
      await supabase.rpc("set_notification_meta", {
        p_id: nid, p_sender_name: d.sender_name, p_image_url: d.image_url,
        p_attachment_url: d.attachment_url, p_attachment_name: d.attachment_name,
        p_youtube_url: d.youtube_url,
      });
    } catch { /* تجاهل */ }
    try {
      await fetch("/.netlify/functions/push-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: nid }),
      });
    } catch { /* تجاهل */ }

    // 3) تعليم المسودّة معتمدة
    await supabase.from("notification_drafts")
      .update({ status: "approved", reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", d.id);

    // 4) إشعار المُرسِل بالاعتماد
    await notifySender(d.sender_id, "تم اعتماد إشعارك", `«${d.title}» — أُرسل للمستهدفين.`, "general");

    setBusyId(null);
    setMsg({ ok: true, text: "تم الاعتماد والإرسال." });
    setRows((r) => r.filter((x) => x.id !== d.id));
  };

  const reject = async (d) => {
    const reason = window.prompt("سبب الرفض (سيصل للمُرسِل):", "");
    if (reason === null) return;
    setBusyId(d.id); setMsg(null);

    await supabase.from("notification_drafts")
      .update({
        status: "rejected", reject_reason: reason || null,
        reviewed_by: session?.user?.id, reviewed_at: new Date().toISOString(),
      })
      .eq("id", d.id);

    await notifySender(
      d.sender_id, "لم يُعتمد إشعارك",
      `«${d.title}»${reason ? ` — السبب: ${reason}` : ""}`, "alert"
    );

    setBusyId(null);
    setMsg({ ok: true, text: "تم الرفض وإشعار المُرسِل." });
    setRows((r) => r.filter((x) => x.id !== d.id));
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">اعتماد الإشعارات</h1>
        <p className="mt-1 text-sm text-muted">
          مراجعة إشعارات الإدارة قبل إرسالها. الاعتماد يُرسلها فورًا، والرفض يُشعر المُرسِل بالسبب.
        </p>
      </div>

      {msg && (
        <p className={`rounded-card px-4 py-2.5 text-sm font-medium ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا توجد إشعارات بانتظار الاعتماد</p>
        </div>
      ) : (
        rows.map((d) => {
          const meta = KIND_META[d.kind] ?? KIND_META.general;
          return (
            <section key={d.id} className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                <span className="text-xs text-muted">
                  المُرسِل: <b className="text-ink">{d.sender_name || "—"}</b> ·{" "}
                  <span className="num">{fmtDateTime(d.created_at)}</span>
                </span>
                <span className={`chip shrink-0 ${meta.tone}`}>{meta.label}</span>
              </div>

              <div className="px-4 py-3">
                <p className="text-sm font-bold text-ink">{d.title}</p>
                {d.body && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">{d.body}</p>}

                <p className="mt-2 text-xs text-muted">الفئة المستهدفة: <b className="text-ink">{targetText(d)}</b></p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {d.image_url && (
                    <a href={d.image_url} target="_blank" rel="noreferrer" className="chip bg-mint-tint text-mint-deep">صورة مرفقة ↗</a>
                  )}
                  {d.attachment_url && (
                    <a href={d.attachment_url} target="_blank" rel="noreferrer" className="chip bg-mint-tint text-mint-deep">
                      مرفق: {d.attachment_name || "ملف"} ↗
                    </a>
                  )}
                  {d.youtube_url && (
                    <a href={d.youtube_url} target="_blank" rel="noreferrer" className="chip bg-[#FDECEC] text-[#C4302B]">فيديو يوتيوب ↗</a>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-line px-4 py-3">
                <button onClick={() => approve(d)} disabled={busyId === d.id}
                  className="btn-primary disabled:opacity-60">
                  {busyId === d.id ? "…" : "اعتماد وإرسال"}
                </button>
                <button onClick={() => reject(d)} disabled={busyId === d.id}
                  className="rounded-pill border border-absent/30 bg-absent/10 px-4 py-2 text-sm font-semibold text-absent hover:bg-absent/20 disabled:opacity-60">
                  رفض
                </button>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
