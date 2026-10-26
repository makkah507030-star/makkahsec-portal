// src/pages/EthicsCode.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import { fmtDateTime } from "../lib/dates";
import { countAr } from "../lib/arabicCount.js";
import { byName } from "../lib/sortAr.js";
import { useNotice } from "../lib/useNotice.js";
import { refreshNavBadges } from "../lib/navBadges.js";
import { printReport, rawHtml, escHtml, exportStyledExcel, ACADEMIC_DEPUTY_NAME, PRINCIPAL_NAME } from "../lib/exportUtils";
import Loader from "../components/Loader.jsx";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

/* =====================================================================
   ميثاق أخلاقيات المهنة (supabase/ethics_code.sql):
   • المعلم: يطّلع على المدونة صفحةً صفحة أو يحمّلها، ثم يقرّ باطّلاعه مرة واحدة.
     وحتى يقرّ تظهر له مهمة عاجلة في «بانتظار إجرائك» (lib/navBadges.js).
   • EthicsReport: من اطّلع ومن لم يطّلع — للمدير ووكيل الشؤون التعليمية والدعم الفني.
   ===================================================================== */

export const ETHICS_KEY = "ethics_code";
export const ETHICS_TITLE = "مدونة قواعد السلوك الوظيفي وأخلاقيات الوظيفة العامة";
const PDF = "/docs/ethics/ethics-code.pdf";
const PAGES = Array.from({ length: 16 }, (_, i) => `/docs/ethics/p${String(i + 1).padStart(2, "0")}.jpg`);
const ACK_TEXT = `أقرّ بأنني اطّلعت على ${ETHICS_TITLE}، وألتزم بما ورد فيها من قواعد وأخلاقيات في أداء عملي.`;

