// src/pages/polls/PollsAdmin.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";
import { AUDIENCE } from "../../lib/banners.js";
import { printReport } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { POLL_KIND, POLL_RESULTS, pollState, setupMsg, pct } from "../../lib/polls.js";
import Loader from "../../components/Loader.jsx";
import PollResults, { usePollResults } from "./PollResults.jsx";

/* =====================================================================
   التصويت والاستطلاعات — صفحة الإدارة (صلاحية «التصويت والاستطلاعات»، supabase/polls_1..2.sql):
   إنشاء استطلاع أو انتخاب بخياراته ولمن يظهر وموعده ومتى تظهر نتائجه، ونشره، ومتابعة المشاركة
   والنتائج، والإغلاق المبكر والإلغاء، وطباعة محضر النتيجة. انتخابات الترشيحات تُدار من إعلانها.
   ===================================================================== */

const pad = (n) => String(n).padStart(2, "0");
const local = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const blank = () => ({ kind: "poll", title: "", body: "", options: ["", ""], max_choices: 1, audience: ["student"], grades: [],
  opens: local(Date.now()), closes: local(Date.now() + 3 * 864e5), results: "after" });
const pill = (on) => `rounded-pill px-3 py-1 text-xs font-medium ${on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`;

export default function PollsAdmin() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    supabase.from("polls").select("*, poll_options(id)").is("nom_call_id", null).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { setErr(error ? setupMsg(error) : ""); setRows(data ?? []); });
  }, [reload]);
  if (edit) return <Editor init={edit} onClose={(saved) => { setEdit(null); if (saved) setReload((x) => x + 1); }} />;
  if (!rows) return <Loader />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">التصويت والاستطلاعات</h1>
          <p className="text-sm text-muted">استطلاعات الرأي والانتخابات للطلاب وأولياء الأمور والمعلمين والإداريين. انتخابات الترشيحات تُدار من إعلانها.</p>
        </div>
        <button className="btn-primary" onClick={() => setEdit(blank())}>+ تصويت جديد</button>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {!rows.length ? <p className="card px-4 py-8 text-center text-sm text-muted">لا تصويت بعد. ابدأ بـ «تصويت جديد».</p> : rows.map((p) => (
        <Row key={p.id} p={p} open={open === p.id} onOpen={() => setOpen(open === p.id ? null : p.id)}
             onEdit={() => setEdit({ ...p, options: [], opens: local(p.opens_at), closes: local(p.closes_at) })} onChange={() => setReload((x) => x + 1)} />
      ))}
    </div>
  );
}

