// src/pages/AbsenceExcuses.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { GRADE_NAMES } from "../lib/schoolTime";
import Loader from "../components/Loader.jsx";
import { EXCUSE_KIND, EXCUSE_STATUS, EXCUSE_BUCKET, dayLabel, deciderText, openExcuseFile, caseOf, REPLY_CARDS, fillReply, ExcuseGuide, CasePicker } from "../components/AbsenceExcuse.jsx";

/* =====================================================================
   أعذار الغياب — لوكيل شؤون الطلاب والمساعدَين الإداريَّين 1 و2 (ومعهم المدير والدعم الفني):
   يرفعها الطالب أو ولي أمره، فيقبلها الوكيل فيصير غياب أيامها «غائب بعذر» آليًا،
   أو يرفضها بسبب يصل المستفيد. (supabase/absence_excuses_1..2.sql)
   ===================================================================== */
// زرّا بطاقات الرد الجاهزة: القبول وعدم القبول
const REPLY_GROUPS = [
  { k: "accept", t: "ردود القبول", icon: "✓", btn: "border-excused/30 bg-excused/5 text-excused hover:bg-excused/10", on: "bg-excused/10",
    card: "border-excused/30 bg-excused/5 text-excused hover:bg-excused/10" },
  { k: "reject", t: "ردود عدم القبول", icon: "✕", btn: "border-absent/25 bg-absent/5 text-absent hover:bg-absent/10", on: "bg-absent/10",
    card: "border-absent/25 bg-absent/5 text-absent hover:bg-absent/10" },
];

const REQUESTER = { guardian: "ولي الأمر", student: "الطالب", school: "المدرسة (عذر يدوي)" };

