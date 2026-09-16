import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDateTime } from "../../lib/dates";
import { KIND_META } from "../../lib/useNotifications";

export default function TeacherNotify() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [classes, setClasses] = useState(null); // [{ class_id, class_no, grade }]
  const [selected, setSelected] = useState(new Set());
  const [includeGuardians, setIncludeGuardians] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [log, setLog] = useState(null);

  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const { data: t0 } = await supabase
        .from("teachers").select("id, full_name").eq("user_id", uid).maybeSingle();
      setMe(t0 ?? null);
      if (!t0) { setClasses([]); return; }

      const { data: st } = await supabase
        .from("settings").select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      const { data: sch } = await supabase
        .from("schedule")
        .select("class_id, classes(class_no, grade)")
        .eq("teacher_id", t0.id)
        .eq("academic_year", m.active_year ?? "")
        .eq("term", Number(m.active_term ?? 1));

      const map = new Map();
      (sch ?? []).forEach((r) => {
        if (!map.has(r.class_id)) {
          map.set(r.class_id, {
            class_id: r.class_id,
            class_no: r.classes?.class_no ?? 0,
            grade: r.classes?.grade ?? 0,
          });
        }
      });

      const list = [...map.values()].sort((a, b) => a.class_no - b.class_no);
      setClasses(list);
      setSelected(new Set(list.map((c) => c.class_id)));
    })();
  }, [session]);

  const loadLog = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, created_at, notification_recipients(count)")
      .eq("created_by", session?.user?.id)
      .eq("is_auto", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setLog(data ?? []);
  };

  useEffect(() => { if (session?.user?.id) loadLog(); }, [session]);

  const toggle = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const canSend = useMemo(
    () => title.trim().length >= 3 && selected.size > 0,
    [title, selected]
  );

  const send = async () => {
    setSending(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("teacher_send_notification", {
      p_title: title.trim(),
      p_body: body.trim() || null,
      p_class_ids: Array.from(selected),
      p_include_guardians: includeGuardians,
    });

    setSending(false);

    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (!data) { setMsg({ ok: false, text: "لا يوجد مستلمون لهذا الاختيار." }); return; }

    setMsg({ ok: true, text: "أُرسل الإشعار." });
    setTitle("");
    setBody("");
    loadLog();
  };

  if (classes === null) {
    return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;
  }

  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل معلم</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">إشعارات فصولي</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          يصل الإشعار فورًا داخل البوابة لطلاب الفصول التي تختارها، وأولياء أمورهم
          إن رغبت — مقصور على فصولك المسندة فعليًا.
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا توجد فصول مسندة</p>
          <p className="mt-1.5 text-sm text-muted">
            لم تُسند إليك حصص في الفصل الدراسي الحالي.
          </p>
        </div>
      ) : (
        <>
          <section className="card space-y-4 p-4">
            <div>
              <label className="text-xs text-muted">عنوان الإشعار</label>
              <input className="field mt-1" value={title}
                     onChange={(e) => setTitle(e.target.value)}
                     placeholder="مثال: يُرجى إحضار الكتاب غدًا" />
            </div>

            <div>
              <label className="text-xs text-muted">التفاصيل (اختياري)</label>
              <textarea className="field mt-1" rows={3} value={body}
                        onChange={(e) => setBody(e.target.value)} />
            </div>

            <div>
              <label className="text-xs text-muted">الفصول المستهدفة</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {classes.map((c) => {
                  const on = selected.has(c.class_id);
                  return (
                    <button key={c.class_id} type="button" onClick={() => toggle(c.class_id)}
                      className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                      {GRADE_NAMES[c.grade] ?? ""} · فصل <span className="num">{c.class_no}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={includeGuardians}
                     onChange={(e) => setIncludeGuardians(e.target.checked)} />
              إرسال لأولياء الأمور أيضًا
            </label>

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${
                msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}

            <button className="btn-primary" onClick={send} disabled={!canSend || sending}>
              {sending ? "جارٍ الإرسال…" : "إرسال الإشعار"}
            </button>
          </section>

          <section className="card overflow-hidden">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
              إشعاراتي الأخيرة
            </h2>
            {!log && <p className="px-4 py-6 text-sm text-muted">جارٍ التحميل…</p>}
            {log?.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted">لم ترسل إشعارات بعد.</p>
            )}
            <div className="divide-y divide-line">
              {log?.map((n) => (
                <div key={n.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${KIND_META.general.tone}`}>{KIND_META.general.label}</span>
                    <span className="num chip bg-mint-tint text-mint-deep">
                      {n.notification_recipients?.[0]?.count ?? 0} مستلم
                    </span>
                    <span className="ms-auto text-xs text-faint">{fmtDateTime(n.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink">{n.title}</p>
                  {n.body && <p className="mt-1 text-xs text-muted">{n.body}</p>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