export default function EthicsCode() {
  const { session } = useSession();
  const uid = session?.user?.id;
  const [ack, setAck] = useState(undefined);     // undefined: جارٍ التحميل، null: لم يقرّ
  const [missing, setMissing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  useEffect(() => {
    if (!uid) return;
    supabase.from("doc_acks").select("acked_at").eq("doc_key", ETHICS_KEY).eq("user_id", uid).maybeSingle()
      .then(({ data, error }) => { if (error) { setMissing(true); setAck(null); } else setAck(data ?? null); });
  }, [uid]);

  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.from("doc_acks").insert({ doc_key: ETHICS_KEY }).select("acked_at").single();
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setAck(data);
    setMsg({ ok: true, text: "سُجّل إقرارك بالاطّلاع. شكرًا لك." });
    refreshNavBadges(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">ميثاق أخلاقيات المهنة</h1>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">
            {ETHICS_TITLE} — وزارة التعليم. اطّلع عليها كاملة، ثم أقرّ باطّلاعك في أسفل الصفحة.
          </p>
        </div>
        <a href={PDF} download="مدونة قواعد السلوك الوظيفي وأخلاقيات الوظيفة العامة.pdf" className="btn-ghost">تحميل PDF</a>
      </div>

      {missing && (
        <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">
          نفّذ ملف supabase/ethics_code.sql في قاعدة البيانات مرة واحدة لتفعيل الإقرار.
        </p>
      )}
      {ack && (
        <p className="rounded-sm2 bg-present/10 px-3 py-2 text-sm font-semibold text-present">
          ✓ أقررت بالاطّلاع على المدونة بتاريخ {fmtDateTime(ack.acked_at)}
        </p>
      )}

      {/* صفحات المدونة صورًا لتُقرأ على كل الأجهزة بلا عارض PDF */}
      <section className="card space-y-3 p-3">
        {PAGES.map((src, i) => (
          <img key={src} src={src} alt={`صفحة ${i + 1}`} loading={i < 2 ? "eager" : "lazy"}
               className="mx-auto w-full max-w-2xl rounded-sm2 border border-line" />
        ))}
      </section>

      {ack === null && !missing && (
        <section className="card space-y-3 border-2 border-absent/30 p-4">
          <p className="text-sm font-bold text-ink">الإقرار بالاطّلاع</p>
          <label className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
            <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            {ACK_TEXT}
          </label>
          <button className="btn-primary" disabled={!checked || busy} onClick={submit}>
            {busy ? "جارٍ الحفظ…" : "أقرّ بالاطّلاع"}
          </button>
        </section>
      )}
      {msg && !msg.ok && <p className="rounded-sm2 bg-absent/10 px-3 py-2 text-sm text-absent">{msg.text}</p>}
    </div>
  );
}

/* ---------------- تقرير الإقرارات: من اطّلع ومن لم يطّلع ---------------- */

// جوال المعلم بصيغة دولية لرابط واتساب (05xxxxxxxx ← 9665xxxxxxxx)
const waNumber = (m) => {
  const d = String(m ?? "").replace(/\D/g, "");
  return d.startsWith("05") ? `966${d.slice(1)}` : d.startsWith("5") ? `966${d}` : d;
};
const remindText = (name) => [
  `السلام عليكم ورحمة الله وبركاته${name ? ` أ. ${name}` : ""}`,
  `نأمل الاطّلاع على ${ETHICS_TITLE} في بوابة مكة الثانوية الرقمية والإقرار بالاطّلاع عليها`
    + " (القائمة ← ميثاق أخلاقيات المهنة).",
  "شاكرين تعاونك.",
  "makkahsec.com",
].join("\n");

// خانة التوقيع في التقرير المطبوع: صورة (HTML مقصود عبر rawHtml) أو نص
const sigCell = (url) => url
  ? rawHtml(`<img src="${escHtml(url)}" alt="توقيع" style="height:34px;max-width:120px;object-fit:contain" />`)
  : "✓ أقرّ إلكترونيًا";

export function EthicsReport() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [sigs, setSigs] = useState(() => new Map());   // user_id → رابط صورة التوقيع

  useEffect(() => {
    (async () => {
      const [t, a] = await Promise.all([
        supabase.rpc("doc_acks_teachers"),
        supabase.from("doc_acks").select("user_id, acked_at").eq("doc_key", ETHICS_KEY),
      ]);
      if (t.error || a.error) { setErr((t.error ?? a.error).message); setRows([]); return; }
      const at = new Map((a.data ?? []).map((r) => [r.user_id, r.acked_at]));
      setRows((t.data ?? []).map((x) => ({ ...x, acked_at: at.get(x.user_id) ?? null })).sort(byName()));
      // صور توقيعات من أقرّ (supabase/ethics_signatures.sql) — إن لم يُنفَّذ يبقى «✓ أقرّ إلكترونيًا»
      const { data: sg } = await supabase.rpc("doc_acks_signatures", { p_doc: ETHICS_KEY });
      if (sg?.length) {
        const { data: links } = await supabase.storage.from("form-assets").createSignedUrls(sg.map((x) => x.path), 3600);
        setSigs(new Map(sg.map((x, i) => [x.user_id, links?.[i]?.signedUrl]).filter(([, u]) => u)));
      }
    })();
  }, []);

  const done = useMemo(() => (rows ?? []).filter((r) => r.acked_at)
    .sort((a, b) => String(b.acked_at).localeCompare(String(a.acked_at))), [rows]);
  const pending = useMemo(() => (rows ?? []).filter((r) => !r.acked_at), [rows]);
  const shown = (tab === "done" ? done : pending).filter((r) => !q.trim() || (r.full_name ?? "").includes(q.trim()));
  const pct = rows?.length ? Math.round((done.length / rows.length) * 100) : 0;

  const reportOpts = () => ({
    title: "تقرير الاطّلاع على ميثاق أخلاقيات المهنة",
    subtitle: `${ETHICS_TITLE} · اطّلع ${done.length} من ${rows.length} (${pct}٪)`,
    sections: [
      { title: "لم يطّلعوا بعد", subtitle: countAr(pending.length, "teacher"), headers: ["م", "المعلم"],
        rows: pending.map((r, i) => [i + 1, r.full_name]), tableClass: "danger" },
      { title: "اطّلعوا وأقرّوا", subtitle: countAr(done.length, "teacher"), headers: ["م", "المعلم", "تاريخ الإقرار", "التوقيع"],
        rows: done.map((r, i) => [i + 1, r.full_name, fmtDateTime(r.acked_at), sigCell(sigs.get(r.user_id))]), tableClass: "success" },
    ],
    signatures: [
      { title: "وكيل الشؤون التعليمية", name: ACADEMIC_DEPUTY_NAME },
      { title: "مدير المدرسة", name: PRINCIPAL_NAME },
    ],
  });
  const print = () => printReport({ ...reportOpts(),
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href });
  const excel = () => exportStyledExcel({
    title: "تقرير الاطّلاع على ميثاق أخلاقيات المهنة", subtitle: reportOpts().subtitle,
    headers: ["م", "المعلم", "الحالة", "تاريخ الإقرار"],
    rows: [...pending, ...done].map((r, i) => [i + 1, r.full_name, r.acked_at ? "اطّلع وأقرّ" : "لم يطّلع", r.acked_at ? fmtDateTime(r.acked_at) : ""]),
    fileName: "الاطلاع على ميثاق أخلاقيات المهنة",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-ink">ميثاق أخلاقيات المهنة</h1>
          <p className="mt-0.5 text-sm text-muted">من اطّلع من المعلمين على {ETHICS_TITLE} وأقرّ بها، ومن لم يطّلع بعد.</p>
        </div>
        <Link to="/ethics" className="btn-ghost">عرض المدونة</Link>
      </div>

      {err && (
        <p className="rounded-sm2 bg-warning-light px-3 py-2 text-sm text-warning">
          تعذّر التحميل: {err} — نفّذ ملف supabase/ethics_code.sql مرة واحدة إن لم يُنفَّذ.
        </p>
      )}
      {rows === null ? <Loader /> : rows.length > 0 && (
        <>
          <section className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink">
                اطّلع <b className="num text-present">{done.length}</b> من <b>{countAr(rows.length, "teacher", { acc: true })}</b>
                <span className="num mr-2 chip bg-mint-tint text-mint-deep">{pct}٪</span>
              </p>
              <div className="flex gap-2">
                <button onClick={print} className="btn-ghost">طباعة PDF</button>
                <button onClick={excel} className="btn-ghost">Excel</button>
              </div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-pill bg-absent/15">
              <div className="h-full rounded-pill bg-present" style={{ width: `${pct}%` }} />
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {[["pending", `لم يطّلعوا (${pending.length})`], ["done", `اطّلعوا (${done.length})`]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`rounded-pill px-3.5 py-1.5 text-sm font-medium ${
                  tab === k ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>{l}</button>
            ))}
            <input className="field max-w-xs flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث باسم المعلم" />
          </div>

          <section className="card divide-y divide-line">
            {shown.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">
                {tab === "pending" ? "اطّلع جميع المعلمين على المدونة." : "لم يقرّ أحد بعد."}
              </p>
            )}
            {shown.map((r) => (
              <div key={r.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.full_name}</p>
                {r.acked_at
                  ? <div className="flex w-full items-center justify-between gap-2">
                      <span className="chip bg-present/10 text-present">✓ {fmtDateTime(r.acked_at)}</span>
                      {sigs.get(r.user_id)
                        ? <img src={sigs.get(r.user_id)} alt="توقيع" className="h-9 max-w-[110px] object-contain" />
                        : <span className="text-[11px] text-faint">لم يرفع توقيعه</span>}
                    </div>
                  : r.mobile && (
                    <a href={`https://api.whatsapp.com/send?phone=${waNumber(r.mobile)}&text=${encodeURIComponent(remindText(r.full_name))}`}
                       target="_blank" rel="noreferrer"
                       className="shrink-0 rounded-sm2 bg-present px-2 py-1 text-xs font-semibold text-white hover:opacity-90">
                      تذكير واتساب
                    </a>
                  )}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