function Row({ p, open, onOpen, onEdit, onChange }) {
  const st = pollState(p);
  const [k, setK] = useState(0);
  const { rows, err } = usePollResults(open ? p.id : null, k);
  const voted = rows?.[0]?.voters ?? 0;
  const act = async (patch, q) => { if (q && !window.confirm(q)) return; await supabase.from("polls").update(patch).eq("id", p.id); onChange(); setK((x) => x + 1); };
  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-start gap-2 px-4 py-3 text-right" onClick={onOpen}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{p.title}</p>
          <p className="text-xs text-muted">{POLL_KIND[p.kind]?.t} · {p.audience.map((a) => AUDIENCE.find(([x]) => x === a)?.[1]).join("، ")}
            {p.grades.length > 0 && ` · الصف ${p.grades.join("، ")}`} · حتى {fmtDateTime(p.closes_at)}</p>
        </div>
        <span className={`chip shrink-0 ${st.c}`}>{st.t}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line bg-canvas/40 px-4 py-3">
          {err ? <p className="text-sm text-absent">{err}</p> : <PollResults rows={rows} showTurnout />}
          <div className="flex flex-wrap gap-2 text-xs">
            {!p.published && <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => act({ published: true })}>نشر</button>}
            {!voted && <button className="rounded-pill border border-line px-3 py-1.5 text-muted hover:bg-canvas" onClick={onEdit}>تعديل</button>}
            {p.published && st.t === "مفتوح" && <button className="rounded-pill border border-line px-3 py-1.5 text-muted hover:bg-canvas"
              onClick={() => act({ closes_at: new Date().toISOString() }, "إغلاق التصويت الآن؟")}>إغلاق الآن</button>}
            {!p.cancelled_at && <button className="rounded-pill border border-absent/40 px-3 py-1.5 text-absent"
              onClick={() => act({ cancelled_at: new Date().toISOString() }, "إلغاء التصويت؟ يختفي عن المصوّتين.")}>إلغاء</button>}
            {rows?.length > 0 && <button className="rounded-pill border border-line px-3 py-1.5 text-muted hover:bg-canvas" onClick={() => printPoll(p, rows)}>طباعة المحضر</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Editor({ init, onClose }) {
  const { profile } = useSession();
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (!init.id) return;
    supabase.from("poll_options").select("label, note, sort").eq("poll_id", init.id).order("sort")
      .then(({ data }) => set("options", (data ?? []).map((o) => (o.note ? `${o.label} — ${o.note}` : o.label))));
  }, [init.id]);
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter((y) => y !== v) : [...f[k], v]);

  const save = async (publish) => {
    const opts = f.options.map((o) => o.trim()).filter(Boolean);
    if (!f.title.trim()) { setErr("اكتب عنوان التصويت."); return; }
    if (opts.length < 2) { setErr("أضف خيارين على الأقل."); return; }
    if (!f.audience.length) { setErr("اختر لمن يظهر."); return; }
    if (new Date(f.closes) <= new Date(f.opens)) { setErr("موعد الإغلاق قبل الفتح."); return; }
    setBusy(true); setErr("");
    const row = { kind: f.kind, title: f.title.trim(), body: f.body?.trim() || null, audience: f.audience, grades: f.grades,
      max_choices: f.kind === "election" ? 1 : Math.max(1, Math.min(opts.length, Number(f.max_choices) || 1)),
      opens_at: new Date(f.opens).toISOString(), closes_at: new Date(f.closes).toISOString(),
      results: f.results, published: publish ?? !!f.published };
    const q = f.id ? supabase.from("polls").update(row).eq("id", f.id).select("id").single()
      : supabase.from("polls").insert({ ...row, created_by_name: profile?.full_name ?? null }).select("id").single();
    const { data, error } = await q;
    if (error) { setBusy(false); setErr(setupMsg(error)); return; }
    if (f.id) await supabase.from("poll_options").delete().eq("poll_id", f.id);
    const { error: e2 } = await supabase.from("poll_options").insert(opts.map((o, i) => {
      const [label, ...note] = o.split(" — ");
      return { poll_id: data.id, label: label.trim(), note: note.join(" — ").trim() || null, sort: i };
    }));
    setBusy(false);
    if (e2) { setErr(e2.message); return; }
    onClose(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink">{f.id ? "تعديل التصويت" : "تصويت جديد"}</h1>
        <button className="text-sm text-muted underline" onClick={() => onClose(false)}>رجوع</button>
      </div>
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <section className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5">{Object.entries(POLL_KIND).map(([k, v]) => <button key={k} className={pill(f.kind === k)} onClick={() => set("kind", k)}>{v.t}</button>)}</div>
        <p className="text-xs text-faint">{POLL_KIND[f.kind].hint}</p>
        <input className="field w-full" value={f.title} maxLength={100} placeholder={f.kind === "election" ? "انتخاب ممثل الصف الثاني" : "ما النشاط الذي تفضّله في الفسحة؟"} onChange={(e) => set("title", e.target.value)} />
        <textarea className="field w-full" rows={2} value={f.body ?? ""} maxLength={600} placeholder="توضيح قصير (اختياري)" onChange={(e) => set("body", e.target.value)} />
      </section>
      <section className="card space-y-2 p-4">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">{f.kind === "election" ? "المرشحون" : "الخيارات"}</p>
          <button className="text-xs text-mint-deep underline" onClick={() => set("options", [...f.options, ""])}>+ إضافة</button></div>
        <p className="text-[11px] text-faint">لإضافة وصف للخيار اكتبه بعد شرطة: «عبدالله الحربي — الصف الثاني 3».</p>
        {f.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="num w-5 text-center text-xs text-faint">{i + 1}</span>
            <input className="field flex-1" value={o} maxLength={120} onChange={(e) => set("options", f.options.map((x, j) => (j === i ? e.target.value : x)))} />
            {f.options.length > 2 && <button className="text-xs text-absent" onClick={() => set("options", f.options.filter((_, j) => j !== i))}>حذف</button>}
          </div>
        ))}
        {f.kind === "poll" && (
          <label className="flex items-center gap-2 text-sm text-ink">يختار المصوّت حتى
            <input type="number" min="1" className="field w-20" value={f.max_choices} onChange={(e) => set("max_choices", e.target.value)} /> خيار</label>
        )}
      </section>
      <section className="card space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">لمن يظهر ومتى</p>
        <div className="flex flex-wrap gap-1.5">{AUDIENCE.map(([k, t]) => <button key={k} className={pill(f.audience.includes(k))} onClick={() => toggle("audience", k)}>{t}</button>)}</div>
        <div className="flex flex-wrap gap-1.5">
          <button className={pill(!f.grades.length)} onClick={() => set("grades", [])}>كل الصفوف</button>
          {[[1, "الأول"], [2, "الثاني"], [3, "الثالث"]].map(([g, t]) => <button key={g} className={pill(f.grades.includes(g))} onClick={() => toggle("grades", g)}>{t}</button>)}
        </div>
        <p className="text-[11px] text-faint">الصفوف للطلاب وأولياء أمورهم، والمعلمون والإداريون يرونه كلهم.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted">يُفتح<input type="datetime-local" className="field mt-1" value={f.opens} onChange={(e) => set("opens", e.target.value)} /></label>
          <label className="text-xs text-muted">يُغلق<input type="datetime-local" className="field mt-1" value={f.closes} onChange={(e) => set("closes", e.target.value)} /></label>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted">تظهر النتائج</p>
          <div className="flex flex-wrap gap-1.5">{Object.entries(POLL_RESULTS).filter(([k]) => f.kind === "poll" || k !== "live")
            .map(([k, v]) => <button key={k} className={pill(f.results === k)} onClick={() => set("results", k)}>{v.t}</button>)}</div>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>{f.published ? "حفظ" : "حفظ ونشر"}</button>
        {!f.published && <button className="rounded-pill border border-line px-4 py-2 text-sm text-muted" disabled={busy} onClick={() => save(false)}>حفظ مسودة</button>}
      </div>
    </div>
  );
}

function printPoll(p, rows) {
  const total = rows.reduce((a, r) => a + r.votes, 0);
  const { voters, eligible } = rows[0];
  printReport({
    title: `محضر نتيجة ${POLL_KIND[p.kind]?.t}: ${p.title}`,
    subtitle: `من ${fmtDateTime(p.opens_at)} إلى ${fmtDateTime(p.closes_at)} · صوّت ${voters}${eligible != null ? ` من ${eligible} يحق لهم (المشاركة ${pct(voters, eligible)}%)` : ""}`,
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
    headers: ["م", p.kind === "election" ? "المرشح" : "الخيار", "الأصوات", "النسبة"],
    rows: [...rows].sort((a, b) => b.votes - a.votes)
      .map((r, i) => [i + 1, r.note ? `${r.label} — ${r.note}` : r.label, r.votes, `${pct(r.votes, total)}%`]),
  });
}
