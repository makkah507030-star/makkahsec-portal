import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { KIND_META } from "../../lib/useNotifications";
import { fmtDateTime } from "../../lib/dates";
import { GRADE_NAMES } from "../../lib/schoolTime";

const ROLES = [
  { key: "teacher",  label: "المعلمون" },
  { key: "student",  label: "الطلاب" },
  { key: "guardian", label: "أولياء الأمور" },
  { key: "admin",    label: "الإدارة" },
];

const KINDS = [
  { key: "general", label: "تعميم" },
  { key: "alert",   label: "تنبيه" },
];

export default function NotificationsAdmin() {
  const [tab, setTab] = useState("send");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الإشعارات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          إرسال تعاميم وتنبيهات داخل البوابة — تصل فورًا دون أي تكلفة.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Tab on={tab === "send"} onClick={() => setTab("send")}>إرسال</Tab>
        <Tab on={tab === "log"}  onClick={() => setTab("log")}>السجل</Tab>
      </div>

      {tab === "send" && <SendForm />}
      {tab === "log"  && <SentLog />}
    </div>
  );
}

/* ===================== الإرسال ===================== */

function SendForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("general");
  const [mode, setMode] = useState("roles"); // roles | class | people

  const [roles, setRoles] = useState(new Set(["teacher"]));
  const [grade, setGrade] = useState(0);
  const [classNo, setClassNo] = useState(0);
  const [classList, setClassList] = useState([]);
  const [classRoles, setClassRoles] = useState(new Set(["student", "guardian"]));

  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState([]);

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("v_active_students").select("class_no").order("class_no");
      setClassList([...new Set((data ?? []).map((r) => r.class_no))]);
    })();
  }, []);

  const toggle = (setFn) => (k) =>
    setFn((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const search = async () => {
    const term = q.trim();
    if (term.length < 3) return;
    const { data } = await supabase
      .from("users")
      .select("id, username, full_name, role")
      .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
      .eq("is_active", true)
      .limit(20);
    setFound(data ?? []);
  };

  const addPerson = (u) => {
    if (!picked.some((p) => p.id === u.id)) setPicked((p) => [...p, u]);
    setFound([]);
    setQ("");
  };

  const canSend = useMemo(() => {
    if (title.trim().length < 3) return false;
    if (mode === "roles")  return roles.size > 0;
    if (mode === "class")  return classRoles.size > 0 && (grade || classNo);
    if (mode === "people") return picked.length > 0;
    return false;
  }, [title, mode, roles, classRoles, grade, classNo, picked]);

  const send = async () => {
    setSending(true);
    setMsg(null);

    const args = {
      p_title: title.trim(),
      p_body: body.trim() || null,
      p_kind: kind,
      p_link: null,
      p_roles: null,
      p_user_ids: null,
      p_grade: null,
      p_class_no: null,
      p_is_auto: false,
    };

    if (mode === "roles") {
      args.p_roles = Array.from(roles);
    } else if (mode === "class") {
      args.p_roles = Array.from(classRoles);
      if (grade) args.p_grade = grade;
      if (classNo) args.p_class_no = classNo;
    } else {
      args.p_user_ids = picked.map((p) => p.id);
    }

    const { data, error } = await supabase.rpc("send_notification", args);
    setSending(false);

    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (!data)  { setMsg({ ok: false, text: "لا يوجد مستلمون مطابقون." }); return; }

    setMsg({ ok: true, text: "أُرسل الإشعار." });
    setTitle(""); setBody(""); setPicked([]);
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4">
        <div>
          <label className="text-xs text-muted">عنوان الإشعار</label>
          <input className="field mt-1" value={title}
                 onChange={(e) => setTitle(e.target.value)}
                 placeholder="مثال: اجتماع المعلمين غدًا" />
        </div>

        <div>
          <label className="text-xs text-muted">التفاصيل (اختياري)</label>
          <textarea className="field mt-1" rows={3} value={body}
                    onChange={(e) => setBody(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-muted">النوع</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button key={k.key} type="button" onClick={() => setKind(k.key)}
                className={pill(kind === k.key)}>{k.label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <h2 className="text-sm font-semibold text-ink">المستلمون</h2>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setMode("roles")}  className={pill(mode === "roles")}>فئة كاملة</button>
          <button onClick={() => setMode("class")}  className={pill(mode === "class")}>صف أو فصل</button>
          <button onClick={() => setMode("people")} className={pill(mode === "people")}>أشخاص محددون</button>
        </div>

        {mode === "roles" && (
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <button key={r.key} onClick={() => toggle(setRoles)(r.key)}
                className={pill(roles.has(r.key))}>{r.label}</button>
            ))}
          </div>
        )}

        {mode === "class" && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted">الفئة</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {ROLES.filter((r) => r.key === "student" || r.key === "guardian").map((r) => (
                  <button key={r.key} onClick={() => toggle(setClassRoles)(r.key)}
                    className={pill(classRoles.has(r.key))}>{r.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted">الصف</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button onClick={() => { setGrade(0); setClassNo(0); }} className={pill(!grade)}>الكل</button>
                {[1, 2, 3].map((g) => (
                  <button key={g} onClick={() => { setGrade(g); setClassNo(0); }}
                    className={pill(grade === g)}>{GRADE_NAMES[g]}</button>
                ))}
              </div>
            </div>

            {grade > 0 && (
              <div>
                <p className="text-xs text-muted">الفصل</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <button onClick={() => setClassNo(0)} className={pill(!classNo)}>كل فصول الصف</button>
                  {classList.filter((c) => Math.floor(c / 100) === grade).map((c) => (
                    <button key={c} onClick={() => setClassNo(c)} className={pill(classNo === c)}>
                      <span className="num">{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === "people" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input className="field flex-1" value={q}
                     onChange={(e) => setQ(e.target.value)}
                     onKeyDown={(e) => e.key === "Enter" && search()}
                     placeholder="ابحث بالاسم أو رقم الهوية" />
              <button className="btn-primary" onClick={search}>بحث</button>
            </div>

            {found.length > 0 && (
              <div className="max-h-48 divide-y divide-line overflow-auto rounded-sm2 border border-line">
                {found.map((u) => (
                  <button key={u.id} onClick={() => addPerson(u)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right hover:bg-mint-tint">
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink">{u.full_name ?? u.username}</span>
                      <span className="num block text-xs text-faint">{u.username}</span>
                    </span>
                    <span className="chip bg-gray-tint text-muted">{roleLabel(u.role)}</span>
                  </button>
                ))}
              </div>
            )}

            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((p) => (
                  <span key={p.id}
                    className="flex items-center gap-1.5 rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1 text-xs text-mint-deep">
                    {p.full_name ?? p.username}
                    <button onClick={() => setPicked((l) => l.filter((x) => x.id !== p.id))}
                      className="text-absent">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {msg && (
        <p className={`rounded-card px-4 py-3 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
          {msg.text}
        </p>
      )}

      <button className="btn-primary" onClick={send} disabled={!canSend || sending}>
        {sending ? "جارٍ الإرسال…" : "إرسال الإشعار"}
      </button>
    </div>
  );
}

/* ===================== السجل ===================== */

function SentLog() {
  const [rows, setRows] = useState(null);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, kind, is_auto, created_at, notification_recipients(count)")
      .order("created_at", { ascending: false })
      .limit(60);
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const remove = async (id) => {
    if (!confirm("حذف هذا الإشعار من صناديق الجميع؟")) return;
    await supabase.from("notifications").delete().eq("id", id);
    await load();
  };

  if (!rows) return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (!rows.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا إشعارات</p>
        <p className="mt-1.5 text-sm text-muted">لم تُرسل إشعارات بعد.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((n) => {
        const meta = KIND_META[n.kind] ?? KIND_META.general;
        const count = n.notification_recipients?.[0]?.count ?? 0;
        return (
          <article key={n.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${meta.tone}`}>{meta.label}</span>
              {n.is_auto && <span className="chip bg-gray-tint text-muted">تلقائي</span>}
              <span className="num chip bg-mint-tint text-mint-deep">{count} مستلم</span>
              <span className="ms-auto text-xs text-faint">{fmtDateTime(n.created_at)}</span>
            </div>

            <p className="mt-2.5 text-sm font-medium text-ink">{n.title}</p>
            {n.body && (
              <p className="mt-1 text-xs leading-relaxed text-muted">{n.body}</p>
            )}

            <button onClick={() => remove(n.id)}
              className="mt-3 text-xs font-medium text-absent hover:underline">
              حذف
            </button>
          </article>
        );
      })}
    </div>
  );
}

/* ===================== عناصر ===================== */

const pill = (on) =>
  `rounded-pill px-3.5 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

const roleLabel = (r) =>
  ({ admin: "إدارة", teacher: "معلم", student: "طالب", guardian: "ولي أمر" }[r] ?? r);

function Tab({ on, onClick, children }) {
  return <button onClick={onClick} className={pill(on)}>{children}</button>;
}
