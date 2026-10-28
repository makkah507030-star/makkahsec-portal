// src/pages/scouts/ScoutReports.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { fmtDateTime } from "../../lib/dates";
import { shrinkImage } from "../../lib/imageResize.js";
import { isScoutRole } from "../../lib/scoutLeader.js";
import Loader from "../../components/Loader.jsx";
import { loadTeam, isSetupErr, SETUP_MSG } from "./data.js";

/* =====================================================================
   بلاغات الفريق الكشفي (supabase/scouts_7.sql): يرفع القائد أو نائبه بلاغًا (تنظيم أو
   طلاب) إلى وكيل شؤون الطلاب، فيصله إشعار، ويتحاوران داخل البلاغ حتى يُغلق.
   الصفحة نفسها في «الفريق الكشفي» وفي «بلاغات الفريق الكشفي» للوكيل (/scout-reports).
   ===================================================================== */

const KIND = { organization: "التنظيم", students: "الطلاب" };
const BUCKET = "scout-files";
const BLANK = { kind: "organization", title: "", body: "", ids: [], file: null };

export default function ScoutReports() {
  const { profile, adminRoles } = useSession();
  // طرف الوكيل: وكيل شؤون الطلاب (والمدير والدعم الفني) ما لم يكن من أدوار الكشافة
  const fromDeputy = adminRoles.some((r) => ["deputy_students", "principal", "tech_support"].includes(r)) && !adminRoles.some(isScoutRole);
  const [rows, setRows] = useState(null);
  const [team, setTeam] = useState({ members: [] });
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("open");
  const [nf, setNf] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => supabase.from("scout_reports").select("*, scout_report_msgs(count)").order("created_at", { ascending: false })
    .then(({ data, error }) => { if (error) setErr(isSetupErr(error) ? SETUP_MSG : error.message); setRows(data ?? []); });
  useEffect(() => { load(); loadTeam().then(setTeam); }, []);
  const nameOf = useMemo(() => Object.fromEntries(team.members.map((m) => [m.id, `${m.name} (${m.cls})`])), [team]);

  const add = async () => {
    if (!nf.title.trim()) return;
    setBusy(true); setErr("");
    try {
      let photo = null;
      if (nf.file) {
        const img = await shrinkImage(nf.file, 1600, 0.8, { jpeg: true });
        photo = `reports/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(photo, img, { contentType: "image/jpeg" });
        if (error) throw error;
      }
      const { error } = await supabase.from("scout_reports").insert({
        kind: nf.kind, title: nf.title.trim(), body: nf.body.trim() || null, student_ids: nf.kind === "students" ? nf.ids : [],
        photo, created_by_name: profile?.full_name ?? null });
      if (error) throw error;
      setNf(null); setTab("open"); load();
    } catch (e) { setErr(isSetupErr(e) ? SETUP_MSG : e.message); }
    setBusy(false);
  };

  if (!rows) return <Loader />;
  const shown = rows.filter((r) => r.status === tab);
  if (open) return <Thread r={rows.find((x) => x.id === open)} nameOf={nameOf} fromDeputy={fromDeputy} me={profile?.full_name}
                           onBack={() => { setOpen(null); load(); }} />;

  return (
    <div className="space-y-4">
      {err && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {[["open", "مفتوحة"], ["closed", "مغلقة"]].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-pill px-4 py-1.5 text-sm font-semibold ${tab === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>
            {t} <span className="num">({rows.filter((r) => r.status === k).length})</span></button>
        ))}
        {!fromDeputy && !nf && <button className="btn-primary ms-auto px-4 py-1.5 text-xs" onClick={() => setNf(BLANK)}>+ بلاغ لوكيل شؤون الطلاب</button>}
      </div>

      {nf && (
        <section className="card space-y-3 p-4">
          <p className="font-semibold text-ink">بلاغ جديد إلى وكيل شؤون الطلاب</p>
          <div className="flex gap-1.5">
            {Object.entries(KIND).map(([k, t]) => (
              <button key={k} onClick={() => setNf({ ...nf, kind: k })} className={`rounded-pill px-3.5 py-1.5 text-xs font-semibold ${nf.kind === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted"}`}>ملاحظة على {t}</button>
            ))}
          </div>
          <input className="field w-full" value={nf.title} maxLength={100} placeholder="عنوان البلاغ، مثل: ازدحام عند بوابة الساحة وقت الفسحة" onChange={(e) => setNf({ ...nf, title: e.target.value })} />
          <textarea className="field w-full" rows={4} value={nf.body} placeholder="التفاصيل: ما حدث، ومتى، وأين، وما المطلوب من الوكيل…" onChange={(e) => setNf({ ...nf, body: e.target.value })} />
          {nf.kind === "students" && (
            <div>
              <p className="mb-1 text-xs text-muted">الطلاب المعنيون <span className="num">({nf.ids.length})</span></p>
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-sm2 border border-line p-2 sm:grid-cols-2">
                {team.members.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={nf.ids.includes(m.id)} onChange={(e) => setNf({ ...nf, ids: e.target.checked ? [...nf.ids, m.id] : nf.ids.filter((x) => x !== m.id) })} />
                    <span className="truncate">{m.name}</span>
                  </label>
                ))}
                {!team.members.length && <p className="text-xs text-muted">لا أعضاء في الفريق.</p>}
              </div>
            </div>
          )}
          <label className="block text-xs text-muted">صورة (اختيارية)
            <input type="file" accept="image/*" className="mt-1 block text-xs" onChange={(e) => setNf({ ...nf, file: e.target.files?.[0] ?? null })} />
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !nf.title.trim()} onClick={add}>{busy ? "جارٍ الإرسال…" : "إرسال للوكيل"}</button>
            <button className="btn-ghost" onClick={() => setNf(null)}>إلغاء</button>
          </div>
        </section>
      )}

      {shown.length === 0 ? (
        !nf && <p className="card px-4 py-8 text-center text-sm text-muted">{tab === "open" ? "لا بلاغات مفتوحة." : "لا بلاغات مغلقة."}</p>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => (
            <button key={r.id} onClick={() => setOpen(r.id)} className="card flex w-full items-start gap-3 p-4 text-right hover:bg-canvas/50">
              <span className={`chip shrink-0 ${r.kind === "students" ? "bg-late/10 text-late" : "bg-excused/10 text-excused"}`}>{KIND[r.kind]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{r.title}</p>
                <p className="text-[11px] text-muted">{r.created_by_name} · <span className="num">{fmtDateTime(r.created_at)}</span>
                  {r.student_ids?.length > 0 && <> · <span className="num">{r.student_ids.length}</span> طلاب</>}</p>
              </div>
              <span className="num shrink-0 text-xs text-muted">{r.scout_report_msgs?.[0]?.count ?? 0} رد</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Thread({ r, nameOf, fromDeputy, me, onBack }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState(r.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const load = () => supabase.from("scout_report_msgs").select("*").eq("report_id", r.id).order("at").then(({ data }) => setMsgs(data ?? []));
  useEffect(() => {
    load();
    if (r.photo) supabase.storage.from(BUCKET).createSignedUrl(r.photo, 3600).then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [r.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr("");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("scout_report_msgs").insert({ report_id: r.id, body: text.trim(), by_user: u?.user?.id, by_name: me ?? null, from_deputy: fromDeputy });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setText(""); load();
  };
  const flip = async () => {
    const next = status === "open" ? "closed" : "open";
    const { error } = await supabase.from("scout_reports").update(next === "closed"
      ? { status: next, closed_at: new Date().toISOString(), closed_by_name: me ?? null } : { status: next, closed_at: null, closed_by_name: null }).eq("id", r.id);
    if (error) setErr(error.message); else setStatus(next);
  };

  return (
    <div className="space-y-3">
      <button className="text-xs text-muted underline" onClick={onBack}>← البلاغات</button>
      <section className="card space-y-2 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-ink">{r.title}</p>
            <p className="text-[11px] text-muted">{r.created_by_name} · <span className="num">{fmtDateTime(r.created_at)}</span></p>
          </div>
          <span className={`chip ${status === "open" ? "bg-late/10 text-late" : "bg-present/10 text-present"}`}>{status === "open" ? "مفتوح" : `مغلق${r.closed_by_name && status === r.status ? ` · ${r.closed_by_name}` : ""}`}</span>
        </div>
        {r.body && <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{r.body}</p>}
        {r.student_ids?.length > 0 && (
          <div className="flex flex-wrap gap-1">{r.student_ids.map((id) => <span key={id} className="rounded-pill bg-canvas px-2.5 py-0.5 text-xs text-ink">{nameOf[id] ?? "طالب"}</span>)}</div>
        )}
        {photo && <a href={photo} target="_blank" rel="noopener noreferrer"><img src={photo} alt="" className="max-h-64 rounded-sm2 border border-line object-contain" /></a>}
      </section>

      <section className="card space-y-2 p-4">
        {!msgs ? <Loader /> : msgs.length === 0 ? <p className="text-center text-xs text-muted">لا ردود بعد.</p> : msgs.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-card px-3 py-2 ${m.from_deputy ? "me-auto bg-excused/10" : "ms-auto bg-mint-tint"}`}>
            <p className="text-[10.5px] font-semibold text-muted">{m.by_name} · {m.from_deputy ? "شؤون الطلاب" : "الفريق الكشفي"}</p>
            <p className="whitespace-pre-line text-sm text-ink">{m.body}</p>
            <p className="num text-[10px] text-faint">{fmtDateTime(m.at)}</p>
          </div>
        ))}
        {err && <p className="text-sm text-absent">{err}</p>}
        {status === "open" && (
          <div className="flex gap-2 pt-1">
            <textarea className="field flex-1" rows={2} value={text} placeholder="اكتب ردك…" onChange={(e) => setText(e.target.value)} />
            <button className="btn-primary self-end" disabled={busy || !text.trim()} onClick={send}>إرسال</button>
          </div>
        )}
        <div className="flex justify-end">
          <button className="text-xs text-muted underline" onClick={flip}>{status === "open" ? "إغلاق البلاغ" : "إعادة فتح البلاغ"}</button>
        </div>
      </section>
    </div>
  );
}