/* عذر يدوي لم يُرفع عبر البوابة (ورقي أو حضوري): يُقبل مباشرة (supabase/absence_excuses_4.sql) */
function ManualExcuse({ onDone }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const [st, setSt] = useState(null);          // الطالب المختار
  const [days, setDays] = useState(null);      // أيام غيابه بلا عذر
  const [picked, setPicked] = useState(new Set());
  const [caseKey, setCaseKey] = useState(null);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 || st) { setHits(null); return; }
    const h = setTimeout(async () => {
      const col = /^\d+$/.test(t) ? "national_id" : "full_name";
      const { data } = await supabase.from("students").select("id, full_name, national_id")
        .eq("is_active", true).ilike(col, `%${t}%`).limit(12);
      setHits(data ?? []);
    }, 300);
    return () => clearTimeout(h);
  }, [q, st]);

  // أيام الغياب (رسمي أو حصة) في آخر 120 يومًا، بلا ما له عذر مسجّل
  useEffect(() => {
    if (!st) { setDays(null); return; }
    const from = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    Promise.all([
      supabase.from("class_attendance").select("attend_date").eq("student_id", st.id).eq("status", "absent").gte("attend_date", from),
      supabase.from("official_day_marks").select("attend_date").eq("student_id", st.id).eq("status", "absent").gte("attend_date", from),
      supabase.from("excused_absences").select("date_from, date_to").eq("student_id", st.id).gte("date_to", from),
    ]).then(([a, o, x]) => {
      const exc = (x.data ?? []);
      const all = new Set([...(a.data ?? []), ...(o.data ?? [])].map((r) => r.attend_date));
      setDays([...all].filter((d) => !exc.some((e) => d >= e.date_from && d <= e.date_to)).sort().reverse());
    });
  }, [st]);

  const toggle = (d) => setPicked((p) => { const n = new Set(p); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const c = caseOf(caseKey);

  const save = async () => {
    setBusy(true); setErr("");
    let path = null;
    if (file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      path = `${st.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(EXCUSE_BUCKET).upload(path, file, { contentType: file.type });
      if (error) { setBusy(false); setErr(`تعذّر رفع المرفق: ${error.message}`); return; }
    }
    const { data, error } = await supabase.rpc("absence_excuse_manual", {
      p_student: st.id, p_dates: [...picked].sort(), p_case: caseKey,
      p_reason: [`${c.n}. ${c.t}`, reason.trim()].filter(Boolean).join(" — "),
      p_file_path: path, p_file_name: file?.name ?? null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone(`سُجّل عذر ${st.full_name} يدويًا${data ? `، وصار غياب ${data === 1 ? "يوم" : `${data} أيام`} معتمد «غائب بعذر»` : ""}.`);
  };

  const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;
  return (
    <section className="card space-y-3 p-4">
      <p className="font-semibold text-ink">عذر يدوي لم يُرفع عبر البوابة</p>
      <p className="text-xs text-muted">لعذر ورقي أو حضوري: يُقبل مباشرة ويصير غياب أيامه «غائب بعذر»، ويظهر في السجل باسمك وصفة «المدرسة».</p>
      {!st ? (
        <div className="relative">
          <input className="field w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الطالب أو رقم هويته…" />
          {hits && (
            <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-sm2 border border-line bg-paper shadow-card">
              {hits.length === 0 && <p className="px-3 py-2 text-sm text-faint">لا نتائج</p>}
              {hits.map((h) => (
                <button key={h.id} className="block w-full px-3 py-2 text-right text-sm hover:bg-canvas" onClick={() => { setSt(h); setQ(""); }}>
                  {h.full_name} <span className="num text-xs text-faint">{h.national_id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-ink">الطالب: <b>{st.full_name}</b>
          <button className="mr-2 text-xs text-muted underline" onClick={() => { setSt(null); setPicked(new Set()); }}>تغيير</button></p>
      )}
      {st && (
        <>
          <div>
            <p className="mb-1 text-xs text-muted">أيام الغياب بلا عذر (آخر 120 يومًا)</p>
            {days === null ? <Loader /> : days.length === 0 ? <p className="text-sm text-faint">لا أيام غياب بلا عذر.</p> : (
              <div className="flex flex-wrap gap-1.5">
                {days.map((d) => <button key={d} type="button" className={pill(picked.has(d))} onClick={() => toggle(d)}>{dayLabel(d)}</button>)}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">حالة العذر (من الأعذار المقبولة رسميًا)</p>
            <CasePicker value={caseKey} onChange={setCaseKey} />
          </div>
          <input className="field w-full" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder="تفاصيل مختصرة (اختياري)، مثل: عذر ورقي سلّمه ولي الأمر" />
          <label className="block text-xs text-muted">المرفق (اختياري، صورة أو PDF){c?.proof ? ` — ${c.proof}` : ""}
            <input type="file" accept="image/*,application/pdf" className="mt-1 block text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          {err && <p className="text-xs text-absent">{err}</p>}
          <button className="btn-primary" disabled={busy || !picked.size || !caseKey} onClick={save}>
            {busy ? "جارٍ الحفظ…" : "تسجيل العذر وقبوله"}
          </button>
        </>
      )}
    </section>
  );
}

export default function AbsenceExcuses() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState(null);
  const [cls, setCls] = useState({});        // الطالب ← صفه وفصله
  const [note, setNote] = useState({});
  const [cards, setCards] = useState({});    // العذر ← مجموعة البطاقات المفتوحة (accept أو reject)
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [manual, setManual] = useState(false);

  const load = async () => {
    let q = supabase.from("absence_excuses").select("*, students(full_name)").order("created_at", { ascending: tab === "pending" });
    q = tab === "pending" ? q.eq("status", "pending") : q.neq("status", "pending").limit(200);
    const { data, error } = await q;
    if (error) { setMsg({ ok: false, text: /absence_excuses|schema cache/i.test(error.message) ? "تحتاج تشغيل supabase/absence_excuses_1.sql ثم absence_excuses_2.sql في Supabase ← SQL Editor." : error.message }); setRows([]); return; }
    setRows(data ?? []);
    const ids = [...new Set((data ?? []).map((r) => r.student_id))];
    if (ids.length) {
      const { data: v } = await supabase.from("v_active_students").select("student_id, grade, class_no").in("student_id", ids);
      setCls(Object.fromEntries((v ?? []).map((x) => [x.student_id, x])));
    }
  };
  useEffect(() => { setRows(null); load(); }, [tab]);   // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (r, accept) => {
    const n = (note[r.id] ?? "").trim();
    if (!accept && !n) { setMsg({ ok: false, text: "اكتب سبب عدم قبول العذر ليصل المستفيد." }); return; }
    setBusy(r.id); setMsg(null);
    const { data, error } = await supabase.rpc("absence_excuse_decide", { p_id: r.id, p_accept: accept, p_note: n || null });
    setBusy(null);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: accept
      ? `قُبل عذر ${r.students?.full_name ?? ""}${data ? `، وصار غياب ${data === 1 ? "يوم" : `${data} أيام`} معتمد «غائب بعذر»` : ""}.`
      : `لم يُقبل عذر ${r.students?.full_name ?? ""}، ووصل السبب إلى المستفيد.` });
    load();
  };

  const pill = (on) => `rounded-pill px-4 py-1.5 text-sm font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-ink">أعذار الغياب</h1>
        <p className="mt-1 text-sm text-muted">يرفعها الطالب أو ولي أمره من سجل غيابه. القبول يجعل غياب أيامها «غائب بعذر» آليًا، والرفض يحتاج سببًا يصل المستفيد.</p>
      </div>
      <ExcuseGuide />
      <div className="flex flex-wrap gap-1.5">
        <button className={pill(tab === "pending")} onClick={() => setTab("pending")}>بانتظار القرار</button>
        <button className={pill(tab === "done")} onClick={() => setTab("done")}>السجل</button>
        <button className={`${pill(manual)} mr-auto`} onClick={() => setManual((v) => !v)}>+ عذر يدوي</button>
      </div>
      {manual && <ManualExcuse onDone={(t) => { setManual(false); setMsg({ ok: true, text: t }); load(); }} />}
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}
      {!rows ? <Loader /> : rows.length === 0 ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">{tab === "pending" ? "لا أعذار بانتظار القرار." : "لا قرارات بعد."}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const c = cls[r.student_id];
            const st = EXCUSE_STATUS[r.status] ?? EXCUSE_STATUS.pending;
            return (
              <article key={r.id} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{r.students?.full_name}
                      {c && <span className="mr-1 text-xs font-normal text-muted">· {GRADE_NAMES[c.grade] ?? ""} / <span className="num">{c.class_no}</span></span>}</p>
                    <p className="text-xs text-muted">من {REQUESTER[r.requester] ?? "الطالب"} · <span className="num">{fmtDateTime(r.created_at)}</span></p>
                  </div>
                  <span className="chip bg-canvas text-muted">{caseOf(r.case_key) ? `الحالة ${caseOf(r.case_key).n}` : EXCUSE_KIND[r.kind] ?? ""}</span>
                  {r.status !== "pending" && <span className={`chip ${st.c}`}>{st.short}</span>}
                </div>
                <p className="text-sm text-ink"><span className="text-muted">الأيام: </span>{(r.dates ?? []).map(dayLabel).join("، ")}</p>
                {r.reason && <p className="text-sm text-ink"><span className="text-muted">السبب: </span>{r.reason}</p>}
                {caseOf(r.case_key)?.proof && <p className="text-xs text-muted">الإثبات المطلوب: <b className="text-ink">{caseOf(r.case_key).proof}</b>{caseOf(r.case_key).note && ` · ${caseOf(r.case_key).note}`}</p>}
                {r.file_path && (
                  <button className="text-xs font-semibold text-mint-deep underline"
                          onClick={() => openExcuseFile(r.file_path).catch((e) => setMsg({ ok: false, text: e.message }))}>
                    فتح المرفق{r.file_name ? ` (${r.file_name})` : ""} ↗
                  </button>
                )}
                {r.status === "pending" ? (
                  <div className="space-y-2 border-t border-line pt-2">
                  {/* بطاقات رد جاهزة في زرّين مطويين متساويين: الضغط على بطاقة يضع نصها في الملاحظة */}
                  <div className="grid grid-cols-2 gap-2">
                    {REPLY_GROUPS.map((g) => (
                      <button key={g.k} type="button" aria-expanded={cards[r.id] === g.k}
                              onClick={() => setCards((x) => ({ ...x, [r.id]: x[r.id] === g.k ? null : g.k }))}
                              className={`flex items-center justify-between gap-2 rounded-sm2 border px-3 py-2 text-xs font-semibold ${g.btn} ${cards[r.id] === g.k ? g.on : ""}`}>
                        <span>{g.icon} {g.t} <span className="num font-normal opacity-70">({REPLY_CARDS[g.k].length})</span></span>
                        <span className="text-[10px]">{cards[r.id] === g.k ? "▲" : "▼"}</span>
                      </button>
                    ))}
                  </div>
                  {cards[r.id] && (() => {
                    const g = REPLY_GROUPS.find((x) => x.k === cards[r.id]);
                    return (
                      <div className="grid auto-rows-fr grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {REPLY_CARDS[g.k].map((t) => {
                          const text = fillReply(t, caseOf(r.case_key));
                          return (
                            <button key={t} type="button" onClick={() => { setNote((x) => ({ ...x, [r.id]: text })); setCards((x) => ({ ...x, [r.id]: null })); }}
                                    className={`flex h-full items-start gap-1.5 rounded-sm2 border px-3 py-2 text-start text-[12px] leading-relaxed ${g.card}`}>
                              <span className="shrink-0">{g.icon}</span><span>{text}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="field min-w-0 flex-1 basis-60" placeholder="ملاحظة للمستفيد (إلزامية عند عدم القبول)"
                           value={note[r.id] ?? ""} onChange={(e) => setNote((x) => ({ ...x, [r.id]: e.target.value }))} />
                    <button className="btn-primary px-4 py-1.5 text-xs" disabled={busy === r.id} onClick={() => decide(r, true)}>قبول العذر</button>
                    <button className="rounded-pill border border-absent/50 px-4 py-1.5 text-xs font-semibold text-absent hover:bg-absent/5"
                            disabled={busy === r.id} onClick={() => decide(r, false)}>عدم القبول</button>
                  </div>
                  </div>
                ) : (
                  <p className="border-t border-line pt-2 text-xs text-muted">
                    {deciderText(r)} · <span className="num">{r.decided_at ? fmtDateTime(r.decided_at) : ""}</span>
                    {r.decision_note && <> · {r.decision_note}</>}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
